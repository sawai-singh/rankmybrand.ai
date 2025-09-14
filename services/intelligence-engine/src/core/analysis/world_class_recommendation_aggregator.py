"""
World-Class Context-Aware Recommendation Aggregator
Hyper-personalized strategic recommendations based on deep company context
Designed by master strategists for Fortune 500 decision-making
"""

import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
from openai import AsyncOpenAI
import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


@dataclass
class CompanyContext:
    """Rich company context for personalization"""
    # Basic info
    company_name: str
    domain: str
    industry: str
    sub_industry: str
    company_size: str  # "startup", "smb", "midmarket", "enterprise"
    
    # Business model
    business_model: str  # "B2B", "B2C", "B2B2C", "Marketplace"
    target_customers: List[str]  # ["Fortune 500", "SMBs", "Consumers"]
    revenue_model: str  # "SaaS", "Transactional", "Subscription", "Services"
    
    # Market position
    market_position: str  # "Leader", "Challenger", "Follower", "Niche"
    funding_stage: str  # "Bootstrapped", "Series A", "Series B+", "Public"
    growth_stage: str  # "Early", "Growth", "Scale", "Mature"
    
    # Enrichment data
    annual_revenue: Optional[str]  # "$10M-50M"
    employee_count: Optional[int]
    headquarters: Optional[str]
    founding_year: Optional[int]
    
    # Product/Service
    core_offerings: List[str]
    value_proposition: str
    key_differentiators: List[str]
    
    # Competitive landscape
    main_competitors: List[str]
    competitive_advantages: List[str]
    market_challenges: List[str]
    
    # Digital presence
    tech_stack: List[str]
    marketing_channels: List[str]
    content_strategy: str
    
    # Leadership & Culture
    leadership_team: Dict[str, str]  # {"CEO": "Name", "CMO": "Name"}
    company_values: List[str]
    innovation_focus: str  # "High", "Medium", "Low"
    
    # Goals & Priorities
    strategic_goals: List[str]
    current_initiatives: List[str]
    pain_points: List[str]
    success_metrics: List[str]


@dataclass
class PersonaContext:
    """Who will be reading and implementing these recommendations"""
    primary_persona: str  # "CEO", "CMO", "VP Marketing", "Director of Growth"
    decision_level: str  # "C-Suite", "VP", "Director", "Manager"
    
    # Persona characteristics
    priorities: List[str]  # ["Revenue growth", "Market share", "Brand awareness"]
    kpis: List[str]  # ["ARR", "CAC", "LTV", "NPS"]
    budget_authority: str  # "$10K", "$100K", "$1M+"
    team_size: int
    
    # Communication preferences
    detail_level: str  # "Executive", "Strategic", "Tactical", "Technical"
    data_orientation: str  # "High", "Medium", "Low"
    risk_tolerance: str  # "Conservative", "Moderate", "Aggressive"
    
    # Implementation capacity
    technical_sophistication: str  # "High", "Medium", "Low"
    change_readiness: str  # "High", "Medium", "Low"
    resource_availability: str  # "Abundant", "Adequate", "Limited"


@dataclass
class HyperPersonalizedRecommendation:
    """Ultra-targeted recommendation with deep context"""
    recommendation_id: str
    
    # Core recommendation
    headline: str  # Persona-specific headline
    executive_pitch: str  # 2-sentence pitch in their language
    strategic_rationale: str  # Why this matters for THIS company specifically
    
    # Personalized framing
    persona_hook: str  # Why the reader personally should care
    company_specific_opportunity: str  # Unique to their situation
    competitive_context: str  # How this positions vs their specific competitors
    
    # Implementation for their context
    implementation_approach: str  # Tailored to their resources/capabilities
    resource_requirements: Dict[str, Any]  # Specific to their size/stage
    timeline: str  # Realistic for their capacity
    
    # Success metrics in their language
    success_metrics: List[Dict[str, str]]  # Their KPIs
    expected_impact: Dict[str, str]  # On their specific goals
    roi_calculation: str  # In their financial terms
    
    # Risk mitigation for their context
    specific_risks: List[Dict[str, str]]  # Their unique risks
    mitigation_strategies: List[str]  # For their risk tolerance
    
    # Supporting evidence
    similar_company_success: str  # "Company X in your industry saw..."
    market_timing_rationale: str  # Why now for them specifically
    
    # Priority and urgency
    priority_score: float
    urgency_driver: str  # What makes this urgent for THEM
    opportunity_window: str  # Their specific timing
    
    # Dependencies and synergies
    builds_on: List[str]  # Their existing initiatives
    enables: List[str]  # Future opportunities
    
    # Call to action
    next_steps: List[str]  # Specific, actionable, achievable
    quick_wins: List[str]  # Things they can do THIS WEEK
    decision_required: str  # What they need to decide


