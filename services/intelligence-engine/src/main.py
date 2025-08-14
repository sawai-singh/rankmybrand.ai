"""FastAPI application for Intelligence Engine."""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from src.config import settings
from src.consumer import StreamConsumer
from src.storage import PostgresClient, RedisClient, CacheManager
from src.monitoring import HealthChecker
from src.processors import ResponseProcessor
from src.models.schemas import AIResponse, ProcessedResponse
from src.api import analysis_routes


# Global instances
consumer: StreamConsumer = None
postgres: PostgresClient = None
redis: RedisClient = None
cache: CacheManager = None
health_checker: HealthChecker = None
processor: ResponseProcessor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global consumer, postgres, redis, cache, health_checker, processor
    
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

# Mount Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include analysis routes
app.include_router(analysis_routes.router)


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
    
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=False,
        log_level=settings.log_level.lower()
    )