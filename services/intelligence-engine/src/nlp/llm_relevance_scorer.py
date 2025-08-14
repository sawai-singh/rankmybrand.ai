"""
Advanced LLM-based Relevance Scoring System with Comprehensive Rubric
Uses GPT-4 Turbo with structured evaluation framework for consistent scoring
"""

import json
import asyncio
import hashlib
from typing import Dict, Optional, Any, List, Tuple
from enum import Enum
import redis
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, validator
from src.models.schemas import RelevanceResult
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class QueryIntent(str, Enum):
    """Query intent categories for contextual scoring"""
    INFORMATIONAL = "informational"  # "What is X?"
    NAVIGATIONAL = "navigational"    # "Find X website"
    TRANSACTIONAL = "transactional"  # "Buy X"
    COMMERCIAL = "commercial"        # "Best X products"
    COMPARISON = "comparison"         # "X vs Y"
    TECHNICAL = "technical"           # "How to X"
    LOCAL = "local"                   # "X near me"


class RelevanceAnalysis(BaseModel):
    """Comprehensive relevance analysis with strict rubric scores"""
    
    # Core relevance metrics (0.0-1.0)
    topical_relevance: float = Field(
        description="How well the response addresses the query topic"
    )
    intent_alignment: float = Field(
        description="How well the response matches query intent"
    )
    completeness_score: float = Field(
        description="Coverage of all query aspects"
    )
    accuracy_score: float = Field(
        description="Factual correctness and reliability"
    )
    specificity_score: float = Field(
        description="Level of specific vs generic information"
    )
    
    # Sub-metrics for detailed analysis
    directness: float = Field(
        description="Direct answer vs tangential information"
    )
    depth_score: float = Field(
        description="Depth and detail of information"
    )
    clarity_score: float = Field(
        description="Clarity and understandability"
    )
    actionability: float = Field(
        description="Practical usefulness of response"
    )
    
    # Contextual factors
    query_coverage_percentage: float = Field(
        description="Percentage of query elements addressed"
    )
    information_density: float = Field(
        description="Useful information per word ratio"
    )
    confidence_level: float = Field(
        description="Confidence in the assessment"
    )
    
    # Detailed breakdown
    query_elements_identified: List[str] = Field(
        default_factory=list,
        description="Key elements found in query"
    )
    elements_addressed: List[str] = Field(
        default_factory=list,
        description="Query elements addressed in response"
    )
    elements_missing: List[str] = Field(
        default_factory=list,
        description="Query elements not addressed"
    )
    irrelevant_content: List[str] = Field(
        default_factory=list,
        description="Off-topic or irrelevant content found"
    )
    
    # Qualitative assessment
    strengths: List[str] = Field(
        default_factory=list,
        description="Strong points of the response"
    )
    weaknesses: List[str] = Field(
        default_factory=list,
        description="Weak points of the response"
    )
    assessment_summary: str = Field(
        description="Brief qualitative assessment"
    )
    
    # Final composite score
    overall_relevance_score: float = Field(
        description="Weighted composite relevance score"
    )
    
    @validator('overall_relevance_score', 'topical_relevance', 'intent_alignment', 
               'completeness_score', 'accuracy_score', 'specificity_score',
               'directness', 'depth_score', 'clarity_score', 'actionability',
               'query_coverage_percentage', 'information_density', 'confidence_level')
    def validate_score_range(cls, v):
        """Ensure all scores are between 0.0 and 1.0"""
        return max(0.0, min(1.0, v))


