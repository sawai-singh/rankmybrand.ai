"""
Advanced LLM-Powered Response Analysis Engine
Using GPT-5 for sophisticated response analysis with structured outputs
"""

import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime
import hashlib
import re
from collections import defaultdict
import numpy as np
from openai import AsyncOpenAI
import logging

logger = logging.getLogger(__name__)


class MentionContext(Enum):
    """Context quality of brand mention"""
    PRIMARY_FOCUS = "primary_focus"  # Main subject of response
    SIGNIFICANT_MENTION = "significant_mention"  # Important part of response
    COMPARATIVE_CONTEXT = "comparative_context"  # Mentioned in comparison
    LISTING_INCLUSION = "listing_inclusion"  # Part of a list
    PASSING_REFERENCE = "passing_reference"  # Brief mention
    NO_MENTION = "no_mention"


class SentimentType(Enum):
    """Sentiment analysis categories"""
    STRONGLY_POSITIVE = "strongly_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    MIXED = "mixed"
    NEGATIVE = "negative"
    STRONGLY_NEGATIVE = "strongly_negative"


class RecommendationStrength(Enum):
    """Recommendation strength levels"""
    STRONG_RECOMMENDATION = "strong_recommendation"  # Explicitly recommended
    MODERATE_RECOMMENDATION = "moderate_recommendation"  # Suggested as good option
    NEUTRAL_MENTION = "neutral_mention"  # Listed without preference
    CONDITIONAL_RECOMMENDATION = "conditional_recommendation"  # Recommended with caveats
    NOT_RECOMMENDED = "not_recommended"  # Explicitly not recommended
    NO_RECOMMENDATION = "no_recommendation"  # No recommendation made


@dataclass
class BrandMention:
    """Detailed brand mention analysis"""
    brand_name: str
    mentioned: bool
    mention_count: int
    first_position_percentage: float  # How early in response (0-100)
    context_quality: MentionContext
    sentiment: SentimentType
    recommendation_strength: RecommendationStrength
    specific_features_mentioned: List[str]
    comparison_outcome: Optional[str]  # "winner", "equal", "loser", None
    quoted_text_snippets: List[str]  # Actual quotes from response
    credibility_indicators: List[str]  # "cited_source", "detailed_analysis", etc.
    
    
@dataclass
class CompetitorAnalysis:
    """Comprehensive competitor mention analysis"""
    competitor_name: str
    mention_analysis: BrandMention
    relative_prominence: float  # vs our brand (0-1, higher = more prominent)
    competitive_advantages_mentioned: List[str]
    competitive_disadvantages_mentioned: List[str]
    head_to_head_comparison: Optional[str]


@dataclass
class ResponseAnalysis:
    """Complete response analysis output"""
    query: str
    response_text: str
    provider: str
    
    # Brand analysis
    brand_analysis: BrandMention
    competitors_analysis: List[CompetitorAnalysis]
    
    # Response quality metrics
    response_completeness: float  # 0-1
    response_accuracy_confidence: float  # 0-1
    response_objectivity: float  # 0-1
    information_depth: float  # 0-1
    
    # Key insights
    winner_if_comparison: Optional[str]
    key_differentiators_mentioned: List[str]
    missed_opportunities: List[str]  # What should have been mentioned
    
    # SEO/Visibility factors
    featured_snippet_potential: bool
    voice_search_optimized: bool
    local_relevance: bool
    
    # Actionable insights
    improvement_suggestions: List[str]
    competitive_threats: List[str]
    competitive_advantages: List[str]
    
    # Metadata (with defaults)
    analysis_timestamp: datetime = field(default_factory=datetime.now)
    analysis_id: str = field(default_factory=lambda: hashlib.md5(
        str(datetime.now()).encode()).hexdigest()[:12])
    processing_time_ms: float = 0


