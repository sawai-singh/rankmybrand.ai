# Search Intelligence Testing & Monitoring Guide

## Overview

This guide provides comprehensive documentation for testing and monitoring the Search Intelligence service in production.

## Testing Strategy

### 1. Unit Tests (>90% Coverage)

#### Core Components
```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- query-generator-v2.test.ts
```

#### Key Test Areas
- **Query Generation**: Mock context, verify query diversity
- **SERP Client**: Mock API responses, test failover
- **Ranking Analyzer**: Test position detection, AI prediction
- **Cache Operations**: Test hit/miss scenarios
- **Cost Calculations**: Verify budget enforcement

### 2. Integration Tests

```bash
# Run integration tests
npm run test:integration

# Test specific workflow
npm run test:integration -- api-integration.test.ts
```

#### Test Scenarios
- Full analysis workflow
- API endpoint responses
- Database operations
- Redis caching behavior
- Error handling paths

### 3. Performance Tests

```bash
# Run load tests
npm run test:load

# Run specific load scenario
npm run test:load -- --scenario=concurrent-analyses

# Generate performance report
npm run test:performance -- --report
```

#### Load Test Scenarios
- 100 concurrent analyses
- Sustained load (60 seconds)
- Burst traffic (200 connections)
- WebSocket scalability (500 connections)

### 4. Cost Control Tests

```bash
# Test budget enforcement
npm run test:budget

# Simulate budget scenarios
node tests/budget-simulation.js --daily-limit=10 --queries=1000
```

## Monitoring Setup

### Prometheus Metrics

#### Available Metrics
```yaml
# Counters
search_intel_searches_total
search_intel_searches_cached
search_intel_searches_failed
search_intel_api_costs_total
search_intel_analyses_started
search_intel_analyses_completed

# Gauges
search_intel_current_daily_spend
search_intel_cache_hit_rate
search_intel_active_analyses
search_intel_queue_size

# Histograms
search_intel_search_duration_seconds
search_intel_analysis_duration_seconds
search_intel_ranking_positions
search_intel_visibility_scores
```

#### Accessing Metrics
```bash
# View raw metrics
curl http://localhost:9090/metrics

# Query specific metric
curl http://localhost:9090/api/v1/query?query=search_intel_cache_hit_rate
```

### Grafana Dashboards

#### Main Dashboard Panels
1. **Daily Spend Gauge**: Current spend vs $10 limit
2. **Cache Hit Rate**: Percentage over time
3. **Active Analyses**: Current processing count
4. **API Success Rate**: 5-minute rolling average
5. **Search Rate by Provider**: Requests per second
6. **Latency Percentiles**: p50, p95, p99
7. **Query Type Distribution**: Pie chart
8. **Visibility Score Distribution**: Histogram
9. **Resource Usage**: CPU and memory
10. **Job Queue Size**: Pending jobs gauge

#### Dashboard Import
```bash
# Import dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -d @monitoring/grafana/dashboards/search-intelligence.json
```

### Alert Configuration

#### Critical Alerts
```yaml
DailyBudgetCritical:
  threshold: 95%
  action: Block new searches
  notification: PagerDuty

AllProvidersDown:
  duration: 1 minute
  action: Failover to backup
  notification: Immediate page

HighErrorRate:
  threshold: >5%
  duration: 10 minutes
  action: Investigation required
  notification: Slack + Email
```

#### Warning Alerts
```yaml
DailyBudgetWarning:
  threshold: 80%
  action: Log warning
  notification: Slack

LowCacheHitRate:
  threshold: <60%
  duration: 30 minutes
  action: Analyze patterns
  notification: Email

SlowQueries:
  threshold: p95 > 5s
  duration: 15 minutes
  action: Performance review
  notification: Slack
```

## Testing Procedures

### Pre-Production Testing

1. **Smoke Tests**
```bash
# Basic functionality
./tests/smoke-test.sh

# Verify endpoints
curl -f http://localhost:3002/health
curl -f http://localhost:3002/api/search-intelligence/analyze -X POST \
  -H "Content-Type: application/json" \
  -d '{"brand": "Test", "domain": "test.com"}'
```

2. **Integration Tests**
```bash
# Full workflow test
npm run test:e2e

# API contract tests
npm run test:contract
```

3. **Performance Baseline**
```bash
# Establish baseline metrics
npm run benchmark -- --save baseline.json

# Compare with baseline
npm run benchmark -- --compare baseline.json
```

### Production Testing

1. **Canary Testing**
```bash
# Deploy to 10% of traffic
./scripts/canary-deploy.sh 0.1

# Monitor metrics
watch -n 5 'curl -s http://localhost:9090/metrics | grep error_rate'

# Rollback if needed
./scripts/canary-rollback.sh
```

2. **A/B Testing**
```javascript
// Feature flag for new algorithm
if (featureFlags.get('enhanced-ai-prediction')) {
  return analyzerV3.predict(rankings);
} else {
  return analyzerV2.predict(rankings);
}
```