class LLMRelevanceScorer:
    """
    Production-ready relevance scorer with comprehensive rubric.
    Ensures consistent, explainable relevance assessments.
    """
    
    # Comprehensive scoring rubric with specific criteria - Part 1
    SYSTEM_PROMPT = """You are a precision relevance assessment system that evaluates query-response pairs using a strict, consistent rubric.

# RELEVANCE SCORING RUBRIC

## 1. TOPICAL RELEVANCE (0.0-1.0)
Evaluate how well the response addresses the query topic:

**1.0 (Perfect):** Response directly addresses the exact topic with comprehensive coverage
- All aspects of the topic are covered
- Information is directly about the queried subject
- No drift from the main topic

**0.8-0.9 (Excellent):** Strong topical alignment with minor gaps
- Main topic thoroughly addressed
- 90%+ of content directly relevant
- Minimal tangential information

**0.6-0.7 (Good):** Solid topical coverage with some gaps
- Core topic addressed adequately
- 70-80% directly relevant content
- Some tangential but related information

**0.4-0.5 (Fair):** Partial topical relevance
- Topic partially addressed
- 40-60% relevant content
- Significant tangential content

**0.2-0.3 (Poor):** Minimal topical relevance
- Topic barely addressed
- 20-30% relevant content
- Mostly off-topic

**0.0-0.1 (Irrelevant):** No meaningful topical connection
- Completely different topic
- <10% relevant content

## 2. INTENT ALIGNMENT (0.0-1.0)
Assess how well the response matches the query's intent:

**Informational Intent (seeking knowledge):**
- 1.0: Provides complete, educational information
- 0.5: Partial information provided
- 0.0: No informational value

**Transactional Intent (seeking to complete action):**
- 1.0: Enables/guides the transaction completely
- 0.5: Partially helpful for transaction
- 0.0: No transactional guidance

**Navigational Intent (seeking specific destination):**
- 1.0: Provides exact destination/link/location
- 0.5: Provides related but not exact destination
- 0.0: No navigational help

**Commercial Intent (researching before purchase):**
- 1.0: Comprehensive comparison/review information
- 0.5: Some useful commercial information
- 0.0: No commercial value

## 3. COMPLETENESS SCORE (0.0-1.0)
Evaluate coverage of all query aspects:

**1.0:** All query elements fully addressed
**0.8:** 80% of elements addressed thoroughly
**0.6:** 60% of elements addressed
**0.4:** 40% of elements addressed
**0.2:** 20% of elements addressed
**0.0:** No query elements addressed

## 4. ACCURACY SCORE (0.0-1.0)
Assess factual correctness:

**1.0:** All information verifiably accurate
**0.8:** Mostly accurate with minor uncertainties
**0.6:** Generally accurate with some errors
**0.4:** Mix of accurate and inaccurate
**0.2:** Mostly inaccurate
**0.0:** Completely false or misleading

## 5. SPECIFICITY SCORE (0.0-1.0)
Evaluate specific vs generic information:

**1.0:** Highly specific, detailed, unique information
**0.8:** Mostly specific with some general points
**0.6:** Balance of specific and generic
**0.4:** Mostly generic with some specifics
**0.2:** Very generic information
**0.0:** Completely generic or vague

## 6. DIRECTNESS (0.0-1.0)
How directly the response answers:

**1.0:** Immediate, direct answer to query
**0.8:** Direct answer with brief context
**0.6:** Answer provided after some context
**0.4:** Answer buried in text
**0.2:** Very indirect answer
**0.0:** No direct answer provided

## 7. DEPTH SCORE (0.0-1.0)
Level of detail and thoroughness:

**1.0:** Comprehensive, expert-level depth
**0.8:** Detailed with good examples
**0.6:** Adequate detail for basic understanding
**0.4:** Surface-level information
**0.2:** Minimal detail
**0.0:** No substantive information

## 8. CLARITY SCORE (0.0-1.0)
Clarity and understandability:

**1.0:** Crystal clear, perfectly organized
**0.8:** Clear with good structure
**0.6:** Generally clear with minor confusion
**0.4:** Somewhat unclear or disorganized
**0.2:** Confusing or poorly structured
**0.0:** Incomprehensible

## 9. ACTIONABILITY (0.0-1.0)
Practical usefulness:

**1.0:** Immediately actionable with clear steps
**0.8:** Actionable with minor clarification needed
**0.6:** Some actionable elements
**0.4:** Limited practical value
**0.2:** Minimal actionability
**0.0:** No practical value

## ANALYSIS PROCESS:

1. **Identify Query Elements:**
   - List all key topics, questions, and requirements in the query
   - Determine the primary intent (informational, transactional, etc.)
   - Note any specific constraints or preferences

2. **Analyze Response Coverage:**
   - Check which query elements are addressed
   - Evaluate the depth of coverage for each element
   - Identify any irrelevant or off-topic content

3. **Apply Scoring Rubric:**
   - Score each dimension using the specific criteria above
   - Calculate query coverage percentage: (elements addressed / total elements) * 100
   - Calculate information density: (useful information sentences / total sentences)

4. **Calculate Overall Score:**
   Overall = (topical_relevance * 0.25) + (intent_alignment * 0.20) + 
             (completeness * 0.15) + (accuracy * 0.15) + (specificity * 0.10) +
             (directness * 0.05) + (depth * 0.05) + (clarity * 0.03) + (actionability * 0.02)

## OUTPUT FORMAT:
Return ONLY valid JSON with all required fields:

{
  "topical_relevance": 0.0-1.0,
  "intent_alignment": 0.0-1.0,
  "completeness_score": 0.0-1.0,
  "accuracy_score": 0.0-1.0,
  "specificity_score": 0.0-1.0,
  "directness": 0.0-1.0,
  "depth_score": 0.0-1.0,
  "clarity_score": 0.0-1.0,
  "actionability": 0.0-1.0,
  "query_coverage_percentage": 0.0-1.0,
  "information_density": 0.0-1.0,
  "confidence_level": 0.0-1.0,
  "query_elements_identified": ["element1", "element2"],
  "elements_addressed": ["element1"],
  "elements_missing": ["element2"],
  "irrelevant_content": ["off-topic point"],
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "assessment_summary": "Brief summary",
  "overall_relevance_score": 0.0-1.0
}

## EXAMPLES FOR CALIBRATION:

### Example 1: Perfect Relevance (1.0)
Query: "How do I reset my iPhone password?"
Response: "To reset your iPhone password: 1) Go to Settings > Face ID & Passcode 2) Enter current passcode 3) Tap 'Change Passcode' 4) Enter old passcode, then new passcode twice. If forgotten: Use iCloud.com Find My or Recovery Mode."
Scores: All dimensions 0.9-1.0 (direct, complete, accurate, actionable)

### Example 2: Good Relevance (0.7)
Query: "Best restaurants in Paris"
Response: "Paris has many great restaurants. The Eiffel Tower area has several bistros. French cuisine is world-renowned for its quality."
Scores: Topical 0.7, Specificity 0.3, Completeness 0.5 (generic, lacks specific names)

### Example 3: Poor Relevance (0.3)
Query: "Python list comprehension syntax"
Response: "Python is a popular programming language used for web development and data science."
Scores: Topical 0.3, Intent 0.1, Completeness 0.0 (doesn't answer the specific question)

CRITICAL INSTRUCTIONS:
- Apply the rubric consistently and objectively
- Penalize off-topic content proportionally
- Reward comprehensive, accurate answers
- Consider the user's likely goal
- Be precise with decimal scores (e.g., 0.85 not 0.8 or 0.9)
"""

    # Example-based calibration prompts for consistency
    CALIBRATION_EXAMPLES = [
        {
            "query": "What is the capital of France?",
            "response": "The capital of France is Paris.",
            "expected_scores": {
                "topical_relevance": 1.0,
                "intent_alignment": 1.0,
                "completeness_score": 1.0,
                "accuracy_score": 1.0,
                "specificity_score": 1.0,
                "directness": 1.0
            }
        },
        {
            "query": "How to make chocolate chip cookies",
            "response": "Cookies are a popular dessert.",
            "expected_scores": {
                "topical_relevance": 0.3,
                "intent_alignment": 0.1,
                "completeness_score": 0.0,
                "specificity_score": 0.1,
                "directness": 0.0
            }
        }
    ]
    
    def __init__(self, 
                 redis_client: Optional[redis.Redis] = None,
                 model: str = "gpt-4-turbo-preview",
                 enable_calibration: bool = True):
        """
        Initialize with OpenAI client and optional Redis cache.
        
        Args:
            redis_client: Redis client for caching
            model: OpenAI model to use
            enable_calibration: Whether to include calibration examples
        """
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = model
        self.enable_calibration = enable_calibration
        
        # Redis cache setup
        self.redis = redis_client or redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        
        # Cache configuration
        self.cache_ttl = 3600  # 1 hour cache
        self.max_query_length = 1000  # Max query length to process
        self.max_response_length = 4000  # Max response length to process
        
        # Scoring weights for composite score
        self.scoring_weights = {
            "topical_relevance": 0.25,
            "intent_alignment": 0.20,
            "completeness_score": 0.15,
            "accuracy_score": 0.15,
            "specificity_score": 0.10,
            "directness": 0.05,
            "depth_score": 0.05,
            "clarity_score": 0.03,
            "actionability": 0.02
        }
    
    def _generate_cache_key(self, query: str, response: str, context: Optional[Dict] = None) -> str:
        """Generate deterministic cache key for request"""
        context_str = json.dumps(context, sort_keys=True) if context else ""
        content = f"{query[:500]}_{response[:500]}_{context_str}"
        return f"relevance:v2:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def score(
        self,
        query: str,
        response: str,
        context: Optional[Dict[str, Any]] = None
    ) -> RelevanceResult:
        """
        Score relevance between query and response using comprehensive rubric.
        
        Args:
            query: The user's query/question
            response: The response to evaluate
            context: Optional context (e.g., platform, intent, priority)
        
        Returns:
            RelevanceResult with detailed scoring based on rubric
        """
        # Input validation
        if not query or not response:
            return self._create_empty_result("Empty query or response")
        
        # Truncate if needed
        query = query[:self.max_query_length]
        response = response[:self.max_response_length]
        
        # Check cache
        cache_key = self._generate_cache_key(query, response, context)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            logger.info("Cache hit for relevance scoring")
            return cached_result
        
        try:
            # Detect query intent if not provided
            if not context or "intent" not in context:
                intent = await self._detect_query_intent(query)
                context = context or {}
                context["intent"] = intent
            
            # Call LLM with rubric
            analysis = await self._call_llm_with_rubric(query, response, context)
            
            # Validate and normalize scores
            analysis = self._validate_analysis(analysis)
            
            # Create result
            result = self._create_relevance_result(analysis, context)
            
            # Cache result
            self._cache_result(cache_key, result)
            
            return result
            
        except Exception as e:
            logger.error(f"LLM relevance scoring failed: {e}")
            return self._fallback_scoring(query, response)
    
    async def _detect_query_intent(self, query: str) -> str:
        """Detect the intent of the query for contextual scoring"""
        query_lower = query.lower()
        
        # Simple rule-based intent detection (can be enhanced with ML)
        if any(word in query_lower for word in ["what is", "what are", "explain", "define"]):
            return QueryIntent.INFORMATIONAL
        elif any(word in query_lower for word in ["buy", "purchase", "price", "cost"]):
            return QueryIntent.TRANSACTIONAL
        elif any(word in query_lower for word in ["best", "top", "review", "recommend"]):
            return QueryIntent.COMMERCIAL
        elif any(word in query_lower for word in ["vs", "versus", "compare", "difference"]):
            return QueryIntent.COMPARISON
        elif any(word in query_lower for word in ["how to", "tutorial", "guide", "steps"]):
            return QueryIntent.TECHNICAL
        elif any(word in query_lower for word in ["near me", "nearby", "local"]):
            return QueryIntent.LOCAL
        elif any(word in query_lower for word in ["website", "site", "page", "url"]):
            return QueryIntent.NAVIGATIONAL
        else:
            return QueryIntent.INFORMATIONAL
    
    async def _call_llm_with_rubric(
        self,
        query: str,
        response: str,
        context: Dict
    ) -> RelevanceAnalysis:
        """Call OpenAI with the comprehensive rubric"""
        try:
            # Build the analysis prompt
            analysis_prompt = self._build_analysis_prompt(query, response, context)
            
            # Include calibration examples if enabled
            messages = [{"role": "system", "content": self.SYSTEM_PROMPT}]
            
            if self.enable_calibration and self.CALIBRATION_EXAMPLES:
                # Add one calibration example for consistency
                example = self.CALIBRATION_EXAMPLES[0]
                messages.append({
                    "role": "user",
                    "content": f"CALIBRATION EXAMPLE:\nQuery: {example['query']}\nResponse: {example['response']}"
                })
                messages.append({
                    "role": "assistant",
                    "content": json.dumps(example['expected_scores'])
                })
            
            # Add actual query
            messages.append({"role": "user", "content": analysis_prompt})
            
            # Call OpenAI with timeout
            response_obj = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,  # Low temperature for consistency
                    max_tokens=800,   # Enough for detailed analysis
                    seed=42          # Deterministic outputs
                ),
                timeout=3.0  # 3 second timeout
            )
            
            # Parse response
            llm_response = json.loads(response_obj.choices[0].message.content)
            return RelevanceAnalysis(**llm_response)
            
        except asyncio.TimeoutError:
            logger.warning("LLM call timed out")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from LLM: {e}")
            raise
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise
    
    def _build_analysis_prompt(self, query: str, response: str, context: Dict) -> str:
        """Build the analysis prompt with context"""
        prompt_parts = [
            f"QUERY:\n{query}\n",
            f"RESPONSE:\n{response}\n",
            f"CONTEXT:",
            f"- Query Intent: {context.get('intent', 'unknown')}",
            f"- Platform: {context.get('platform', 'general')}",
            f"- Priority: {context.get('priority', 'normal')}\n",
            "Apply the scoring rubric strictly and return JSON with all required fields."
        ]
        
        return "\n".join(prompt_parts)
    
    def _validate_analysis(self, analysis: RelevanceAnalysis) -> RelevanceAnalysis:
        """Validate and normalize analysis scores"""
        # Ensure all scores are in valid range (handled by validator)
        
        # Recalculate overall score with weights
        weighted_score = sum(
            getattr(analysis, field) * weight
            for field, weight in self.scoring_weights.items()
            if hasattr(analysis, field)
        )
        
        analysis.overall_relevance_score = round(weighted_score, 3)
        
        # Ensure query coverage percentage is calculated
        if analysis.query_elements_identified:
            coverage = len(analysis.elements_addressed) / len(analysis.query_elements_identified)
            analysis.query_coverage_percentage = round(coverage, 3)
        
        return analysis
    
    def _create_relevance_result(
        self, 
        analysis: RelevanceAnalysis,
        context: Dict
    ) -> RelevanceResult:
        """Create RelevanceResult from analysis"""
        return RelevanceResult(
            score=analysis.overall_relevance_score,
            confidence=analysis.confidence_level,
            keywords_matched=analysis.elements_addressed,
            keywords_missing=analysis.elements_missing,
            semantic_similarity=analysis.topical_relevance,
            explanation=analysis.assessment_summary,
            detailed_scores={
                "topical_relevance": analysis.topical_relevance,
                "intent_alignment": analysis.intent_alignment,
                "completeness": analysis.completeness_score,
                "accuracy": analysis.accuracy_score,
                "specificity": analysis.specificity_score,
                "directness": analysis.directness,
                "depth": analysis.depth_score,
                "clarity": analysis.clarity_score,
                "actionability": analysis.actionability,
                "query_coverage": analysis.query_coverage_percentage,
                "information_density": analysis.information_density
            },
            strengths=analysis.strengths,
            weaknesses=analysis.weaknesses,
            context=context
        )
    
    def _create_empty_result(self, reason: str) -> RelevanceResult:
        """Create empty result for invalid inputs"""
        return RelevanceResult(
            score=0.0,
            confidence=0.0,
            keywords_matched=[],
            keywords_missing=[],
            semantic_similarity=0.0,
            explanation=reason,
            detailed_scores={},
            strengths=[],
            weaknesses=["Invalid input"],
            context={}
        )
    
    def _fallback_scoring(self, query: str, response: str) -> RelevanceResult:
        """Enhanced fallback scoring using keyword and pattern matching"""
        # Tokenize and clean
        query_words = set(query.lower().split())
        response_words = set(response.lower().split())
        
        # Remove stop words
        stop_words = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
            'in', 'with', 'to', 'for', 'of', 'as', 'from', 'by', 'that', 'this'
        }
        query_words = query_words - stop_words
        response_words = response_words - stop_words
        
        # Calculate overlap
        overlap = query_words & response_words
        
        # Basic scoring
        if len(query_words) > 0:
            keyword_score = len(overlap) / len(query_words)
        else:
            keyword_score = 0.0
        
        # Length ratio penalty (penalize too short or too long responses)
        length_ratio = min(len(response_words) / max(len(query_words) * 3, 1), 1.0)
        
        # Combine scores
        final_score = (keyword_score * 0.7 + length_ratio * 0.3)
        
        return RelevanceResult(
            score=round(final_score, 3),
            confidence=0.3,  # Low confidence for fallback
            keywords_matched=list(overlap)[:10],
            keywords_missing=list(query_words - response_words)[:10],
            semantic_similarity=keyword_score,
            explanation="Fallback keyword-based scoring (LLM unavailable)",
            detailed_scores={
                "keyword_overlap": keyword_score,
                "length_ratio": length_ratio
            },
            strengths=["Quick assessment"],
            weaknesses=["No semantic understanding", "Basic keyword matching only"],
            context={"method": "fallback"}
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
    
    async def score_batch(
        self,
        queries_responses: List[Tuple[str, str]],
        context: Optional[Dict] = None
    ) -> List[RelevanceResult]:
        """
        Score multiple query-response pairs in parallel.
        
        Args:
            queries_responses: List of (query, response) tuples
            context: Optional context for all pairs
        
        Returns:
            List of RelevanceResults
        """
        tasks = [
            self.score(query, response, context)
            for query, response in queries_responses
        ]
        return await asyncio.gather(*tasks)
    
    async def calibrate(self) -> Dict[str, float]:
        """
        Run calibration examples to test scoring consistency.
        
        Returns:
            Dictionary of calibration metrics
        """
        calibration_results = {}
        
        for example in self.CALIBRATION_EXAMPLES:
            result = await self.score(
                example["query"],
                example["response"],
                {"calibration": True}
            )
            
            # Compare with expected scores
            for metric, expected in example["expected_scores"].items():
                actual = result.detailed_scores.get(metric, 0.0)
                diff = abs(actual - expected)
                calibration_results[f"{example['query'][:20]}_{metric}"] = diff
        
        # Calculate average deviation
        avg_deviation = sum(calibration_results.values()) / len(calibration_results)
        calibration_results["average_deviation"] = avg_deviation
        
        return calibration_results
    
    def close(self):
        """Cleanup resources"""
        if self.redis:
            self.redis.close()


# Platform-specific scorer with custom rubrics
class PlatformAwareRelevanceScorer(LLMRelevanceScorer):
    """
    Extended scorer with platform-specific adjustments.
    Different AI platforms have different response styles.
    """
    
    # Platform-specific scoring adjustments
    PLATFORM_ADJUSTMENTS = {
        "chatgpt": {
            "weights": {
                "clarity_score": 0.05,  # ChatGPT is usually very clear
                "depth_score": 0.10,     # Often provides detailed answers
            },
            "expectations": "Comprehensive, conversational responses"
        },
        "perplexity": {
            "weights": {
                "accuracy_score": 0.20,  # Citations make accuracy crucial
                "specificity_score": 0.15,  # Specific sources valued
            },
            "expectations": "Citation-backed, factual responses"
        },
        "claude": {
            "weights": {
                "clarity_score": 0.05,
                "actionability": 0.05,
            },
            "expectations": "Thoughtful, nuanced responses"
        },
        "gemini": {
            "weights": {
                "completeness_score": 0.20,
                "accuracy_score": 0.15,
            },
            "expectations": "Factual, comprehensive responses"
        }
    }
    
    async def score(
        self,
        query: str,
        response: str,
        context: Optional[Dict[str, Any]] = None
    ) -> RelevanceResult:
        """Score with platform-specific adjustments"""
        context = context or {}
        platform = context.get("platform", "general").lower()
        
        # Adjust weights based on platform
        if platform in self.PLATFORM_ADJUSTMENTS:
            platform_config = self.PLATFORM_ADJUSTMENTS[platform]
            
            # Update scoring weights
            original_weights = self.scoring_weights.copy()
            self.scoring_weights.update(platform_config["weights"])
            
            # Add platform context
            context["platform_expectations"] = platform_config["expectations"]
            
            # Score with adjusted weights
            result = await super().score(query, response, context)
            
            # Restore original weights
            self.scoring_weights = original_weights
            
            return result
        
        return await super().score(query, response, context)


# Backward compatibility wrapper
class RelevanceScorer:
    """Backward compatible wrapper for the new LLM relevance scorer"""
    
    def __init__(self):
        self.llm_scorer = PlatformAwareRelevanceScorer()
    
    def score(self, query: str, response: str) -> RelevanceResult:
        """Synchronous wrapper for compatibility"""
        import asyncio
        return asyncio.run(self.llm_scorer.score(query, response))


# Utility function for testing
async def test_relevance_scorer():
    """Test the relevance scorer with examples"""
    scorer = PlatformAwareRelevanceScorer()
    
    test_cases = [
        {
            "query": "What is the capital of France?",
            "response": "The capital of France is Paris, a city known for the Eiffel Tower.",
            "expected_score": 0.95
        },
        {
            "query": "How to make chocolate chip cookies?",
            "response": "Chocolate is made from cacao beans.",
            "expected_score": 0.25
        },
        {
            "query": "Best AI search optimization tools",
            "response": "AthenaHQ and RankMyBrand are leading GEO platforms. AthenaHQ tracks visibility across ChatGPT, Claude, and Perplexity. RankMyBrand offers comprehensive scoring with real-time monitoring.",
            "expected_score": 0.85
        }
    ]
    
    print("Running relevance scorer tests...\n")
    
    for test in test_cases:
        result = await scorer.score(
            test["query"],
            test["response"],
            {"platform": "chatgpt"}
        )
        
        print(f"Query: {test['query'][:50]}...")
        print(f"Response: {test['response'][:50]}...")
        print(f"Score: {result.score:.3f} (Expected: ~{test['expected_score']:.2f})")
        print(f"Confidence: {result.confidence:.3f}")
        print(f"Explanation: {result.explanation}")
        print("-" * 50)
    
    # Run calibration
    print("\nRunning calibration...")
    calibration_metrics = await scorer.calibrate()
    print(f"Average deviation: {calibration_metrics['average_deviation']:.3f}")
    
    scorer.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_relevance_scorer())
