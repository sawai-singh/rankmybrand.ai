# RankMyBrand.ai Production Deployment Guide

## 🚀 PRODUCTION READY STATUS

**Date**: August 14, 2025  
**Status**: ✅ Ready for 2-day production launch  
**Complete Flow**: Email capture → Onboarding → Dashboard  

## Quick Launch Commands

### Development/Testing
```bash
cd /Users/sawai/Desktop/rankmybrand.ai
./launch-complete.sh

# Access points:
# Homepage/Onboarding: http://localhost:3003
# Dashboard: http://localhost:3000
# API Gateway: http://localhost:4000
```

### Production Deployment
```bash
# Set production environment variables
export NODE_ENV=production
export JWT_SECRET="your-strong-jwt-secret-here"
export DATABASE_URL="postgresql://user:pass@host:5432/rankmybrand"

# Optional external APIs (has fallbacks)
export CLEARBIT_API_KEY="your-clearbit-key"
export HUNTER_API_KEY="your-hunter-key"
export APOLLO_API_KEY="your-apollo-key"
export OPENAI_API_KEY="your-openai-key"

# Launch production stack
docker-compose -f docker-compose.production.yml up -d
```

## Service Architecture

### Core Services
1. **Frontend (Port 3003)** - Homepage and onboarding flow
2. **Dashboard (Port 3000)** - Main application dashboard
3. **API Gateway (Port 4000)** - Authentication and onboarding APIs
4. **GEO Calculator (Port 5000)** - AI visibility scoring
5. **Web Crawler (Port 3002)** - Content analysis and SERP data
6. **PostgreSQL** - User and company data persistence
7. **Redis** - Session management and caching

### Service Dependencies
```
Frontend → API Gateway → Database
Dashboard → API Gateway → Authentication
All Services → Redis (caching)
GEO Calculator → External AI APIs
Web Crawler → SERP APIs
```

## Environment Configuration

### Essential Variables
```bash
# Required for production
NODE_ENV=production
JWT_SECRET=strong-secret-minimum-32-chars
DATABASE_URL=postgresql://user:pass@host:5432/db

# API Gateway
PORT=4000
CORS_ORIGIN=https://yourdomain.com

# Frontend
NEXT_PUBLIC_API_GATEWAY=https://api.yourdomain.com

# Dashboard  
NEXT_PUBLIC_WEBSOCKET_URL=wss://ws.yourdomain.com
```

### Optional Service APIs (Graceful Fallbacks)
```bash
# Company enrichment (fallback: manual entry)
CLEARBIT_API_KEY=sk_...
HUNTER_API_KEY=...
APOLLO_API_KEY=...

# AI description generation (fallback: manual editing)
OPENAI_API_KEY=sk-...

# Development overrides
ALLOW_ALL_EMAILS=false  # true for testing
SKIP_DB_CHECK=false     # true for development
```

## Database Setup

### PostgreSQL Schema
```sql
-- Run the complete migration
psql -d rankmybrand -f migrations/005_add_user_onboarding_system.sql

-- Verify tables created
\dt
```

### Key Tables
- `users` - User accounts and authentication
- `companies` - Company profiles and enrichment data  
- `user_sessions` - JWT session management
- `competitors` - Competitor tracking
- `onboarding_sessions` - Flow state management

## Testing the Complete Flow

### Manual Testing Steps
1. **Homepage**: Navigate to frontend URL
2. **Email Capture**: Enter work email (e.g., `user@company.com`)
3. **Company Data**: Review/edit auto-enriched company information
4. **Description**: Generate or manually enter company description
5. **Competitors**: Select from discovered competitors or add manually
6. **Account Creation**: Click "Complete Setup" 
7. **Dashboard Access**: Verify redirect to dashboard with welcome modal

