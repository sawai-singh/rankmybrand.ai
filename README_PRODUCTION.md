# RankMyBrand Production Deployment Guide

## Overview
This guide explains how to launch RankMyBrand in production mode with all services properly configured and monitored.

## Quick Start

### Launch Production
```bash
./launch-production.sh
```

### Stop Production
```bash
./stop-production.sh
```

## Production Scripts

### `launch-production.sh`
The main production launcher that:
- ✅ Performs pre-flight checks (Node.js, Python, ports)
- ✅ Starts infrastructure (Redis, PostgreSQL)
- ✅ Initializes database if needed
- ✅ Builds all services for production
- ✅ Launches services with proper logging
- ✅ Monitors health and auto-restarts failed services
- ✅ Provides real-time status updates

### `stop-production.sh`
Gracefully stops all services:
- Terminates application processes
- Stops Redis
- Preserves PostgreSQL (managed separately)
- Cleans up PID files

## Service Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│            http://localhost:3003                 │
│         (Onboarding & Landing Page)              │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│                  API GATEWAY                     │
│            http://localhost:4000                 │
│         (Central API & WebSocket Hub)            │
└──────┬──────────────────────────────┬───────────┘
       │                              │
┌──────┴──────────┐          ┌───────┴───────────┐
│   DASHBOARD     │          │  INTELLIGENCE     │
│  localhost:3000 │          │  localhost:8002   │
│  (User Portal)  │          │  (AI Analysis)    │
└─────────────────┘          └───────────────────┘
       │                              │
┌──────┴──────────────────────────────┴───────────┐
│              INFRASTRUCTURE                      │
│         Redis (6379) | PostgreSQL (5432)        │
└──────────────────────────────────────────────────┘
```

## Port Configuration

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3003 | Main entry point for users |
| Dashboard | 3000 | Authenticated user dashboard |
| API Gateway | 4000 | REST API & WebSocket server |
| Intelligence Engine | 8002 | AI/ML processing |
| Redis | 6379 | Cache & pub/sub |
| PostgreSQL | 5432 | Primary database |

## Directory Structure

```
rankmybrand.ai/
├── launch-production.sh     # Production launcher
├── stop-production.sh        # Production stopper
├── .pids/                   # Process ID files
├── logs/                    # Service logs
│   ├── api-gateway.log
│   ├── frontend.log
│   ├── dashboard.log
│   ├── intelligence-engine.log
│   ├── redis.log
│   └── postgres.log
├── api-gateway/             # API Gateway service
├── rankmybrand-frontend/    # Frontend application
├── services/
│   ├── dashboard/          # User dashboard
│   └── intelligence-engine/ # AI processing
└── database/
    └── schema.sql          # Database schema

```

## Environment Requirements

### System Requirements
- **Node.js**: v18 or higher
- **Python**: v3.9 or higher
- **Redis**: v6 or higher
- **PostgreSQL**: v13 or higher
- **RAM**: Minimum 4GB, recommended 8GB
- **Storage**: 10GB free space

### Required Tools
- `npm` - Node package manager
- `pip3` - Python package manager
- `psql` - PostgreSQL client
- `redis-cli` - Redis client
- `curl` - HTTP client
- `lsof` - Port checker

## Production Features

### Health Monitoring
- Automatic health checks every 60 seconds
- Auto-restart for failed services
- Detailed logging in `logs/` directory

### Graceful Shutdown
- Clean service termination
- PID file cleanup
- Database connection cleanup
- WebSocket disconnection handling

### Error Recovery
- Retry logic for service starts
- Port conflict detection
- Database initialization checks
- Dependency validation

## Troubleshooting

### Service Won't Start
```bash
# Check if port is in use
lsof -i :PORT_NUMBER

# View service logs
tail -f logs/SERVICE_NAME.log

# Check service health
curl http://localhost:PORT/health
```

### Database Issues
```bash
# Check PostgreSQL status
psql -U postgres -c "SELECT 1"

# Initialize database manually
psql -U postgres -d rankmybrand -f database/schema.sql
```

### Redis Issues
```bash
# Check Redis status
redis-cli ping

# Start Redis manually
redis-server --port 6379 --daemonize yes
```

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper database credentials
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring (e.g., PM2, systemd)
- [ ] Configure log rotation
- [ ] Set up backup strategy
- [ ] Configure CDN for static assets
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure rate limiting
- [ ] Set up DDoS protection

## Security Considerations

1. **Database Security**
   - Use strong passwords
   - Enable SSL connections
   - Restrict network access

2. **API Security**
   - Implement rate limiting
   - Use HTTPS in production
   - Validate all inputs
   - Implement CORS properly

3. **Environment Variables**
   - Never commit `.env` files
   - Use secrets management
   - Rotate credentials regularly

## Monitoring

### Key Metrics to Monitor
- Response times
- Error rates
- Database query performance
- Memory usage
- CPU utilization
- Active connections
- GEO calculation times

### Recommended Tools
- **PM2**: Process management
- **Grafana**: Metrics visualization
- **Prometheus**: Metrics collection
- **ELK Stack**: Log aggregation
- **New Relic**: APM

## Scaling Considerations

### Horizontal Scaling
- API Gateway: Can run multiple instances
- Intelligence Engine: Can distribute workload
- Frontend/Dashboard: Can use CDN

### Database Scaling
- Read replicas for queries
- Connection pooling
- Query optimization
- Indexing strategy

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review this documentation
3. Check service health endpoints
4. Verify all dependencies are installed

## Version Information

- **Script Version**: 2.0
- **Last Updated**: August 2024
- **Compatibility**: macOS, Linux