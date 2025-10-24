"""
AI-Powered Query Generation System
World-class implementation using GPT-5 for intelligent query synthesis
"""

import json
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import hashlib
from datetime import datetime
import numpy as np
from openai import AsyncOpenAI
import logging

logger = logging.getLogger(__name__)


class QueryIntent(Enum):
    """Search intent categorization based on Google's search quality guidelines"""
    NAVIGATIONAL = "navigational"  # Looking for specific brand/website
    INFORMATIONAL = "informational"  # Seeking information/answers
    TRANSACTIONAL = "transactional"  # Ready to purchase/convert
    COMMERCIAL_INVESTIGATION = "commercial"  # Comparing options before purchase
    LOCAL = "local"  # Location-based searches
    PROBLEM_SOLVING = "problem_solving"  # Looking for solutions
    COMPARATIVE = "comparative"  # Direct comparisons
    REVIEW_SEEKING = "review"  # Looking for reviews/testimonials


class BuyerJourneyCategory(Enum):
    """Buyer journey stages - maps customer awareness to query categories"""
    PROBLEM_UNAWARE = "problem_unaware"  # Users experiencing problems but don't know solutions exist
    SOLUTION_SEEKING = "solution_seeking"  # Users actively looking for solutions
    BRAND_SPECIFIC = "brand_specific"  # Users specifically searching for the brand
    COMPARISON = "comparison"  # Users comparing solutions and alternatives
    PURCHASE_INTENT = "purchase_intent"  # Users ready to buy or sign up
    USE_CASE = "use_case"  # Users looking for specific applications


@dataclass
class QueryContext:
    """Rich context for query generation"""
    company_name: str
    industry: str
    sub_industry: Optional[str]
    description: str
    unique_value_propositions: List[str]
    target_audiences: List[Dict[str, str]]
    competitors: List[str]
    products_services: List[str]
    pain_points_solved: List[str]
    geographic_markets: List[str]
    technology_stack: Optional[List[str]]
    pricing_model: Optional[str]
    company_size: Optional[str]
    founding_year: Optional[int]
    key_features: List[str]
    use_cases: List[str]
    integrations: Optional[List[str]]
    certifications: Optional[List[str]]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GeneratedQuery:
    """Structured query with metadata - World-class implementation for buyer-journey batching"""
    query_text: str
    intent: QueryIntent
    complexity_score: float  # 0-1, higher = more complex/specific
    competitive_relevance: float  # 0-1, likelihood of competitive comparison
    buyer_journey_stage: str  # Simplified 3-stage: awareness, consideration, decision (backward compatibility)
    buyer_journey_category: str  # Detailed 6-category: problem_unaware, solution_seeking, brand_specific, comparison, purchase_intent, use_case
    expected_serp_features: List[str]  # featured snippet, local pack, etc.
    semantic_variations: List[str]
    priority_score: float  # 0-1, importance for brand visibility
    persona_alignment: Optional[str]
    industry_specificity: float  # 0-1, how industry-specific
    query_id: str = field(default_factory=lambda: hashlib.md5(
        str(datetime.now()).encode()).hexdigest()[:12])


