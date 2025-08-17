# RankMyBrand Monitoring Stack

## Overview
Complete monitoring solution for RankMyBrand using Prometheus, Grafana, and AlertManager.

## Quick Start

### Launch Monitoring
```bash
cd monitoring
./launch-monitoring.sh
```

### Access Dashboards
- **Grafana**: http://localhost:3006 (admin/rankmybrand123)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   GRAFANA                        │
│            http://localhost:3006                 │
│         (Visualization & Dashboards)             │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                 PROMETHEUS                       │
│            http://localhost:9090                 │
│          (Metrics Collection & Storage)          │
└──────┬────────────────────────────────┬─────────┘
       │                                │
┌──────┴──────────┐            ┌───────┴─────────┐
│   EXPORTERS     │            │  ALERTMANAGER   │
│  Node/Redis/PG  │            │  localhost:9093 │
└─────────────────┘            └─────────────────┘
       │
┌──────┴──────────────────────────────────────────┐
│              APPLICATION SERVICES                │
│  API Gateway | Dashboard | Intelligence Engine   │
└──────────────────────────────────────────────────┘
```

## Metrics Collected

### Application Metrics
- **HTTP Metrics**
  - Request rate by endpoint
  - Response time (p50, p95, p99)
  - Error rates
  - Active connections

- **Business Metrics**
  - GEO scores
  - Onboarding funnel
  - Competitor analysis duration
  - LLM API usage

- **Performance Metrics**
  - Database query duration
  - Cache hit rates
  - WebSocket connections
  - Token usage

### System Metrics
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Container stats

## Dashboards

### 1. RankMyBrand Overview
Main operational dashboard showing:
- Request rates and latencies
- Error rates
- GEO score trends
- Onboarding funnel
- Active users

### 2. System Performance
Infrastructure monitoring:
- CPU/Memory/Disk usage
- Container health
- Database performance
- Redis metrics

### 3. Business Intelligence
Business KPIs:
- User acquisition
- Onboarding conversion
- Feature adoption
- API usage trends

## Alerts

### Critical Alerts
- Service down (1 minute)
- Database connection failures
- Disk space < 10%
- Redis/PostgreSQL down

### Warning Alerts
- High error rate (> 5%)
- High response time (> 2s p95)
- High CPU usage (> 80%)
- High memory usage (> 90%)
- Low cache hit rate (< 50%)

### Info Alerts
- Low GEO scores (< 50)
- High onboarding drop-off (> 70%)
- Unusual traffic patterns

## Configuration

### Adding New Metrics

1. **In Application Code** (Node.js):
```typescript
import { metrics } from './middleware/metrics.middleware';

// Record custom metric
metrics.recordGeoCalculation('success');
metrics.updateGeoScore('company', 'domain', 85.5);
```

2. **In Prometheus Config**:
```yaml
scrape_configs:
  - job_name: 'new-service'
    static_configs:
      - targets: ['new-service:port']
    metrics_path: '/metrics'
```

3. **In Grafana**:
- Import dashboard JSON
- Create new panels
- Set up alerts

### Custom Dashboards

Create new dashboard JSON in `grafana/dashboards/`:
```json
{
  "title": "Custom Dashboard",
  "panels": [...],
  "tags": ["rankmybrand", "custom"]
}
```

## Maintenance

### Backup Grafana Dashboards
```bash
docker exec rankmybrand-grafana \
  grafana-cli admin export-dashboard \
  --output=/var/lib/grafana/dashboards/backup.json
```

### Update Prometheus Rules
```bash
# Edit alerts/rules.yml
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.monitoring.yml logs -f

# Specific service
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

### Clean Up Data
```bash
# Stop and remove volumes
docker-compose -f docker-compose.monitoring.yml down -v
```

## Troubleshooting

### Grafana Can't Connect to Prometheus
- Check Prometheus is running: `curl http://localhost:9090/-/healthy`
- Verify datasource config in Grafana UI
- Check Docker network: `docker network ls`

### No Metrics Showing
- Verify exporters are running
- Check application `/metrics` endpoints
- Review Prometheus targets: http://localhost:9090/targets

### Alerts Not Firing
- Check AlertManager config
- Verify alert rules syntax
- Review AlertManager UI: http://localhost:9093

### High Memory Usage
- Adjust retention in `prometheus.yml`
- Reduce scrape frequency
- Limit stored metrics

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Check Metrics Endpoint
  run: |
    curl -f http://localhost:4000/metrics || exit 1
```

### Health Checks
```bash
# Add to deployment scripts
curl -f http://localhost:9090/-/healthy
curl -f http://localhost:3006/api/health
```

## Security Considerations

1. **Change Default Passwords**
   - Grafana admin password
   - AlertManager SMTP credentials

2. **Restrict Access**
   - Use firewall rules
   - Implement authentication proxy
   - Enable HTTPS

3. **Sensitive Data**
   - Don't expose sensitive metrics
   - Mask personal information
   - Rotate credentials regularly

## Performance Tuning

### Prometheus
```yaml
global:
  scrape_interval: 30s  # Reduce frequency
  evaluation_interval: 30s
storage:
  tsdb:
    retention.time: 15d  # Reduce retention
    retention.size: 10GB
```

### Grafana
```ini
[database]
max_open_conn = 25
max_idle_conn = 25

[rendering]
concurrent_render_limit = 5
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)