class LLMResponseAnalyzer:
    """GPT-5 powered response analyzer with structured analysis"""
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o"):
        """Initialize with GPT-5 or GPT-4 fallback"""
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        self.analysis_cache = {}
        
        # Analysis prompt templates
        self.system_prompt = """You are an expert AI response analyst specializing in brand visibility 
        and competitive intelligence. Analyze responses with extreme precision and provide structured JSON outputs.
        Focus on extracting actionable insights for brand improvement."""
    
    async def analyze_response(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: List[str],
        provider: str,
        brand_context: Optional[Dict[str, Any]] = None
    ) -> ResponseAnalysis:
        """Perform comprehensive response analysis using GPT-5"""
        
        start_time = datetime.now()
        
        # Check cache
        cache_key = self._generate_cache_key(response_text, brand_name, competitors)
        if cache_key in self.analysis_cache:
            return self.analysis_cache[cache_key]
        
        # Parallel analysis tasks
        analysis_tasks = [
            self._analyze_brand_mention(response_text, brand_name, query),
            self._analyze_competitors(response_text, competitors, brand_name, query),
            self._analyze_response_quality(response_text, query),
            self._extract_insights(response_text, brand_name, competitors, query),
            self._analyze_seo_factors(response_text, query)
        ]
        
        results = await asyncio.gather(*analysis_tasks)
        
        brand_analysis, competitor_analyses, quality_metrics, insights, seo_factors = results
        
        # Compile final analysis
        analysis = ResponseAnalysis(
            query=query,
            response_text=response_text,
            provider=provider,
            brand_analysis=brand_analysis,
            competitors_analysis=competitor_analyses,
            response_completeness=quality_metrics['completeness'],
            response_accuracy_confidence=quality_metrics['accuracy_confidence'],
            response_objectivity=quality_metrics['objectivity'],
            information_depth=quality_metrics['depth'],
            winner_if_comparison=insights.get('winner'),
            key_differentiators_mentioned=insights.get('differentiators', []),
            missed_opportunities=insights.get('missed_opportunities', []),
            featured_snippet_potential=seo_factors.get('featured_snippet_potential', False),
            voice_search_optimized=seo_factors.get('voice_optimized', False),
            local_relevance=seo_factors.get('local_relevance', False),
            improvement_suggestions=insights.get('improvement_suggestions', []),
            competitive_threats=insights.get('threats', []),
            competitive_advantages=insights.get('advantages', []),
            processing_time_ms=(datetime.now() - start_time).total_seconds() * 1000
        )
        
        # Cache result
        self.analysis_cache[cache_key] = analysis
        
        return analysis
    
    async def _analyze_brand_mention(
        self,
        response_text: str,
        brand_name: str,
        query: str
    ) -> BrandMention:
        """Analyze brand mention using GPT-5"""
        
        analysis_prompt = f"""
        Analyze the following AI response for mentions of the brand "{brand_name}".
        
        Query: {query}
        Response: {response_text}
        
        Provide a detailed JSON analysis with:
        1. mentioned: boolean - is the brand mentioned?
        2. mention_count: number of times mentioned
        3. first_position_percentage: where does first mention appear (0=start, 100=end)
        4. context_quality: "primary_focus", "significant_mention", "comparative_context", 
           "listing_inclusion", "passing_reference", or "no_mention"
        5. sentiment: "strongly_positive", "positive", "neutral", "mixed", "negative", "strongly_negative"
        6. recommendation_strength: "strong_recommendation", "moderate_recommendation", 
           "neutral_mention", "conditional_recommendation", "not_recommended", "no_recommendation"
        7. specific_features_mentioned: array of specific features/capabilities mentioned
        8. comparison_outcome: "winner", "equal", "loser", or null if no comparison
        9. quoted_text_snippets: array of exact quotes mentioning the brand (max 3, most important)
        10. credibility_indicators: array like ["detailed_analysis", "specific_examples", "data_cited"]
        
        Be extremely precise. Return valid JSON only.
        """
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": analysis_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1  # Low temperature for consistency
        )
        
        analysis_data = json.loads(response.choices[0].message.content)
        
        return BrandMention(
            brand_name=brand_name,
            mentioned=analysis_data.get('mentioned', False),
            mention_count=analysis_data.get('mention_count', 0),
            first_position_percentage=analysis_data.get('first_position_percentage', 100),
            context_quality=MentionContext(analysis_data.get('context_quality', 'no_mention')),
            sentiment=SentimentType(analysis_data.get('sentiment', 'neutral')),
            recommendation_strength=RecommendationStrength(
                analysis_data.get('recommendation_strength', 'no_recommendation')
            ),
            specific_features_mentioned=analysis_data.get('specific_features_mentioned', []),
            comparison_outcome=analysis_data.get('comparison_outcome'),
            quoted_text_snippets=analysis_data.get('quoted_text_snippets', []),
            credibility_indicators=analysis_data.get('credibility_indicators', [])
        )
    
    async def _analyze_competitors(
        self,
        response_text: str,
        competitors: List[str],
        brand_name: str,
        query: str
    ) -> List[CompetitorAnalysis]:
        """Analyze competitor mentions using GPT-5"""
        
        if not competitors:
            return []
        
        analysis_prompt = f"""
        Analyze mentions of competitors in this AI response.
        
        Brand: {brand_name}
        Competitors: {json.dumps(competitors)}
        Query: {query}
        Response: {response_text}
        
        For each competitor mentioned, provide:
        1. competitor_name: name of competitor
        2. mention_analysis: same structure as brand analysis
        3. relative_prominence: 0-1 score vs {brand_name} (1 = much more prominent)
        4. competitive_advantages_mentioned: specific advantages mentioned
        5. competitive_disadvantages_mentioned: specific disadvantages mentioned
        6. head_to_head_comparison: direct comparison result if any
        
        Return JSON with "competitors" array containing analysis for each mentioned competitor.
        Include even competitors not mentioned (with appropriate null/empty values).
        """
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": analysis_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        analysis_data = json.loads(response.choices[0].message.content)
        competitor_analyses = []
        
        for comp_data in analysis_data.get('competitors', []):
            mention_data = comp_data.get('mention_analysis', {})
            
            competitor_analyses.append(CompetitorAnalysis(
                competitor_name=comp_data.get('competitor_name', ''),
                mention_analysis=BrandMention(
                    brand_name=comp_data.get('competitor_name', ''),
                    mentioned=mention_data.get('mentioned', False),
                    mention_count=mention_data.get('mention_count', 0),
                    first_position_percentage=mention_data.get('first_position_percentage', 100),
                    context_quality=MentionContext(
                        mention_data.get('context_quality', 'no_mention')
                    ),
                    sentiment=SentimentType(mention_data.get('sentiment', 'neutral')),
                    recommendation_strength=RecommendationStrength(
                        mention_data.get('recommendation_strength', 'no_recommendation')
                    ),
                    specific_features_mentioned=mention_data.get('specific_features_mentioned', []),
                    comparison_outcome=mention_data.get('comparison_outcome'),
                    quoted_text_snippets=mention_data.get('quoted_text_snippets', []),
                    credibility_indicators=mention_data.get('credibility_indicators', [])
                ),
                relative_prominence=comp_data.get('relative_prominence', 0.5),
                competitive_advantages_mentioned=comp_data.get('competitive_advantages_mentioned', []),
                competitive_disadvantages_mentioned=comp_data.get('competitive_disadvantages_mentioned', []),
                head_to_head_comparison=comp_data.get('head_to_head_comparison')
            ))
        
        return competitor_analyses
    
    async def _analyze_response_quality(
        self,
        response_text: str,
        query: str
    ) -> Dict[str, float]:
        """Analyze overall response quality metrics"""
        
        quality_prompt = f"""
        Analyze the quality of this AI response.
        
        Query: {query}
        Response: {response_text}
        
        Rate each metric from 0.0 to 1.0:
        1. completeness: How completely does it answer the query?
        2. accuracy_confidence: How confident are you in the accuracy?
        3. objectivity: How objective/unbiased is the response?
        4. depth: How detailed and comprehensive is the information?
        
        Return JSON with these four metrics as float values.
        """
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert at evaluating AI response quality."},
                {"role": "user", "content": quality_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        return json.loads(response.choices[0].message.content)
    
    async def _extract_insights(
        self,
        response_text: str,
        brand_name: str,
        competitors: List[str],
        query: str
    ) -> Dict[str, Any]:
        """Extract actionable insights using GPT-5"""
        
        insights_prompt = f"""
        Extract strategic insights from this AI response for {brand_name}.
        
        Query: {query}
        Response: {response_text}
        Competitors: {json.dumps(competitors)}
        
        Provide:
        1. winner: If there's a comparison, who wins? (brand name or null)
        2. differentiators: Key differentiating factors mentioned
        3. missed_opportunities: What should have been mentioned about {brand_name} but wasn't?
        4. improvement_suggestions: Specific suggestions to improve {brand_name}'s AI visibility
        5. threats: Competitive threats identified
        6. advantages: Competitive advantages of {brand_name} mentioned
        
        Focus on actionable, specific insights. Return JSON.
        """
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a strategic brand analyst focused on AI visibility."},
                {"role": "user", "content": insights_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        return json.loads(response.choices[0].message.content)
    
    async def _analyze_seo_factors(
        self,
        response_text: str,
        query: str
    ) -> Dict[str, bool]:
        """Analyze SEO and visibility factors"""
        
        seo_prompt = f"""
        Analyze SEO and visibility factors of this response.
        
        Query: {query}
        Response: {response_text}
        
        Determine (true/false):
        1. featured_snippet_potential: Could this be a featured snippet?
        2. voice_optimized: Is this optimized for voice search responses?
        3. local_relevance: Does this have local search relevance?
        
        Return JSON with these boolean values.
        """
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an SEO expert."},
                {"role": "user", "content": seo_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        return json.loads(response.choices[0].message.content)
    
    def _generate_cache_key(
        self,
        response_text: str,
        brand_name: str,
        competitors: List[str]
    ) -> str:
        """Generate cache key for analysis"""
        
        content = f"{response_text[:500]}_{brand_name}_{'_'.join(sorted(competitors))}"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def batch_analyze(
        self,
        responses: List[Dict[str, Any]],
        brand_name: str,
        competitors: List[str],
        max_concurrent: int = 5
    ) -> List[ResponseAnalysis]:
        """Batch analyze multiple responses efficiently"""
        
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def analyze_with_semaphore(response_data):
            async with semaphore:
                return await self.analyze_response(
                    response_text=response_data['response_text'],
                    query=response_data['query'],
                    brand_name=brand_name,
                    competitors=competitors,
                    provider=response_data.get('provider', 'unknown')
                )
        
        tasks = [analyze_with_semaphore(r) for r in responses]
        return await asyncio.gather(*tasks)
    
    def calculate_aggregate_metrics(
        self,
        analyses: List[ResponseAnalysis]
    ) -> Dict[str, Any]:
        """Calculate aggregate metrics across all analyses"""
        
        if not analyses:
            return {}
        
        total = len(analyses)
        brand_mentioned = sum(1 for a in analyses if a.brand_analysis.mentioned)
        
        # Calculate averages
        avg_sentiment_score = np.mean([
            self._sentiment_to_score(a.brand_analysis.sentiment)
            for a in analyses
        ])
        
        avg_recommendation_score = np.mean([
            self._recommendation_to_score(a.brand_analysis.recommendation_strength)
            for a in analyses
        ])
        
        # Competitor dominance
        competitor_dominance = defaultdict(int)
        for analysis in analyses:
            for comp in analysis.competitors_analysis:
                if comp.mention_analysis.mentioned:
                    competitor_dominance[comp.competitor_name] += 1
        
        # Most common improvement suggestions
        all_suggestions = []
        for analysis in analyses:
            all_suggestions.extend(analysis.improvement_suggestions)
        
        suggestion_counts = defaultdict(int)
        for suggestion in all_suggestions:
            suggestion_counts[suggestion] += 1
        
        top_suggestions = sorted(
            suggestion_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]
        
        return {
            'total_queries': total,
            'brand_mention_rate': (brand_mentioned / total) * 100,
            'average_sentiment_score': avg_sentiment_score,
            'average_recommendation_score': avg_recommendation_score,
            'competitor_dominance': dict(competitor_dominance),
            'top_improvement_suggestions': [s[0] for s in top_suggestions],
            'featured_snippet_potential_rate': (
                sum(1 for a in analyses if a.featured_snippet_potential) / total
            ) * 100,
            'voice_search_optimized_rate': (
                sum(1 for a in analyses if a.voice_search_optimized) / total
            ) * 100
        }
    
    def _sentiment_to_score(self, sentiment: SentimentType) -> float:
        """Convert sentiment to numeric score"""
        
        scores = {
            SentimentType.STRONGLY_POSITIVE: 1.0,
            SentimentType.POSITIVE: 0.75,
            SentimentType.NEUTRAL: 0.5,
            SentimentType.MIXED: 0.5,
            SentimentType.NEGATIVE: 0.25,
            SentimentType.STRONGLY_NEGATIVE: 0.0
        }
        return scores.get(sentiment, 0.5)
    
    def _recommendation_to_score(self, recommendation: RecommendationStrength) -> float:
        """Convert recommendation strength to numeric score"""
        
        scores = {
            RecommendationStrength.STRONG_RECOMMENDATION: 1.0,
            RecommendationStrength.MODERATE_RECOMMENDATION: 0.75,
            RecommendationStrength.CONDITIONAL_RECOMMENDATION: 0.6,
            RecommendationStrength.NEUTRAL_MENTION: 0.5,
            RecommendationStrength.NOT_RECOMMENDED: 0.0,
            RecommendationStrength.NO_RECOMMENDATION: 0.3
        }
        return scores.get(recommendation, 0.3)


# Alias for backward compatibility
ResponseAnalyzer = LLMResponseAnalyzer