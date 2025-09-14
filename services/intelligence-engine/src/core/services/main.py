"""
AI Visibility Service - Main Application
Production-ready FastAPI service with comprehensive monitoring, error handling, and job processing
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
import uvicorn
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from prometheus_client.core import CollectorRegistry
import redis.asyncio as aioredis
import psycopg2
from psycopg2.extras import RealDictCursor
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Import our AI Visibility components
from ..analysis.query_generator import IntelligentQueryGenerator, QueryContext
from ..analysis.llm_orchestrator import LLMOrchestrator as MultiLLMOrchestrator
from ..analysis.response_analyzer import UnifiedResponseAnalyzer as ResponseAnalyzer
from ..utilities.cache_manager import IntelligentCacheManager as CacheManager
from .websocket_manager import WebSocketManager
from .job_processor import AuditJobProcessor as JobProcessor
from .monitoring import MetricsCollector, HealthMonitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SERVICE_NAME = "ai-visibility-service"
VERSION = "1.0.0"

# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "database": os.getenv("DB_NAME", "rankmybrand"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres")
}

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# LLM API Keys
LLM_KEYS = {
    "openai": os.getenv("OPENAI_API_KEY", ""),
    "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
    "google": os.getenv("GOOGLE_AI_API_KEY", ""),
    "perplexity": os.getenv("PERPLEXITY_API_KEY", "")
}

# Cost limits and rate limiting
DAILY_COST_LIMIT = float(os.getenv("DAILY_COST_LIMIT", "100.00"))
REQUESTS_PER_MINUTE = int(os.getenv("REQUESTS_PER_MINUTE", "60"))

# Request/Response models
class AuditRequest(BaseModel):
    """Request model for AI Visibility audit"""
    company_name: str = Field(..., min_length=1, max_length=255)
    industry: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=10, max_length=2000)
    competitors: List[str] = Field(default_factory=list, max_items=10)
    target_audiences: List[Dict[str, str]] = Field(default_factory=list)
    unique_value_propositions: List[str] = Field(default_factory=list, max_items=10)
    products_services: List[str] = Field(default_factory=list, max_items=20)
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    
    @validator('competitors')
    def validate_competitors(cls, v):
        return [c.strip() for c in v if c.strip()]

class AuditResponse(BaseModel):
    """Response model for AI Visibility audit"""
    audit_id: str
    status: str
    message: str
    estimated_completion: datetime
    websocket_channel: str

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    environment: str
    uptime_seconds: float
    services: Dict[str, Dict[str, Any]]
    metrics: Dict[str, float]

# Global instances
app: Optional[FastAPI] = None
redis_client: Optional[aioredis.Redis] = None
db_pool = None
query_generator: Optional[IntelligentQueryGenerator] = None
llm_orchestrator: Optional[MultiLLMOrchestrator] = None
response_analyzer: Optional[ResponseAnalyzer] = None
cache_manager: Optional[CacheManager] = None
websocket_manager: Optional[WebSocketManager] = None
job_processor: Optional[JobProcessor] = None
metrics_collector: Optional[MetricsCollector] = None
health_monitor: Optional[HealthMonitor] = None

# Metrics
request_counter = Counter('ai_visibility_requests_total', 'Total number of audit requests')
request_duration = Histogram('ai_visibility_request_duration_seconds', 'Request duration')
active_audits = Gauge('ai_visibility_active_audits', 'Number of active audits')
llm_cost_gauge = Gauge('ai_visibility_daily_cost_usd', 'Daily LLM API cost in USD')
cache_hit_rate = Gauge('ai_visibility_cache_hit_rate', 'Cache hit rate percentage')

# Application startup time
APP_START_TIME = datetime.now()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager"""
    global redis_client, db_pool, query_generator, llm_orchestrator
    global response_analyzer, cache_manager, websocket_manager, job_processor
    global metrics_collector, health_monitor
    
    logger.info(f"Starting {SERVICE_NAME} v{VERSION} in {ENVIRONMENT} mode")
    
    try:
        # Initialize Redis
        redis_client = await aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        logger.info("✅ Redis connected")
        
        # Initialize database pool
        db_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            **DB_CONFIG
        )
        logger.info("✅ Database pool created")
        
        # Initialize components
        if LLM_KEYS["openai"]:
            query_generator = IntelligentQueryGenerator(
                openai_api_key=LLM_KEYS["openai"],
                model=settings.openai_model  # Uses gpt-5-chat-latest from config  # Use GPT-4 until GPT-5 is available
            )
            logger.info("✅ Query generator initialized")
        
        orchestrator_config = OrchestratorConfig(
            openai_api_key=LLM_KEYS["openai"],
            anthropic_api_key=LLM_KEYS["anthropic"],
            google_api_key=LLM_KEYS["google"],
            perplexity_api_key=LLM_KEYS["perplexity"],
            max_parallel_requests=5,
            request_timeout=30,
            circuit_breaker_threshold=5,
            circuit_breaker_timeout=300
        )
        llm_orchestrator = MultiLLMOrchestrator(orchestrator_config)
        logger.info("✅ LLM orchestrator initialized")
        
        response_analyzer = ResponseAnalyzer(
            openai_api_key=LLM_KEYS["openai"],
            model=settings.openai_model  # Uses gpt-5-chat-latest from config
        )
        logger.info("✅ Response analyzer initialized")
        
        cache_manager = CacheManager(redis_client)
        await cache_manager.initialize()
        logger.info("✅ Cache manager initialized")
        
        websocket_manager = WebSocketManager()
        logger.info("✅ WebSocket manager initialized")
        
        job_processor = JobProcessor(
            redis_client=redis_client,
            db_pool=db_pool,
            query_generator=query_generator,
            llm_orchestrator=llm_orchestrator,
            response_analyzer=response_analyzer,
            cache_manager=cache_manager,
            websocket_manager=websocket_manager
        )
        asyncio.create_task(job_processor.start())
        logger.info("✅ Job processor started")
        
        metrics_collector = MetricsCollector()
        health_monitor = HealthMonitor(
            redis_client=redis_client,
            db_pool=db_pool,
            llm_orchestrator=llm_orchestrator
        )
        logger.info("✅ Monitoring systems initialized")
        
        # Setup OpenTelemetry
        resource = Resource.create({"service.name": SERVICE_NAME})
        provider = TracerProvider(resource=resource)
        processor = BatchSpanProcessor(
            OTLPSpanExporter(endpoint=os.getenv("OTLP_ENDPOINT", "localhost:4317"))
        )
        provider.add_span_processor(processor)
        trace.set_tracer_provider(provider)
        
        logger.info(f"🚀 {SERVICE_NAME} is ready to handle requests")
        
    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI Visibility service...")
    
    if job_processor:
        await job_processor.stop()
    
    if websocket_manager:
        await websocket_manager.close_all()
    
    if redis_client:
        await redis_client.close()
    
    if db_pool:
        db_pool.closeall()
    
    logger.info("👋 AI Visibility service shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="AI Visibility Service",
    description="Enterprise-grade AI visibility analysis and monitoring",
    version=VERSION,
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instrument with OpenTelemetry
FastAPIInstrumentor.instrument_app(app)

# Dependency for rate limiting
async def check_rate_limit(session_id: str = None):
    """Check if request is within rate limits"""
    if not redis_client:
        return True
    
    key = f"rate_limit:{session_id or 'anonymous'}"
    current = await redis_client.incr(key)
    
    if current == 1:
        await redis_client.expire(key, 60)
    
    if current > REQUESTS_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {REQUESTS_PER_MINUTE} requests per minute."
        )
    
    return True

