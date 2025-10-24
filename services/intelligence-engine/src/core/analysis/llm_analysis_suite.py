"""
Comprehensive LLM-Powered Analysis Suite
Master-level AI analysis using GPT-5 for world-class insights
"""

import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from openai import AsyncOpenAI
import hashlib
import os
from datetime import datetime

logger = logging.getLogger(__name__)


class AnalysisType(Enum):
    """Types of analysis available"""
    SENTIMENT_CONTEXT = "sentiment_context"
    FEATURE_MENTION = "feature_mention"
    POSITION_TRACKING = "position_tracking"
    RESPONSE_QUALITY = "response_quality"
    MARKET_INSIGHTS = "market_insights"
    EXECUTIVE_DASHBOARD = "executive_dashboard"


@dataclass
class SentimentContext:
    """Deep sentiment analysis with reasoning"""
    overall_sentiment: str  # positive/negative/neutral/mixed
    sentiment_score: float  # -1.0 to 1.0
    reasons_positive: List[str]
    reasons_negative: List[str]
    emotional_triggers: List[str]
    brand_perception: str
    improvement_areas: List[str]


@dataclass
class FeatureMention:
    """Product feature analysis"""
    feature: str
    mentioned: bool
    context: str
    sentiment: str
    competitive_comparison: Optional[str]
    importance_score: int  # 1-10


@dataclass
class PositionAnalysis:
    """Brand position in response"""
    first_mention_position: int
    total_mentions: int
    prominence_score: float  # 0-100
    context_quality: str  # primary/secondary/tertiary
    recommendation_strength: str  # strong/moderate/weak/none
    competitive_ranking: int


@dataclass
class ResponseQuality:
    """Quality assessment of AI response"""
    completeness_score: float  # 0-100
    accuracy_score: float  # 0-100
    depth_score: float  # 0-100
    relevance_score: float  # 0-100
    reliability_weight: float  # 0-1.0
    quality_issues: List[str]
    strengths: List[str]


class LLMAnalysisSuite:
    """
    Comprehensive suite of LLM-powered analyzers
    Designed by master product architects and AI specialists
    """
    
    def __init__(self, openai_api_key: Optional[str] = None, model: str = "gpt-5-nano"):
        """
        Initialize the LLM analysis suite
        
        Args:
            openai_api_key: OpenAI API key
            model: Model to use (default: gpt-5-nano)
        """
        api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.client = AsyncOpenAI(api_key=api_key) if api_key else None
        self.model = model
        self._cache = {}
        
    async def analyze_sentiment_context(
        self,
        response_text: str,
        brand_name: str,
        query: str
    ) -> SentimentContext:
        """
        Deep sentiment analysis understanding WHY sentiment is positive/negative
        """
        if not self.client:
            return self._fallback_sentiment(response_text, brand_name)
        
        prompt = f"""Perform deep sentiment analysis for {brand_name} in this AI response.

Query: {query}
Brand: {brand_name}
Response: {response_text}

Analyze not just positive/negative, but WHY. What specific aspects drive the sentiment?

Return JSON:
{{
  "overall_sentiment": "positive|negative|neutral|mixed",
  "sentiment_score": -1.0 to 1.0,
  "reasons_positive": ["Specific positive aspect 1", "..."],
  "reasons_negative": ["Specific negative aspect 1", "..."],
  "emotional_triggers": ["Words/phrases that evoke emotion"],
  "brand_perception": "How the brand is perceived overall",
  "improvement_areas": ["Specific areas where perception could improve"]
}}

Focus on SPECIFICS, not generalities. What exact words, features, or comparisons drive sentiment?"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a sentiment analysis expert. Provide deep, specific insights."},
                    {"role": "user", "content": prompt}
                ],
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            return SentimentContext(
                overall_sentiment=result.get('overall_sentiment', 'neutral'),
                sentiment_score=result.get('sentiment_score', 0.0),
                reasons_positive=result.get('reasons_positive', []),
                reasons_negative=result.get('reasons_negative', []),
                emotional_triggers=result.get('emotional_triggers', []),
                brand_perception=result.get('brand_perception', ''),
                improvement_areas=result.get('improvement_areas', [])
            )
            
        except Exception as e:
            logger.error(f"Error in sentiment context analysis: {e}")
            return self._fallback_sentiment(response_text, brand_name)
    
    async def extract_feature_mentions(
        self,
        response_text: str,
        brand_name: str,
        known_features: Optional[List[str]] = None
    ) -> List[FeatureMention]:
        """
        Extract which product features/benefits are highlighted
        """
        if not self.client:
            return []
        
        features_context = f"Known features: {', '.join(known_features)}" if known_features else "Discover all mentioned features"
        
        prompt = f"""Identify all product features and benefits mentioned for {brand_name}.

