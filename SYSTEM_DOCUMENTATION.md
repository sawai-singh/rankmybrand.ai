# RankMyBrand AI - System Documentation

## Current Architecture

```
Frontend (3003) & Dashboard (3000)
           ↓
    API Gateway (4000)
    [WebSocket included]
           ↓
Intelligence Engine (8002) | Web Crawler (3002)
           ↓
   PostgreSQL (5432) | Redis (6379)
```

## Active Services

| Service | Port | Purpose | Technology |
|---------|------|---------|------------|
| PostgreSQL | 5432 | Primary database | PostgreSQL 15 |
| Redis | 6379 | Caching & pub/sub | Redis |
| API Gateway | 4000 | Central API + WebSocket | Express.js, TypeScript |
| Intelligence Engine | 8002 | AI analysis & orchestration | FastAPI, Python |
| Web Crawler | 3002 | Web scraping & search | Express.js, TypeScript |
| Dashboard | 3000 | Admin interface | Next.js, TypeScript |
| Frontend | 3003 | Customer application | Next.js, TypeScript |

## Recent Optimizations

### Removed Services (Saved 3.5GB RAM, 3.5 CPU cores)
- ✅ `/services/websocket` - Redundant with API Gateway WebSocket
- ✅ `/services/shared-types` - Unused type definitions
- ✅ `/services/ai-response-monitor` - Never integrated
- ✅ `/services/foundation` - Not used
- ✅ `/services/action-center` - Never called
- ✅ `/services/websocket-server` - Duplicate WebSocket

### Database Optimization
12 unused tables identified and can be archived:
- search_rankings, brand_mentions, ai_platform_scores
- serp_analyses, content_gaps, analysis_history
- user_notifications, audit_log, company_edit_history
- user_journey_analytics, company_enrichment_log, report_events

Archive with: `psql -U sawai -d rankmybrand -f migrations/archive_unused_tables.sql`

## Core Workflows

### 1. GEO Analysis Flow
```
User Request → API Gateway → Intelligence Engine
    ↓
Query Generation (OpenAI/Anthropic)
    ↓
Web Search (Perplexity/Google)
    ↓
Response Analysis & Scoring
    ↓
Store in PostgreSQL → Return to User
```

### 2. Real-time Updates
- WebSocket server integrated in API Gateway (port 4000)
- Handles job status updates and live analysis progress
- Frontend connects to `ws://localhost:4000/ws`

### 3. Job Processing
- Bull queues in Redis for async job management
- Intelligence Engine consumes jobs from queues
- Supports batch processing and retries

## Key Features

### Intelligence Engine Capabilities
- Multi-LLM orchestration (OpenAI, Anthropic, Google, Perplexity)
- GEO (Generative Engine Optimization) scoring
- Competitive analysis
- Content gap identification
- Real-time web search integration

### API Gateway Features
- JWT authentication
- Rate limiting
- Request proxying to microservices
- Integrated WebSocket server
- Health monitoring endpoints

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- PostgreSQL 15
- Redis

### Running the System
```bash
# Start all services
docker-compose up -d

# Check health
./health-check.sh

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Setup
Key environment variables in `.env`:
- Database: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_URL`
- API Keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`
- Services: `INTELLIGENCE_SERVICE`, `CRAWLER_SERVICE`

## Performance Metrics

### Resource Usage (Optimized)
- **Memory:** ~2.5GB (down from 6GB)
- **CPU:** ~3.5 cores (down from 7)
- **Startup:** ~1 minute (down from 3)
- **Services:** 7 active (down from 13)

### Database
- 42 active tables (12 archived)
- Connection pooling enabled
- Indexes on frequently queried columns

## Monitoring

### Health Checks
- API Gateway: `http://localhost:4000/health`
- Intelligence Engine: `http://localhost:8002/health`
- Web Crawler: `http://localhost:3002/health`

### Metrics
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (if enabled)

## Development

### Code Structure
```
/api-gateway          - Central API & WebSocket
/services
  /dashboard         - Admin UI (Next.js)
  /intelligence-engine - AI orchestration (Python)
  /web-crawler       - Web scraping service
/database            - PostgreSQL schemas
/migrations          - Database migrations
```

### Testing
```bash
# API Gateway tests
cd api-gateway && npm test

# Intelligence Engine tests
cd services/intelligence-engine && pytest

# Frontend tests
cd services/dashboard && npm test
```

## Maintenance

### Regular Tasks
1. Archive old job data from Redis
2. Vacuum PostgreSQL database
3. Clear Docker image cache
4. Review and rotate API keys
5. Monitor rate limits

### Troubleshooting
- **High memory usage**: Check Redis memory, clear old jobs
- **Slow queries**: Run `ANALYZE` on PostgreSQL
- **WebSocket issues**: Check API Gateway logs
- **AI errors**: Verify API keys and rate limits

## Security Notes
- JWT tokens expire in 7 days
- All services run in Docker network isolation
- API Gateway handles all external requests
- Rate limiting enabled on all endpoints
- CORS configured for frontend origins only

## Future Improvements
1. Implement connection pooling for all services
2. Add GraphQL endpoint for efficient queries
3. Implement event sourcing for audit trail
4. Add CDN for static assets
5. Consider serverless for infrequent operations