# Production Deployment Checklist for RankMyBrand.ai

## 🚀 Pre-Deployment Checklist

### 1. Environment Variables
- [ ] All `.env` files configured with production values
- [ ] API keys for all services (OpenAI, Anthropic, Google, Perplexity)
- [ ] Database credentials secured
- [ ] Redis password set
- [ ] JWT secrets rotated
- [ ] Webhook URLs configured

### 2. Database Migrations
```bash
# Run all migrations in order
psql -d rankmybrand -f database/schema.sql
psql -d rankmybrand -f migrations/003_enhanced_company_tracking_fixed.sql
psql -d rankmybrand -f migrations/005_add_user_onboarding_system_improved.sql
psql -d rankmybrand -f services/intelligence-engine/migrations/add_geo_sov_columns_adapted.sql
psql -d rankmybrand -f api-gateway/migrations/optimize_geo_sov_queries.sql
psql -d rankmybrand -f api-gateway/populate-score-persistence.sql
```

### 3. Service Dependencies
- [ ] PostgreSQL 14+ running
- [ ] Redis 6+ running with authentication
- [ ] Node.js 18+ installed
- [ ] Python 3.9+ installed
- [ ] All npm packages installed (`npm install` in each service)
- [ ] All Python packages installed (`pip install -r requirements.txt`)

## 🔧 Service Startup Order

```bash
# 1. Start infrastructure
docker-compose up -d postgres redis prometheus grafana

# 2. Start core services
npm run start:api-gateway    # Port 4000
npm run start:websocket      # Port 8001
python main.py               # Port 8002 (intelligence-engine)

# 3. Start UI
npm run start:dashboard      # Port 3000
npm run start:frontend       # Port 3003

# 4. Optional services
npm run start:action-center  # Port 8082
```

## ✅ Health Checks

### Service Health Endpoints
```bash
# API Gateway
curl http://localhost:4000/health

# Intelligence Engine
curl http://localhost:8002/health

# WebSocket Server
curl http://localhost:8001/health

# Dashboard
curl http://localhost:3000/api/health
```

### Database Connectivity
```bash
# Check PostgreSQL
psql -d rankmybrand -c "SELECT COUNT(*) FROM companies;"

# Check Redis
redis-cli ping

# Check materialized views
psql -d rankmybrand -c "SELECT COUNT(*) FROM dashboard_metrics_cache;"
```

## 🧪 Smoke Tests

### 1. Complete Workflow Test
```bash
node api-gateway/test-multiple-companies.js
```
Expected: All 5 companies process successfully

### 2. Cache Performance Test
```bash
node api-gateway/test-cache.js
```
Expected: 1000x+ speed improvement on cached lookups

### 3. Error Handling Test
```bash
node api-gateway/test-error-handling.js
```
Expected: All critical tests pass

### 4. Score Persistence Test
```bash
node api-gateway/test-score-persistence.js
```
Expected: Scores persist across restarts

### 5. Webhook Test
```bash
node api-gateway/test-webhooks.js
```
Expected: Webhooks fire on score events

## 📊 Monitoring Setup

### Prometheus Targets
```yaml
scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:4000']
  
  - job_name: 'intelligence-engine'
    static_configs:
      - targets: ['localhost:8002']
```

### Grafana Dashboards
1. Import dashboard from `/monitoring/dashboards/geo-sov-metrics.json`
2. Set up alerts for:
   - Service downtime
   - High error rates
   - Slow response times
   - Low cache hit rates

## 🔒 Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] Database user has minimal required permissions
- [ ] Redis authentication enabled
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled on all endpoints
- [ ] SQL injection protection verified
- [ ] XSS protection headers set

## 🌐 Production Configuration

### Nginx Configuration
```nginx
upstream api_gateway {
    server localhost:4000;
}

upstream dashboard {
    server localhost:3000;
}

server {
    listen 80;
    server_name rankmybrand.ai;

    location /api {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://dashboard;
        proxy_set_header Host $host;
    }
}
```

### SSL/TLS Setup
```bash
# Using Let's Encrypt
certbot --nginx -d rankmybrand.ai -d www.rankmybrand.ai
```

## 📈 Performance Targets

- [ ] Company lookup: <10ms (cached)
- [ ] Dashboard load: <200ms
- [ ] Full audit completion: <5 minutes
- [ ] WebSocket latency: <100ms
- [ ] API response time p95: <500ms
- [ ] Cache hit rate: >80%

## 🔄 Rollback Plan

1. **Database Rollback**
```sql
-- Save rollback scripts in migrations folder
-- Each migration has a corresponding rollback
```

2. **Service Rollback**
```bash
# Tag current version
git tag -a v2.0.0 -m "GEO/SOV Integration"

# If rollback needed
git checkout v1.0.0
npm install
pm2 restart all
```

3. **Data Backup**
```bash
# Backup before deployment
pg_dump rankmybrand > backup_$(date +%Y%m%d).sql

# Restore if needed
psql rankmybrand < backup_20250822.sql
```

## 🎯 Post-Deployment Verification

### Functional Tests
- [ ] User can enter email and reach dashboard
- [ ] GEO/SOV scores calculate correctly
- [ ] Dashboard displays all metrics
- [ ] WebSocket updates work in real-time
- [ ] Webhooks fire on events
- [ ] Feedback system accepts submissions

### Performance Tests
- [ ] Load test with 100 concurrent users
- [ ] Verify cache hit rates >80%
- [ ] Check database query times <100ms
- [ ] Confirm no memory leaks after 24 hours

### Business Metrics
- [ ] Track user onboarding completion rate
- [ ] Monitor average audit completion time
- [ ] Check score calculation accuracy
- [ ] Review feedback submissions

## 📝 Documentation Updates

- [ ] Update API documentation with GEO/SOV fields
- [ ] Add webhook integration guide
- [ ] Update user guide with score explanations
- [ ] Create troubleshooting guide for support team
- [ ] Document monitoring and alerting setup

## ✅ Sign-off Checklist

- [ ] Development team approval
- [ ] QA team verification
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Backup strategy confirmed
- [ ] Rollback plan tested
- [ ] Monitoring alerts configured
- [ ] Support team trained

## 🚀 Go-Live Steps

1. **Maintenance Mode**
```bash
# Enable maintenance page
touch /var/www/maintenance.flag
```

2. **Deploy Services**
```bash
# Use deployment script
./scripts/deployment/deploy-production.sh
```

3. **Verify Health**
```bash
# Run health check script
./scripts/utilities/health-check-all.sh
```

4. **Remove Maintenance Mode**
```bash
rm /var/www/maintenance.flag
```

5. **Monitor for 30 minutes**
- Check error logs
- Monitor performance metrics
- Verify user traffic

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Version:** 2.0.0  
**Status:** ⬜ Pending | ⬜ In Progress | ⬜ Complete