class WorldClassRecommendationAggregator:
    """
    The pinnacle of recommendation systems - hyper-personalized, context-aware,
    strategically brilliant recommendations that feel like they were written by
    their most trusted advisor who knows everything about their business.
    """
    
    def __init__(
        self, 
        openai_api_key: str,
        db_config: Dict[str, Any],
        model: str = "gpt-5-chat-latest"
    ):
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        self.db_config = db_config
    
    async def create_world_class_recommendations(
        self,
        audit_id: str,
        company_id: int,
        all_recommendations: List[Dict[str, Any]]
    ) -> Tuple[List[HyperPersonalizedRecommendation], Dict[str, Any]]:
        """
        Create truly world-class recommendations with deep personalization
        """
        
        logger.info(f"Creating world-class recommendations for company {company_id}")
        
        # Step 1: Gather complete company context
        company_context = await self._gather_company_context(company_id)
        
        # Step 2: Determine persona and reading context
        persona_context = await self._determine_persona_context(company_context)
        
        # Step 3: Analyze company's unique situation
        situation_analysis = await self._analyze_unique_situation(
            company_context, all_recommendations
        )
        
        # Step 4: Generate hyper-personalized recommendations
        personalized_recs = await self._generate_personalized_recommendations(
            all_recommendations,
            company_context,
            persona_context,
            situation_analysis
        )
        
        # Step 5: Create executive narrative in their voice
        executive_package = await self._create_executive_package(
            personalized_recs,
            company_context,
            persona_context
        )
        
        return personalized_recs[:10], executive_package
    
    async def _gather_company_context(self, company_id: int) -> CompanyContext:
        """
        Gather all available context about the company from database and enrichment
        """
        
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get basic company data (without enrichment table for now)
            cursor.execute("""
                SELECT 
                    name,
                    domain,
                    industry,
                    employee_count,
                    COALESCE(headquarters_city, 'Boston') as headquarters,
                    founded_year
                FROM companies
                WHERE id = %s
            """, (company_id,))
            
            company_data = cursor.fetchone() or {}
            
            # Get audit history for patterns (simplified for now)
            cursor.execute("""
                SELECT COUNT(*) as audit_count
                FROM ai_visibility_audits
                WHERE company_id = %s
            """, (company_id,))
            
            audit_history = cursor.fetchone() or {'audit_count': 1}
            
            # Get user data to understand who's using this (simplified)
            cursor.execute("""
                SELECT first_name, last_name, email
                FROM users
                WHERE company_id = %s
                LIMIT 5
            """, (company_id,))
            
            user_data = cursor.fetchall() or []
            
        finally:
            cursor.close()
            conn.close()
        
        # Parse and structure the context from actual data
        # Extract competitors from AI responses if not in company data
        main_competitors = []
        if audit_history and 'all_competitors' in audit_history:
            main_competitors = audit_history.get('all_competitors', [])
        
        # Determine company size
        employee_count = company_data.get('employee_count')
        if employee_count is None:
            employee_count = 0  # Will be categorized as startup
        
        # Build context from actual data only
        return CompanyContext(
            company_name=company_data.get('name', ''),
            domain=company_data.get('domain', ''),
            industry=company_data.get('industry', 'General'),
            sub_industry=company_data.get('sub_industry', company_data.get('industry', 'General')),
            company_size=self._determine_company_size(employee_count),
            business_model='B2B',  # Most companies using this tool are B2B
            target_customers=[],  # Will be inferred from analysis
            revenue_model='Services',  # Default, can be enhanced later
            market_position=self._determine_market_position(company_data),
            funding_stage='Unknown',
            growth_stage=self._determine_growth_stage(company_data),
            annual_revenue=None,
            employee_count=employee_count,
            headquarters=company_data.get('headquarters', ''),
            founding_year=company_data.get('founded_year'),
            core_offerings=[],  # Will be extracted from responses
            value_proposition='',  # Will be inferred
            key_differentiators=[],  # Will be extracted
            main_competitors=main_competitors[:5] if main_competitors else [],
            competitive_advantages=[],
            market_challenges=[],
            tech_stack=[],
            marketing_channels=[],
            content_strategy='',
            leadership_team=self._parse_leadership(user_data),
            company_values=[],
            innovation_focus='Medium',
            strategic_goals=[],
            current_initiatives=[],
            pain_points=[],
            success_metrics=[]
        )
    
    def _determine_company_size(self, employee_count: int) -> str:
        """Categorize company size with safe handling"""
        try:
            count = int(employee_count) if employee_count else 0
        except (ValueError, TypeError):
            return "unknown"
            
        if count == 0:
            return "unknown"
        elif count < 50:
            return "startup"
        elif count < 250:
            return "smb"
        elif count < 1000:
            return "midmarket"
        else:
            return "enterprise"
    
    def _determine_market_position(self, data: Dict) -> str:
        """Determine market position from data with safe handling"""
        try:
            employee_count = int(data.get('employee_count') or 0)
        except (ValueError, TypeError):
            employee_count = 0
            
        if employee_count > 5000:
            return "Leader"
        elif employee_count > 1000:
            return "Challenger"
        elif employee_count > 100:
            return "Follower"
        else:
            return "Emerging"
    
    def _determine_growth_stage(self, data: Dict) -> str:
        """Determine growth stage with safe handling"""
        founding = data.get('founding_year') or data.get('founded_year')
        if not founding:
            return "Unknown"
        
        try:
            founding_year = int(founding)
            years = datetime.now().year - founding_year
        except (ValueError, TypeError):
            return "Unknown"
        if years < 2:
            return "Early"
        elif years < 5:
            return "Growth"
        elif years < 10:
            return "Scale"
        else:
            return "Mature"
    
    def _parse_leadership(self, user_data: List[Dict]) -> Dict[str, str]:
        """Extract leadership team from user data"""
        # For now, return default leadership for consulting firm
        return {
            'CEO': 'Executive',
            'CMO': 'Marketing', 
            'COO': 'Operations'
        }
    
    async def _determine_persona_context(
        self,
        company_context: CompanyContext
    ) -> PersonaContext:
        """
        Determine who will be reading these recommendations and their context
        """
        
        # Use LLM to intelligently determine persona based on company context
        prompt = f"""Given this company context, determine the primary persona who would be reading AI visibility recommendations:

Company: {company_context.company_name}
Industry: {company_context.industry}
Size: {company_context.company_size} ({company_context.employee_count} employees)
Stage: {company_context.growth_stage}
Business Model: {company_context.business_model}
Market Position: {company_context.market_position}

Determine:
1. Who is most likely reading this? (title/role)
2. What are their top 3 priorities?
3. What KPIs do they care about?
4. What's their budget authority?
5. How technical are they?
6. What's their risk tolerance?

Return JSON:
{{
  "primary_persona": "Title",
  "decision_level": "C-Suite|VP|Director",
  "priorities": ["Priority 1", "Priority 2", "Priority 3"],
  "kpis": ["KPI 1", "KPI 2", "KPI 3"],
  "budget_authority": "$amount",
  "team_size": number,
  "detail_level": "Executive|Strategic|Tactical",
  "data_orientation": "High|Medium|Low",
  "risk_tolerance": "Conservative|Moderate|Aggressive",
  "technical_sophistication": "High|Medium|Low",
  "change_readiness": "High|Medium|Low",
  "resource_availability": "Abundant|Adequate|Limited"
}}"""
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        persona_data = json.loads(response.choices[0].message.content)
        
        return PersonaContext(
            primary_persona=persona_data.get('primary_persona', 'CMO'),
            decision_level=persona_data.get('decision_level', 'VP'),
            priorities=persona_data.get('priorities', []),
            kpis=persona_data.get('kpis', []),
            budget_authority=persona_data.get('budget_authority', '$100K'),
            team_size=persona_data.get('team_size', 5),
            detail_level=persona_data.get('detail_level', 'Strategic'),
            data_orientation=persona_data.get('data_orientation', 'Medium'),
            risk_tolerance=persona_data.get('risk_tolerance', 'Moderate'),
            technical_sophistication=persona_data.get('technical_sophistication', 'Medium'),
            change_readiness=persona_data.get('change_readiness', 'Medium'),
            resource_availability=persona_data.get('resource_availability', 'Adequate')
        )
    
    async def _analyze_unique_situation(
        self,
        company_context: CompanyContext,
        recommendations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Deeply analyze the company's unique situation to inform recommendations
        """
        
        prompt = f"""You are McKinsey's senior partner analyzing {company_context.company_name}'s unique situation.

COMPANY CONTEXT:
- Industry: {company_context.industry} / {company_context.sub_industry}
- Size: {company_context.company_size} ({company_context.employee_count} employees)
- Revenue: {company_context.annual_revenue}
- Stage: {company_context.growth_stage} / {company_context.funding_stage}
- Market Position: {company_context.market_position}
- Business Model: {company_context.business_model} targeting {', '.join(company_context.target_customers)}
- Value Prop: {company_context.value_proposition}
- Main Competitors: {', '.join(company_context.main_competitors[:5])}
- Pain Points: {', '.join(company_context.pain_points[:5])}
- Strategic Goals: {', '.join(company_context.strategic_goals[:5])}

AI VISIBILITY PATTERNS (from {len(recommendations)} recommendations):
{json.dumps(recommendations[:20], indent=2)}

Provide a situation analysis that will inform hyper-personalized recommendations:

Return JSON:
{{
  "critical_insights": [
    "Insight 1 specific to their situation",
    "Insight 2",
    "Insight 3"
  ],
  "unique_opportunities": [
    {{"opportunity": "Description", "why_them": "Why this company specifically", "timing": "Why now"}}
  ],
  "specific_threats": [
    {{"threat": "Description", "impact": "Specific impact on them", "urgency": "Timeline"}}
  ],
  "competitive_dynamics": {{
    "where_theyre_winning": ["Area 1", "Area 2"],
    "where_theyre_losing": ["Area 1", "Area 2"],
    "flanking_opportunities": ["Opportunity to outmaneuver"]
  }},
  "resource_reality": {{
    "can_leverage": ["Existing strength 1", "Asset 2"],
    "must_build": ["Capability 1", "Resource 2"],
    "should_partner": ["Area where partnership makes sense"]
  }},
  "strategic_imperatives": [
    "The 3 things they MUST do to win"
  ],
  "quick_wins_available": [
    "Things they can do immediately with current resources"
  ],
  "transformation_potential": "What they could become with the right moves"
}}"""
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    async def _generate_personalized_recommendations(
        self,
        all_recommendations: List[Dict[str, Any]],
        company_context: CompanyContext,
        persona_context: PersonaContext,
        situation_analysis: Dict[str, Any]
    ) -> List[HyperPersonalizedRecommendation]:
        """
        Generate recommendations that feel like they were written specifically for this company
        """
        
        # Sample and summarize recommendations to avoid token limits
        sampled_recs = all_recommendations[:50] if len(all_recommendations) > 50 else all_recommendations
        
        prompt = f"""You are {company_context.company_name}'s most trusted strategic advisor, creating recommendations 
specifically for their {persona_context.primary_persona}.

DEEP CONTEXT:
Company: {company_context.company_name} - {company_context.value_proposition}
Reader: {persona_context.primary_persona} ({persona_context.decision_level})
Their Priorities: {', '.join(persona_context.priorities)}
Their KPIs: {', '.join(persona_context.kpis)}
Budget Authority: {persona_context.budget_authority}
Risk Tolerance: {persona_context.risk_tolerance}

KEY INSIGHTS:
- {', '.join(situation_analysis.get('critical_insights', [])[:3])}

RAW RECOMMENDATIONS SUMMARY:
Total: {len(all_recommendations)} recommendations from {len(set(r.get('provider', '') for r in all_recommendations))} providers
Top patterns from sample of {len(sampled_recs)} recommendations

Create 10 HYPER-PERSONALIZED recommendations that:
1. Speak directly to {persona_context.primary_persona}'s priorities
2. Use {company_context.company_name}'s specific context and language
3. Reference their actual competitors: {', '.join(company_context.main_competitors[:3])}
4. Build on their existing initiatives: {', '.join(company_context.current_initiatives[:3])}
5. Address their specific pain points: {', '.join(company_context.pain_points[:3])}
6. Align with their goals: {', '.join(company_context.strategic_goals[:3])}

For each recommendation, think:
- How would {persona_context.primary_persona} at {company_context.company_name} describe this to their team?
- What specific example from their industry/competitors makes this real?
- What can they do THIS WEEK with their current resources?
- How does this help them beat {company_context.main_competitors[0] if company_context.main_competitors else 'competitors'}?

Return JSON:
{{
  "recommendations": [
    {{
      "headline": "Headline written for {persona_context.primary_persona} at {company_context.company_name}",
      "executive_pitch": "2 sentences they'd use to pitch this internally",
      "strategic_rationale": "Why this matters for {company_context.company_name} SPECIFICALLY",
      "persona_hook": "Why {persona_context.primary_persona} personally should champion this",
      "company_specific_opportunity": "The unique opportunity for {company_context.company_name}",
      "competitive_context": "How this positions vs {', '.join(company_context.main_competitors[:2])}",
      "implementation_approach": "Approach tailored to their {company_context.company_size} size and {persona_context.resource_availability} resources",
      "resource_requirements": {{
        "budget": "In their terms",
        "team": "Based on their team size",
        "timeline": "Realistic for them",
        "external_support": "What they'd need"
      }},
      "success_metrics": [
        {{"metric": "Their KPI", "target": "Specific number", "timeline": "When"}}
      ],
      "expected_impact": {{
        "on_revenue": "Specific to their revenue level",
        "on_market_position": "How this changes their position",
        "on_brand": "Impact on their brand"
      }},
      "roi_calculation": "ROI in their financial language",
      "specific_risks": [
        {{"risk": "Their specific risk", "mitigation": "How they'd handle it"}}
      ],
      "similar_company_success": "Company like them that succeeded with this",
      "market_timing_rationale": "Why NOW for {company_context.company_name}",
      "priority_score": 95,
      "urgency_driver": "What makes this urgent for THEM",
      "opportunity_window": "Their specific deadline",
      "builds_on": ["Their existing initiative"],
      "enables": ["What this unlocks for them"],
      "next_steps": [
        "Step 1 they can take Monday",
        "Step 2 by end of week"
      ],
      "quick_wins": [
        "Thing they can do TODAY",
        "Result they'll see this week"
      ],
      "decision_required": "The specific decision {persona_context.primary_persona} needs to make"
    }}
  ]
}}"""
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=8000,  # Increased to handle 10 detailed recommendations
            response_format={"type": "json_object"}
        )
        
        recommendations_data = json.loads(response.choices[0].message.content)
        
        # Log how many recommendations we received
        recs_received = len(recommendations_data.get('recommendations', []))
        logger.info(f"Received {recs_received} recommendations from GPT (requested 10)")
        
        # If we got fewer than 10, log a warning
        if recs_received < 10:
            logger.warning(f"Only received {recs_received} recommendations, expected 10. May need to simplify prompt or increase tokens.")
        
        # Convert to HyperPersonalizedRecommendation objects
        personalized_recs = []
        for rec in recommendations_data.get('recommendations', []):
            personalized_recs.append(HyperPersonalizedRecommendation(
                recommendation_id=hashlib.md5(rec['headline'].encode()).hexdigest()[:8],
                headline=rec['headline'],
                executive_pitch=rec['executive_pitch'],
                strategic_rationale=rec['strategic_rationale'],
                persona_hook=rec['persona_hook'],
                company_specific_opportunity=rec['company_specific_opportunity'],
                competitive_context=rec['competitive_context'],
                implementation_approach=rec['implementation_approach'],
                resource_requirements=rec['resource_requirements'],
                timeline=rec['resource_requirements'].get('timeline', ''),
                success_metrics=rec['success_metrics'],
                expected_impact=rec['expected_impact'],
                roi_calculation=rec['roi_calculation'],
                specific_risks=rec['specific_risks'],
                mitigation_strategies=[r['mitigation'] for r in rec['specific_risks']],
                similar_company_success=rec['similar_company_success'],
                market_timing_rationale=rec['market_timing_rationale'],
                priority_score=rec['priority_score'],
                urgency_driver=rec['urgency_driver'],
                opportunity_window=rec['opportunity_window'],
                builds_on=rec['builds_on'],
                enables=rec['enables'],
                next_steps=rec['next_steps'],
                quick_wins=rec['quick_wins'],
                decision_required=rec['decision_required']
            ))
        
        return personalized_recs
    
    async def _create_executive_package(
        self,
        recommendations: List[HyperPersonalizedRecommendation],
        company_context: CompanyContext,
        persona_context: PersonaContext
    ) -> Dict[str, Any]:
        """
        Create an executive package that feels like it was written by their trusted advisor
        """
        
        top_5_summary = [
            {
                'headline': r.headline,
                'pitch': r.executive_pitch,
                'impact': r.expected_impact,
                'urgency': r.urgency_driver
            }
            for r in recommendations[:5]
        ]
        
        prompt = f"""Write an executive briefing for {persona_context.primary_persona} at {company_context.company_name}.

Make it feel like it's coming from someone who:
- Knows their business inside and out
- Understands their specific challenges with {', '.join(company_context.main_competitors[:2])}
- Speaks their language and knows their culture
- Has their best interests at heart

TOP 5 INITIATIVES:
{json.dumps(top_5_summary, indent=2)}

Write in the voice and style appropriate for:
- Company: {company_context.company_name} ({company_context.company_size}, {company_context.industry})
- Reader: {persona_context.primary_persona} ({persona_context.decision_level})
- Culture: {company_context.growth_stage} stage, {company_context.innovation_focus} innovation focus

Return JSON:
{{
  "executive_brief": "Opening that immediately resonates with {persona_context.primary_persona}",
  "personal_message": "A note that shows you understand their specific situation",
  "strategic_narrative": "The story of how these initiatives transform {company_context.company_name}",
  "why_now": "The urgency framed in their context",
  "competitive_implications": "What happens vs {company_context.main_competitors[0] if company_context.main_competitors else 'competitors'}",
  "expected_outcomes": {{
    "30_days": "What {persona_context.primary_persona} will see",
    "90_days": "Wins they can report",
    "1_year": "Transformation achieved"
  }},
  "investment_thesis": "Why this investment makes sense for {company_context.company_name}",
  "risk_assessment": "Honest assessment in their risk tolerance",
  "your_role": "What {persona_context.primary_persona} specifically needs to do",
  "support_available": "Resources and help they can access",
  "closing_thought": "Inspiring but realistic message for {company_context.company_name}"
}}"""
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)