"""
Advanced LLM-based Gap Detection System
Identifies content gaps, competitive blind spots, and strategic opportunities
Uses GPT-4 Turbo / GPT-5 Nano for intelligent gap analysis
"""

import json
import asyncio
import hashlib
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from enum import Enum
import redis
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from src.config import settings
import logging

logger = logging.getLogger(__name__)


class GapType(str, Enum):
    """Types of gaps that can be detected"""
    CONTENT_MISSING = "content_missing"
    FEATURE_GAP = "feature_gap"
    COMPETITIVE_DISADVANTAGE = "competitive_disadvantage"
    MARKET_OPPORTUNITY = "market_opportunity"
    KNOWLEDGE_GAP = "knowledge_gap"
    AUTHORITY_GAP = "authority_gap"
    TECHNICAL_GAP = "technical_gap"
    SERVICE_GAP = "service_gap"


class GapPriority(str, Enum):
    """Priority levels for addressing gaps"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ContentGap(BaseModel):
    """Detailed content gap analysis"""
    gap_type: GapType = Field(description="Type of gap identified")
    title: str = Field(description="Clear title describing the gap")
    description: str = Field(description="Detailed description of what's missing")
    
    missing_topics: List[str] = Field(
        default_factory=list,
        description="Specific topics not covered"
    )
    
    competitor_advantage: Optional[str] = Field(
        default=None,
        description="How competitors address this gap"
    )
    
    priority: GapPriority = Field(description="Priority level for addressing this gap")
    
    business_impact: str = Field(
        description="Impact on business if gap remains unaddressed"
    )
    
    estimated_effort: str = Field(
        description="Effort required to address (hours/days/weeks)"
    )
    
    recommended_action: str = Field(
        description="Specific action to close the gap"
    )
    
    content_suggestions: List[str] = Field(
        default_factory=list,
        description="Specific content pieces to create"
    )
    
    keywords_to_target: List[str] = Field(
        default_factory=list,
        description="Keywords to target for SEO"
    )
    
    roi_potential: str = Field(
        description="Potential return on investment (high/medium/low)"
    )
    
    confidence: float = Field(
        description="Confidence in this gap analysis (0-1)"
    )


class GapAnalysis(BaseModel):
    """Comprehensive gap analysis result"""
    total_gaps_found: int = Field(description="Total number of gaps identified")
    critical_gaps: int = Field(description="Number of critical priority gaps")
    
    gaps: List[ContentGap] = Field(
        default_factory=list,
        description="List of all identified gaps"
    )
    
    competitive_position: str = Field(
        description="Overall competitive position assessment"
    )
    
    market_opportunities: List[str] = Field(
        default_factory=list,
        description="Untapped market opportunities"
    )
    
    quick_wins: List[str] = Field(
        default_factory=list,
        description="Easy improvements with high impact"
    )
    
    strategic_recommendations: List[str] = Field(
        default_factory=list,
        description="Long-term strategic recommendations"
    )
    
    content_calendar: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Suggested content calendar to address gaps"
    )
    
    competitive_analysis: Dict[str, Any] = Field(
        default_factory=dict,
        description="Analysis of competitive landscape"
    )
    
    estimated_coverage: float = Field(
        description="Current content coverage percentage (0-100)"
    )


class LLMGapDetector:
    """
    Production-ready gap detector using OpenAI GPT models.
    Provides strategic insights for content and competitive positioning.
    """
    
    # Comprehensive system prompt for gap detection
    SYSTEM_PROMPT = """You are an expert content strategist and competitive intelligence analyst specializing in identifying gaps and opportunities.

TASK: Analyze content to identify gaps, missing information, and competitive opportunities.

CONTEXT:
- Brand: {brand_name}
- Industry: {industry}
- Competitors: {competitors}
- Target Audience: {target_audience}
- Business Goals: {business_goals}

ANALYSIS FRAMEWORK:

