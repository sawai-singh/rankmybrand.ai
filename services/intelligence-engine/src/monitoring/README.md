# RankMyBrand Intelligence Engine Metrics

This directory contains the unified metrics collection system for the Intelligence Engine. All metrics follow the `rankmybrand_` naming convention and are designed to integrate seamlessly with the Grafana dashboard.

## Architecture

### Core Components

1. **metrics.py** - Unified metrics definitions with rankmybrand_ prefix
2. **middleware.py** - FastAPI middleware for automatic HTTP metrics collection
3. **integration.py** - Specialized collectors for different components
4. **health.py** - Health checks with metrics integration

### Metric Categories

#### HTTP Metrics (Required by Grafana Dashboard)
- `rankmybrand_http_requests_total` - Total HTTP requests by method, route, status code
- `rankmybrand_http_request_duration_seconds` - Request duration histograms
- `rankmybrand_active_connections` - Current active connections
- `rankmybrand_api_errors_total` - API errors by endpoint and type

#### Business KPI Metrics
- `rankmybrand_geo_score_value` - Current GEO scores by brand/platform
- `rankmybrand_onboarding_funnel` - User funnel metrics by stage
- `rankmybrand_cache_hit_rate` - Cache hit rate percentage
- `rankmybrand_llm_api_calls_total` - LLM API usage by provider/model

#### Intelligence Engine Specific Metrics
- `rankmybrand_ai_responses_processed_total` - AI responses processed
- `rankmybrand_ai_processing_duration_seconds` - Processing time histograms
- `rankmybrand_nlp_model_inference_duration_seconds` - NLP inference times
- `rankmybrand_content_gaps_detected_total` - Content gaps detected

#### System Health Metrics
- `rankmybrand_database_connections` - DB connection pool metrics
- `rankmybrand_memory_usage_bytes` - Memory usage by component
- `rankmybrand_cpu_usage_percent` - CPU usage by component
- `rankmybrand_redis_stream_lag` - Redis stream lag metrics

## Usage Examples

### Basic Setup

```python
from src.monitoring import setup_metrics_middleware, initialize_metrics
from fastapi import FastAPI

app = FastAPI()

# Setup automatic HTTP metrics collection
setup_metrics_middleware(app)

# Initialize metrics with default values
initialize_metrics()
```

### LLM API Calls

```python
from src.monitoring import llm_metrics

@llm_metrics.track_api_call(provider="openai", model="gpt-4")
async def call_openai_api():
    # Your OpenAI API call here
    pass
```

### Database Operations

```python
from src.monitoring import db_metrics

@db_metrics.track_operation(table="processed_responses", operation="insert")
async def save_response(response_data):
    # Your database operation here
    pass
```

### Cache Operations

```python
from src.monitoring import cache_metrics

# Record cache operations
cache_metrics.record_hit()  # Cache hit
cache_metrics.record_miss()  # Cache miss
cache_metrics.record_set(success=True)  # Cache set
```

### Processing Metrics

```python
from src.monitoring import processing_metrics

@processing_metrics.track_response_processing(platform="reddit")
async def process_reddit_response(response):
    # Your processing logic here
    pass
```

### Business Metrics

```python
from src.monitoring import business_metrics

# Track user journey
journey = business_metrics.track_user_journey()
journey['signup']()  # User signed up
journey['verification']()  # User verified email

# Track subscription events
business_metrics.record_subscription_event(
    event_type="conversion",
    from_plan="free",
    to_plan="pro"
)
```

### Manual Metric Recording

```python
from src.monitoring import metrics_collector

# Record GEO score
metrics_collector.record_geo_score(
    brand="acme_corp",
    platform="reddit",
    score=85.5
)

# Record content gap
metrics_collector.record_content_gap(
    brand="acme_corp",
    gap_type="product_mention"
)

# Set active connections
metrics_collector.set_active_connections(42)
```

## Grafana Dashboard Integration

The metrics are designed to work with the existing Grafana dashboard at `/monitoring/grafana/dashboards/rankmybrand-overview.json`. Key mappings:

### Dashboard Panel → Metric
- **Request Rate** → `rate(rankmybrand_http_requests_total[5m])`
- **Average GEO Score** → `avg(rankmybrand_geo_score_value)`
- **Active Connections** → `rankmybrand_active_connections`
- **Response Time (95th percentile)** → `histogram_quantile(0.95, sum(rate(rankmybrand_http_request_duration_seconds_bucket[5m])) by (le, route))`
- **Onboarding Funnel** → `sum(rankmybrand_onboarding_funnel) by (stage)`
- **Cache Hit Rate** → `avg(rankmybrand_cache_hit_rate)`
- **Error Rate** → `rate(rankmybrand_api_errors_total[5m])`
- **LLM API Calls** → `sum(rate(rankmybrand_llm_api_calls_total[5m])) by (provider, model)`

## Prometheus Configuration

The Prometheus configuration at `/monitoring/prometheus.yml` includes the Intelligence Engine job:

```yaml
- job_name: 'intelligence-engine'
  static_configs:
    - targets: ['intelligence-engine:8002']
  metrics_path: '/metrics'
  scrape_interval: 10s
```

## Service Discovery

For production deployments, consider using Prometheus service discovery:

```yaml
- job_name: 'intelligence-engine'
  consul_sd_configs:
    - server: 'consul:8500'
      services: ['intelligence-engine']
  relabel_configs:
    - source_labels: [__meta_consul_service]
      target_label: service
    - source_labels: [__meta_consul_service_port]
      target_label: __address__
      replacement: '${1}'
```

## Health Checks

The health checker automatically updates relevant metrics:

- Stream lag metrics from Redis
- Database connection pool metrics
- System resource usage

Health endpoints:
- `/health` - Comprehensive health check
- `/ready` - Readiness probe
- `/live` - Liveness probe
- `/metrics` - Prometheus metrics endpoint

## Best Practices

1. **Use Decorators** - Leverage the specialized decorators for automatic metric collection
2. **Label Consistency** - Use consistent label values across metrics
3. **Error Handling** - Always record errors with appropriate error types
4. **Performance** - Metrics collection is designed to be low-overhead
5. **Monitoring** - Monitor the metrics system itself via Prometheus alerts

## Troubleshooting

### Missing Metrics
- Ensure middleware is properly configured
- Check that metrics are being recorded in application code
- Verify Prometheus is scraping the `/metrics` endpoint

### Incorrect Values
- Check label consistency between metric recording and dashboard queries
- Verify metric types (Counter vs Gauge vs Histogram)
- Ensure proper metric initialization

### Performance Issues
- Monitor metrics collection overhead
- Consider sampling for high-frequency operations
- Use appropriate histogram buckets

## Configuration

Metrics can be disabled via environment variables:

```bash
ENABLE_METRICS=false  # Disable metrics collection
METRICS_PORT=8002     # Change metrics port
```

## Migration from Legacy Metrics

If migrating from the old metrics system:

1. Replace metric names with rankmybrand_ prefixed versions
2. Update Grafana dashboard queries
3. Ensure label consistency
4. Test metric collection and dashboard functionality

## Development

When adding new metrics:

1. Define metric in `metrics.py` with `rankmybrand_` prefix
2. Add recording methods to `MetricsCollector`
3. Create specialized collector in `integration.py` if needed
4. Update Grafana dashboard if required
5. Document usage in this README