"""
Advanced LLM-based Sentiment Analysis System
Replaces transformer models with GPT-4 Turbo / GPT-5 Nano
Provides nuanced, context-aware sentiment analysis with business insights
"""

import json
import asyncio
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from enum import Enum
import redis
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class SentimentLabel(str, Enum):
    """Sentiment categories with business context"""
    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"
    MIXED = "mixed"


class AspectSentiment(BaseModel):
    """Sentiment for specific aspects"""
    aspect: str = Field(description="The aspect being analyzed (e.g., pricing, features, support)")
    sentiment: float = Field(description="Sentiment score from -1 to 1")
    confidence: float = Field(description="Confidence level 0-1")
    evidence: str = Field(description="Text evidence supporting this sentiment")


class SentimentAnalysis(BaseModel):
    """Comprehensive sentiment analysis result"""
    overall_sentiment: float = Field(description="Overall sentiment score from -1 to 1")
    sentiment_label: SentimentLabel = Field(description="Categorical sentiment label")
    confidence: float = Field(description="Analysis confidence 0-1")
    
    aspect_sentiments: List[AspectSentiment] = Field(
        default_factory=list,
        description="Sentiment breakdown by aspects"
    )
    
    emotional_tone: str = Field(
        description="Detected emotional tone (professional, excited, frustrated, etc.)"
    )
    
    intent: str = Field(
        description="User intent (purchase, research, complaint, praise, comparison)"
    )
    
    urgency_level: str = Field(
        description="Urgency level (immediate, high, medium, low)"
    )
    
    business_impact: str = Field(
        description="Potential business impact (reputation_risk, opportunity, neutral)"
    )
    
    key_phrases: List[str] = Field(
        default_factory=list,
        description="Key phrases that drive the sentiment"
    )
    
    recommendation: str = Field(
        description="Actionable recommendation based on sentiment"
    )


