"""
Advanced LLM-based Entity Detection System
Replaces hardcoded patterns with dynamic AI-powered detection
Optimized for GPT-4 Turbo / GPT-5 Nano with sub-200ms response times
"""

import json
import asyncio
import hashlib
import re
from typing import List, Dict, Optional, Set, Tuple, Any
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import redis
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from src.models.schemas import Entity
from src.config import settings
from src.utils import cost_tracker, circuit_breaker
import logging

logger = logging.getLogger(__name__)


class EntityDetectionResult(BaseModel):
    """Structured output from LLM entity detection"""
    brand_mentions: List[Dict[str, Any]] = Field(
        description="All mentions of the customer's brand with context and sentiment"
    )
    competitor_mentions: List[Dict[str, Any]] = Field(
        description="Competitor brand mentions with context and relationship"
    )
    product_references: List[Dict[str, Any]] = Field(
        description="Product/feature mentions related to the brand or competitors"
    )
    sentiment_analysis: Dict[str, float] = Field(
        description="Overall sentiment scores for each brand mentioned"
    )
    key_topics: List[str] = Field(
        description="Main topics discussed in relation to the brands"
    )
    visibility_score: float = Field(
        description="0-100 score of brand visibility in the content"
    )


class LLMEntityDetector:
    """
    Production-ready entity detector using OpenAI GPT models.
    Optimized for speed with caching, pre-filtering, and parallel processing.
    """
    
    # Optimized system prompt for entity detection
    SYSTEM_PROMPT = """You are an expert brand intelligence analyst specializing in entity recognition and competitive analysis.

TASK: Analyze text for brand mentions and competitive insights.

INPUTS:
- Primary Brand: {brand_name} (variations: {brand_variations})
- Industry: {industry}
- Known Competitors: {competitors}

DETECTION REQUIREMENTS:
1. BRAND MENTIONS: Find ALL instances of the primary brand, including:
   - Exact matches (case-insensitive)
   - Common misspellings or abbreviations
   - Contextual references (e.g., "the company", "they" when referring to the brand)

2. COMPETITOR IDENTIFICATION: Detect both:
   - Known competitors from the provided list
   - Newly discovered competitors based on context

3. SENTIMENT ANALYSIS: For each mention, determine:
   - Sentiment (-1 to 1 scale)
   - Confidence (0-1)
   - Context type (comparison, review, news, discussion)

4. VISIBILITY SCORING: Calculate 0-100 score based on:
   - Mention frequency (40% weight)
   - Prominence in text (30% weight)  
   - Positive sentiment (30% weight)

OUTPUT FORMAT: Return ONLY valid JSON matching this structure:
{{
  "brand_mentions": [
    {{
      "text": "exact text mentioned",
      "context": "surrounding sentence",
      "position": character_position,
      "sentiment": float,
      "confidence": float,
      "type": "direct|indirect|contextual"
    }}
  ],
  "competitor_mentions": [
    {{
      "name": "competitor name",
      "text": "exact mention",
      "context": "surrounding context",
      "relationship": "how it relates to primary brand",
      "sentiment": float
    }}
  ],
  "product_references": [
    {{
      "product": "product/feature name",
      "brand": "associated brand",
      "context": "usage context",
      "relevance": float
    }}
  ],
  "sentiment_analysis": {{
    "brand_name": overall_sentiment_score
  }},
  "key_topics": ["topic1", "topic2"],
  "visibility_score": float
}}

OPTIMIZATION RULES:
- Process text in one pass
- Minimize token usage
- Focus on business-critical insights
- Be precise with position markers"""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        """Initialize with OpenAI client and Redis cache"""
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.redis = redis_client or redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        
        # Thread pool for parallel processing
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Compile regex patterns for pre-filtering
        self.url_pattern = re.compile(r'https?://[^\s]+')
        self.email_pattern = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
        
        # Cache settings
        self.cache_ttl = 3600  # 1 hour cache
        self.max_text_length = 8000  # Max chars to process
        
    def _generate_cache_key(self, text: str, brand: str, competitors: List[str]) -> str:
        """Generate deterministic cache key for request"""
        content = f"{text[:500]}_{brand}_{''.join(sorted(competitors))}"
        return f"entity_detection:{hashlib.md5(content.encode()).hexdigest()}"
    
    def _pre_filter_text(self, text: str, brand: str) -> Tuple[str, Dict]:
        """
        Pre-process text with regex for known patterns.
        Returns cleaned text and pre-detected entities.
        """
        # Quick regex scan for definite brand matches
        pre_detected = {
            "url_mentions": [],
            "exact_matches": []
        }
        
        # Find exact brand matches (case-insensitive)
        brand_pattern = re.compile(rf'\b{re.escape(brand)}\b', re.IGNORECASE)
        for match in brand_pattern.finditer(text):
            pre_detected["exact_matches"].append({
                "text": match.group(),
                "position": match.start(),
                "confidence": 1.0
            })
        
        # Extract URLs that might contain brand
        for url_match in self.url_pattern.finditer(text):
            url = url_match.group().lower()
            if brand.lower() in url:
                pre_detected["url_mentions"].append(url)
        
        # Clean text for LLM processing (remove excess whitespace, limit length)
        cleaned = ' '.join(text.split())[:self.max_text_length]
        
        return cleaned, pre_detected
    
    async def detect(
        self,
        text: str,
        customer_context: Dict[str, any]
    ) -> List[Entity]:
        """
        Main detection method - orchestrates the entire process.
        
        Args:
            text: Content to analyze
            customer_context: {
                "brand_name": "Turing",
                "brand_variations": ["Turing.com", "Turing AI"],
                "industry": "Tech staffing",
                "competitors": ["Toptal", "Andela"],
                "customer_id": "cust_123"
            }
        
        Returns:
            List of detected entities with metadata
        """
        brand = customer_context.get("brand_name", "")
        if not brand:
            raise ValueError("Brand name is required for entity detection")
        
        # Step 1: Check cache
        cache_key = self._generate_cache_key(
            text, 
            brand, 
            customer_context.get("competitors", [])
        )
        
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            logger.info(f"Cache hit for brand: {brand}")
            return cached_result
        
        # Step 2: Pre-filter with regex
        cleaned_text, pre_detected = self._pre_filter_text(text, brand)
        
        # Step 3: Prepare optimized prompt
        system_prompt = self.SYSTEM_PROMPT.format(
            brand_name=brand,
            brand_variations=", ".join(customer_context.get("brand_variations", [brand])),
            industry=customer_context.get("industry", "General"),
            competitors=", ".join(customer_context.get("competitors", []))
        )
        
        # Step 4: Call OpenAI API with optimized settings
        try:
            result = await self._call_llm_optimized(
                system_prompt,
                cleaned_text,
                pre_detected
            )
            
            # Step 5: Parse and enrich results
            entities = self._parse_llm_response(result, pre_detected)
            
            # Step 6: Cache results
            self._cache_result(cache_key, entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"LLM detection failed: {e}")
            # Fallback to pre-detected entities only
            return self._fallback_to_regex(pre_detected, brand)
    
    async def _call_llm_optimized(
        self,
        system_prompt: str,
        text: str,
        pre_detected: Dict
    ) -> Dict:
        """
        Optimized OpenAI API call with streaming and timeout.
        Uses GPT-4 Turbo for maximum speed.
        """
        try:
            # Add pre-detected info to accelerate LLM processing
            enriched_text = f"""
Pre-detected exact matches: {len(pre_detected.get('exact_matches', []))}
Text to analyze:
{text}
"""
            
            # Execute with circuit breaker
            response = await circuit_breaker.call(
                asyncio.wait_for,
                self.client.chat.completions.create(
                    model="gpt-5-nano-2025-08-07",  # Will be "gpt-5-nano" when available
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": enriched_text}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,  # Low temperature for consistency
                    max_tokens=1500,  # Limit response size
                    seed=42,  # Deterministic outputs
                    stream=False  # Disable streaming for structured output
                ),
                timeout=3.0  # 3 second timeout
            )
            
            # Track costs
            customer_id = context.get('customer_id', 'unknown')
            if response.usage:
                await cost_tracker.track_usage(
                    customer_id=customer_id,
                    model="gpt-5-nano-2025-08-07",
                    input_tokens=response.usage.prompt_tokens,
                    output_tokens=response.usage.completion_tokens,
                    metadata={'purpose': 'entity_detection', 'brand': context.get('brand_name')}
                )
            
            return json.loads(response.choices[0].message.content)
            
        except asyncio.TimeoutError:
            logger.warning("LLM call timed out, using fallback")
            return {}
        except json.JSONDecodeError:
            logger.error("Invalid JSON from LLM")
            return {}
    
    def _parse_llm_response(
        self,
        llm_result: Dict,
        pre_detected: Dict
    ) -> List[Entity]:
        """Convert LLM response to Entity objects with enrichment"""
        entities = []
        
        # Process brand mentions
        for mention in llm_result.get("brand_mentions", []):
            entities.append(Entity(
                text=mention.get("text", ""),
                type="BRAND",
                confidence=mention.get("confidence", 0.8),
                start_pos=mention.get("position", 0),
                end_pos=mention.get("position", 0) + len(mention.get("text", "")),
                context=mention.get("context", ""),
                metadata={
                    "sentiment": mention.get("sentiment", 0),
                    "mention_type": mention.get("type", "direct")
                }
            ))
        
        # Process competitor mentions
        for comp in llm_result.get("competitor_mentions", []):
            entities.append(Entity(
                text=comp.get("name", ""),
                type="COMPETITOR",
                confidence=0.9,
                start_pos=0,  # Will be enriched later
                end_pos=0,
                context=comp.get("context", ""),
                metadata={
                    "sentiment": comp.get("sentiment", 0),
                    "relationship": comp.get("relationship", "")
                }
            ))
        
        # Add pre-detected exact matches with high confidence
        for match in pre_detected.get("exact_matches", []):
            # Check if not already in LLM results
            if not any(e.start_pos == match["position"] for e in entities):
                entities.append(Entity(
                    text=match["text"],
                    type="BRAND",
                    confidence=1.0,
                    start_pos=match["position"],
                    end_pos=match["position"] + len(match["text"]),
                    context="",
                    metadata={"source": "regex"}
                ))
        
        # Sort by position
        entities.sort(key=lambda x: x.start_pos)
        
        return entities
    
    def _fallback_to_regex(self, pre_detected: Dict, brand: str) -> List[Entity]:
        """Fallback to regex-only detection when LLM fails"""
        entities = []
        
        for match in pre_detected.get("exact_matches", []):
            entities.append(Entity(
                text=match["text"],
                type="BRAND",
                confidence=match["confidence"],
                start_pos=match["position"],
                end_pos=match["position"] + len(match["text"]),
                context="",
                metadata={"source": "regex_fallback"}
            ))
        
        return entities
    
    def _get_cached_result(self, cache_key: str) -> Optional[List[Entity]]:
        """Retrieve cached results from Redis"""
        try:
            cached = self.redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return [Entity(**e) for e in data]
        except Exception as e:
            logger.debug(f"Cache retrieval failed: {e}")
        return None
    
    def _cache_result(self, cache_key: str, entities: List[Entity]):
        """Store results in Redis cache"""
        try:
            data = [e.dict() for e in entities]
            self.redis.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(data, default=str)
            )
        except Exception as e:
            logger.debug(f"Cache storage failed: {e}")
    
    async def analyze_visibility(
        self,
        texts: List[str],
        customer_context: Dict
    ) -> Dict:
        """
        Analyze brand visibility across multiple texts.
        Uses parallel processing for speed.
        """
        tasks = [
            self.detect(text, customer_context)
            for text in texts
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Aggregate results
        total_mentions = 0
        competitor_mentions = {}
        sentiments = []
        
        for result in results:
            if isinstance(result, list):
                brand_entities = [e for e in result if e.type == "BRAND"]
                total_mentions += len(brand_entities)
                
                for e in result:
                    if e.type == "COMPETITOR":
                        comp_name = e.text
                        competitor_mentions[comp_name] = competitor_mentions.get(comp_name, 0) + 1
                    
                    if e.metadata and "sentiment" in e.metadata:
                        sentiments.append(e.metadata["sentiment"])
        
        avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0
        
        return {
            "total_brand_mentions": total_mentions,
            "competitor_breakdown": competitor_mentions,
            "average_sentiment": avg_sentiment,
            "visibility_score": min(100, (total_mentions * 10))  # Simple scoring
        }
    
    def close(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=False)
        if self.redis:
            self.redis.close()