"""
Professional AI Visibility Service
Orchestrates the entire AI visibility analysis pipeline for user reports
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
from dataclasses import dataclass, asdict
import hashlib

from ..analysis.query_generator import IntelligentQueryGenerator, QueryContext, GeneratedQuery
from ..analysis.llm_orchestrator import LLMOrchestrator as MultiLLMOrchestrator, LLMProvider
from ..analysis.response_analyzer import UnifiedResponseAnalyzer as LLMResponseAnalyzer, ResponseAnalysis

logger = logging.getLogger(__name__)


@dataclass
class AIVisibilityReport:
    """Complete AI Visibility analysis report"""
    report_id: str
    company_id: int
    company_name: str
    generated_at: datetime
    
    # Query generation results
    queries_generated: int
    queries: List[GeneratedQuery]
    
    # LLM response analysis
    total_llm_calls: int
    responses_by_provider: Dict[str, int]
    
    # Visibility metrics
    overall_visibility_score: float
    brand_mention_rate: float
    positive_sentiment_rate: float
    competitive_position: str  # leader, challenger, follower, niche
    
    # Platform-specific scores
    platform_scores: Dict[str, float]
    
    # Key insights
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    recommendations: List[str]
    
    # Raw data for admin tracking
    raw_responses: List[Dict[str, Any]]
    processing_time_seconds: float
    

class AIVisibilityService:
    """
    Main service orchestrating AI visibility analysis
    This runs automatically when a user's report is generated
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.query_generator = IntelligentQueryGenerator(
            openai_api_key=config['openai_api_key']
        )
        self.llm_orchestrator = MultiLLMOrchestrator(
            OrchestratorConfig(
                openai_api_key=config['openai_api_key'],
                anthropic_api_key=config.get('anthropic_api_key'),
                google_api_key=config.get('google_api_key'),
                perplexity_api_key=config.get('perplexity_api_key'),
                max_concurrent_requests=10,
                timeout_seconds=30,
                retry_attempts=3
            )
        )
        self.response_analyzer = LLMResponseAnalyzer()
        self.visibility_scorer = VisibilityScorer()
        
    async def generate_visibility_report(
        self,
        company_id: int,
        company_data: Dict[str, Any],
        trigger_source: str = 'report_generation'
    ) -> AIVisibilityReport:
        """
        Generate complete AI visibility report for a company
        This is triggered automatically during report generation
        """
        start_time = datetime.now()
        report_id = str(uuid.uuid4())
        
        logger.info(f"Starting AI Visibility analysis for company {company_id}")
        logger.info(f"Report ID: {report_id}, Trigger: {trigger_source}")
        
        try:
            # Step 1: Generate intelligent queries based on company context
            logger.info("Step 1: Generating AI queries...")
            query_context = self._build_query_context(company_data)
            queries = await self.query_generator.generate_queries(
                context=query_context,
                target_count=45,  # Generate 40-50 queries
                diversity_threshold=0.7
            )
            logger.info(f"Generated {len(queries)} queries")
            
            # Store queries in database for historical tracking
            await self._store_queries(company_id, report_id, queries)
            
            # Step 2: Send queries to multiple LLMs
            logger.info("Step 2: Orchestrating LLM calls...")
            all_responses = []
            
            for query in queries:
                responses = await self.llm_orchestrator.query_all_providers(
                    query=query.query_text,
                    context={
                        'company_name': company_data['name'],
                        'industry': company_data.get('industry'),
                        'competitors': company_data.get('competitors', [])
                    }
                )
                
                # Analyze each response
                for provider, response in responses.items():
                    if response and not response.get('error'):
                        analysis = await self.response_analyzer.analyze(
                            query=query.query_text,
                            response=response['content'],
                            company_name=company_data['name'],
                            competitors=company_data.get('competitors', [])
                        )
                        
                        all_responses.append({
                            'query_id': query.query_id,
                            'query_text': query.query_text,
                            'provider': provider,
                            'response': response['content'],
                            'analysis': asdict(analysis),
                            'timestamp': datetime.now().isoformat()
                        })
            
            logger.info(f"Collected {len(all_responses)} LLM responses")
            
            # Store responses for historical tracking
            await self._store_responses(company_id, report_id, all_responses)
            
            # Step 3: Calculate visibility scores
            logger.info("Step 3: Calculating visibility scores...")
            visibility_metrics = self.visibility_scorer.calculate_scores(
                responses=all_responses,
                company_name=company_data['name']
            )
            
            # Step 4: Generate insights and recommendations
            logger.info("Step 4: Generating insights...")
            insights = await self._generate_insights(
                queries=queries,
                responses=all_responses,
                metrics=visibility_metrics,
                company_data=company_data
            )
            
            # Step 5: Compile final report
            processing_time = (datetime.now() - start_time).total_seconds()
            
            report = AIVisibilityReport(
                report_id=report_id,
                company_id=company_id,
                company_name=company_data['name'],
                generated_at=datetime.now(),
                queries_generated=len(queries),
                queries=queries,
                total_llm_calls=len(all_responses),
                responses_by_provider=self._count_responses_by_provider(all_responses),
                overall_visibility_score=visibility_metrics['overall_score'],
                brand_mention_rate=visibility_metrics['brand_mention_rate'],
                positive_sentiment_rate=visibility_metrics['positive_sentiment_rate'],
                competitive_position=visibility_metrics['competitive_position'],
                platform_scores=visibility_metrics['platform_scores'],
                strengths=insights['strengths'],
                weaknesses=insights['weaknesses'],
                opportunities=insights['opportunities'],
                recommendations=insights['recommendations'],
                raw_responses=all_responses,
                processing_time_seconds=processing_time
            )
            
            # Store complete report
            await self._store_report(report)
            
            logger.info(f"AI Visibility report completed in {processing_time:.2f} seconds")
            logger.info(f"Overall visibility score: {report.overall_visibility_score:.2f}")
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate AI visibility report: {str(e)}")
            raise
    
    def _build_query_context(self, company_data: Dict[str, Any]) -> QueryContext:
        """Build query context from company data"""
        return QueryContext(
            company_name=company_data['name'],
            industry=company_data.get('industry', 'Technology'),
            sub_industry=company_data.get('sub_industry'),
            description=company_data.get('description', ''),
            unique_value_propositions=company_data.get('value_props', []),
            target_audiences=company_data.get('target_audiences', []),
            competitors=company_data.get('competitors', []),
            products_services=company_data.get('products', []),
            pain_points_solved=company_data.get('pain_points', []),
            geographic_markets=company_data.get('markets', []),
            technology_stack=company_data.get('tech_stack'),
            pricing_model=company_data.get('pricing_model'),
            company_size=company_data.get('company_size'),
            founding_year=company_data.get('founding_year'),
            key_features=company_data.get('features', []),
            use_cases=company_data.get('use_cases', []),
            integrations=company_data.get('integrations'),
            certifications=company_data.get('certifications'),
            metadata=company_data.get('metadata', {})
        )
    
    async def _store_queries(self, company_id: int, report_id: str, queries: List[GeneratedQuery]):
        """Store generated queries in database for historical tracking"""
        # This will be called by the database layer
        # Queries are stored so admin can view them later
        pass
    
    async def _store_responses(self, company_id: int, report_id: str, responses: List[Dict]):
        """Store LLM responses for historical tracking"""
        # This will be called by the database layer
        # Responses are stored for admin analysis
        pass
    
    async def _store_report(self, report: AIVisibilityReport):
        """Store complete report in database"""
        # This will be called by the database layer
        pass
    
    def _count_responses_by_provider(self, responses: List[Dict]) -> Dict[str, int]:
        """Count responses by provider"""
        counts = {}
        for response in responses:
            provider = response['provider']
            counts[provider] = counts.get(provider, 0) + 1
        return counts
    
    async def _generate_insights(
        self,
        queries: List[GeneratedQuery],
        responses: List[Dict],
        metrics: Dict[str, Any],
        company_data: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """Generate actionable insights from analysis"""
        
        insights = {
            'strengths': [],
            'weaknesses': [],
            'opportunities': [],
            'recommendations': []
        }
        
        # Analyze brand mention rate
        if metrics['brand_mention_rate'] > 0.3:
            insights['strengths'].append(
                f"Strong brand visibility with {metrics['brand_mention_rate']*100:.1f}% mention rate across AI platforms"
            )
        else:
            insights['weaknesses'].append(
                f"Low brand visibility with only {metrics['brand_mention_rate']*100:.1f}% mention rate"
            )
            insights['recommendations'].append(
                "Increase content marketing and thought leadership to improve AI platform visibility"
            )
        
        # Analyze sentiment
        if metrics['positive_sentiment_rate'] > 0.7:
            insights['strengths'].append(
                "Excellent brand perception with predominantly positive sentiment"
            )
        elif metrics['positive_sentiment_rate'] < 0.4:
            insights['weaknesses'].append(
                "Brand perception needs improvement - low positive sentiment rate"
            )
        
        # Platform-specific insights
        top_platforms = sorted(
            metrics['platform_scores'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        if top_platforms:
            insights['strengths'].append(
                f"Best visibility on: {', '.join([p[0] for p in top_platforms])}"
            )
        
        # Competitive positioning
        if metrics['competitive_position'] == 'leader':
            insights['strengths'].append(
                "Market leader position in AI-generated recommendations"
            )
        elif metrics['competitive_position'] == 'follower':
            insights['opportunities'].append(
                "Opportunity to differentiate from competitors and improve market position"
            )
        
        # Query-specific insights
        high_priority_queries = [q for q in queries if q.priority_score > 0.8]
        if len(high_priority_queries) > 0:
            low_visibility_critical = []
            for query in high_priority_queries[:5]:
                query_responses = [r for r in responses if r['query_id'] == query.query_id]
                mentions = sum(1 for r in query_responses if r['analysis']['brand_mentioned'])
                if mentions < len(query_responses) * 0.3:
                    low_visibility_critical.append(query.query_text)
            
            if low_visibility_critical:
                insights['recommendations'].append(
                    f"Focus on improving visibility for critical queries: {', '.join(low_visibility_critical[:2])}"
                )
        
        return insights


class VisibilityScorer:
    """Calculate visibility scores from LLM responses"""
    
    def calculate_scores(
        self,
        responses: List[Dict[str, Any]],
        company_name: str
    ) -> Dict[str, Any]:
        """Calculate comprehensive visibility scores"""
        
        if not responses:
            return {
                'overall_score': 0,
                'brand_mention_rate': 0,
                'positive_sentiment_rate': 0,
                'competitive_position': 'unknown',
                'platform_scores': {}
            }
        
        # Calculate brand mention rate
        total_responses = len(responses)
        brand_mentions = sum(
            1 for r in responses 
            if r['analysis']['brand_mentioned']
        )
        brand_mention_rate = brand_mentions / total_responses if total_responses > 0 else 0
        
        # Calculate sentiment rates
        positive_mentions = sum(
            1 for r in responses 
            if r['analysis']['brand_mentioned'] and r['analysis']['sentiment'] == 'positive'
        )
        positive_sentiment_rate = positive_mentions / brand_mentions if brand_mentions > 0 else 0
        
        # Calculate platform-specific scores
        platform_scores = {}
        providers = set(r['provider'] for r in responses)
        
        for provider in providers:
            provider_responses = [r for r in responses if r['provider'] == provider]
            provider_mentions = sum(
                1 for r in provider_responses 
                if r['analysis']['brand_mentioned']
            )
            platform_scores[provider] = (
                provider_mentions / len(provider_responses) * 100 
                if provider_responses else 0
            )
        
        # Calculate overall visibility score (0-100)
        overall_score = (
            brand_mention_rate * 40 +  # 40% weight on mention rate
            positive_sentiment_rate * 30 +  # 30% weight on positive sentiment
            (sum(platform_scores.values()) / len(platform_scores) if platform_scores else 0) * 0.3  # 30% weight on platform average
        )
        
        # Determine competitive position
        if brand_mention_rate > 0.5:
            competitive_position = 'leader'
        elif brand_mention_rate > 0.3:
            competitive_position = 'challenger'
        elif brand_mention_rate > 0.15:
            competitive_position = 'follower'
        else:
            competitive_position = 'niche'
        
        return {
            'overall_score': min(100, overall_score * 100),
            'brand_mention_rate': brand_mention_rate,
            'positive_sentiment_rate': positive_sentiment_rate,
            'competitive_position': competitive_position,
            'platform_scores': platform_scores
        }