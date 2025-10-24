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
    
    def __init__(self, openai_api_key: Optional[str] = None, model: str = "gpt-5-nano"):
        """
        Initialize the LLM-powered recommendation extractor
        
        Args:
            openai_api_key: OpenAI API key
            model: Model to use (default: gpt-5-nano)
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
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                max_completion_tokens=4000,  # GPT-5 Nano requires max_completion_tokens
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

        # Handle both string and object formats for competitors
        competitor_names = [
            comp if isinstance(comp, str) else comp.get('name', str(comp))
            for comp in competitors
        ]

        prompt = f"""Analyze this AI response to identify competitive gaps for {brand_name}.

AI Response: {response_text}
Brand: {brand_name}
Competitors: {', '.join(competitor_names)}

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
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
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
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
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
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"Error generating executive summary: {e}")
            return {}


class WorldClassRecommendationAggregator:
    """
    World-class recommendation aggregator for buyer-journey batching.

    Extracts context-aware insights from batched responses within specific buyer journey categories.
    Designed for production deployment with Apple-level quality standards.

    Architecture:
    - 6 buyer journey categories × 2 batches × 3 extraction types = 36 LLM calls max
    - Context-aware prompts tailored to each buyer journey stage
    - Structured insights with priority scoring and ROI estimation
    - 95% reduction in LLM calls vs per-response analysis
    """

    # Buyer journey context mapping for intelligent prompting
    CATEGORY_CONTEXT = {
        'problem_unaware': {
            'stage': 'Early Awareness',
            'mindset': 'Users experiencing problems but unaware solutions exist',
            'focus': 'Educational content, problem identification, thought leadership',
            'goal': 'Build awareness and establish authority as solution provider'
        },
        'solution_seeking': {
            'stage': 'Active Research',
            'mindset': 'Users actively searching for solutions to known problems',
            'focus': 'Solution comparison, educational resources, case studies',
            'goal': 'Position as best solution category and build consideration'
        },
        'brand_specific': {
            'stage': 'Brand Evaluation',
            'mindset': 'Users specifically researching your brand',
            'focus': 'Brand differentiation, unique value props, trust signals',
            'goal': 'Reinforce brand strengths and address concerns'
        },
        'comparison': {
            'stage': 'Competitive Analysis',
            'mindset': 'Users comparing multiple solutions/brands',
            'focus': 'Competitive advantages, feature comparisons, ROI evidence',
            'goal': 'Win competitive evaluations and demonstrate superiority'
        },
        'purchase_intent': {
            'stage': 'Decision Making',
            'mindset': 'Users ready to buy, looking for final validation',
            'focus': 'Conversion triggers, pricing clarity, risk mitigation',
            'goal': 'Remove friction and drive conversions'
        },
        'use_case': {
            'stage': 'Application Research',
            'mindset': 'Users exploring specific use cases and applications',
            'focus': 'Use case examples, implementation guides, success stories',
            'goal': 'Demonstrate versatility and practical value'
        }
    }

    def __init__(self, openai_api_key: Optional[str] = None, model: str = "gpt-5-nano"):
        """
        Initialize world-class recommendation aggregator.

        Args:
            openai_api_key: OpenAI API key
            model: LLM model to use (default: gpt-5-nano)
        """
        api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.client = AsyncOpenAI(api_key=api_key) if api_key else None
        self.model = model
        logger.info(f"WorldClassRecommendationAggregator initialized with model={model}")

    def _build_category_aware_prompt(
        self,
        response_texts: str,
        brand_name: str,
        category: str,
        industry: str,
        competitors: List[str],
        extraction_type: str,  # 'recommendations', 'competitive_gaps', 'content_opportunities'
        max_items: int = 10
    ) -> str:
        """
        Build intelligent, context-aware prompts tailored to buyer journey category.

        This is the secret sauce - prompts adapt to the buyer's mindset at each stage.
        """

        category_info = self.CATEGORY_CONTEXT.get(category, self.CATEGORY_CONTEXT['solution_seeking'])
        competitor_str = ', '.join(competitors) if competitors else 'general market competitors'

        # Base context shared across all extraction types
        base_context = f"""You are a world-class marketing strategist analyzing AI visibility patterns for {brand_name} in the {industry} industry.

BUYER JOURNEY CONTEXT:
- Category: {category.replace('_', ' ').title()}
- Stage: {category_info['stage']}
- User Mindset: {category_info['mindset']}
- Strategic Focus: {category_info['focus']}
- Primary Goal: {category_info['goal']}

BATCHED AI RESPONSES ({category} stage):
{response_texts}

COMPETITIVE LANDSCAPE:
- Primary Competitors: {competitor_str}

ANALYSIS MISSION:
Analyze these {category} stage responses to extract strategic {extraction_type.replace('_', ' ')} that will maximize {brand_name}'s AI visibility and market dominance at this buyer journey stage."""

        # Type-specific prompts
        if extraction_type == 'recommendations':
            return f"""{base_context}

Extract exactly {max_items} strategic recommendations that will improve {brand_name}'s visibility in {category} stage AI responses.

QUALITY CRITERIA:
1. CONTEXT-AWARE: Tailored to {category_info['stage']} mindset
2. ACTIONABLE: Specific tactics, not vague advice
3. STRATEGIC: Focus on competitive differentiation
4. MEASURABLE: Include clear success metrics
5. HIGH-ROI: Prioritize actions with maximum business impact

Return JSON:
{{
  "recommendations": [
    {{
      "text": "Specific, actionable recommendation for {category} stage",
      "category": "SEO Optimization|Content Strategy|Brand Positioning|Competitive Response|Market Expansion|Thought Leadership|Technical SEO|User Experience|Partnership Opportunity|Crisis Mitigation",
      "priority": 1-10,
      "impact": "Low|Medium|High|Critical",
      "difficulty": "Easy|Moderate|Hard|Complex",
      "timeline": "Immediate|Short-term|Medium-term|Long-term",
      "action_items": ["Specific action 1", "Specific action 2", "Specific action 3"],
      "success_metrics": ["KPI 1", "KPI 2", "KPI 3"],
      "competitive_advantage": "How this creates moat at {category} stage",
      "estimated_roi": "Quantified business impact (e.g., '30% visibility increase')",
      "risk_factors": ["Risk 1", "Risk 2"],
      "dependencies": ["Dependency 1", "Dependency 2"],
      "buyer_journey_context": "{category}"
    }}
  ]
}}

Remember: These recommendations must be specifically valuable for users in the {category_info['stage']} phase."""

        elif extraction_type == 'competitive_gaps':
            return f"""{base_context}

Identify exactly {max_items} competitive gaps where competitors are winning in {category} stage AI responses.

Focus on:
- Where competitors are mentioned but {brand_name} is absent
- Where competitors are positioned more favorably
- Specific advantages competitors have at this buyer journey stage
- Missed opportunities for {brand_name}

Return JSON:
{{
  "competitive_gaps": [
    {{
      "competitor": "Competitor name",
      "gap_description": "What they're doing better in {category} responses",
      "evidence": "Specific examples from AI responses",
      "business_impact": "How this gap hurts {brand_name}",
      "closure_strategy": "How to close this gap",
      "priority": "High|Medium|Low",
      "estimated_effort": "Time/resources needed",
      "expected_outcome": "Business results after closing gap",
      "buyer_journey_context": "{category}"
    }}
  ]
}}"""

        elif extraction_type == 'content_opportunities':
            return f"""{base_context}

Identify exactly {max_items} content opportunities that will maximize AI visibility in {category} stage responses.

Analyze patterns in how AI systems:
- Respond to {category} stage queries
- Structure information for this buyer journey phase
- Select authoritative sources
- Prioritize specific content types

Return JSON:
{{
  "content_opportunities": [
    {{
      "opportunity_title": "Specific content opportunity",
      "topic": "Detailed topic area",
      "content_type": "Blog|Video|Infographic|Research Report|Tool|Interactive|Podcast|Case Study|White Paper|Guide",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "search_intent": "Informational|Transactional|Navigational|Commercial",
      "buyer_journey_alignment": "{category}",
      "content_angle": "Unique perspective to take",
      "estimated_difficulty": "Easy|Medium|Hard",
      "estimated_impact": "AI visibility impact (e.g., '40% mention rate increase')",
      "distribution_channels": ["Channel 1", "Channel 2"],
      "success_metrics": ["Metric 1", "Metric 2"],
      "competitive_advantage": "Why this content will outperform competitors",
      "production_timeline": "Time to create and publish"
    }}
  ]
}}"""

        return base_context

    async def extract_category_insights(
        self,
        response_texts: str,
        brand_name: str,
        category: str,
        industry: str,
        competitors: List[str],
        max_recommendations: int = 10
    ) -> Dict[str, Any]:
        """
        Extract category-specific insights from batched responses.

        This is the core method for buyer-journey batching.
        Makes 3 LLM calls per batch: recommendations, competitive gaps, content opportunities.

        Args:
            response_texts: Combined response texts for the batch
            brand_name: Brand being analyzed
            category: Buyer journey category
            industry: Industry context
            competitors: List of competitors
            max_recommendations: Max items per extraction type

        Returns:
            Dictionary with recommendations, competitive_gaps, content_opportunities
        """

        if not self.client:
            logger.warning("No OpenAI client configured, returning empty insights")
            return {
                'recommendations': [],
                'competitive_gaps': [],
                'content_opportunities': []
            }

        logger.info(f"🎯 Extracting category insights for {category} ({len(response_texts)} chars)")

        insights = {
            'recommendations': [],
            'competitive_gaps': [],
            'content_opportunities': []
        }

        # Extract all three types in parallel for maximum speed
        try:
            # Create all three tasks
            tasks = [
                self._extract_single_type(
                    response_texts, brand_name, category, industry,
                    competitors, 'recommendations', max_recommendations
                ),
                self._extract_single_type(
                    response_texts, brand_name, category, industry,
                    competitors, 'competitive_gaps', max_recommendations
                ),
                self._extract_single_type(
                    response_texts, brand_name, category, industry,
                    competitors, 'content_opportunities', max_recommendations
                )
            ]

            # Execute in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for extraction_type, result in zip(
                ['recommendations', 'competitive_gaps', 'content_opportunities'],
                results
            ):
                if isinstance(result, Exception):
                    logger.error(f"Error extracting {extraction_type} for {category}: {result}")
                    insights[extraction_type] = []
                else:
                    insights[extraction_type] = result
                    logger.info(f"  ✅ {extraction_type}: {len(result)} items extracted")

        except Exception as e:
            logger.error(f"Error in parallel extraction for {category}: {e}")

        return insights

    async def _extract_single_type(
        self,
        response_texts: str,
        brand_name: str,
        category: str,
        industry: str,
        competitors: List[str],
        extraction_type: str,
        max_items: int
    ) -> List[Dict[str, Any]]:
        """
        Extract a single type of insight (recommendations, gaps, or opportunities).

        This method makes a single LLM API call.
        """

        try:
            # Build context-aware prompt
            prompt = self._build_category_aware_prompt(
                response_texts=response_texts,
                brand_name=brand_name,
                category=category,
                industry=industry,
                competitors=competitors,
                extraction_type=extraction_type,
                max_items=max_items
            )

            # Call LLM
            # Note: Removed max_completion_tokens to let model use full context window
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a world-class marketing strategist and AI visibility expert. Provide insights in valid JSON format only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )

            # Parse response
            content = response.choices[0].message.content

            # AGGRESSIVE DEBUG: Always log what we got
            logger.error(f"🔍 DEBUG {extraction_type} in {category}:")
            logger.error(f"   Content type: {type(content)}")
            logger.error(f"   Content length: {len(content) if content else 0}")
            logger.error(f"   Content repr: {repr(content[:500] if content else 'None')}")
            logger.error(f"   Is None: {content is None}")
            logger.error(f"   Is empty string: {content == ''}")

            # Debug: Log what we got from LLM
            if not content or content.strip() == '':
                logger.error(f"LLM returned empty content for {extraction_type} in {category}")
                logger.error(f"Response object: {response}")
                return []

            result = json.loads(content)

            # Extract the specific type
            items = result.get(extraction_type, [])

            logger.info(f"   LLM returned {len(items)} {extraction_type} for {category}")

            return items

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error for {extraction_type} in {category}: {e}")
            logger.error(f"Content that failed to parse: '{content[:500] if 'content' in locals() else 'N/A'}'")
            return []
        except Exception as e:
            logger.error(f"Error extracting {extraction_type} for {category}: {e}")
            return []

    async def aggregate_category_insights(
        self,
        all_category_insights: Dict[str, Dict[str, Any]],
        brand_name: str,
        overall_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Aggregate insights across all buyer journey categories into executive summary.

        This method combines insights from all 6 categories into a cohesive strategic narrative.

        Args:
            all_category_insights: Insights organized by category
            brand_name: Brand name
            overall_metrics: Overall audit metrics

        Returns:
            Executive summary with cross-category insights
        """

        if not self.client:
            return {}

        # Collect top recommendations across categories
        all_recommendations = []
        for category, insights in all_category_insights.items():
            for rec in insights.get('recommendations', [])[:3]:  # Top 3 per category
                rec['source_category'] = category
                all_recommendations.append(rec)

        # Build executive prompt
        prompt = f"""Create an executive summary for {brand_name}'s AI visibility audit with buyer-journey insights.

CATEGORY-SPECIFIC INSIGHTS:
{json.dumps(all_category_insights, indent=2)[:3000]}  # Limit for token management

OVERALL METRICS:
{json.dumps(overall_metrics, indent=2)}

Create a world-class executive summary that:
1. Synthesizes patterns across buyer journey stages
2. Highlights strategic opportunities at each stage
3. Provides clear ROI projections
4. Delivers board-level strategic recommendations

Return JSON:
{{
  "executive_brief": "3-4 sentence strategic overview",
  "buyer_journey_analysis": {{
    "awareness_stage": "Key insights for problem_unaware + solution_seeking",
    "consideration_stage": "Key insights for brand_specific + comparison",
    "decision_stage": "Key insights for purchase_intent + use_case"
  }},
  "strategic_priorities": ["Priority 1", "Priority 2", "Priority 3"],
  "quick_wins": ["Immediate action 1", "Immediate action 2"],
  "competitive_positioning": "How to dominate AI visibility across buyer journey",
  "investment_required": "Resource allocation across stages",
  "roi_projection": {{
    "3_months": "Expected outcomes",
    "6_months": "Expected outcomes",
    "12_months": "Expected outcomes"
  }},
  "success_metrics": ["Metric 1", "Metric 2", "Metric 3"]
}}"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a C-suite strategic advisor specializing in AI visibility and digital transformation."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_completion_tokens=2000,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            logger.info("✅ Executive summary generated across all buyer journey categories")
            return result

        except Exception as e:
            logger.error(f"Error generating aggregated executive summary: {e}")
            return {}

    async def extract_per_response_metrics(
        self,
        responses_batch: List[Dict[str, Any]],
        brand_name: str,
        competitors: List[str],
        category: str,
        industry: str
    ) -> List[Dict[str, Any]]:
        """
        Extract per-response metrics for all responses in batch.

        This is the 4th LLM call per batch that analyzes individual responses
        for brand mentions, sentiment, GEO factors, SOV, and other quantifiable metrics.

        Args:
            responses_batch: List of 8 response dictionaries (each with query_text, response_text, provider)
            brand_name: Brand being analyzed
            competitors: List of competitor names
            category: Buyer journey category
            industry: Industry context

        Returns:
            List of 8 metric dictionaries (one per response)
        """

        if not self.client:
            logger.warning("No OpenAI client configured, returning empty metrics")
            return []

        if not responses_batch or len(responses_batch) == 0:
            logger.warning("Empty responses batch provided")
            return []

        batch_size = len(responses_batch)
        logger.info(f"🔍 Extracting per-response metrics for {batch_size} responses in {category} category")

        # Build prompt with all responses
        prompt = self._build_per_response_metrics_prompt(
            responses_batch=responses_batch,
            brand_name=brand_name,
            competitors=competitors,
            category=category,
            industry=industry
        )

        try:
            # Single LLM call to analyze all responses in batch
            # Note: Removed max_completion_tokens to let model use full context window
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a world-class AI visibility analyst. Analyze each response thoroughly and return metrics in valid JSON format only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )

            # Parse LLM response
            content = response.choices[0].message.content

            # AGGRESSIVE DEBUG: Always log what we got
            logger.error(f"🔍 DEBUG per-response metrics in {category}:")
            logger.error(f"   Content type: {type(content)}")
            logger.error(f"   Content length: {len(content) if content else 0}")
            logger.error(f"   Content repr: {repr(content[:500] if content else 'None')}")

            # Debug: Log what we got from LLM
            if not content or content.strip() == '':
                logger.error(f"LLM returned empty content for per-response metrics in {category}")
                logger.error(f"Response object: {response}")
                return []

            result = json.loads(content)
            per_response_metrics = result.get('per_response_metrics', [])

            # Validate we got metrics for all responses
            if len(per_response_metrics) != batch_size:
                logger.warning(f"Expected {batch_size} metrics but got {len(per_response_metrics)}")

            logger.info(f"✅ Extracted metrics for {len(per_response_metrics)} responses")

            return per_response_metrics

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error for per-response metrics in {category}: {e}")
            logger.error(f"Content that failed to parse: '{content[:500] if 'content' in locals() else 'N/A'}'")
            return []
        except Exception as e:
            logger.error(f"Error extracting per-response metrics for {category}: {e}")
            return []

    def _build_per_response_metrics_prompt(
        self,
        responses_batch: List[Dict[str, Any]],
        brand_name: str,
        competitors: List[str],
        category: str,
        industry: str
    ) -> str:
        """
        Build prompt to extract per-response metrics for all responses in batch.

        This is where the magic happens - analyzing 8 responses at once for individual metrics.
        """

        # Get category context
        category_info = self.CATEGORY_CONTEXT.get(category, self.CATEGORY_CONTEXT['solution_seeking'])
        competitor_str = ', '.join(competitors[:5]) if competitors else 'general market competitors'

        # Format responses for prompt (limit each to 1500 chars to fit in context)
        response_entries = []
        for i, resp in enumerate(responses_batch, 1):
            response_text = resp.get('response_text', '')[:1500]  # Limit per response
            query_text = resp.get('query_text', '')
            provider = resp.get('provider', 'unknown')

            response_entries.append(f"""
Response {i}:
  Query: {query_text}
  Provider: {provider}
  Response Text: {response_text}
""")

        prompt = f"""You are analyzing {len(responses_batch)} AI responses for {brand_name} in the {industry} industry.

BUYER JOURNEY CONTEXT:
- Category: {category.replace('_', ' ').title()}
- Stage: {category_info['stage']}
- User Mindset: {category_info['mindset']}

BRAND: {brand_name}
COMPETITORS: {competitor_str}

RESPONSES TO ANALYZE:
{"".join(response_entries)}

TASK: For EACH of the {len(responses_batch)} responses above, extract detailed metrics.

For each response, analyze:

1. **Brand Visibility**
   - Is {brand_name} mentioned? (check for variations: plurals, possessives, abbreviations)
   - How many times is it mentioned?
   - Where does it first appear? (estimate percentage position 0-100, where 0 = start, 100 = end)
   - Quality of mention context: high (detailed, positive), medium (brief mention), low (passing reference), none

2. **Sentiment Analysis**
   - Overall sentiment toward {brand_name}: positive, neutral, negative, or mixed
   - Recommendation strength: strong (highly recommended), moderate (mentioned positively), weak (neutral mention), none (not mentioned)

3. **Features & Value Propositions**
   - Which specific features of {brand_name} are mentioned? (list up to 5)
   - Which value propositions are highlighted? (list up to 5)

4. **Competitor Analysis**
   - Which competitors from [{competitor_str}] are mentioned?
   - Sentiment toward each competitor
   - Are they positioned better than {brand_name}? (true/false)
   - Brief comparison context if applicable

5. **GEO (Generative Engine Optimization) Factors**
   - Citation quality (0-100): How authoritative is the brand mention?
   - Content relevance (0-100): How relevant to the query?
   - Authority signals (0-100): Is brand positioned as expert/leader?
   - Position prominence (0-100): Early mention = higher score
   - Estimated GEO score (0-100): Overall AI visibility quality

6. **Share of Voice (SOV)**
   - Count of {brand_name} mentions in this response
   - Count of total brand mentions (including competitors) in this response
   - Estimated SOV percentage (0-100): brand_mentions / total_brand_mentions * 100

7. **Additional AI Visibility Metrics**
   - Featured snippet potential (0-100): Could this response be featured?
   - Voice search optimized (true/false): Is response concise for voice?
   - Content gaps: What's missing that could improve brand visibility? (list up to 3)
   - Improvement suggestions: Quick wins for better AI visibility (list up to 3)

8. **SEO & Positioning Factors**
   - Keyword density (0-100): How well does response use key terms?
   - Readability score (0-100): How clear and understandable?
   - Structure quality: good, fair, or poor
   - Mentioned as leader (true/false): Is brand positioned as market leader?
   - Ranking position (1-5): Where does brand appear in lists? (0 if not in list)

Return JSON with EXACTLY {len(responses_batch)} objects in this format:

{{
  "per_response_metrics": [
    {{
      "response_number": 1,
      "provider": "openai",

      "brand_analysis": {{
        "mentioned": true,
        "mention_count": 2,
        "first_position_percentage": 15,
        "context_quality": "high",
        "sentiment": "positive",
        "recommendation_strength": "strong"
      }},

      "features_and_value_props": {{
        "features_mentioned": ["feature1", "feature2"],
        "value_props_highlighted": ["value prop 1", "value prop 2"]
      }},

      "competitor_analysis": [
        {{
          "competitor_name": "Competitor A",
          "mentioned": true,
          "mention_count": 1,
          "sentiment": "neutral",
          "positioned_better": false,
          "comparison_context": "Brief context or null"
        }}
      ],

      "geo_factors": {{
        "citation_quality": 75,
        "content_relevance": 85,
        "authority_signals": 70,
        "position_prominence": 90,
        "estimated_geo_score": 80
      }},

      "sov_data": {{
        "brand_mentions": 2,
        "total_brand_mentions": 3,
        "estimated_sov_percentage": 67
      }},

      "additional_metrics": {{
        "featured_snippet_potential": 60,
        "voice_search_optimized": false,
        "content_gaps": ["gap1", "gap2"],
        "improvement_suggestions": ["suggestion1", "suggestion2"]
      }},

      "seo_positioning": {{
        "keyword_density": 70,
        "readability_score": 85,
        "structure_quality": "good",
        "mentioned_as_leader": true,
        "ranking_position": 1
      }}
    }},
    {{
      "response_number": 2,
      ...
    }},
    ... // Continue for all {len(responses_batch)} responses
  ]
}}

CRITICAL REQUIREMENTS:
1. Analyze ALL {len(responses_batch)} responses - do not skip any
2. Be accurate with brand name variations (check plurals, possessives, abbreviations)
3. Provide realistic scores (0-100 range)
4. Return valid JSON only
5. Ensure response_number matches the order above (1 through {len(responses_batch)})

Think like a world-class AI visibility analyst. Every metric should be data-driven and precise."""

        return prompt