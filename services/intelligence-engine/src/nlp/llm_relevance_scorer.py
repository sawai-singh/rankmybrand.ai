"""
Advanced LLM-based Relevance Scoring System
Uses GPT-4 Turbo / GPT-5 Nano for intelligent relevance assessment
"""

import json
import asyncio
import hashlib
from typing import Dict, Optional, Any
import redis
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from src.models.schemas import RelevanceResult
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class RelevanceAnalysis(BaseModel):
    """Comprehensive relevance analysis result"""
    relevance_score: float = Field(
        description="Overall relevance score from 0 to 1"
    )
    confidence: float = Field(
        description="Confidence in the assessment (0-1)"
    )
    query_coverage: float = Field(
        description="How well the response covers the query topics (0-1)"
    )
    directness: float = Field(
        description="How directly the response addresses the query (0-1)"
    )
    completeness: float = Field(
        description="How complete the response is (0-1)"
    )
    accuracy: float = Field(
        description="Factual accuracy of the response (0-1)"
    )
    key_topics_covered: list[str] = Field(
        default_factory=list,
        description="Main topics from query that were addressed"
    )
    missing_topics: list[str] = Field(
        default_factory=list,
        description="Important topics that were not addressed"
    )
    assessment: str = Field(
        description="Qualitative assessment of relevance"
    )


