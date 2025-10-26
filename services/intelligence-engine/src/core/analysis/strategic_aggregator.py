"""
Strategic Intelligence Aggregator - Layers 1, 2, 3

Implements the complete aggregation pipeline for world-class strategic insights:
- Layer 1 (18 calls): Per-category aggregation with personalization
- Layer 2 (3 calls): Strategic prioritization across categories
- Layer 3 (1 call): Executive summary generation

Total: 22 LLM calls building on top of 96-call batching system
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import openai

logger = logging.getLogger(__name__)


# =====================================================
# Context Structures
# =====================================================

@dataclass
class CompanyContext:
    """Complete company profile for personalization"""

    # Basic info
    company_id: int
    company_name: str
    industry: str
    sub_industry: Optional[str] = None
    description: str = ""

    # Size & Stage
    company_size: str = "smb"  # startup, smb, midmarket, enterprise
    employee_count: Optional[int] = None
    growth_stage: str = "growth"  # seed, early, growth, mature, enterprise
    annual_revenue_range: Optional[str] = None

    # Business Model
    business_model: str = "B2B"  # B2B, B2C, B2B2C, marketplace
    pricing_model: Optional[str] = None
    target_market: List[str] = field(default_factory=list)

    # Competitive Landscape
    main_competitors: List[str] = field(default_factory=list)
    competitive_position: str = "challenger"  # leader, challenger, niche, emerging

    # Strategic Context
    strategic_goals: List[str] = field(default_factory=list)
    innovation_focus: str = "balanced"  # conservative, balanced, aggressive

    # Products & Services
    products_services: List[str] = field(default_factory=list)
    unique_value_propositions: List[str] = field(default_factory=list)
    key_features: List[str] = field(default_factory=list)

    # Persona (optional - used by determine_persona_context)
    primary_persona: Optional[str] = None

    # Metadata
    domain: Optional[str] = None
    website: Optional[str] = None


@dataclass
class PersonaContext:
    """Decision-maker persona for personalization"""

    # Role
    primary_persona: str = "Marketing Director"
    decision_level: str = "Director"  # C-Suite, VP, Director, Manager
    department: str = "Marketing"

    # Priorities
    priorities: List[str] = field(default_factory=lambda: ["Growth", "Efficiency", "ROI"])
    kpis: List[str] = field(default_factory=lambda: ["Pipeline", "Conversions", "CAC"])

    # Decision-Making Style
    detail_level: str = "balanced"  # high, balanced, executive
    risk_tolerance: str = "moderate"  # conservative, moderate, aggressive
    decision_timeframe: str = "quarterly"  # monthly, quarterly, annual

    # Resources
    budget_authority: str = "$10K-50K"  # <$10K, $10K-50K, $50K-250K, $250K+
    resource_availability: str = "limited"  # constrained, limited, moderate, abundant
    team_size: int = 5

    # Communication Preferences
    communication_style: str = "data-driven"  # visionary, data-driven, pragmatic


# =====================================================
# Persona Mapping Logic
# =====================================================

PERSONA_MAPPING = {
    'startup': {
        'default': 'Founder/CEO',
        'decision_level': 'C-Suite',
        'budget_authority': '<$10K',
        'resource_availability': 'constrained',
        'priorities': ['Product-Market Fit', 'Growth', 'Funding'],
        'kpis': ['User Growth', 'Retention', 'Burn Rate'],
        'risk_tolerance': 'aggressive',
        'detail_level': 'balanced'
    },
    'smb': {
        'default': 'Marketing Director',
        'decision_level': 'Director',
        'budget_authority': '$10K-50K',
        'resource_availability': 'limited',
        'priorities': ['Revenue Growth', 'Lead Generation', 'ROI'],
        'kpis': ['Pipeline', 'Conversions', 'CAC'],
        'risk_tolerance': 'moderate',
        'detail_level': 'balanced'
    },
    'midmarket': {
        'default': 'CMO',
        'decision_level': 'VP',
        'budget_authority': '$50K-250K',
        'resource_availability': 'moderate',
        'priorities': ['Market Share', 'Brand Awareness', 'Competitive Advantage'],
        'kpis': ['Market Share', 'Brand Sentiment', 'Win Rate'],
        'risk_tolerance': 'moderate',
        'detail_level': 'executive'
    },
    'enterprise': {
        'default': 'VP of Marketing',
        'decision_level': 'VP',
        'budget_authority': '$250K+',
        'resource_availability': 'abundant',
        'priorities': ['Market Leadership', 'Innovation', 'Efficiency'],
        'kpis': ['Revenue', 'Market Position', 'Brand Value'],
        'risk_tolerance': 'conservative',
        'detail_level': 'executive'
    }
}


def determine_persona_context(company_context: CompanyContext) -> PersonaContext:
    """
    Determine decision-maker persona based on company profile.

    Uses company size, stage, and industry to infer the most likely
    decision-maker and their characteristics.
    """

    size = company_context.company_size or 'smb'
    persona_template = PERSONA_MAPPING.get(size, PERSONA_MAPPING['smb'])

    return PersonaContext(
        primary_persona=company_context.primary_persona or persona_template['default'],
        decision_level=persona_template['decision_level'],
        priorities=persona_template['priorities'],
        kpis=persona_template['kpis'],
        budget_authority=persona_template['budget_authority'],
        resource_availability=persona_template['resource_availability'],
        risk_tolerance=persona_template['risk_tolerance'],
        detail_level=persona_template['detail_level'],
        team_size=company_context.employee_count or 10
    )


# =====================================================
# Buyer Journey Phase Mapping (5-Phase Framework)
# =====================================================
# Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)
# Total: 42 queries for competitive intelligence

CATEGORY_MAPPING = {
    'discovery': {
        'stage': 'Problem Discovery',
        'funnel_stage': 'awareness',
        'mindset': 'Users identifying pain points and recognizing problems',
        'focus': 'Educational content, problem identification, thought leadership',
        'strategic_weight': 0.14  # 6 queries, 14% of total
    },
    'research': {
        'stage': 'Solution Research',
        'funnel_stage': 'awareness',
        'mindset': 'Users exploring solution landscape and category options',
        'focus': 'Solution comparison, educational resources, case studies',
        'strategic_weight': 0.19  # 8 queries, 19% of total
    },
    'evaluation': {
        'stage': 'Brand Evaluation',
        'funnel_stage': 'consideration',
        'mindset': 'Users specifically investigating your brand and capabilities',
        'focus': 'Brand differentiation, unique value props, trust signals',
        'strategic_weight': 0.24  # 10 queries, 24% of total
    },
    'comparison': {
        'stage': 'Competitive Comparison',
        'funnel_stage': 'consideration',
        'mindset': 'Users comparing specific solutions head-to-head (60-70% of B2B deals won/lost here)',
        'focus': 'Competitive advantages, feature comparisons, ROI evidence, win/loss factors',
        'strategic_weight': 0.29  # 12 queries, 29% of total - HIGHEST PRIORITY
    },
    'purchase': {
        'stage': 'Purchase Decision',
        'funnel_stage': 'decision',
        'mindset': 'Users ready to buy, seeking final validation and conversion signals',
        'focus': 'Conversion triggers, pricing clarity, risk mitigation, onboarding confidence',
        'strategic_weight': 0.14  # 6 queries, 14% of total
    }
}


# =====================================================
# Strategic Intelligence Aggregator
# =====================================================

class StrategicIntelligenceAggregator:
    """
    Implements Layers 1, 2, 3 for world-class strategic insights.

    Total: 15 LLM calls
    - Layer 1: 15 calls (5 phases × 3 types)
    - Layer 2: 3 calls (3 types)
    - Layer 3: 1 call (executive summary)

    5-Phase Framework: Discovery → Research → Evaluation → Comparison (29% focus) → Purchase
    """

    def __init__(self, openai_api_key: str, model: str = "gpt-5-nano"):
        self.client = openai.AsyncOpenAI(api_key=openai_api_key)
        self.model = model

        logger.info(f"✅ Strategic Intelligence Aggregator initialized with model: {model}")

    def _parse_json_response(self, content: str) -> Optional[Dict]:
        """
        Robust JSON parser that handles various response formats.

        Supports:
        - Pure JSON
        - Markdown code blocks (```json ... ```)
        - Leading/trailing whitespace and artifacts
        """
        if not content:
            return None

        # Strip whitespace
        content = content.strip()

        # Try direct parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block
        if "```json" in content:
            try:
                start = content.index("```json") + 7
                end = content.index("```", start)
                json_str = content[start:end].strip()
                return json.loads(json_str)
            except (ValueError, json.JSONDecodeError):
                pass

        # Try extracting from generic code block
        if "```" in content:
            try:
                start = content.index("```") + 3
                end = content.index("```", start)
                json_str = content[start:end].strip()
                return json.loads(json_str)
            except (ValueError, json.JSONDecodeError):
                pass

        # Try finding JSON object boundaries
        try:
            start = content.index("{")
            # Find matching closing brace
            depth = 0
            for i in range(start, len(content)):
                if content[i] == "{":
                    depth += 1
                elif content[i] == "}":
                    depth -= 1
                    if depth == 0:
                        json_str = content[start:i+1]
                        return json.loads(json_str)
        except (ValueError, json.JSONDecodeError):
            pass

        logger.error(f"Failed to parse JSON. First 200 chars: {content[:200]}")
        return None

    # =====================================================
    # LAYER 1: Per-Category Aggregation (18 Calls)
    # =====================================================

    async def aggregate_by_category(
        self,
        raw_insights: Dict[str, List[Dict]],
        company_context: CompanyContext,
        persona_context: PersonaContext
    ) -> Dict[str, Dict[str, List[Dict]]]:
        """
        Layer 1: Aggregate items → 3 personalized items per type per phase.

        For each of 5 phases:
        - Input: Variable recs + gaps + opps (based on phase query count)
        - Make 3 parallel LLM calls
        - Output: 3 recs + 3 gaps + 3 opps (personalized)

        Total: 5 phases × 3 calls = 15 LLM calls

        Args:
            raw_insights: Dict[phase] -> List[batch_insights]
            company_context: Company profile
            persona_context: Decision-maker profile

        Returns:
            Dict[phase] -> Dict[type] -> List[3 personalized items]
        """

        logger.info("🎯 LAYER 1: Starting per-phase aggregation (15 LLM calls)")
        start_time = datetime.now()

        phase_insights = {}

        for phase, batch_insights in raw_insights.items():
            logger.info(f"   Processing phase: {phase}")

            # Collect all items from 4 batches
            all_recommendations = []
            all_gaps = []
            all_opportunities = []

            for batch in batch_insights:
                all_recommendations.extend(batch.get('recommendations', []))
                all_gaps.extend(batch.get('competitive_gaps', []))
                all_opportunities.extend(batch.get('content_opportunities', []))

            logger.info(
                f"     Input: {len(all_recommendations)} recs, "
                f"{len(all_gaps)} gaps, {len(all_opportunities)} opps"
            )

            # Make 3 parallel aggregation calls
            tasks = [
                self._aggregate_with_personalization(
                    all_recommendations, phase, 'recommendations',
                    company_context, persona_context, top_n=3
                ),
                self._aggregate_with_personalization(
                    all_gaps, phase, 'competitive_gaps',
                    company_context, persona_context, top_n=3
                ),
                self._aggregate_with_personalization(
                    all_opportunities, phase, 'content_opportunities',
                    company_context, persona_context, top_n=3
                )
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            phase_insights[phase] = {
                'recommendations': results[0] if not isinstance(results[0], Exception) else [],
                'competitive_gaps': results[1] if not isinstance(results[1], Exception) else [],
                'content_opportunities': results[2] if not isinstance(results[2], Exception) else []
            }

            logger.info(
                f"     ✅ Output: {len(phase_insights[phase]['recommendations'])} recs, "
                f"{len(phase_insights[phase]['competitive_gaps'])} gaps, "
                f"{len(phase_insights[phase]['content_opportunities'])} opps"
            )

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"✅ LAYER 1 COMPLETE: 15 LLM calls in {elapsed:.1f}s")

        return phase_insights

    async def _aggregate_with_personalization(
        self,
        items: List[Dict],
        phase: str,
        extraction_type: str,
        company_context: CompanyContext,
        persona_context: PersonaContext,
        top_n: int = 3
    ) -> List[Dict]:
        """
        Consolidate items → top 3 with company-specific personalization.

        Makes 1 LLM call to:
        1. Deduplicate and merge similar items
        2. Rank by business impact for THIS specific company
        3. Add company-specific context
        4. Return top N items
        """

        if not items or len(items) == 0:
            logger.warning(f"No items to aggregate for {phase} {extraction_type}")
            return []

        # Build personalized prompt
        prompt = self._build_layer1_prompt(
            items, phase, extraction_type,
            company_context, persona_context, top_n
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a strategic advisor for {company_context.company_name}. Return ONLY valid JSON with no markdown formatting, explanations, or additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Get response content with robust parsing
            content = response.choices[0].message.content

            # Debug logging
            logger.debug(f"Raw response length: {len(content) if content else 0} chars")

            if not content or content.strip() == "":
                logger.error(f"Empty response from LLM for {category}/{extraction_type}")
                return []

            # Parse with fallback
            result = self._parse_json_response(content)
            if not result:
                logger.error(f"Failed to parse JSON for {phase}/{extraction_type}")
                return []

            consolidated = result.get(extraction_type, [])[:top_n]

            logger.info(f"       {phase}/{extraction_type}: {len(items)} → {len(consolidated)} items")
            return consolidated

        except Exception as e:
            logger.error(f"Error in Layer 1 aggregation for {phase} {extraction_type}: {e}")
            return []

    def _build_layer1_prompt(
        self,
        items: List[Dict],
        phase: str,
        extraction_type: str,
        company_context: CompanyContext,
        persona_context: PersonaContext,
        top_n: int
    ) -> str:
        """Build personalized aggregation prompt for Layer 1"""

        phase_info = CATEGORY_MAPPING.get(phase, {})
        competitor_str = ', '.join(company_context.main_competitors[:3]) if company_context.main_competitors else 'competitors'

        return f"""You have {len(items)} {extraction_type.replace('_', ' ')} for the "{phase}" buyer journey phase ({phase_info.get('stage', phase)}) for {company_context.company_name}.

