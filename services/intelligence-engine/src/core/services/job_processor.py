"""
AI Visibility Job Processor
Handles background processing of audit jobs with resilience and monitoring
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass
import logging
import traceback
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
import redis.asyncio as redis
from contextlib import asynccontextmanager
import os

# Import our modules
from ..analysis.query_generator import IntelligentQueryGenerator, QueryContext
from ..analysis.llm_orchestrator import LLMOrchestrator, LLMProvider
from ..analysis.response_analyzer import UnifiedResponseAnalyzer
from ..utilities.cache_manager import IntelligentCacheManager, CacheConfig
from .websocket_manager import WebSocketManager, EventType
from src.config import settings

logger = logging.getLogger(__name__)

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
    openai_api_key: str = os.getenv('OPENAI_API_KEY', '')
    anthropic_api_key: str = os.getenv('ANTHROPIC_API_KEY', '')
    google_ai_api_key: str = os.getenv('GOOGLE_AI_API_KEY', '')
    perplexity_api_key: str = os.getenv('PERPLEXITY_API_KEY', '')
    
    # Processing
    max_concurrent_queries: int = 10
    batch_size: int = 5
    
    # Timeouts
    query_timeout: int = 30  # seconds
    analysis_timeout: int = 20  # seconds
    
    # Database pool
    db_pool_min: int = 2
    db_pool_max: int = 10
    
    # Retry configuration
    max_retries: int = 3
    retry_delay: float = 1.0


class AuditJobProcessor:
    """Process AI Visibility audit jobs"""
    
    def __init__(self, config: ProcessorConfig):
        self.config = config
        
        # Database connection pool
        self.db_pool: Optional[pool.ThreadedConnectionPool] = None
        
        # Redis client
        self.redis_client: Optional[redis.Redis] = None
        
        # Service components
        self.cache_manager: Optional[IntelligentCacheManager] = None
        self.ws_manager: Optional[WebSocketManager] = None
        self.query_generator: Optional[IntelligentQueryGenerator] = None
        self.llm_orchestrator: Optional[LLMOrchestrator] = None
        self.response_analyzer: Optional[UnifiedResponseAnalyzer] = None
        
        # Processing state
        self.is_running = False
        self.current_jobs: Dict[str, Any] = {}
    
    async def initialize(self):
        """Initialize all connections and services"""
        
        logger.info("Initializing AI Visibility Job Processor")
        
        # Initialize database connection pool
        self.db_pool = pool.ThreadedConnectionPool(
            1,  # min connections
            10, # max connections
            host=self.config.postgres_host,
            port=self.config.postgres_port,
            database=self.config.postgres_db,
            user=self.config.postgres_user,
            password=self.config.postgres_password,
            cursor_factory=RealDictCursor
        )
        
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
        
        # Initialize service components with correct models
        self.query_generator = IntelligentQueryGenerator(
            self.config.openai_api_key,
            model=settings.openai_model  # Uses gpt-5-chat-latest from config
        )
        
        self.llm_orchestrator = LLMOrchestrator(
            openai_api_key=self.config.openai_api_key,
            anthropic_api_key=self.config.anthropic_api_key,
            google_api_key=self.config.google_ai_api_key,
            perplexity_api_key=self.config.perplexity_api_key
        )
        
        self.response_analyzer = UnifiedResponseAnalyzer(
            self.config.openai_api_key,
            model="gpt-5-chat-latest"  # Updated from gpt-4o
        )
        
        # LLMOrchestrator doesn't have warmup method - skip this step
        
        logger.info("Job Processor initialized successfully")
    
    @asynccontextmanager
    async def get_db_connection(self):
        """Get database connection from pool"""
        conn = self.db_pool.getconn()
        try:
            yield conn
        finally:
            self.db_pool.putconn(conn)
    
    async def _retry_operation(self, operation, *args, **kwargs):
        """Retry an operation with exponential backoff"""
        for attempt in range(self.config.max_retries):
            try:
                return await operation(*args, **kwargs)
            except Exception as e:
                if attempt == self.config.max_retries - 1:
                    raise
                wait_time = self.config.retry_delay * (2 ** attempt)
                logger.warning(f"Operation failed (attempt {attempt + 1}): {e}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
    
    async def process_audit_job(self, job_data: Dict[str, Any]):
        """Process a single audit job"""
        print(f"DEBUG: process_audit_job called with data: {job_data}")
        
        audit_id = job_data.get('audit_id') or job_data.get('auditId')
        company_id = job_data.get('company_id') or job_data.get('companyId')
        user_id = job_data.get('user_id') or job_data.get('userId', 0)
        query_count = job_data.get('query_count') or job_data.get('queryCount', 48)  # Default 48 queries
        providers = job_data.get('providers', ['openai_gpt5', 'anthropic_claude', 'google_gemini', 'perplexity'])
        config = job_data.get('config', {})
        
        print(f"DEBUG: Extracted values - audit_id: {audit_id}, company_id: {company_id}, providers: {providers}")
        
        try:
            logger.info(f"Starting audit job: {audit_id}")
            print(f"DEBUG: After logger.info")
        except Exception as e:
            print(f"DEBUG: Logger error: {e}")
        
        try:
            self.current_jobs[audit_id] = {'status': 'processing', 'started_at': datetime.now()}
            print(f"DEBUG: Updated current_jobs")
        except Exception as e:
            print(f"DEBUG: current_jobs error: {e}")
        
        try:
            # Update audit status
            print(f"DEBUG: About to update audit status")
            await self._update_audit_status(audit_id, 'processing')
            print(f"DEBUG: Audit status updated")
            
            # Get company context
            print(f"DEBUG: Getting company context for company_id: {company_id}")
            company_context = await self._get_company_context(company_id)
            print(f"DEBUG: Got company context: {company_context}")
            
            # Notify WebSocket clients (skip if ws_manager not available)
            try:
                if self.ws_manager:
                    await self.ws_manager.broadcast_to_audit(
                        audit_id,
                        EventType.AUDIT_STARTED,
                        {
                            'query_count': query_count,
                            'provider_count': len(providers),
                            'company_name': company_context.company_name
                        }
                    )
            except Exception as e:
                logger.warning(f"WebSocket broadcast failed: {e}")
            
            # Phase 1: Generate queries
            logger.info(f"Generating {query_count} queries for audit {audit_id}")
            queries = await self._retry_operation(
                self._generate_queries,
                audit_id,
                company_context,
                query_count
            )
            
            # Phase 2: Execute queries across LLMs
            logger.info(f"Executing {len(queries)} queries across {len(providers)} providers")
            logger.info(f"Providers: {providers}")
            logger.info(f"First 3 queries: {[q.get('query_text') if isinstance(q, dict) else (q[1] if len(q) > 1 else str(q)) for q in queries[:3]]}")
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
            
            # Phase 5: Generate insights (optional)
            insights = []
            if config.get('generateInsights', True):
                logger.info("Generating insights")
                insights = await self._generate_insights(audit_id, analyses, scores)
            
            # Update audit as completed
            await self._finalize_audit(audit_id, scores)
            
            # Notify completion
            await self.ws_manager.broadcast_to_audit(
                audit_id,
                EventType.AUDIT_COMPLETED,
                {
                    'overall_score': scores['overall_score'],
                    'insights': insights[:3]
                }
            )
            
            logger.info(f"Audit {audit_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Error processing audit {audit_id}: {e}")
            logger.error(traceback.format_exc())
            
            await self._handle_job_failure(audit_id, str(e))
            raise
        
        finally:
            self.current_jobs.pop(audit_id, None)
    
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
        
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        c.*,
                        array_agg(DISTINCT comp.competitor_name) FILTER (WHERE comp.competitor_name IS NOT NULL) as competitors,
                        array_agg(DISTINCT f.feature_name) FILTER (WHERE f.feature_name IS NOT NULL) as features
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
            industry=company.get('industry', 'Technology'),
            sub_industry=company.get('sub_industry', ''),
            description=company.get('description', ''),
            unique_value_propositions=company.get('value_props', []),
            target_audiences=company.get('target_audiences', []),
            competitors=company.get('competitors') or [],
            products_services=company.get('products', []),
            pain_points_solved=company.get('pain_points', []),
            geographic_markets=company.get('markets', ['Global']),
            technology_stack=company.get('tech_stack'),
            pricing_model=company.get('pricing_model'),
            company_size=company.get('size'),
            founding_year=company.get('founded_year'),
            key_features=company.get('features') or [],
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
        """Read existing queries from ai_queries table instead of regenerating"""
        
        start_time = time.time()
        logger.info(f"Reading existing queries for company {context.company_name}")
        
        # First check if we already have queries in ai_queries table
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Get company_id from context or query
                cursor.execute("""
                    SELECT id FROM companies WHERE name = %s LIMIT 1
                """, (context.company_name,))
                company_result = cursor.fetchone()
                
                if not company_result:
                    raise ValueError(f"Company {context.company_name} not found")
                
                company_id = company_result['id']
                
                # First try audit_queries table (dual table architecture)
                cursor.execute("""
                    SELECT 
                        query_text,
                        intent,
                        category,
                        priority_score as priority
                    FROM audit_queries 
                    WHERE audit_id = %s
                    ORDER BY created_at
                    LIMIT %s
                """, (audit_id, count))
                
                queries_result = cursor.fetchall()
                
                # If no queries in audit_queries, try ai_queries table
                if not queries_result:
                    cursor.execute("""
                        SELECT 
                            query_text,
                            intent,
                            category,
                        complexity_score,
                        priority_score,
                        buyer_journey_stage,
                        semantic_variations,
                        expected_serp_features,
                        persona_alignment
                    FROM ai_queries
                    WHERE company_id = %s
                    ORDER BY priority_score DESC
                    LIMIT %s
                """, (company_id, count))
                
                existing_queries = cursor.fetchall()
                
                if not existing_queries:
                    logger.warning(f"No existing queries found for company {company_id}, generating new ones")
                    # Fall back to generating new queries if none exist
                    generated_queries = await self.query_generator.generate_queries(
                        context,
                        target_count=count,
                        diversity_threshold=0.7
                    )
                    
                    # Store in ai_queries for future use
                    for query in generated_queries:
                        cursor.execute("""
                            INSERT INTO ai_queries 
                            (company_id, query_text, intent, category, complexity_score, 
                             priority_score, buyer_journey_stage, semantic_variations,
                             expected_serp_features, persona_alignment)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            company_id,
                            query.query_text,
                            query.intent.value,
                            query.intent.value,
                            query.complexity_score,
                            query.priority_score,
                            query.buyer_journey_stage,
                            query.semantic_variations,
                            query.expected_serp_features,
                            getattr(query, 'persona_alignment', 'general')
                        ))
                    conn.commit()
                    
                    # Convert to format expected by rest of code
                    existing_queries = [
                        {
                            'query_text': q.query_text,
                            'intent': q.intent.value,
                            'category': q.intent.value,
                            'complexity_score': q.complexity_score,
                            'priority_score': q.priority_score,
                            'buyer_journey_stage': q.buyer_journey_stage,
                            'semantic_variations': q.semantic_variations,
                            'expected_serp_features': q.expected_serp_features,
                            'persona_alignment': getattr(q, 'persona_alignment', 'general')
                        }
                        for q in generated_queries
                    ]
                else:
                    logger.info(f"Found {len(existing_queries)} existing queries for company {company_id}")
                
                # Copy queries to audit_queries for this audit trail
                for query in existing_queries:
                    cursor.execute("""
                        INSERT INTO audit_queries 
                        (audit_id, query_text, intent, category, complexity_score, 
                         priority_score, buyer_journey_stage, semantic_variations,
                         expected_serp_features, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        audit_id,
                        query['query_text'] if isinstance(query, dict) else query[0],
                        query['intent'] if isinstance(query, dict) else query[1],
                        query['category'] if isinstance(query, dict) else query[2],
                        query['complexity_score'] if isinstance(query, dict) else query[3],
                        query['priority_score'] if isinstance(query, dict) else query[4],
                        query['buyer_journey_stage'] if isinstance(query, dict) else query[5],
                        query['semantic_variations'] if isinstance(query, dict) else query[6],
                        query['expected_serp_features'] if isinstance(query, dict) else query[7],
                        json.dumps({'persona_alignment': query['persona_alignment'] if isinstance(query, dict) else (query[8] if len(query) > 8 else 'general')})
                    ))
                    
                    # Notify via WebSocket
                    await self.ws_manager.broadcast_to_audit(
                        audit_id,
                        EventType.QUERY_GENERATED,
                        {
                            'query_text': query['query_text'],
                            'intent': query['intent']
                        }
                    )
            
            conn.commit()
        
        logger.info(f"Processed {len(existing_queries)} queries in {time.time() - start_time:.2f}s")
        
        # Return queries in expected format
        return [{
            'id': str(i),
            'text': q[0] if isinstance(q, tuple) else q['query_text'],
            'intent': q[1] if isinstance(q, tuple) else q['intent'],
            'priority': float(q[4]) if isinstance(q, tuple) else q['priority_score']
        } for i, q in enumerate(existing_queries)]
    
    async def _execute_queries(
        self,
        audit_id: str,
        queries: List[Dict[str, Any]],
        providers: List[str],
        context: QueryContext
    ) -> Dict[str, List[Any]]:
        """Execute queries across LLM providers"""
        logger.info(f"_execute_queries called with {len(queries)} queries and providers: {providers}")
        
        # Convert provider strings to LLMProvider enums
        provider_enums = []
        for p in providers:
            if p in ['openai', 'openai_gpt5']:
                provider_enums.append(LLMProvider.OPENAI_GPT5)
            elif p in ['anthropic', 'anthropic_claude']:
                provider_enums.append(LLMProvider.ANTHROPIC_CLAUDE)
            elif p in ['google', 'google_gemini']:
                provider_enums.append(LLMProvider.GOOGLE_GEMINI)
            elif p == 'perplexity':
                provider_enums.append(LLMProvider.PERPLEXITY)
        
        # Sort queries by priority (handle both dict and tuple formats)
        def get_priority(q):
            if isinstance(q, dict):
                return q.get('priority_score', q.get('priority', 5)) or 5
            else:
                # Tuple format from database
                return q[4] if len(q) > 4 else 5  # priority_score is at index 4
        
        sorted_queries = sorted(queries, key=get_priority, reverse=True)
        
        # Execute in batches
        all_responses = {}
        
        for i in range(0, len(sorted_queries), self.config.batch_size):
            batch = sorted_queries[i:i + self.config.batch_size]
            # Extract query text (handle both dict and tuple formats)
            batch_queries = []
            for q in batch:
                if isinstance(q, dict):
                    batch_queries.append(q.get('query_text', q.get('text', '')))
                else:
                    # Tuple format: (id, query_text, intent, category, ...)
                    batch_queries.append(q[1] if len(q) > 1 else '')
            
            # Execute batch across providers
            logger.info(f"Calling llm_orchestrator with {len(batch_queries)} queries and {len(provider_enums)} providers: {provider_enums}")
            logger.info(f"Batch queries: {batch_queries[:2]}")
            batch_results = await self.llm_orchestrator.execute_audit_queries(
                batch_queries,
                provider_enums,
                parallel_execution=True,
                use_cache=True,
                use_fallback=True
            )
            
            # Process and store results
            async with self.get_db_connection() as conn:
                with conn.cursor() as cursor:
                    for query_text, responses in batch_results.items():
                        # Get query ID from database
                        cursor.execute(
                            "SELECT id FROM audit_queries WHERE audit_id = %s AND query_text = %s",
                            (audit_id, query_text)
                        )
                        query_record = cursor.fetchone()
                        
                        if query_record:
                            query_id = query_record[0] if isinstance(query_record, tuple) else query_record['id']
                            for response in responses:
                                if not response.error:
                                    cursor.execute("""
                                        INSERT INTO audit_responses
                                        (query_id, audit_id, provider, model_version, response_text,
                                         response_time_ms, tokens_used, cache_hit)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                                    """, (
                                        query_id,
                                        audit_id,
                                        response.provider.value,
                                        response.model_version,
                                        response.response_text,
                                        response.response_time_ms,
                                        response.tokens_used,
                                        response.cache_hit
                                    ))
                
                conn.commit()
            
            all_responses.update(batch_results)
            
            # Update progress
            await self.ws_manager.broadcast_to_audit(
                audit_id,
                EventType.QUERY_COMPLETED,
                {'completed': len(all_responses), 'total': len(sorted_queries)}
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
        
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT q.id, q.query_text, r.id as response_id, r.response_text, r.provider
                    FROM audit_queries q
                    JOIN audit_responses r ON r.query_id = q.id
                    WHERE q.audit_id = %s
                """, (audit_id,))
                
                responses_to_analyze = cursor.fetchall()
        
        total_responses = len(responses_to_analyze)
        
        # Send initial progress update
        await self._send_geo_sov_progress(
            audit_id,
            stage='analyzing',
            progress=0,
            total_queries=total_responses,
            completed_queries=0,
            message="Starting GEO/SOV analysis..."
        )
        
        # Analyze each response
        for idx, response_data in enumerate(responses_to_analyze):
            # Send progress update
            progress = int((idx / total_responses) * 100)
            await self._send_geo_sov_progress(
                audit_id,
                stage='calculating_geo' if idx < total_responses/2 else 'calculating_sov',
                progress=progress,
                current_provider=response_data['provider'],
                current_query=response_data['query_text'][:50],
                total_queries=total_responses,
                completed_queries=idx,
                message=f"Analyzing response {idx+1}/{total_responses}"
            )
            
            analysis = await self.response_analyzer.analyze_response(
                response_text=response_data['response_text'],
                query=response_data['query_text'],
                brand_name=context.company_name,
                competitors=context.competitors,
                provider=response_data['provider']
            )
            
            # Store analysis results
            async with self.get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        UPDATE audit_responses
                        SET 
                            brand_mentioned = %s,
                            mention_position = %s,
                            mention_context = %s,
                            sentiment = %s,
                            recommendation_strength = %s,
                            competitors_mentioned = %s,
                            key_features_mentioned = to_jsonb(%s::text[]),
                            featured_snippet_potential = %s,
                            voice_search_optimized = %s,
                            analysis_metadata = %s,
                            geo_score = %s,
                            sov_score = %s,
                            context_completeness_score = %s,
                            recommendations = %s
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
                                'mentioned': comp.mentioned,
                                'sentiment': comp.sentiment.value
                            }
                            for comp in analysis.competitors_analysis
                        ]),
                        analysis.brand_analysis.specific_features_mentioned,
                        analysis.featured_snippet_potential > 50,  # Convert to boolean (>50% potential)
                        analysis.voice_search_optimized,
                        json.dumps({
                            'processing_time_ms': analysis.processing_time_ms,
                            'analysis_id': analysis.analysis_id
                        }),
                        analysis.geo_score,
                        analysis.sov_score,
                        analysis.context_completeness_score,
                        json.dumps(analysis.recommendations) if analysis.recommendations else json.dumps([]),
                        response_data['response_id']
                    ))
                
                conn.commit()
            
            # Notify progress
            await self.ws_manager.broadcast_to_audit(
                audit_id,
                EventType.LLM_RESPONSE_RECEIVED,
                {
                    'query': response_data['query_text'],
                    'provider': response_data['provider'],
                    'brand_mentioned': analysis.brand_analysis.mentioned,
                    'sentiment': analysis.brand_analysis.sentiment.value
                }
            )
            
            analyses.append(analysis)
        
        logger.info(f"Analyzed {len(analyses)} responses in {time.time() - start_time:.2f}s")
        
        return analyses
    
    async def _calculate_scores(
        self,
        audit_id: str,
        analyses: List[Any]
    ) -> Dict[str, float]:
        """Calculate audit scores using enhanced formula with GEO and SOV"""
        
        # Send aggregating progress
        await self._send_geo_sov_progress(
            audit_id,
            stage='aggregating',
            progress=90,
            total_queries=len(analyses),
            completed_queries=len(analyses),
            message="Aggregating final scores..."
        )
        
        # Calculate aggregate metrics including GEO and SOV
        aggregate_metrics = self.response_analyzer.calculate_aggregate_metrics(analyses)
        
        # Extract component scores
        geo_score = aggregate_metrics.get('geo_score', 0)
        sov_score = aggregate_metrics.get('sov_score', 0)
        recommendation_score = aggregate_metrics.get('recommendation', 0)
        sentiment_score = aggregate_metrics.get('sentiment', 0)
        visibility_score = aggregate_metrics.get('visibility', 0)
        
        # Enhanced formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)
        overall_score = (
            geo_score * 0.30 +
            sov_score * 0.25 +
            recommendation_score * 0.20 +
            sentiment_score * 0.15 +
            visibility_score * 0.10
        )
        
        # Store scores in database
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Store individual component scores
                cursor.execute("""
                    INSERT INTO audit_score_breakdown 
                    (audit_id, visibility, sentiment, recommendation, geo, sov, 
                     context_completeness, overall, formula_version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'v2_enhanced')
                    ON CONFLICT (audit_id) DO UPDATE SET
                        visibility = EXCLUDED.visibility,
                        sentiment = EXCLUDED.sentiment,
                        recommendation = EXCLUDED.recommendation,
                        geo = EXCLUDED.geo,
                        sov = EXCLUDED.sov,
                        context_completeness = EXCLUDED.context_completeness,
                        overall = EXCLUDED.overall,
                        formula_version = EXCLUDED.formula_version
                """, (
                    audit_id,
                    visibility_score,
                    sentiment_score,
                    recommendation_score,
                    geo_score,
                    sov_score,
                    aggregate_metrics.get('context_completeness_score', 0),
                    overall_score
                ))
                
                # Update main audit record with scores
                cursor.execute("""
                    UPDATE ai_visibility_audits
                    SET 
                        overall_score = %s,
                        brand_mention_rate = %s,
                        sentiment_score = %s,
                        recommendation_score = %s,
                        geo_score = %s,
                        sov_score = %s,
                        context_completeness_score = %s
                    WHERE id = %s
                """, (
                    overall_score,
                    visibility_score,
                    sentiment_score,
                    recommendation_score,
                    geo_score,
                    sov_score,
                    aggregate_metrics.get('context_completeness_score', 0),
                    audit_id
                ))
                
                conn.commit()
        
        # Send completion progress with final scores
        await self._send_geo_sov_progress(
            audit_id,
            stage='complete',
            progress=100,
            total_queries=len(analyses),
            completed_queries=len(analyses),
            geo_score=geo_score,
            sov_score=sov_score,
            message="GEO/SOV calculation complete!"
        )
        
        return {
            'overall_score': overall_score,
            'visibility': visibility_score,
            'sentiment': sentiment_score,
            'recommendation': recommendation_score,
            'geo': geo_score,
            'sov': sov_score,
            'context_completeness': aggregate_metrics.get('context_completeness_score', 0)
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
                f"Low brand visibility: Only {scores['visibility']:.1f}% of AI responses mention your brand. "
                "Consider increasing content marketing and PR efforts."
            )
        
        # Sentiment insights
        if aggregate_metrics['average_sentiment_score'] < 0.5:
            insights.append(
                "Negative sentiment detected. Review and address common criticisms in AI training data."
            )
        
        # Competitive insights
        competitor_dominance = aggregate_metrics.get('competitor_dominance', {})
        if competitor_dominance:
            top_competitor = max(competitor_dominance.items(), key=lambda x: x[1])
            if top_competitor[1] > len(analyses) * 0.5:
                insights.append(
                    f"{top_competitor[0]} dominates {top_competitor[1]/len(analyses)*100:.0f}% of responses. "
                    "Focus on differentiation."
                )
        
        # SEO insights
        if aggregate_metrics['featured_snippet_potential_rate'] < 30:
            insights.append(
                "Low featured snippet optimization. Structure content for AI extraction."
            )
        
        # GEO Score insights
        geo_score = scores.get('geo', 0)
        if geo_score < 40:
            insights.append(
                f"Poor Generative Engine Optimization: GEO score is {geo_score:.1f}/100. "
                "AI engines are not effectively surfacing your brand. Consider optimizing content structure, "
                "adding authoritative citations, and improving semantic relevance."
            )
        elif geo_score < 60:
            insights.append(
                f"Moderate GEO performance: {geo_score:.1f}/100. "
                "Focus on improving content depth, adding more specific features, and enhancing value proposition clarity."
            )
        
        # SOV Score insights
        sov_score = scores.get('sov', 0)
        if sov_score < 25:
            insights.append(
                f"Critical: Your Share of Voice is only {sov_score:.1f}%. "
                "Competitors dominate AI responses. Urgent action needed to increase brand presence and authority."
            )
        elif sov_score < 50:
            insights.append(
                f"Low Share of Voice: {sov_score:.1f}%. "
                "Competitors are mentioned more frequently. Increase content marketing and thought leadership efforts."
            )
        
        # Combined GEO/SOV insights
        if geo_score > 70 and sov_score < 30:
            insights.append(
                "Good content optimization but low market share. "
                "Your content is well-structured for AI, but competitors dominate the conversation. "
                "Focus on increasing brand awareness and market presence."
            )
        elif geo_score < 40 and sov_score > 60:
            insights.append(
                "Strong market presence but poor AI optimization. "
                "Your brand is mentioned frequently but not effectively. "
                "Improve content structure and semantic optimization."
            )
        
        # Store insights
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                for insight in insights:
                    cursor.execute("""
                        INSERT INTO audit_insights (audit_id, insight_text, category, importance)
                        VALUES (%s, %s, %s, %s)
                    """, (audit_id, insight, 'general', 'high'))
            
            conn.commit()
        
        return insights
    
    async def _update_audit_status(
        self,
        audit_id: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """Update audit status in database"""
        
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
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
            
            conn.commit()
    
    async def _send_geo_sov_progress(
        self,
        audit_id: str,
        stage: str,
        progress: int,
        total_queries: int,
        completed_queries: int,
        message: str,
        current_provider: str = None,
        current_query: str = None,
        geo_score: float = None,
        sov_score: float = None
    ):
        """Send GEO/SOV progress update via Redis stream"""
        try:
            # Prepare progress data
            progress_data = {
                'audit_id': audit_id,
                'stage': stage,
                'progress': progress,
                'totalQueries': total_queries,
                'completedQueries': completed_queries,
                'message': message,
                'timestamp': datetime.now().isoformat()
            }
            
            if current_provider:
                progress_data['currentProvider'] = current_provider
            if current_query:
                progress_data['currentQuery'] = current_query
            if geo_score is not None:
                progress_data['geoScore'] = geo_score
            if sov_score is not None:
                progress_data['sovScore'] = sov_score
            
            # Send to Redis stream
            await self.redis_client.xadd(
                'geo_sov.progress',
                {'data': json.dumps(progress_data)}
            )
            
            # Also send final scores if complete
            if stage == 'complete' and geo_score is not None and sov_score is not None:
                await self.redis_client.xadd(
                    'geo_sov.scores',
                    {
                        'audit_id': audit_id,
                        'geo_score': geo_score,
                        'sov_score': sov_score,
                        'timestamp': datetime.now().isoformat()
                    }
                )
            
        except Exception as e:
            logger.warning(f"Failed to send GEO/SOV progress: {e}")
    
    async def _migrate_audit_to_final_responses(
        self,
        audit_id: str
    ) -> int:
        """
        Migrate analyzed results from audit_responses to ai_responses.
        This is the final step after all analysis is complete.
        
        Returns:
            Number of records migrated
        """
        migrated_count = 0
        
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
                try:
                    # Begin transaction for atomic operation
                    cursor.execute("BEGIN")
                    
                    # Copy all analyzed responses from audit_responses to ai_responses
                    cursor.execute("""
                        INSERT INTO ai_responses (
                            id, query_id, report_id, company_id, audit_id,
                            provider, model_version, response_time_ms,
                            response_text, response_summary,
                            brand_mentioned, competitor_mentions,
                            sentiment, sentiment_score,
                            prominence_score, recommendation_strength,
                            competitive_advantage, key_phrases,
                            mentioned_features, mentioned_benefits,
                            call_to_action, created_at,
                            geo_score, sov_score, context_completeness_score,
                            recommendations
                        )
                        SELECT 
                            ar.id, ar.query_id, ar.report_id, ar.company_id, ar.audit_id,
                            ar.provider, ar.model_version, ar.response_time_ms,
                            ar.response_text, ar.response_summary,
                            ar.brand_mentioned, ar.competitor_mentions,
                            ar.sentiment, ar.sentiment_score,
                            ar.prominence_score, ar.recommendation_strength,
                            ar.competitive_advantage, ar.key_phrases,
                            ar.mentioned_features, ar.mentioned_benefits,
                            ar.call_to_action, ar.created_at,
                            ar.geo_score, ar.sov_score, ar.context_completeness_score,
                            ar.recommendations
                        FROM audit_responses ar
                        WHERE ar.audit_id = %s
                        ON CONFLICT (id) DO UPDATE SET
                            response_summary = EXCLUDED.response_summary,
                            brand_mentioned = EXCLUDED.brand_mentioned,
                            competitor_mentions = EXCLUDED.competitor_mentions,
                            sentiment = EXCLUDED.sentiment,
                            sentiment_score = EXCLUDED.sentiment_score,
                            prominence_score = EXCLUDED.prominence_score,
                            recommendation_strength = EXCLUDED.recommendation_strength,
                            competitive_advantage = EXCLUDED.competitive_advantage,
                            key_phrases = EXCLUDED.key_phrases,
                            mentioned_features = EXCLUDED.mentioned_features,
                            mentioned_benefits = EXCLUDED.mentioned_benefits,
                            call_to_action = EXCLUDED.call_to_action,
                            geo_score = EXCLUDED.geo_score,
                            sov_score = EXCLUDED.sov_score,
                            context_completeness_score = EXCLUDED.context_completeness_score,
                            recommendations = EXCLUDED.recommendations
                    """, (audit_id,))
                    
                    migrated_count = cursor.rowcount
                    
                    # Mark audit_responses as migrated (optional - add a migrated flag if needed)
                    cursor.execute("""
                        UPDATE audit_responses 
                        SET migrated_at = NOW()
                        WHERE audit_id = %s AND migrated_at IS NULL
                    """, (audit_id,))
                    
                    # Commit transaction
                    cursor.execute("COMMIT")
                    
                    logger.info(f"Successfully migrated {migrated_count} responses from audit_responses to ai_responses for audit {audit_id}")
                    
                except Exception as e:
                    # Rollback on error
                    cursor.execute("ROLLBACK")
                    logger.error(f"Failed to migrate audit responses to final table: {e}")
                    raise
        
        return migrated_count
    
    async def _finalize_audit(
        self,
        audit_id: str,
        scores: Dict[str, float]
    ):
        """Finalize audit with scores and migrate data to final tables"""
        
        async with self.get_db_connection() as conn:
            with conn.cursor() as cursor:
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
                
                # Refresh materialized views if they exist
                try:
                    cursor.execute("SELECT refresh_audit_materialized_views()")
                except:
                    pass  # Function might not exist
            
            conn.commit()
        
        # Migrate analyzed results to final ai_responses table
        try:
            migrated_count = await self._migrate_audit_to_final_responses(audit_id)
            logger.info(f"Audit {audit_id} finalized with {migrated_count} responses migrated to ai_responses")
            
            # Populate dashboard data with aggregated recommendations
            try:
                from .dashboard_data_populator import DashboardDataPopulator
                
                # Get company_id and user_id for this audit
                async with self.get_db_connection() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("""
                            SELECT company_id, user_id 
                            FROM ai_visibility_audits 
                            WHERE id = %s
                        """, (audit_id,))
                        result = cursor.fetchone()
                        if result:
                            company_id, user_id = result
                            
                            # Populate dashboard data
                            populator = DashboardDataPopulator(
                                db_config={
                                    'host': self.config.db_host,
                                    'port': self.config.db_port,
                                    'database': self.config.db_name,
                                    'user': self.config.db_user,
                                    'password': self.config.db_password
                                },
                                openai_api_key=getattr(self.config, 'openai_api_key', None) or os.environ.get('OPENAI_API_KEY')
                            )
                            
                            success = await populator.populate_dashboard_data(
                                audit_id=audit_id,
                                company_id=company_id,
                                user_id=user_id
                            )
                            
                            if success:
                                logger.info(f"Dashboard data populated successfully for audit {audit_id}")
                                
                                # Send WebSocket notification that dashboard data is ready
                                await self.ws_manager.broadcast_to_audit(
                                    audit_id,
                                    EventType.DASHBOARD_DATA_READY,
                                    {'audit_id': audit_id, 'status': 'ready'}
                                )
                            else:
                                logger.warning(f"Dashboard data population failed for audit {audit_id}")
                                
            except Exception as e:
                logger.error(f"Failed to populate dashboard data for audit {audit_id}: {e}")
                # Don't fail the audit - dashboard data is optional enhancement
                
        except Exception as e:
            logger.error(f"Failed to migrate audit {audit_id} responses to final table: {e}")
            # Don't fail the audit just because migration failed - data is still in audit_responses
    
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
            EventType.AUDIT_FAILED,
            {'error': error_message}
        )
        
        logger.error(f"Audit {audit_id} failed: {error_message}")
    
    async def cleanup(self):
        """Cleanup connections"""
        
        if self.db_pool:
            self.db_pool.closeall()
        
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
MultiLLMOrchestrator = LLMOrchestrator  # Backward compatibility alias