# Search Intelligence Service - Production Runbook

## Table of Contents
1. [Service Overview](#service-overview)
2. [Architecture](#architecture)
3. [Deployment](#deployment)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Troubleshooting](#troubleshooting)
6. [Performance Tuning](#performance-tuning)
7. [Disaster Recovery](#disaster-recovery)
8. [Maintenance Procedures](#maintenance-procedures)

## Service Overview

The Search Intelligence Service analyzes brand visibility in search results and predicts likelihood of appearing in AI-generated responses.

### Key Components
- **Query Generator v2**: Generates 10-20 intelligent search queries
- **SERP Client v2**: Multi-provider search API client with failover
- **Ranking Analyzer v2**: Analyzes search results and predicts AI visibility
- **Job Queue**: Background processing with Bull queue
- **Cache Layer**: Redis-based caching with compression

### Service Dependencies
- PostgreSQL (primary database)
- Redis (cache and job queue)
- SERP API Providers (SerpAPI, ValueSERP, ScaleSERP)
- Web Crawler Service (integration)

## Architecture

### System Architecture
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Fastify   │────▶│ Job Queue    │────▶│ SERP APIs   │
│   API       │     │ (Bull/Redis) │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                     │
       ▼                    ▼                     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ PostgreSQL  │     │    Redis     │     │ Prometheus  │
│  Database   │     │    Cache     │     │  Metrics    │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Data Flow
1. API receives analysis request
2. Job created in Bull queue
3. Query Generator creates search queries
4. SERP Client fetches results (with caching)
5. Ranking Analyzer processes results
6. Results stored in PostgreSQL
7. WebSocket updates sent to client

## Deployment

### Pre-Deployment Checklist
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] API documentation updated
- [ ] Monitoring alerts configured

### Deployment Process
```bash
# Production deployment
./scripts/deploy.sh production v1.2.3

# Staging deployment
./scripts/deploy.sh staging latest
```

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/search_intel
REDIS_URL=redis://user:pass@host:6379
SERPAPI_KEY=xxx
VALUESERP_KEY=xxx
SCALESERP_KEY=xxx

# Optional
PORT=3002
NODE_ENV=production
LOG_LEVEL=info
SERPAPI_DAILY_LIMIT=1000
SERPAPI_MONTHLY_LIMIT=30000
```

### Zero-Downtime Deployment
1. New instance starts on port 3003
2. Health check validates new instance
3. Load balancer updated to new instance
4. Old instance gracefully shuts down
5. New instance moves to port 3002

## Monitoring & Alerts

### Key Metrics
- **API Success Rate**: Target >99.5%
- **Cache Hit Rate**: Target >60%
- **P95 Latency**: Target <5s
- **Daily Spend**: Alert at 80% of $10 limit
- **Error Rate**: Alert if >5%

### Grafana Dashboards
- **Search Intelligence Overview**: `http://grafana.internal/d/search-intel-001`
- **API Performance**: Real-time request metrics
- **Cost Tracking**: Budget usage and projections
- **Resource Usage**: CPU, memory, connections

### Critical Alerts
1. **Budget Exceeded**: Daily spend >$9.50
2. **All Providers Down**: No SERP APIs available
3. **High Error Rate**: >5% failures over 10 minutes
4. **Stuck Analyses**: No completions in 30 minutes
5. **Database Connection Issues**: Connection pool exhausted

## Troubleshooting

### Common Issues

#### High API Failure Rate
```bash
# Check provider status
curl http://localhost:3002/api/admin/provider-status

# View error logs
tail -f /var/log/search-intel/error.log | grep "SERP"

# Check circuit breaker status
redis-cli get "circuit:serpapi:status"
```

#### Low Cache Hit Rate
```bash
# Analyze cache misses
node scripts/analyze-cache.js

# Manually warm cache
node scripts/warm-cache.js

# Check cache size
redis-cli info memory
```

#### Slow Queries
```bash
# Check database slow query log
psql -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"

# Analyze query plans
EXPLAIN ANALYZE SELECT * FROM search_rankings WHERE ...

# Check indexes
\d search_rankings
```

#### Memory Leaks
```bash
# Generate heap snapshot
kill -USR2 <pid>

# Analyze with Chrome DevTools
node --inspect=0.0.0.0:9229 src/index.js

# Monitor memory over time
pm2 monit
```

### Debug Commands
```bash
# Test SERP provider
curl -X POST http://localhost:3002/api/admin/test-provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "serpapi", "query": "test"}'

# Force cache clear
curl -X POST http://localhost:3002/api/admin/clear-cache

# Get analysis details
curl http://localhost:3002/api/admin/analysis/<id>/debug
```

## Performance Tuning

### Database Optimization
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_search_rankings_domain_created 
ON search_rankings(domain, created_at DESC);

-- Vacuum and analyze
VACUUM ANALYZE search_rankings;

-- Update statistics
ANALYZE;
```

### Redis Optimization
```bash
# Set max memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Enable compression
redis-cli CONFIG SET save ""
redis-cli CONFIG SET rdbcompression yes

# Optimize for latency
redis-cli CONFIG SET tcp-nodelay yes
redis-cli CONFIG SET tcp-keepalive 60
```

### Application Tuning
```javascript
// config/production.json adjustments
{
  "searchIntelligence": {
    "optimization": {
      "batchSize": 20,        // Increase for throughput
      "parallelQueries": 10,  // Increase for speed
      "cachePrewarm": true
    },
    "queues": {
      "concurrency": 10,      // More workers
      "stalledInterval": 30000 // Faster detection
    }
  }
}
```

## Disaster Recovery

### Backup Procedures
```bash
# Database backup (daily)
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Redis backup (hourly)
redis-cli BGSAVE

# Configuration backup
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/
```

### Recovery Procedures

#### Database Recovery
```bash
# Restore from backup
gunzip < backup_20250805.sql.gz | psql $DATABASE_URL

# Verify integrity
psql -c "SELECT COUNT(*) FROM search_analyses"
```

#### Redis Recovery
```bash
# Restore from RDB
cp dump.rdb /var/lib/redis/
redis-cli SHUTDOWN
redis-server /etc/redis/redis.conf

# Verify
redis-cli PING
```

#### Full Service Recovery
```bash
# 1. Restore database
./scripts/restore-db.sh backup_20250805.sql.gz

# 2. Restore Redis
./scripts/restore-redis.sh dump.rdb

# 3. Deploy latest stable version
./scripts/deploy.sh production v1.2.2

# 4. Validate
./scripts/post-deploy-check.sh
```

## Maintenance Procedures

### Daily Tasks
- [ ] Check budget usage
- [ ] Review error logs
- [ ] Verify backup completion
- [ ] Check queue sizes

### Weekly Tasks
- [ ] Analyze cache efficiency
- [ ] Review slow queries
- [ ] Update provider costs
- [ ] Clean old job data

### Monthly Tasks
- [ ] Database vacuum full
- [ ] Redis memory analysis
- [ ] Security updates
- [ ] Performance review

### Maintenance Scripts
```bash
# Clean old data (>30 days)
node scripts/cleanup-old-data.js --days 30

# Optimize database
./scripts/optimize-db.sh

# Update provider costs
node scripts/update-provider-costs.js

# Generate performance report
node scripts/performance-report.js --month 2025-08
```

## Emergency Contacts

- **On-Call Engineer**: Check PagerDuty
- **Database Admin**: dba@rankmybrand.ai
- **Security Team**: security@rankmybrand.ai
- **SERP API Support**:
  - SerpAPI: support@serpapi.com
  - ValueSERP: help@valueserp.com
  - ScaleSERP: support@scaleserp.com

## Appendix

### Useful Queries

```sql
-- Top queries by volume
SELECT query, COUNT(*) as count 
FROM search_rankings 
GROUP BY query 
ORDER BY count DESC 
LIMIT 10;

-- Average visibility by domain
SELECT domain, AVG(visibility_score) as avg_score
FROM search_analyses
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY domain
ORDER BY avg_score DESC;

-- API usage by provider
SELECT provider, SUM(cost) as total_cost, COUNT(*) as requests
FROM api_requests
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY provider;
```

### Performance Benchmarks
- Query Generation: <100ms for 20 queries
- SERP API Call: <5s per query (cached: <50ms)
- Analysis Completion: <5 minutes for 20 queries
- Memory Usage: <500MB per analysis
- CPU Usage: <70% under full load