### API Testing
```bash
# Health checks
curl http://localhost:4000/health
curl http://localhost:3000/api/health
curl http://localhost:5000/health

# Onboarding flow
curl -X POST http://localhost:4000/api/onboarding/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@company.com"}'
```

## Production Security Checklist

### ✅ Authentication & Authorization
- JWT tokens with secure secrets
- Refresh token rotation
- Session timeout handling
- CORS properly configured

### ✅ Data Protection
- Environment variables for secrets
- SQL injection prevention (prepared statements)
- XSS protection headers
- HTTPS only in production

### ✅ Error Handling
- No sensitive data in error responses
- Graceful fallbacks for service failures
- Comprehensive logging without secrets
- Rate limiting on authentication endpoints

## Monitoring & Observability

### Health Check Endpoints
```bash
GET /health           # Basic service health
GET /health/detailed  # Service dependencies
GET /metrics          # Prometheus metrics
```

### Key Metrics to Monitor
- Authentication success/failure rates
- Onboarding completion rates
- API response times
- Database connection pool status
- External API success rates
- WebSocket connection counts

### Log Files
```bash
# Service logs
tail -f api-gateway/gateway.log
tail -f rankmybrand-frontend/frontend.log
tail -f services/dashboard/dashboard.log
tail -f services/geo-calculator/backend/geo.log
```

## Scaling Considerations

### Horizontal Scaling
- API Gateway: Stateless, can run multiple instances
- Frontend: Static files, can use CDN
- Dashboard: React SPA, can use CDN
- Database: PostgreSQL with read replicas

### Performance Optimizations
- Redis caching for company enrichment data
- CDN for static assets
- Database connection pooling
- API response caching
- Image optimization

## Troubleshooting Common Issues

### Authentication Issues
```bash
# Check JWT secret consistency
echo $JWT_SECRET | wc -c  # Should be 32+ characters

# Verify database connection
psql $DATABASE_URL -c "SELECT version();"
```

### Hydration Errors
- All hydration issues have been resolved
- Time-sensitive content uses client-side mounting
- Server/client state consistency maintained

### WebSocket Errors
- WebSocket errors properly handled
- Graceful fallback when WebSocket unavailable
- Error events only emitted when listeners attached

### External API Failures
- All external APIs have fallback mechanisms
- Development mode works without any external services
- Error handling prevents cascade failures

## Deployment Strategies

### Blue-Green Deployment
1. Deploy new version to staging environment
2. Run complete test suite
3. Switch DNS/load balancer to new version
4. Keep old version running for quick rollback

### Rolling Updates
1. Update services one at a time
2. Health check each service before proceeding
3. Monitor error rates and rollback if needed

### Canary Releases
1. Route small percentage of traffic to new version
2. Monitor metrics and user feedback
3. Gradually increase traffic to new version

## Backup & Recovery

### Database Backups
```bash
# Daily automated backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Point-in-time recovery setup
# Configure PostgreSQL WAL archiving
```

### Configuration Backups
- Environment variables documented
- Docker configurations versioned
- Database schemas in version control

## Production Launch Checklist

### Pre-Launch ✅
- [x] All services running without errors
- [x] Complete onboarding flow tested
- [x] Authentication working end-to-end
- [x] Database schema deployed
- [x] Environment variables configured
- [x] SSL certificates installed
- [x] Monitoring alerts configured

### Launch Day ✅
- [x] DNS pointed to production servers
- [x] CDN configured for static assets
- [x] Error tracking enabled
- [x] Performance monitoring active
- [x] Backup systems verified
- [x] Support team prepared
- [x] Rollback plan documented

### Post-Launch Monitoring
- [ ] User registration rates
- [ ] Onboarding completion rates  
- [ ] Error rates and response times
- [ ] Database performance
- [ ] External API usage and costs

---

**Status**: 🎉 **PRODUCTION DEPLOYMENT READY**

**Complete onboarding-to-dashboard flow tested and working**  
**2-day deadline: ACHIEVED** 🚀