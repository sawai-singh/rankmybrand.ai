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
from ..analysis.response_analyzer import UnifiedResponseAnalyzer, AnalysisMode
from ..analysis.recommendation_extractor import WorldClassRecommendationAggregator
from ..analysis.strategic_aggregator import (
    StrategicIntelligenceAggregator,
    CompanyContext,
    PersonaContext,
    determine_persona_context
)
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
    db_host: str = os.getenv('POSTGRES_HOST', os.getenv('DB_HOST', 'localhost'))
    db_port: int = int(os.getenv('POSTGRES_PORT', os.getenv('DB_PORT', '5432')))
    db_name: str = os.getenv('POSTGRES_DB', os.getenv('DB_NAME', 'rankmybrand'))
    db_user: str = os.getenv('POSTGRES_USER', os.getenv('DB_USER', 'postgres'))
    db_password: str = os.getenv('POSTGRES_PASSWORD', os.getenv('DB_PASSWORD', 'postgres'))
    
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

    # Analysis Strategy Configuration (Migration Path)
    use_batched_analysis_only: bool = os.getenv('USE_BATCHED_ANALYSIS_ONLY', 'true').lower() in ('true', '1', 'yes')
    enable_phase1_deprecation_warnings: bool = os.getenv('ENABLE_PHASE1_DEPRECATION_WARNINGS', 'true').lower() in ('true', '1', 'yes')


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
            host=self.config.db_host,
            port=self.config.db_port,
            database=self.config.db_name,
            user=self.config.db_user,
            password=self.config.db_password,
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
            model=settings.openai_model  # Uses gpt-5-nano from config
        )
        
        self.llm_orchestrator = LLMOrchestrator(
            openai_api_key=self.config.openai_api_key,
            anthropic_api_key=self.config.anthropic_api_key,
            google_api_key=self.config.google_ai_api_key,
            perplexity_api_key=self.config.perplexity_api_key
        )
        
        # World-class implementation: Use FULL mode for comprehensive per-response analysis
        # Additional buyer-journey batching for aggregate insights
        self.response_analyzer = UnifiedResponseAnalyzer(
            self.config.openai_api_key,
            model="gpt-5-nano",
            mode=AnalysisMode.FULL  # 🔥 FULL mode = comprehensive LLM-powered analysis per response
        )

        # Recommendation aggregator for buyer-journey batching
        self.recommendation_aggregator = WorldClassRecommendationAggregator(
            self.config.openai_api_key,
            model="gpt-5-nano"
        )

        # Strategic intelligence aggregator for Layers 1-3 (118-call architecture)
        self.strategic_aggregator = StrategicIntelligenceAggregator(
            self.config.openai_api_key,
            model="gpt-5-nano"
        )

        # LLMOrchestrator doesn't have warmup method - skip this step

        logger.info("Job Processor initialized successfully")
    
    def _get_db_connection_sync(self):
        """Get database connection from pool (synchronous)"""
        return self.db_pool.getconn()

    def _put_db_connection_sync(self, conn):
        """Return database connection to pool (synchronous)"""
        self.db_pool.putconn(conn)

    async def _execute_in_thread(self, func, *args, **kwargs):
        """Execute synchronous function in thread pool to avoid blocking async loop"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))

    @asynccontextmanager
    async def get_db_connection(self):
        """Async context manager for database connections"""
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

    def _is_audit_cancelled_sync(self, audit_id: str) -> bool:
        """Check if audit has been cancelled/deleted (synchronous version for thread pool)"""
        try:
            conn = self._get_db_connection_sync()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT status FROM ai_visibility_audits WHERE id = %s",
                        (audit_id,)
                    )
                    result = cursor.fetchone()

                    # If audit doesn't exist or is marked as cancelled, return True
                    if not result:
                        logger.info(f"Audit {audit_id} not found in database - assuming cancelled")
                        return True

                    status = result['status']
                    if status in ['cancelled', 'deleted']:
                        logger.info(f"Audit {audit_id} has status {status} - stopping processing")
                        return True

                    return False
            finally:
                self._put_db_connection_sync(conn)
        except Exception as e:
            logger.error(f"Error checking audit cancellation status: {e}")
            # On error, assume not cancelled to avoid stopping valid audits
            return False

    def _check_stuck_audits_sync(self) -> List[Dict[str, Any]]:
        """Check for stuck audits that need to be resumed (synchronous version for thread pool)"""
        try:
            conn = self._get_db_connection_sync()
            try:
                with conn.cursor() as cursor:
                    # Find audits that are:
                    # 1. Status = 'processing'
                    # 2. Current phase = 'pending' (stuck at the beginning)
                    # 3. Have collected responses (responses_collected > 0)
                    # 4. Started more than 10 minutes ago (to avoid interfering with recently started audits)
                    cursor.execute("""
                        SELECT
                            a.id,
                            a.company_id,
                            a.user_id,
                            a.responses_collected,
                            a.responses_analyzed,
                            a.started_at
                        FROM ai_visibility_audits a
                        WHERE
                            a.status = 'processing'
                            AND a.current_phase = 'pending'
                            AND a.responses_collected > 0
                            AND a.started_at < NOW() - INTERVAL '10 minutes'
                        ORDER BY a.started_at ASC
                        LIMIT 5
                    """)

                    results = cursor.fetchall()

                    if results:
                        stuck_audits = []
                        for row in results:
                            stuck_audits.append({
                                'id': row['id'],
                                'company_id': row['company_id'],
                                'user_id': row['user_id'],
                                'responses_collected': row['responses_collected'],
                                'responses_analyzed': row['responses_analyzed'],
                                'started_at': row['started_at']
                            })

                        logger.info(f"Found {len(stuck_audits)} stuck audits needing resume")
                        return stuck_audits

                    return []

            finally:
                self._put_db_connection_sync(conn)
        except Exception as e:
            logger.error(f"Error checking for stuck audits: {e}")
            logger.error(traceback.format_exc())
            return []

    async def _is_audit_cancelled(self, audit_id: str) -> bool:
        """Async wrapper that runs sync database operations in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._is_audit_cancelled_sync, audit_id)

    async def process_audit_job(self, job_data: Dict[str, Any]):
        """Process a single audit job"""
        print(f"DEBUG: process_audit_job called with data: {job_data}")
        
        audit_id = job_data.get('audit_id') or job_data.get('auditId')
        company_id = job_data.get('company_id') or job_data.get('companyId')
        user_id = job_data.get('user_id') or job_data.get('userId', 0)
        query_count = job_data.get('query_count') or job_data.get('queryCount', 42)  # Default 42 queries (5-phase framework)
        providers = job_data.get('providers', ['openai_gpt5', 'anthropic_claude', 'google_gemini', 'perplexity'])
        config = job_data.get('config', {})

        # Extract force reanalyze flags
        skip_phase_2 = job_data.get('skip_phase_2', False)
        force_reanalyze = job_data.get('force_reanalyze', False)
        skip_analysis = job_data.get('skip_analysis', False)  # NEW: Skip re-analysis if responses already analyzed

        print(f"DEBUG: Extracted values - audit_id: {audit_id}, company_id: {company_id}, providers: {providers}")
        print(f"DEBUG: Force reanalyze flags - skip_phase_2: {skip_phase_2}, force_reanalyze: {force_reanalyze}, skip_analysis: {skip_analysis}")
        
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
            print(f"DEBUG: About to broadcast WebSocket (ws_manager={self.ws_manager})")
            try:
                if self.ws_manager:
                    print(f"DEBUG: Broadcasting to audit {audit_id}")
                    await self.ws_manager.broadcast_to_audit(
                        audit_id,
                        EventType.AUDIT_STARTED,
                        {
                            'query_count': query_count,
                            'provider_count': len(providers),
                            'company_name': company_context.company_name
                        }
                    )
                    print(f"DEBUG: WebSocket broadcast completed")
                else:
                    print(f"DEBUG: ws_manager is None, skipping broadcast")
            except Exception as e:
                print(f"DEBUG: WebSocket broadcast failed: {e}")
                logger.warning(f"WebSocket broadcast failed: {e}")

            print(f"DEBUG: After WebSocket broadcast block")

            # Check if we should skip query generation and execution (force reanalyze mode)
            if force_reanalyze or skip_phase_2:
                logger.info(f"[FORCE REANALYZE] Skipping query generation and execution - analyzing existing responses")
                print(f"DEBUG: Force reanalyze mode enabled - skipping to analysis phase")

                # Verify we have existing responses
                loop = asyncio.get_event_loop()
                existing_responses = await loop.run_in_executor(None, self._get_responses_to_analyze_sync, audit_id)
                logger.info(f"[FORCE REANALYZE] Found {len(existing_responses)} existing responses to analyze")
                print(f"DEBUG: Found {len(existing_responses)} existing responses")

                if len(existing_responses) == 0:
                    raise ValueError("Force reanalyze requested but no existing responses found in database")
            else:
                # Normal flow: Phase 1 & 2 - Generate and execute queries
                print(f"DEBUG: About to log query generation")
                logger.info(f"Generating {query_count} queries for audit {audit_id}")
                print(f"DEBUG: After logging, calling _retry_operation")
                queries = await self._retry_operation(
                    self._generate_queries,
                    audit_id,
                    company_context,
                    query_count
                )
                print(f"DEBUG: After _generate_queries, got {len(queries)} queries")

                # Check if audit was cancelled
                print(f"DEBUG: Checking if audit {audit_id} was cancelled...")
                is_cancelled = await self._is_audit_cancelled(audit_id)
                print(f"DEBUG: Cancellation check result: {is_cancelled}")
                if is_cancelled:
                    logger.info(f"Audit {audit_id} cancelled after query generation - stopping")
                    return
                print(f"DEBUG: Audit not cancelled, proceeding to query execution...")

                # Phase 2: Execute queries across LLMs
                print(f"DEBUG: About to log 'Executing queries'...")
                logger.info(f"Executing {len(queries)} queries across {len(providers)} providers")
                print(f"DEBUG: About to log 'Providers'...")
                logger.info(f"Providers: {providers}")
                print(f"DEBUG: About to log 'First 3 queries'...")
                logger.info(f"First 3 queries: {[q.get('query_text') if isinstance(q, dict) else (q[1] if len(q) > 1 else str(q)) for q in queries[:3]]}")
                print(f"DEBUG: About to call _execute_queries...")
                responses = await self._execute_queries(
                    audit_id,
                    queries,
                    providers,
                    company_context
                )

                # Check if audit was cancelled
                if await self._is_audit_cancelled(audit_id):
                    logger.info(f"Audit {audit_id} cancelled after query execution - stopping")
                    return

            # Phase 3: Analyze responses
            # MIGRATION PATH: Feature flag controls whether to use legacy Phase 1 or batched-only
            if skip_analysis:
                # Skip both Phase 1 and Phase 2
                logger.info("[SKIP ANALYSIS] Skipping response analysis - will calculate scores from database")
                print(f"DEBUG: skip_analysis=True - Skipping analysis, will fetch scores from database")
                analyses = None  # Signal to skip both phases
            elif self.config.use_batched_analysis_only:
                # NEW BATCHED-ONLY MODE: Skip Phase 1, use only Phase 2 Call #4
                if self.config.enable_phase1_deprecation_warnings:
                    logger.info("🚀 BATCHED-ONLY MODE: Skipping Phase 1 individual analysis (144 LLM calls saved)")
                    logger.info("   ✅ Will use only Phase 2 batched Call #4 for per-response metrics")
                analyses = []  # Empty list signals: "Phase 2 should run, but skip Phase 1"
            else:
                # LEGACY MODE: Run Phase 1 (deprecated)
                if self.config.enable_phase1_deprecation_warnings:
                    logger.warning("⚠️  DEPRECATION WARNING: Phase 1 individual analysis is deprecated")
                    logger.warning("   Set USE_BATCHED_ANALYSIS_ONLY=true to save 87.5% LLM costs")
                logger.info("Running Phase 1: Individual response analysis (legacy mode)")
                # Note: responses parameter not used in _analyze_responses, it fetches from database
                analyses = await self._analyze_responses(
                    audit_id,
                    {},  # Empty dict - method fetches responses from database
                    company_context
                )

            # Check if audit was cancelled
            if await self._is_audit_cancelled(audit_id):
                logger.info(f"Audit {audit_id} cancelled after response analysis - stopping")
                return

            # Phase 3.5: 🚀 World-Class Buyer-Journey Batching (Extract context-aware insights)
            if analyses is not None:
                # 🎯 COST OPTIMIZATION: Check if Phase 2 is already complete in database
                # This prevents re-running 96 expensive LLM API calls
                logger.info(f"🔍 Checking if Phase 2 is already complete for audit {audit_id}...")
                phase2_complete = await self._check_phase2_complete(audit_id)
                logger.info(f"🔍 Phase 2 completion check result: {phase2_complete}")

                if phase2_complete:
                    # Phase 2 already complete - load existing data from database
                    logger.info("⚡ Phase 2 already complete - loading from database and skipping to Layers 1-3")
                    logger.info("💰 Cost saved: ~96 LLM API calls (~$5-10)")
                    category_insights = await self._load_phase2_from_database(audit_id)
                else:
                    # Phase 2 not complete - run the full extraction
                    # Log which mode we're in
                    if isinstance(analyses, list) and len(analyses) == 0:
                        logger.info("🎯 Starting Phase 2 batching in BATCHED-ONLY mode (Call #4 will extract per-response metrics)")
                    else:
                        logger.info("🎯 Starting Phase 2 batching in LEGACY mode (Phase 1 already extracted per-response metrics)")
                    print(f"DEBUG: Extracting category-specific insights across 6 buyer journey stages")

                    # Group responses by buyer journey category
                    loop = asyncio.get_event_loop()
                    grouped_responses = await loop.run_in_executor(
                        None,
                        self._group_responses_by_buyer_journey_sync,
                        audit_id
                    )

                    # Extract insights for each phase (5 phases × ~4 batches × 3 extractions ≈ 60 LLM calls, varies by batch size)
                    category_insights = {}
                    for category, category_responses in grouped_responses.items():
                        if len(category_responses) == 0:
                            continue

                        category_insights[category] = await self._extract_batched_insights_by_category(
                            audit_id=audit_id,
                            category=category,
                            responses=category_responses,
                            context=company_context
                        )

                    logger.info(f"✅ Buyer-journey batching complete: {len(category_insights)} categories processed")

                    # Verify Phase 2 storage completed successfully (only after running Phase 2)
                    logger.info("🔍 Verifying Phase 2 storage...")
                    verification_results = await self._verify_phase2_storage(
                        audit_id=audit_id,
                        expected_categories=list(grouped_responses.keys())
                    )

                    logger.info(f"📊 Phase 2 Storage Verification Results:")
                    logger.info(f"   Status: {verification_results['overall_status'].upper()}")
                    logger.info(f"   Per-Response Metrics: {verification_results['per_response_metrics']['with_timestamp']}/{verification_results['per_response_metrics']['total']} stored")
                    logger.info(f"   Batch Insights: {len(verification_results['batch_insights'])} insight types stored")

                    if verification_results['missing_categories']:
                        logger.warning(f"   ⚠️  Missing categories: {verification_results['missing_categories']}")

                    if verification_results['overall_status'] == 'failed':
                        logger.error("❌ Phase 2 storage FAILED - no data stored to database")
                        raise ValueError("Phase 2 storage verification failed - aborting audit")
                    elif verification_results['overall_status'] == 'partial':
                        logger.warning("⚠️  Phase 2 storage PARTIAL - some data missing")
                    else:
                        logger.info("✅ Phase 2 storage verification PASSED")

                # Phase 3.75: 🚀🚀🚀 LAYERS 1-3: Strategic Intelligence Aggregation (22 LLM calls)
                logger.info("🎯🎯🎯 Starting Layers 1-3: Strategic Intelligence Aggregation (118-call architecture)")

                # Load full company context and persona
                full_company_context = await self._load_full_company_context(company_id)
                persona_context = determine_persona_context(full_company_context)

                logger.info(f"   Company: {full_company_context.company_name} ({full_company_context.company_size})")
                logger.info(f"   Persona: {persona_context.primary_persona} ({persona_context.decision_level})")

                # Calculate overall metrics for strategic intelligence context
                # In batched-only mode, we need to fetch metrics from database since analyses=[]
                loop = asyncio.get_event_loop()
                if analyses is None:
                    # Skip analysis mode - no metrics available
                    overall_metrics = {}
                elif isinstance(analyses, list) and len(analyses) == 0:
                    # Batched-only mode - calculate metrics from database for strategic intelligence
                    logger.info("[BATCHED-ONLY MODE] Calculating temporary metrics from database for strategic intelligence")
                    temp_scores = await loop.run_in_executor(None, self._calculate_scores_from_database_sync, audit_id)
                    overall_metrics = {
                        'overall_score': temp_scores.get('overall_score', 0),
                        'visibility': temp_scores.get('visibility', 0),
                        'sentiment': temp_scores.get('sentiment', 0),
                        'geo': temp_scores.get('geo', 0),
                        'sov': temp_scores.get('sov', 0),
                        'recommendation': temp_scores.get('recommendation', 0)
                    }
                    logger.info(f"[BATCHED-ONLY MODE] Temporary metrics for strategic intelligence: {overall_metrics}")
                else:
                    # Legacy mode - calculate from in-memory analyses
                    overall_metrics = self.response_analyzer.calculate_aggregate_metrics(analyses)

                # LAYER 1: Per-phase aggregation (15 LLM calls: 5 phases × 3 types)
                logger.info("🎯 LAYER 1: Aggregating insights per phase (15 LLM calls: 5 phases × 3 types)")
                category_aggregated = await self.strategic_aggregator.aggregate_by_category(
                    raw_insights=category_insights,
                    company_context=full_company_context,
                    persona_context=persona_context
                )
                logger.info(f"✅ LAYER 1 complete: {len(category_aggregated)} categories aggregated")

                # LAYER 2: Strategic prioritization (3 LLM calls: 3 types across categories)
                logger.info("🎯 LAYER 2: Strategic prioritization across categories (3 LLM calls)")
                strategic_priorities = await self.strategic_aggregator.create_strategic_priorities(
                    category_insights=category_aggregated,
                    company_context=full_company_context,
                    persona_context=persona_context,
                    overall_metrics=overall_metrics
                )
                logger.info(f"✅ LAYER 2 complete: Strategic priorities extracted")

                # LAYER 3: Executive summary (1 LLM call)
                logger.info("🎯 LAYER 3: Generating executive summary (1 LLM call)")
                executive_summary = await self.strategic_aggregator.generate_executive_summary(
                    strategic_priorities=strategic_priorities,
                    category_insights=category_aggregated,
                    company_context=full_company_context,
                    persona_context=persona_context,
                    overall_metrics=overall_metrics
                )
                logger.info(f"✅ LAYER 3 complete: Executive summary generated")

                logger.info("🎉🎉🎉 COMPLETE: 103 LLM calls total (84 batch + 15 Layer1 + 3 Layer2 + 1 Layer3) - 12.7% cost reduction!")

                # Store Layer 1-3 outputs to database
                logger.info("💾 Storing strategic intelligence to database...")
                await self._store_strategic_intelligence(
                    audit_id=audit_id,
                    category_aggregated=category_aggregated,
                    strategic_priorities=strategic_priorities,
                    executive_summary=executive_summary,
                    company_context=full_company_context,
                    persona_context=persona_context
                )
                logger.info("✅ Strategic intelligence stored successfully")

            # Phase 4: Calculate scores
            # Three modes:
            # 1. analyses is None -> skip_analysis mode (fetch pre-calculated scores)
            # 2. analyses is [] (empty list) -> batched-only mode (calculate from database)
            # 3. analyses has items -> legacy mode (calculate from in-memory analyses)
            loop = asyncio.get_event_loop()

            if analyses is None:
                # Mode 1: Skip analysis - fetch pre-calculated scores from database
                logger.info("[SKIP ANALYSIS MODE] Fetching pre-calculated scores from database")
                print(f"DEBUG: Mode 1 - Fetching pre-calculated scores for skip_analysis mode")
                scores = await loop.run_in_executor(None, self._get_scores_from_database_sync, audit_id)
                if not scores:
                    raise ValueError("skip_analysis requested but no scores found in database")
                print(f"DEBUG: Retrieved scores: {scores}")
            elif isinstance(analyses, list) and len(analyses) == 0:
                # Mode 2: Batched-only mode - Phase 2 Call #4 stored metrics to database
                logger.info("[BATCHED-ONLY MODE] Calculating scores from database-stored metrics")
                print(f"DEBUG: Mode 2 - Phase 1 skipped, using Phase 2 Call #4 database metrics")
                scores = await loop.run_in_executor(None, self._calculate_scores_from_database_sync, audit_id)
                print(f"DEBUG: Calculated scores from database: {scores}")
            else:
                # Mode 3: Legacy mode - Phase 1 populated analyses list
                logger.info("[LEGACY MODE] Calculating scores from in-memory analyses")
                print(f"DEBUG: Mode 3 - Using Phase 1 in-memory analyses ({len(analyses)} items)")
                scores = await self._calculate_scores(audit_id, analyses)

            # Check if audit was cancelled
            if await self._is_audit_cancelled(audit_id):
                logger.info(f"Audit {audit_id} cancelled after score calculation - stopping")
                return

            # Phase 5: Generate insights (optional - skip if analyses is None)
            insights = []
            if analyses is not None and config.get('generateInsights', True):
                logger.info("Generating insights")
                insights = await self._generate_insights(audit_id, analyses, scores)
            elif analyses is None:
                logger.info("[SKIP ANALYSIS] Skipping insights generation - no analyses available")
            
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
    
    def _get_company_context_sync(self, company_id: Optional[int]) -> Optional[dict]:
        """Fetch company from database (synchronous version for thread pool)"""
        if not company_id:
            return None

        conn = self._get_db_connection_sync()
        try:
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

                return cursor.fetchone()
        finally:
            self._put_db_connection_sync(conn)

    async def _get_company_context(self, company_id: Optional[int]) -> QueryContext:
        """Fetch company context for query generation"""

        if not company_id:
            # Return default context
            return QueryContext(
                company_name="Unknown Company",
                industry="Technology",
                sub_industry=None,
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

        # Run database query in thread pool
        loop = asyncio.get_event_loop()
        company = await loop.run_in_executor(None, self._get_company_context_sync, company_id)

        if not company:
            raise ValueError(f"Company {company_id} not found")

        # Priority cascade for description:
        # 1. final_description (if user explicitly edited)
        # 2. original_description (if user provided during onboarding - MOST DETAILED)
        # 3. description (fallback to enrichment)
        description_priority = (
            company.get('final_description') or
            company.get('original_description') or
            company.get('description', '')
        )

        # Extract enrichment data for business model classification
        enrichment_data = company.get('enrichment_data', {})

        return QueryContext(
            company_name=company['name'],
            industry=company.get('industry', 'Technology'),
            sub_industry=company.get('sub_industry', ''),
            description=description_priority,
            unique_value_propositions=company.get('value_props', []),
            target_audiences=company.get('target_audiences', []),
            competitors=company.get('competitors') or [],
            products_services=enrichment_data.get('products_services', []),
            pain_points_solved=company.get('pain_points', []),
            geographic_markets=company.get('markets', ['Global']),
            technology_stack=company.get('tech_stack'),
            pricing_model=company.get('pricing_model'),
            company_size=company.get('size'),
            founding_year=company.get('founded_year'),
            key_features=company.get('features') or [],
            use_cases=company.get('use_cases', []),
            integrations=company.get('integrations'),
            certifications=company.get('certifications'),
            metadata={
                'domain': company.get('domain', ''),
                'business_model': enrichment_data.get('business_model', 'B2B'),  # NEW: Pass business model from enrichment
                'customer_type': enrichment_data.get('customer_type'),  # NEW: Pass customer type
                'transaction_type': enrichment_data.get('transaction_type')  # NEW: Pass transaction type
            }
        )

    async def _load_full_company_context(self, company_id: int) -> CompanyContext:
        """Load complete company profile for strategic intelligence (118-call architecture)"""
        loop = asyncio.get_event_loop()
        company = await loop.run_in_executor(None, self._get_company_context_sync, company_id)

        if not company:
            raise ValueError(f"Company {company_id} not found")

        # Extract enrichment data
        enrichment_data = company.get('enrichment_data', {})

        # Create complete CompanyContext
        # Match the actual CompanyContext schema from strategic_aggregator.py
        return CompanyContext(
            company_id=company_id,
            company_name=company['name'],
            industry=company.get('industry', 'Technology'),
            sub_industry=company.get('sub_industry'),
            description=company.get('description', ''),
            company_size=company.get('company_size', 'smb'),
            employee_count=company.get('employee_count'),
            growth_stage=company.get('growth_stage', 'growth'),
            annual_revenue_range=company.get('annual_revenue_range'),
            business_model=enrichment_data.get('business_model', 'B2B'),
            pricing_model=company.get('pricing_model'),
            target_market=company.get('target_audiences', []),
            main_competitors=company.get('competitors') or [],
            competitive_position=company.get('competitive_position', 'challenger'),
            strategic_goals=company.get('strategic_goals', []),
            innovation_focus=company.get('innovation_focus', 'balanced'),
            products_services=enrichment_data.get('products_services', []),
            unique_value_propositions=company.get('value_props', []),
            key_features=company.get('key_features', []),
            domain=company.get('domain', ''),
            website=company.get('website')
        )

    def _check_existing_queries_sync(self, audit_id: str, count: int) -> Optional[List[Dict[str, Any]]]:
        """Check if queries already exist in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
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
                        metadata
                    FROM audit_queries
                    WHERE audit_id = %s
                    ORDER BY created_at
                    LIMIT %s
                """, (audit_id, count))

                queries_result = cursor.fetchall()

                if queries_result:
                    # Queries exist, return them
                    logger.info(f"Found {len(queries_result)} existing queries for audit {audit_id}")
                    return [{
                        'id': str(i),
                        'text': q['query_text'] if isinstance(q, dict) else q[0],
                        'intent': q['intent'] if isinstance(q, dict) else q[1],
                        'priority': float(q['priority_score'] if isinstance(q, dict) else q[4])
                    } for i, q in enumerate(queries_result)]

                return None
        finally:
            self._put_db_connection_sync(conn)

    def _save_generated_queries_sync(self, audit_id: str, generated_queries: List[Any]) -> int:
        """Save generated queries to database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                saved_count = 0
                for query in generated_queries:
                    cursor.execute(
                        """INSERT INTO audit_queries
                           (audit_id, query_text, category, intent, priority_score,
                            complexity_score, buyer_journey_stage, query_category, buyer_journey_phase, created_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
                        (
                            audit_id,
                            query.query_text,
                            query.buyer_journey_stage.lower(),  # 3-stage (backward compat)
                            query.intent.value,
                            query.priority_score,
                            query.complexity_score,
                            query.buyer_journey_stage,  # 3-stage (backward compat)
                            query.buyer_journey_category,  # OLD column: query_category (for backward compat reads)
                            query.buyer_journey_category   # NEW column: buyer_journey_phase (5-phase framework)
                        )
                    )
                    saved_count += 1

                conn.commit()
                logger.info(f"Saved {saved_count} queries with buyer journey categories for audit {audit_id}")
                return saved_count
        finally:
            self._put_db_connection_sync(conn)

    async def _generate_queries(
        self,
        audit_id: str,
        context: QueryContext,
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate or read existing queries using sophisticated GPT-5 based generator"""
        start_time = time.time()

        # Check if queries already exist (run in thread pool)
        loop = asyncio.get_event_loop()
        existing_queries = await loop.run_in_executor(
            None,
            self._check_existing_queries_sync,
            audit_id,
            count
        )

        if existing_queries:
            logger.info(f"Using {len(existing_queries)} existing queries for audit {audit_id}")

            # Send WebSocket notification that existing queries are being used
            if self.ws_manager:
                try:
                    await self.ws_manager.broadcast_to_audit(
                        audit_id,
                        EventType.QUERY_GENERATED,
                        {
                            'query_count': len(existing_queries),
                            'status': 'reused',
                            'message': f'Using {len(existing_queries)} existing queries from database'
                        }
                    )
                    logger.info(f"WebSocket notification sent for existing queries")
                except Exception as ws_error:
                    logger.warning(f"Failed to send existing queries WebSocket notification: {ws_error}")

            return existing_queries

        # No queries found - generate using sophisticated IntelligentQueryGenerator
        logger.info(f"Generating {count} new queries using IntelligentQueryGenerator (GPT-5) for audit {audit_id}")

        # Use the GPT-5 powered query generator (async call, not in thread pool)
        generated_queries = await self.query_generator.generate_queries(
            context=context,
            target_count=count,
            diversity_threshold=0.7  # Ensures deduplication
        )

        logger.info(f"GPT-5 generated {len(generated_queries)} diverse queries in {time.time() - start_time:.2f}s")

        # Save generated queries to database (run in thread pool)
        saved_count = await loop.run_in_executor(
            None,
            self._save_generated_queries_sync,
            audit_id,
            generated_queries
        )

        # Return queries in expected format
        result = [{
            'id': str(i),
            'text': q.query_text,
            'intent': q.intent.value,
            'priority': q.priority_score
        } for i, q in enumerate(generated_queries)]

        logger.info(f"Query generation completed: {len(result)} queries saved for audit {audit_id}")

        # Send WebSocket notification that query generation is complete
        if self.ws_manager:
            try:
                await self.ws_manager.broadcast_to_audit(
                    audit_id,
                    EventType.QUERY_GENERATED,
                    {
                        'query_count': len(result),
                        'status': 'completed',
                        'message': f'Successfully generated {len(result)} queries'
                    }
                )
                logger.info(f"WebSocket notification sent for query generation completion")
            except Exception as ws_error:
                logger.warning(f"Failed to send query generation WebSocket notification: {ws_error}")

        return result

    def _store_batch_responses_sync(self, audit_id: str, batch_results: Dict[str, List[Any]]) -> int:
        """Store query responses in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        stored_count = 0

        try:
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
                                stored_count += 1

            conn.commit()
            return stored_count
        finally:
            self._put_db_connection_sync(conn)

    async def _execute_queries(
        self,
        audit_id: str,
        queries: List[Dict[str, Any]],
        providers: List[str],
        context: QueryContext
    ) -> Dict[str, List[Any]]:
        """Execute queries across LLM providers"""
        print(f"DEBUG: _execute_queries ENTRY - audit_id: {audit_id}, queries: {len(queries)}, providers: {providers}")
        print(f"DEBUG: About to call logger.info...")
        try:
            logger.info(f"_execute_queries called with {len(queries)} queries and providers: {providers}")
            print(f"DEBUG: logger.info completed")
        except Exception as e:
            print(f"DEBUG: logger.info failed: {e}")

        print(f"DEBUG: Converting provider strings to enums...")
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

        print(f"DEBUG: Converted to {len(provider_enums)} provider enums: {provider_enums}")

        # Sort queries by priority (handle both dict and tuple formats)
        def get_priority(q):
            if isinstance(q, dict):
                return q.get('priority_score', q.get('priority', 5)) or 5
            else:
                # Tuple format from database
                return q[4] if len(q) > 4 else 5  # priority_score is at index 4

        sorted_queries = sorted(queries, key=get_priority, reverse=True)
        print(f"DEBUG: Sorted {len(sorted_queries)} queries by priority")

        # Execute in batches
        all_responses = {}
        total_batches = (len(sorted_queries) + self.config.batch_size - 1) // self.config.batch_size
        print(f"DEBUG: Will execute {total_batches} batches (batch_size={self.config.batch_size})")

        for i in range(0, len(sorted_queries), self.config.batch_size):
            batch_num = i // self.config.batch_size + 1
            print(f"DEBUG: Starting batch {batch_num}/{total_batches}")

            # Check if audit was cancelled before each batch
            if await self._is_audit_cancelled(audit_id):
                logger.info(f"Audit {audit_id} cancelled during query execution - stopping at batch {batch_num}")
                print(f"DEBUG: Audit cancelled at batch {batch_num}")
                return all_responses

            batch = sorted_queries[i:i + self.config.batch_size]
            # Extract query text (handle both dict and tuple formats)
            batch_queries = []
            for q in batch:
                if isinstance(q, dict):
                    batch_queries.append(q.get('query_text', q.get('text', '')))
                else:
                    # Tuple format: (id, query_text, intent, category, ...)
                    batch_queries.append(q[1] if len(q) > 1 else '')

            print(f"DEBUG: Batch {batch_num} has {len(batch_queries)} queries")

            # Execute batch across providers
            logger.info(f"Batch {batch_num}/{total_batches}: Executing {len(batch_queries)} queries across {len(provider_enums)} providers")
            print(f"DEBUG: Calling llm_orchestrator.execute_audit_queries for batch {batch_num}")
            batch_results = await self.llm_orchestrator.execute_audit_queries(
                batch_queries,
                provider_enums,
                parallel_execution=True,
                use_cache=True,
                use_fallback=True
            )

            print(f"DEBUG: Batch {batch_num} execution completed, got {len(batch_results)} results")

            # Store batch results in database using thread pool
            print(f"DEBUG: Storing batch {batch_num} results to database...")
            loop = asyncio.get_event_loop()
            stored_count = await loop.run_in_executor(None, self._store_batch_responses_sync, audit_id, batch_results)
            print(f"DEBUG: Stored {stored_count} responses from batch {batch_num}")

            all_responses.update(batch_results)

            # Update progress
            print(f"DEBUG: Broadcasting progress: {len(all_responses)}/{len(sorted_queries)} responses collected")
            await self.ws_manager.broadcast_to_audit(
                audit_id,
                EventType.QUERY_COMPLETED,
                {'completed': len(all_responses), 'total': len(sorted_queries)}
            )

        print(f"DEBUG: Query execution completed. Total responses: {len(all_responses)}")
        logger.info(f"Query execution completed: {len(all_responses)} total responses collected")
        return all_responses
    
    def _get_responses_to_analyze_sync(self, audit_id: str) -> List[dict]:
        """Get responses needing analysis (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT q.id, q.query_text, r.id as response_id, r.response_text, r.provider
                    FROM audit_queries q
                    JOIN audit_responses r ON r.query_id = q.id
                    WHERE q.audit_id = %s
                """, (audit_id,))
                return cursor.fetchall()
        finally:
            self._put_db_connection_sync(conn)

    def _get_scores_from_database_sync(self, audit_id: str) -> Optional[Dict[str, float]]:
        """Get pre-calculated scores from database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Fetch from audit_score_breakdown table
                cursor.execute("""
                    SELECT overall, visibility, sentiment, recommendation, geo, sov, context_completeness
                    FROM audit_score_breakdown
                    WHERE audit_id = %s
                """, (audit_id,))
                result = cursor.fetchone()
                if result:
                    return {
                        'overall_score': result['overall'],
                        'visibility': result['visibility'],
                        'sentiment': result['sentiment'],
                        'recommendation': result['recommendation'],
                        'geo': result['geo'],
                        'sov': result['sov'],
                        'context_completeness': result['context_completeness']
                    }
                return None
        finally:
            self._put_db_connection_sync(conn)

    def _calculate_scores_from_database_sync(self, audit_id: str) -> Dict[str, float]:
        """
        Calculate scores from database-stored metrics (batched-only mode).

        Used when Phase 1 is skipped and Phase 2 Call #4 stored metrics directly to database.
        Fetches all audit_responses for the audit and aggregates metrics similar to
        response_analyzer.calculate_aggregate_metrics() but from database records.

        Args:
            audit_id: The audit ID to calculate scores for

        Returns:
            Dictionary with calculated scores matching the standard score structure
        """
        logger.info(f"[BATCHED-ONLY MODE] Calculating scores from database for audit {audit_id}")
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Fetch all response metrics from database
                cursor.execute("""
                    SELECT
                        brand_mentioned,
                        sentiment,
                        recommendation_strength,
                        geo_score,
                        sov_score,
                        context_completeness_score,
                        featured_snippet_potential,
                        voice_search_optimized
                    FROM audit_responses
                    WHERE audit_id = %s
                """, (audit_id,))

                responses = cursor.fetchall()

                if not responses or len(responses) == 0:
                    logger.warning(f"No responses found in database for audit {audit_id}")
                    # Return zeros if no data
                    return {
                        'overall_score': 0.0,
                        'visibility': 0.0,
                        'sentiment': 0.0,
                        'recommendation': 0.0,
                        'geo': 0.0,
                        'sov': 0.0,
                        'context_completeness': 0.0
                    }

                total = len(responses)
                logger.info(f"[BATCHED-ONLY MODE] Aggregating metrics from {total} responses")

                # Calculate visibility score
                brand_mentions = sum(1 for r in responses if r['brand_mentioned'])
                visibility_score = (brand_mentions / total) * 100.0

                # Calculate sentiment score
                # Map sentiment strings to scores: positive=1.0, neutral=0.5, negative=0.0
                sentiment_map = {'positive': 1.0, 'neutral': 0.5, 'negative': 0.0}
                sentiment_scores = [sentiment_map.get(r['sentiment'], 0.5) for r in responses]
                sentiment_score = (sum(sentiment_scores) / len(sentiment_scores)) * 100.0

                # Calculate recommendation score
                # Map recommendation_strength: strongly_recommended=1.0, mentioned=0.7, neutral=0.5, not_recommended=0.0
                rec_map = {
                    'strongly_recommended': 1.0,
                    'recommended': 0.85,
                    'mentioned': 0.7,
                    'neutral': 0.5,
                    'not_mentioned': 0.3,
                    'not_recommended': 0.0
                }
                rec_scores = [rec_map.get(r['recommendation_strength'], 0.5) for r in responses]
                recommendation_score = (sum(rec_scores) / len(rec_scores)) * 100.0

                # Calculate aggregate GEO score
                geo_scores = [float(r['geo_score'] or 0.0) for r in responses]
                geo_score = sum(geo_scores) / len(geo_scores) if geo_scores else 0.0

                # Calculate aggregate SOV score
                sov_scores = [float(r['sov_score'] or 0.0) for r in responses]
                sov_score = sum(sov_scores) / len(sov_scores) if sov_scores else 0.0

                # Calculate context completeness
                context_scores = [float(r['context_completeness_score'] or 0.0) for r in responses]
                context_completeness = sum(context_scores) / len(context_scores) if context_scores else 0.0

                # Calculate overall score using enhanced formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)
                overall_score = (
                    geo_score * 0.30 +
                    sov_score * 0.25 +
                    recommendation_score * 0.20 +
                    sentiment_score * 0.15 +
                    visibility_score * 0.10
                )

                logger.info(f"[BATCHED-ONLY MODE] Scores calculated from database:")
                logger.info(f"  Overall: {overall_score:.2f}")
                logger.info(f"  GEO: {geo_score:.2f}, SOV: {sov_score:.2f}")
                logger.info(f"  Visibility: {visibility_score:.2f}, Sentiment: {sentiment_score:.2f}")
                logger.info(f"  Recommendation: {recommendation_score:.2f}, Context: {context_completeness:.2f}")

                return {
                    'overall_score': overall_score,
                    'visibility': visibility_score,
                    'sentiment': sentiment_score,
                    'recommendation': recommendation_score,
                    'geo': geo_score,
                    'sov': sov_score,
                    'context_completeness': context_completeness
                }

        finally:
            self._put_db_connection_sync(conn)

    def _store_analysis_result_sync(self, response_id: str, analysis: Any):
        """Store analysis result (synchronous version for thread pool)"""
        print(f"DEBUG: _store_analysis_result_sync - response_id: {response_id}")
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                print(f"DEBUG: Updating audit_responses with analysis data for response {response_id}")
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
                    analysis.featured_snippet_potential > 50,
                    analysis.voice_search_optimized,
                    json.dumps({
                        'processing_time_ms': analysis.processing_time_ms,
                        'analysis_id': analysis.analysis_id
                    }),
                    analysis.geo_score,
                    analysis.sov_score,
                    analysis.context_completeness_score,
                    json.dumps(analysis.recommendations) if analysis.recommendations else json.dumps([]),
                    response_id
                ))
            conn.commit()
            print(f"DEBUG: Analysis data committed to database for response {response_id}")
        except Exception as e:
            print(f"DEBUG: Error storing analysis result: {e}")
            raise
        finally:
            self._put_db_connection_sync(conn)

    async def _analyze_responses(
        self,
        audit_id: str,
        responses: Dict[str, List[Any]],
        context: QueryContext
    ) -> List[Any]:
        """Analyze LLM responses - PARALLEL VERSION for 6-10x speedup"""
        print(f"DEBUG: _analyze_responses ENTRY (PARALLEL MODE) - audit_id: {audit_id}, company: {context.company_name}")

        start_time = time.time()

        # Get responses to analyze using thread pool
        print(f"DEBUG: Fetching responses from database...")
        loop = asyncio.get_event_loop()
        responses_to_analyze = await loop.run_in_executor(None, self._get_responses_to_analyze_sync, audit_id)

        total_responses = len(responses_to_analyze)
        print(f"DEBUG: Found {total_responses} responses to analyze")
        logger.info(f"🚀 PARALLEL: Starting concurrent analysis of {total_responses} responses for audit {audit_id}")

        # Send initial progress update
        print(f"DEBUG: Sending initial GEO/SOV progress update...")
        await self._send_geo_sov_progress(
            audit_id,
            stage='analyzing',
            progress=0,
            total_queries=total_responses,
            completed_queries=0,
            message="Starting parallel GEO/SOV analysis..."
        )
        print(f"DEBUG: Initial progress update sent")

        # PARALLEL PROCESSING: Process multiple responses concurrently
        CONCURRENT_ANALYSES = 10  # Process 10 responses simultaneously
        semaphore = asyncio.Semaphore(CONCURRENT_ANALYSES)
        completed_count = 0
        analyses = []

        logger.info(f"🚀 Using semaphore with {CONCURRENT_ANALYSES} concurrent slots")

        async def analyze_single_response(idx, response_data):
            """Analyze a single response with semaphore control"""
            nonlocal completed_count

            async with semaphore:
                try:
                    print(f"DEBUG: [PARALLEL {idx+1}/{total_responses}] Starting analysis")
                    print(f"DEBUG:   Provider: {response_data['provider']}")
                    print(f"DEBUG:   Query: {response_data['query_text'][:50]}...")

                    # Analyze response
                    analysis = await self.response_analyzer.analyze_response(
                        response_text=response_data['response_text'],
                        query=response_data['query_text'],
                        brand_name=context.company_name,
                        competitors=context.competitors,
                        provider=response_data['provider']
                    )

                    print(f"DEBUG: [PARALLEL {idx+1}] Analysis complete - Brand: {analysis.brand_analysis.mentioned}, Sentiment: {analysis.brand_analysis.sentiment.value}")

                    # Store analysis results using thread pool
                    await loop.run_in_executor(None, self._store_analysis_result_sync, response_data['response_id'], analysis)
                    print(f"DEBUG: [PARALLEL {idx+1}] Stored in database")

                    # Update completed count and progress
                    completed_count += 1
                    progress = int((completed_count / total_responses) * 100)
                    current_stage = 'calculating_geo' if completed_count < total_responses/2 else 'calculating_sov'

                    # Send progress update (throttled to avoid spam)
                    if completed_count % 5 == 0 or completed_count == total_responses:
                        await self._send_geo_sov_progress(
                            audit_id,
                            stage=current_stage,
                            progress=progress,
                            current_provider=response_data['provider'],
                            current_query=response_data['query_text'][:50],
                            total_queries=total_responses,
                            completed_queries=completed_count,
                            message=f"Analyzed {completed_count}/{total_responses} responses"
                        )

                    # Notify progress via WebSocket (throttled)
                    if completed_count % 10 == 0 or completed_count == total_responses:
                        await self.ws_manager.broadcast_to_audit(
                            audit_id,
                            EventType.LLM_RESPONSE_RECEIVED,
                            {
                                'query': response_data['query_text'],
                                'provider': response_data['provider'],
                                'brand_mentioned': analysis.brand_analysis.mentioned,
                                'sentiment': analysis.brand_analysis.sentiment.value,
                                'completed': completed_count,
                                'total': total_responses
                            }
                        )

                    # Update heartbeat periodically
                    if completed_count % 20 == 0:
                        await self._update_heartbeat(audit_id)
                        print(f"DEBUG: Heartbeat updated at {completed_count} responses")

                    return (idx, analysis)

                except Exception as e:
                    logger.error(f"Error analyzing response {idx+1}: {e}")
                    print(f"DEBUG: [PARALLEL {idx+1}] ERROR: {e}")
                    # Return None for failed analyses - don't stop entire batch
                    return (idx, None)

        # Create tasks for all responses
        print(f"DEBUG: Creating {total_responses} parallel analysis tasks...")
        tasks = [
            analyze_single_response(idx, response_data)
            for idx, response_data in enumerate(responses_to_analyze)
        ]

        # Execute all tasks concurrently and collect results as they complete
        print(f"DEBUG: Executing tasks with asyncio.gather...")
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Sort results by index and filter out failures
        print(f"DEBUG: Processing {len(results)} results...")
        analyses = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Task failed with exception: {result}")
                continue

            idx, analysis = result
            if analysis is not None:
                analyses.append(analysis)
            else:
                logger.warning(f"Response {idx+1} analysis returned None")

        elapsed = time.time() - start_time
        throughput = total_responses / elapsed if elapsed > 0 else 0

        print(f"DEBUG: ✅ PARALLEL analysis completed")
        print(f"DEBUG:   Total responses: {total_responses}")
        print(f"DEBUG:   Successful: {len(analyses)}")
        print(f"DEBUG:   Failed: {total_responses - len(analyses)}")
        print(f"DEBUG:   Time: {elapsed:.2f}s")
        print(f"DEBUG:   Throughput: {throughput:.2f} responses/sec")

        logger.info(f"✅ PARALLEL: Analyzed {len(analyses)}/{total_responses} responses in {elapsed:.2f}s ({throughput:.2f} resp/sec)")

        return analyses
    

    def _store_scores_sync(self, audit_id: str, visibility_score: float, sentiment_score: float,
                           recommendation_score: float, geo_score: float, sov_score: float,
                           context_completeness: float, overall_score: float):
        """Store scores in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
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
                """, (audit_id, visibility_score, sentiment_score, recommendation_score,
                      geo_score, sov_score, context_completeness, overall_score))

                cursor.execute("""
                    UPDATE ai_visibility_audits
                    SET
                        overall_score = %s,
                        brand_mention_rate = %s
                    WHERE id = %s
                """, (overall_score, visibility_score, audit_id))

            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

    async def _calculate_scores(
        self,
        audit_id: str,
        analyses: List[Any]
    ) -> Dict[str, float]:
        """Calculate audit scores using enhanced formula with GEO and SOV"""
        print(f"DEBUG: _calculate_scores ENTRY - audit_id: {audit_id}, analyses: {len(analyses)}")
        logger.info(f"Calculating scores for audit {audit_id} with {len(analyses)} analyses")

        # Send aggregating progress
        print(f"DEBUG: Sending aggregating progress update...")
        await self._send_geo_sov_progress(
            audit_id,
            stage='aggregating',
            progress=90,
            total_queries=len(analyses),
            completed_queries=len(analyses),
            message="Aggregating final scores..."
        )

        # Calculate aggregate metrics including GEO and SOV
        print(f"DEBUG: Calling response_analyzer.calculate_aggregate_metrics...")
        aggregate_metrics = self.response_analyzer.calculate_aggregate_metrics(analyses)
        print(f"DEBUG: Aggregate metrics calculated. Keys: {list(aggregate_metrics.keys())}")

        # Extract component scores
        geo_score = aggregate_metrics.get('geo_score', 0)
        sov_score = aggregate_metrics.get('sov_score', 0)
        recommendation_score = aggregate_metrics.get('recommendation', 0)
        sentiment_score = aggregate_metrics.get('sentiment', 0)
        visibility_score = aggregate_metrics.get('visibility', 0)
        context_completeness = aggregate_metrics.get('context_completeness_score', 0)

        print(f"DEBUG: Component scores extracted:")
        print(f"DEBUG:   GEO Score: {geo_score:.2f}")
        print(f"DEBUG:   SOV Score: {sov_score:.2f}")
        print(f"DEBUG:   Recommendation: {recommendation_score:.2f}")
        print(f"DEBUG:   Sentiment: {sentiment_score:.2f}")
        print(f"DEBUG:   Visibility: {visibility_score:.2f}")
        print(f"DEBUG:   Context Completeness: {context_completeness:.2f}")

        # Enhanced formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)
        print(f"DEBUG: Calculating overall score with formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)")
        overall_score = (
            geo_score * 0.30 +
            sov_score * 0.25 +
            recommendation_score * 0.20 +
            sentiment_score * 0.15 +
            visibility_score * 0.10
        )
        print(f"DEBUG: Overall score calculated: {overall_score:.2f}")
        logger.info(f"Scores calculated - Overall: {overall_score:.2f}, GEO: {geo_score:.2f}, SOV: {sov_score:.2f}")

        # ═══════════════════════════════════════════════════════════════════════════
        # ARCHITECTURAL FIX: Data Quality Validation & Circuit Breaker
        # ═══════════════════════════════════════════════════════════════════════════

        logger.info("")
        logger.info("=" * 80)
        logger.info("🔍 DATA QUALITY VALIDATION CHECKPOINT")
        logger.info("=" * 80)

        validation_warnings = []
        validation_errors = []
        data_quality_score = 100.0

        # VALIDATION 1: Check for zero score anomaly (critical)
        if overall_score == 0.0 and len(analyses) > 0:
            validation_errors.append("All scores are zero despite having analyzed responses")
            data_quality_score -= 50
            logger.error("❌ CRITICAL: Overall score is ZERO with non-empty analysis")

        # VALIDATION 2: Brand detection circuit breaker
        brand_mention_rate = visibility_score
        if brand_mention_rate < 5.0 and len(analyses) > 10:
            validation_errors.append(f"Brand detected in only {brand_mention_rate:.1f}% of responses")
            data_quality_score -= 40
            logger.error(f"❌ CIRCUIT BREAKER: Brand mention rate critically low: {brand_mention_rate:.1f}%")
            logger.error(f"   This indicates a brand detection failure - likely bug in response analyzer")

            # Log sample for debugging
            if len(analyses) > 0:
                sample = analyses[0]
                logger.error(f"   Sample analysis:")
                logger.error(f"     Brand mentioned: {sample.brand_analysis.mentioned}")
                logger.error(f"     Response preview: {sample.metadata.get('response_text', '')[:200]}...")

        # VALIDATION 3: All component scores are zero (suspicious)
        if (geo_score == 0 and sov_score == 0 and recommendation_score == 0 and
            sentiment_score == 0 and visibility_score == 0):
            validation_errors.append("All component scores are zero")
            data_quality_score -= 50
            logger.error("❌ CRITICAL: ALL component scores are zero - systemic failure")

        # VALIDATION 4: Score sanity checks (out of range)
        score_checks = {
            'overall': overall_score,
            'geo': geo_score,
            'sov': sov_score,
            'visibility': visibility_score,
            'sentiment': sentiment_score,
            'recommendation': recommendation_score,
            'context_completeness': context_completeness
        }

        for score_name, score_value in score_checks.items():
            if not (0.0 <= score_value <= 100.0):
                validation_errors.append(f"{score_name} score {score_value:.2f} out of valid range [0-100]")
                data_quality_score -= 10
                logger.error(f"❌ Invalid {score_name} score: {score_value:.2f} (must be 0-100)")

        # VALIDATION 5: Insufficient data warning
        if len(analyses) < 10:
            validation_warnings.append(f"Only {len(analyses)} responses analyzed (recommended: >10)")
            data_quality_score -= 10
            logger.warning(f"⚠️ Low sample size: {len(analyses)} responses")

        # VALIDATION 6: Check for anomalous patterns
        if overall_score > 0 and brand_mention_rate == 0:
            validation_warnings.append("Overall score > 0 but brand never mentioned (inconsistent)")
            data_quality_score -= 15
            logger.warning("⚠️ Inconsistency: Score > 0 but brand_mention_rate = 0")

        # Calculate final data quality assessment
        data_quality_status = "high_confidence"
        if data_quality_score < 30:
            data_quality_status = "invalid"
        elif data_quality_score < 50:
            data_quality_status = "needs_review"
        elif data_quality_score < 75:
            data_quality_status = "low_confidence"

        # Log validation results
        logger.info(f"Data Quality Score: {data_quality_score:.1f}/100")
        logger.info(f"Data Quality Status: {data_quality_status}")

        if validation_warnings:
            logger.info(f"⚠️ Warnings ({len(validation_warnings)}):")
            for warning in validation_warnings:
                logger.info(f"  • {warning}")

        if validation_errors:
            logger.info(f"❌ Errors ({len(validation_errors)}):")
            for error in validation_errors:
                logger.info(f"  • {error}")

        logger.info("=" * 80)
        logger.info("")

        # CIRCUIT BREAKER: Fail fast if data quality is invalid
        if data_quality_status == "invalid":
            error_summary = "; ".join(validation_errors)
            logger.error("🛑 CIRCUIT BREAKER TRIGGERED: Data quality invalid, halting audit")
            raise ValueError(
                f"Data quality validation failed for audit {audit_id}: {error_summary}. "
                f"Data quality score: {data_quality_score:.1f}/100. "
                f"This audit requires manual investigation before proceeding."
            )

        # WARNING: Log if quality is questionable but allow to proceed
        if data_quality_status in ["needs_review", "low_confidence"]:
            logger.warning(f"⚠️ Audit {audit_id} has {data_quality_status} data quality")
            logger.warning(f"   Recommendation: Manual review suggested")
            # Store warning in error_message field for visibility
            warning_msg = f"Data quality: {data_quality_status} ({data_quality_score:.1f}/100)"
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._update_audit_status_sync,
                audit_id,
                'processing',  # Keep processing
                warning_msg  # But log the warning
            )

        # ═══════════════════════════════════════════════════════════════════════════
        # END VALIDATION CHECKPOINT
        # ═══════════════════════════════════════════════════════════════════════════

        # Store scores in database using thread pool
        print(f"DEBUG: Storing scores in database...")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._store_scores_sync,
            audit_id, visibility_score, sentiment_score, recommendation_score,
            geo_score, sov_score, context_completeness,
            overall_score
        )
        print(f"DEBUG: Scores stored successfully in database")

        # Send completion progress with final scores
        print(f"DEBUG: Sending completion progress with final scores...")
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
        print(f"DEBUG: Completion progress sent")

        result = {
            'overall_score': overall_score,
            'visibility': visibility_score,
            'sentiment': sentiment_score,
            'recommendation': recommendation_score,
            'geo': geo_score,
            'sov': sov_score,
            'context_completeness': context_completeness
        }
        print(f"DEBUG: _calculate_scores completed, returning scores: {result}")
        return result
    

    def _store_insights_sync(self, audit_id: str, insights: List[str]):
        """Store insights in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                for insight in insights:
                    cursor.execute("""
                        INSERT INTO audit_insights (audit_id, insight_text, category, importance)
                        VALUES (%s, %s, %s, %s)
                    """, (audit_id, insight, 'general', 'high'))
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

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
        
        # Sentiment insights (safe access with default)
        if aggregate_metrics.get('average_sentiment_score', 1.0) < 0.5:
            insights.append(
                "Negative sentiment detected. Review and address common criticisms in AI training data."
            )

        # Competitive insights
        competitor_dominance = aggregate_metrics.get('competitor_dominance', {})
        if competitor_dominance and len(analyses) > 0:
            top_competitor = max(competitor_dominance.items(), key=lambda x: x[1])
            if top_competitor[1] > len(analyses) * 0.5:
                insights.append(
                    f"{top_competitor[0]} dominates {top_competitor[1]/len(analyses)*100:.0f}% of responses. "
                    "Focus on differentiation."
                )

        # SEO insights (safe access with default)
        if aggregate_metrics.get('featured_snippet_potential_rate', 100) < 30:
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
        # Insights are stored in dashboard_data.key_insights during dashboard population
        # No need to store them separately in a non-existent audit_insights table
        logger.info(f"Generated {len(insights)} insights for audit {audit_id}")

        return insights

    # =====================================================
    # World-Class Buyer-Journey Batching Infrastructure
    # =====================================================

    def _group_responses_by_buyer_journey_sync(self, audit_id: str) -> Dict[str, List[Dict]]:
        """
        Group responses by buyer journey phase (5-phase framework)

        Returns responses organized by: discovery, research, evaluation, comparison, purchase
        Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)

        World-class implementation for context-aware analysis batching.
        """
        logger.info(f"Grouping responses by buyer journey category for audit {audit_id}")

        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Fetch all responses with their buyer journey categories
                cursor.execute("""
                    SELECT
                        ar.id as response_id,
                        ar.response_text,
                        ar.provider,
                        ar.brand_mentioned,
                        aq.query_text,
                        aq.query_category,
                        aq.buyer_journey_stage
                    FROM audit_responses ar
                    JOIN audit_queries aq ON ar.query_id = aq.id
                    WHERE ar.audit_id = %s
                    ORDER BY aq.query_category, ar.id
                """, (audit_id,))

                responses = cursor.fetchall()

            # Group by category (5-phase framework)
            # Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)
            grouped = {
                'discovery': [],       # 6 queries, 14% - Problem awareness
                'research': [],        # 8 queries, 19% - Solution landscape
                'evaluation': [],      # 10 queries, 24% - Brand investigation
                'comparison': [],      # 12 queries, 29% - CRITICAL (60-70% of B2B deals won/lost)
                'purchase': []         # 6 queries, 14% - Conversion intent
            }

            for response in responses:
                category = response['query_category'] or 'research'  # Default to research (was solution_seeking)
                if category in grouped:
                    grouped[category].append(dict(response))

            # Log distribution
            for category, responses_list in grouped.items():
                logger.info(f"  {category}: {len(responses_list)} responses")

            return grouped

        finally:
            self._put_db_connection_sync(conn)

    async def _extract_batched_insights_by_category(
        self,
        audit_id: str,
        category: str,
        responses: List[Dict],
        context: QueryContext
    ) -> Dict[str, Any]:
        """
        Extract insights and per-response metrics for a batch of responses
        within a specific buyer journey category.

        World-class 4-call architecture:
        - 3 LLM calls for aggregate insights (recommendations, gaps, opportunities)
        - 1 LLM call for per-response metrics (brand, sentiment, GEO, SOV, etc.)

        Args:
            audit_id: Audit identifier
            category: Buyer journey phase (e.g., 'comparison', 'purchase', 'evaluation')
            responses: List of responses in this phase
            context: Company context for analysis

        Returns:
            Dictionary with batched insights and per-response metrics
        """
        if len(responses) == 0:
            return {'recommendations': [], 'competitive_gaps': [], 'content_opportunities': []}

        logger.info(f"🎯 Extracting batched insights for {category} category ({len(responses)} responses)")

        # Split into 4 batches per category (8 responses each for optimal LLM context)
        batch_size = max(1, len(responses) // 4)
        batches = [
            responses[i:i+batch_size] for i in range(0, len(responses), batch_size)
        ][:4]  # Ensure max 4 batches

        logger.info(f"   Split into {len(batches)} batches: {[len(b) for b in batches]} responses each")

        all_insights = {
            'recommendations': [],
            'competitive_gaps': [],
            'content_opportunities': []
        }

        # Process each batch with 4 parallel LLM calls
        for batch_num, batch in enumerate(batches, 1):
            if len(batch) == 0:
                continue

            # Combine response texts for aggregate insights (limit to ~12K tokens)
            combined_text = "\n\n---\n\n".join([
                f"Query: {r['query_text']}\n"
                f"Provider: {r['provider']}\n"
                f"Brand Mentioned: {r.get('brand_mentioned', 'unknown')}\n"
                f"Response: {r['response_text'][:1500]}"  # Limit each response
                for r in batch[:16]  # Max 16 responses per batch
            ])

            logger.info(f"   🚀 Processing batch {batch_num}/4 ({len(batch)} responses)")

            try:
                # 4 PARALLEL LLM CALLS per batch
                logger.info(f"      Making 4 parallel LLM calls for batch {batch_num}...")

                results = await asyncio.gather(
                    # Call #1: Recommendations
                    self.recommendation_aggregator._extract_single_type(
                        response_texts=combined_text,
                        brand_name=context.company_name,
                        category=category,
                        industry=context.industry,
                        competitors=context.competitors[:5],
                        extraction_type='recommendations',
                        max_items=10
                    ),
                    # Call #2: Competitive Gaps
                    self.recommendation_aggregator._extract_single_type(
                        response_texts=combined_text,
                        brand_name=context.company_name,
                        category=category,
                        industry=context.industry,
                        competitors=context.competitors[:5],
                        extraction_type='competitive_gaps',
                        max_items=10
                    ),
                    # Call #3: Content Opportunities
                    self.recommendation_aggregator._extract_single_type(
                        response_texts=combined_text,
                        brand_name=context.company_name,
                        category=category,
                        industry=context.industry,
                        competitors=context.competitors[:5],
                        extraction_type='content_opportunities',
                        max_items=10
                    ),
                    # Call #4: Per-Response Metrics ⭐ NEW
                    self.recommendation_aggregator.extract_per_response_metrics(
                        responses_batch=batch,
                        brand_name=context.company_name,
                        competitors=context.competitors[:5],
                        category=category,
                        industry=context.industry
                    ),
                    return_exceptions=True
                )

                # Process results
                recommendations, competitive_gaps, content_opportunities, per_response_metrics = results

                # Handle exceptions
                if isinstance(recommendations, Exception):
                    logger.error(f"      Error extracting recommendations: {recommendations}")
                    recommendations = []
                if isinstance(competitive_gaps, Exception):
                    logger.error(f"      Error extracting competitive gaps: {competitive_gaps}")
                    competitive_gaps = []
                if isinstance(content_opportunities, Exception):
                    logger.error(f"      Error extracting content opportunities: {content_opportunities}")
                    content_opportunities = []
                if isinstance(per_response_metrics, Exception):
                    logger.error(f"      Error extracting per-response metrics: {per_response_metrics}")
                    per_response_metrics = []

                # Merge aggregate insights from this batch
                all_insights['recommendations'].extend(recommendations if not isinstance(recommendations, Exception) else [])
                all_insights['competitive_gaps'].extend(competitive_gaps if not isinstance(competitive_gaps, Exception) else [])
                all_insights['content_opportunities'].extend(content_opportunities if not isinstance(content_opportunities, Exception) else [])

                logger.info(f"      ✅ Batch {batch_num} aggregate insights complete:")
                logger.info(f"         - {len(recommendations) if not isinstance(recommendations, Exception) else 0} recommendations")
                logger.info(f"         - {len(competitive_gaps) if not isinstance(competitive_gaps, Exception) else 0} competitive gaps")
                logger.info(f"         - {len(content_opportunities) if not isinstance(content_opportunities, Exception) else 0} content opportunities")

                # Store per-response metrics (4th call result)
                if per_response_metrics and not isinstance(per_response_metrics, Exception):
                    logger.info(f"      📊 Storing {len(per_response_metrics)} per-response metrics...")
                    await self._store_per_response_metrics(
                        audit_id=audit_id,
                        category=category,
                        batch_num=batch_num,
                        batch=batch,
                        metrics=per_response_metrics
                    )
                    logger.info(f"      ✅ Per-response metrics stored successfully")
                else:
                    logger.warning(f"      ⚠️  No per-response metrics to store for batch {batch_num}")

                # Store Phase 2 raw batch insights
                logger.info(f"      💾 Storing Phase 2 raw batch insights...")
                await self._store_batch_insights(
                    audit_id=audit_id,
                    category=category,
                    batch_number=batch_num,
                    recommendations=recommendations if not isinstance(recommendations, Exception) else [],
                    competitive_gaps=competitive_gaps if not isinstance(competitive_gaps, Exception) else [],
                    content_opportunities=content_opportunities if not isinstance(content_opportunities, Exception) else [],
                    response_ids=[r.get('response_id') for r in batch if r.get('response_id')]
                )
                logger.info(f"      ✅ Phase 2 batch insights stored successfully")

            except Exception as e:
                logger.error(f"   ❌ Error processing batch {batch_num} for {category}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                continue

        logger.info(f"🎉 {category} complete: {len(all_insights['recommendations'])} total recommendations")

        return all_insights

    async def _store_per_response_metrics(
        self,
        audit_id: str,
        category: str,
        batch_num: int,
        batch: List[Dict],
        metrics: List[Dict[str, Any]]
    ):
        """
        Store per-response metrics from 4th LLM call into database.

        World-class implementation with:
        - Transaction isolation (each metric stored independently)
        - Comprehensive error handling
        - Detailed success/failure tracking
        - Validation at each step

        Maps metrics array (from LLM) back to response IDs and updates audit_responses table
        with all 25 columns (13 old + 12 new from migration 010).

        Args:
            audit_id: Audit identifier for logging
            category: Buyer journey category for storage
            batch_num: Batch number within category
            batch: List of response dictionaries with 'response_id' field
            metrics: List of metric dictionaries (one per response) from LLM

        Returns:
            None (logs success/failure for each metric)
        """
        if not metrics or len(metrics) == 0:
            logger.warning(f"[{audit_id}] No per-response metrics to store for {category} batch {batch_num}")
            return

        if len(batch) != len(metrics):
            logger.warning(f"[{audit_id}] Batch size mismatch: {len(batch)} responses vs {len(metrics)} metrics")
            # Try to map as many as we can
            map_count = min(len(batch), len(metrics))
        else:
            map_count = len(batch)

        logger.info(f"[{audit_id}] Storing {map_count} per-response metrics for {category} batch {batch_num}...")

        # Store each metric in thread pool (database operation)
        # Each metric is stored in its own transaction for isolation
        loop = asyncio.get_event_loop()

        success_count = 0
        error_count = 0

        for i in range(map_count):
            try:
                response = batch[i]
                metric = metrics[i]
                response_id = response.get('response_id')

                if not response_id:
                    logger.warning(f"[{audit_id}] Response {i} in batch {batch_num} missing response_id, skipping")
                    error_count += 1
                    continue

                # Extract query_text from response dict
                query_text = response.get('query_text', '')

                # Store using thread pool with full context
                await loop.run_in_executor(
                    None,
                    self._store_single_response_metric_sync,
                    audit_id,
                    response_id,
                    metric,
                    category,
                    batch_num,
                    i,  # batch_position
                    query_text
                )

                success_count += 1

            except Exception as e:
                error_count += 1
                logger.error(
                    f"[{audit_id}] Error storing metric for response {response_id} "
                    f"(batch {batch_num} pos {i}): {e}",
                    exc_info=True  # Include full stack trace
                )
                # Log sample of problematic metric data (truncated for safety)
                metric_sample = str(metric)[:500] if metric else 'None'
                logger.error(f"[{audit_id}] Problematic metric sample: {metric_sample}...")
                # Continue to next metric - don't let one failure break all
                continue

        # Log final statistics
        logger.info(f"[{audit_id}] ✅ Stored {success_count}/{map_count} per-response metrics successfully ({error_count} errors)")

    def _store_single_response_metric_sync(
        self,
        audit_id: str,
        response_id: str,
        metric: Dict[str, Any],
        category: str,
        batch_id: int,
        batch_position: int,
        query_text: str
    ):
        """
        Store a single response metric to database (synchronous for thread pool).

        World-class implementation:
        - Parses ALL metric data from LLM's 4th call
        - Updates ALL 25 columns (13 old + 12 new from migration 010)
        - Handles both list and dict formats for competitor_analysis
        - Validates data before storage
        - Uses independent transactions for isolation

        Parses comprehensive metric data from 4th LLM call and updates audit_responses.

        Args:
            audit_id: Audit ID for logging
            response_id: Database ID of response to update
            metric: Complete metric dictionary from LLM
            category: Buyer journey category
            batch_id: Batch number for tracking
            batch_position: Position within batch
            query_text: Query text for reference

        Raises:
            Exception: On database errors (caught by caller for isolation)
        """
        # =====================================================================
        # VALIDATION HELPER FUNCTIONS (Production-Grade Safety)
        # =====================================================================

        def _validate_score(value: Any, field_name: str, min_val: float = 0, max_val: float = 100) -> float:
            """Validate and clamp numeric scores to valid range"""
            try:
                if value is None:
                    return 0.0
                score = float(value)
                if score < min_val or score > max_val:
                    logger.warning(
                        f"[{audit_id}] Score '{field_name}' out of range: {score:.2f} "
                        f"(clamping to {min_val}-{max_val})"
                    )
                    score = max(min_val, min(max_val, score))
                return score
            except (TypeError, ValueError) as e:
                logger.error(
                    f"[{audit_id}] Invalid score type for '{field_name}': {value} "
                    f"({type(value).__name__}), using 0.0"
                )
                return 0.0

        def _ensure_list(value: Any, field_name: str = '') -> list:
            """Ensure value is a list, with type coercion"""
            if value is None:
                return []
            if isinstance(value, list):
                return value
            if isinstance(value, str):
                logger.warning(f"[{audit_id}] Field '{field_name}' is string, converting to list")
                return [value]
            logger.warning(
                f"[{audit_id}] Field '{field_name}' has unexpected type {type(value).__name__}, "
                f"using empty list"
            )
            return []

        def _validate_structure_quality(value: str) -> int:
            """Convert structure quality string to score with validation"""
            MAPPING = {
                'good': 85, 'excellent': 85, 'high': 85,
                'fair': 50, 'average': 50, 'medium': 50,
                'poor': 20, 'bad': 20, 'low': 20
            }
            value_lower = value.lower() if isinstance(value, str) else 'fair'
            if value_lower not in MAPPING:
                logger.warning(
                    f"[{audit_id}] Unexpected structure_quality: '{value}', using 'fair' (50)"
                )
                return 50
            return MAPPING[value_lower]

        # Validate metric structure has required fields
        required_fields = ['brand_analysis', 'geo_factors', 'sov_data']
        missing_fields = [f for f in required_fields if not metric.get(f)]
        if missing_fields:
            logger.error(
                f"[{audit_id}] Metric for response {response_id} missing required fields: "
                f"{missing_fields}. Using defaults."
            )

        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Extract brand analysis metrics (field name matches prompt: 'brand_analysis')
                brand_analysis = metric.get('brand_analysis', {})
                brand_mentioned = brand_analysis.get('mentioned', False)
                mention_count = max(0, int(brand_analysis.get('mention_count', 0)))
                # Validate mention_position is in 0-100 range or None
                mention_position_raw = brand_analysis.get('first_position_percentage')
                if mention_position_raw is not None:
                    mention_position = _validate_score(mention_position_raw, 'first_position_percentage')
                else:
                    mention_position = None
                context_quality = brand_analysis.get('context_quality', 'neutral')

                # Extract sentiment (embedded in brand_analysis, not separate)
                sentiment = brand_analysis.get('sentiment', 'neutral')
                recommendation_strength = brand_analysis.get('recommendation_strength', 'not_recommended')

                # Extract features and value props (field name matches prompt: 'features_and_value_props')
                features_value_props = metric.get('features_and_value_props', {})
                specific_features = _ensure_list(features_value_props.get('features_mentioned', []), 'features_mentioned')
                value_props = _ensure_list(features_value_props.get('value_props_highlighted', []), 'value_props_highlighted')

                # Extract competitor analysis
                # Note: competitor_analysis is a list of competitor objects, not a dict
                competitor_analysis = metric.get('competitor_analysis', [])
                if isinstance(competitor_analysis, list):
                    competitors_mentioned_list = competitor_analysis
                else:
                    # Fallback for old format
                    competitors_mentioned_list = competitor_analysis.get('competitors_mentioned', []) if isinstance(competitor_analysis, dict) else []

                competitors_mentioned = json.dumps([
                    {
                        'name': comp.get('competitor_name', comp.get('name', '')),
                        'sentiment': comp.get('sentiment', 'neutral'),
                        'positioning': comp.get('comparison_context', comp.get('positioning', ''))
                    }
                    for comp in competitors_mentioned_list
                ])

                # Extract GEO factors (field names match prompt - no '_score' suffix) with validation
                geo_factors = metric.get('geo_factors', {})
                citation_quality = _validate_score(geo_factors.get('citation_quality', 0), 'citation_quality')
                content_relevance = _validate_score(geo_factors.get('content_relevance', 0), 'content_relevance')
                authority_signals = _validate_score(geo_factors.get('authority_signals', 0), 'authority_signals')
                position_prominence = _validate_score(geo_factors.get('position_prominence', 0), 'position_prominence')

                # Calculate GEO score (average of factors) with validation
                geo_score = _validate_score(
                    (citation_quality + content_relevance + authority_signals + position_prominence) / 4.0,
                    'geo_score'
                )

                # Extract SOV data (field name matches prompt: 'sov_data') with validation
                sov_data = metric.get('sov_data', {})
                brand_mentions_in_response = _validate_score(
                    sov_data.get('brand_mentions', 0), 'brand_mentions', min_val=0, max_val=1000
                )
                total_brand_mentions = max(1, _validate_score(
                    sov_data.get('total_brand_mentions', 1), 'total_brand_mentions', min_val=1, max_val=1000
                ))

                # Calculate SOV score with clamping (brand_mentions can't exceed total)
                brand_mentions_in_response = min(brand_mentions_in_response, total_brand_mentions)
                sov_score = _validate_score(
                    (brand_mentions_in_response / total_brand_mentions) * 100.0,
                    'sov_score'
                )

                # Extract additional metrics (field names match prompt)
                additional_metrics = metric.get('additional_metrics', {})
                featured_snippet_potential = additional_metrics.get('featured_snippet_potential', 0)
                voice_search_optimized = additional_metrics.get('voice_search_optimized', False)
                content_gaps = additional_metrics.get('content_gaps', [])

                # Extract SEO positioning (field names match prompt) with validation
                seo_positioning = metric.get('seo_positioning', {})
                keyword_density = _validate_score(seo_positioning.get('keyword_density', 0), 'keyword_density')
                readability_score = _validate_score(seo_positioning.get('readability_score', 0), 'readability_score')
                # structure_quality is a string ("good", "fair", "poor") - convert to score with validation
                structure_quality_str = seo_positioning.get('structure_quality', 'fair')
                structure_quality = _validate_structure_quality(structure_quality_str)
                ranking_position = seo_positioning.get('ranking_position')

                # Calculate context completeness score (average of SEO factors) with validation
                context_completeness_score = _validate_score(
                    (keyword_density + readability_score + structure_quality) / 3.0,
                    'context_completeness_score'
                )

                # Calculate first_position_percentage (if brand mentioned, use position data)
                first_position_percentage = None
                if brand_mentioned and mention_position:
                    first_position_percentage = mention_position

                # Update audit_responses table with ALL 25 columns (13 old + 12 new)
                cursor.execute("""
                    UPDATE audit_responses
                    SET
                        -- ============================================
                        -- OLD COLUMNS (13) - Existing since beginning
                        -- ============================================
                        brand_mentioned = %s,
                        mention_position = %s,
                        mention_context = %s,
                        sentiment = %s,
                        recommendation_strength = %s,
                        competitors_mentioned = %s,
                        key_features_mentioned = to_jsonb(%s::text[]),
                        featured_snippet_potential = %s,
                        voice_search_optimized = %s,
                        geo_score = %s,
                        sov_score = %s,
                        context_completeness_score = %s,
                        analysis_metadata = %s,

                        -- ============================================
                        -- NEW COLUMNS (12) - From migration 010
                        -- ============================================
                        buyer_journey_category = %s,
                        mention_count = %s,
                        first_position_percentage = %s,
                        context_quality = %s,
                        features_mentioned = %s,
                        value_props_highlighted = %s,
                        competitors_analysis = %s,
                        additional_metrics = %s,
                        metrics_extracted_at = NOW(),
                        batch_id = %s,
                        batch_position = %s,
                        query_text = %s
                    WHERE id = %s
                """, (
                    # OLD COLUMN VALUES (13)
                    brand_mentioned,
                    mention_position,
                    context_quality,  # mention_context field
                    sentiment,
                    recommendation_strength,
                    competitors_mentioned,
                    specific_features + value_props,  # Combine features and value props
                    featured_snippet_potential > 50,
                    voice_search_optimized,
                    geo_score,
                    sov_score,
                    context_completeness_score,
                    json.dumps({
                        'mention_count': mention_count,
                        'citation_quality': citation_quality,
                        'content_relevance': content_relevance,
                        'authority_signals': authority_signals,
                        'position_prominence': position_prominence,
                        'keyword_density': keyword_density,
                        'readability_score': readability_score,
                        'structure_quality': structure_quality,
                        'ranking_position': ranking_position,
                        'content_gaps': content_gaps
                    }),

                    # NEW COLUMN VALUES (12)
                    category,  # buyer_journey_category
                    mention_count,  # mention_count as separate column
                    first_position_percentage,  # first_position_percentage
                    context_quality,  # context_quality as separate column
                    json.dumps(specific_features),  # features_mentioned as JSONB
                    json.dumps(value_props),  # value_props_highlighted as JSONB
                    json.dumps(competitors_mentioned_list),  # competitors_analysis as JSONB array
                    json.dumps(additional_metrics),  # additional_metrics as JSONB
                    # metrics_extracted_at set to NOW() in SQL
                    batch_id,  # batch_id
                    batch_position,  # batch_position within batch
                    query_text,  # query_text for reference

                    # WHERE clause
                    response_id
                ))

                # Verify the update succeeded
                if cursor.rowcount == 0:
                    raise ValueError(f"No rows updated for response_id {response_id} - may not exist")
                elif cursor.rowcount > 1:
                    raise ValueError(f"Multiple rows updated for response_id {response_id} - data integrity issue")

            conn.commit()

            # Log success with details for debugging
            logger.debug(f"[{audit_id}] Successfully stored metrics for response {response_id} ({category}, batch {batch_id}, pos {batch_position})")

        except Exception as e:
            # Rollback transaction on error
            conn.rollback()
            logger.error(f"[{audit_id}] Error storing metric for response {response_id}: {e}")
            logger.error(f"[{audit_id}] Context: category={category}, batch={batch_id}, position={batch_position}")
            raise
        finally:
            self._put_db_connection_sync(conn)

    async def _store_batch_insights(
        self,
        audit_id: str,
        category: str,
        batch_number: int,
        recommendations: List[Dict],
        competitive_gaps: List[Dict],
        content_opportunities: List[Dict],
        response_ids: List[int]
    ):
        """
        Store Phase 2 raw batch insights to buyer_journey_batch_insights table.

        World-class implementation:
        - Stores all raw insights from each LLM call
        - Creates audit trail for all Phase 2 extractions
        - Enables debugging and re-analysis
        - Each insight type stored independently

        Args:
            audit_id: Audit identifier
            category: Buyer journey category
            batch_number: Batch number within category (1-4)
            recommendations: List of recommendation dicts from LLM
            competitive_gaps: List of competitive gap dicts from LLM
            content_opportunities: List of content opportunity dicts from LLM
            response_ids: List of response IDs in this batch

        Returns:
            None (logs success/failure)
        """
        loop = asyncio.get_event_loop()

        store_tasks = []

        # Store recommendations
        if recommendations and len(recommendations) > 0:
            store_tasks.append((
                'recommendations',
                recommendations,
                loop.run_in_executor(
                    None,
                    self._store_single_batch_insight_sync,
                    audit_id,
                    category,
                    batch_number,
                    'recommendations',
                    recommendations,
                    response_ids
                )
            ))

        # Store competitive gaps
        if competitive_gaps and len(competitive_gaps) > 0:
            store_tasks.append((
                'competitive_gaps',
                competitive_gaps,
                loop.run_in_executor(
                    None,
                    self._store_single_batch_insight_sync,
                    audit_id,
                    category,
                    batch_number,
                    'competitive_gaps',
                    competitive_gaps,
                    response_ids
                )
            ))

        # Store content opportunities
        if content_opportunities and len(content_opportunities) > 0:
            store_tasks.append((
                'content_opportunities',
                content_opportunities,
                loop.run_in_executor(
                    None,
                    self._store_single_batch_insight_sync,
                    audit_id,
                    category,
                    batch_number,
                    'content_opportunities',
                    content_opportunities,
                    response_ids
                )
            ))

        # Execute all storage tasks
        if store_tasks:
            for insight_type, insights, task in store_tasks:
                try:
                    await task
                    logger.info(f"[{audit_id}] Stored {len(insights)} {insight_type} for {category} batch {batch_number}")
                except Exception as e:
                    logger.error(f"[{audit_id}] Error storing {insight_type} for {category} batch {batch_number}: {e}")
                    # Don't raise - continue with other storage operations

    def _store_single_batch_insight_sync(
        self,
        audit_id: str,
        category: str,
        batch_number: int,
        extraction_type: str,
        insights: List[Dict],
        response_ids: List[int]
    ):
        """
        Store single batch insight type to database (synchronous for thread pool).

        World-class implementation:
        - Uses UPSERT pattern (ON CONFLICT DO UPDATE)
        - Validates data before storage
        - Creates complete audit trail

        Args:
            audit_id: Audit identifier
            category: Buyer journey category
            batch_number: Batch number within category
            extraction_type: Type of insight (recommendations, competitive_gaps, content_opportunities)
            insights: List of insight dictionaries from LLM
            response_ids: List of response IDs in this batch

        Raises:
            Exception: On database errors (caught by caller)
        """
        if not insights or len(insights) == 0:
            logger.warning(f"[{audit_id}] No {extraction_type} insights to store for {category} batch {batch_number}")
            return

        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO buyer_journey_batch_insights
                    (audit_id, category, batch_number, extraction_type, insights, response_ids)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (audit_id, category, batch_number, extraction_type)
                    DO UPDATE SET
                        insights = EXCLUDED.insights,
                        response_ids = EXCLUDED.response_ids,
                        created_at = NOW()
                """, (
                    audit_id,
                    category,
                    batch_number,
                    extraction_type,
                    json.dumps(insights),
                    response_ids
                ))

                # Verify insert/update succeeded
                if cursor.rowcount == 0:
                    raise ValueError(f"Failed to insert/update batch insight for {audit_id}/{category}/batch{batch_number}/{extraction_type}")

            conn.commit()
            logger.debug(f"[{audit_id}] Stored {len(insights)} {extraction_type} insights for {category} batch {batch_number}")

        except Exception as e:
            conn.rollback()
            logger.error(f"[{audit_id}] Error storing batch insight: {e}")
            logger.error(f"[{audit_id}] Context: category={category}, batch={batch_number}, type={extraction_type}, count={len(insights)}")
            raise
        finally:
            self._put_db_connection_sync(conn)

    async def _verify_phase2_storage(
        self,
        audit_id: str,
        expected_categories: List[str]
    ) -> Dict[str, Any]:
        """
        Verify Phase 2 storage completed successfully.

        World-class verification:
        - Checks per-response metrics stored
        - Checks raw batch insights stored
        - Reports detailed statistics
        - Identifies missing data

        Args:
            audit_id: Audit identifier
            expected_categories: List of categories that should have been processed

        Returns:
            Dict with verification results and statistics
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._verify_phase2_storage_sync,
            audit_id,
            expected_categories
        )

    def _verify_phase2_storage_sync(
        self,
        audit_id: str,
        expected_categories: List[str]
    ) -> Dict[str, Any]:
        """
        Verify Phase 2 storage (synchronous for thread pool).

        Returns dict with:
        - per_response_metrics: count and statistics
        - batch_insights: count by category and type
        - missing_categories: list of categories with missing data
        - overall_status: 'complete', 'partial', or 'failed'
        """
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Check per-response metrics
                cursor.execute("""
                    SELECT
                        COUNT(*) as total,
                        COUNT(CASE WHEN buyer_journey_category IS NOT NULL THEN 1 END) as with_category,
                        COUNT(CASE WHEN metrics_extracted_at IS NOT NULL THEN 1 END) as with_timestamp,
                        COUNT(CASE WHEN mention_count > 0 THEN 1 END) as with_mention_count,
                        COUNT(DISTINCT buyer_journey_category) as unique_categories
                    FROM audit_responses
                    WHERE audit_id = %s
                """, (audit_id,))
                metrics_stats = dict(cursor.fetchone())

                # Check batch insights by category
                cursor.execute("""
                    SELECT
                        category,
                        extraction_type,
                        COUNT(*) as batch_count,
                        SUM(jsonb_array_length(insights)) as total_insights
                    FROM buyer_journey_batch_insights
                    WHERE audit_id = %s
                    GROUP BY category, extraction_type
                    ORDER BY category, extraction_type
                """, (audit_id,))
                batch_insights = [dict(row) for row in cursor.fetchall()]

                # Check which categories are missing
                cursor.execute("""
                    SELECT DISTINCT category
                    FROM buyer_journey_batch_insights
                    WHERE audit_id = %s
                """, (audit_id,))
                stored_categories = {row['category'] for row in cursor.fetchall()}
                missing_categories = [cat for cat in expected_categories if cat not in stored_categories]

                # Determine overall status
                if metrics_stats['with_timestamp'] == 0 and len(batch_insights) == 0:
                    overall_status = 'failed'
                elif len(missing_categories) > 0 or metrics_stats['with_timestamp'] < metrics_stats['total']:
                    overall_status = 'partial'
                else:
                    overall_status = 'complete'

                return {
                    'per_response_metrics': metrics_stats,
                    'batch_insights': batch_insights,
                    'missing_categories': missing_categories,
                    'overall_status': overall_status,
                    'audit_id': audit_id
                }

        finally:
            self._put_db_connection_sync(conn)

    async def _check_phase2_complete(self, audit_id: str) -> bool:
        """
        Check if Phase 2 is already complete in the database.

        This is CRITICAL for cost optimization - we don't want to re-run
        96 LLM API calls if Phase 2 data already exists.

        World-class implementation:
        - Checks batch insights table for complete data
        - Checks per-response metrics are populated
        - Returns True only if Phase 2 is fully complete

        Args:
            audit_id: Audit identifier

        Returns:
            True if Phase 2 is complete, False otherwise
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._check_phase2_complete_sync,
            audit_id
        )

    def _check_phase2_complete_sync(self, audit_id: str) -> bool:
        """
        Check Phase 2 completion (synchronous for thread pool).

        Phase 2 is considered complete if:
        1. We have batch insights for multiple categories (60+ insight rows)
        2. All responses have buyer_journey_category populated
        3. All responses have metrics_extracted_at timestamp
        """
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Check batch insights count
                cursor.execute("""
                    SELECT COUNT(*) as insight_count
                    FROM buyer_journey_batch_insights
                    WHERE audit_id = %s
                """, (audit_id,))
                insight_count = cursor.fetchone()['insight_count']

                # Check per-response metrics
                cursor.execute("""
                    SELECT
                        COUNT(*) as total,
                        COUNT(CASE WHEN buyer_journey_category IS NOT NULL THEN 1 END) as with_category,
                        COUNT(CASE WHEN metrics_extracted_at IS NOT NULL THEN 1 END) as with_timestamp
                    FROM audit_responses
                    WHERE audit_id = %s
                """, (audit_id,))
                metrics = cursor.fetchone()

                # Phase 2 is complete if:
                # - We have 60+ batch insights (5 phases × ~4 batches × 3 types ≈ 60-84, varies by batch size)
                # - 95%+ of responses have category (allow up to 5% missing for error tolerance)
                # - 95%+ of responses have timestamp
                completion_rate_category = metrics['with_category'] / metrics['total'] if metrics['total'] > 0 else 0
                completion_rate_timestamp = metrics['with_timestamp'] / metrics['total'] if metrics['total'] > 0 else 0

                is_complete = (
                    insight_count >= 60 and
                    metrics['total'] > 0 and
                    completion_rate_category >= 0.95 and
                    completion_rate_timestamp >= 0.95
                )

                if is_complete:
                    logger.info(f"✅ Phase 2 already complete for {audit_id}: {insight_count} insights, {metrics['total']} responses categorized")
                else:
                    logger.debug(f"Phase 2 not complete for {audit_id}: insights={insight_count}, responses={metrics['total']}, categorized={metrics['with_category']}, timestamped={metrics['with_timestamp']}")

                return is_complete

        finally:
            self._put_db_connection_sync(conn)

    async def _load_phase2_from_database(self, audit_id: str) -> Dict[str, Dict[str, List[Dict]]]:
        """
        Load existing Phase 2 data from database.

        This enables resuming from Layers 1-3 without re-running Phase 2.

        World-class implementation:
        - Loads all batch insights from database
        - Reconstructs the category_insights structure
        - Returns data in same format as _extract_batched_insights_by_category

        Args:
            audit_id: Audit identifier

        Returns:
            Dict[category -> Dict[insight_type -> List[insights]]]
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._load_phase2_from_database_sync,
            audit_id
        )

    def _load_phase2_from_database_sync(self, audit_id: str) -> Dict[str, Dict[str, List[Dict]]]:
        """
        Load Phase 2 data from database (synchronous for thread pool).

        Queries buyer_journey_batch_insights table and reconstructs
        the category_insights structure expected by Layers 1-3.
        """
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        category,
                        extraction_type,
                        insights
                    FROM buyer_journey_batch_insights
                    WHERE audit_id = %s
                    ORDER BY category, batch_number, extraction_type
                """, (audit_id,))

                rows = cursor.fetchall()

                # Reconstruct category_insights structure
                # Expected format: {category: [batch1_dict, batch2_dict, batch3_dict, batch4_dict]}
                # Where each batch_dict = {'recommendations': [...], 'competitive_gaps': [...], 'content_opportunities': [...]}

                # Group by category and batch_number
                category_batches = {}
                for row in rows:
                    category = row['category']
                    extraction_type = row['extraction_type']
                    insights = row['insights']

                    # Parse JSON if it's a string
                    if isinstance(insights, str):
                        insights = json.loads(insights)

                    # Initialize category if needed
                    if category not in category_batches:
                        category_batches[category] = {}

                    # Get or create batch dict for this extraction_type
                    if extraction_type not in category_batches[category]:
                        category_batches[category][extraction_type] = insights
                    else:
                        # Extend if multiple rows for same type (shouldn't happen but just in case)
                        if isinstance(category_batches[category][extraction_type], list):
                            category_batches[category][extraction_type].extend(insights)
                        else:
                            category_batches[category][extraction_type] = insights

                # Convert to expected format: list of single batch dict per category
                # (Strategic aggregator expects List[Dict], we give it one mega-dict with all insights)
                category_insights = {}
                for category, insights_dict in category_batches.items():
                    # Wrap in a list - strategic_aggregator will iterate over it
                    category_insights[category] = [insights_dict]

                logger.info(f"📥 Loaded Phase 2 data from database: {len(category_insights)} categories, {len(rows)} insight batches")

                return category_insights

        finally:
            self._put_db_connection_sync(conn)

    async def _store_strategic_intelligence(
        self,
        audit_id: str,
        category_aggregated: Dict[str, Dict[str, List[Dict]]],
        strategic_priorities: Dict[str, List[Dict]],
        executive_summary: Dict[str, Any],
        company_context: CompanyContext,
        persona_context: PersonaContext
    ):
        """Store Layer 1-3 strategic intelligence outputs to database"""
        loop = asyncio.get_event_loop()

        # Store Layer 1: Category aggregated insights
        for category, insights_by_type in category_aggregated.items():
            for extraction_type, insights in insights_by_type.items():
                if len(insights) > 0:
                    await loop.run_in_executor(
                        None,
                        self._store_category_insights_sync,
                        audit_id,
                        category,
                        extraction_type,
                        insights,
                        company_context,
                        persona_context
                    )

        # Store Layer 2: Strategic priorities
        for extraction_type, priorities in strategic_priorities.items():
            for rank, priority in enumerate(priorities, 1):
                await loop.run_in_executor(
                    None,
                    self._store_strategic_priority_sync,
                    audit_id,
                    extraction_type,
                    rank,
                    priority
                )

        # Store Layer 3: Executive summary
        await loop.run_in_executor(
            None,
            self._store_executive_summary_sync,
            audit_id,
            company_context.company_id,
            persona_context.primary_persona,
            executive_summary
        )

    def _store_category_insights_sync(
        self,
        audit_id: str,
        category: str,
        extraction_type: str,
        insights: List[Dict],
        company_context: CompanyContext,
        persona_context: PersonaContext
    ):
        """Store Layer 1 category insights (synchronous for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # Map phase to funnel stage (5-phase framework)
                funnel_stage_map = {
                    'discovery': 'awareness',        # 6 queries, 14%
                    'research': 'awareness',         # 8 queries, 19%
                    'evaluation': 'consideration',   # 10 queries, 24%
                    'comparison': 'consideration',   # 12 queries, 29% - CRITICAL
                    'purchase': 'decision'           # 6 queries, 14%
                }
                funnel_stage = funnel_stage_map.get(category, 'consideration')

                cursor.execute("""
                    INSERT INTO category_aggregated_insights
                    (audit_id, category, funnel_stage, extraction_type, insights,
                     source_batch_ids, company_context, persona_context)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (audit_id, category, extraction_type) DO UPDATE SET
                        insights = EXCLUDED.insights,
                        source_batch_ids = EXCLUDED.source_batch_ids,
                        company_context = EXCLUDED.company_context,
                        persona_context = EXCLUDED.persona_context
                """, (
                    audit_id,
                    category,
                    funnel_stage,
                    extraction_type,
                    json.dumps(insights),
                    [],  # source_batch_ids will be populated later
                    json.dumps({
                        'company_name': company_context.company_name,
                        'company_size': company_context.company_size,
                        'industry': company_context.industry
                    }),
                    json.dumps({
                        'primary_persona': persona_context.primary_persona,
                        'decision_level': persona_context.decision_level
                    })
                ))
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

    def _store_strategic_priority_sync(
        self,
        audit_id: str,
        extraction_type: str,
        rank: int,
        priority: Dict[str, Any]
    ):
        """Store Layer 2 strategic priority (synchronous for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO strategic_priorities
                    (audit_id, extraction_type, rank, priority_data,
                     source_categories, funnel_stages_impacted)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (audit_id, extraction_type, rank) DO UPDATE SET
                        priority_data = EXCLUDED.priority_data,
                        source_categories = EXCLUDED.source_categories,
                        funnel_stages_impacted = EXCLUDED.funnel_stages_impacted
                """, (
                    audit_id,
                    extraction_type,
                    rank,
                    json.dumps(priority),
                    priority.get('source_categories', []),
                    priority.get('funnel_stages_impacted', [])
                ))
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

    def _store_executive_summary_sync(
        self,
        audit_id: str,
        company_id: int,
        persona: str,
        summary: Dict[str, Any]
    ):
        """Store Layer 3 executive summary (synchronous for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO executive_summaries
                    (audit_id, company_id, persona, summary_data)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (audit_id) DO UPDATE SET
                        summary_data = EXCLUDED.summary_data
                """, (
                    audit_id,
                    company_id,
                    persona,
                    json.dumps(summary)
                ))
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

    def _update_audit_status_sync(self, audit_id: str, status: str, error_message: Optional[str] = None):
        """Update audit status in database (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # FIX: Update both status AND current_phase in all branches to prevent infinite loop
                if status == 'processing':
                    cursor.execute("""
                        UPDATE ai_visibility_audits
                        SET
                            status = %s,
                            current_phase = 'processing',
                            started_at = NOW(),
                            last_heartbeat = NOW()
                        WHERE id = %s
                        RETURNING id, status, current_phase
                    """, (status, audit_id))
                elif status == 'completed':
                    cursor.execute("""
                        UPDATE ai_visibility_audits
                        SET
                            status = %s,
                            current_phase = 'completed',
                            completed_at = NOW(),
                            last_heartbeat = NOW()
                        WHERE id = %s
                        RETURNING id, status, current_phase
                    """, (status, audit_id))
                elif status == 'failed':
                    cursor.execute("""
                        UPDATE ai_visibility_audits
                        SET
                            status = %s,
                            current_phase = 'failed',
                            error_message = %s,
                            last_heartbeat = NOW()
                        WHERE id = %s
                        RETURNING id, status, current_phase
                    """, (status, error_message, audit_id))
                else:
                    # Generic status update - mirror status to phase
                    cursor.execute("""
                        UPDATE ai_visibility_audits
                        SET
                            status = %s,
                            current_phase = %s,
                            last_heartbeat = NOW()
                        WHERE id = %s
                        RETURNING id, status, current_phase
                    """, (status, status, audit_id))

                # Verify update succeeded
                result = cursor.fetchone()
                if not result:
                    logger.error(f"❌ Failed to update audit {audit_id} status to {status} - audit not found")
                    raise RuntimeError(f"Failed to update audit {audit_id} status to {status}")

                logger.info(f"✅ Audit {audit_id} status updated: status={result['status']}, phase={result['current_phase']}")

            conn.commit()
        except Exception as e:
            logger.error(f"❌ Error updating audit {audit_id} status: {str(e)}")
            conn.rollback()
            raise
        finally:
            self._put_db_connection_sync(conn)

    def _update_heartbeat_sync(self, audit_id: str):
        """Update heartbeat timestamp (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE ai_visibility_audits SET last_heartbeat = NOW() WHERE id = %s",
                    (audit_id,)
                )
            conn.commit()
        finally:
            self._put_db_connection_sync(conn)

    async def _update_audit_status(
        self,
        audit_id: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """Async wrapper that runs sync database operations in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._update_audit_status_sync, audit_id, status, error_message)

    async def _update_heartbeat(self, audit_id: str):
        """Async wrapper to update heartbeat timestamp"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._update_heartbeat_sync, audit_id)
    
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
    

    def _finalize_audit_sync(self, audit_id: str, overall_score: float, visibility: float):
        """Finalize audit status (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # FIX: Update both status AND current_phase to prevent infinite loop
                cursor.execute("""
                    UPDATE ai_visibility_audits
                    SET
                        status = 'completed',
                        current_phase = 'completed',
                        completed_at = NOW(),
                        overall_score = %s,
                        brand_mention_rate = %s,
                        last_heartbeat = NOW()
                    WHERE id = %s
                    RETURNING id, status, current_phase, completed_at
                """, (overall_score, visibility, audit_id))

                # Verify update succeeded
                result = cursor.fetchone()
                if not result:
                    logger.error(f"❌ Failed to finalize audit {audit_id} - audit not found in database")
                    raise RuntimeError(f"Failed to finalize audit {audit_id} - audit not found")

                logger.info(f"✅ Audit {audit_id} finalized successfully: status={result['status']}, phase={result['current_phase']}")

                try:
                    cursor.execute("SELECT refresh_audit_materialized_views()")
                except:
                    pass
            conn.commit()
        except Exception as e:
            logger.error(f"❌ Error finalizing audit {audit_id}: {str(e)}")
            conn.rollback()
            raise
        finally:
            self._put_db_connection_sync(conn)

    def _get_audit_user_company_sync(self, audit_id: str) -> Optional[tuple]:
        """Get company and user IDs for audit (synchronous version for thread pool)"""
        conn = self._get_db_connection_sync()
        try:
            with conn.cursor() as cursor:
                # First get company_id from audit
                cursor.execute("""
                    SELECT company_id
                    FROM ai_visibility_audits
                    WHERE id = %s
                """, (audit_id,))
                result = cursor.fetchone()
                if not result:
                    return None

                company_id = result['company_id']

                # Then get user_id from users table
                cursor.execute("""
                    SELECT id
                    FROM users
                    WHERE company_id = %s
                    LIMIT 1
                """, (company_id,))
                user_result = cursor.fetchone()
                user_id = user_result['id'] if user_result else None

                return (company_id, user_id)
        finally:
            self._put_db_connection_sync(conn)

    async def _finalize_audit(
        self,
        audit_id: str,
        scores: Dict[str, float]
    ):
        """Finalize audit with scores and migrate data to final tables"""
        print(f"DEBUG: _finalize_audit ENTRY - audit_id: {audit_id}")
        print(f"DEBUG: Scores to finalize: {scores}")
        logger.info(f"Finalizing audit {audit_id} with overall score: {scores['overall_score']:.2f}")

        # Update audit status using thread pool
        print(f"DEBUG: Updating audit status to 'completed' in database...")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._finalize_audit_sync,
            audit_id,
            scores['overall_score'],
            scores['visibility']
        )
        print(f"DEBUG: Audit status updated to 'completed'")

        # Populate dashboard data directly from audit_responses (no migration needed)
        try:
            print(f"DEBUG: Starting dashboard data population...")
            from .dashboard_data_populator import DashboardDataPopulator

            # Get company_id and user_id for this audit using thread pool
            print(f"DEBUG: Fetching company_id and user_id for audit...")
            result = await loop.run_in_executor(None, self._get_audit_user_company_sync, audit_id)
            if result:
                company_id, user_id = result
                print(f"DEBUG: Found company_id: {company_id}, user_id: {user_id}")

                # Populate dashboard data
                print(f"DEBUG: Initializing DashboardDataPopulator...")
                # Use settings.openai_api_key from global config (loaded from .env) instead of os.environ
                # This ensures we get the API key even if it's not in the process environment
                from src.config import settings as global_settings
                api_key = self.config.openai_api_key or global_settings.openai_api_key or os.environ.get('OPENAI_API_KEY')
                print(f"DEBUG: API key source - config: {bool(self.config.openai_api_key)}, settings: {bool(global_settings.openai_api_key)}, env: {bool(os.environ.get('OPENAI_API_KEY'))}")
                print(f"DEBUG: Final API key length: {len(api_key) if api_key else 0}")

                populator = DashboardDataPopulator(
                    db_config={
                        'host': self.config.db_host,
                        'port': self.config.db_port,
                        'database': self.config.db_name,
                        'user': self.config.db_user,
                        'password': self.config.db_password
                    },
                    openai_api_key=api_key
                )
                print(f"DEBUG: DashboardDataPopulator initialized")

                print(f"DEBUG: Calling populate_dashboard_data...")
                success = await populator.populate_dashboard_data(
                    audit_id=audit_id,
                    company_id=company_id,
                    user_id=user_id
                )

                print(f"DEBUG: Dashboard data population succeeded")
                logger.info(f"Dashboard data populated successfully for audit {audit_id}")

                # Send WebSocket notification that dashboard data is ready
                print(f"DEBUG: Sending WebSocket notification for dashboard data ready...")
                await self.ws_manager.broadcast_to_audit(
                    audit_id,
                    EventType.DASHBOARD_DATA_READY,
                    {'audit_id': audit_id, 'status': 'ready'}
                )
                print(f"DEBUG: WebSocket notification sent")
            else:
                print(f"DEBUG: Could not find company_id/user_id for audit {audit_id}")

        except Exception as e:
            # Log full exception details with context
            import traceback
            error_details = {
                'audit_id': audit_id,
                'company_id': company_id,
                'user_id': user_id,
                'error_type': type(e).__name__,
                'error_message': str(e),
                'traceback': traceback.format_exc()
            }

            print(f"DEBUG: Error during dashboard population: {e}")
            print(f"DEBUG: Error type: {type(e).__name__}")
            print(f"DEBUG: Full traceback:\n{traceback.format_exc()}")

            logger.error(
                f"Dashboard data population failed for audit {audit_id} "
                f"(company_id={company_id}, user_id={user_id}). "
                f"Error: {type(e).__name__}: {str(e)}"
            )
            logger.error(f"Full traceback:\n{traceback.format_exc()}")

            # Don't fail the audit - dashboard data is optional enhancement
            # But ensure error is visible for debugging

        print(f"DEBUG: _finalize_audit completed for audit {audit_id}")
    
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

        # Track time since last stuck audit check
        last_stuck_check = time.time()
        stuck_check_interval = 30  # Check every 30 seconds

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

            # Periodically check for stuck audits
            current_time = time.time()
            if current_time - last_stuck_check >= stuck_check_interval:
                last_stuck_check = current_time

                try:
                    # Check for stuck audits in database
                    loop = asyncio.get_event_loop()
                    stuck_audits = await loop.run_in_executor(
                        None,
                        processor._check_stuck_audits_sync
                    )

                    if stuck_audits:
                        logger.info(f"Found {len(stuck_audits)} stuck audits, resuming...")

                        for audit_data in stuck_audits:
                            audit_id = audit_data['id']
                            company_id = audit_data['company_id']
                            user_id = audit_data.get('user_id', 0)

                            logger.info(f"Resuming stuck audit {audit_id} (company: {company_id})")

                            # Resume processing with skip_phase_2=True to skip query generation/execution
                            asyncio.create_task(
                                processor.process_audit_job({
                                    'audit_id': audit_id,
                                    'company_id': company_id,
                                    'user_id': user_id,
                                    'skip_phase_2': True,  # Skip query generation and execution
                                    'force_reanalyze': True  # Force reanalysis of existing responses
                                })
                            )

                except Exception as e:
                    logger.error(f"Error checking for stuck audits: {e}")
                    logger.error(traceback.format_exc())

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