# Dependency for cost checking
async def check_daily_cost():
    """Check if daily cost limit has been exceeded"""
    if not redis_client:
        return True
    
    today = datetime.now().strftime("%Y-%m-%d")
    cost_key = f"daily_cost:{today}"
    current_cost = float(await redis_client.get(cost_key) or 0)
    
    if current_cost >= DAILY_COST_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Daily cost limit of ${DAILY_COST_LIMIT} exceeded. Service will resume tomorrow."
        )
    
    llm_cost_gauge.set(current_cost)
    return True

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Comprehensive health check endpoint"""
    uptime = (datetime.now() - APP_START_TIME).total_seconds()
    
    # Check all service health
    services_health = {}
    
    # Redis health
    try:
        await redis_client.ping()
        services_health["redis"] = {
            "status": "healthy",
            "latency_ms": 1
        }
    except Exception as e:
        services_health["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Database health
    try:
        conn = db_pool.getconn()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_pool.putconn(conn)
        services_health["database"] = {
            "status": "healthy",
            "pool_size": db_pool.maxconn
        }
    except Exception as e:
        services_health["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # LLM providers health
    if llm_orchestrator:
        provider_health = await llm_orchestrator.get_providers_health()
        services_health["llm_providers"] = provider_health
    
    # Job processor health
    if job_processor:
        services_health["job_processor"] = {
            "status": "healthy" if job_processor.is_running else "stopped",
            "active_jobs": job_processor.active_jobs_count,
            "queue_size": await job_processor.get_queue_size()
        }
    
    # Calculate overall health
    all_healthy = all(
        s.get("status") == "healthy" 
        for s in services_health.values() 
        if isinstance(s, dict)
    )
    
    # Get current metrics
    metrics = {
        "total_requests": request_counter._value._value if hasattr(request_counter, '_value') else 0,
        "active_audits": active_audits._value._value if hasattr(active_audits, '_value') else 0,
        "cache_hit_rate": cache_hit_rate._value._value if hasattr(cache_hit_rate, '_value') else 0,
        "daily_cost_usd": llm_cost_gauge._value._value if hasattr(llm_cost_gauge, '_value') else 0
    }
    
    return HealthResponse(
        status="healthy" if all_healthy else "degraded",
        version=VERSION,
        environment=ENVIRONMENT,
        uptime_seconds=uptime,
        services=services_health,
        metrics=metrics
    )

@app.post("/api/ai-visibility/audit", response_model=AuditResponse)
async def create_audit(
    request: AuditRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(check_rate_limit),
    __: bool = Depends(check_daily_cost)
):
    """Create a new AI visibility audit"""
    request_counter.inc()
    
    # Generate audit ID
    audit_id = f"audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{request.session_id or 'anonymous'}"
    
    # Create query context
    context = QueryContext(
        company_name=request.company_name,
        industry=request.industry,
        sub_industry=None,
        description=request.description,
        unique_value_propositions=request.unique_value_propositions,
        target_audiences=request.target_audiences,
        competitors=request.competitors,
        products_services=request.products_services,
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
    
    # Store audit in database
    try:
        conn = db_pool.getconn()
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO ai_visibility_audits 
                (audit_id, company_name, industry, status, context, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                audit_id,
                request.company_name,
                request.industry,
                "pending",
                json.dumps(request.dict()),
                datetime.now()
            ))
            conn.commit()
        db_pool.putconn(conn)
    except Exception as e:
        logger.error(f"Failed to store audit: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create audit"
        )
    
    # Queue job for processing
    job_data = {
        "audit_id": audit_id,
        "context": context.__dict__,
        "user_email": request.user_email,
        "session_id": request.session_id
    }
    
    await redis_client.lpush("ai_visibility:job_queue", json.dumps(job_data))
    active_audits.inc()
    
    # Send initial WebSocket notification
    await websocket_manager.send_to_channel(
        f"audit:{audit_id}",
        {
            "type": "audit_created",
            "audit_id": audit_id,
            "status": "pending",
            "message": "Your AI visibility audit has been queued for processing"
        }
    )
    
    estimated_completion = datetime.now() + timedelta(minutes=5)
    
    return AuditResponse(
        audit_id=audit_id,
        status="pending",
        message="Audit created successfully and queued for processing",
        estimated_completion=estimated_completion,
        websocket_channel=f"audit:{audit_id}"
    )

@app.get("/api/ai-visibility/audit/{audit_id}")
async def get_audit_status(audit_id: str):
    """Get audit status and results"""
    try:
        # Check cache first
        cached = await redis_client.get(f"audit:result:{audit_id}")
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        # Query database
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT * FROM ai_visibility_audits 
                WHERE audit_id = %s
            """, (audit_id,))
            audit = cursor.fetchone()
        db_pool.putconn(conn)
        
        if not audit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Audit not found"
            )
        
        return JSONResponse(content=dict(audit))
        
    except Exception as e:
        logger.error(f"Failed to get audit status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit status"
        )