COMPANY CONTEXT:
- Name: {company_context.company_name}
- Size: {company_context.company_size} ({company_context.employee_count or 'unknown'} employees)
- Industry: {company_context.industry}
- Stage: {company_context.growth_stage}
- Revenue: {company_context.annual_revenue_range or 'not specified'}
- Business Model: {company_context.business_model}
- Main Competitors: {competitor_str}

DECISION MAKER:
- Role: {persona_context.primary_persona}
- Level: {persona_context.decision_level}
- Top Priorities: {', '.join(persona_context.priorities[:3])}
- Key KPIs: {', '.join(persona_context.kpis[:3])}
- Budget Authority: {persona_context.budget_authority}
- Resources: {persona_context.resource_availability}
- Risk Tolerance: {persona_context.risk_tolerance}

BUYER JOURNEY CONTEXT:
- Phase: {phase_info.get('stage', phase)}
- User Mindset: {phase_info.get('mindset', '')}
- Strategic Focus: {phase_info.get('focus', '')}
- Strategic Weight: {phase_info.get('strategic_weight', 0)*100:.0f}% of total query focus

ALL ITEMS FROM BATCHES:
{json.dumps(items[:30], indent=2)}
{"... (truncated)" if len(items) > 30 else ""}

TASK:
1. **Merge Duplicates**: Combine similar items into superior versions
2. **Company-Specific Ranking**: Prioritize based on {company_context.company_name}'s specific situation
3. **Personalize**: Add implementation details realistic for {company_context.company_size} company with {persona_context.resource_availability} resources
4. **Select Top {top_n}**: Return only the most impactful items

