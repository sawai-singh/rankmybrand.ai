"""
Unified Response Analyzer
Combines AI visibility response analyzer with traditional response processor
Single source of truth for all response analysis
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import logging
import re
from openai import AsyncOpenAI

# Import our calculators
from .calculators.geo_calculator import GEOCalculator
from .calculators.sov_calculator import SOVCalculator

logger = logging.getLogger(__name__)


class AnalysisMode(Enum):
    """Analysis modes for different use cases"""
    FULL = "full"  # Complete analysis with all components
    FAST = "fast"  # Quick analysis for real-time
    BATCH = "batch"  # Optimized for batch processing
    AI_VISIBILITY = "ai_visibility"  # AI visibility specific


class Sentiment(Enum):
    """Sentiment classification"""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    MIXED = "mixed"


class ContextQuality(Enum):
    """Quality of mention context"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class RecommendationStrength(Enum):
    """Strength of recommendation"""
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    NONE = "none"


@dataclass
class BrandAnalysis:
    """Brand mention analysis results"""
    mentioned: bool
    mention_count: int
    first_position: Optional[int]
    first_position_percentage: float
    context_quality: ContextQuality
    sentiment: Sentiment
    recommendation_strength: RecommendationStrength
    specific_features_mentioned: List[str]
    value_props_highlighted: List[str]


@dataclass
class CompetitorAnalysis:
    """Competitor mention analysis"""
    competitor_name: str
    mentioned: bool
    mention_count: int
    sentiment: Sentiment
    comparison_context: Optional[str]
    positioned_better: bool