class IntelligentQueryGenerator:
    """GPT-5 powered query generation with advanced context understanding

    Supports both sophisticated multi-phase generation and simple single-shot generation.
    Integrates Google's search intent taxonomy with buyer journey stages.
    """

    # Mapping between buyer journey categories and query intents
    CATEGORY_TO_INTENT_MAP = {
        BuyerJourneyCategory.PROBLEM_UNAWARE: [QueryIntent.INFORMATIONAL, QueryIntent.PROBLEM_SOLVING],
        BuyerJourneyCategory.SOLUTION_SEEKING: [QueryIntent.PROBLEM_SOLVING, QueryIntent.INFORMATIONAL],
        BuyerJourneyCategory.BRAND_SPECIFIC: [QueryIntent.NAVIGATIONAL, QueryIntent.REVIEW_SEEKING],
        BuyerJourneyCategory.COMPARISON: [QueryIntent.COMPARATIVE, QueryIntent.COMMERCIAL_INVESTIGATION],
        BuyerJourneyCategory.PURCHASE_INTENT: [QueryIntent.TRANSACTIONAL, QueryIntent.COMMERCIAL_INVESTIGATION],
        BuyerJourneyCategory.USE_CASE: [QueryIntent.INFORMATIONAL, QueryIntent.PROBLEM_SOLVING]
    }

    def __init__(self, openai_api_key: str, model: str = "gpt-5-nano"):
        """Initialize with GPT-5 or fallback to GPT-4"""
        self.client = AsyncOpenAI(
            api_key=openai_api_key,
            timeout=90.0  # Increased timeout for GPT-5 Nano query generation
        )
        self.model = model
        self.query_cache = {}

        # Google-based intent weights (multi-phase generation)
        self.intent_weights = {
            QueryIntent.COMMERCIAL_INVESTIGATION: 0.25,
            QueryIntent.COMPARATIVE: 0.20,
            QueryIntent.INFORMATIONAL: 0.15,
            QueryIntent.PROBLEM_SOLVING: 0.15,
            QueryIntent.TRANSACTIONAL: 0.10,
            QueryIntent.REVIEW_SEEKING: 0.10,
            QueryIntent.NAVIGATIONAL: 0.03,
            QueryIntent.LOCAL: 0.02
        }

        # Buyer journey category distribution (single-shot generation)
        self.category_distribution = {
            BuyerJourneyCategory.PROBLEM_UNAWARE: 8,
            BuyerJourneyCategory.SOLUTION_SEEKING: 8,
            BuyerJourneyCategory.BRAND_SPECIFIC: 8,
            BuyerJourneyCategory.COMPARISON: 8,
            BuyerJourneyCategory.PURCHASE_INTENT: 8,
            BuyerJourneyCategory.USE_CASE: 8
        }
    
    def _build_comparison_section(
        self,
        company_name: str,
        industry: str,
        products_services: List[str],
        competitors: List[str],
        use_cases: List[str],
        unique_value_props: List[str],
        queries_per_category: int
    ) -> str:
        """Build detailed competitor intelligence section for comparison queries"""

        if not competitors or len(competitors) == 0:
            # Fallback for no competitors
            return f"""
4. COMPARISON ({queries_per_category} queries): Users comparing solutions
   - Generate generic comparison queries for the {industry} industry
   - Include queries like "best {industry} tools comparison 2025"
   - Focus on category comparisons and rankings
"""

        product_name = products_services[0] if products_services else company_name

        # Build competitor list with strategic context
        competitor_list = "\n".join([f"   • {comp}" for comp in competitors[:5]])

        # Calculate sub-distributions
        direct_comp_count = int(queries_per_category * 0.40)
        alternative_count = int(queries_per_category * 0.30)
        implicit_count = queries_per_category - direct_comp_count - alternative_count

        # Build comparison templates with actual data
        direct_examples = []
        if len(competitors) >= 1:
            comp1 = competitors[0]
            direct_examples.append(f'"{product_name} vs {comp1} for {use_cases[0] if use_cases else "business"}"')
            direct_examples.append(f'"{company_name} vs {comp1} pricing comparison 2025"')
            direct_examples.append(f'"which is better {product_name} or {comp1}"')

        if len(competitors) >= 2:
            comp2 = competitors[1]
            direct_examples.append(f'"{product_name} vs {comp2} {unique_value_props[0] if unique_value_props else "features"}"')

        alternative_examples = []
        if len(competitors) >= 1:
            comp1 = competitors[0]
            alternative_examples.append(f'"{comp1} alternatives for {use_cases[0] if use_cases else "business"}"')
            alternative_examples.append(f'"better than {comp1} for {industry}"')
            alternative_examples.append(f'"{comp1} alternative with {unique_value_props[0] if unique_value_props else "advanced features"}"')

        return f"""
4. COMPARISON ({queries_per_category} queries) - 🔥 HIGHEST PRIORITY CATEGORY

   🎯 PURPOSE: Track competitive positioning in head-to-head scenarios

   📊 REQUIRED DISTRIBUTION:
   - {direct_comp_count} Direct "{product_name} vs {{competitor}}" queries (40%)
   - {alternative_count} "{{competitor}} alternative" queries (30%)
   - {implicit_count} Implicit comparison queries (30%)

   🎯 STRATEGIC REQUIREMENTS:

   a) DIRECT COMPARISONS ({direct_comp_count} queries - MANDATORY):

      PATTERN: "{{our_product}} vs {{competitor_product}} for {{context}}"

      COMPETITORS TO COMPARE AGAINST:
{competitor_list}

      ✅ EXCELLENT Direct Comparison Examples:
{chr(10).join(f'      - {ex}' for ex in direct_examples[:4])}

      REQUIRED PATTERNS (use each at least once):
      • "{product_name} vs {{competitor}}"
      • "{product_name} vs {{competitor}} for {{use_case}}"
      • "{company_name} vs {{competitor}} pricing comparison 2025"
      • "which is better {product_name} or {{competitor}}"
      • "{product_name} {unique_value_props[0] if unique_value_props else "features"} vs {{competitor}}"

   b) ALTERNATIVE QUERIES ({alternative_count} queries - MANDATORY):

      PURPOSE: Test if {company_name} appears as alternative to market leaders

      ✅ EXCELLENT Alternative Examples:
{chr(10).join(f'      - {ex}' for ex in alternative_examples)}

      REQUIRED PATTERNS (use each at least once):
      • "{{competitor}} alternatives"
      • "{{competitor}} alternative for {{use_case}}"
      • "better than {{competitor}} for {{industry}}"
      • "replace {{competitor}} with what"
      • "{{competitor}} alternative with {{feature}}"

   c) IMPLICIT COMPARISONS ({implicit_count} queries):

      PURPOSE: Test organic visibility (NO brand names - see if we appear naturally)

      ✅ EXCELLENT Implicit Examples:
      - "best {industry} comparison 2025"
      - "top {industry} platforms compared"
      - "{industry} tools ranked by {unique_value_props[0] if unique_value_props else "features"}"
      - "leading {industry} solutions comparison"
      - "enterprise {industry} comparison chart"

   ⚡ CRITICAL QUALITY RULES:
   □ At least 60% of comparison queries MUST mention specific competitor names
   □ At least 3 queries must use "{product_name} vs {{competitor}}" pattern
   □ At least 2 queries must use "{{competitor}} alternative" pattern
   □ Natural phrasing - how real users search (not keyword stuffing)
   □ Variety in comparison dimensions: pricing, features, use cases, industry

   🚫 ANTI-PATTERNS TO AVOID:
   ✗ "{company_name} vs competitors" (not specific - name actual competitor!)
   ✗ "compare AI tools" (no brands mentioned - too generic)
   ✗ "{company_name} is better" (not a comparison question)
   ✗ "best company" (no competitive context)
"""

    def _build_b2c_few_shot_examples(
        self,
        company_name: str,
        industry: str,
        products_services: List[str],
        competitors: List[str],
        use_cases: List[str],
        unique_value_props: List[str],
        pain_points: List[str]
    ) -> str:
        """Build B2C consumer shopping few-shot examples dynamically from context"""

        # Extract key variables for consumer shopping examples
        product_name = products_services[0] if products_services else f"{company_name} product"
        competitor = competitors[0] if competitors else "leading brand"
        consumer_use = use_cases[0] if use_cases else "everyday use"

        # For consumer products, extract simple product attributes
        consumer_pain = pain_points[0] if pain_points else "common product issues"

        return f"""
📚 B2C CONSUMER SHOPPING EXAMPLES (Learn from these before generating):

=== 1. PROBLEM_UNAWARE ===
Purpose: Test if {company_name} appears when consumers experience problems but don't know solutions exist

✅ EXCELLENT Consumer Examples:
  - "why do my {consumer_pain}"
    Real: "why do my jeans fade after washing"

  - "uncomfortable {industry} products"
    Real: "uncomfortable running shoes causing blisters"

  - "{consumer_pain} keeps happening"
    Real: "shirt collar keeps getting worn out"

  - "how to prevent {consumer_pain}"
    Real: "how to prevent shoes from smelling"

✗ BAD Examples:
  - "AI problems" (B2B language, not consumer)
  - "{company_name} issues" (wrong category - this is branded, not problem-unaware)
  - "enterprise challenges" (B2B, not B2C)

CRITICAL: DO NOT mention {company_name} or product names. Focus on CONSUMER pain points.

=== 2. SOLUTION_SEEKING ===
Purpose: Test if {company_name} appears when consumers actively shop for products

✅ EXCELLENT Consumer Shopping Examples:
  - "best {industry} products for {consumer_use} 2025"
    Real: "best running shoes for marathon training 2025"

  - "top {industry} brands for quality"
    Real: "top denim brands for durability"

  - "affordable {industry} products"
    Real: "affordable winter jackets under $200"

  - "{competitor} alternatives for {consumer_use}"
    Real: "Nike alternatives for everyday wear"

  - "where to buy quality {industry} products"
    Real: "where to buy quality leather shoes online"

✗ BAD Examples:
  - "good software tools" (B2B language)
  - "{company_name} features" (belongs in BRAND_SPECIFIC)
  - "enterprise solutions" (B2B, not consumer)

RATIO: 70% non-branded, 30% can mention competitor brands

=== 3. BRAND_SPECIFIC ===
Purpose: Verify {company_name} owns consumer brand queries

✅ EXCELLENT Consumer Brand Examples:
  - "{product_name} reviews 2025"
    Real: "Levi's 501 jeans reviews 2025"

  - "{company_name} near me"
    Real: "Nike store near me"

  - "buy {product_name} online"
    Real: "buy iPhone 15 online"

  - "{product_name} price"
    Real: "AirPods Pro price"

  - "{company_name} sale"
    Real: "Zara sale 2025"

  - "is {product_name} worth it"
    Real: "is Dyson vacuum worth it"

  - "{product_name} colors"
    Real: "iPhone 15 colors available"

✗ BAD Examples:
  - "{company_name}" (just brand name, too simple)
  - "about {company_name}" (too vague)
  - "{company_name} API" (B2B, not consumer)

CRITICAL: EVERY query MUST mention {company_name} or product names

=== 4. COMPARISON (HIGHEST VALUE) ===
Purpose: Track competitive positioning in consumer shopping comparisons

✅ EXCELLENT Consumer Comparison Examples:
  - "{product_name} vs {competitor} for {consumer_use}"
    Real: "Nike Air Max vs Adidas Ultraboost for running"

  - "{company_name} vs {competitor} price comparison 2025"
    Real: "Levi's vs Wrangler jeans price 2025"

  - "which is better {product_name} or {competitor}"
    Real: "which is better iPhone 15 or Samsung Galaxy S24"

  - "{competitor} alternative under $100"
    Real: "Nike alternative sneakers under $100"

  - "best {industry} products {company_name} vs competitors"
    Real: "best wireless earbuds AirPods vs Sony vs Bose"

  - "{product_name} vs {competitor} quality"
    Real: "Levi's vs Gap jeans quality comparison"

✗ BAD Examples:
  - "{company_name} vs competitors" (not specific)
  - "compare products" (too generic)
  - "{company_name} API vs competitor API" (B2B, not consumer)

REQUIRED: At least 60% must have direct competitor brand mentions

=== 5. PURCHASE_INTENT ===
Purpose: Track visibility in high-intent consumer shopping queries

✅ EXCELLENT Consumer Purchase Examples:
  - "buy {product_name} online"
    Real: "buy Nike Air Force 1 online"

  - "{product_name} on sale"
    Real: "Levi's jeans on sale near me"

  - "order {product_name} with free shipping"
    Real: "order iPhone 15 with free shipping"

  - "{company_name} discount code 2025"
    Real: "Nike discount code 2025"

  - "where to buy {product_name} cheap"
    Real: "where to buy AirPods cheap"

  - "{product_name} deals"
    Real: "Dyson vacuum deals Black Friday"

  - "shop {company_name} online"
    Real: "shop Zara online USA"

✗ BAD Examples:
  - "buy API" (B2B language)
  - "thinking about {product_name}" (low intent)
  - "sign up for {product_name} enterprise" (B2B, not consumer purchase)

RATIO: 60% branded, 40% generic (tests category dominance)

=== 6. USE_CASE ===
Purpose: Track visibility in specific consumer use scenarios

✅ EXCELLENT Consumer Use Case Examples:
  - "{product_name} for {consumer_use}"
    Real: "running shoes for flat feet"

  - "best {industry} products for {consumer_use}"
    Real: "best jeans for construction work"

  - "{product_name} for outdoor activities"
    Real: "North Face jackets for hiking"

  - "durable {product_name} for daily use"
    Real: "durable backpacks for students"

  - "{company_name} products for {consumer_use}"
    Real: "Nike shoes for basketball"

✗ BAD Examples:
  - "{product_name} use cases" (too broad, B2B language)
  - "AI for business" (B2B, not consumer)
  - "{product_name} for enterprise deployment" (B2B, not consumer)

REQUIRED: Be VERY specific with consumer use cases from context

=== CONSUMER SHOPPING QUALITY CHECKLIST ===
✓ Consumer language (not business/enterprise/B2B terms)
✓ Shopping intent ("buy", "price", "sale", "reviews", "near me")
✓ Product-focused (physical products, consumer services, not APIs or SDKs)
✓ Natural consumer phrasing ("where to buy X", "best X for Y")
✓ Mobile-friendly (shorter, conversational, location-based)
✓ Price-conscious ("cheap", "affordable", "deals", "discount")
✓ Review-seeking ("reviews", "worth it", "is X good")

✗ ANTI-PATTERNS TO AVOID FOR CONSUMER QUERIES:
  ✗ B2B terms ("enterprise", "API", "developer", "SDK", "business solutions")
  ✗ Software-as-a-Service language ("sign up for plan", "pricing tiers")
  ✗ Technical jargon ("integration", "deployment", "infrastructure")
  ✗ Corporate language ("ROI", "business value", "stakeholder")
  ✗ Developer terms ("documentation", "GitHub", "open source")
"""

    def _build_few_shot_examples(
        self,
        company_name: str,
        industry: str,
        products_services: List[str],
        competitors: List[str],
        use_cases: List[str],
        unique_value_props: List[str],
        pain_points: List[str]
    ) -> str:
        """Build comprehensive B2B few-shot examples dynamically from context"""

        # Extract key variables for examples
        product_name = products_services[0] if products_services else f"{company_name} Solution"
        competitor = competitors[0] if competitors else "main competitor"
        use_case = use_cases[0] if use_cases else "primary use case"
        key_feature = unique_value_props[0] if unique_value_props else "key feature"
        pain_point = pain_points[0] if pain_points else "common challenges"

        return f"""
📚 B2B FEW-SHOT EXAMPLES (Learn from these before generating):

=== 1. PROBLEM_UNAWARE ===
Purpose: Test if {company_name} appears when users don't know solutions exist

✅ EXCELLENT Examples:
  - "why does my {pain_point} keep happening"
    Real: "why does my AI model keep giving inconsistent answers"

  - "how to prevent {pain_point} in production"
    Real: "how to prevent AI bias in customer-facing applications"

  - "{pain_point} not working properly in {industry}"
    Real: "{pain_point} affecting productivity in enterprise"

✗ BAD Examples:
  - "AI problems" (too vague, no specific pain point)
  - "{company_name} issues" (wrong category - this is branded, not problem-unaware)
  - "help with technology" (could mean anything)

CRITICAL: DO NOT mention {company_name} or product names in these queries.

=== 2. SOLUTION_SEEKING ===
Purpose: Test if {company_name} appears in solution research queries

✅ EXCELLENT Examples:
  - "best {industry} platform for {use_case} 2025"
    Real: "best enterprise AI platform for document analysis 2025"

  - "top {industry} tools with {key_feature}"
    Real: "top AI platforms with advanced safety features"

  - "{competitor} alternatives for {use_case}"
    Real: "{competitor} alternatives for legal document processing"

  - "most reliable {industry} solution for {use_case}"
    Real: "most reliable AI API for healthcare compliance"

✗ BAD Examples:
  - "good AI tools" (no specificity)
  - "{company_name} features" (belongs in BRAND_SPECIFIC)

RATIO: 60% non-branded, 40% can mention competitors

=== 3. BRAND_SPECIFIC ===
Purpose: Verify {company_name} owns brand queries

✅ EXCELLENT Examples:
  - "{product_name} pricing tiers 2025"
    Real: "{product_name} API pricing comparison 2025"

  - "{company_name} {key_feature} documentation"
    Real: "{company_name} safety features documentation"

  - "how to get started with {product_name}"
    Real: "how to get started with {product_name} API"

  - "{product_name} for {use_case}"
    Real: "{product_name} for regulatory compliance"

  - "does {product_name} support {key_feature}"
    Real: "does {product_name} support multi-language processing"

✗ BAD Examples:
  - "{company_name}" (just brand name, too simple)
  - "about {company_name}" (too vague)

CRITICAL: EVERY query MUST mention {company_name} or product names

=== 4. COMPARISON (HIGHEST VALUE) ===
Purpose: Track competitive positioning in head-to-head scenarios

✅ EXCELLENT Examples:
  - "{product_name} vs {competitor} for {use_case}"
    Real: "{product_name} vs {competitor} for financial document analysis"

  - "{company_name} vs {competitor} pricing comparison 2025"
    Real: "{company_name} vs {competitor} API pricing 2025"

  - "which is better {product_name} or {competitor}"
    Real: "which is better {product_name} or {competitor} for code review"

  - "{competitor} alternative that {key_feature}"
    Real: "{competitor} alternative with built-in compliance"

  - "best {industry} platforms {company_name} vs competitors"
    Real: "best enterprise AI {company_name} vs OpenAI vs Google"

✗ BAD Examples:
  - "{company_name} vs competitors" (not specific)
  - "compare tools" (too generic)

REQUIRED: At least 60% must have direct competitor mentions

=== 5. PURCHASE_INTENT ===
Purpose: Track visibility in high-intent buying queries

✅ EXCELLENT Examples:
  - "sign up for {product_name} API"
    Real: "sign up for {product_name} enterprise plan"

  - "{company_name} enterprise pricing calculator"
    Real: "{company_name} team pricing calculator"

  - "buy {industry} platform for {use_case}"
    Real: "buy AI API for healthcare document processing"

  - "request demo {product_name}"
    Real: "request demo {product_name} enterprise"

  - "best {industry} solution to purchase for {use_case} 2025"
    Real: "best AI platform to purchase for compliance 2025"

✗ BAD Examples:
  - "buy AI" (too generic)
  - "thinking about {product_name}" (low intent)

RATIO: 50% branded, 50% generic (tests category dominance)

=== 6. USE_CASE ===
Purpose: Track visibility in specific application scenarios

✅ EXCELLENT Examples:
  - "{product_name} for {use_case} in {industry}"
    Real: "{product_name} for contract review in legal industry"

  - "using {product_name} to solve {pain_point}"
    Real: "using {product_name} for automated compliance checking"

  - "best {industry} tool for {use_case}"
    Real: "best AI platform for HIPAA compliant patient communication"

  - "how to implement {product_name} for {use_case}"
    Real: "how to implement {product_name} for customer support"

✗ BAD Examples:
  - "{product_name} use cases" (too broad)
  - "AI for business" (no specific use case)

REQUIRED: Be VERY specific with use cases from context

=== QUALITY CHECKLIST ===
✓ Realistic (what real users would type)
✓ Natural language (not keyword stuffing)
✓ Specific (not "AI tools" but "enterprise AI API")
✓ Varied structure (questions, statements, phrases)
✓ Strategic (serves visibility tracking purpose)

✗ ANTI-PATTERNS TO AVOID:
  ✗ Generic terms without context ("best AI", "AI tools")
  ✗ Keyword stuffing ("AI AI company best AI 2025")
  ✗ Unnatural phrasing ("AI company which is good")
  ✗ Wrong category placement (branded query in problem_unaware)
  ✗ Too short without meaning ("AI", "software", "tools")
"""

    async def generate_enhanced_queries(
        self,
        prompt: str,
        query_count: int = 48,
        include_metadata: bool = True
    ) -> List[GeneratedQuery]:
        """Generate queries using enhanced prompt with category-based approach"""
        
        logger.info(f"Generating {query_count} enhanced queries with custom prompt")

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert search query architect. Generate exactly the requested number of queries following the specifications precisely. Return ONLY valid JSON, no other text."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                max_completion_tokens=16000  # GPT-5 Nano requires max_completion_tokens
            )
            
            # Parse the response
            result = json.loads(response.choices[0].message.content)
            queries_data = result if isinstance(result, list) else result.get('queries', [])
            
            # Convert to GeneratedQuery objects
            generated_queries = []
            for idx, q in enumerate(queries_data[:query_count]):
                category_str = q.get('category', 'solution_seeking')
                category_to_stage_map = {
                    'problem_unaware': 'awareness',
                    'solution_seeking': 'consideration',
                    'brand_specific': 'consideration',
                    'comparison': 'consideration',
                    'purchase_intent': 'decision',
                    'use_case': 'consideration'
                }
                simplified_stage = category_to_stage_map.get(category_str, 'consideration')

                query = GeneratedQuery(
                    query_text=q.get('query', ''),
                    intent=QueryIntent[q.get('intent', 'INFORMATIONAL').upper()],
                    buyer_journey_stage=simplified_stage,
                    buyer_journey_category=category_str,
                    complexity_score=float(q.get('specificity_level', 'medium') == 'long_tail') * 0.5 + 0.5,
                    competitive_relevance=float(q.get('category', '') == 'comparison'),
                    priority_score=float(q.get('priority', 5)) / 10.0,
                    semantic_variations=[],
                    expected_serp_features=[q.get('expected_serp_type', 'mixed')],
                    persona_alignment=[q.get('persona', 'general')],
                    industry_specificity=float(q.get('commercial_value', 'medium') == 'high') * 0.3 + 0.7
                )
                generated_queries.append(query)
            
            logger.info(f"Successfully generated {len(generated_queries)} enhanced queries")
            return generated_queries
            
        except Exception as e:
            logger.error(f"Error generating enhanced queries: {e}")
            # Fallback to standard generation
            return await self.generate_queries(QueryContext(
                company_name="Unknown",
                industry="Technology",
                sub_industry=None,
                description="",
                unique_value_propositions=[],
                target_audiences=[],
                competitors=[],
                products_services=[],
                pain_points_solved=[],
                geographic_markets=[],
                technology_stack=None,
                pricing_model=None,
                company_size=None,
                founding_year=None,
                key_features=[],
                use_cases=[],
                integrations=None,
                certifications=None
            ), target_count=query_count)
    
    async def generate_queries(
        self,
        context: Optional[QueryContext] = None,
        target_count: int = 50,
        diversity_threshold: float = 0.7,
        # Simple parameters (if context not provided)
        company_name: Optional[str] = None,
        domain: Optional[str] = None,
        industry: Optional[str] = None,
        description: Optional[str] = None,
        competitors: Optional[List[str]] = None,
        products_services: Optional[List[str]] = None
    ) -> List[GeneratedQuery]:
        """
        Generate diverse, high-quality queries using single-shot GPT-5 generation.

        Supports both QueryContext (job processor) and simple parameters (REST API).
        Uses single-shot generation with retry logic and automatic fallback to multi-phase.

        Args:
            context: Full QueryContext object (preferred)
            target_count: Number of queries to generate
            diversity_threshold: Diversity threshold (0-1)
            company_name: Company name (if context not provided)
            domain: Company domain (if context not provided)
            industry: Industry (if context not provided)
            description: Company description (if context not provided)
            competitors: List of competitors (if context not provided)
            products_services: List of products/services (if context not provided)

        Returns:
            List of GeneratedQuery objects
        """

        print(f"DEBUG: generate_queries() ENTRY - context={context is not None}, target_count={target_count}")

        # Extract values from context or simple parameters
        if context:
            _company_name = context.company_name
            _domain = getattr(context, 'domain', '')
            _industry = context.industry
            _description = context.description
            _competitors = context.competitors
            _products_services = context.products_services
        else:
            _company_name = company_name or "Unknown Company"
            _domain = domain or ""
            _industry = industry or "Technology"
            _description = description or ""
            _competitors = competitors or []
            _products_services = products_services or []

        print(f"DEBUG: Extracted company: {_company_name}, industry: {_industry}")
        logger.info(f"Generating {target_count} queries for {_company_name} (single-shot mode)")
        print(f"DEBUG: After logger.info")

        # Handle both string and object formats for competitors and products_services
        def extract_names(items):
            """Extract names from items that can be strings or objects"""
            if not items:
                return []
            result = []
            for item in items:
                if isinstance(item, str):
                    result.append(item)
                elif isinstance(item, dict):
                    # Extract 'name' field from object
                    result.append(item.get('name', str(item)))
                else:
                    result.append(str(item))
            return result

        _competitors_names = extract_names(_competitors)
        _products_names = extract_names(_products_services)

        competitors_str = ', '.join(_competitors_names) if _competitors_names else 'Not specified'
        products_str = ', '.join(_products_names) if _products_names else 'Not specified'

        # 🎯 EXTRACT BUSINESS MODEL from metadata (NEW)
        _business_model = 'B2B'  # Default to B2B for backward compatibility
        _customer_type = None
        _transaction_type = None

        if context and context.metadata:
            _business_model = context.metadata.get('business_model', 'B2B')
            _customer_type = context.metadata.get('customer_type')
            _transaction_type = context.metadata.get('transaction_type')

        logger.info(f"🎯 Business Model Detection: {_business_model} for {_company_name}")
        if _customer_type:
            logger.info(f"   Customer Type: {_customer_type.get('primary') if isinstance(_customer_type, dict) else _customer_type}")
        print(f"DEBUG: Business model = {_business_model}, Company = {_company_name}")

        # Build comprehensive context string
        context_str = f"""
Company: {_company_name}
Domain: {_domain}
Industry: {_industry}
Description: {_description}
Competitors: {competitors_str}
Products/Services: {products_str}
Business Model: {_business_model}
"""

        # Extract additional context for examples
        _use_cases = context.use_cases if context else []
        _value_props = context.unique_value_propositions if context else []
        _pain_points = context.pain_points_solved if context else []

        # Build few-shot examples dynamically from context based on business model
        if _business_model == 'B2C':
            logger.info(f"📚 Building B2C consumer shopping few-shot examples for {_company_name}")
            few_shot_examples = self._build_b2c_few_shot_examples(
                company_name=_company_name,
                industry=_industry,
                products_services=_products_names,
                competitors=_competitors_names,
                use_cases=_use_cases,
                unique_value_props=_value_props,
                pain_points=_pain_points
            )
        else:
            # B2B or B2B2C use B2B-style examples
            logger.info(f"📚 Building B2B enterprise few-shot examples for {_company_name}")
            few_shot_examples = self._build_few_shot_examples(
                company_name=_company_name,
                industry=_industry,
                products_services=_products_names,
                competitors=_competitors_names,
                use_cases=_use_cases,
                unique_value_props=_value_props,
                pain_points=_pain_points
            )

        # Calculate queries per category
        queries_per_category = target_count // 6  # 6 buyer-journey categories
        remaining = target_count % 6

        # Build enhanced competitor comparison section
        comparison_section = self._build_comparison_section(
            company_name=_company_name,
            industry=_industry,
            products_services=_products_names,
            competitors=_competitors_names,
            use_cases=_use_cases,
            unique_value_props=_value_props,
            queries_per_category=queries_per_category
        )

        # 🎯 CHOOSE PROMPT BASED ON BUSINESS MODEL (NEW)
        if _business_model == 'B2C':
            logger.info(f"🛍️  Using B2C consumer shopping prompt for {_company_name}")
            prompt = self._build_b2c_prompt(
                company_name=_company_name,
                industry=_industry,
                description=_description,
                products_names=_products_names,
                competitors_names=_competitors_names,
                use_cases=_use_cases,
                value_props=_value_props,
                pain_points=_pain_points,
                context_str=context_str,
                few_shot_examples=few_shot_examples,
                comparison_section=comparison_section,
                target_count=target_count,
                queries_per_category=queries_per_category,
                remaining=remaining
            )
        elif _business_model == 'B2B2C':
            logger.info(f"🔀 Using B2B2C hybrid prompt for {_company_name}")
            prompt = self._build_b2b2c_hybrid_prompt(
                company_name=_company_name,
                industry=_industry,
                description=_description,
                products_names=_products_names,
                competitors_names=_competitors_names,
                use_cases=_use_cases,
                value_props=_value_props,
                pain_points=_pain_points,
                context_str=context_str,
                few_shot_examples=few_shot_examples,
                comparison_section=comparison_section,
                target_count=target_count,
                queries_per_category=queries_per_category,
                remaining=remaining
            )
        else:  # B2B (default)
            logger.info(f"🏢 Using B2B enterprise prompt for {_company_name}")
            prompt = self._build_b2b_prompt(
                company_name=_company_name,
                industry=_industry,
                description=_description,
                products_names=_products_names,
                competitors_names=_competitors_names,
                use_cases=_use_cases,
                value_props=_value_props,
                pain_points=_pain_points,
                context_str=context_str,
                few_shot_examples=few_shot_examples,
                comparison_section=comparison_section,
                target_count=target_count,
                queries_per_category=queries_per_category,
                remaining=remaining
            )


        # Retry logic with exponential backoff
        max_retries = 3
        retry_delay = 1  # seconds

        for attempt in range(max_retries):
            try:
                logger.info(f"Query generation attempt {attempt + 1}/{max_retries}")

                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert AI visibility analyst and search query architect. Generate realistic search queries that real users would type. Return ONLY valid JSON, no other text."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    max_completion_tokens=16000
                )

                # Parse response
                content = response.choices[0].message.content
                if not content or content.strip() == "":
                    logger.warning(f"Empty response from LLM on attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay * (attempt + 1))
                        continue
                    else:
                        raise ValueError("LLM returned empty response after all retries")

                result = json.loads(content)
                queries_data = result.get('queries', [])

                if not queries_data:
                    logger.warning(f"No queries in response on attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay * (attempt + 1))
                        continue
                    else:
                        raise ValueError("No queries returned from LLM after all retries")

                # Convert to GeneratedQuery objects with validation and deduplication
                generated_queries = []
                seen_queries = set()  # Track unique query texts for deduplication

                for q_data in queries_data[:target_count]:
                    query_text = q_data.get('query', '').strip()

                    # Validate query text
                    if not query_text or len(query_text) < 3:
                        logger.debug(f"Skipping invalid query: '{query_text}'")
                        continue

                    # Deduplication: Check if we've already seen this exact query text
                    query_text_lower = query_text.lower()
                    if query_text_lower in seen_queries:
                        logger.debug(f"Skipping duplicate query: '{query_text}'")
                        continue

                    seen_queries.add(query_text_lower)

                    # Map category to intent and stage
                    category_str = q_data.get('category', 'solution_seeking')
                    try:
                        buyer_category = BuyerJourneyCategory(category_str)
                        primary_intent = self.CATEGORY_TO_INTENT_MAP[buyer_category][0]
                    except (ValueError, KeyError):
                        logger.debug(f"Unknown category '{category_str}', using INFORMATIONAL")
                        primary_intent = QueryIntent.INFORMATIONAL

                    # Map 6-category to 3-stage for backward compatibility
                    category_to_stage_map = {
                        'problem_unaware': 'awareness',
                        'solution_seeking': 'consideration',
                        'brand_specific': 'consideration',
                        'comparison': 'consideration',
                        'purchase_intent': 'decision',
                        'use_case': 'consideration'
                    }
                    simplified_stage = category_to_stage_map.get(category_str, 'consideration')

                    query = GeneratedQuery(
                        query_text=query_text,
                        intent=primary_intent,
                        complexity_score=float(q_data.get('complexity', 0.5)),
                        competitive_relevance=1.0 if 'comparison' in category_str else 0.3,
                        buyer_journey_stage=simplified_stage,  # 3-stage for backward compatibility
                        buyer_journey_category=category_str,  # 6-category for buyer-journey batching
                        expected_serp_features=['mixed'],
                        semantic_variations=[],
                        priority_score=float(q_data.get('priority', 5)) / 10.0,
                        persona_alignment=None,
                        industry_specificity=0.7,
                        query_id=hashlib.md5(f"{_company_name}_{query_text}".encode()).hexdigest()[:12]
                    )
                    generated_queries.append(query)

                if len(generated_queries) < target_count * 0.5:  # Less than 50% of requested
                    logger.warning(f"Only generated {len(generated_queries)}/{target_count} queries on attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay * (attempt + 1))
                        continue

                logger.info(f"Successfully generated {len(generated_queries)} valid queries")
                return generated_queries

            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (attempt + 1))
                    continue
                else:
                    # Fallback to multi-phase generation
                    logger.warning("Single-shot generation failed after all retries, falling back to multi-phase generation")
                    if context:
                        return await self._multi_phase_generate(context, target_count, diversity_threshold)
                    else:
                        # Build minimal context for fallback
                        fallback_context = QueryContext(
                            company_name=_company_name,
                            industry=_industry,
                            sub_industry=None,
                            description=_description,
                            unique_value_propositions=[],
                            target_audiences=[],
                            competitors=_competitors,
                            products_services=_products_services,
                            pain_points_solved=[],
                            geographic_markets=[],
                            technology_stack=None,
                            pricing_model=None,
                            company_size=None,
                            founding_year=None,
                            key_features=[],
                            use_cases=[],
                            integrations=None,
                            certifications=None
                        )
                        return await self._multi_phase_generate(fallback_context, target_count, diversity_threshold)

            except Exception as e:
                logger.error(f"Error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (attempt + 1))
                    continue
                else:
                    # Fallback to multi-phase generation
                    logger.warning("Single-shot generation failed after all retries, falling back to multi-phase generation")
                    if context:
                        return await self._multi_phase_generate(context, target_count, diversity_threshold)
                    else:
                        # Build minimal context for fallback
                        fallback_context = QueryContext(
                            company_name=_company_name,
                            industry=_industry,
                            sub_industry=None,
                            description=_description,
                            unique_value_propositions=[],
                            target_audiences=[],
                            competitors=_competitors,
                            products_services=_products_services,
                            pain_points_solved=[],
                            geographic_markets=[],
                            technology_stack=None,
                            pricing_model=None,
                            company_size=None,
                            founding_year=None,
                            key_features=[],
                            use_cases=[],
                            integrations=None,
                            certifications=None
                        )
                        return await self._multi_phase_generate(fallback_context, target_count, diversity_threshold)

        # Should not reach here, but just in case
        raise Exception("Query generation failed after all retries")

    def _build_b2c_prompt(
        self,
        company_name: str,
        industry: str,
        description: str,
        products_names: List[str],
        competitors_names: List[str],
        use_cases: List[str],
        value_props: List[str],
        pain_points: List[str],
        context_str: str,
        few_shot_examples: str,
        comparison_section: str,
        target_count: int,
        queries_per_category: int,
        remaining: int
    ) -> str:
        """
        Build B2C consumer shopping prompt
        Used for companies selling products/services to individual consumers
        """

        product_name = products_names[0] if products_names else company_name

        return f"""
You are a consumer shopping behavior expert and search query architect. Generate exactly {target_count} search queries that REAL SHOPPERS would use when looking to BUY products/services from {company_name} in the {industry} industry.

🛍️  CRITICAL CONTEXT: {company_name} is a B2C (Business-to-Consumer) company
    - Their CUSTOMERS are: Individual people, families, consumers
    - They sell: Physical products, consumer services, or consumer digital products
    - NOT enterprise software, NOT developer tools, NOT B2B solutions

Context:
{context_str}

🚨 CRITICAL B2C REQUIREMENTS:
✓ Generate CONSUMER SHOPPING queries - what real shoppers type
✓ Focus on: "best jeans for men", "where to buy {product_name}", "buy {product_name} online"
✓ Include: Product reviews, pricing, "near me", shopping comparisons
✓ Think: Amazon shopper, Google Shopping user, retail customer
✗ NEVER use B2B terms like: "enterprise plan", "API", "developer tools", "business solutions"
✗ NEVER generate: "sign up for {product_name} enterprise plan" - this is B2B, NOT B2C!

{few_shot_examples}

---

NOW GENERATE {target_count} CONSUMER SHOPPING QUERIES following the quality standards shown above.

Generate queries across these 6 buyer journey categories ({queries_per_category} queries each, {queries_per_category + remaining} for first category):

1. PROBLEM_UNAWARE ({queries_per_category + remaining} queries): Consumers experiencing problems but don't know solutions exist
   - Focus on consumer pain points: "why do my jeans fade", "uncomfortable shoes problem"
   - "Why is X happening?" or "X not working properly"
   - Examples: "why do {industry} products fail", "how to fix {pain_points[0] if pain_points else 'common issues'}"

2. SOLUTION_SEEKING ({queries_per_category} queries): Consumers actively looking for products/solutions
   - "best {industry} products 2025", "top {product_name} alternatives"
   - "how to choose {industry} product", "what to look for in {product_name}"
   - Examples: "best {industry} for [consumer need]", "affordable {product_name} options"

3. BRAND_SPECIFIC ({queries_per_category} queries): Consumers specifically searching for {company_name}
   - Direct brand mentions: "{company_name} review", "{product_name} price", "buy {product_name}"
   - "{company_name} near me", "{product_name} sale", "{company_name} store locations"
   - "{product_name} reviews 2025", "is {product_name} worth it"

{comparison_section}

5. PURCHASE_INTENT ({queries_per_category} queries): Consumers ready to buy
   - "buy {product_name} online", "{product_name} price", "order {product_name}"
   - "where to buy {product_name}", "{company_name} store", "{product_name} discount"
   - "{product_name} on sale", "cheap {product_name}", "{product_name} deals"

6. USE_CASE ({queries_per_category} queries): Consumers looking for specific applications
   - "{product_name} for [specific consumer need]"
   - "best {industry} product for [use case]"
   - Examples: "{product_name} for outdoor activities", "durable {product_name} for work"

CONSUMER SHOPPING QUERY PATTERNS:
✓ Shopping: "buy X", "X on sale", "X discount", "cheap X", "affordable X"
✓ Location: "X near me", "X store locations", "where to buy X"
✓ Reviews: "X reviews", "is X good", "X vs Y comparison", "best X"
✓ Product info: "X price", "X features", "X colors", "X sizes"
✓ Mobile: "X delivery", "X online shopping", "X free shipping"
✓ Year-specific: "best X 2025", "new X 2025", "X trends 2025"

🚫 AVOID THESE B2B PATTERNS (WRONG FOR CONSUMERS):
✗ "enterprise plan", "API", "developer tools", "business solutions"
✗ "sign up for enterprise", "B2B integration", "white-label solution"
✗ "SaaS platform", "cloud infrastructure", "SDK"

Return as a JSON object with a "queries" array containing exactly {target_count} objects, each with:
{{
    "query": "the search query text (CONSUMER SHOPPING ONLY)",
    "category": "problem_unaware|solution_seeking|brand_specific|comparison|purchase_intent|use_case",
    "intent": "informational|navigational|commercial|transactional",
    "priority": 1-10 (higher = more important for visibility),
    "complexity": 0-1 (0=simple, 1=complex/specific),
    "buyer_stage": "awareness|consideration|decision"
}}

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.
"""

    def _build_b2b_prompt(
        self,
        company_name: str,
        industry: str,
        description: str,
        products_names: List[str],
        competitors_names: List[str],
        use_cases: List[str],
        value_props: List[str],
        pain_points: List[str],
        context_str: str,
        few_shot_examples: str,
        comparison_section: str,
        target_count: int,
        queries_per_category: int,
        remaining: int
    ) -> str:
        """
        Build B2B enterprise prompt (original prompt)
        Used for companies selling to businesses/enterprises
        """

        return f"""
You are an AI visibility expert and search query architect. Generate exactly {target_count} search queries that potential customers would use to find {company_name} or similar solutions in the {industry} industry.

Context:
{context_str}

{few_shot_examples}

---

NOW GENERATE {target_count} QUERIES following the quality standards shown above.

Generate queries across these 6 buyer journey categories ({queries_per_category} queries each, {queries_per_category + remaining} for first category):

1. PROBLEM_UNAWARE ({queries_per_category + remaining} queries): Users experiencing problems but don't know solutions exist
   - Focus on pain points and symptoms
   - "Why is X happening?" or "X not working properly"

2. SOLUTION_SEEKING ({queries_per_category} queries): Users actively looking for solutions in this space
   - "How to solve X" or "Best way to improve Y"
   - Solution-oriented searches

3. BRAND_SPECIFIC ({queries_per_category} queries): Users specifically searching for {company_name}
   - Direct brand mentions
   - "{company_name} review", "{company_name} pricing", "{company_name} vs"

{comparison_section}

5. PURCHASE_INTENT ({queries_per_category} queries): Users ready to buy or sign up
   - "buy {industry} software", "{company_name} pricing"
   - "get started with X", "sign up for Y"

6. USE_CASE ({queries_per_category} queries): Users looking for specific applications
   - "{industry} for [specific use case]"
   - "How to use X for Y"

CRITICAL REQUIREMENTS:
✓ Make queries realistic and natural - exactly what real users would type
✓ Include long-tail keywords (specific, detailed phrases)
✓ Vary query length: 2-8 words (mix short and detailed)
✓ Include multiple formats:
  - Questions ("How do I...?", "What is the best...?", "Why should I...?")
  - Statements ("best tools for X", "top solutions")
  - Keyword combinations ("X tool Y industry")
✓ Be specific to the {industry} industry
✓ Consider voice search patterns (conversational, question-based)
✓ Include "near me" and local variations where relevant
✓ Include year-specific queries ("best X 2025")
✓ Include mobile-friendly queries (shorter, conversational)
✓ Include feature-specific queries about {company_name}'s capabilities
✓ Include pricing and cost-related queries
✓ Include integration and compatibility queries

Return as a JSON object with a "queries" array containing exactly {target_count} objects, each with:
{{
    "query": "the search query text",
    "category": "problem_unaware|solution_seeking|brand_specific|comparison|purchase_intent|use_case",
    "intent": "informational|navigational|commercial|transactional",
    "priority": 1-10 (higher = more important for visibility),
    "complexity": 0-1 (0=simple, 1=complex/specific),
    "buyer_stage": "awareness|consideration|decision"
}}

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.
"""

    def _build_b2b2c_hybrid_prompt(
        self,
        company_name: str,
        industry: str,
        description: str,
        products_names: List[str],
        competitors_names: List[str],
        use_cases: List[str],
        value_props: List[str],
        pain_points: List[str],
        context_str: str,
        few_shot_examples: str,
        comparison_section: str,
        target_count: int,
        queries_per_category: int,
        remaining: int
    ) -> str:
        """
        Build B2B2C hybrid prompt
        Used for companies selling to businesses who serve consumers (e.g., Shopify, Stripe)
        """

        b2b_count = target_count // 2
        b2c_count = target_count - b2b_count

        return f"""
You are an AI visibility expert and search query architect. Generate exactly {target_count} search queries for {company_name}, a B2B2C (Business-to-Business-to-Consumer) company in the {industry} industry.

🔀 CRITICAL CONTEXT: {company_name} is a B2B2C HYBRID company
    - They sell TO: Businesses, merchants, developers
    - Their customers SERVE: End consumers
    - Example: Shopify (sells to merchants → merchants sell to consumers)

Context:
{context_str}

{few_shot_examples}

---

NOW GENERATE {target_count} HYBRID QUERIES with the following distribution:

🏢 B2B QUERIES ({b2b_count} queries): Target business customers, merchants, developers
   - "best {industry} platform for businesses"
   - "{company_name} for merchants", "{company_name} API documentation"
   - "integrate {company_name} into my business"

🛍️  B2C-INFLUENCED QUERIES ({b2c_count} queries): Target businesses serving consumers
   - "platform to sell products online"
   - "how to start online store", "accept payments online"
   - "{company_name} for small business selling to consumers"

Generate queries across these 6 buyer journey categories (split between B2B and B2C-influenced):

1. PROBLEM_UNAWARE: Business pain points that affect consumer-facing operations
2. SOLUTION_SEEKING: Businesses looking for platforms to serve consumers
3. BRAND_SPECIFIC: Direct brand searches from potential business customers
{comparison_section}
5. PURCHASE_INTENT: Businesses ready to sign up
6. USE_CASE: Specific business use cases for serving consumers

Return as a JSON object with a "queries" array containing exactly {target_count} objects, each with:
{{
    "query": "the search query text",
    "category": "problem_unaware|solution_seeking|brand_specific|comparison|purchase_intent|use_case",
    "intent": "informational|navigational|commercial|transactional",
    "priority": 1-10 (higher = more important for visibility),
    "complexity": 0-1 (0=simple, 1=complex/specific),
    "buyer_stage": "awareness|consideration|decision"
}}

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.
"""

    async def _multi_phase_generate(
        self,
        context: QueryContext,
        target_count: int,
        diversity_threshold: float
    ) -> List[GeneratedQuery]:
        """
        Multi-phase query generation (fallback method).
        Uses sophisticated 5-phase approach but requires multiple API calls.
        """
        logger.info(f"Using multi-phase generation fallback for {context.company_name}")

        # Phase 1: Analyze context and generate query strategy
        strategy = await self._generate_query_strategy(context)

        # Phase 2: Generate queries in parallel batches
        queries = await self._generate_query_batches(context, strategy, target_count)

        # Phase 3: Enhance queries with variations and metadata
        enhanced_queries = await self._enhance_queries(queries, context)

        # Phase 4: Diversity optimization and deduplication
        optimized_queries = self._optimize_query_diversity(enhanced_queries, diversity_threshold)

        # Phase 5: Priority scoring and ranking
        final_queries = self._score_and_rank_queries(optimized_queries, context)

        logger.info(f"Multi-phase generation completed: {len(final_queries)} queries")
        return final_queries[:target_count]

    async def _generate_query_strategy(self, context: QueryContext) -> Dict[str, Any]:
        """Use GPT-5 to create a comprehensive query generation strategy"""
        
        strategy_prompt = f"""
        As an expert in search behavior and AI visibility analysis, create a comprehensive
        query generation strategy for the following company:
        
        Company: {context.company_name}
        Industry: {context.industry}
        Description: {context.description}
        Target Audiences: {json.dumps(context.target_audiences)}
        Competitors: {', '.join(context.competitors)}
        Key Value Props: {', '.join(context.unique_value_propositions)}
        Pain Points Solved: {', '.join(context.pain_points_solved)}
        
        Generate a JSON strategy including:
        1. Key search themes users would explore
        2. Intent distribution (what % of each intent type)
        3. Competitive angles to explore
        4. Industry-specific terminology to include
        5. Long-tail query patterns
        6. Question-based queries
        7. Comparison patterns
        8. Problem/solution query pairs
        9. Feature-specific queries
        10. Use case scenarios
        
        Return a detailed JSON strategy optimized for comprehensive AI visibility testing.
        """
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an expert in search behavior analysis and query generation."},
                {"role": "user", "content": strategy_prompt}
            ],
            response_format={"type": "json_object"},
            # GPT-5 Nano only supports temperature=1 (default), so we omit it
            max_completion_tokens=8000  # GPT-5 Nano requires max_completion_tokens
        )
        
        return json.loads(response.choices[0].message.content)
    
    async def _generate_query_batches(
        self,
        context: QueryContext,
        strategy: Dict[str, Any],
        target_count: int
    ) -> List[Dict[str, Any]]:
        """Generate queries in parallel batches for efficiency"""
        
        queries_per_intent = self._calculate_intent_distribution(target_count)
        generation_tasks = []
        
        for intent, count in queries_per_intent.items():
            task = self._generate_intent_queries(context, strategy, intent, count)
            generation_tasks.append(task)
        
        # Parallel execution for speed
        batch_results = await asyncio.gather(*generation_tasks)
        
        # Flatten results
        all_queries = []
        for batch in batch_results:
            all_queries.extend(batch)
        
        return all_queries
    
    async def _generate_intent_queries(
        self,
        context: QueryContext,
        strategy: Dict[str, Any],
        intent: QueryIntent,
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate queries for specific intent using GPT-5"""
        
        intent_prompts = {
            QueryIntent.COMMERCIAL_INVESTIGATION: f"""
            Generate {count} commercial investigation queries for {context.company_name}.
            These should be queries users would search when evaluating solutions in the {context.industry} space.
            Include queries about pricing, features, comparisons, and evaluation criteria.
            Consider competitors: {', '.join(context.competitors[:3]) if context.competitors else 'N/A'}
            """,
            
            QueryIntent.COMPARATIVE: f"""
            Generate {count} comparative queries involving {context.company_name}.
            Include direct comparisons with competitors: {', '.join(context.competitors)}
            Also include category comparisons like "best {context.industry} tools" or "top {context.industry} solutions"
            """,
            
            QueryIntent.INFORMATIONAL: f"""
            Generate {count} informational queries about {context.industry} and solutions like {context.company_name}.
            Include how-to queries, what-is queries, and educational content queries.
            Focus on problems solved: {', '.join(context.pain_points_solved[:3])}
            """,
            
            QueryIntent.PROBLEM_SOLVING: f"""
            Generate {count} problem-solving queries that {context.company_name} could address.
            Focus on pain points: {', '.join(context.pain_points_solved)}
            Include "how to" queries and solution-seeking queries.
            """,
            
            QueryIntent.TRANSACTIONAL: f"""
            Generate {count} transactional queries for {context.company_name} and similar {context.industry} services.
            Include buying intent, signup intent, and trial-seeking queries.
            Products/services: {', '.join(context.products_services[:3]) if context.products_services else (context.description[:100] if context.description else 'Not specified')}
            """,
            
            QueryIntent.REVIEW_SEEKING: f"""
            Generate {count} review and testimonial seeking queries for {context.company_name}.
            Include queries about reviews, ratings, testimonials, case studies, and user experiences.
            Industry context: {context.industry}
            """
        }
        
        prompt = intent_prompts.get(intent, f"Generate {count} {intent.value} queries for {context.company_name}")
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": """Generate diverse, realistic search queries that real users would type.
                    Vary the length, specificity, and phrasing. Include both short and long-tail queries.
                    Return as JSON array with each query having: query_text, complexity (0-1), buyer_stage"""
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            # GPT-5 Nano only supports temperature=1 (default), so we omit it
            max_completion_tokens=8000  # GPT-5 Nano requires max_completion_tokens
        )
        
        result = json.loads(response.choices[0].message.content)
        queries = result.get("queries", [])
        
        # Add intent metadata
        for query in queries:
            query["intent"] = intent.value
            query["generated_at"] = datetime.now().isoformat()
        
        return queries
    
    async def _enhance_queries(
        self,
        queries: List[Dict[str, Any]],
        context: QueryContext
    ) -> List[GeneratedQuery]:
        """Enhance queries with semantic variations and metadata"""
        
        enhanced = []
        
        # Batch process for efficiency
        batch_size = 10
        for i in range(0, len(queries), batch_size):
            batch = queries[i:i+batch_size]
            
            variations_prompt = f"""
            For each query below, generate 2-3 semantic variations that preserve intent but use different phrasing.
            Also identify expected SERP features (featured snippet, local pack, knowledge panel, etc.)
            
            Queries: {json.dumps([q['query_text'] for q in batch])}
            Company context: {context.company_name} in {context.industry}
            
            Return JSON with variations and SERP features for each query.
            """
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert in search query analysis and SERP features."},
                    {"role": "user", "content": variations_prompt}
                ],
                response_format={"type": "json_object"},
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                max_completion_tokens=8000  # GPT-5 Nano requires max_completion_tokens
            )
            
            enhancements = json.loads(response.choices[0].message.content)
            
            for j, query in enumerate(batch):
                buyer_stage = query.get('buyer_stage', 'consideration')
                # Infer category from stage for backward compatibility
                stage_to_category_map = {
                    'awareness': 'problem_unaware',
                    'consideration': 'solution_seeking',
                    'decision': 'purchase_intent'
                }
                buyer_category = stage_to_category_map.get(buyer_stage, 'solution_seeking')

                enhanced_query = GeneratedQuery(
                    query_text=query['query_text'],
                    intent=QueryIntent(query['intent']),
                    complexity_score=query.get('complexity', 0.5),
                    competitive_relevance=self._calculate_competitive_relevance(query['query_text'], context),
                    buyer_journey_stage=buyer_stage,
                    buyer_journey_category=buyer_category,
                    expected_serp_features=enhancements.get(f'query_{j}', {}).get('serp_features', []),
                    semantic_variations=enhancements.get(f'query_{j}', {}).get('variations', []),
                    priority_score=0.5,  # Will be calculated later
                    persona_alignment=None,
                    industry_specificity=self._calculate_industry_specificity(query['query_text'], context)
                )
                enhanced.append(enhanced_query)
        
        return enhanced
    
    def _optimize_query_diversity(
        self,
        queries: List[GeneratedQuery],
        diversity_threshold: float
    ) -> List[GeneratedQuery]:
        """Ensure query diversity using semantic similarity"""
        
        # Simple diversity check based on query text similarity
        # In production, use sentence embeddings for better similarity
        
        optimized = []
        seen_patterns = set()
        
        for query in queries:
            # Create a simple pattern signature
            pattern = self._get_query_pattern(query.query_text)
            
            if pattern not in seen_patterns:
                optimized.append(query)
                seen_patterns.add(pattern)
                
                # Also add variation patterns to avoid too similar queries
                for variation in query.semantic_variations[:1]:
                    seen_patterns.add(self._get_query_pattern(variation))
        
        return optimized
    
    def _score_and_rank_queries(
        self,
        queries: List[GeneratedQuery],
        context: QueryContext
    ) -> List[GeneratedQuery]:
        """Score and rank queries by priority"""
        
        for query in queries:
            # Multi-factor scoring
            intent_score = self.intent_weights.get(query.intent, 0.1)
            competitive_score = query.competitive_relevance * 0.3
            complexity_score = (0.5 - abs(query.complexity_score - 0.6)) * 2  # Prefer medium complexity
            industry_score = query.industry_specificity * 0.2
            
            # Buyer journey weighting
            journey_weights = {
                'awareness': 0.2,
                'consideration': 0.4,
                'decision': 0.3,
                'retention': 0.1
            }
            journey_score = journey_weights.get(query.buyer_journey_stage, 0.2)
            
            # Calculate final priority
            query.priority_score = (
                intent_score * 0.35 +
                competitive_score * 0.25 +
                complexity_score * 0.15 +
                industry_score * 0.15 +
                journey_score * 0.10
            )
        
        # Sort by priority
        return sorted(queries, key=lambda q: q.priority_score, reverse=True)
    
    def _calculate_intent_distribution(self, target_count: int) -> Dict[QueryIntent, int]:
        """Calculate how many queries per intent type"""
        
        distribution = {}
        remaining = target_count
        
        for intent, weight in self.intent_weights.items():
            count = int(target_count * weight)
            distribution[intent] = count
            remaining -= count
        
        # Add remaining to most important intent
        if remaining > 0:
            distribution[QueryIntent.COMMERCIAL_INVESTIGATION] += remaining
        
        return distribution
    
    def _calculate_competitive_relevance(self, query_text: str, context: QueryContext) -> float:
        """Calculate how likely this query is to surface competitors"""
        
        query_lower = query_text.lower()
        score = 0.0
        
        # Check for competitive indicators
        competitive_terms = ['best', 'top', 'compare', 'vs', 'versus', 'alternative', 
                           'review', 'better than', 'comparison', 'which']
        
        for term in competitive_terms:
            if term in query_lower:
                score += 0.2
        
        # Check for competitor mentions
        for competitor in context.competitors:
            if competitor.lower() in query_lower:
                score += 0.3
        
        # Check for category terms
        if context.industry.lower() in query_lower:
            score += 0.1
        
        return min(score, 1.0)
    
    def _calculate_industry_specificity(self, query_text: str, context: QueryContext) -> float:
        """Calculate how industry-specific the query is"""
        
        query_lower = query_text.lower()
        score = 0.0
        
        # Check for industry terms
        if context.industry.lower() in query_lower:
            score += 0.3
        
        if context.sub_industry and context.sub_industry.lower() in query_lower:
            score += 0.2
        
        # Check for industry-specific features
        for feature in context.key_features[:5]:
            if feature.lower() in query_lower:
                score += 0.1
        
        return min(score, 1.0)

    def _get_query_pattern(self, query_text: str) -> str:
        """Extract query pattern for diversity checking"""

        # Simple pattern extraction - in production use better NLP
        words = query_text.lower().split()

        # Remove stop words and keep structure
        important_words = [w for w in words if len(w) > 3]

        return ' '.join(important_words[:5])