Consider:
- What can they execute with {persona_context.budget_authority} budget?
- What aligns with {persona_context.primary_persona}'s priorities?
- What gives advantage vs {company_context.main_competitors[0] if company_context.main_competitors else 'competitors'}?
- What fits their {company_context.growth_stage} stage?

Return JSON with top {top_n} personalized items:
{{
  "{extraction_type}": [
    {{
      "title": "Specific, actionable headline",
      "description": "Why this matters for {company_context.company_name}",
      "category": "Content Strategy | Technical | Business | Competitive",
      "priority": 1-10,
      "impact": "Low|Medium|High|Critical",
      "difficulty": "Easy|Moderate|Hard|Complex",
      "timeline": "Specific realistic timeline",
      "buyer_journey_context": "{phase}",
      "implementation": {{
        "budget": "Range in their budget authority",
        "team": "Team size they have",
        "resources": ["What they need"],
        "dependencies": ["Realistic dependencies"]
      }},
      "expected_roi": "Specific to their business",
      "success_metrics": ["Their actual KPIs"],
      "quick_wins": ["Actions they can take this week"],
      "risk_assessment": "Risks for their {persona_context.risk_tolerance} tolerance",
      "competitive_advantage": "How this beats {competitor_str}",
      "persona_message": "Why {persona_context.primary_persona} should champion this"
    }}
  ]
}}