@dataclass
class ResponseAnalysis:
    """Complete response analysis results"""
    analysis_id: str
    query: str
    response_text: str
    provider: str
    brand_analysis: BrandAnalysis
    competitors_analysis: List[CompetitorAnalysis]
    featured_snippet_potential: float
    voice_search_optimized: bool
    content_gaps: List[str]
    improvement_suggestions: List[str]
    seo_factors: Dict[str, Any]
    processing_time_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class UnifiedResponseAnalyzer:
    """
    Unified response analyzer combining AI and traditional analysis.
    Single source of truth for all response processing.
    """
    
    def __init__(
        self,
        openai_api_key: str,
        model: str = "gpt-5-chat-latest",
        mode: AnalysisMode = AnalysisMode.FULL
    ):
        """
        Initialize the unified analyzer.
        
        Args:
            openai_api_key: OpenAI API key
            model: Model to use for analysis
            mode: Analysis mode
        """
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        self.mode = mode
        
        # Initialize calculators
        self.geo_calculator = GEOCalculator()
        self.sov_calculator = SOVCalculator()
        
        # Cache for performance
        self._analysis_cache = {}
    
    async def analyze_response(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: Optional[List[str]] = None,
        provider: str = "unknown",
        features: Optional[List[str]] = None,
        value_props: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> ResponseAnalysis:
        """
        Analyze a single LLM response comprehensively.
        
        Args:
            response_text: The LLM response to analyze
            query: The original query
            brand_name: Brand to analyze for
            competitors: List of competitor names
            provider: LLM provider name
            features: Brand features to check
            value_props: Value propositions to check
            use_cache: Whether to use caching
        
        Returns:
            Complete response analysis
        """
        start_time = time.time()
        
        # Check cache
        cache_key = f"{query}:{provider}:{brand_name}"
        if use_cache and cache_key in self._analysis_cache:
            cached = self._analysis_cache[cache_key]
            cached.metadata['cache_hit'] = True
            return cached
        
        # Prepare analysis based on mode
        if self.mode == AnalysisMode.FAST:
            analysis = await self._fast_analysis(
                response_text, query, brand_name, competitors, provider
            )
        elif self.mode == AnalysisMode.AI_VISIBILITY:
            analysis = await self._ai_visibility_analysis(
                response_text, query, brand_name, competitors, provider, features, value_props
            )
        else:
            analysis = await self._full_analysis(
                response_text, query, brand_name, competitors, provider, features, value_props
            )
        
        # Add processing time
        analysis.processing_time_ms = (time.time() - start_time) * 1000
        
        # Cache result
        if use_cache:
            self._analysis_cache[cache_key] = analysis
        
        return analysis
    
    async def _full_analysis(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: Optional[List[str]],
        provider: str,
        features: Optional[List[str]],
        value_props: Optional[List[str]]
    ) -> ResponseAnalysis:
        """Comprehensive analysis using LLM"""
        
        # Build analysis prompt
        prompt = self._build_analysis_prompt(
            response_text, query, brand_name, competitors, features, value_props
        )
        
        try:
            # Call LLM for structured analysis
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at analyzing AI responses for brand visibility and SEO."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            # Parse LLM response
            analysis_data = json.loads(response.choices[0].message.content)
            
            # Create structured analysis
            brand_analysis = BrandAnalysis(
                mentioned=analysis_data.get('brand_mentioned', False),
                mention_count=analysis_data.get('mention_count', 0),
                first_position=analysis_data.get('first_position'),
                first_position_percentage=analysis_data.get('first_position_pct', 0),
                context_quality=ContextQuality(analysis_data.get('context_quality', 'none')),
                sentiment=Sentiment(analysis_data.get('sentiment', 'neutral')),
                recommendation_strength=RecommendationStrength(analysis_data.get('recommendation', 'none')),
                specific_features_mentioned=analysis_data.get('features_mentioned', []),
                value_props_highlighted=analysis_data.get('value_props', [])
            )
            
            competitors_analysis = [
                CompetitorAnalysis(
                    competitor_name=comp['name'],
                    mentioned=comp.get('mentioned', False),
                    mention_count=comp.get('count', 0),
                    sentiment=Sentiment(comp.get('sentiment', 'neutral')),
                    comparison_context=comp.get('context'),
                    positioned_better=comp.get('better_positioned', False)
                )
                for comp in analysis_data.get('competitors', [])
            ]
            
            return ResponseAnalysis(
                analysis_id=f"{provider}_{hash(response_text)}"[:12],
                query=query,
                response_text=response_text,
                provider=provider,
                brand_analysis=brand_analysis,
                competitors_analysis=competitors_analysis,
                featured_snippet_potential=analysis_data.get('snippet_potential', 0),
                voice_search_optimized=analysis_data.get('voice_optimized', False),
                content_gaps=analysis_data.get('content_gaps', []),
                improvement_suggestions=analysis_data.get('improvements', []),
                seo_factors=analysis_data.get('seo_factors', {}),
                processing_time_ms=0,  # Set by caller
                metadata={'llm_tokens': response.usage.total_tokens}
            )
            
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            # Fallback to fast analysis
            return await self._fast_analysis(
                response_text, query, brand_name, competitors, provider
            )
    
    async def _fast_analysis(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: Optional[List[str]],
        provider: str
    ) -> ResponseAnalysis:
        """Fast heuristic-based analysis without LLM"""
        
        response_lower = response_text.lower()
        brand_lower = brand_name.lower()
        
        # Brand mention analysis
        brand_mentioned = brand_lower in response_lower
        mention_count = response_lower.count(brand_lower)
        
        # Find first position
        first_position = None
        if brand_mentioned:
            position = response_lower.find(brand_lower)
            first_position = position
            first_position_pct = (position / len(response_text)) * 100 if response_text else 0
        else:
            first_position_pct = 100
        
        # Simple sentiment detection
        positive_words = ['excellent', 'best', 'recommended', 'top', 'leading', 'great']
        negative_words = ['poor', 'bad', 'issue', 'problem', 'avoid', 'worst']
        
        positive_count = sum(1 for word in positive_words if word in response_lower)
        negative_count = sum(1 for word in negative_words if word in response_lower)
        
        if positive_count > negative_count:
            sentiment = Sentiment.POSITIVE
        elif negative_count > positive_count:
            sentiment = Sentiment.NEGATIVE
        else:
            sentiment = Sentiment.NEUTRAL
        
        # Competitor analysis
        competitors_analysis = []
        if competitors:
            for comp in competitors:
                comp_lower = comp.lower()
                competitors_analysis.append(
                    CompetitorAnalysis(
                        competitor_name=comp,
                        mentioned=comp_lower in response_lower,
                        mention_count=response_lower.count(comp_lower),
                        sentiment=Sentiment.NEUTRAL,
                        comparison_context=None,
                        positioned_better=False
                    )
                )
        
        # Create analysis
        return ResponseAnalysis(
            analysis_id=f"{provider}_{hash(response_text)}"[:12],
            query=query,
            response_text=response_text,
            provider=provider,
            brand_analysis=BrandAnalysis(
                mentioned=brand_mentioned,
                mention_count=mention_count,
                first_position=first_position,
                first_position_percentage=first_position_pct,
                context_quality=ContextQuality.MEDIUM if brand_mentioned else ContextQuality.NONE,
                sentiment=sentiment,
                recommendation_strength=RecommendationStrength.MODERATE if brand_mentioned else RecommendationStrength.NONE,
                specific_features_mentioned=[],
                value_props_highlighted=[]
            ),
            competitors_analysis=competitors_analysis,
            featured_snippet_potential=50.0 if len(response_text) < 300 else 30.0,
            voice_search_optimized=len(response_text) < 200,
            content_gaps=[],
            improvement_suggestions=[],
            seo_factors={},
            processing_time_ms=0,
            metadata={'analysis_type': 'fast'}
        )
    
    async def _ai_visibility_analysis(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: Optional[List[str]],
        provider: str,
        features: Optional[List[str]],
        value_props: Optional[List[str]]
    ) -> ResponseAnalysis:
        """Specialized analysis for AI visibility audits"""
        
        # Use full analysis but with AI visibility specific prompts
        analysis = await self._full_analysis(
            response_text, query, brand_name, competitors, provider, features, value_props
        )
        
        # Add AI visibility specific metrics
        analysis.metadata['ai_visibility_score'] = self._calculate_ai_visibility_score(analysis)
        
        return analysis
    
    def _build_analysis_prompt(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: Optional[List[str]],
        features: Optional[List[str]],
        value_props: Optional[List[str]]
    ) -> str:
        """Build the analysis prompt for LLM"""
        
        prompt = f"""Analyze this AI response for brand visibility and SEO factors.

Query: {query}
Brand: {brand_name}
Competitors: {', '.join(competitors) if competitors else 'None'}
Key Features: {', '.join(features) if features else 'None'}
Value Props: {', '.join(value_props) if value_props else 'None'}

Response to analyze:
{response_text}

Provide a JSON response with:
{{
    "brand_mentioned": boolean,
    "mention_count": number,
    "first_position": number or null,
    "first_position_pct": number (0-100),
    "context_quality": "high|medium|low|none",
    "sentiment": "positive|neutral|negative|mixed",
    "recommendation": "strong|moderate|weak|none",
    "features_mentioned": [list of mentioned features],
    "value_props": [list of highlighted value props],
    "competitors": [
        {{
            "name": "competitor name",
            "mentioned": boolean,
            "count": number,
            "sentiment": "positive|neutral|negative",
            "context": "comparison context or null",
            "better_positioned": boolean
        }}
    ],
    "snippet_potential": number (0-100),
    "voice_optimized": boolean,
    "content_gaps": [list of missing important information],
    "improvements": [list of suggestions],
    "seo_factors": {{
        "keyword_density": number,
        "readability": "high|medium|low",
        "structure": "good|fair|poor"
    }}
}}"""
        
        return prompt
    
    def _calculate_ai_visibility_score(self, analysis: ResponseAnalysis) -> float:
        """Calculate AI visibility score from analysis"""
        
        score = 0
        
        # Brand mention (40%)
        if analysis.brand_analysis.mentioned:
            score += 20
            if analysis.brand_analysis.first_position_percentage < 20:
                score += 20
            elif analysis.brand_analysis.first_position_percentage < 50:
                score += 10
        
        # Sentiment (30%)
        if analysis.brand_analysis.sentiment == Sentiment.POSITIVE:
            score += 30
        elif analysis.brand_analysis.sentiment == Sentiment.NEUTRAL:
            score += 15
        
        # Recommendation (20%)
        if analysis.brand_analysis.recommendation_strength == RecommendationStrength.STRONG:
            score += 20
        elif analysis.brand_analysis.recommendation_strength == RecommendationStrength.MODERATE:
            score += 10
        
        # Features and value props (10%)
        if analysis.brand_analysis.specific_features_mentioned:
            score += 5
        if analysis.brand_analysis.value_props_highlighted:
            score += 5
        
        return min(score, 100)
    
    async def analyze_batch(
        self,
        responses: List[Dict[str, Any]],
        brand_name: str,
        competitors: Optional[List[str]] = None,
        parallel: bool = True,
        max_concurrent: int = 10
    ) -> List[ResponseAnalysis]:
        """
        Analyze multiple responses in batch.
        
        Args:
            responses: List of response dictionaries
            brand_name: Brand to analyze for
            competitors: List of competitors
            parallel: Whether to process in parallel
            max_concurrent: Max concurrent analyses
        
        Returns:
            List of analyses
        """
        
        if not parallel:
            # Sequential processing
            results = []
            for resp in responses:
                analysis = await self.analyze_response(
                    resp['response_text'],
                    resp['query'],
                    brand_name,
                    competitors,
                    resp.get('provider', 'unknown')
                )
                results.append(analysis)
            return results
        
        # Parallel processing with semaphore
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def analyze_with_semaphore(resp):
            async with semaphore:
                return await self.analyze_response(
                    resp['response_text'],
                    resp['query'],
                    brand_name,
                    competitors,
                    resp.get('provider', 'unknown')
                )
        
        tasks = [analyze_with_semaphore(resp) for resp in responses]
        return await asyncio.gather(*tasks)
    
    def calculate_aggregate_metrics(self, analyses: List[ResponseAnalysis]) -> Dict[str, Any]:
        """Calculate aggregate metrics from multiple analyses"""
        
        if not analyses:
            return {}
        
        total = len(analyses)
        
        # Calculate metrics
        brand_mentions = sum(1 for a in analyses if a.brand_analysis.mentioned)
        positive_sentiment = sum(1 for a in analyses if a.brand_analysis.sentiment == Sentiment.POSITIVE)
        
        # Competitor dominance
        competitor_counts = {}
        for analysis in analyses:
            for comp in analysis.competitors_analysis:
                if comp.mentioned:
                    competitor_counts[comp.competitor_name] = competitor_counts.get(comp.competitor_name, 0) + 1
        
        return {
            'total_responses': total,
            'brand_mention_rate': (brand_mentions / total) * 100,
            'positive_sentiment_rate': (positive_sentiment / total) * 100,
            'average_sentiment_score': sum(
                1 if a.brand_analysis.sentiment == Sentiment.POSITIVE else
                0 if a.brand_analysis.sentiment == Sentiment.NEUTRAL else -1
                for a in analyses
            ) / total,
            'featured_snippet_potential_rate': sum(a.featured_snippet_potential for a in analyses) / total,
            'voice_search_optimized_rate': sum(1 for a in analyses if a.voice_search_optimized) / total * 100,
            'competitor_dominance': competitor_counts,
            'top_content_gaps': self._aggregate_content_gaps(analyses),
            'top_improvements': self._aggregate_improvements(analyses)
        }
    
    def _aggregate_content_gaps(self, analyses: List[ResponseAnalysis]) -> List[str]:
        """Aggregate and rank content gaps"""
        gap_counts = {}
        for analysis in analyses:
            for gap in analysis.content_gaps:
                gap_counts[gap] = gap_counts.get(gap, 0) + 1
        
        # Sort by frequency
        sorted_gaps = sorted(gap_counts.items(), key=lambda x: x[1], reverse=True)
        return [gap for gap, _ in sorted_gaps[:5]]
    
    def _aggregate_improvements(self, analyses: List[ResponseAnalysis]) -> List[str]:
        """Aggregate and rank improvement suggestions"""
        improvement_counts = {}
        for analysis in analyses:
            for improvement in analysis.improvement_suggestions:
                improvement_counts[improvement] = improvement_counts.get(improvement, 0) + 1
        
        # Sort by frequency
        sorted_improvements = sorted(improvement_counts.items(), key=lambda x: x[1], reverse=True)
        return [imp for imp, _ in sorted_improvements[:5]]


# Backward compatibility aliases
ResponseAnalyzer = UnifiedResponseAnalyzer
LLMResponseAnalyzer = UnifiedResponseAnalyzer