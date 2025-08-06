import os
from typing import List
from pydantic_settings import BaseSettings
from .core.config_manager import get_config, init_config

# Initialize configuration based on environment
config = init_config(os.getenv('APP_ENV'))

class Settings(BaseSettings):
    # Application
    APP_NAME: str = config.get('app.name', "RankMyBrand GEO Calculator")
    VERSION: str = config.get('app.version', "1.0.0")
    DEBUG: bool = config.get('app.debug', False)
    
    # API
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: List[str] = config.get('security.cors_origins', ["http://localhost:3000"])
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./geo_metrics.db")
    
    # AI Platforms
    PERPLEXITY_API_KEY: str = os.getenv("PERPLEXITY_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Rate Limiting
    RATE_LIMIT_PER_HOUR: int = config.get('api.rate_limit', 100)
    
    # Cache
    CACHE_TTL: int = config.get('ai_visibility.cache_ttl', 3600)
    
    # Job Processing
    JOB_QUEUE_TYPE: str = config.get('job_processing.queue_type', 'memory')
    JOB_WORKERS: int = config.get('job_processing.workers', 4)
    
    # Metrics Configuration
    METRICS_WEIGHTS: dict = config.get_metrics_weights()
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra fields from env

settings = Settings()