class LLMRelevanceScorer:
    """
    Production-ready relevance scorer using OpenAI GPT models.
    Provides nuanced assessment of query-response relevance.
    """
    
    # Optimized system prompt for relevance scoring
    SYSTEM_PROMPT = """You are an expert relevance assessment AI specializing in query-response analysis.

TASK: Evaluate how well a response answers a given query.

SCORING CRITERIA:

1. RELEVANCE (0-1 scale):
   - 1.0: Perfect - Directly and completely answers the query
   - 0.8-0.9: Excellent - Answers most aspects very well
   - 0.6-0.7: Good - Addresses main points with some gaps
   - 0.4-0.5: Fair - Partially relevant with significant gaps
   - 0.2-0.3: Poor - Minimal relevance, mostly off-topic
   - 0.0-0.1: Irrelevant - No meaningful connection to query

2. QUERY COVERAGE:
   - Identify all key topics/questions in the query
   - Check which are addressed in the response
   - Calculate coverage percentage

3. DIRECTNESS:
   - Does the response directly answer the question?
   - Or does it provide tangential information?

4. COMPLETENESS:
   - Are all aspects of the query addressed?
   - Is the response comprehensive?

5. ACCURACY:
   - Is the information factually correct?
   - Are there any misleading statements?

OUTPUT FORMAT: Return ONLY valid JSON:
{{
  "relevance_score": 0.0-1.0,
  "confidence": 0.0-1.0,
  "query_coverage": 0.0-1.0,
  "directness": 0.0-1.0,
  "completeness": 0.0-1.0,
  "accuracy": 0.0-1.0,
  "key_topics_covered": ["topic1", "topic2"],
  "missing_topics": ["topic3", "topic4"],
  "assessment": "Brief qualitative assessment"
}}

IMPORTANT:
- Be objective and consistent
- Consider user intent
- Penalize off-topic content
- Reward comprehensive answers
- Account for response quality"""

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
        
        # Cache settings
        self.cache_ttl = 3600  # 1 hour cache
        self.max_text_length = 4000  # Max chars to process
    
    def _generate_cache_key(self, query: str, response: str) -> str:
        """Generate deterministic cache key for request"""
        content = f"{query[:200]}_{response[:200]}"
        return f"relevance:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def score(
        self,
        query: str,
        response: str,
        context: Optional[Dict[str, Any]] = None
    ) -> RelevanceResult:
        """
        Score relevance between query and response.
        
        Args:
            query: The user's query/question
            response: The response to evaluate
            context: Optional context for scoring
        
        Returns:
            RelevanceResult with detailed scoring
        """
        # Step 1: Check cache
        cache_key = self._generate_cache_key(query, response)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            logger.info(f"Cache hit for relevance scoring")
            return cached_result
        
        # Step 2: Call OpenAI API
        try:
            result = await self._call_llm_optimized(query, response)
            
            # Step 3: Parse results
            analysis = self._parse_llm_response(result)
            
            # Step 4: Create RelevanceResult
            relevance_result = RelevanceResult(
                score=analysis.relevance_score,
                confidence=analysis.confidence,
                keywords_matched=analysis.key_topics_covered,
                keywords_missing=analysis.missing_topics,
                semantic_similarity=analysis.query_coverage,
                explanation=analysis.assessment
            )
            
            # Step 5: Cache results
            self._cache_result(cache_key, relevance_result)
            
            return relevance_result
            
        except Exception as e:
            logger.error(f"LLM relevance scoring failed: {e}")
            # Fallback to basic scoring
            return self._fallback_scoring(query, response)
    
    async def _call_llm_optimized(
        self,
        query: str,
        response: str
    ) -> Dict:
        """
        Optimized OpenAI API call with timeout.
        """
        try:
            # Prepare analysis text
            analysis_text = f"""QUERY:\n{query[:self.max_text_length]}\n\nRESPONSE:\n{response[:self.max_text_length]}"""
            
            response_obj = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="gpt-4-turbo-preview",  # Will be "gpt-5-nano" when available
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": analysis_text}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,  # Low temperature for consistency
                    max_tokens=500,  # Enough for relevance analysis
                    seed=42  # Deterministic outputs
                ),
                timeout=2.0  # 2 second timeout
            )
            
            return json.loads(response_obj.choices[0].message.content)
            
        except asyncio.TimeoutError:
            logger.warning("LLM call timed out, using fallback")
            return {}
        except json.JSONDecodeError:
            logger.error("Invalid JSON from LLM")
            return {}
    
    def _parse_llm_response(self, llm_result: Dict) -> RelevanceAnalysis:
        """Convert LLM response to RelevanceAnalysis object"""
        try:
            return RelevanceAnalysis(
                relevance_score=llm_result.get("relevance_score", 0.5),
                confidence=llm_result.get("confidence", 0.5),
                query_coverage=llm_result.get("query_coverage", 0.5),
                directness=llm_result.get("directness", 0.5),
                completeness=llm_result.get("completeness", 0.5),
                accuracy=llm_result.get("accuracy", 0.5),
                key_topics_covered=llm_result.get("key_topics_covered", []),
                missing_topics=llm_result.get("missing_topics", []),
                assessment=llm_result.get("assessment", "Unable to assess")
            )
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return RelevanceAnalysis(
                relevance_score=0.5,
                confidence=0.3,
                query_coverage=0.5,
                directness=0.5,
                completeness=0.5,
                accuracy=0.5,
                key_topics_covered=[],
                missing_topics=[],
                assessment="Parsing error"
            )
    
    def _fallback_scoring(self, query: str, response: str) -> RelevanceResult:
        """Basic fallback relevance scoring using keyword overlap"""
        # Simple keyword-based fallback
        query_words = set(query.lower().split())
        response_words = set(response.lower().split())
        
        # Remove common stop words
        stop_words = {'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but'}
        query_words = query_words - stop_words
        response_words = response_words - stop_words
        
        # Calculate overlap
        overlap = query_words & response_words
        score = len(overlap) / max(len(query_words), 1)
        
        return RelevanceResult(
            score=min(score, 1.0),
            confidence=0.3,  # Low confidence for fallback
            keywords_matched=list(overlap)[:10],
            keywords_missing=list(query_words - response_words)[:10],
            semantic_similarity=score,
            explanation="Fallback keyword-based scoring"
        )
    
    def _get_cached_result(self, cache_key: str) -> Optional[RelevanceResult]:
        """Retrieve cached results from Redis"""
        try:
            cached = self.redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return RelevanceResult(**data)
        except Exception as e:
            logger.debug(f"Cache retrieval failed: {e}")
        return None
    
    def _cache_result(self, cache_key: str, result: RelevanceResult):
        """Store results in Redis cache"""
        try:
            self.redis.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(result.dict(), default=str)
            )
        except Exception as e:
            logger.debug(f"Cache storage failed: {e}")
    
    def close(self):
        """Cleanup resources"""
        if self.redis:
            self.redis.close()


# Compatibility class for backwards compatibility
class RelevanceScorer:
    """Backwards compatible wrapper for the new LLM relevance scorer"""
    
    def __init__(self):
        self.llm_scorer = LLMRelevanceScorer()
    
    def score(self, query: str, response: str) -> RelevanceResult:
        """Synchronous wrapper for compatibility"""
        import asyncio
        return asyncio.run(self.llm_scorer.score(query, response))