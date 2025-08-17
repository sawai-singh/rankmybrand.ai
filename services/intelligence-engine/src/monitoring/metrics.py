"""Unified Prometheus metrics for monitoring with rankmybrand_ prefix."""

from prometheus_client import Counter, Histogram, Gauge, Info, CollectorRegistry, REGISTRY
import time
from functools import wraps
from typing import Callable, Optional
import asyncio
from datetime import datetime


# Core HTTP and application metrics (expected by Grafana dashboard)
rankmybrand_http_requests_total = Counter(
    'rankmybrand_http_requests_total',
    'Total HTTP requests received',
    ['method', 'route', 'status_code']
)

rankmybrand_http_request_duration_seconds = Histogram(
    'rankmybrand_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'route'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

rankmybrand_geo_score_value = Gauge(
    'rankmybrand_geo_score_value',
    'Current GEO score value',
    ['brand', 'platform']
)

rankmybrand_active_connections = Gauge(
    'rankmybrand_active_connections',
    'Number of active connections'
)

rankmybrand_onboarding_funnel = Gauge(
    'rankmybrand_onboarding_funnel',
    'Onboarding funnel metrics',
    ['stage']
)

rankmybrand_cache_hit_rate = Gauge(
    'rankmybrand_cache_hit_rate',
    'Cache hit rate percentage'
)

rankmybrand_api_errors_total = Counter(
    'rankmybrand_api_errors_total',
    'Total API errors',
    ['endpoint', 'error_type', 'status_code']
)

rankmybrand_llm_api_calls_total = Counter(
    'rankmybrand_llm_api_calls_total',
    'Total LLM API calls',
    ['provider', 'model', 'status']
)

# Intelligence Engine specific metrics
rankmybrand_ai_responses_processed_total = Counter(
    'rankmybrand_ai_responses_processed_total',
    'Total AI responses processed',
    ['platform', 'status']
)

rankmybrand_ai_processing_duration_seconds = Histogram(
    'rankmybrand_ai_processing_duration_seconds',
    'Time to process AI response',
    ['platform'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

rankmybrand_nlp_model_inference_duration_seconds = Histogram(
    'rankmybrand_nlp_model_inference_duration_seconds',
    'NLP model inference time',
    ['model'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0]
)

rankmybrand_geo_score_distribution = Histogram(
    'rankmybrand_geo_score_distribution',
    'Distribution of GEO scores',
    ['brand', 'platform'],
    buckets=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
)

rankmybrand_content_gaps_detected_total = Counter(
    'rankmybrand_content_gaps_detected_total',
    'Number of content gaps detected',
    ['brand', 'type']
)

rankmybrand_redis_stream_lag = Gauge(
    'rankmybrand_redis_stream_lag',
    'Number of unprocessed messages in stream',
    ['stream_name']
)

rankmybrand_postgres_write_errors_total = Counter(
    'rankmybrand_postgres_write_errors_total',
    'Database write errors',
    ['table', 'error_type']
)

rankmybrand_cache_operations_total = Counter(
    'rankmybrand_cache_operations_total',
    'Cache operations',
    ['operation', 'status']
)

rankmybrand_service_info = Info(
    'rankmybrand_intelligence_engine_info',
    'Intelligence Engine service information'
)

# Processing metrics
rankmybrand_current_processing_count = Gauge(
    'rankmybrand_current_processing_count',
    'Number of responses currently being processed'
)

rankmybrand_processing_errors_total = Counter(
    'rankmybrand_processing_errors_total',
    'Total processing errors',
    ['error_type', 'component']
)

rankmybrand_sentiment_score_distribution = Histogram(
    'rankmybrand_sentiment_score_distribution',
    'Distribution of sentiment scores',
    ['platform'],
    buckets=[-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]
)

rankmybrand_relevance_score_distribution = Histogram(
    'rankmybrand_relevance_score_distribution',
    'Distribution of relevance scores',
    ['platform'],
    buckets=[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
)

rankmybrand_authority_score_distribution = Histogram(
    'rankmybrand_authority_score_distribution',
    'Distribution of authority scores',
    ['platform'],
    buckets=[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
)

rankmybrand_share_of_voice_distribution = Histogram(
    'rankmybrand_share_of_voice_distribution',
    'Distribution of share of voice',
    ['brand'],
    buckets=[0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]
)

# Business KPI metrics
rankmybrand_user_registrations_total = Counter(
    'rankmybrand_user_registrations_total',
    'Total user registrations',
    ['source', 'plan_type']
)

rankmybrand_subscription_conversions_total = Counter(
    'rankmybrand_subscription_conversions_total',
    'Total subscription conversions',
    ['from_plan', 'to_plan']
)

rankmybrand_monthly_recurring_revenue = Gauge(
    'rankmybrand_monthly_recurring_revenue',
    'Monthly recurring revenue',
    ['plan_type']
)

# System health metrics
rankmybrand_database_connections = Gauge(
    'rankmybrand_database_connections',
    'Database connection pool metrics',
    ['pool_name', 'state']
)

rankmybrand_memory_usage_bytes = Gauge(
    'rankmybrand_memory_usage_bytes',
    'Memory usage in bytes',
    ['component']
)

rankmybrand_cpu_usage_percent = Gauge(
    'rankmybrand_cpu_usage_percent',
    'CPU usage percentage',
    ['component']
)


class MetricsCollector:
    """Unified metrics collector and manager for RankMyBrand Intelligence Engine."""
    
    def __init__(self):
        # Initialize service info
        rankmybrand_service_info.info({
            'version': '1.0.0',
            'service': 'intelligence-engine',
            'environment': 'production',
            'build_time': datetime.now().isoformat()
        })
        
        # Track active connections
        self._active_connections = 0
        
        # Initialize onboarding funnel stages
        self._initialize_onboarding_funnel()
    
    def _initialize_onboarding_funnel(self):
        """Initialize onboarding funnel stages."""
        stages = ['signup', 'verification', 'profile_setup', 'first_search', 'subscription']
        for stage in stages:
            rankmybrand_onboarding_funnel.labels(stage=stage).set(0)
    
    # HTTP request metrics
    def record_http_request(
        self,
        method: str,
        route: str,
        status_code: int,
        duration: float
    ):
        """Record HTTP request metrics."""
        rankmybrand_http_requests_total.labels(
            method=method,
            route=route,
            status_code=str(status_code)
        ).inc()
        
        rankmybrand_http_request_duration_seconds.labels(
            method=method,
            route=route
        ).observe(duration)
        
        # Track API errors
        if status_code >= 400:
            error_type = 'client_error' if status_code < 500 else 'server_error'
            rankmybrand_api_errors_total.labels(
                endpoint=route,
                error_type=error_type,
                status_code=str(status_code)
            ).inc()
    
    def record_response_processed(
        self,
        platform: str,
        status: str = "success"
    ):
        """Record a processed response."""
        rankmybrand_ai_responses_processed_total.labels(
            platform=platform,
            status=status
        ).inc()
    
    def record_processing_time(
        self,
        platform: str,
        duration: float
    ):
        """Record processing duration."""
        rankmybrand_ai_processing_duration_seconds.labels(platform=platform).observe(duration)
    
    def record_nlp_inference(
        self,
        model: str,
        duration: float
    ):
        """Record NLP model inference time."""
        rankmybrand_nlp_model_inference_duration_seconds.labels(model=model).observe(duration)
    
    def record_geo_score(
        self,
        brand: str,
        platform: str,
        score: float
    ):
        """Record GEO score."""
        # Update distribution histogram
        rankmybrand_geo_score_distribution.labels(
            brand=brand,
            platform=platform
        ).observe(score)
        
        # Update current value gauge for dashboard
        rankmybrand_geo_score_value.labels(
            brand=brand,
            platform=platform
        ).set(score)
    
    def record_content_gap(
        self,
        brand: str,
        gap_type: str
    ):
        """Record detected content gap."""
        rankmybrand_content_gaps_detected_total.labels(
            brand=brand,
            type=gap_type
        ).inc()
    
    def set_stream_lag(self, stream_name: str, lag: int):
        """Set current stream lag."""
        rankmybrand_redis_stream_lag.labels(stream_name=stream_name).set(lag)
    
    def record_db_error(self, table: str, error_type: str = 'write_error'):
        """Record database error."""
        rankmybrand_postgres_write_errors_total.labels(
            table=table,
            error_type=error_type
        ).inc()
    
    def record_cache_operation(
        self,
        operation: str,
        status: str
    ):
        """Record cache operation."""
        rankmybrand_cache_operations_total.labels(
            operation=operation,
            status=status
        ).inc()
    
    def set_cache_hit_ratio(self, ratio: float):
        """Set cache hit ratio (as percentage)."""
        rankmybrand_cache_hit_rate.set(ratio * 100)  # Convert to percentage for dashboard
    
    def record_processing_error(self, error_type: str, component: str = 'intelligence-engine'):
        """Record processing error."""
        rankmybrand_processing_errors_total.labels(
            error_type=error_type,
            component=component
        ).inc()
    
    def record_sentiment_score(
        self,
        platform: str,
        score: float
    ):
        """Record sentiment score."""
        rankmybrand_sentiment_score_distribution.labels(platform=platform).observe(score)
    
    def record_relevance_score(
        self,
        platform: str,
        score: float
    ):
        """Record relevance score."""
        rankmybrand_relevance_score_distribution.labels(platform=platform).observe(score)
    
    def record_authority_score(
        self,
        platform: str,
        score: float
    ):
        """Record authority score."""
        rankmybrand_authority_score_distribution.labels(platform=platform).observe(score)
    
    def record_share_of_voice(
        self,
        brand: str,
        sov: float
    ):
        """Record share of voice."""
        rankmybrand_share_of_voice_distribution.labels(brand=brand).observe(sov)
    
    def set_processing_count(self, count: int):
        """Set current processing count."""
        rankmybrand_current_processing_count.set(count)
    
    # Connection management
    def increment_active_connections(self):
        """Increment active connections count."""
        self._active_connections += 1
        rankmybrand_active_connections.set(self._active_connections)
    
    def decrement_active_connections(self):
        """Decrement active connections count."""
        self._active_connections = max(0, self._active_connections - 1)
        rankmybrand_active_connections.set(self._active_connections)
    
    def set_active_connections(self, count: int):
        """Set active connections count."""
        self._active_connections = count
        rankmybrand_active_connections.set(count)
    
    # LLM API metrics
    def record_llm_api_call(
        self,
        provider: str,
        model: str,
        status: str = 'success'
    ):
        """Record LLM API call."""
        rankmybrand_llm_api_calls_total.labels(
            provider=provider,
            model=model,
            status=status
        ).inc()
    
    # Onboarding funnel metrics
    def update_onboarding_funnel(self, stage: str, count: int):
        """Update onboarding funnel stage count."""
        rankmybrand_onboarding_funnel.labels(stage=stage).set(count)
    
    def increment_onboarding_stage(self, stage: str):
        """Increment onboarding funnel stage."""
        rankmybrand_onboarding_funnel.labels(stage=stage).inc()
    
    # Business KPI metrics
    def record_user_registration(self, source: str = 'web', plan_type: str = 'free'):
        """Record user registration."""
        rankmybrand_user_registrations_total.labels(
            source=source,
            plan_type=plan_type
        ).inc()
    
    def record_subscription_conversion(self, from_plan: str, to_plan: str):
        """Record subscription conversion."""
        rankmybrand_subscription_conversions_total.labels(
            from_plan=from_plan,
            to_plan=to_plan
        ).inc()
    
    def set_monthly_recurring_revenue(self, plan_type: str, amount: float):
        """Set monthly recurring revenue."""
        rankmybrand_monthly_recurring_revenue.labels(plan_type=plan_type).set(amount)
    
    # System health metrics
    def set_database_connections(self, pool_name: str, active: int, idle: int, total: int):
        """Set database connection metrics."""
        rankmybrand_database_connections.labels(pool_name=pool_name, state='active').set(active)
        rankmybrand_database_connections.labels(pool_name=pool_name, state='idle').set(idle)
        rankmybrand_database_connections.labels(pool_name=pool_name, state='total').set(total)
    
    def set_memory_usage(self, component: str, bytes_used: int):
        """Set memory usage metrics."""
        rankmybrand_memory_usage_bytes.labels(component=component).set(bytes_used)
    
    def set_cpu_usage(self, component: str, percentage: float):
        """Set CPU usage metrics."""
        rankmybrand_cpu_usage_percent.labels(component=component).set(percentage)


def timed_operation(metric_name: str, operation_type: str = 'nlp'):
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
                if operation_type == 'nlp':
                    rankmybrand_nlp_model_inference_duration_seconds.labels(model=metric_name).observe(duration)
                elif operation_type == 'http':
                    # Extract HTTP method and route from args if available
                    method = kwargs.get('method', 'unknown')
                    route = kwargs.get('route', 'unknown')
                    rankmybrand_http_request_duration_seconds.labels(
                        method=method,
                        route=route
                    ).observe(duration)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                if operation_type == 'nlp':
                    rankmybrand_nlp_model_inference_duration_seconds.labels(model=metric_name).observe(duration)
                elif operation_type == 'http':
                    # Extract HTTP method and route from args if available
                    method = kwargs.get('method', 'unknown')
                    route = kwargs.get('route', 'unknown')
                    rankmybrand_http_request_duration_seconds.labels(
                        method=method,
                        route=route
                    ).observe(duration)
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def http_request_middleware():
    """FastAPI middleware for HTTP request metrics."""
    def middleware(request, call_next):
        async def wrapper():
            start_time = time.time()
            
            response = await call_next(request)
            
            duration = time.time() - start_time
            method = request.method
            route = request.url.path
            status_code = response.status_code
            
            # Record metrics
            metrics_collector.record_http_request(
                method=method,
                route=route,
                status_code=status_code,
                duration=duration
            )
            
            return response
        
        return wrapper()
    
    return middleware


# Global metrics collector instance
metrics_collector = MetricsCollector()


# Health check metrics
def update_health_metrics():
    """Update system health metrics."""
    import psutil
    import os
    
    try:
        # Memory usage
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        metrics_collector.set_memory_usage('intelligence-engine', memory_info.rss)
        
        # CPU usage
        cpu_percent = process.cpu_percent()
        metrics_collector.set_cpu_usage('intelligence-engine', cpu_percent)
        
    except Exception:
        # Ignore errors in health metrics collection
        pass


# Middleware for automatic HTTP metrics collection
class PrometheusMiddleware:
    """FastAPI middleware for automatic Prometheus metrics collection."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        
        # Track active connections
        metrics_collector.increment_active_connections()
        
        async def send_wrapper(message):
            if message['type'] == 'http.response.start':
                # Record metrics when response starts
                duration = time.time() - start_time
                method = scope['method']
                path = scope['path']
                status_code = message['status']
                
                metrics_collector.record_http_request(
                    method=method,
                    route=path,
                    status_code=status_code,
                    duration=duration
                )
            
            elif message['type'] == 'http.response.body' and not message.get('more_body', False):
                # Connection is closing
                metrics_collector.decrement_active_connections()
            
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            # Ensure we decrement connections even on error
            metrics_collector.decrement_active_connections()
            raise