# RankMyBrand Intelligence Engine - Unified Metrics Deployment Guide

## Overview

This document outlines the comprehensive metrics solution implemented for the Intelligence Engine, designed to provide unified monitoring with standardized `rankmybrand_` prefixed metrics that integrate seamlessly with the existing Grafana dashboard.

## ✅ Implementation Summary

### Core Features Implemented

1. **Unified Metrics Module** (`src/monitoring/metrics.py`)
   - All metrics use consistent `rankmybrand_` prefix
   - Supports all dashboard-required metrics
   - Includes business KPI and system health metrics

2. **Automatic HTTP Metrics Collection** (`src/monitoring/middleware.py`)
   - FastAPI middleware for automatic request tracking
   - Records request counts, durations, and error rates
   - Tracks active connections in real-time

3. **Specialized Collectors** (`src/monitoring/integration.py`)
   - LLM API call tracking
   - Database operation monitoring
   - Cache performance metrics
   - Business funnel tracking

4. **Health Integration** (`src/monitoring/health.py`)
   - Integrates system health with metrics
   - Automatic database and Redis metrics
   - Stream lag monitoring

## 📊 Metrics Implemented

### Dashboard-Required Metrics ✅

| Metric Name | Type | Purpose | Dashboard Usage |
|-------------|------|---------|-----------------|
| `rankmybrand_http_requests_total` | Counter | HTTP request counts | Request rate panel |
| `rankmybrand_http_request_duration_seconds` | Histogram | Request latency | Response time percentiles |
| `rankmybrand_geo_score_value` | Gauge | Current GEO scores | Average GEO score gauge |
| `rankmybrand_active_connections` | Gauge | Active connections | Connection count display |
| `rankmybrand_onboarding_funnel` | Gauge | User funnel metrics | Onboarding pie chart |
| `rankmybrand_cache_hit_rate` | Gauge | Cache performance | Cache hit rate gauge |
| `rankmybrand_api_errors_total` | Counter | API error tracking | Error rate panel |
| `rankmybrand_llm_api_calls_total` | Counter | LLM usage tracking | LLM API calls chart |

### Additional Intelligence Engine Metrics ✅

- **AI Processing**: Response processing metrics by platform
- **NLP Models**: Inference time tracking by model
- **Content Analysis**: Content gap detection and scoring
- **System Health**: Memory, CPU, and database metrics
- **Business KPIs**: User registrations, conversions, revenue

## 🚀 Deployment Steps

### 1. Update Application Configuration

The metrics are already integrated into the main applications:

```python
# Already integrated in src/api/main.py and src/main.py
from src.monitoring.middleware import setup_metrics_middleware

app = FastAPI(...)
setup_metrics_middleware(app)  # Automatic HTTP metrics
```

### 2. Prometheus Configuration

The existing Prometheus configuration at `/monitoring/prometheus.yml` already includes the Intelligence Engine:

```yaml
- job_name: 'intelligence-engine'
  static_configs:
    - targets: ['intelligence-engine:8002']
  metrics_path: '/metrics'
  scrape_interval: 10s
```

### 3. Grafana Dashboard

The dashboard at `/monitoring/grafana/dashboards/rankmybrand-overview.json` expects these exact metrics and will work immediately with the new implementation.

### 4. Service Discovery (Production)

For production environments with dynamic service discovery:

```yaml
# Add to prometheus.yml
- job_name: 'intelligence-engine'
  consul_sd_configs:
    - server: 'consul:8500'
      services: ['intelligence-engine']
  relabel_configs:
    - source_labels: [__meta_consul_service]
      target_label: service
    - source_labels: [__meta_consul_service_port]
      target_label: __address__
```

## 🔧 Configuration Options

### Environment Variables

```bash
ENABLE_METRICS=true          # Enable/disable metrics (default: true)
METRICS_PORT=8002           # Port for metrics endpoint
LOG_LEVEL=INFO              # Logging level
SERVICE_PORT=8002           # Service port
```

### Application Configuration

```python
# In src/config.py (if needed)
class Settings:
    enable_metrics: bool = True
    metrics_endpoint: str = "/metrics"
    health_check_interval: int = 30
```

## 🎯 Usage Examples

### Automatic Metrics (No Code Changes Required)

HTTP metrics are collected automatically via middleware:
- Request counts by method/route/status
- Response times and percentiles
- Active connection tracking
- Error rate monitoring

### Manual Metric Collection

