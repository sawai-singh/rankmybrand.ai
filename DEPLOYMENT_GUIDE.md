# RankMyBrand.ai Professional Deployment Guide

## Architecture Overview

The platform follows a **microservices architecture** with the following design principles:
- **Containerization**: All services run in Docker containers with Python 3.12 for compatibility
- **Service Mesh**: Internal Docker network for service discovery
- **Health Monitoring**: Built-in health checks with automatic restarts
- **Scalability**: Horizontal scaling support via Docker Compose
- **Observability**: Prometheus + Grafana for monitoring

## Quick Start

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
brew install docker docker-compose

# Verify installations
docker --version
docker-compose --version
```

### 2. Deploy Platform
```bash
# Full deployment with single command
make deploy

# Or step by step:
make build  # Build all images
make up     # Start services
make test   # Run tests
```

### 3. Access Services
- **Frontend**: http://localhost:3003
- **Dashboard**: http://localhost:3000
- **API Gateway**: http://localhost:4000
- **Monitoring**: http://localhost:3005 (Grafana)

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend Layer                       │
├─────────────────┬───────────────────────────────────────────┤
│   Dashboard     │        Revolutionary Frontend              │
│   Port: 3000    │            Port: 3003                      │
└─────────────────┴───────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                      API Gateway Layer                       │
├──────────────────────────────────────────────────────────────┤
│                    API Gateway (Port: 4000)                  │
│                 WebSocket Server (Port: 3001)                │
└───────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                     Microservices Layer                      │
├────────────────┬─────────────┬──────────────┬───────────────┤
│ GEO Calculator │ Intelligence│ Action Center│ AI Monitor    │
│   Port: 8000   │  Port: 8002 │  Port: 8082  │  Port: 8001   │
├────────────────┴─────────────┴──────────────┴───────────────┤
│                  Web Crawler (Port: 3002)                    │
└───────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                       Data Layer                             │
├────────────────────────┬─────────────────────────────────────┤
│    PostgreSQL (5432)   │        Redis (6379)                 │
└────────────────────────┴─────────────────────────────────────┘
```

## Management Commands

### Basic Operations
```bash
make up         # Start all services
make down       # Stop all services
make restart    # Restart services
make status     # Check service health
make logs       # View all logs
make clean      # Clean up everything
```

### Service-Specific
```bash
make logs-geo   # GEO Calculator logs
make logs-api   # API Gateway logs
make shell-geo  # Access GEO container
make shell-postgres  # Database console
```

### Production
```bash
make prod-deploy  # Production deployment
make backup       # Backup database
make monitor      # Monitor resources
```

## Environment Configuration

### Development
```bash
cp .env.example .env
# Edit .env with your settings
```

### Production
```bash
cp .env.production .env
# Add API keys and secrets
make prod-deploy
```

## Scaling Strategy

### Horizontal Scaling
```yaml
# docker-compose.override.yml
services:
  geo-calculator:
    scale: 3  # Run 3 instances
  
  intelligence-engine:
    scale: 2  # Run 2 instances
```

### Load Balancing
- API Gateway handles routing and load balancing
- Health checks ensure only healthy instances receive traffic
- Automatic failover with Docker restart policies

## Monitoring & Observability

### Metrics Collection
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3005
- Default credentials: admin/admin

### Health Endpoints
- `/health` - Basic health check
- `/ready` - Readiness probe
- `/metrics` - Prometheus metrics

## Troubleshooting

### Common Issues

1. **Port Conflicts**
```bash
# Find and kill process on port
lsof -ti:8000 | xargs kill -9
```

2. **Container Issues**
```bash
# Reset everything
make clean
make dev-reset
```

3. **Database Connection**
```bash
# Check PostgreSQL
make shell-postgres
\l  # List databases
\dt # List tables
```

4. **Service Dependencies**
```bash
# Check service logs
docker-compose logs service-name
```

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use secrets management in production
   - Rotate API keys regularly

2. **Network Security**
   - Services communicate via internal network
   - Only gateway exposed externally
   - Enable TLS in production

3. **Container Security**
   - Run as non-root user
   - Minimal base images
   - Regular security updates

## Performance Optimization

1. **Caching Strategy**
   - Redis for session data
   - API response caching
   - Static asset CDN

2. **Database Optimization**
   - Connection pooling
   - Query optimization
   - Regular VACUUM

3. **Resource Limits**
```yaml
services:
  geo-calculator:
    mem_limit: 1g
    cpus: '0.5'
```

## CI/CD Pipeline

### GitHub Actions Example
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Production
        run: |
          docker-compose build
          docker-compose up -d
```

## Disaster Recovery

### Backup Strategy
```bash
# Automated daily backups
0 2 * * * make backup
```

### Restore Process
```bash
# Restore from backup
docker-compose exec postgres psql -U rmb_user rankmybrand < backup.sql
```

## Support & Maintenance

- **Logs**: Check service logs first
- **Monitoring**: Review Grafana dashboards
- **Updates**: Regular dependency updates
- **Documentation**: Keep deployment docs current

---

**Note**: This deployment uses Docker Compose for orchestration. For production at scale, consider migrating to Kubernetes for advanced features like auto-scaling, self-healing, and multi-region deployment.