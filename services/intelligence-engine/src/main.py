"""FastAPI application for Intelligence Engine."""

import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from src.config import settings
from src.consumer import StreamConsumer
from src.storage import PostgresClient, RedisClient, CacheManager
from src.monitoring import HealthChecker
from src.monitoring.middleware import setup_metrics_middleware
from src.processors import ResponseProcessor
from src.models.schemas import AIResponse, ProcessedResponse
from src.api import analysis_routes
from src.core.services.job_processor import AuditJobProcessor, ProcessorConfig


# Global instances
consumer: StreamConsumer = None
postgres: PostgresClient = None
redis: RedisClient = None
cache: CacheManager = None
health_checker: HealthChecker = None
processor: ResponseProcessor = None
job_processor: AuditJobProcessor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global consumer, postgres, redis, cache, health_checker, processor, job_processor

    # Declare task variables
    consumer_task = None
    job_consumer_task = None
    stuck_audit_monitor_task = None
    
    # Startup
    print("Starting Intelligence Engine...")
    
    # Initialize storage
    postgres = PostgresClient()
    redis = RedisClient()
    cache = CacheManager()
    
    await postgres.initialize()
    await redis.initialize()
    await cache.initialize()
    
    # Initialize processor
    processor = ResponseProcessor()
    
    # Initialize health checker
    health_checker = HealthChecker(postgres, redis)
    
    # Initialize and start consumer in background
    consumer = StreamConsumer()
    await consumer.initialize()
    
    # Start consumer in background task
    consumer_task = asyncio.create_task(consumer.start())

    # Initialize and start job processor for AI visibility audits
    print("Initializing AI Visibility Job Processor...")
    try:
        # Create ProcessorConfig from settings
        processor_config = ProcessorConfig(
            db_host=settings.postgres_host,
            db_port=settings.postgres_port,
            db_name=settings.postgres_db,
            db_user=settings.postgres_user,
            db_password=settings.postgres_password,
            redis_host=settings.redis_host,
            redis_port=settings.redis_port,
            openai_api_key=settings.openai_api_key,
            anthropic_api_key=settings.anthropic_api_key,
            google_ai_api_key=settings.google_ai_api_key,
            perplexity_api_key=settings.perplexity_api_key
        )
        job_processor = AuditJobProcessor(processor_config)
        await job_processor.initialize()
        
        # Start job consumer loop in background
        async def run_job_consumer():
            """Run the job consumer loop."""
            import redis.asyncio as redis
            import json
            from datetime import datetime

            print("DEBUG: run_job_consumer starting...")
            redis_client = redis.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
                password=settings.redis_password,
                decode_responses=True
            )
            print(f"DEBUG: Redis client created, listening on bull:ai-visibility-audit:wait")

            while True:
                try:
                    # Fetch job from queue (Bull stores complete job objects as JSON)
                    print(f"DEBUG: Waiting for job from queue...")
                    job_data = await redis_client.blpop('bull:ai-visibility-audit:wait', timeout=5)
                    print(f"DEBUG: blpop returned: {job_data}")

                    if job_data:
                        job_id = job_data[1]  # Extract job ID from blpop result (Bull stores just the ID)
                        print(f"DEBUG: Got job ID from queue: {job_id}")

                        try:
                            # Fetch complete job object from Bull hash using the job ID
                            job_hash_key = f"bull:ai-visibility-audit:{job_id}"
                            job_hash_data = await redis_client.hgetall(job_hash_key)

                            if not job_hash_data or 'data' not in job_hash_data:
                                print(f"ERROR: No data found in job hash {job_hash_key}")
                                print(f"DEBUG: Job may have been removed by Bull, or wrong format was pushed to queue")
                                continue

                            # Parse job payload from hash
                            job_payload = json.loads(job_hash_data['data'])
                            audit_id = job_payload.get('audit_id')
                            source = job_payload.get('source', 'unknown')

                            print(f"[JOB-START] Processing job {job_id} for audit {audit_id} (source: {source})")
                            print(f"[JOB-START] Job payload: skip_phase_2={job_payload.get('skip_phase_2')}, force_reanalyze={job_payload.get('force_reanalyze')}")

                            # Process job with comprehensive error handling
                            try:
                                await job_processor.process_audit_job(job_payload)
                                print(f"[JOB-SUCCESS] Completed audit job {job_id} for audit {audit_id}")

                            except Exception as e:
                                error_msg = str(e)
                                print(f"[JOB-FAILED] Failed to process job {job_id} for audit {audit_id}: {error_msg}")
                                import traceback
                                print(f"[JOB-FAILED] Traceback: {traceback.format_exc()}")

                                # Ensure audit status is updated to failed in database
                                # job_processor._handle_job_failure already called inside process_audit_job
                                # but we log it here for visibility

                        except json.JSONDecodeError as e:
                            print(f"ERROR: Failed to parse job JSON for {job_id}: {e}")
                            print(f"Raw data from hash 'data' field may be corrupted")

                    await asyncio.sleep(0.1)  # Small delay to prevent tight loop

                except Exception as e:
                    print(f"Error in job consumer loop: {e}")
                    import traceback
                    print(f"Traceback: {traceback.format_exc()}")
                    await asyncio.sleep(5)  # Wait before retrying
        
        job_consumer_task = asyncio.create_task(run_job_consumer())
        print("AI Visibility Job Processor started")

        # Start stuck audit monitor in background
        async def monitor_stuck_audits():
            """Monitor and automatically resume stuck audits."""
            import psycopg2
            import psycopg2.extras
            import redis.asyncio as redis
            import json
            from datetime import datetime

            print("DEBUG: Stuck audit monitor starting...")
            redis_client = redis.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
                password=settings.redis_password,
                decode_responses=True
            )

            while True:
                try:
                    # Connect to PostgreSQL using psycopg2
                    conn = psycopg2.connect(
                        host=settings.postgres_host,
                        port=settings.postgres_port,
                        dbname=settings.postgres_db,
                        user=settings.postgres_user,
                        password=settings.postgres_password
                    )
                    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

                    # Query for stuck audits with CORRECTED column names
                    # Checks for heartbeat to avoid resuming actively processing audits
                    # CRITICAL: Don't retrigger audits that are already completed
                    query = """
                        SELECT
                            a.id as audit_id,
                            a.company_id,
                            a.company_name,
                            a.status,
                            a.current_phase,
                            a.started_at,
                            a.last_heartbeat,
                            (SELECT COUNT(*) FROM audit_queries WHERE audit_id = a.id) as queries_generated,
                            (SELECT COUNT(*) FROM audit_responses WHERE audit_id = a.id) as responses_collected
                        FROM ai_visibility_audits a
                        WHERE a.status = 'processing'
                          AND a.current_phase = 'pending'
                          AND a.started_at < NOW() - INTERVAL '10 minutes'
                          AND (a.last_heartbeat IS NULL OR a.last_heartbeat < NOW() - INTERVAL '10 minutes')
                          AND (SELECT COUNT(*) FROM audit_responses WHERE audit_id = a.id) > 0
                          AND a.completed_at IS NULL
                          AND NOT EXISTS (SELECT 1 FROM dashboard_data WHERE audit_id = a.id)
                        ORDER BY a.started_at ASC
                    """

                    cur.execute(query)
                    stuck_audits = cur.fetchall()
                    cur.close()
                    conn.close()

                    if stuck_audits:
                        print(f"[STUCK-AUDIT-MONITOR] Found {len(stuck_audits)} stuck audits")

                        for audit in stuck_audits:
                            audit_id = audit['audit_id']
                            company_id = audit['company_id']
                            company_name = audit['company_name']
                            queries_generated = audit['queries_generated']
                            responses_collected = audit['responses_collected']

                            # ===================================================================
                            # SAFEGUARD 1: Check if audit already has dashboard data (completed)
                            # ===================================================================
                            try:
                                conn_check = psycopg2.connect(
                                    host=settings.postgres_host,
                                    port=settings.postgres_port,
                                    dbname=settings.postgres_db,
                                    user=settings.postgres_user,
                                    password=settings.postgres_password
                                )
                                cur_check = conn_check.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

                                # Check if dashboard data exists
                                cur_check.execute("SELECT COUNT(*) as count FROM dashboard_data WHERE audit_id = %s", (audit_id,))
                                dashboard_result = cur_check.fetchone()
                                dashboard_exists = dashboard_result['count'] > 0

                                if dashboard_exists:
                                    # Dashboard exists but status incorrect - auto-fix and skip
                                    print(f"[STUCK-MONITOR] ⚠️ Audit {audit_id} ({company_name}) has dashboard data but incorrect status - AUTO-FIXING")
                                    cur_check.execute("""
                                        UPDATE ai_visibility_audits
                                        SET
                                            status = 'completed',
                                            current_phase = 'completed',
                                            completed_at = COALESCE(completed_at, NOW())
                                        WHERE id = %s
                                        RETURNING id, status, current_phase
                                    """, (audit_id,))
                                    fixed = cur_check.fetchone()
                                    conn_check.commit()
                                    print(f"[STUCK-MONITOR] ✅ Auto-fixed audit {audit_id}: status={fixed['status']}, phase={fixed['current_phase']}")

                                    cur_check.close()
                                    conn_check.close()
                                    continue  # Skip reprocessing - audit is actually complete

                                # ===================================================================
                                # SAFEGUARD 2: Check reprocess count and enforce max limit
                                # ===================================================================
                                cur_check.execute("""
                                    SELECT phase_details->>'reprocess_count' as reprocess_count
                                    FROM ai_visibility_audits
                                    WHERE id = %s
                                """, (audit_id,))
                                meta_result = cur_check.fetchone()
                                reprocess_count = int(meta_result['reprocess_count'] or '0') if meta_result and meta_result['reprocess_count'] else 0

                                if reprocess_count >= 3:
                                    # Max reprocess limit exceeded - mark as failed
                                    print(f"[STUCK-MONITOR] ❌ Audit {audit_id} ({company_name}) exceeded max reprocess limit (3) - MARKING AS FAILED")
                                    cur_check.execute("""
                                        UPDATE ai_visibility_audits
                                        SET
                                            status = 'failed',
                                            current_phase = 'failed',
                                            error_message = 'Exceeded maximum reprocess attempts (3) - possible infinite loop or data corruption'
                                        WHERE id = %s
                                    """, (audit_id,))
                                    conn_check.commit()

                                    cur_check.close()
                                    conn_check.close()
                                    continue  # Skip reprocessing - audit has failed

                                # Increment reprocess counter
                                print(f"[STUCK-MONITOR] 📊 Audit {audit_id} reprocess attempt #{reprocess_count + 1}/3")
                                cur_check.execute("""
                                    UPDATE ai_visibility_audits
                                    SET phase_details = jsonb_set(
                                        jsonb_set(
                                            COALESCE(phase_details, '{}'::jsonb),
                                            '{reprocess_count}',
                                            %s::text::jsonb
                                        ),
                                        '{last_reprocess_at}',
                                        %s::text::jsonb
                                    )
                                    WHERE id = %s
                                """, (str(reprocess_count + 1), datetime.now().isoformat(), audit_id))
                                conn_check.commit()

                                cur_check.close()
                                conn_check.close()

                            except Exception as safeguard_error:
                                print(f"[STUCK-MONITOR] ⚠️ Error in safeguards for audit {audit_id}: {safeguard_error}")
                                # Continue with reprocessing attempt (fail-safe)

                            # ===================================================================
                            # Original reprocessing logic (only reached if safeguards pass)
                            # ===================================================================
                            print(f"[STUCK-AUDIT-MONITOR] Resuming audit {audit_id} ({company_name})")
                            print(f"  - Company ID: {company_id}")
                            print(f"  - Queries: {queries_generated}, Responses: {responses_collected}")

                            # Create job to resume audit
                            job_id = f"stuck-audit-{audit_id}-{int(datetime.now().timestamp())}"
                            job_payload = {
                                "audit_id": audit_id,
                                "company_id": company_id,
                                "skip_phase_2": True,  # Skip query execution, go straight to analysis
                                "force_reanalyze": True,
                                "source": "stuck_audit_monitor"
                            }

                            # Store job in Bull format
                            job_hash_key = f"bull:ai-visibility-audit:{job_id}"
                            await redis_client.hset(job_hash_key, "data", json.dumps(job_payload))

                            # Push job ID to queue
                            await redis_client.rpush("bull:ai-visibility-audit:wait", job_id)

                            print(f"[STUCK-AUDIT-MONITOR] Created resume job {job_id}")

                    await asyncio.sleep(30)  # Check every 30 seconds

                except Exception as e:
                    print(f"[STUCK-AUDIT-MONITOR] Error: {e}")
                    import traceback
                    print(f"[STUCK-AUDIT-MONITOR] Traceback: {traceback.format_exc()}")
                    await asyncio.sleep(30)  # Wait before retrying

        stuck_audit_monitor_task = asyncio.create_task(monitor_stuck_audits())
        print("Stuck Audit Monitor started")

    except Exception as e:
        print(f"Failed to start job processor: {e}")
        job_consumer_task = None
        stuck_audit_monitor_task = None
    
    print("Intelligence Engine started successfully")
    
    yield
    
    # Shutdown
    print("Shutting down Intelligence Engine...")
    
    # Stop consumer
    if consumer:
        await consumer.shutdown()
    
    # Cancel consumer task
    if consumer_task and not consumer_task.done():
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
    
    # Cancel job consumer task
    if job_consumer_task and not job_consumer_task.done():
        job_consumer_task.cancel()
        try:
            await job_consumer_task
        except asyncio.CancelledError:
            pass

    # Cancel stuck audit monitor task
    if stuck_audit_monitor_task and not stuck_audit_monitor_task.done():
        stuck_audit_monitor_task.cancel()
        try:
            await stuck_audit_monitor_task
        except asyncio.CancelledError:
            pass
    
    # Cleanup job processor
    if job_processor:
        await job_processor.cleanup()
    
    # Close connections
    if postgres:
        await postgres.close()
    if redis:
        await redis.close()
    if cache:
        await cache.close()
    
    print("Intelligence Engine shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Intelligence Engine",
    description="AI Response Intelligence Processing Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
# Parse CORS origins from environment (comma-separated)
cors_origins_str = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3003')
cors_origins = [origin.strip() for origin in cors_origins_str.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Prometheus metrics middleware
setup_metrics_middleware(app)

# Mount Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include analysis routes
app.include_router(analysis_routes.router)

# Include AI visibility routes - use REAL AI generation
from src.api import ai_visibility_real
app.include_router(ai_visibility_real.router)

# Include GEO routes
from src.api import geo_routes
app.include_router(geo_routes.router)

# Include LLM health routes
try:
    from src.api import llm_health_routes
    app.include_router(llm_health_routes.router)
except ImportError:
    print("LLM health routes not available")

# Include Dashboard routes
try:
    from src.api import dashboard_endpoints
    app.include_router(dashboard_endpoints.router)
    print("Dashboard endpoints loaded successfully")
except ImportError as e:
    print(f"Dashboard endpoints not available: {e}")

# Include Config/Feature Flags routes
try:
    from src.api import config_routes
    app.include_router(config_routes.router, prefix="/api/config", tags=["config"])
    print("Config/Feature Flags endpoints loaded successfully")
except ImportError as e:
    print(f"Config endpoints not available: {e}")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Intelligence Engine",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    if not health_checker:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    health_status = await health_checker.check_health()
    
    status_code = 200
    if health_status["status"] == "unhealthy":
        status_code = 503
    elif health_status["status"] == "degraded":
        status_code = 200  # Still return 200 for degraded
    
    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/ready")
async def readiness():
    """Readiness check endpoint."""
    if not health_checker:
        return JSONResponse(
            content={"ready": False, "reason": "Service not initialized"},
            status_code=503
        )
    
    readiness_status = await health_checker.check_readiness()
    
    status_code = 200 if readiness_status["ready"] else 503
    return JSONResponse(content=readiness_status, status_code=status_code)


@app.get("/live")
async def liveness():
    """Liveness check endpoint."""
    if not health_checker:
        return {"alive": True}
    
    return await health_checker.check_liveness()


@app.get("/stats")
async def get_stats():
    """Get processing statistics."""
    if not consumer:
        raise HTTPException(status_code=503, detail="Consumer not initialized")
    
    consumer_stats = consumer.get_stats()
    processor_stats = processor.get_processing_stats() if processor else {}
    
    # Get database stats
    db_stats = {}
    if postgres:
        db_stats = await postgres.get_processing_stats()
    
    # Get cache stats
    cache_stats = {}
    if cache:
        cache_stats = await cache.get_stats()
    
    # Get stream info
    stream_stats = {}
    if redis:
        try:
            input_info = await redis.get_stream_info(settings.redis_stream_input)
            output_info = await redis.get_stream_info(settings.redis_stream_output)
            stream_stats = {
                "input_stream": {
                    "length": input_info.get("length", 0),
                    "groups": input_info.get("groups", 0)
                },
                "output_stream": {
                    "length": output_info.get("length", 0)
                }
            }
        except Exception:
            pass
    
    return {
        "consumer": consumer_stats,
        "processor": processor_stats,
        "database": db_stats,
        "cache": cache_stats,
        "streams": stream_stats
    }


@app.post("/process")
async def process_response(
    response: AIResponse,
    background_tasks: BackgroundTasks
):
    """Manually process an AI response (for testing)."""
    if not processor:
        raise HTTPException(status_code=503, detail="Processor not initialized")
    
    try:
        # Process immediately
        processed = await processor.process(response)
        
        # Save to database in background
        if postgres:
            background_tasks.add_task(
                postgres.save_processed_response,
                processed
            )
        
        return processed
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/geo-scores/{brand_id}")
async def get_geo_scores(
    brand_id: str,
    platform: str = None,
    limit: int = 100
):
    """Get GEO scores for a brand."""
    if not postgres:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    scores = await postgres.get_recent_geo_scores(brand_id, platform, limit)
    return scores


@app.get("/content-gaps/{brand_id}")
async def get_content_gaps(
    brand_id: str,
    min_priority: int = 5
):
    """Get content gaps for a brand."""
    if not postgres:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    gaps = await postgres.get_content_gaps(brand_id, min_priority)
    return gaps


@app.get("/brand-mentions/{brand_id}")
async def get_brand_mentions(brand_id: str):
    """Get brand mentions."""
    if not postgres:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    mentions = await postgres.get_brand_mentions(brand_id)
    return mentions


@app.post("/cache/invalidate")
async def invalidate_cache(pattern: str = "*"):
    """Invalidate cache entries."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    await cache.invalidate(pattern)
    return {"status": "success", "pattern": pattern}


if __name__ == "__main__":
    import uvicorn
    import logging

    # Configure logging with timestamps - writes to BOTH console and file
    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
        },
        "handlers": {
            "console": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
            "file": {
                "formatter": "default",
                "class": "logging.FileHandler",
                "filename": "/tmp/intelligence-engine.log",
                "mode": "a",  # Append mode
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["console", "file"], "level": "INFO"},
            "uvicorn.error": {"handlers": ["console", "file"], "level": "INFO"},
            "uvicorn.access": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
        },
        "root": {
            "handlers": ["console", "file"],
            "level": "INFO"
        }
    }

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=False,
        log_level=settings.log_level.lower(),
        log_config=log_config
    )