```python
from src.monitoring import metrics_collector, llm_metrics, cache_metrics

# Record GEO score
metrics_collector.record_geo_score("acme_corp", "reddit", 85.5)

# Track LLM API call (with decorator)
@llm_metrics.track_api_call(provider="openai", model="gpt-4")
async def call_openai():
    # API call here
    pass

# Cache operations
cache_metrics.record_hit()  # Cache hit
cache_metrics.record_miss()  # Cache miss
```

### Business Metrics

```python
from src.monitoring import business_metrics

# User journey tracking
journey = business_metrics.track_user_journey()
journey['signup']()  # User signed up
journey['subscription']()  # User subscribed

# Subscription conversion
business_metrics.record_subscription_event(
    event_type="conversion",
    from_plan="free", 
    to_plan="pro"
)
```

## 📈 Monitoring & Alerting

### Key Metrics to Monitor

1. **Request Rate**: Sudden spikes or drops
2. **Error Rate**: > 5% error rate
3. **Response Time**: p95 > 2 seconds
4. **Cache Hit Rate**: < 80%
5. **GEO Score**: Average < 60
6. **Active Connections**: > 1000 concurrent

### Prometheus Alerts

Add these rules to `/monitoring/alerts/rules.yml`:

```yaml
groups:
  - name: intelligence-engine
    rules:
      - alert: HighErrorRate
        expr: rate(rankmybrand_api_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in Intelligence Engine"
      
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, sum(rate(rankmybrand_http_request_duration_seconds_bucket[5m])) by (le)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time in Intelligence Engine"
      
      - alert: LowCacheHitRate
        expr: avg(rankmybrand_cache_hit_rate) < 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
```

## 🔍 Troubleshooting

### Metrics Not Appearing in Prometheus

1. Check service is running: `curl http://intelligence-engine:8002/health`
2. Check metrics endpoint: `curl http://intelligence-engine:8002/metrics`
3. Verify Prometheus scrape configuration
4. Check Prometheus targets page for scrape status

### Dashboard Showing No Data

1. Verify metric names match exactly (case-sensitive)
2. Check time range in Grafana
3. Verify Prometheus data source configuration
4. Check for label mismatches in queries

### High Metrics Collection Overhead

1. Reduce scrape frequency if needed
2. Consider metric sampling for high-frequency operations
3. Monitor metrics collection performance itself

## 🔄 Migration from Legacy Metrics

If upgrading from the old metrics system:

1. **Metric Names**: Old metrics without prefix are deprecated
2. **Dashboard Updates**: Grafana dashboard already updated for new metrics
3. **Backward Compatibility**: Old metrics will continue to work during transition
4. **Gradual Migration**: New metrics are additive, old can be removed gradually

### Legacy Metric Mapping

| Legacy Metric | New Metric |
|---------------|------------|
| `ai_responses_processed_total` | `rankmybrand_ai_responses_processed_total` |
| `cache_hit_ratio` | `rankmybrand_cache_hit_rate` |
| `geo_score_distribution` | `rankmybrand_geo_score_distribution` + `rankmybrand_geo_score_value` |

## 📋 Validation

Run the validation script to ensure all metrics are properly configured:

```bash
cd /Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine
python3 src/monitoring/validation.py
```

This will verify:
- All dashboard metrics are implemented
- Metric types are correct
- Labels match dashboard expectations

## 🎉 Success Criteria

### ✅ All Requirements Met

1. **Unified Metrics Module**: Complete with rankmybrand_ prefix
2. **Missing Metrics**: All dashboard-required metrics implemented
3. **Prometheus Integration**: Properly configured and working
4. **Service Discovery**: Ready for production deployment
5. **Grafana Compatibility**: Dashboard queries match exposed metrics
6. **Business KPIs**: Comprehensive tracking of key business metrics
7. **Health Checks**: Integrated with metrics collection
8. **Documentation**: Complete usage and deployment guides

### Ready for Production

The metrics system is now production-ready with:
- Automatic HTTP metrics collection
- Comprehensive error tracking
- Business KPI monitoring
- System health integration
- Grafana dashboard compatibility
- Prometheus alerting support

## 🔗 Related Files

- **Core Implementation**: `/services/intelligence-engine/src/monitoring/`
- **Grafana Dashboard**: `/monitoring/grafana/dashboards/rankmybrand-overview.json`
- **Prometheus Config**: `/monitoring/prometheus.yml`
- **Alert Rules**: `/monitoring/alerts/rules.yml`
- **Documentation**: `/services/intelligence-engine/src/monitoring/README.md`