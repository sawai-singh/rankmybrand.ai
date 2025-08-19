"""
Enhanced Monitoring for AI Visibility System
Comprehensive metrics, tracing, and alerting with Prometheus and OpenTelemetry
"""

from prometheus_client import Counter, Histogram, Gauge, Info, Summary, CollectorRegistry, generate_latest
from opentelemetry import trace, metrics
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.sdk.resources import Resource
import time
import psutil
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import json
from functools import wraps
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# =====================================================
# AI Visibility Specific Metrics
# =====================================================

# Audit Metrics
ai_visibility_audits_total = Counter(
    'ai_visibility_audits_total',
    'Total number of AI visibility audits',
    ['status', 'company_id']
)

ai_visibility_audit_duration_seconds = Histogram(
    'ai_visibility_audit_duration_seconds',
    'Time to complete full audit',
    buckets=[30, 60, 120, 300, 600, 1200, 1800, 3600]  # Up to 1 hour
)

ai_visibility_queries_generated_total = Counter(
    'ai_visibility_queries_generated_total',
    'Total queries generated',
    ['intent', 'complexity']
)

ai_visibility_query_generation_duration_seconds = Histogram(
    'ai_visibility_query_generation_duration_seconds',
    'Time to generate queries using GPT-5',
    buckets=[1, 2, 5, 10, 20, 30, 60]
)

# LLM Orchestration Metrics
ai_visibility_llm_requests_total = Counter(
    'ai_visibility_llm_requests_total',
    'Total LLM API requests',
    ['provider', 'status', 'cache_hit']
)

ai_visibility_llm_response_time_seconds = Histogram(
    'ai_visibility_llm_response_time_seconds',
    'LLM API response time',
    ['provider', 'model'],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 20, 30]
)

ai_visibility_llm_tokens_used_total = Counter(
    'ai_visibility_llm_tokens_used_total',
    'Total tokens consumed',
    ['provider', 'model']
)

ai_visibility_llm_circuit_breaker_state = Gauge(
    'ai_visibility_llm_circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    ['provider']
)

ai_visibility_llm_provider_health_score = Gauge(
    'ai_visibility_llm_provider_health_score',
    'Provider health score (0-1)',
    ['provider']
)

# Response Analysis Metrics
ai_visibility_responses_analyzed_total = Counter(
    'ai_visibility_responses_analyzed_total',
    'Total responses analyzed',
    ['provider', 'brand_mentioned', 'sentiment']
)

ai_visibility_analysis_duration_seconds = Histogram(
    'ai_visibility_analysis_duration_seconds',
    'Time to analyze response',
    buckets=[0.5, 1, 2, 5, 10, 20]
)

ai_visibility_brand_mention_rate = Gauge(
    'ai_visibility_brand_mention_rate',
    'Current brand mention rate percentage',
    ['company_id']
)

ai_visibility_sentiment_distribution = Histogram(
    'ai_visibility_sentiment_distribution',
    'Distribution of sentiment scores',
    ['company_id'],
    buckets=[-1, -0.5, 0, 0.5, 1]
)

# Competitive Metrics
ai_visibility_competitive_position = Gauge(
    'ai_visibility_competitive_position',
    'Current competitive position (1=best)',
    ['company_id']
)

ai_visibility_competitor_mentions_total = Counter(
    'ai_visibility_competitor_mentions_total',
    'Total competitor mentions',
    ['company_id', 'competitor']
)

# Cache Metrics
ai_visibility_cache_hits_total = Counter(
    'ai_visibility_cache_hits_total',
    'Cache hits',
    ['cache_type', 'operation']
)

ai_visibility_cache_misses_total = Counter(
    'ai_visibility_cache_misses_total',
    'Cache misses',
    ['cache_type', 'operation']
)

ai_visibility_cache_hit_rate = Gauge(
    'ai_visibility_cache_hit_rate',
    'Cache hit rate percentage',
    ['cache_type']
)

