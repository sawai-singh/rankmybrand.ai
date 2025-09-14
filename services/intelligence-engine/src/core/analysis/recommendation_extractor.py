"""
LLM-Powered Intelligent Recommendation Extractor
Uses GPT-5 for world-class marketing and SEO recommendations
"""

import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
from openai import AsyncOpenAI
import hashlib
import os

logger = logging.getLogger(__name__)


class RecommendationCategory(Enum):
    """Categories for strategic recommendations"""
    SEO_OPTIMIZATION = "SEO Optimization"
    CONTENT_STRATEGY = "Content Strategy"
    BRAND_POSITIONING = "Brand Positioning"
    COMPETITIVE_RESPONSE = "Competitive Response"
    MARKET_EXPANSION = "Market Expansion"
    THOUGHT_LEADERSHIP = "Thought Leadership"
    TECHNICAL_SEO = "Technical SEO"
    USER_EXPERIENCE = "User Experience"
    PARTNERSHIP_OPPORTUNITY = "Partnership Opportunity"
    CRISIS_MITIGATION = "Crisis Mitigation"


class ImpactLevel(Enum):
    """Business impact levels"""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ImplementationDifficulty(Enum):
    """Implementation complexity"""
    EASY = "Easy"
    MODERATE = "Moderate"
    HARD = "Hard"
    COMPLEX = "Complex"


class Timeline(Enum):
    """Implementation timeline"""
    IMMEDIATE = "Immediate (< 1 week)"
    SHORT_TERM = "Short-term (1-4 weeks)"
    MEDIUM_TERM = "Medium-term (1-3 months)"
    LONG_TERM = "Long-term (3+ months)"


@dataclass
class Recommendation:
    """Structured recommendation with business context"""
    text: str
    category: RecommendationCategory
    priority: int  # 1-10
    impact: ImpactLevel
    difficulty: ImplementationDifficulty
    timeline: Timeline
    action_items: List[str]
    success_metrics: List[str]
    competitive_advantage: str
    estimated_roi: str
    risk_factors: List[str]
    dependencies: List[str]