1. CONTENT GAP ANALYSIS:
   - Identify missing topics that users expect
   - Find questions left unanswered
   - Detect incomplete explanations
   - Note missing use cases or examples
   - Identify absent proof points or evidence

2. COMPETITIVE GAP ANALYSIS:
   - Compare with competitor content coverage
   - Identify unique competitor advantages
   - Find differentiation opportunities
   - Detect competitive blind spots
   - Note competitor weaknesses to exploit

3. MARKET OPPORTUNITY DETECTION:
   - Emerging trends not addressed
   - Underserved audience segments
   - Unmet customer needs
   - New use cases or applications
   - Integration opportunities

4. AUTHORITY GAP ASSESSMENT:
   - Missing credibility indicators
   - Absent social proof
   - Lacking expert opinions
   - Missing data or research
   - Insufficient case studies

5. TECHNICAL GAP IDENTIFICATION:
   - Missing technical details
   - Absent implementation guides
   - Lacking API documentation
   - Missing troubleshooting info
   - Insufficient best practices

6. SERVICE GAP DISCOVERY:
   - Unaddressed customer pain points
   - Missing support documentation
   - Absent onboarding materials
   - Lacking training resources
   - Missing FAQ coverage

PRIORITIZATION CRITERIA:
- CRITICAL: Direct revenue impact, competitive disadvantage, customer churn risk
- HIGH: Significant user frustration, SEO opportunity, market share impact
- MEDIUM: User experience improvement, content completeness, brand perception
- LOW: Nice-to-have, minor improvements, long-term considerations

OUTPUT FORMAT: Return ONLY valid JSON:
{{
  "total_gaps_found": int,
  "critical_gaps": int,
  "gaps": [
    {{
      "gap_type": "content_missing|feature_gap|competitive_disadvantage|market_opportunity|knowledge_gap|authority_gap|technical_gap|service_gap",
      "title": "Clear, actionable title",
      "description": "Detailed description",
      "missing_topics": ["topic1", "topic2"],
      "competitor_advantage": "How competitors handle this",
      "priority": "critical|high|medium|low",
      "business_impact": "Specific impact description",
      "estimated_effort": "2 hours|1 day|1 week|2 weeks|1 month",
      "recommended_action": "Specific action to take",
      "content_suggestions": ["Blog post about X", "Video tutorial for Y"],
      "keywords_to_target": ["keyword1", "keyword2"],
      "roi_potential": "high|medium|low",
      "confidence": 0.0-1.0
    }}
  ],
  "competitive_position": "leader|challenger|follower|niche",
  "market_opportunities": ["opportunity1", "opportunity2"],
  "quick_wins": ["quick win 1", "quick win 2"],
  "strategic_recommendations": ["recommendation1", "recommendation2"],
  "content_calendar": [
    {{"week": "1", "content": "Blog post on X", "priority": "high"}},
    {{"week": "2", "content": "Video tutorial Y", "priority": "medium"}}
  ],
  "competitive_analysis": {{
    "strengths": ["strength1"],
    "weaknesses": ["weakness1"],
    "opportunities": ["opportunity1"],
    "threats": ["threat1"]
  }},
  "estimated_coverage": 0-100
}}

