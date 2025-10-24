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
from .recommendation_extractor import IntelligentRecommendationExtractor

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
    """Complete response analysis results with integrated GEO and SOV scores"""
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
    
    # NEW: Integrated scoring metrics (0-100 scale)
    geo_score: float = 0.0  # Generative Engine Optimization score
    sov_score: float = 0.0  # Share of Voice score
    context_completeness_score: float = 0.0  # Information completeness
    
    # NEW: Intelligent recommendations
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    
    processing_time_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class UnifiedResponseAnalyzer:
    """
    Unified response analyzer combining AI and traditional analysis.
    Single source of truth for all response processing.
    """
    
    def __init__(
        self,
        openai_api_key: str,
        model: str = "gpt-5-nano",
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
        self.recommendation_extractor = IntelligentRecommendationExtractor(
            openai_api_key=openai_api_key,
            model=model
        )
        
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
        
        # NEW: Calculate integrated GEO and SOV scores
        analysis.geo_score = await self._calculate_response_geo_score(
            analysis, query, brand_name, provider
        )
        
        analysis.sov_score = await self._calculate_response_sov_score(
            analysis, brand_name
        )
        
        analysis.context_completeness_score = await self._calculate_context_completeness_score(
            analysis, features, value_props
        )
        
        # Extract intelligent recommendations
        if self.mode == AnalysisMode.FULL:
            try:
                # Get industry from metadata or default to "general"
                industry = analysis.metadata.get('industry', 'general')
                
                # Get competitor context if available
                competitor_context = None
                if competitors:
                    # Handle both string and object formats for competitors
                    competitor_names = [
                        comp if isinstance(comp, str) else comp.get('name', str(comp))
                        for comp in competitors[:5]
                    ]
                    competitor_context = f"Key competitors: {', '.join(competitor_names)}"
                
                # Extract recommendations using our LLM-powered extractor
                recommendations = await self.recommendation_extractor.extract_recommendations_async(
                    response_text=response_text,
                    brand_name=brand_name,
                    industry=industry,
                    competitor_context=competitor_context,
                    max_recommendations=10
                )
                
                # Add to analysis
                analysis.recommendations = recommendations
                
                # Extract additional insights if we have competitors
                if competitors and len(competitors) > 0:
                    # Extract competitive gaps
                    competitive_gaps = await self.recommendation_extractor.extract_competitive_gaps(
                        response_text=response_text,
                        brand_name=brand_name,
                        competitors=competitors
                    )
                    analysis.metadata['competitive_gaps'] = competitive_gaps
                    
                    # Extract content opportunities
                    content_opportunities = await self.recommendation_extractor.extract_content_opportunities(
                        response_text=response_text,
                        brand_name=brand_name,
                        industry=industry
                    )
                    analysis.metadata['content_opportunities'] = content_opportunities
                
                logger.info(f"Extracted {len(recommendations)} LLM-powered recommendations for {brand_name}")
            except Exception as e:
                logger.error(f"Error extracting recommendations: {e}")
                analysis.recommendations = []
        
        # Add processing time
        analysis.processing_time_ms = (time.time() - start_time) * 1000
        
        # Add score summary to metadata
        analysis.metadata['score_summary'] = {
            'geo': analysis.geo_score,
            'sov': analysis.sov_score,
            'completeness': analysis.context_completeness_score
        }
        
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
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
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
                metadata={
                    'llm_tokens': response.usage.total_tokens,
                    'response_text': response_text,
                    'query': query,
                    'provider': provider,
                    'domain': f"{brand_name.split()[0].lower()}.com"  # Extract first word as domain
                }
            )
            
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            # Fallback to fast analysis
            return await self._fast_analysis(
                response_text, query, brand_name, competitors, provider
            )
    
    def _extract_brand_variations(self, brand_name: str) -> List[str]:
        """
        Extract all possible brand name variations for robust matching.

        Handles complex cases like:
        - "Nike" → ["nike"]
        - "Bikaji Foods International Ltd." → ["bikaji", "bikaji foods"]
        - "Imagine Marketing Limited (boAt)" → ["boat", "imagine marketing", "imagine"]
        - "Reliance Jio Infocomm Limited" → ["jio", "reliance jio", "reliance"]

        Returns:
            List of brand variations ordered by specificity (most specific first)
        """
        if not brand_name or brand_name.strip() == "":
            logger.warning("⚠️ Empty brand_name provided to _extract_brand_variations")
            return []

        brand_lower = brand_name.lower().strip()
        variations = []

        # PRIORITY 1: Extract parenthetical brand name (highest specificity)
        # e.g., "Imagine Marketing Limited (boAt)" → "boat"
        paren_match = re.search(r'\(([^)]+)\)', brand_name)
        if paren_match:
            paren_brand = paren_match.group(1).strip().lower()
            if paren_brand and paren_brand not in variations:
                variations.append(paren_brand)
                logger.debug(f"🎯 Extracted parenthetical brand: '{paren_brand}' from '{brand_name}'")

        # PRIORITY 2: Add full legal name (for exact matches)
        if brand_lower not in variations:
            variations.append(brand_lower)

        # PRIORITY 3: Extract first word (traditional approach)
        words = brand_lower.split()
        if len(words) > 0:
            first_word = words[0]
            if first_word and first_word not in variations and len(first_word) > 2:
                variations.append(first_word)

        # PRIORITY 4: Extract first two words (for "Bikaji Foods" etc.)
        if len(words) >= 2:
            first_two = f"{words[0]} {words[1]}"
            if first_two not in variations:
                variations.append(first_two)

        # PRIORITY 5: Remove common legal suffixes for matching
        # e.g., "Reliance Jio Infocomm Limited" → "reliance jio"
        legal_suffixes = ['limited', 'ltd', 'inc', 'corp', 'corporation', 'llc', 'pvt']
        words_without_suffix = [w for w in words if w not in legal_suffixes]
        if len(words_without_suffix) >= 2:
            clean_name = ' '.join(words_without_suffix)
            if clean_name and clean_name not in variations:
                variations.append(clean_name)

        logger.info(f"✅ Brand variations for '{brand_name}': {variations}")
        return variations

    async def _fast_analysis(
        self,
        response_text: str,
        query: str,
        brand_name: str,
        competitors: Optional[List[str]],
        provider: str
    ) -> ResponseAnalysis:
        """
        Fast heuristic-based analysis without LLM.

        ARCHITECTURAL FIX: Now uses robust brand variation extraction
        to handle complex company names including parenthetical brands.
        """

        response_lower = response_text.lower()

        # ARCHITECTURAL FIX: Use robust brand variation extraction
        brand_variations = self._extract_brand_variations(brand_name)

        # Brand mention analysis - check ALL variations
        brand_mentioned = False
        mention_count = 0
        first_position = None

        # Check each variation for mentions
        for variation in brand_variations:
            if variation in response_lower:
                brand_mentioned = True
                mention_count += response_lower.count(variation)

                # Track first position (earliest match)
                pos = response_lower.find(variation)
                if first_position is None or pos < first_position:
                    first_position = pos

        # Log detection results for debugging
        if not brand_mentioned and len(response_text) > 100:
            logger.warning(
                f"⚠️ Brand NOT detected in {len(response_text)} char response\n"
                f"   Brand: {brand_name}\n"
                f"   Variations tried: {brand_variations}\n"
                f"   Response preview: {response_text[:150]}..."
            )
        elif brand_mentioned:
            logger.debug(
                f"✅ Brand detected: {brand_name}\n"
                f"   Mention count: {mention_count}\n"
                f"   First position: {first_position}\n"
                f"   Matched variations: {[v for v in brand_variations if v in response_lower]}"
            )

        # Calculate first position percentage
        if brand_mentioned and first_position is not None:
            first_position_pct = (first_position / len(response_text)) * 100 if response_text else 0
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
            metadata={
                'analysis_type': 'fast',
                'response_text': response_text,
                'query': query,
                'provider': provider,
                'domain': f"{brand_name.split()[0].lower()}.com",  # Extract first word as domain
                'brand_variations': brand_variations,  # ARCHITECTURAL FIX: Store variations for debugging
                'brand_name_original': brand_name  # Store original for transparency
            }
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
    
    # NEW: Provider authority scores for GEO calculation
    PROVIDER_AUTHORITY = {
        "openai": 0.90,
        "openai_gpt5": 0.90,
        "anthropic": 0.90,
        "anthropic_claude": 0.90,
        "google": 0.85,
        "google_gemini": 0.85,
        "perplexity": 0.80,
        "unknown": 0.70
    }
    
    async def _calculate_response_geo_score(
        self,
        analysis: ResponseAnalysis,
        query: str,
        brand_name: str,
        provider: str
    ) -> float:
        """Calculate GEO score for a single response using dedicated calculator"""
        
        # Prepare LLM response data for calculator
        llm_response_data = [{
            'provider': provider,
            'query': query,
            'response_text': analysis.metadata.get('response_text', ''),  # Fixed: was 'response'
            'brand_mentioned': analysis.brand_analysis.mentioned,
            'mention_count': analysis.brand_analysis.mention_count,
            'sentiment': analysis.brand_analysis.sentiment.value,
            'mention_position': analysis.brand_analysis.first_position_percentage,  # Fixed: was 'position'
            'context_quality': analysis.brand_analysis.context_quality.value,
            'recommendation_strength': analysis.brand_analysis.recommendation_strength.value
        }]
        
        # Extract domain from brand name or use default
        domain = analysis.metadata.get('domain', f"{brand_name.lower().replace(' ', '')}.com")

        # Use the dedicated GEO calculator - ASYNC VERSION
        try:
            geo_result = await self.geo_calculator.calculate_async(
                domain=domain,
                content=analysis.metadata.get('response_text', ''),
                brand_terms=[brand_name] + analysis.metadata.get('brand_variations', []),
                queries=[{'query': query, 'intent': analysis.metadata.get('query_intent', 'informational')}],
                llm_responses=llm_response_data
            )

            # Extract the overall GEO score from calculator result
            geo_score = geo_result.get('overall_score', 0.0)

            # Store detailed metrics in metadata for transparency
            analysis.metadata['geo_metrics'] = geo_result.get('metrics', {})

            return round(geo_score, 2)
        except Exception as e:
            logger.error(f"Error calculating GEO score for {domain}: {e}")
            # Return safe default on error
            analysis.metadata['geo_error'] = str(e)
            return 0.0
    
    def _sentiment_to_score(self, sentiment: str) -> float:
        """Convert sentiment label to numerical score"""
        sentiment_map = {
            'positive': 0.8,
            'neutral': 0.0,
            'negative': -0.8,
            'mixed': 0.2
        }
        return sentiment_map.get(sentiment.lower(), 0.0)
    
    async def _calculate_response_sov_score(
        self,
        analysis: ResponseAnalysis,
        brand_name: str
    ) -> float:
        """Calculate Share of Voice using dedicated SOV calculator"""
        
        from src.models.schemas import BrandMention, Entity
        
        # Prepare brand mentions for calculator with complete schema
        brand_mentions = []
        if analysis.brand_analysis.mentioned:
            response_text = analysis.metadata.get('response_text', '')
            brand_pos = response_text.lower().find(brand_name.lower())
            mention_text = response_text[max(0, brand_pos-50):min(len(response_text), brand_pos+50)] if brand_pos >= 0 else ""
            
            brand_mentions.append(BrandMention(
                response_id=analysis.metadata.get('response_id', str(analysis.analysis_id)),
                brand_id=analysis.metadata.get('brand_id', 'bikaji_45'),  # Using company_id from context
                brand_name=brand_name,
                mention_text=mention_text or f"{brand_name} mentioned in response",
                sentiment_score=self._sentiment_to_score(analysis.brand_analysis.sentiment.value),
                sentiment_label=analysis.brand_analysis.sentiment.value,
                confidence=0.95,  # High confidence for explicit mentions
                context=analysis.brand_analysis.context_quality.value,
                position=brand_pos if brand_pos >= 0 else 0,  # Position in response text
                platform=analysis.metadata.get('provider', 'openai')  # LLM platform
            ))
        
        # Prepare competitor entities for calculator
        all_entities = []
        
        # Add brand as an entity with proper schema
        if analysis.brand_analysis.mentioned:
            # Find position of brand in response for accurate entity location
            response_text = analysis.metadata.get('response_text', '')
            brand_pos = response_text.lower().find(brand_name.lower())
            
            all_entities.append(Entity(
                text=brand_name,
                type="BRAND",
                confidence=0.95,  # High confidence for direct mentions
                start_pos=brand_pos if brand_pos >= 0 else 0,
                end_pos=brand_pos + len(brand_name) if brand_pos >= 0 else len(brand_name),
                context=f"Mentioned {analysis.brand_analysis.mention_count} times with {analysis.brand_analysis.sentiment.value} sentiment"
            ))
        
        # Add competitors as entities with proper schema
        for comp in analysis.competitors_analysis:
            if comp.mentioned:
                response_text = analysis.metadata.get('response_text', '')
                comp_pos = response_text.lower().find(comp.competitor_name.lower())
                
                all_entities.append(Entity(
                    text=comp.competitor_name,
                    type="BRAND",
                    confidence=0.90,  # Slightly lower confidence for competitor mentions
                    start_pos=comp_pos if comp_pos >= 0 else 0,
                    end_pos=comp_pos + len(comp.competitor_name) if comp_pos >= 0 else len(comp.competitor_name),
                    context=f"Competitor mentioned {comp.mention_count} times with {comp.sentiment.value} sentiment"
                ))
        
        # Use the dedicated SOV calculator
        sov_score = self.sov_calculator.calculate(
            brand_mentions=brand_mentions,
            all_entities=all_entities,
            target_brand=brand_name
        )
        
        # Store detailed SOV metrics in metadata
        analysis.metadata['sov_metrics'] = {
            'brand_mentions': len(brand_mentions),
            'total_entities': len(all_entities),
            'competitor_count': len(analysis.competitors_analysis)
        }
        
        return round(sov_score, 2)
    
    async def _calculate_context_completeness_score(
        self,
        analysis: ResponseAnalysis,
        expected_features: Optional[List[str]] = None,
        expected_value_props: Optional[List[str]] = None
    ) -> float:
        """Calculate how completely the brand context is conveyed"""
        
        brand = analysis.brand_analysis
        
        if not brand.mentioned:
            return 0.0
        
        score_components = []
        
        # Context quality (40%)
        context_map = {
            ContextQuality.HIGH: 1.0,
            ContextQuality.MEDIUM: 0.6,
            ContextQuality.LOW: 0.3,
            ContextQuality.NONE: 0.0
        }
        context_score = context_map.get(brand.context_quality, 0.0)
        score_components.append(context_score * 40)
        
        # Feature coverage (30%)
        if expected_features:
            features_mentioned = len(brand.specific_features_mentioned)
            feature_coverage = min(features_mentioned / len(expected_features), 1.0) if expected_features else 0
            score_components.append(feature_coverage * 30)
        else:
            feature_score = min(len(brand.specific_features_mentioned) * 10, 30)
            score_components.append(feature_score)
        
        # Value prop coverage (30%)
        if expected_value_props:
            props_mentioned = len(brand.value_props_highlighted)
            prop_coverage = min(props_mentioned / len(expected_value_props), 1.0) if expected_value_props else 0
            score_components.append(prop_coverage * 30)
        else:
            prop_score = min(len(brand.value_props_highlighted) * 10, 30)
            score_components.append(prop_score)
        
        return round(sum(score_components), 2)
    
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
        
        # Handle both string and object formats for competitors
        competitor_names = [
            comp if isinstance(comp, str) else comp.get('name', str(comp))
            for comp in (competitors or [])
        ]

        prompt = f"""Analyze this AI response for brand visibility and SEO factors.

Query: {query}
Brand: {brand_name}
Competitors: {', '.join(competitor_names) if competitor_names else 'None'}
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
        
        # NEW: Calculate aggregate GEO and SOV scores
        geo_scores = [a.geo_score for a in analyses if hasattr(a, 'geo_score')]
        sov_scores = [a.sov_score for a in analyses if hasattr(a, 'sov_score')]
        completeness_scores = [a.context_completeness_score for a in analyses if hasattr(a, 'context_completeness_score')]
        
        avg_geo = sum(geo_scores) / len(geo_scores) if geo_scores else 0.0
        avg_sov = sum(sov_scores) / len(sov_scores) if sov_scores else 0.0
        avg_completeness = sum(completeness_scores) / len(completeness_scores) if completeness_scores else 0.0
        
        # Calculate visibility (raw mention rate)
        visibility = (brand_mentions / total) * 100
        
        # Calculate sentiment score (0-100)
        sentiment_numeric = sum(
            100 if a.brand_analysis.sentiment == Sentiment.POSITIVE else
            50 if a.brand_analysis.sentiment == Sentiment.NEUTRAL else
            0 if a.brand_analysis.sentiment == Sentiment.NEGATIVE else 50
            for a in analyses
        ) / total
        
        # Calculate recommendation score (0-100)
        recommendation_scores = [
            100 if a.brand_analysis.recommendation_strength == RecommendationStrength.STRONG else
            60 if a.brand_analysis.recommendation_strength == RecommendationStrength.MODERATE else
            30 if a.brand_analysis.recommendation_strength == RecommendationStrength.WEAK else 0
            for a in analyses
        ]
        avg_recommendation = sum(recommendation_scores) / len(recommendation_scores) if recommendation_scores else 0.0
        
        # ENHANCED OVERALL SCORE with business-focused formula
        overall_score = (
            avg_geo * 0.30 +           # 30%: AI optimization
            avg_sov * 0.25 +           # 25%: Competitive dominance
            avg_recommendation * 0.20 + # 20%: Endorsement strength
            sentiment_numeric * 0.15 +  # 15%: Emotional tone
            visibility * 0.10           # 10%: Raw presence
        )
        
        # Provider-specific metrics
        provider_metrics = {}
        for provider in set(a.provider for a in analyses):
            provider_analyses = [a for a in analyses if a.provider == provider]
            if provider_analyses:
                provider_metrics[provider] = {
                    'count': len(provider_analyses),
                    'geo': sum(a.geo_score for a in provider_analyses if hasattr(a, 'geo_score')) / len(provider_analyses),
                    'sov': sum(a.sov_score for a in provider_analyses if hasattr(a, 'sov_score')) / len(provider_analyses),
                    'visibility': sum(1 for a in provider_analyses if a.brand_analysis.mentioned) / len(provider_analyses) * 100
                }
        
        return {
            'total_responses': total,
            'overall_score': round(overall_score, 2),
            
            # Component scores (0-100 scale)
            'brand_mention_rate': round(visibility, 2),
            'visibility': round(visibility, 2),
            'sentiment': round(sentiment_numeric, 2),
            'recommendation': round(avg_recommendation, 2),
            'geo_score': round(avg_geo, 2),
            'sov_score': round(avg_sov, 2),
            'context_completeness': round(avg_completeness, 2),
            
            # Legacy metrics for compatibility
            'positive_sentiment_rate': (positive_sentiment / total) * 100,
            'average_sentiment_score': sum(
                1 if a.brand_analysis.sentiment == Sentiment.POSITIVE else
                0 if a.brand_analysis.sentiment == Sentiment.NEUTRAL else -1
                for a in analyses
            ) / total,
            'featured_snippet_potential_rate': sum(a.featured_snippet_potential for a in analyses) / total,
            'voice_search_optimized_rate': sum(1 for a in analyses if a.voice_search_optimized) / total * 100,
            
            # Detailed breakdowns
            'competitor_dominance': competitor_counts,
            'provider_metrics': provider_metrics,
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