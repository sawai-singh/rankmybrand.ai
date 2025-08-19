"""Main FastAPI application for Intelligence Engine."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
import logging
from src.api.analysis_routes import router as analysis_router
from src.api.geo_routes import router as geo_router
from src.api.ai_visibility_routes import router as ai_visibility_router
from src.config import settings
from src.monitoring.middleware import setup_metrics_middleware

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Intelligence Engine API",
    description="AI Response Processing and Intelligence Extraction Service",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Prometheus metrics middleware
setup_metrics_middleware(app)

# Mount Prometheus metrics endpoint
if settings.enable_metrics:
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

# Include routers
app.include_router(analysis_router, prefix="/api")
app.include_router(geo_router)
app.include_router(ai_visibility_router)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info(f"Intelligence Engine API starting on port {settings.service_port}")
    logger.info(f"Environment: {settings.app_env}")
    
    # Log configuration status
    if settings.openai_api_key:
        logger.info("OpenAI API configured")
    else:
        logger.warning("OpenAI API key not configured - LLM features disabled")
    
    if settings.jwt_secret == "change-me-in-production":
        logger.warning("Using default JWT secret - change for production!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Intelligence Engine API shutting down")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Intelligence Engine",
        "status": "operational",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "intelligence-engine",
        "environment": settings.app_env
    }