class LLMSentimentAnalyzer:
    """
    Production-ready sentiment analyzer using OpenAI GPT models.
    Provides deep, nuanced analysis beyond simple positive/negative.
    """
    
    # Optimized system prompt for sentiment analysis
    SYSTEM_PROMPT = """You are an expert sentiment analysis AI specializing in business intelligence and customer insights.

TASK: Analyze text for sentiment with business context and actionable insights.

CONTEXT:
- Brand: {brand_name}
- Industry: {industry}
- Analysis Purpose: {purpose}

ANALYSIS REQUIREMENTS:

1. OVERALL SENTIMENT:
   - Score: -1.0 (very negative) to 1.0 (very positive)
   - Consider context, sarcasm, and implied meaning
   - Weight by importance of statements

2. ASPECT-BASED SENTIMENT:
   Analyze sentiment for each mentioned aspect:
   - Product/Service Quality
   - Pricing/Value
   - Customer Support
   - Features/Functionality
   - Brand Perception
   - Comparison with Competitors

3. EMOTIONAL TONE DETECTION:
   - Professional/Formal
   - Excited/Enthusiastic
   - Frustrated/Angry
   - Disappointed
   - Satisfied/Content
   - Confused/Uncertain

4. INTENT CLASSIFICATION:
   - Purchase Intent
   - Research/Information Seeking
   - Complaint/Issue
   - Praise/Recommendation
   - Comparison Shopping
   - Feedback/Suggestion

5. BUSINESS IMPACT ASSESSMENT:
   - Reputation Risk: Could damage brand if unaddressed
   - Opportunity: Potential for upsell/engagement
   - Advocacy: Likely to recommend
   - Churn Risk: May switch to competitor

6. KEY INSIGHTS:
   - Extract phrases that drive sentiment
   - Identify specific pain points or delights
   - Note any mentioned competitors

OUTPUT FORMAT: Return ONLY valid JSON:
{{
  "overall_sentiment": float,
  "sentiment_label": "very_positive|positive|neutral|negative|very_negative|mixed",
  "confidence": float,
  "aspect_sentiments": [
    {{
      "aspect": "string",
      "sentiment": float,
      "confidence": float,
      "evidence": "supporting text"
    }}
  ],
  "emotional_tone": "string",
  "intent": "string",
  "urgency_level": "immediate|high|medium|low",
  "business_impact": "reputation_risk|opportunity|advocacy|churn_risk|neutral",
  "key_phrases": ["phrase1", "phrase2"],
  "recommendation": "actionable recommendation"
}}

CALIBRATION EXAMPLES:
- "This product is amazing!" → 0.8 (very positive)
- "It works fine" → 0.2 (mildly positive)
- "Terrible experience, switching to competitor" → -0.9 (very negative)
- "Has pros and cons" → 0.0 (neutral/mixed)

IMPORTANT:
- Detect sarcasm and adjust accordingly
- Consider cultural context in expressions
- Identify mixed sentiments accurately
- Provide actionable business recommendations"""

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
    
    def _generate_cache_key(self, text: str, context: Dict) -> str:
        """Generate deterministic cache key for request"""
        content = f"{text[:200]}_{context.get('brand_name', '')}_{context.get('purpose', '')}"
        return f"sentiment:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def analyze(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> SentimentAnalysis:
        """
        Analyze sentiment with business context.
        
        Args:
            text: Content to analyze
            context: {
                "brand_name": "YourBrand",
                "industry": "Technology",
                "purpose": "customer_review|social_media|support_ticket",
                "customer_id": "cust_123"
            }
        
        Returns:
            Comprehensive sentiment analysis with business insights
        """
        context = context or {}
        
        # Step 1: Check cache
        cache_key = self._generate_cache_key(text, context)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            logger.info(f"Cache hit for sentiment analysis")
            return cached_result
        
        # Step 2: Prepare optimized prompt
        system_prompt = self.SYSTEM_PROMPT.format(
            brand_name=context.get("brand_name", "Unknown"),
            industry=context.get("industry", "General"),
            purpose=context.get("purpose", "general_analysis")
        )
        
        # Step 3: Call OpenAI API
        try:
            result = await self._call_llm_optimized(system_prompt, text)
            
            # Step 4: Parse and validate results
            analysis = self._parse_llm_response(result)
            
            # Step 5: Cache results
            self._cache_result(cache_key, analysis)
            
            return analysis
            
        except Exception as e:
            logger.error(f"LLM sentiment analysis failed: {e}")
            # Fallback to basic analysis
            return self._fallback_analysis(text)
    
    async def _call_llm_optimized(
        self,
        system_prompt: str,
        text: str
    ) -> Dict:
        """
        Optimized OpenAI API call with timeout and structured output.
        """
        try:
            # Truncate text if too long
            analysis_text = text[:self.max_text_length] if len(text) > self.max_text_length else text
            
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="gpt-4-turbo-preview",  # Will be "gpt-5-nano" when available
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Analyze this text:\n\n{analysis_text}"}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,  # Low temperature for consistency
                    max_tokens=800,  # Enough for detailed analysis
                    seed=42  # Deterministic outputs
                ),
                timeout=2.0  # 2 second timeout for speed
            )
            
            return json.loads(response.choices[0].message.content)
            
        except asyncio.TimeoutError:
            logger.warning("LLM call timed out, using fallback")
            return {}
        except json.JSONDecodeError:
            logger.error("Invalid JSON from LLM")
            return {}
    
    def _parse_llm_response(self, llm_result: Dict) -> SentimentAnalysis:
        """Convert LLM response to SentimentAnalysis object"""
        try:
            # Parse aspect sentiments
            aspect_sentiments = []
            for aspect_data in llm_result.get("aspect_sentiments", []):
                aspect_sentiments.append(AspectSentiment(
                    aspect=aspect_data.get("aspect", "unknown"),
                    sentiment=aspect_data.get("sentiment", 0.0),
                    confidence=aspect_data.get("confidence", 0.5),
                    evidence=aspect_data.get("evidence", "")
                ))
            
            return SentimentAnalysis(
                overall_sentiment=llm_result.get("overall_sentiment", 0.0),
                sentiment_label=SentimentLabel(
                    llm_result.get("sentiment_label", "neutral")
                ),
                confidence=llm_result.get("confidence", 0.5),
                aspect_sentiments=aspect_sentiments,
                emotional_tone=llm_result.get("emotional_tone", "neutral"),
                intent=llm_result.get("intent", "unknown"),
                urgency_level=llm_result.get("urgency_level", "medium"),
                business_impact=llm_result.get("business_impact", "neutral"),
                key_phrases=llm_result.get("key_phrases", []),
                recommendation=llm_result.get("recommendation", "Monitor sentiment trends")
            )
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return self._fallback_analysis("")
    
    def _fallback_analysis(self, text: str) -> SentimentAnalysis:
        """Basic fallback sentiment analysis using keywords"""
        # Simple keyword-based fallback
        positive_words = {"good", "great", "excellent", "love", "amazing", "best", "perfect"}
        negative_words = {"bad", "terrible", "worst", "hate", "awful", "horrible", "poor"}
        
        text_lower = text.lower()
        words = set(text_lower.split())
        
        positive_count = len(words & positive_words)
        negative_count = len(words & negative_words)
        
        if positive_count > negative_count:
            sentiment = 0.5
            label = SentimentLabel.POSITIVE
        elif negative_count > positive_count:
            sentiment = -0.5
            label = SentimentLabel.NEGATIVE
        else:
            sentiment = 0.0
            label = SentimentLabel.NEUTRAL
        
        return SentimentAnalysis(
            overall_sentiment=sentiment,
            sentiment_label=label,
            confidence=0.3,  # Low confidence for fallback
            aspect_sentiments=[],
            emotional_tone="unknown",
            intent="unknown",
            urgency_level="medium",
            business_impact="neutral",
            key_phrases=[],
            recommendation="Manual review recommended due to analysis failure"
        )
    
    def _get_cached_result(self, cache_key: str) -> Optional[SentimentAnalysis]:
        """Retrieve cached results from Redis"""
        try:
            cached = self.redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return SentimentAnalysis(**data)
        except Exception as e:
            logger.debug(f"Cache retrieval failed: {e}")
        return None
    
    def _cache_result(self, cache_key: str, analysis: SentimentAnalysis):
        """Store results in Redis cache"""
        try:
            self.redis.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(analysis.dict(), default=str)
            )
        except Exception as e:
            logger.debug(f"Cache storage failed: {e}")
    
    async def analyze_batch(
        self,
        texts: List[str],
        context: Optional[Dict[str, Any]] = None
    ) -> List[SentimentAnalysis]:
        """
        Analyze multiple texts in parallel for efficiency.
        """
        tasks = [
            self.analyze(text, context)
            for text in texts
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any failures
        analyses = []
        for result in results:
            if isinstance(result, SentimentAnalysis):
                analyses.append(result)
            else:
                logger.error(f"Batch analysis error: {result}")
                analyses.append(self._fallback_analysis(""))
        
        return analyses
    
    async def compare_sentiments(
        self,
        text1: str,
        text2: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict:
        """
        Compare sentiment between two texts (e.g., before/after, competitor comparison).
        """
        analysis1, analysis2 = await asyncio.gather(
            self.analyze(text1, context),
            self.analyze(text2, context)
        )
        
        sentiment_change = analysis2.overall_sentiment - analysis1.overall_sentiment
        
        return {
            "text1_sentiment": analysis1.overall_sentiment,
            "text2_sentiment": analysis2.overall_sentiment,
            "sentiment_change": sentiment_change,
            "improvement": sentiment_change > 0.1,
            "deterioration": sentiment_change < -0.1,
            "stable": abs(sentiment_change) <= 0.1,
            "text1_label": analysis1.sentiment_label,
            "text2_label": analysis2.sentiment_label,
            "business_impact": self._assess_change_impact(sentiment_change)
        }
    
    def _assess_change_impact(self, change: float) -> str:
        """Assess business impact of sentiment change"""
        if change > 0.5:
            return "significant_improvement"
        elif change > 0.2:
            return "moderate_improvement"
        elif change < -0.5:
            return "critical_deterioration"
        elif change < -0.2:
            return "moderate_deterioration"
        else:
            return "stable"
    
    def close(self):
        """Cleanup resources"""
        if self.redis:
            self.redis.close()


# Compatibility class for backwards compatibility
class SentimentAnalyzer:
    """Backwards compatible wrapper for the new LLM sentiment analyzer"""
    
    def __init__(self):
        self.llm_analyzer = LLMSentimentAnalyzer()
    
    def analyze(self, text: str) -> Any:
        """Synchronous wrapper for compatibility"""
        import asyncio
        return asyncio.run(self.llm_analyzer.analyze(text))
    
    async def analyze_async(self, text: str, context: Optional[Dict] = None) -> SentimentAnalysis:
        """Async method for new implementations"""
        return await self.llm_analyzer.analyze(text, context)