ai_visibility_cache_size_bytes = Gauge(
    'ai_visibility_cache_size_bytes',
    'Current cache size in bytes',
    ['cache_type']
)

# WebSocket Metrics
ai_visibility_websocket_connections_active = Gauge(
    'ai_visibility_websocket_connections_active',
    'Active WebSocket connections'
)

ai_visibility_websocket_messages_sent_total = Counter(
    'ai_visibility_websocket_messages_sent_total',
    'Total WebSocket messages sent',
    ['event_type']
)

ai_visibility_websocket_subscriptions_active = Gauge(
    'ai_visibility_websocket_subscriptions_active',
    'Active audit subscriptions',
    ['audit_id']
)

# Job Processing Metrics
ai_visibility_jobs_processed_total = Counter(
    'ai_visibility_jobs_processed_total',
    'Total jobs processed',
    ['job_type', 'status']
)

ai_visibility_job_processing_duration_seconds = Histogram(
    'ai_visibility_job_processing_duration_seconds',
    'Job processing duration',
    ['job_type'],
    buckets=[1, 5, 10, 30, 60, 300, 600, 1800]
)

ai_visibility_job_queue_size = Gauge(
    'ai_visibility_job_queue_size',
    'Current job queue size',
    ['queue_name', 'priority']
)

ai_visibility_job_retries_total = Counter(
    'ai_visibility_job_retries_total',
    'Total job retries',
    ['job_type', 'retry_count']
)

# Business Metrics
ai_visibility_audit_value_score = Gauge(
    'ai_visibility_audit_value_score',
    'Calculated audit value score',
    ['company_id']
)

ai_visibility_insights_generated_total = Counter(
    'ai_visibility_insights_generated_total',
    'Total insights generated',
    ['company_id', 'insight_type', 'importance']
)

ai_visibility_api_usage_credits = Gauge(
    'ai_visibility_api_usage_credits',
    'API credits consumed',
    ['company_id', 'provider']
)

# System Health Metrics
ai_visibility_system_health = Gauge(
    'ai_visibility_system_health',
    'Overall system health (0-100)',
    ['component']
)

ai_visibility_error_rate = Gauge(
    'ai_visibility_error_rate',
    'Current error rate percentage',
    ['component', 'error_type']
)

# =====================================================
# OpenTelemetry Setup
# =====================================================

class OpenTelemetryConfig:
    """Configure OpenTelemetry for distributed tracing"""
    
    def __init__(
        self,
        service_name: str = "ai-visibility",
        otlp_endpoint: str = "localhost:4317",
        enable_traces: bool = True,
        enable_metrics: bool = True
    ):
        self.service_name = service_name
        self.otlp_endpoint = otlp_endpoint
        self.enable_traces = enable_traces
        self.enable_metrics = enable_metrics
        
        self.tracer = None
        self.meter = None
        
        self._setup()
    
    def _setup(self):
        """Setup OpenTelemetry providers"""
        
        # Create resource
        resource = Resource.create({
            "service.name": self.service_name,
            "service.version": "1.0.0",
            "deployment.environment": "production"
        })
        
        # Setup tracing
        if self.enable_traces:
            # Create tracer provider
            tracer_provider = TracerProvider(resource=resource)
            
            # Add OTLP exporter
            otlp_exporter = OTLPSpanExporter(
                endpoint=self.otlp_endpoint,
                insecure=True
            )
            
            span_processor = BatchSpanProcessor(otlp_exporter)
            tracer_provider.add_span_processor(span_processor)
            
            # Set global tracer provider
            trace.set_tracer_provider(tracer_provider)
            
            # Get tracer
            self.tracer = trace.get_tracer(__name__)
            
            # Auto-instrument libraries
            FastAPIInstrumentor().instrument()
            RedisInstrumentor().instrument()
            Psycopg2Instrumentor().instrument()
            AioHttpClientInstrumentor().instrument()
        
        # Setup metrics
        if self.enable_metrics:
            # Create meter provider with Prometheus exporter
            prometheus_reader = PrometheusMetricReader()
            meter_provider = MeterProvider(
                resource=resource,
                metric_readers=[prometheus_reader]
            )
            
            # Set global meter provider
            metrics.set_meter_provider(meter_provider)
            
            # Get meter
            self.meter = metrics.get_meter(__name__)