@app.get("/api/ai-visibility/metrics")
async def get_metrics():
    """Get current AI visibility metrics"""
    try:
        # Get today's metrics
        today = datetime.now().strftime("%Y-%m-%d")
        
        metrics_data = {
            "date": today,
            "total_audits": await redis_client.get(f"metrics:audits:{today}") or 0,
            "total_queries": await redis_client.get(f"metrics:queries:{today}") or 0,
            "llm_calls": {
                "openai": await redis_client.get(f"metrics:llm:openai:{today}") or 0,
                "anthropic": await redis_client.get(f"metrics:llm:anthropic:{today}") or 0,
                "google": await redis_client.get(f"metrics:llm:google:{today}") or 0,
                "perplexity": await redis_client.get(f"metrics:llm:perplexity:{today}") or 0
            },
            "cost_usd": float(await redis_client.get(f"daily_cost:{today}") or 0),
            "cache_stats": {
                "hits": await redis_client.get(f"cache:hits:{today}") or 0,
                "misses": await redis_client.get(f"cache:misses:{today}") or 0,
                "hit_rate": await cache_manager.get_hit_rate() if cache_manager else 0
            },
            "average_audit_time_seconds": float(
                await redis_client.get(f"metrics:avg_audit_time:{today}") or 0
            ),
            "error_rate": float(await redis_client.get(f"metrics:error_rate:{today}") or 0)
        }
        
        return JSONResponse(content=metrics_data)
        
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return JSONResponse(
            content={"error": "Failed to retrieve metrics"},
            status_code=500
        )