Brand: {brand_name}
{features_context}
Response: {response_text}

Extract every feature, benefit, or capability mentioned, whether explicit or implied.

Return JSON:
{{
  "features": [
    {{
      "feature": "Feature name",
      "mentioned": true/false,
      "context": "How it's mentioned",
      "sentiment": "positive|negative|neutral",
      "competitive_comparison": "How it compares to competitors (if mentioned)",
      "importance_score": 1-10
    }}
  ]
}}

Look for:
- Explicit feature mentions
- Implied capabilities
- Benefits described
- Comparison points
- Missing features that competitors have"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            features = result.get('features', [])
            
            return [
                FeatureMention(
                    feature=f['feature'],
                    mentioned=f.get('mentioned', False),
                    context=f.get('context', ''),
                    sentiment=f.get('sentiment', 'neutral'),
                    competitive_comparison=f.get('competitive_comparison'),
                    importance_score=f.get('importance_score', 5)
                )
                for f in features
            ]
            
        except Exception as e:
            logger.error(f"Error extracting feature mentions: {e}")
            return []
    
    async def analyze_position_tracking(
        self,
        response_text: str,
        brand_name: str,
        competitors: List[str]
    ) -> PositionAnalysis:
        """
        Analyze where brand appears in response for prominence scoring
        """
        if not self.client:
            return self._fallback_position(response_text, brand_name)

        # Handle both string and object formats for competitors
        competitor_names = []
        for comp in competitors:
            if isinstance(comp, str):
                competitor_names.append(comp)
            elif isinstance(comp, dict):
                competitor_names.append(comp.get('name', str(comp)))
            else:
                competitor_names.append(str(comp))

        prompt = f"""Analyze the positioning and prominence of {brand_name} in this response.

Brand: {brand_name}
Competitors: {', '.join(competitor_names)}
Response: {response_text}

Return JSON:
{{
  "first_mention_position": character position of first mention,
  "total_mentions": number of times mentioned,
  "prominence_score": 0-100 based on positioning quality,
  "context_quality": "primary|secondary|tertiary",
  "recommendation_strength": "strong|moderate|weak|none",
  "competitive_ranking": where brand ranks vs competitors (1=best)
}}

Scoring guidelines:
- First mention in opening = 90-100 prominence
- Main example/recommendation = 70-90 prominence
- Secondary mention = 40-70 prominence
- Brief/passing mention = 10-40 prominence
- No mention = 0 prominence"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            return PositionAnalysis(
                first_mention_position=result.get('first_mention_position', -1),
                total_mentions=result.get('total_mentions', 0),
                prominence_score=result.get('prominence_score', 0.0),
                context_quality=result.get('context_quality', 'none'),
                recommendation_strength=result.get('recommendation_strength', 'none'),
                competitive_ranking=result.get('competitive_ranking', 999)
            )
            
        except Exception as e:
            logger.error(f"Error in position tracking analysis: {e}")
            return self._fallback_position(response_text, brand_name)
    
    async def score_response_quality(
        self,
        response_text: str,
        query: str,
        expected_topics: Optional[List[str]] = None
    ) -> ResponseQuality:
        """
        Evaluate response quality for reliability weighting
        """
        if not self.client:
            return self._fallback_quality()
        
        topics_context = f"Expected topics: {', '.join(expected_topics)}" if expected_topics else ""
        
        prompt = f"""Evaluate the quality of this AI response.

Query: {query}
{topics_context}
Response: {response_text}

Return JSON:
{{
  "completeness_score": 0-100 (covers all aspects of query),
  "accuracy_score": 0-100 (factually correct),
  "depth_score": 0-100 (level of detail and insight),
  "relevance_score": 0-100 (directly addresses query),
  "reliability_weight": 0-1.0 (overall trustworthiness),
  "quality_issues": ["Issue 1", "Issue 2"],
  "strengths": ["Strength 1", "Strength 2"]
}}