Return EXACTLY {top_n} items. Quality over quantity.

CRITICAL: Return ONLY the JSON object above. No explanations, no markdown, no additional text before or after the JSON."""

    # =====================================================
    # LAYER 2: Strategic Prioritization (3 Calls)
    # =====================================================

    async def create_strategic_priorities(
        self,
        category_insights: Dict[str, Dict[str, List[Dict]]],
        company_context: CompanyContext,
        persona_context: PersonaContext,
        overall_metrics: Dict[str, Any]
    ) -> Dict[str, List[Dict]]:
        """
        Layer 2: Select top 3-5 items across all phases.

        Input: 15 recs + 15 gaps + 15 opps (3 per phase × 5 phases)
        Make 3 parallel LLM calls (one per type)
        Output: 3-5 recs + 3-5 gaps + 3-5 opps (final strategic priorities)

        Total: 3 LLM calls

        Returns:
            Dict with 'recommendations', 'competitive_gaps', 'content_opportunities'
        """

        logger.info("🎯 LAYER 2: Starting strategic prioritization (3 LLM calls)")
        start_time = datetime.now()

        # Make 3 parallel calls
        tasks = [
            self._select_strategic_priorities(
                category_insights, 'recommendations',
                company_context, persona_context, overall_metrics
            ),
            self._select_strategic_priorities(
                category_insights, 'competitive_gaps',
                company_context, persona_context, overall_metrics
            ),
            self._select_strategic_priorities(
                category_insights, 'content_opportunities',
                company_context, persona_context, overall_metrics
            )
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        priorities = {
            'recommendations': results[0] if not isinstance(results[0], Exception) else [],
            'competitive_gaps': results[1] if not isinstance(results[1], Exception) else [],
            'content_opportunities': results[2] if not isinstance(results[2], Exception) else []
        }

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"✅ LAYER 2 COMPLETE: 3 LLM calls in {elapsed:.1f}s - "
            f"{len(priorities['recommendations'])} recs, "
            f"{len(priorities['competitive_gaps'])} gaps, "
            f"{len(priorities['content_opportunities'])} opps"
        )

        return priorities

    async def _select_strategic_priorities(
        self,
        phase_insights: Dict[str, Dict[str, List[Dict]]],
        extraction_type: str,
        company_context: CompanyContext,
        persona_context: PersonaContext,
        overall_metrics: Dict[str, Any]
    ) -> List[Dict]:
        """
        Select top 3-5 items from all 15 phase-level items.

        Cross-phase pattern recognition with company-specific ROI calculations.
        """

        # Collect all items with phase context
        all_items = []
        for phase, insights in phase_insights.items():
            for item in insights.get(extraction_type, []):
                item_copy = item.copy()
                item_copy['source_phase'] = phase
                item_copy['funnel_stage'] = CATEGORY_MAPPING.get(phase, {}).get('funnel_stage', 'consideration')
                all_items.append(item_copy)

        if not all_items:
            logger.warning(f"No items for Layer 2 {extraction_type}")
            return []

        # Build strategic prioritization prompt
        prompt = self._build_layer2_prompt(
            all_items, extraction_type,
            company_context, persona_context, overall_metrics
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"You are the trusted strategic advisor to {persona_context.primary_persona} at {company_context.company_name}. Return ONLY valid JSON with no markdown formatting, explanations, or additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Get response content with robust parsing
            content = response.choices[0].message.content

            logger.debug(f"Layer 2 response length: {len(content) if content else 0} chars")

            if not content or content.strip() == "":
                logger.error(f"Empty response from LLM for Layer 2 {extraction_type}")
                return []

            # Parse with fallback
            result = self._parse_json_response(content)
            if not result:
                logger.error(f"Failed to parse JSON for Layer 2 {extraction_type}")
                return []

            priorities = result.get(extraction_type, [])

            logger.info(f"   {extraction_type}: {len(all_items)} → {len(priorities)} strategic priorities")
            return priorities

        except Exception as e:
            logger.error(f"Error in Layer 2 for {extraction_type}: {e}")
            return []

    def _build_layer2_prompt(
        self,
        items: List[Dict],
        extraction_type: str,
        company_context: CompanyContext,
        persona_context: PersonaContext,
        overall_metrics: Dict[str, Any]
    ) -> str:
        """Build strategic prioritization prompt for Layer 2"""

        competitor_str = ', '.join(company_context.main_competitors[:5]) if company_context.main_competitors else 'market competitors'

        return f"""Select the top 3-5 strategic {extraction_type.replace('_', ' ')} for {company_context.company_name} from across all buyer journey stages.

