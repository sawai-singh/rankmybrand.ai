"""Prometheus metrics for monitoring."""

from prometheus_client import Counter, Histogram, Gauge, Info
import time
from functools import wraps
from typing import Callable


# Define metrics
ai_responses_processed = Counter(
    'ai_responses_processed_total',
    'Total AI responses processed',
    ['platform', 'status']
)

ai_processing_duration = Histogram(
    'ai_processing_duration_seconds',
    'Time to process AI response',
    ['platform'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

nlp_model_inference_duration = Histogram(
    'nlp_model_inference_duration_seconds',
    'NLP model inference time',
    ['model'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0]
)

geo_score_distribution = Histogram(
    'geo_score_distribution',
    'Distribution of GEO scores',
    ['brand', 'platform'],
    buckets=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
)

content_gaps_detected = Counter(
    'content_gaps_detected_total',
    'Number of content gaps detected',
    ['brand', 'type']
)

redis_stream_lag = Gauge(
    'redis_stream_lag',
    'Number of unprocessed messages in stream'
)

postgres_write_errors = Counter(
    'postgres_write_errors_total',
    'Database write errors',
    ['table']
)

cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'status']
)

cache_hit_ratio = Gauge(
    'cache_hit_ratio',
    'Cache hit ratio'
)

service_info = Info(
    'intelligence_engine',
    'Intelligence Engine service information'
)

# Processing metrics
current_processing_count = Gauge(
    'current_processing_count',
    'Number of responses currently being processed'
)

processing_errors = Counter(
    'processing_errors_total',
    'Total processing errors',
    ['error_type']
)

sentiment_score_distribution = Histogram(
    'sentiment_score_distribution',
    'Distribution of sentiment scores',
    ['platform'],
    buckets=[-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]
)

relevance_score_distribution = Histogram(
    'relevance_score_distribution',
    'Distribution of relevance scores',
    ['platform'],
    buckets=[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
)

authority_score_distribution = Histogram(
    'authority_score_distribution',
    'Distribution of authority scores',
    ['platform'],
    buckets=[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
)

share_of_voice_distribution = Histogram(
    'share_of_voice_distribution',
    'Distribution of share of voice',
    ['brand'],
    buckets=[0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]
)


class MetricsCollector:
    """Collect and manage metrics."""
    
    def __init__(self):
        # Initialize service info
        service_info.info({
            'version': '1.0.0',
            'service': 'intelligence-engine'
        })
    
    def record_response_processed(
        self,
        platform: str,
        status: str = "success"
    ):
        """Record a processed response."""
        ai_responses_processed.labels(
            platform=platform,
            status=status
        ).inc()
    
    def record_processing_time(
        self,
        platform: str,
        duration: float
    ):
        """Record processing duration."""
        ai_processing_duration.labels(platform=platform).observe(duration)
    
    def record_nlp_inference(
        self,
        model: str,
        duration: float
    ):
        """Record NLP model inference time."""
        nlp_model_inference_duration.labels(model=model).observe(duration)
    
    def record_geo_score(
        self,
        brand: str,
        platform: str,
        score: float
    ):
        """Record GEO score."""
        geo_score_distribution.labels(
            brand=brand,
            platform=platform
        ).observe(score)
    
    def record_content_gap(
        self,
        brand: str,
        gap_type: str
    ):
        """Record detected content gap."""
        content_gaps_detected.labels(
            brand=brand,
            type=gap_type
        ).inc()
    
    def set_stream_lag(self, lag: int):
        """Set current stream lag."""
        redis_stream_lag.set(lag)
    
    def record_db_error(self, table: str):
        """Record database error."""
        postgres_write_errors.labels(table=table).inc()
    
    def record_cache_operation(
        self,
        operation: str,
        status: str
    ):
        """Record cache operation."""
        cache_operations.labels(
            operation=operation,
            status=status
        ).inc()
    
    def set_cache_hit_ratio(self, ratio: float):
        """Set cache hit ratio."""
        cache_hit_ratio.set(ratio)
    
    def record_processing_error(self, error_type: str):
        """Record processing error."""
        processing_errors.labels(error_type=error_type).inc()
    
    def record_sentiment_score(
        self,
        platform: str,
        score: float
    ):
        """Record sentiment score."""
        sentiment_score_distribution.labels(platform=platform).observe(score)
    
    def record_relevance_score(
        self,
        platform: str,
        score: float
    ):
        """Record relevance score."""
        relevance_score_distribution.labels(platform=platform).observe(score)
    
    def record_authority_score(
        self,
        platform: str,
        score: float
    ):
        """Record authority score."""
        authority_score_distribution.labels(platform=platform).observe(score)
    
    def record_share_of_voice(
        self,
        brand: str,
        sov: float
    ):
        """Record share of voice."""
        share_of_voice_distribution.labels(brand=brand).observe(sov)
    
    def set_processing_count(self, count: int):
        """Set current processing count."""
        current_processing_count.set(count)


def timed_operation(metric_name: str):
    """Decorator to time operations."""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                nlp_model_inference_duration.labels(model=metric_name).observe(duration)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                nlp_model_inference_duration.labels(model=metric_name).observe(duration)
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Global metrics collector instance
metrics_collector = MetricsCollector()