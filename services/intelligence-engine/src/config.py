"""Configuration management for Intelligence Engine."""

import os
from typing import Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings."""
    
    # Service Configuration
    service_name: str = Field(default="intelligence-engine", env="SERVICE_NAME")
    service_port: int = Field(default=8002, env="SERVICE_PORT")
    metrics_port: int = Field(default=9092, env="METRICS_PORT")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    # Redis Configuration
    redis_host: str = Field(default="localhost", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_db: int = Field(default=0, env="REDIS_DB")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    redis_stream_input: str = Field(default="ai.responses.raw", env="REDIS_STREAM_INPUT")
    redis_stream_output: str = Field(default="metrics.calculated", env="REDIS_STREAM_OUTPUT")
    redis_stream_failed: str = Field(default="ai.responses.failed", env="REDIS_STREAM_FAILED")
    redis_consumer_group: str = Field(default="intelligence-engine-group", env="REDIS_CONSUMER_GROUP")
    redis_consumer_name: str = Field(default="intelligence-engine-1", env="REDIS_CONSUMER_NAME")
    
    # PostgreSQL Configuration
    postgres_host: str = Field(default="localhost", env="POSTGRES_HOST")
    postgres_port: int = Field(default=5433, env="POSTGRES_PORT")
    postgres_db: str = Field(default="rankmybrand", env="POSTGRES_DB")
    postgres_user: str = Field(default="postgres", env="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", env="POSTGRES_PASSWORD")
    postgres_pool_size: int = Field(default=10, env="POSTGRES_POOL_SIZE")
    postgres_max_overflow: int = Field(default=20, env="POSTGRES_MAX_OVERFLOW")
    
    # NLP Model Configuration
    sentiment_model: str = Field(
        default="cardiffnlp/twitter-roberta-base-sentiment-latest",
        env="SENTIMENT_MODEL"
    )
    embedding_model: str = Field(default="all-MiniLM-L6-v2", env="EMBEDDING_MODEL")
    spacy_model: str = Field(default="en_core_web_sm", env="SPACY_MODEL")
    model_cache_dir: str = Field(default="/tmp/models", env="MODEL_CACHE_DIR")
    batch_size: int = Field(default=32, env="BATCH_SIZE")
    
    # Processing Configuration
    max_workers: int = Field(default=4, env="MAX_WORKERS")
    processing_timeout: int = Field(default=30, env="PROCESSING_TIMEOUT")
    batch_timeout: int = Field(default=5, env="BATCH_TIMEOUT")
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    retry_delay: int = Field(default=1, env="RETRY_DELAY")
    
    # Cache Configuration
    cache_enabled: bool = Field(default=True, env="CACHE_ENABLED")
    cache_ttl_seconds: int = Field(default=86400, env="CACHE_TTL_SECONDS")
    cache_max_size: int = Field(default=1000, env="CACHE_MAX_SIZE")
    
    # Monitoring
    enable_metrics: bool = Field(default=True, env="ENABLE_METRICS")
    health_check_interval: int = Field(default=30, env="HEALTH_CHECK_INTERVAL")
    
    # Performance Tuning
    max_text_length: int = Field(default=512, env="MAX_TEXT_LENGTH")
    similarity_threshold: float = Field(default=0.75, env="SIMILARITY_THRESHOLD")
    confidence_threshold: float = Field(default=0.7, env="CONFIDENCE_THRESHOLD")
    top_k_keywords: int = Field(default=10, env="TOP_K_KEYWORDS")
    
    # OpenAI Configuration for LLM Entity Detection
    openai_api_key: str = Field(default="", env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4-turbo-preview", env="OPENAI_MODEL")
    openai_timeout: int = Field(default=3, env="OPENAI_TIMEOUT")
    
    @property
    def redis_url(self) -> str:
        """Get Redis connection URL."""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    @property
    def postgres_url(self) -> str:
        """Get PostgreSQL connection URL."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@"
            f"{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()