COMPANY PROFILE:
- Name: {company_context.company_name}
- Size: {company_context.company_size} ({company_context.employee_count or 'unknown'} employees)
- Industry: {company_context.industry}
- Stage: {company_context.growth_stage}
- Revenue: {company_context.annual_revenue_range or 'not specified'}
- Business Model: {company_context.business_model}
- Main Competitors: {competitor_str}

DECISION MAKER:
- Role: {persona_context.primary_persona}
- Level: {persona_context.decision_level}
- Key Priorities: {', '.join(persona_context.priorities)}
- KPIs: {', '.join(persona_context.kpis)}
- Budget Authority: {persona_context.budget_authority}
- Risk Tolerance: {persona_context.risk_tolerance}

CURRENT AUDIT RESULTS:
- Overall AI Visibility Score: {overall_metrics.get('overall_score', 0):.1f}/100
- Brand Mention Rate: {overall_metrics.get('visibility', 0):.1f}%
- Sentiment Score: {overall_metrics.get('sentiment', 0):.1f}/100
- GEO Score: {overall_metrics.get('geo', 0):.1f}/100
- SOV Score: {overall_metrics.get('sov', 0):.1f}/100

ALL PHASE-LEVEL {extraction_type.upper().replace('_', ' ')} (15 items):
{json.dumps(items, indent=2)[:5000]}

