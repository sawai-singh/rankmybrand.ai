"""
BullMQ Job Processor for AI Visibility Audits
Handles background processing of audit jobs with resilience and monitoring
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging
import traceback
import psycopg2
from psycopg2.extras import RealDictCursor
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge
import aiohttp
import os

# Import our modules
from query_generator import IntelligentQueryGenerator, QueryContext
from llm_orchestrator import MultiLLMOrchestrator, LLMProvider
from response_analyzer import LLMResponseAnalyzer
from cache_manager import IntelligentCacheManager, CacheConfig
from websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

# =====================================================
# Metrics
# =====================================================

audit_jobs_total = Counter('audit_jobs_total', 'Total number of audit jobs processed', ['status'])
audit_processing_time = Histogram('audit_processing_duration_seconds', 'Time spent processing audits')
active_audits = Gauge('active_audits', 'Number of currently processing audits')
query_generation_time = Histogram('query_generation_duration_seconds', 'Time to generate queries')
llm_api_calls = Counter('llm_api_calls_total', 'Total LLM API calls', ['provider', 'status'])
analysis_time = Histogram('analysis_duration_seconds', 'Time spent analyzing responses')

# =====================================================
# Configuration
# =====================================================

@dataclass
class ProcessorConfig:
    """Job processor configuration"""
    
    # Database
    db_host: str = os.getenv('DB_HOST', 'localhost')
    db_port: int = int(os.getenv('DB_PORT', '5432'))
    db_name: str = os.getenv('DB_NAME', 'rankmybrand')
    db_user: str = os.getenv('DB_USER', 'postgres')
    db_password: str = os.getenv('DB_PASSWORD', '')
    
    # Redis
    redis_host: str = os.getenv('REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('REDIS_PORT', '6379'))
    
    # API Keys
    openai_key: str = os.getenv('OPENAI_API_KEY', '')
    anthropic_key: str = os.getenv('ANTHROPIC_API_KEY', '')
    google_key: str = os.getenv('GOOGLE_API_KEY', '')
    perplexity_key: str = os.getenv('PERPLEXITY_API_KEY', '')
    
    # Processing
    max_concurrent_queries: int = 10
    max_concurrent_analyses: int = 5
    batch_size: int = 5
    
    # Timeouts
    query_timeout: int = 30  # seconds
    analysis_timeout: int = 20  # seconds
    total_job_timeout: int = 1800  # 30 minutes


class AuditJobProcessor:
    """Process AI Visibility audit jobs"""
    
    def __init__(self, config: ProcessorConfig):
        self.config = config
        
        # Initialize connections
        self.db_conn = None
        self.redis_client = None
        self.cache_manager = None
        self.ws_manager = None
        
        # Initialize service components
        self.query_generator = None
        self.llm_orchestrator = None
        self.response_analyzer = None
        
        # Processing state
        self.is_running = False
        self.current_jobs: Dict[str, Any] = {}
    
    async def initialize(self):
        """Initialize all connections and services"""
        
        logger.info("Initializing AI Visibility Job Processor")
        
        # Database connection
        self.db_conn = psycopg2.connect(
            host=self.config.db_host,
            port=self.config.db_port,
            database=self.config.db_name,
            user=self.config.db_user,
            password=self.config.db_password,
            cursor_factory=RealDictCursor
        )
        self.db_conn.autocommit = False
        
        # Redis connection
        self.redis_client = redis.Redis(
            host=self.config.redis_host,
            port=self.config.redis_port,
            decode_responses=True
        )
        
        # Initialize cache manager
        self.cache_manager = IntelligentCacheManager(
            self.redis_client,
            CacheConfig()
        )
        
        # Initialize WebSocket manager
        self.ws_manager = WebSocketManager(self.redis_client)
        await self.ws_manager.start()
        
        # Initialize service components
        self.query_generator = IntelligentQueryGenerator(
            self.config.openai_key,
            model="gpt-4o"
        )
        
        self.llm_orchestrator = MultiLLMOrchestrator(
            openai_key=self.config.openai_key,
            anthropic_key=self.config.anthropic_key,
            google_key=self.config.google_key,
            perplexity_key=self.config.perplexity_key,
            cache_client=self.cache_manager
        )
        
        self.response_analyzer = LLMResponseAnalyzer(
            self.config.openai_key,
            model="gpt-4o"
        )
        
        # Warmup providers
        await self.llm_orchestrator.warmup()
        
        logger.info("Job Processor initialized successfully")
    
    async def process_audit_job(self, job_data: Dict[str, Any]):
        """Process a single audit job"""
        
        audit_id = job_data['auditId']
        company_id = job_data.get('companyId')
        user_id = job_data['userId']
        query_count = job_data.get('queryCount', 50)
        providers = job_data.get('providers', ['openai', 'anthropic', 'google', 'perplexity'])
        config = job_data.get('config', {})
        
        logger.info(f"Starting audit job: {audit_id}")
        active_audits.inc()
        
        try:
            # Update audit status
            await self._update_audit_status(audit_id, 'processing')
            
            # Get company context
            company_context = await self._get_company_context(company_id)
            
            # Notify WebSocket clients
            await notify_audit_started(
                self.ws_manager,
                audit_id,
                query_count,
                len(providers),
                company_context['name']
            )
            
            # Phase 1: Generate queries
            logger.info(f"Generating {query_count} queries for audit {audit_id}")
            queries = await self._generate_queries(
                audit_id,
                company_context,
                query_count
            )
            
            # Phase 2: Execute queries across LLMs
            logger.info(f"Executing queries across {len(providers)} providers")
            responses = await self._execute_queries(
                audit_id,
                queries,
                providers,
                company_context
            )
            
            # Phase 3: Analyze responses
            logger.info("Analyzing responses")
            analyses = await self._analyze_responses(
                audit_id,
                responses,
                company_context
            )
            
            # Phase 4: Calculate scores
            logger.info("Calculating scores")
            scores = await self._calculate_scores(audit_id, analyses)
            
            # Phase 5: Generate insights
            if config.get('generateInsights', True):
                logger.info("Generating insights")
                insights = await self._generate_insights(audit_id, analyses, scores)
            
            # Update audit as completed
            await self._finalize_audit(audit_id, scores)
            
            # Notify completion
            await notify_audit_completed(
                self.ws_manager,
                audit_id,
                scores['overall_score'],
                insights[:3] if 'insights' in locals() else []
            )
            
            audit_jobs_total.labels(status='success').inc()
            logger.info(f"Audit {audit_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Error processing audit {audit_id}: {e}")
            logger.error(traceback.format_exc())
            
            await self._handle_job_failure(audit_id, str(e))
            audit_jobs_total.labels(status='failure').inc()
            
            raise
        
        finally:
            active_audits.dec()
    
    async def _get_company_context(self, company_id: Optional[int]) -> QueryContext:
        """Fetch company context for query generation"""
        
        if not company_id:
            # Return default context
            return QueryContext(
                company_name="Unknown Company",
                industry="Technology",
                description="A technology company",
                unique_value_propositions=["Innovation", "Quality"],
                target_audiences=[{"segment": "Enterprises"}],
                competitors=[],
                products_services=["Software"],
                pain_points_solved=["Efficiency"],
                geographic_markets=["Global"],
                technology_stack=None,
                pricing_model=None,
                company_size=None,
                founding_year=None,
                key_features=["Advanced Features"],
                use_cases=["Business Operations"],
                integrations=None,
                certifications=None
            )
        
        with self.db_conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    c.*,
                    array_agg(DISTINCT comp.name) as competitors,
                    array_agg(DISTINCT f.feature) as features
                FROM companies c
                LEFT JOIN competitors comp ON comp.company_id = c.id
                LEFT JOIN company_features f ON f.company_id = c.id
                WHERE c.id = %s
                GROUP BY c.id
            """, (company_id,))
            
            company = cursor.fetchone()
        
        if not company:
            raise ValueError(f"Company {company_id} not found")
        
        return QueryContext(
            company_name=company['name'],
            industry=company['industry'],
            description=company.get('description', ''),
            unique_value_propositions=company.get('value_props', []),
            target_audiences=company.get('target_audiences', []),
            competitors=company.get('competitors', []),
            products_services=company.get('products', []),
            pain_points_solved=company.get('pain_points', []),
            geographic_markets=company.get('markets', ['Global']),
            technology_stack=company.get('tech_stack'),
            pricing_model=company.get('pricing_model'),
            company_size=company.get('size'),
            founding_year=company.get('founded_year'),
            key_features=company.get('features', []),
            use_cases=company.get('use_cases', []),
            integrations=company.get('integrations'),
            certifications=company.get('certifications')
        )
    
    async def _generate_queries(
        self,
        audit_id: str,
        context: QueryContext,
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate intelligent queries"""
        
        start_time = time.time()
        
        # Generate queries using GPT-5
        generated_queries = await self.query_generator.generate_queries(
            context,
            target_count=count,
            diversity_threshold=0.7
        )
        
        # Store queries in database
        with self.db_conn.cursor() as cursor:
            for query in generated_queries:
                cursor.execute("""
                    INSERT INTO audit_queries 
                    (audit_id, query_text, intent, category, complexity_score, 
                     priority_score, buyer_journey_stage, semantic_variations,
                     expected_serp_features, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    audit_id,
                    query.query_text,
                    query.intent.value,
                    query.intent.value,  # category same as intent for now
                    query.complexity_score,
                    query.priority_score,
                    query.buyer_journey_stage,
                    query.semantic_variations,
                    query.expected_serp_features,
                    json.dumps({'query_id': query.query_id})
                ))
                
                query_id = cursor.fetchone()['id']
                
                # Notify via WebSocket
                await notify_query_generated(
                    self.ws_manager,
                    audit_id,
                    query.query_text,
                    query.intent.value
                )
        
        self.db_conn.commit()
        
        query_generation_time.observe(time.time() - start_time)
        logger.info(f"Generated {len(generated_queries)} queries in {time.time() - start_time:.2f}s")
        
        return [
            {
                'id': q.query_id,
                'text': q.query_text,
                'intent': q.intent.value,
                'priority': q.priority_score
            }
            for q in generated_queries
        ]
    
    async def _execute_queries(
        self,
        audit_id: str,
        queries: List[Dict[str, Any]],
        providers: List[str],
        context: QueryContext
    ) -> Dict[str, List[Any]]:
        """Execute queries across LLM providers"""
        
        # Map provider names to enums
        provider_map = {
            'openai': LLMProvider.OPENAI_GPT4,
            'anthropic': LLMProvider.ANTHROPIC_CLAUDE,
            'google': LLMProvider.GOOGLE_GEMINI,
            'perplexity': LLMProvider.PERPLEXITY
        }
        
        selected_providers = [provider_map[p] for p in providers if p in provider_map]
        
        # Sort queries by priority
        sorted_queries = sorted(queries, key=lambda q: q['priority'], reverse=True)
        
        # Execute in batches
        all_responses = {}
        
        for i in range(0, len(sorted_queries), self.config.batch_size):
            batch = sorted_queries[i:i + self.config.batch_size]
            batch_queries = [q['text'] for q in batch]
            
            # Execute batch across providers
            batch_results = await self.llm_orchestrator.execute_audit_queries(
                batch_queries,
                selected_providers,
                parallel_execution=True,
                use_cache=True,
                fallback_on_failure=True
            )
            
            # Process results
            for query_text, responses in batch_results.items():
                query = next(q for q in batch if q['text'] == query_text)
                
                # Store responses in database
                with self.db_conn.cursor() as cursor:
                    # Get query ID from database
                    cursor.execute(
                        "SELECT id FROM audit_queries WHERE audit_id = %s AND query_text = %s",
                        (audit_id, query_text)
                    )
                    query_record = cursor.fetchone()
                    
                    if query_record:
                        for response in responses:
                            if not response.error:
                                cursor.execute("""
                                    INSERT INTO audit_responses
                                    (query_id, provider, model_version, response_text,
                                     response_time_ms, tokens_used, cache_hit)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                                """, (
                                    query_record['id'],
                                    response.provider.value,
                                    response.model_version,
                                    response.response_text,
                                    response.response_time_ms,
                                    response.tokens_used,
                                    response.cache_hit
                                ))
                                
                                llm_api_calls.labels(
                                    provider=response.provider.value,
                                    status='success' if not response.error else 'failure'
                                ).inc()
                
                self.db_conn.commit()
                
                all_responses[query_text] = responses
                
                # Update progress
                await self.ws_manager.broadcast_progress(
                    audit_id,
                    'query_executed',
                    len(responses)
                )
        
        return all_responses
    
    async def _analyze_responses(
        self,
        audit_id: str,
        responses: Dict[str, List[Any]],
        context: QueryContext
    ) -> List[Any]:
        """Analyze LLM responses"""
        
        start_time = time.time()
        analyses = []
        
        # Prepare analysis tasks
        analysis_tasks = []
        
        with self.db_conn.cursor() as cursor:
            cursor.execute("""
                SELECT q.id, q.query_text, r.id as response_id, r.response_text, r.provider
                FROM audit_queries q
                JOIN audit_responses r ON r.query_id = q.id
                WHERE q.audit_id = %s
            """, (audit_id,))
            
            responses_to_analyze = cursor.fetchall()
        
        # Analyze in batches
        for response_data in responses_to_analyze:
            analysis = await self.response_analyzer.analyze_response(
                response_text=response_data['response_text'],
                query=response_data['query_text'],
                brand_name=context.company_name,
                competitors=context.competitors,
                provider=response_data['provider']
            )
            
            # Store analysis results
            with self.db_conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE audit_responses
                    SET 
                        brand_mentioned = %s,
                        mention_position = %s,
                        mention_context = %s,
                        sentiment = %s,
                        recommendation_strength = %s,
                        competitors_mentioned = %s,
                        key_features_mentioned = %s,
                        featured_snippet_potential = %s,
                        voice_search_optimized = %s,
                        analysis_metadata = %s
                    WHERE id = %s
                """, (
                    analysis.brand_analysis.mentioned,
                    analysis.brand_analysis.first_position_percentage,
                    analysis.brand_analysis.context_quality.value,
                    analysis.brand_analysis.sentiment.value,
                    analysis.brand_analysis.recommendation_strength.value,
                    json.dumps([
                        {
                            'name': comp.competitor_name,
                            'mentioned': comp.mention_analysis.mentioned,
                            'sentiment': comp.mention_analysis.sentiment.value
                        }
                        for comp in analysis.competitors_analysis
                    ]),
                    analysis.brand_analysis.specific_features_mentioned,
                    analysis.featured_snippet_potential,
                    analysis.voice_search_optimized,
                    json.dumps({
                        'processing_time_ms': analysis.processing_time_ms,
                        'analysis_id': analysis.analysis_id
                    }),
                    response_data['response_id']
                ))
            
            self.db_conn.commit()
            
            # Notify progress
            await notify_llm_response(
                self.ws_manager,
                audit_id,
                response_data['query_text'],
                response_data['provider'],
                analysis.brand_analysis.mentioned,
                analysis.brand_analysis.sentiment.value
            )
            
            analyses.append(analysis)
        
        analysis_time.observe(time.time() - start_time)
        logger.info(f"Analyzed {len(analyses)} responses in {time.time() - start_time:.2f}s")
        
        return analyses
    
    async def _calculate_scores(
        self,
        audit_id: str,
        analyses: List[Any]
    ) -> Dict[str, float]:
        """Calculate audit scores"""
        
        with self.db_conn.cursor() as cursor:
            # Call PostgreSQL function to calculate scores
            cursor.execute("SELECT calculate_audit_scores(%s)", (audit_id,))
            
            # Fetch calculated scores
            cursor.execute("""
                SELECT 
                    MAX(score) FILTER (WHERE metric_name = 'brand_visibility') as visibility,
                    MAX(score) FILTER (WHERE metric_name = 'sentiment_score') as sentiment,
                    MAX(score) FILTER (WHERE metric_name = 'recommendation_score') as recommendation
                FROM audit_scores
                WHERE audit_id = %s
            """, (audit_id,))
            
            scores = cursor.fetchone()
        
        # Calculate overall score
        overall_score = (
            (scores['visibility'] or 0) * 0.4 +
            (scores['sentiment'] or 0) * 0.3 +
            (scores['recommendation'] or 0) * 0.3
        )
        
        return {
            'overall_score': overall_score,
            'visibility': scores['visibility'] or 0,
            'sentiment': scores['sentiment'] or 0,
            'recommendation': scores['recommendation'] or 0
        }
    
    async def _generate_insights(
        self,
        audit_id: str,
        analyses: List[Any],
        scores: Dict[str, float]
    ) -> List[str]:
        """Generate actionable insights"""
        
        # Aggregate metrics from analyses
        aggregate_metrics = self.response_analyzer.calculate_aggregate_metrics(analyses)
        
        insights = []
        
        # Visibility insights
        if scores['visibility'] < 50:
            insights.append(
                f"⚠️ Low brand visibility: Only {scores['visibility']:.1f}% of AI responses mention your brand. "
                "Consider increasing content marketing and PR efforts."
            )
        
        # Sentiment insights
        if aggregate_metrics['average_sentiment_score'] < 0.5:
            insights.append(
                "📉 Negative sentiment detected. Review and address common criticisms in AI training data."
            )
        
        # Competitive insights
        competitor_dominance = aggregate_metrics.get('competitor_dominance', {})
        if competitor_dominance:
            top_competitor = max(competitor_dominance.items(), key=lambda x: x[1])
            if top_competitor[1] > len(analyses) * 0.5:
                insights.append(
                    f"🎯 {top_competitor[0]} dominates {top_competitor[1]/len(analyses)*100:.0f}% of responses. "
                    "Focus on differentiation."
                )
        
        # SEO insights
        if aggregate_metrics['featured_snippet_potential_rate'] < 30:
            insights.append(
                "🔍 Low featured snippet optimization. Structure content for AI extraction."
            )
        
        # Store insights
        with self.db_conn.cursor() as cursor:
            for insight in insights:
                cursor.execute("""
                    INSERT INTO audit_insights (audit_id, insight_text, category, importance)
                    VALUES (%s, %s, %s, %s)
                """, (audit_id, insight, 'general', 'high'))
        
        self.db_conn.commit()
        
        return insights
    
    async def _update_audit_status(
        self,
        audit_id: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """Update audit status in database"""
        
        with self.db_conn.cursor() as cursor:
            if status == 'processing':
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s, started_at = NOW() WHERE id = %s",
                    (status, audit_id)
                )
            elif status == 'completed':
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s, completed_at = NOW() WHERE id = %s",
                    (status, audit_id)
                )
            elif status == 'failed':
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s, error_message = %s WHERE id = %s",
                    (status, error_message, audit_id)
                )
            else:
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s WHERE id = %s",
                    (status, audit_id)
                )
        
        self.db_conn.commit()
    
    async def _finalize_audit(
        self,
        audit_id: str,
        scores: Dict[str, float]
    ):
        """Finalize audit with scores"""
        
        with self.db_conn.cursor() as cursor:
            cursor.execute("""
                UPDATE ai_visibility_audits
                SET 
                    status = 'completed',
                    completed_at = NOW(),
                    overall_score = %s,
                    brand_mention_rate = %s,
                    processing_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
                WHERE id = %s
            """, (scores['overall_score'], scores['visibility'], audit_id))
            
            # Refresh materialized views
            cursor.execute("SELECT refresh_audit_materialized_views()")
        
        self.db_conn.commit()
    
    async def _handle_job_failure(
        self,
        audit_id: str,
        error_message: str
    ):
        """Handle job failure"""
        
        await self._update_audit_status(audit_id, 'failed', error_message)
        
        # Notify via WebSocket
        await self.ws_manager.broadcast_to_audit(
            audit_id,
            'AUDIT_FAILED',
            {'error': error_message}
        )
        
        # Send alert
        logger.error(f"Audit {audit_id} failed: {error_message}")
    
    async def cleanup(self):
        """Cleanup connections"""
        
        if self.db_conn:
            self.db_conn.close()
        
        if self.redis_client:
            await self.redis_client.close()
        
        if self.ws_manager:
            await self.ws_manager.stop()
        
        logger.info("Job processor cleanup completed")


# =====================================================
# Worker Entry Point
# =====================================================

async def main():
    """Main worker entry point"""
    
    config = ProcessorConfig()
    processor = AuditJobProcessor(config)
    
    try:
        await processor.initialize()
        
        # Connect to Redis for job queue
        redis_client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            decode_responses=True
        )
        
        logger.info("AI Visibility Job Processor started, waiting for jobs...")
        
        while True:
            # Fetch job from queue (BullMQ compatible format)
            job_data = await redis_client.blpop('bull:ai-visibility-audit:wait', timeout=5)
            
            if job_data:
                job_json = json.loads(job_data[1])
                
                # Process job
                try:
                    await processor.process_audit_job(job_json['data'])
                    
                    # Mark job as completed
                    await redis_client.lpush('bull:ai-visibility-audit:completed', job_json['id'])
                    
                except Exception as e:
                    # Mark job as failed
                    await redis_client.lpush('bull:ai-visibility-audit:failed', json.dumps({
                        'id': job_json['id'],
                        'error': str(e),
                        'timestamp': datetime.now().isoformat()
                    }))
            
            await asyncio.sleep(0.1)
    
    except KeyboardInterrupt:
        logger.info("Shutting down job processor...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        logger.error(traceback.format_exc())
    finally:
        await processor.cleanup()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    asyncio.run(main())

# Alias for backward compatibility
JobProcessor = AuditJobProcessor