@app.get("/api/ai-visibility/providers/health")
async def get_providers_health():
    """Get health status of all LLM providers"""
    if not llm_orchestrator:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM orchestrator not initialized"
        )
    
    health_data = await llm_orchestrator.get_providers_health()
    return JSONResponse(content=health_data)

@app.post("/api/ai-visibility/admin/reset-limits")
async def reset_daily_limits(api_key: str = None):
    """Admin endpoint to reset daily limits"""
    # Simple API key check - in production use proper auth
    if api_key != os.getenv("ADMIN_API_KEY", "admin-secret-key"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    today = datetime.now().strftime("%Y-%m-%d")
    await redis_client.delete(f"daily_cost:{today}")
    
    return JSONResponse(content={
        "message": "Daily limits reset successfully",
        "date": today
    })

@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.websocket("/ws/ai-visibility/{audit_id}")
async def websocket_endpoint(websocket, audit_id: str):
    """WebSocket endpoint for real-time audit updates"""
    await websocket_manager.connect(websocket, f"audit:{audit_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle any client messages if needed
            if data == "ping":
                await websocket.send_text("pong")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        websocket_manager.disconnect(websocket, f"audit:{audit_id}")

if __name__ == "__main__":
    # Run the service
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8100,
        reload=ENVIRONMENT == "development",
        log_level="info",
        access_log=True
    )