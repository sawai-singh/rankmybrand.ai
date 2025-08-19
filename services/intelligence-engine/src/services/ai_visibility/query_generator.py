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
    """Structured query with metadata"""
    query_text: str
    intent: QueryIntent
    complexity_score: float  # 0-1, higher = more complex/specific
    competitive_relevance: float  # 0-1, likelihood of competitive comparison
    buyer_journey_stage: str  # awareness, consideration, decision, retention
    expected_serp_features: List[str]  # featured snippet, local pack, etc.
    semantic_variations: List[str]
    priority_score: float  # 0-1, importance for brand visibility
    persona_alignment: Optional[str]
    industry_specificity: float  # 0-1, how industry-specific
    query_id: str = field(default_factory=lambda: hashlib.md5(
        str(datetime.now()).encode()).hexdigest()[:12])


class IntelligentQueryGenerator:
    """GPT-5 powered query generation with advanced context understanding"""
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o"):
        """Initialize with GPT-5 or fallback to GPT-4"""
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        self.query_cache = {}
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
    
    async def generate_queries(
        self,
        context: QueryContext,
        target_count: int = 50,
        diversity_threshold: float = 0.7
    ) -> List[GeneratedQuery]:
        """Generate diverse, high-quality queries using GPT-5"""
        
        logger.info(f"Generating {target_count} queries for {context.company_name}")
        
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
        
        logger.info(f"Generated {len(final_queries)} high-quality queries")
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
            temperature=0.7
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
            Products/services: {', '.join(context.products_services[:3]) if context.products_services else context.description[:100]}
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
            temperature=0.8,
            max_tokens=2000
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
                temperature=0.6
            )
            
            enhancements = json.loads(response.choices[0].message.content)
            
            for j, query in enumerate(batch):
                enhanced_query = GeneratedQuery(
                    query_text=query['query_text'],
                    intent=QueryIntent(query['intent']),
                    complexity_score=query.get('complexity', 0.5),
                    competitive_relevance=self._calculate_competitive_relevance(query['query_text'], context),
                    buyer_journey_stage=query.get('buyer_stage', 'consideration'),
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