# =====================================================
# Monitoring Manager
# =====================================================

class AIVisibilityMonitor:
    """Comprehensive monitoring for AI Visibility system"""
    
    def __init__(self, otel_config: Optional[OpenTelemetryConfig] = None):
        self.otel = otel_config or OpenTelemetryConfig()
        self.start_time = datetime.now()
        
        # Initialize health scores
        self._health_scores = {
            'query_generation': 100,
            'llm_orchestration': 100,
            'response_analysis': 100,
            'cache_system': 100,
            'websocket': 100,
            'database': 100
        }
        
        # Start background health checker
        asyncio.create_task(self._health_check_loop())
    
    # =====================================================
    # Audit Monitoring
    # =====================================================
    
    @contextmanager
    def track_audit(self, audit_id: str, company_id: str):
        """Track complete audit execution"""
        
        span = self.otel.tracer.start_span("audit.execute")
        span.set_attribute("audit.id", audit_id)
        span.set_attribute("company.id", company_id)
        
        start_time = time.time()
        
        try:
            yield span
            
            # Record success
            ai_visibility_audits_total.labels(
                status='success',
                company_id=company_id
            ).inc()
            
            span.set_status(trace.Status(trace.StatusCode.OK))
            
        except Exception as e:
            # Record failure
            ai_visibility_audits_total.labels(
                status='failure',
                company_id=company_id
            ).inc()
            
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise
            
        finally:
            duration = time.time() - start_time
            ai_visibility_audit_duration_seconds.observe(duration)
            span.end()
    
    def record_query_generation(
        self,
        count: int,
        duration: float,
        intent_distribution: Dict[str, int]
    ):
        """Record query generation metrics"""
        
        ai_visibility_query_generation_duration_seconds.observe(duration)
        
        for intent, query_count in intent_distribution.items():
            ai_visibility_queries_generated_total.labels(
                intent=intent,
                complexity='medium'  # Can be enhanced
            ).inc(query_count)
    
    # =====================================================
    # LLM Monitoring
    # =====================================================
    
    def record_llm_request(
        self,
        provider: str,
        model: str,
        response_time: float,
        tokens: Optional[int],
        cache_hit: bool,
        success: bool
    ):
        """Record LLM API request metrics"""
        
        ai_visibility_llm_requests_total.labels(
            provider=provider,
            status='success' if success else 'failure',
            cache_hit=str(cache_hit)
        ).inc()
        
        if success:
            ai_visibility_llm_response_time_seconds.labels(
                provider=provider,
                model=model
            ).observe(response_time)
            
            if tokens:
                ai_visibility_llm_tokens_used_total.labels(
                    provider=provider,
                    model=model
                ).inc(tokens)
    
    def update_circuit_breaker_state(self, provider: str, state: str):
        """Update circuit breaker state"""
        
        state_map = {'closed': 0, 'open': 1, 'half-open': 2}
        ai_visibility_llm_circuit_breaker_state.labels(
            provider=provider
        ).set(state_map.get(state, 0))
    
    def update_provider_health(self, provider: str, health_score: float):
        """Update provider health score"""
        
        ai_visibility_llm_provider_health_score.labels(
            provider=provider
        ).set(health_score)
    
    # =====================================================
    # Response Analysis Monitoring
    # =====================================================
    
    def record_response_analysis(
        self,
        provider: str,
        brand_mentioned: bool,
        sentiment: str,
        duration: float,
        company_id: str
    ):
        """Record response analysis metrics"""
        
        ai_visibility_responses_analyzed_total.labels(
            provider=provider,
            brand_mentioned=str(brand_mentioned),
            sentiment=sentiment
        ).inc()
        
        ai_visibility_analysis_duration_seconds.observe(duration)
        
        # Map sentiment to numeric value
        sentiment_scores = {
            'strongly_positive': 1.0,
            'positive': 0.5,
            'neutral': 0.0,
            'negative': -0.5,
            'strongly_negative': -1.0
        }
        
        score = sentiment_scores.get(sentiment, 0)
        ai_visibility_sentiment_distribution.labels(
            company_id=company_id
        ).observe(score)
    
    def update_brand_metrics(
        self,
        company_id: str,
        mention_rate: float,
        competitive_position: int
    ):
        """Update brand visibility metrics"""
        
        ai_visibility_brand_mention_rate.labels(
            company_id=company_id
        ).set(mention_rate)
        
        ai_visibility_competitive_position.labels(
            company_id=company_id
        ).set(competitive_position)
    
    # =====================================================
    # Cache Monitoring
    # =====================================================
    
    def record_cache_operation(
        self,
        cache_type: str,
        operation: str,
        hit: bool
    ):
        """Record cache operation"""
        
        if hit:
            ai_visibility_cache_hits_total.labels(
                cache_type=cache_type,
                operation=operation
            ).inc()
        else:
            ai_visibility_cache_misses_total.labels(
                cache_type=cache_type,
                operation=operation
            ).inc()
    
    def update_cache_metrics(
        self,
        cache_type: str,
        hit_rate: float,
        size_bytes: int
    ):
        """Update cache metrics"""
        
        ai_visibility_cache_hit_rate.labels(
            cache_type=cache_type
        ).set(hit_rate * 100)
        
        ai_visibility_cache_size_bytes.labels(
            cache_type=cache_type
        ).set(size_bytes)
    
    # =====================================================
    # WebSocket Monitoring
    # =====================================================
    
    def update_websocket_metrics(
        self,
        active_connections: int,
        active_subscriptions: Dict[str, int]
    ):
        """Update WebSocket metrics"""
        
        ai_visibility_websocket_connections_active.set(active_connections)
        
        for audit_id, count in active_subscriptions.items():
            ai_visibility_websocket_subscriptions_active.labels(
                audit_id=audit_id
            ).set(count)
    
    def record_websocket_message(self, event_type: str):
        """Record WebSocket message sent"""
        
        ai_visibility_websocket_messages_sent_total.labels(
            event_type=event_type
        ).inc()
    
    # =====================================================
    # Job Processing Monitoring
    # =====================================================
    
    def record_job_processed(
        self,
        job_type: str,
        status: str,
        duration: float,
        retry_count: int = 0
    ):
        """Record job processing metrics"""
        
        ai_visibility_jobs_processed_total.labels(
            job_type=job_type,
            status=status
        ).inc()
        
        if status == 'success':
            ai_visibility_job_processing_duration_seconds.labels(
                job_type=job_type
            ).observe(duration)
        
        if retry_count > 0:
            ai_visibility_job_retries_total.labels(
                job_type=job_type,
                retry_count=str(retry_count)
            ).inc()
    
    def update_job_queue_metrics(self, queue_metrics: Dict[str, Dict[str, int]]):
        """Update job queue metrics"""
        
        for queue_name, priorities in queue_metrics.items():
            for priority, size in priorities.items():
                ai_visibility_job_queue_size.labels(
                    queue_name=queue_name,
                    priority=priority
                ).set(size)
    
    # =====================================================
    # Business Metrics
    # =====================================================
    
    def record_insight_generated(
        self,
        company_id: str,
        insight_type: str,
        importance: str
    ):
        """Record insight generation"""
        
        ai_visibility_insights_generated_total.labels(
            company_id=company_id,
            insight_type=insight_type,
            importance=importance
        ).inc()
    
    def update_api_usage(
        self,
        company_id: str,
        provider: str,
        credits_used: float
    ):
        """Update API usage metrics"""
        
        ai_visibility_api_usage_credits.labels(
            company_id=company_id,
            provider=provider
        ).inc(credits_used)
    
    def calculate_audit_value(
        self,
        company_id: str,
        mention_rate: float,
        sentiment_score: float,
        insights_count: int
    ) -> float:
        """Calculate and record audit value score"""
        
        # Weighted value calculation
        value_score = (
            mention_rate * 0.4 +
            (sentiment_score + 1) * 25 * 0.3 +  # Normalize -1 to 1 -> 0 to 100
            min(insights_count * 5, 100) * 0.3  # Cap at 100
        )
        
        ai_visibility_audit_value_score.labels(
            company_id=company_id
        ).set(value_score)
        
        return value_score
    
    # =====================================================
    # Health Monitoring
    # =====================================================
    
    async def _health_check_loop(self):
        """Background health check loop"""
        
        while True:
            try:
                await self._check_system_health()
                await asyncio.sleep(30)  # Check every 30 seconds
            except Exception as e:
                logger.error(f"Health check error: {e}")
                await asyncio.sleep(60)
    
    async def _check_system_health(self):
        """Check overall system health"""
        
        # Check each component
        for component in self._health_scores.keys():
            health = await self._check_component_health(component)
            self._health_scores[component] = health
            
            ai_visibility_system_health.labels(
                component=component
            ).set(health)
    
    async def _check_component_health(self, component: str) -> float:
        """Check health of specific component"""
        
        health = 100.0
        
        if component == 'database':
            # Check database connectivity and response time
            try:
                import asyncpg
                conn = await asyncpg.connect(
                    'postgresql://localhost/rankmybrand',
                    timeout=5
                )
                await conn.fetchval('SELECT 1')
                await conn.close()
            except Exception:
                health = 0.0
        
        elif component == 'cache_system':
            # Check Redis connectivity
            try:
                import redis.asyncio as aioredis
                redis = await aioredis.create_redis_pool('redis://localhost')
                await redis.ping()
                redis.close()
                await redis.wait_closed()
            except Exception:
                health = 0.0
        
        elif component == 'llm_orchestration':
            # Check if any providers are healthy
            # This would check circuit breaker states
            health = 80.0  # Placeholder
        
        return health
    
    def get_health_summary(self) -> Dict[str, Any]:
        """Get overall health summary"""
        
        overall_health = sum(self._health_scores.values()) / len(self._health_scores)
        
        return {
            'overall_health': overall_health,
            'components': self._health_scores,
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
            'status': 'healthy' if overall_health > 70 else 'degraded' if overall_health > 30 else 'unhealthy'
        }


# =====================================================
# Decorators for Easy Monitoring
# =====================================================

def monitor_performance(operation_name: str):
    """Decorator to monitor function performance"""
    
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            with trace.get_tracer(__name__).start_as_current_span(operation_name) as span:
                start_time = time.time()
                
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                    
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
                    
                finally:
                    duration = time.time() - start_time
                    span.set_attribute("duration_ms", duration * 1000)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            with trace.get_tracer(__name__).start_as_current_span(operation_name) as span:
                start_time = time.time()
                
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                    
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
                    
                finally:
                    duration = time.time() - start_time
                    span.set_attribute("duration_ms", duration * 1000)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# =====================================================
# Prometheus Metrics Endpoint
# =====================================================

async def metrics_endpoint():
    """Generate Prometheus metrics"""
    return generate_latest()


# Global monitor instance
monitor = AIVisibilityMonitor()

# Aliases for backward compatibility
MetricsCollector = AIVisibilityMonitor
HealthMonitor = AIVisibilityMonitor