Be critical but fair. High-quality responses should be comprehensive, accurate, detailed, and directly relevant."""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            return ResponseQuality(
                completeness_score=result.get('completeness_score', 50.0),
                accuracy_score=result.get('accuracy_score', 50.0),
                depth_score=result.get('depth_score', 50.0),
                relevance_score=result.get('relevance_score', 50.0),
                reliability_weight=result.get('reliability_weight', 0.5),
                quality_issues=result.get('quality_issues', []),
                strengths=result.get('strengths', [])
            )
            
        except Exception as e:
            logger.error(f"Error scoring response quality: {e}")
            return self._fallback_quality()
    
    async def aggregate_market_insights(
        self,
        responses: List[Dict[str, Any]],
        brand_name: str,
        industry: str
    ) -> Dict[str, Any]:
        """
        Aggregate insights across multiple responses to identify market trends
        """
        if not self.client or not responses:
            return {}
        
        # Prepare response summaries
        response_summaries = []
        for r in responses[:20]:  # Limit to prevent token overflow
            summary = {
                'provider': r.get('provider', 'unknown'),
                'key_points': r.get('response_text', '')[:500],
                'brand_mentioned': r.get('brand_mentioned', False),
                'sentiment': r.get('sentiment', 'neutral')
            }
            response_summaries.append(summary)
        
        prompt = f"""Analyze these AI responses to identify market trends and positioning opportunities for {brand_name} in {industry}.

Brand: {brand_name}
Industry: {industry}
Response Summaries: {json.dumps(response_summaries)}

Identify patterns, trends, and strategic opportunities across all responses.