SELECTION CRITERIA:
1. **Maximum Business Impact**: What drives most revenue/pipeline for {company_context.company_name}?
2. **Feasibility**: Realistic with {persona_context.resource_availability} resources and {persona_context.budget_authority} budget?
3. **Urgency**: What matters most RIGHT NOW for {company_context.growth_stage} stage?
4. **Strategic Fit**: Aligns with {persona_context.primary_persona}'s priorities?
5. **Cross-Phase Synergy**: Unlocks multiple buyer journey phases?
6. **Competitive Advantage**: Gives decisive advantage vs {company_context.main_competitors[0] if company_context.main_competitors else 'competitors'}?

Return JSON with 3-5 items (lean toward 3 for focus):
{{
  "{extraction_type}": [
    {{
      "rank": 1,
      "title": "Compelling headline",
      "executive_pitch": "2-sentence board pitch",
      "strategic_rationale": "Why THIS is THE priority",
      "source_phases": ["comparison", "purchase"],
      "funnel_stages_impacted": ["consideration", "decision"],
      "business_impact": {{
        "pipeline_impact": "Specific $ or %",
        "revenue_impact": "Expected contribution",
        "timeframe": "When they'll see results",
        "confidence": "High|Medium"
      }},
      "implementation": {{
        "budget": "Realistic amount",
        "timeline": "Feasible timeline",
        "team_required": "Based on their size",
        "external_support": "What help needed",
        "dependencies": ["Prerequisites"],
        "risks": ["Honest risks"]
      }},
      "expected_roi": {{
        "investment": "Total cost",
        "return": "Expected benefit",
        "payback_period": "When breaks even",
        "calculation": "How calculated"
      }},
      "quick_wins": ["Action THIS WEEK", "Result in 30 days"],
      "success_metrics": ["How to measure", "Tied to their KPIs"],
      "competitive_positioning": "How this beats {competitor_str}",
      "persona_message": "Why {persona_context.primary_persona} should champion this"
    }}
  ]
}}