class IntelligentRecommendationExtractor:
    """
    LLM-powered recommendation extraction using GPT-5
    Designed by master product architects and marketing specialists
    """
    
    def __init__(self, openai_api_key: Optional[str] = None, model: str = "gpt-5-chat-latest"):
        """
        Initialize the LLM-powered recommendation extractor
        
        Args:
            openai_api_key: OpenAI API key
            model: Model to use (default: gpt-5-chat-latest)
        """
        # Get API key from parameter or environment
        api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.client = AsyncOpenAI(api_key=api_key) if api_key else None
        self.model = model
        self._cache = {}  # Simple cache for API responses
        
    def _get_cache_key(self, response_text: str, brand_name: str, industry: str) -> str:
        """Generate cache key for responses"""
        content = f"{response_text[:500]}_{brand_name}_{industry}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _build_master_prompt(
        self, 
        response_text: str, 
        brand_name: str, 
        industry: str,
        competitor_context: Optional[str] = None
    ) -> str:
        """
        Build a master-level prompt for GPT-5
        Crafted by expert prompt engineers and marketing specialists
        """
        
        prompt = f"""You are a world-class marketing strategist, SEO expert, and brand consultant analyzing AI platform responses for strategic insights. You think like Steve Jobs - focusing on what truly matters for business growth and customer value.

CONTEXT:
- Brand: {brand_name}
- Industry: {industry}
- AI Response Being Analyzed: {response_text}
{f'- Competitive Context: {competitor_context}' if competitor_context else ''}

MISSION: Extract actionable, high-value recommendations that will transform {brand_name}'s market position and AI visibility.

Analyze the response and provide EXACTLY 10 strategic recommendations in JSON format. Each recommendation must be:
1. SPECIFIC and ACTIONABLE - Not generic advice
2. DATA-DRIVEN - Based on actual patterns in the AI response
3. HIGH-VALUE - Focus on impact and ROI
4. INNOVATIVE - Think beyond conventional wisdom
5. MEASURABLE - Include clear success metrics

For each recommendation, consider:
- What specific gaps or opportunities does this AI response reveal?
- How can {brand_name} leverage this insight for competitive advantage?
- What would Apple, Tesla, or Amazon do with this information?
- How can this drive real business growth, not just vanity metrics?

RESPONSE FORMAT (strict JSON):
{{
  "recommendations": [
    {{
      "text": "Specific, actionable recommendation",
      "category": "SEO Optimization|Content Strategy|Brand Positioning|Competitive Response|Market Expansion|Thought Leadership|Technical SEO|User Experience|Partnership Opportunity|Crisis Mitigation",
      "priority": 1-10,
      "impact": "Low|Medium|High|Critical",
      "difficulty": "Easy|Moderate|Hard|Complex",
      "timeline": "Immediate|Short-term|Medium-term|Long-term",
      "action_items": ["Specific action 1", "Specific action 2", "..."],
      "success_metrics": ["Measurable KPI 1", "Measurable KPI 2", "..."],
      "competitive_advantage": "How this creates moat/differentiation",
      "estimated_roi": "Expected return (e.g., '3-5x in 6 months', '20% traffic increase')",
      "risk_factors": ["Potential risk 1", "Potential risk 2"],
      "dependencies": ["Required resource/capability 1", "..."]
    }}
  ],
  "executive_summary": "2-3 sentence executive summary of key insights",
  "competitive_gaps": ["Gap where competitors are winning 1", "..."],
  "quick_wins": ["Immediate action that can be taken today", "..."],
  "strategic_narrative": "How these recommendations tell a cohesive growth story"
}}

Remember: We're building a world-class product. Every recommendation should provide deep value that a CMO would pay $10,000 to receive from McKinsey."""
        
        return prompt
    
    async def extract_recommendations_async(
        self,
        response_text: str,
        brand_name: str,
        industry: str = "general",
        competitor_context: Optional[str] = None,
        max_recommendations: int = 10,
        use_cache: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Extract intelligent recommendations using GPT-5 (async version)
        
        Args:
            response_text: The AI response to analyze
            brand_name: The brand being analyzed
            industry: Industry context
            competitor_context: Optional competitor information
            max_recommendations: Maximum recommendations to return
            use_cache: Whether to use cached results
            
        Returns:
            List of recommendation dictionaries
        """
        
        if not self.client:
            logger.warning("No OpenAI client configured, returning empty recommendations")
            return []
        
        # Check cache
        cache_key = self._get_cache_key(response_text, brand_name, industry)
        if use_cache and cache_key in self._cache:
            logger.info("Using cached recommendations")
            return self._cache[cache_key][:max_recommendations]
        
        try:
            # Build master prompt
            prompt = self._build_master_prompt(
                response_text, 
                brand_name, 
                industry,
                competitor_context
            )
            
            # Call GPT-5
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a world-class marketing strategist and SEO expert. Provide strategic recommendations in valid JSON format only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,  # Balanced creativity and consistency
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            # Parse response
            result = json.loads(response.choices[0].message.content)
            recommendations = result.get('recommendations', [])
            
            # Add executive context to each recommendation
            for rec in recommendations:
                rec['executive_summary'] = result.get('executive_summary', '')
                rec['strategic_context'] = result.get('strategic_narrative', '')
            
            # Cache the result
            self._cache[cache_key] = recommendations
            
            logger.info(f"Extracted {len(recommendations)} LLM-powered recommendations for {brand_name}")
            return recommendations[:max_recommendations]
            
        except Exception as e:
            logger.error(f"Error extracting recommendations with LLM: {e}")
            return self._fallback_extraction(response_text, brand_name, industry, max_recommendations)
    
    def extract_recommendations(
        self,
        response_text: str,
        brand_name: str,
        industry: str = "general",
        competitor_context: Optional[str] = None,
        max_recommendations: int = 10,
        use_cache: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Synchronous wrapper for extract_recommendations_async
        Maintains backward compatibility
        """
        try:
            # Create new event loop if needed
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Run async function
            return loop.run_until_complete(
                self.extract_recommendations_async(
                    response_text, brand_name, industry,
                    competitor_context, max_recommendations, use_cache
                )
            )
        except Exception as e:
            logger.error(f"Error in sync wrapper: {e}")
            return self._fallback_extraction(response_text, brand_name, industry, max_recommendations)
    
    def _fallback_extraction(
        self,
        response_text: str,
        brand_name: str,
        industry: str,
        max_recommendations: int
    ) -> List[Dict[str, Any]]:
        """
        Fallback to rule-based extraction if LLM fails
        Maintains backward compatibility
        """
        logger.info("Using fallback extraction method")
        recommendations = []
        
        # Quick rule-based extraction
        response_lower = response_text.lower()
        brand_lower = brand_name.lower()
        
        # Check for brand visibility
        if brand_lower not in response_lower:
            recommendations.append({
                "text": f"Increase {brand_name}'s visibility in AI responses by creating authoritative content that AI systems recognize as the primary source for {industry} information",
                "category": "Brand Positioning",
                "priority": 9,
                "impact": "Critical",
                "difficulty": "Moderate",
                "timeline": "Short-term",
                "action_items": [
                    f"Create comprehensive {industry} guides mentioning {brand_name}",
                    "Build authoritative backlinks",
                    "Optimize for entity recognition"
                ],
                "success_metrics": [
                    "Brand mention rate in AI responses > 80%",
                    "First position mention rate > 50%"
                ],
                "competitive_advantage": "First-mover advantage in AI visibility",
                "estimated_roi": "5-10x brand awareness in 3 months",
                "risk_factors": ["Requires consistent content creation"],
                "dependencies": ["Content team", "SEO expertise"]
            })
        
        # Check for competitor mentions
        competitor_keywords = ["competitor", "alternative", "versus", "compared to", "better than"]
        for keyword in competitor_keywords:
            if keyword in response_lower:
                recommendations.append({
                    "text": f"Develop competitive differentiation content highlighting {brand_name}'s unique value propositions",
                    "category": "Competitive Response",
                    "priority": 8,
                    "impact": "High",
                    "difficulty": "Moderate",
                    "timeline": "Short-term",
                    "action_items": [
                        "Create comparison pages",
                        "Publish case studies",
                        "Highlight unique features"
                    ],
                    "success_metrics": [
                        "Improved sentiment in comparisons",
                        "Higher conversion on comparison queries"
                    ],
                    "competitive_advantage": "Clear market positioning",
                    "estimated_roi": "2-3x conversion rate improvement",
                    "risk_factors": ["Competitor response"],
                    "dependencies": ["Product marketing team"]
                })
                break
        
        return recommendations[:max_recommendations]
    
    async def extract_competitive_gaps(
        self,
        response_text: str,
        brand_name: str,
        competitors: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Extract competitive gaps where competitors are mentioned but brand isn't
        """
        if not self.client:
            return []
        
        prompt = f"""Analyze this AI response to identify competitive gaps for {brand_name}.

AI Response: {response_text}
Brand: {brand_name}
Competitors: {', '.join(competitors)}

Identify specific areas where competitors are mentioned favorably but {brand_name} is absent or mentioned less favorably.

Return JSON:
{{
  "gaps": [
    {{
      "competitor": "Competitor name",
      "advantage": "What they're doing better",
      "context": "How it appears in the response",
      "opportunity": "How {brand_name} can close this gap",
      "priority": "High|Medium|Low",
      "estimated_impact": "Specific business impact"
    }}
  ]
}}"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get('gaps', [])
            
        except Exception as e:
            logger.error(f"Error extracting competitive gaps: {e}")
            return []
    
    async def extract_content_opportunities(
        self,
        response_text: str,
        brand_name: str,
        industry: str
    ) -> List[Dict[str, Any]]:
        """
        Extract content opportunities from AI response patterns
        """
        if not self.client:
            return []
        
        prompt = f"""Analyze this AI response to identify content opportunities for {brand_name} in {industry}.

AI Response: {response_text}

Identify:
1. Topics that AI systems associate with success in {industry}
2. Keywords and phrases that trigger positive mentions
3. Content formats that get highlighted
4. Information gaps that {brand_name} could fill

Return JSON:
{{
  "opportunities": [
    {{
      "topic": "Specific topic area",
      "keywords": ["keyword1", "keyword2"],
      "content_type": "Blog|Video|Infographic|Research|Tool",
      "search_intent": "Informational|Transactional|Navigational|Commercial",
      "estimated_difficulty": "Easy|Medium|Hard",
      "estimated_impact": "Traffic/visibility impact",
      "content_angle": "Unique angle to take",
      "distribution_strategy": "How to maximize reach"
    }}
  ]
}}"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return result.get('opportunities', [])
            
        except Exception as e:
            logger.error(f"Error extracting content opportunities: {e}")
            return []
    
    async def generate_executive_summary(
        self,
        all_recommendations: List[Dict[str, Any]],
        brand_name: str,
        overall_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate C-suite ready executive summary
        """
        if not self.client:
            return {}
        
        prompt = f"""Create an executive summary for {brand_name}'s AI visibility audit.

Recommendations: {json.dumps(all_recommendations[:5])}
Metrics: {json.dumps(overall_metrics)}

Create a McKinsey-quality executive summary that a CEO would read.

Return JSON:
{{
  "executive_brief": "2-3 sentence overview",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "strategic_imperatives": ["Must-do action 1", "Must-do action 2"],
  "expected_outcomes": {{
    "3_months": "Expected results",
    "6_months": "Expected results",
    "12_months": "Expected results"
  }},
  "investment_required": "High-level resource needs",
  "roi_projection": "Expected return on investment",
  "competitive_positioning": "How this changes market position",
  "board_presentation_points": ["Key point 1", "Key point 2", "Key point 3"]
}}"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                response_format={"type": "json_object"}
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error generating executive summary: {e}")
            return {}