Return JSON:
{{
  "market_trends": ["Trend 1", "Trend 2"],
  "positioning_opportunities": ["Opportunity 1", "Opportunity 2"],
  "competitive_themes": ["What competitors are doing well"],
  "brand_strengths": ["Consistent positive mentions"],
  "brand_weaknesses": ["Consistent gaps or negatives"],
  "emerging_topics": ["New topics gaining traction"],
  "strategic_priorities": ["Priority 1", "Priority 2"],
  "market_position": "Leader|Challenger|Follower|Niche",
  "innovation_gaps": ["Where industry is heading but brand isn't"],
  "partnership_opportunities": ["Potential partnerships based on gaps"]
}}"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                max_completion_tokens=2000,  # GPT-5 Nano requires max_completion_tokens
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error aggregating market insights: {e}")
            return {}
    
    async def generate_executive_dashboard(
        self,
        brand_name: str,
        overall_metrics: Dict[str, Any],
        recommendations: List[Dict[str, Any]],
        market_insights: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate C-suite ready dashboard with actionable insights
        """
        if not self.client:
            return {}
        
        prompt = f"""Create an executive dashboard for {brand_name}'s AI visibility performance.

Overall Metrics:
{json.dumps(overall_metrics, indent=2)}

Top Recommendations:
{json.dumps(recommendations[:5], indent=2)}

Market Insights:
{json.dumps(market_insights, indent=2)}

Create a CEO/CMO-level dashboard with clear, actionable insights.

Return JSON:
{{
  "executive_summary": {{
    "headline": "One-line summary of position",
    "key_metric": "Most important number",
    "trend": "Improving|Stable|Declining",
    "action_required": "Immediate|Short-term|Long-term"
  }},
  "performance_snapshot": {{
    "ai_visibility_score": 0-100,
    "competitive_position": "rank among competitors",
    "month_over_month_change": percentage,
    "projected_trajectory": "Strong Growth|Growth|Stable|Decline"
  }},
  "strategic_priorities": [
    {{
      "priority": "Priority name",
      "impact": "Expected business impact",
      "timeline": "Implementation timeline",
      "owner": "Suggested department/role",
      "budget_estimate": "Investment range"
    }}
  ],
  "competitive_intelligence": {{
    "main_threat": "Biggest competitive threat",
    "opportunity": "Biggest opportunity to gain share",
    "differentiation": "Key differentiator to emphasize"
  }},
  "board_talking_points": [
    "Point 1 for board presentation",
    "Point 2 for board presentation",
    "Point 3 for board presentation"
  ],
  "quarterly_goals": [
    {{
      "goal": "Specific measurable goal",
      "metric": "How to measure",
      "target": "Specific target number",
      "current": "Current number"
    }}
  ],
  "risk_mitigation": [
    {{
      "risk": "Risk description",
      "likelihood": "High|Medium|Low",
      "impact": "High|Medium|Low",
      "mitigation": "Mitigation strategy"
    }}
  ]
}}"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a McKinsey consultant creating executive dashboards. Be concise, specific, and action-oriented."},
                    {"role": "user", "content": prompt}
                ],
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                max_completion_tokens=3000,  # GPT-5 Nano requires max_completion_tokens
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error generating executive dashboard: {e}")
            return {}
    
    def _fallback_sentiment(self, response_text: str, brand_name: str) -> SentimentContext:
        """Fallback sentiment analysis"""
        response_lower = response_text.lower()
        brand_lower = brand_name.lower()
        
        positive_words = ['excellent', 'best', 'leading', 'recommend', 'top', 'great']
        negative_words = ['poor', 'bad', 'worst', 'avoid', 'problem', 'issue']
        
        positive_count = sum(1 for word in positive_words if word in response_lower)
        negative_count = sum(1 for word in negative_words if word in response_lower)
        
        if positive_count > negative_count:
            sentiment = 'positive'
            score = min(1.0, positive_count * 0.2)
        elif negative_count > positive_count:
            sentiment = 'negative'
            score = max(-1.0, -negative_count * 0.2)
        else:
            sentiment = 'neutral'
            score = 0.0
        
        return SentimentContext(
            overall_sentiment=sentiment,
            sentiment_score=score,
            reasons_positive=[],
            reasons_negative=[],
            emotional_triggers=[],
            brand_perception=f"{brand_name} mentioned" if brand_lower in response_lower else f"{brand_name} not mentioned",
            improvement_areas=[]
        )
    
    def _fallback_position(self, response_text: str, brand_name: str) -> PositionAnalysis:
        """Fallback position analysis"""
        response_lower = response_text.lower()
        brand_lower = brand_name.lower()
        
        first_pos = response_lower.find(brand_lower)
        total_mentions = response_lower.count(brand_lower)
        
        # Calculate prominence based on position
        if first_pos == -1:
            prominence = 0.0
        elif first_pos < 100:
            prominence = 80.0
        elif first_pos < 300:
            prominence = 60.0
        elif first_pos < 600:
            prominence = 40.0
        else:
            prominence = 20.0
        
        return PositionAnalysis(
            first_mention_position=first_pos,
            total_mentions=total_mentions,
            prominence_score=prominence,
            context_quality='primary' if first_pos < 200 else 'secondary',
            recommendation_strength='moderate' if total_mentions > 2 else 'weak',
            competitive_ranking=1 if total_mentions > 0 else 999
        )
    
    def _fallback_quality(self) -> ResponseQuality:
        """Fallback quality assessment"""
        return ResponseQuality(
            completeness_score=50.0,
            accuracy_score=50.0,
            depth_score=50.0,
            relevance_score=50.0,
            reliability_weight=0.5,
            quality_issues=[],
            strengths=[]
        )


async def run_comprehensive_analysis(
    response_text: str,
    brand_name: str,
    query: str,
    competitors: List[str],
    industry: str,
    openai_api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run all analyses on a single response
    """
    suite = LLMAnalysisSuite(openai_api_key)
    
    # Run all analyses in parallel
    results = await asyncio.gather(
        suite.analyze_sentiment_context(response_text, brand_name, query),
        suite.extract_feature_mentions(response_text, brand_name),
        suite.analyze_position_tracking(response_text, brand_name, competitors),
        suite.score_response_quality(response_text, query),
        return_exceptions=True
    )
    
    # Handle results
    analysis_results = {
        'sentiment_context': results[0] if not isinstance(results[0], Exception) else None,
        'feature_mentions': results[1] if not isinstance(results[1], Exception) else [],
        'position_analysis': results[2] if not isinstance(results[2], Exception) else None,
        'response_quality': results[3] if not isinstance(results[3], Exception) else None
    }
    
    return analysis_results