## Monitoring Procedures

### Daily Monitoring

1. **Budget Check**
```bash
# Check current spend
curl http://localhost:3002/api/admin/budget-status

# Project monthly spend
node scripts/project-monthly-spend.js
```

2. **Error Analysis**
```bash
# Recent errors
tail -n 1000 /var/log/search-intel/error.log | grep ERROR

# Error patterns
grep "ERROR" /var/log/search-intel/error.log | awk '{print $5}' | sort | uniq -c
```

3. **Performance Review**
```sql
-- Slow queries
SELECT query, AVG(duration_ms) as avg_duration, COUNT(*) as count
FROM search_queries
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY query
HAVING AVG(duration_ms) > 5000
ORDER BY avg_duration DESC;
```

### Weekly Monitoring

1. **Cache Efficiency**
```bash
# Analyze cache performance
node scripts/cache-analysis.js --days 7

# Identify cache misses
redis-cli --scan --pattern "miss:*" | head -20
```

2. **Cost Optimization**
```bash
# Provider cost analysis
node scripts/analyze-provider-costs.js --week

# Identify expensive queries
node scripts/expensive-queries.js --top 20
```

### Monthly Monitoring

1. **Trend Analysis**
```bash
# Generate monthly report
node scripts/monthly-report.js --month 2025-08

# Trend visualization
python scripts/visualize-trends.py --metric visibility_score
```

2. **Capacity Planning**
```bash
# Growth projection
node scripts/capacity-planning.js --months 3

# Resource recommendations
node scripts/resource-optimizer.js
```

## Performance Benchmarks

### Target Metrics
- **Query Generation**: <100ms
- **Cache Hit Rate**: >60%
- **API Success Rate**: >99.5%
- **P95 Latency**: <5s
- **Memory per Analysis**: <100MB
- **Concurrent Analyses**: 100+

### Benchmark Tests
```bash
# Run all benchmarks
npm run benchmark:all

# Specific benchmark
npm run benchmark:query-generation

# Compare versions
npm run benchmark:compare v1.2.2 v1.2.3
```

## Troubleshooting Guide

### Common Issues

1. **High Memory Usage**
```bash
# Check for memory leaks
node --expose-gc scripts/memory-test.js

# Analyze heap
node --inspect src/index.js
# Chrome DevTools → Memory → Take Heap Snapshot
```

2. **Slow API Responses**
```bash
# Profile CPU usage
node --prof src/index.js
node --prof-process isolate-*.log > profile.txt

# Trace slow operations
NODE_OPTIONS="--trace-warnings" npm start
```

3. **Cache Misses**
```bash
# Debug cache keys
redis-cli MONITOR | grep GET

# Check cache configuration
node scripts/verify-cache-config.js
```

## Security Monitoring

### Security Checks
```bash
# Dependency vulnerabilities
npm audit

# Security headers
curl -I http://localhost:3002/api/health | grep -E "(X-Frame-Options|X-Content-Type|Strict-Transport)"

# Rate limiting test
ab -n 1000 -c 100 http://localhost:3002/api/health
```

### Audit Logging
```bash
# View security events
grep "SECURITY" /var/log/search-intel/audit.log

# Failed authentication attempts
grep "AUTH_FAILED" /var/log/search-intel/audit.log | tail -20
```

## Automation Scripts

### Monitoring Automation
```bash
# Setup monitoring
./scripts/setup-monitoring.sh

# Configure alerts
./scripts/configure-alerts.sh --env production

# Test alert delivery
./scripts/test-alerts.sh
```

### Report Generation
```bash
# Daily report
0 9 * * * /opt/search-intel/scripts/daily-report.sh

# Weekly performance report
0 9 * * 1 /opt/search-intel/scripts/weekly-performance.sh

# Monthly cost report
0 9 1 * * /opt/search-intel/scripts/monthly-costs.sh
```

## Best Practices

### Testing
1. Always run tests before deployment
2. Maintain >90% code coverage
3. Test error scenarios explicitly
4. Use realistic test data
5. Monitor test execution time

### Monitoring
1. Set up alerts before issues occur
2. Use dashboards for visual monitoring
3. Automate routine checks
4. Keep historical data for trends
5. Document all custom metrics

### Performance
1. Profile before optimizing
2. Set clear SLA targets
3. Monitor continuously
4. Plan for growth
5. Regular load testing

## Appendix

### Useful Commands
```bash
# Quick health check
curl -s http://localhost:3002/health | jq .

# Current metrics summary
curl -s http://localhost:9090/metrics | grep -E "^search_intel_" | grep -v "#"

# Active analyses
curl -s http://localhost:3002/api/admin/active-analyses | jq .

# Cache stats
redis-cli INFO stats | grep -E "(hit|miss)"

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'search-intelligence';"
```

### References
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboard Guide](https://grafana.com/docs/grafana/latest/dashboards/)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Redis Monitoring](https://redis.io/docs/manual/admin/)