IMPORTANT GUIDELINES:
- Focus on actionable, specific gaps
- Prioritize based on business impact
- Consider competitive landscape
- Provide clear remediation steps
- Estimate realistic effort levels
- Identify quick wins for immediate impact
- Think strategically about long-term positioning"""

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
        self.cache_ttl = 7200  # 2 hour cache for gap analysis
        self.max_text_length = 8000  # Max chars to process
    
    def _generate_cache_key(self, query: str, response: str, context: Dict) -> str:
        """Generate deterministic cache key for request"""
        content = f"{query[:100]}_{response[:100]}_{context.get('brand_name', '')}_{context.get('industry', '')}"
        return f"gap_analysis:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def detect(
        self,
        query: str,
        response: str,
        competitor_responses: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> GapAnalysis:
        """
        Detect gaps in content compared to query and competitors.
        
        Args:
            query: User's original query/question
            response: The response being analyzed
            competitor_responses: Competitor responses for comparison
            context: {
                "brand_name": "YourBrand",
                "industry": "Technology",
                "competitors": ["Competitor1", "Competitor2"],
                "target_audience": "B2B SaaS companies",
                "business_goals": "Increase market share",
                "customer_id": "cust_123"
            }
        
        Returns:
            Comprehensive gap analysis with actionable insights
        """
        context = context or {}
        competitor_responses = competitor_responses or []
        
        # Step 1: Check cache
        cache_key = self._generate_cache_key(query, response, context)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            logger.info(f"Cache hit for gap analysis")
            return cached_result
        
        # Step 2: Prepare optimized prompt
        system_prompt = self.SYSTEM_PROMPT.format(
            brand_name=context.get("brand_name", "Unknown"),
            industry=context.get("industry", "General"),
            competitors=", ".join(context.get("competitors", [])),
            target_audience=context.get("target_audience", "General audience"),
            business_goals=context.get("business_goals", "Improve content quality")
        )
        
        # Step 3: Prepare analysis text
        analysis_text = self._prepare_analysis_text(query, response, competitor_responses)
        
        # Step 4: Call OpenAI API
        try:
            result = await self._call_llm_optimized(system_prompt, analysis_text)
            
            # Step 5: Parse and validate results
            analysis = self._parse_llm_response(result)
            
            # Step 6: Cache results
            self._cache_result(cache_key, analysis)
            
            return analysis
            
        except Exception as e:
            logger.error(f"LLM gap detection failed: {e}")
            # Fallback to basic analysis
            return self._fallback_analysis(query, response)
    
    def _prepare_analysis_text(
        self,
        query: str,
        response: str,
        competitor_responses: List[str]
    ) -> str:
        """Prepare text for gap analysis"""
        text = f"USER QUERY:\n{query}\n\n"
        text += f"OUR RESPONSE:\n{response[:self.max_text_length]}\n\n"
        
        if competitor_responses:
            text += "COMPETITOR RESPONSES:\n"
            for i, comp_response in enumerate(competitor_responses[:3], 1):
                text += f"Competitor {i}:\n{comp_response[:1000]}\n\n"
        
        return text
    
    async def _call_llm_optimized(
        self,
        system_prompt: str,
        text: str
    ) -> Dict:
        """
        Optimized OpenAI API call with timeout and structured output.
        """
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="gpt-5-nano-2025-08-07",  # Will be "gpt-5-nano" when available
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Analyze this content for gaps:\n\n{text}"}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,  # Slightly higher for creative gap finding
                    max_tokens=1500,  # Enough for detailed gap analysis
                    seed=42  # Deterministic outputs
                ),
                timeout=4.0  # 4 second timeout for comprehensive analysis
            )
            
            return json.loads(response.choices[0].message.content)
            
        except asyncio.TimeoutError:
            logger.warning("LLM call timed out, using fallback")
            return {}
        except json.JSONDecodeError:
            logger.error("Invalid JSON from LLM")
            return {}
    
    def _parse_llm_response(self, llm_result: Dict) -> GapAnalysis:
        """Convert LLM response to GapAnalysis object"""
        try:
            # Parse gaps
            gaps = []
            for gap_data in llm_result.get("gaps", []):
                gaps.append(ContentGap(
                    gap_type=GapType(gap_data.get("gap_type", "content_missing")),
                    title=gap_data.get("title", "Unspecified gap"),
                    description=gap_data.get("description", ""),
                    missing_topics=gap_data.get("missing_topics", []),
                    competitor_advantage=gap_data.get("competitor_advantage"),
                    priority=GapPriority(gap_data.get("priority", "medium")),
                    business_impact=gap_data.get("business_impact", "Unknown impact"),
                    estimated_effort=gap_data.get("estimated_effort", "Unknown"),
                    recommended_action=gap_data.get("recommended_action", "Review and address"),
                    content_suggestions=gap_data.get("content_suggestions", []),
                    keywords_to_target=gap_data.get("keywords_to_target", []),
                    roi_potential=gap_data.get("roi_potential", "medium"),
                    confidence=gap_data.get("confidence", 0.7)
                ))
            
            return GapAnalysis(
                total_gaps_found=llm_result.get("total_gaps_found", len(gaps)),
                critical_gaps=llm_result.get("critical_gaps", 0),
                gaps=gaps,
                competitive_position=llm_result.get("competitive_position", "unknown"),
                market_opportunities=llm_result.get("market_opportunities", []),
                quick_wins=llm_result.get("quick_wins", []),
                strategic_recommendations=llm_result.get("strategic_recommendations", []),
                content_calendar=llm_result.get("content_calendar", []),
                competitive_analysis=llm_result.get("competitive_analysis", {}),
                estimated_coverage=llm_result.get("estimated_coverage", 50.0)
            )
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return self._fallback_analysis("", "")
    
    def _fallback_analysis(self, query: str, response: str) -> GapAnalysis:
        """Basic fallback gap analysis"""
        # Simple keyword-based fallback
        query_words = set(query.lower().split())
        response_words = set(response.lower().split())
        
        missing_words = query_words - response_words
        
        gaps = []
        if missing_words:
            gaps.append(ContentGap(
                gap_type=GapType.CONTENT_MISSING,
                title="Potential missing content",
                description=f"Query contains terms not found in response: {', '.join(list(missing_words)[:5])}",
                missing_topics=list(missing_words)[:5],
                competitor_advantage=None,
                priority=GapPriority.MEDIUM,
                business_impact="May not fully address user query",
                estimated_effort="1 day",
                recommended_action="Review and expand content to cover missing terms",
                content_suggestions=["Expand current content"],
                keywords_to_target=list(missing_words)[:3],
                roi_potential="medium",
                confidence=0.3
            ))
        
        return GapAnalysis(
            total_gaps_found=len(gaps),
            critical_gaps=0,
            gaps=gaps,
            competitive_position="unknown",
            market_opportunities=[],
            quick_wins=[],
            strategic_recommendations=["Manual review recommended"],
            content_calendar=[],
            competitive_analysis={},
            estimated_coverage=70.0
        )
    
    def _get_cached_result(self, cache_key: str) -> Optional[GapAnalysis]:
        """Retrieve cached results from Redis"""
        try:
            cached = self.redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return GapAnalysis(**data)
        except Exception as e:
            logger.debug(f"Cache retrieval failed: {e}")
        return None
    
    def _cache_result(self, cache_key: str, analysis: GapAnalysis):
        """Store results in Redis cache"""
        try:
            self.redis.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(analysis.dict(), default=str)
            )
        except Exception as e:
            logger.debug(f"Cache storage failed: {e}")
    
    async def analyze_content_portfolio(
        self,
        content_items: List[Dict[str, str]],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict:
        """
        Analyze entire content portfolio for strategic gaps.
        
        Args:
            content_items: List of {"title": "", "content": "", "type": ""}
            context: Brand and business context
        
        Returns:
            Portfolio-level gap analysis
        """
        context = context or {}
        
        # Analyze each content item
        all_gaps = []
        coverage_scores = []
        
        for item in content_items[:10]:  # Limit to 10 items for performance
            analysis = await self.detect(
                query=item.get("title", ""),
                response=item.get("content", ""),
                context=context
            )
            all_gaps.extend(analysis.gaps)
            coverage_scores.append(analysis.estimated_coverage)
        
        # Aggregate results
        gap_types_count = {}
        priority_count = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for gap in all_gaps:
            gap_types_count[gap.gap_type] = gap_types_count.get(gap.gap_type, 0) + 1
            priority_count[gap.priority] = priority_count.get(gap.priority, 0) + 1
        
        avg_coverage = sum(coverage_scores) / len(coverage_scores) if coverage_scores else 0
        
        return {
            "portfolio_coverage": avg_coverage,
            "total_gaps": len(all_gaps),
            "gap_distribution": gap_types_count,
            "priority_distribution": priority_count,
            "top_gaps": sorted(all_gaps, key=lambda x: x.confidence, reverse=True)[:5],
            "strategic_focus_areas": self._identify_focus_areas(all_gaps),
            "content_maturity": self._assess_maturity(avg_coverage),
            "improvement_roadmap": self._generate_roadmap(all_gaps)
        }
    
    def _identify_focus_areas(self, gaps: List[ContentGap]) -> List[str]:
        """Identify strategic focus areas from gaps"""
        focus_areas = []
        
        # Count gap types
        gap_type_counts = {}
        for gap in gaps:
            gap_type_counts[gap.gap_type] = gap_type_counts.get(gap.gap_type, 0) + 1
        
        # Identify top focus areas
        sorted_types = sorted(gap_type_counts.items(), key=lambda x: x[1], reverse=True)
        for gap_type, count in sorted_types[:3]:
            if gap_type == GapType.CONTENT_MISSING:
                focus_areas.append("Expand content coverage")
            elif gap_type == GapType.COMPETITIVE_DISADVANTAGE:
                focus_areas.append("Improve competitive positioning")
            elif gap_type == GapType.MARKET_OPPORTUNITY:
                focus_areas.append("Capture market opportunities")
            elif gap_type == GapType.AUTHORITY_GAP:
                focus_areas.append("Build thought leadership")
        
        return focus_areas
    
    def _assess_maturity(self, coverage: float) -> str:
        """Assess content maturity level"""
        if coverage >= 90:
            return "Mature: Comprehensive coverage with minor gaps"
        elif coverage >= 75:
            return "Developing: Good coverage with some gaps"
        elif coverage >= 60:
            return "Growing: Moderate coverage with significant gaps"
        elif coverage >= 40:
            return "Early: Limited coverage with major gaps"
        else:
            return "Initial: Minimal coverage requiring significant development"
    
    def _generate_roadmap(self, gaps: List[ContentGap]) -> List[Dict]:
        """Generate improvement roadmap from gaps"""
        roadmap = []
        
        # Group by priority
        critical = [g for g in gaps if g.priority == GapPriority.CRITICAL]
        high = [g for g in gaps if g.priority == GapPriority.HIGH]
        medium = [g for g in gaps if g.priority == GapPriority.MEDIUM]
        
        # Phase 1: Critical gaps (Week 1-2)
        if critical:
            roadmap.append({
                "phase": "1",
                "timeline": "Week 1-2",
                "focus": "Critical gaps",
                "actions": [g.recommended_action for g in critical[:3]]
            })
        
        # Phase 2: High priority (Week 3-4)
        if high:
            roadmap.append({
                "phase": "2",
                "timeline": "Week 3-4",
                "focus": "High priority improvements",
                "actions": [g.recommended_action for g in high[:3]]
            })
        
        # Phase 3: Medium priority (Month 2)
        if medium:
            roadmap.append({
                "phase": "3",
                "timeline": "Month 2",
                "focus": "Content optimization",
                "actions": [g.recommended_action for g in medium[:3]]
            })
        
        return roadmap
    
    def close(self):
        """Cleanup resources"""
        if self.redis:
            self.redis.close()


# Compatibility class for backwards compatibility
class GapDetector:
    """Backwards compatible wrapper for the new LLM gap detector"""
    
    def __init__(self):
        self.llm_detector = LLMGapDetector()
    
    def detect(
        self,
        prompt: str,
        response: str,
        competitor_responses: List[str] = None,
        entities: List = None
    ) -> Any:
        """Synchronous wrapper for compatibility"""
        import asyncio
        return asyncio.run(self.llm_detector.detect(
            query=prompt,
            response=response,
            competitor_responses=competitor_responses
        ))