Return 3-5 items. These define success for next 6-12 months.

CRITICAL: Return ONLY the JSON object above. No explanations, no markdown, no additional text before or after the JSON."""

    # =====================================================
    # LAYER 3: Executive Summary (1 Call)
    # =====================================================

    async def generate_executive_summary(
        self,
        strategic_priorities: Dict[str, List[Dict]],
        category_insights: Dict[str, Dict[str, List[Dict]]],
        company_context: CompanyContext,
        persona_context: PersonaContext,
        overall_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Layer 3: Create C-suite executive brief.

        Makes 1 LLM call to synthesize everything into board-ready summary.

        Total: 1 LLM call
        """

        logger.info("🎯 LAYER 3: Generating executive summary (1 LLM call)")
        start_time = datetime.now()

        # Calculate category-level scores
        category_scores = self._calculate_category_scores(overall_metrics)

        # Build comprehensive prompt
        prompt = self._build_layer3_prompt(
            strategic_priorities, category_scores,
            company_context, persona_context, overall_metrics
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"You are writing an executive summary for {persona_context.primary_persona} at {company_context.company_name}. Return ONLY valid JSON with no markdown formatting, explanations, or additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Get response content with robust parsing
            content = response.choices[0].message.content

            logger.debug(f"Layer 3 response length: {len(content) if content else 0} chars")

            if not content or content.strip() == "":
                logger.error(f"Empty response from LLM for Layer 3 executive summary")
                return {}

            # Parse with fallback
            result = self._parse_json_response(content)
            if not result:
                logger.error(f"Failed to parse JSON for Layer 3 executive summary")
                return {}

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ LAYER 3 COMPLETE: 1 LLM call in {elapsed:.1f}s")

            return result

        except Exception as e:
            logger.error(f"Error generating executive summary: {e}")
            return {}

    def _build_layer3_prompt(
        self,
        strategic_priorities: Dict[str, List[Dict]],
        category_scores: Dict[str, float],
        company_context: CompanyContext,
        persona_context: PersonaContext,
        overall_metrics: Dict[str, Any]
    ) -> str:
        """Build executive summary prompt for Layer 3"""

        competitor_str = ', '.join(company_context.main_competitors[:3]) if company_context.main_competitors else 'market competitors'

        return f"""Create an executive summary for {persona_context.primary_persona} at {company_context.company_name} based on their AI visibility audit.

WRITE FOR:
- Reader: {persona_context.primary_persona} ({persona_context.decision_level})
- Company: {company_context.company_name} ({company_context.company_size}, {company_context.growth_stage})
- Communication Style: {persona_context.detail_level} detail, {persona_context.risk_tolerance} risk tolerance

AUDIT RESULTS:
- Overall Score: {overall_metrics.get('overall_score', 0):.1f}/100
- Brand Visibility: {overall_metrics.get('visibility', 0):.1f}%
- Sentiment: {overall_metrics.get('sentiment', 0):.1f}/100
- GEO Score: {overall_metrics.get('geo', 0):.1f}/100
- SOV Score: {overall_metrics.get('sov', 0):.1f}/100

BUYER JOURNEY PERFORMANCE:
{json.dumps(category_scores, indent=2)}

STRATEGIC PRIORITIES (Already Personalized):
Recommendations: {len(strategic_priorities.get('recommendations', []))} items
Competitive Gaps: {len(strategic_priorities.get('competitive_gaps', []))} items
Content Opportunities: {len(strategic_priorities.get('content_opportunities', []))} items

{json.dumps(strategic_priorities, indent=2)[:3000]}

COMPETITIVE CONTEXT:
- Main Competitors: {competitor_str}

CREATE WORLD-CLASS EXECUTIVE SUMMARY:

1. Opening (2-3 sentences): Key insight that captures attention
2. Situation Assessment: Where they are vs where they need to be
3. Buyer Journey Breakdown: Performance at each stage
4. Strategic Priorities: 3-5 most important actions with ROI
5. Implementation Roadmap: Phased 30/90/180 day approach
6. Investment Thesis: Why this matters and costs
7. Competitive Implications: Act vs don't act
8. Expected Outcomes: Results at 30/90/365 days
9. Closing: Inspiring but realistic call to action

Return JSON:
{{
  "executive_brief": "Compelling 2-3 sentence opening",
  "situation_assessment": {{
    "current_state": "Where they stand (data-driven)",
    "competitive_position": "Ranking vs competitors",
    "strategic_gap": "Cost of inaction",
    "key_insight": "The one thing to know"
  }},
  "buyer_journey_performance": {{
    "awareness_stage": {{"score": 0-100, "diagnosis": "...", "impact": "...", "priority_action": "..."}},
    "consideration_stage": {{...}},
    "decision_stage": {{...}}
  }},
  "strategic_priorities": [
    {{
      "priority": "Top priority with context",
      "why_now": "Urgency driver",
      "business_impact": "Revenue/pipeline impact",
      "investment": "Cost",
      "timeline": "When results",
      "confidence": "High|Medium"
    }}
  ],
  "implementation_roadmap": {{
    "phase_1_30_days": ["Quick wins"],
    "phase_2_90_days": ["Core initiatives"],
    "phase_3_6_months": ["Transformation"],
    "success_milestones": ["How to measure"]
  }},
  "investment_thesis": "Total investment and return",
  "competitive_implications": {{"if_act": "...", "if_delay": "...", "window": "..."}},
  "expected_outcomes": {{"30_days": "...", "90_days": "...", "12_months": "...", "roi_confidence": "High|Medium"}},
  "success_metrics": ["KPIs to track"],
  "closing_message": "Inspiring but realistic"
}}

TONE: Professional, data-driven, honest, inspiring, specific to {company_context.company_name}.

CRITICAL: Return ONLY the JSON object above. No explanations, no markdown, no additional text before or after the JSON."""

    def _calculate_category_scores(self, overall_metrics: Dict[str, Any]) -> Dict[str, float]:
        """Calculate per-category scores from overall metrics"""

        # In production, this would aggregate from response-level data
        # For now, approximate based on overall score
        base_score = overall_metrics.get('overall_score', 50)

        return {
            'awareness': base_score * 0.8,  # Usually weakest
            'consideration': base_score * 1.0,  # Typically average
            'decision': base_score * 1.2  # Usually strongest
        }
