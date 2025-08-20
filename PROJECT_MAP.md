# PROJECT MAP - RankMyBrand.ai
*Last Updated: August 21, 2025*
*Verified and Corrected: All paths and files confirmed to exist*

## Table of Contents
1. [Project Architecture](#project-architecture)
2. [Component Mapping](#component-mapping)
3. [Execution Guide](#execution-guide)
4. [Troubleshooting Directory](#troubleshooting-directory)
5. [Script Reference](#script-reference)
6. [API Endpoints](#api-endpoints)
7. [Environment Configuration](#environment-configuration)

---

## Project Architecture

### Complete Directory Structure

```
rankmybrand.ai/
├── api-gateway/                  # Central API Gateway (Port 4000)
│   ├── src/
│   │   ├── routes/               # API endpoint definitions
│   │   │   ├── admin-ai-visibility.routes.ts
│   │   │   ├── ai-visibility.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── enhanced-query.routes.ts
│   │   │   ├── health.routes.ts
│   │   │   ├── onboarding.routes.ts
│   │   │   ├── query-status.routes.ts
│   │   │   ├── report-generation.routes.ts
│   │   │   ├── report.routes.ts
│   │   │   ├── test-queries.routes.ts
│   │   │   └── user-dashboard.routes.ts
│   │   ├── middleware/           # Auth, rate limiting, validation
│   │   ├── services/             # Business logic services
│   │   └── database/             # Database connections and repositories
│   └── dist/                     # Compiled JavaScript output
│
├── services/
│   ├── dashboard/                # Admin & User Dashboard (Port 3000)
│   │   ├── app/                  # Next.js app directory
│   │   │   ├── admin/           # Admin dashboard pages
│   │   │   ├── demo/            # Demo page
│   │   │   └── login/           # Login page
│   │   └── components/           # React components
│   │
│   ├── intelligence-engine/      # AI Processing Engine (Port 8002)
│   │   ├── src/
│   │   │   ├── api/             # FastAPI routes
│   │   │   ├── processors/      # Data processors
│   │   │   ├── models/          # Data models
│   │   │   ├── nlp/             # NLP processing modules
│   │   │   ├── services/        # AI visibility services
│   │   │   └── storage/         # Cache and storage management
│   │   └── venv/                # Python virtual environment
│   │
│   ├── web-crawler/              # Web Scraping Service (Port 3002)
│   │   ├── src/
│   │   │   ├── search-intelligence/ # Search intelligence module
│   │   │   ├── routes/          # API routes
│   │   │   └── services/        # Crawler services
│   │   └── dist/
│   │
│   ├── websocket-server/         # Real-time Updates (Port 3001)
│   │   ├── src/
│   │   │   ├── data-fetcher.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   └── dist/
│   │
│   ├── action-center/            # Automated Actions (Port 8082)
│   │   ├── src/
│   │   │   ├── api/             # API routes and middleware
│   │   │   ├── generators/      # Recommendation generators
│   │   │   ├── executors/       # Action executors
│   │   │   └── integrations/    # Third-party integrations
│   │   └── dist/
│   │
│   ├── ai-response-monitor/      # Response Monitoring (Port 8001)
│   │   ├── src/
│   │   │   ├── collectors/      # AI provider collectors
│   │   │   ├── anti-detection/  # Anti-detection mechanisms
│   │   │   └── services/        # Monitor services
│   │   └── dist/
│   │
│   ├── foundation/               # Microservice foundation framework
│   │   └── src/
│   │
│   └── shared-types/             # Shared TypeScript types
│       └── index.ts
│
├── migrations/                    # Database migration scripts
│   ├── 003_enhanced_company_tracking.sql
│   ├── 003_enhanced_company_tracking_fixed.sql
│   ├── 004_session_journey_view.sql
│   ├── 005_add_user_onboarding_system.sql
│   ├── 005_add_user_onboarding_system_improved.sql
│   ├── 005_report_queue.sql
│   ├── 006_ai_visibility_audit_system.sql
│   └── 007_missing_tables_fixed.sql
│
├── monitoring/                    # Monitoring and observability
│   ├── prometheus.yml           # Prometheus configuration
│   ├── grafana/                 # Grafana dashboards
│   └── alerts/                  # Alert rules
│
├── config/                       # Configuration management
│   ├── services/                # Service configurations
│   └── secrets/                 # Secret management
│
├── scripts/                       # Utility and launch scripts
│   ├── launch/                  # Service launch scripts
│   │   ├── launch-production.sh
│   │   ├── launch-orchestrator.sh
│   │   └── start-all-services.sh
│   ├── deployment/              # Deployment scripts
│   │   └── deploy-production.sh
│   └── utilities/               # Utility scripts
│       ├── stop-all-services.sh
│       ├── stop-production.sh
│       ├── check-sensitive-files.sh
│       └── test-dashboard-integration.sh
│
├── docs/                         # Documentation
│   ├── architecture/            # System architecture docs
│   ├── guides/                  # Setup and deployment guides
│   └── troubleshooting/         # Debug and troubleshooting docs
│
├── rankmybrand-frontend/         # Legacy frontend (deprecated)
├── archived-services/            # Archived old implementations
├── docker-compose.yml            # Development Docker configuration
├── docker-compose.production.yml # Production Docker configuration
└── Makefile                      # Build automation
```

---

## Component Mapping

### Service Interconnections

```mermaid
graph TB
    Client[Client Browser]
    
    subgraph "Frontend Layer"
        Dashboard[Dashboard<br/>Port 3000]
        AdminDash[Admin Dashboard<br/>Port 3000/admin]
    end
    
    subgraph "API Layer"
        Gateway[API Gateway<br/>Port 4000]
        WebSocket[WebSocket Server<br/>Port 3001]
    end
    
    subgraph "Processing Layer"
        Intelligence[Intelligence Engine<br/>Port 8002]
        Crawler[Web Crawler<br/>Port 3002]
        Action[Action Center<br/>Port 8082]
        Monitor[AI Response Monitor<br/>Port 8001]
    end
    
    subgraph "Data Layer"
        Postgres[(PostgreSQL<br/>Port 5432)]
        Redis[(Redis<br/>Port 6379)]
    end
    
    Client --> Dashboard
    Client --> AdminDash
    Dashboard --> Gateway
    AdminDash --> Gateway
    Client --> WebSocket
    
    Gateway --> Intelligence
    Gateway --> Crawler
    Gateway --> Action
    Gateway --> Monitor
    
    Intelligence --> Postgres
    Crawler --> Postgres
    Action --> Postgres
    Monitor --> Redis
    
    WebSocket --> Redis
    Gateway --> Postgres
```

### Data Flow

1. **User Onboarding Flow**
   - User submits company info → API Gateway
   - Gateway stores in PostgreSQL
   - Triggers Intelligence Engine for query generation
   - Intelligence Engine uses GPT-5 to generate queries
   - Queries stored in database
   - Dashboard displays results

2. **Real-time Updates**
   - Services publish events to Redis
   - WebSocket Server subscribes to Redis
   - Broadcasts updates to connected clients
   - Dashboard updates in real-time

3. **Analysis Pipeline**
   - Web Crawler fetches data
   - Intelligence Engine processes with AI
   - Results stored in PostgreSQL
   - Action Center generates recommendations
   - Dashboard displays insights

---

## Execution Guide

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL 14+
- Redis 6+
- OpenAI API Key

### Environment Setup

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/rankmybrand.ai.git
cd rankmybrand.ai
```

2. **Install Dependencies**

For Node.js services:
```bash
# API Gateway
cd api-gateway && npm install

# Dashboard
cd services/dashboard && npm install

# Other Node services
cd services/web-crawler && npm install
cd services/websocket-server && npm install
```

For Python services:
```bash
# Intelligence Engine
cd services/intelligence-engine
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Database Setup**
```bash
# Create database
createdb rankmybrand

# Run migrations in order
psql -U your_user -d rankmybrand -f migrations/003_enhanced_company_tracking.sql
psql -U your_user -d rankmybrand -f migrations/003_enhanced_company_tracking_fixed.sql
psql -U your_user -d rankmybrand -f migrations/004_session_journey_view.sql
psql -U your_user -d rankmybrand -f migrations/005_add_user_onboarding_system_improved.sql
psql -U your_user -d rankmybrand -f migrations/005_report_queue.sql
psql -U your_user -d rankmybrand -f migrations/006_ai_visibility_audit_system.sql
psql -U your_user -d rankmybrand -f migrations/007_missing_tables_fixed.sql
```

### Running the Project

#### Development Mode

1. **Start Infrastructure**
```bash
# Terminal 1: PostgreSQL (if not running)
postgres -D /usr/local/var/postgres

# Terminal 2: Redis
redis-server
```

2. **Start Services** (each in separate terminal)
```bash
# API Gateway
cd api-gateway && npm start

# Dashboard
cd services/dashboard && npm run dev

# Intelligence Engine
cd services/intelligence-engine && python -m uvicorn src.main:app --port 8002

# WebSocket Server
cd services/websocket-server && npm start

# Web Crawler
cd services/web-crawler && npm start
```

3. **Access Applications**
- User Dashboard: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin
- API Gateway: http://localhost:4000
- WebSocket: ws://localhost:3001

#### Production Mode

```bash
# Use the production launch script
./scripts/launch/launch-production.sh

# Or use Docker Compose
docker-compose up -d
```

---

## Troubleshooting Directory

### Common Issues and Solutions

| Issue | Location to Check | Solution |
|-------|------------------|----------|
| Dashboard not loading | `/tmp/dashboard.log` | Check if API Gateway is running on port 4000 |
| Admin page 404 | `services/dashboard/.next` | Clear Next.js cache: `rm -rf .next` and restart |
| Query generation fails | `/tmp/intelligence-engine.log` | Verify OpenAI API key in `.env` |
| Database connection error | `api-gateway/logs/` | Check PostgreSQL is running and credentials are correct |
| WebSocket not connecting | Browser console | Ensure WebSocket server is running on port 3001 |
| Missing company data | PostgreSQL | Run missing migrations from `/migrations` folder |

### Log File Locations

- **API Gateway**: `/tmp/api-gateway.log`
- **Dashboard**: `/tmp/dashboard.log`
- **Intelligence Engine**: `/tmp/intelligence-engine.log`
- **Web Crawler**: `/tmp/web-crawler.log`
- **WebSocket Server**: `/tmp/websocket.log`

### Debug Mode

Enable debug mode by setting environment variable:
```bash
export DEBUG=true
export LOG_LEVEL=debug
```

### Error Codes

| Code | Service | Meaning |
|------|---------|---------|
| 401 | API Gateway | Authentication failed |
| 403 | API Gateway | Insufficient permissions |
| 404 | Dashboard | Page or resource not found |
| 500 | Intelligence Engine | AI processing error |
| 502 | API Gateway | Service unavailable |
| 503 | Any | Service temporarily down |

---

## Script Reference

### Launch Scripts (`/scripts/launch/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `launch-production.sh` | Start all services in production mode | `./launch-production.sh` |
| `launch-orchestrator.sh` | Start with orchestration | `./launch-orchestrator.sh` |
| `start-all-services.sh` | Start all development services | `./start-all-services.sh` |

### Deployment Scripts (`/scripts/deployment/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-production.sh` | Deploy to production server | `./deploy-production.sh` |

### Utility Scripts (`/scripts/utilities/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `stop-all-services.sh` | Stop all running services | `./stop-all-services.sh` |
| `stop-production.sh` | Stop production services | `./stop-production.sh` |
| `check-sensitive-files.sh` | Check for exposed secrets | `./check-sensitive-files.sh` |
| `test-dashboard-integration.sh` | Test dashboard connectivity | `./test-dashboard-integration.sh` |

---

## API Endpoints

### Core Endpoints (API Gateway - Port 4000)

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/session` - Get current session

#### Onboarding
- `POST /api/onboarding/validate-email` - Validate email
- `POST /api/onboarding/enrich` - Enrich company data
- `POST /api/onboarding/complete` - Complete onboarding
- `POST /api/onboarding/find-competitors` - Find competitors

#### AI Visibility
- `POST /api/ai-visibility/generate-queries` - Generate AI queries
- `GET /api/ai-visibility/queries/:companyId` - Get company queries
- `POST /api/ai-visibility/analyze` - Analyze AI visibility
- Admin AI Visibility routes available at `/api/admin-ai-visibility/*`

#### Enhanced Query
- Query enhancement routes available at `/api/enhanced-query/*`

#### Query Status
- Query status monitoring routes at `/api/query-status/*`

#### Reports
- `POST /api/reports/generate` - Generate report
- `GET /api/reports/:id` - Get report
- `GET /api/reports/company/:companyId` - Get company reports
- Report generation routes at `/api/report-generation/*`

#### User Dashboard
- Dashboard specific routes at `/api/user-dashboard/*`

#### Health
- `GET /api/health` - Service health check

#### Test Queries
- Test query routes at `/api/test-queries/*` (development only)

### Intelligence Engine (Port 8002)
- `POST /api/ai-visibility/generate-queries` - Generate queries with GPT-5
- `POST /api/v1/geo/analyze` - Analyze GEO metrics
- `GET /health` - Health check

### Web Crawler (Port 3002)
- `POST /api/crawl` - Start crawl job
- `GET /api/crawl/status/:jobId` - Get crawl status

---

## Environment Configuration

### Required Environment Variables

#### API Gateway (.env)
```env
NODE_ENV=development|production
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/rankmybrand
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
```

#### Dashboard (.env.local)
```env
NEXT_PUBLIC_API_GATEWAY=http://localhost:4000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

#### Intelligence Engine (.env)
```env
OPENAI_API_KEY=sk-...
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=rankmybrand
REDIS_HOST=localhost
REDIS_PORT=6379
SERVICE_PORT=8002
```

### Configuration Files

- **TypeScript Config**: `tsconfig.json` in each Node.js service
- **Python Config**: `pyproject.toml` or `setup.py` in Python services
- **Database Config**: `migrations/` folder for schema
- **Docker Config**: `docker-compose.yml` for containerization

---

## Service Dependencies

### NPM Dependencies (Key Packages)
- **Express**: API framework
- **Next.js**: React framework for dashboard
- **Socket.io**: WebSocket communication
- **Prisma/pg**: Database ORM and client
- **Bull**: Job queue management

### Python Dependencies (Key Packages)
- **FastAPI**: API framework
- **OpenAI**: GPT integration
- **psycopg2**: PostgreSQL adapter
- **Redis**: Cache and pub/sub
- **Pydantic**: Data validation

---

## Maintenance and Updates

### Database Migrations
Always create new migration files in `/migrations` folder:
```sql
-- migrations/XXX_description.sql
-- Description of changes
ALTER TABLE ...
```

### Adding New Services
1. Create folder in `/services`
2. Add to `docker-compose.yml`
3. Update this PROJECT_MAP.md
4. Add launch script in `/scripts/launch`

### Monitoring
- Use `/health` endpoints for each service
- Check log files in `/tmp/`
- Monitor PostgreSQL with `pg_stat_activity`
- Monitor Redis with `redis-cli monitor`

---

## Quick Commands

```bash
# Check all services status
lsof -i :3000,3001,3002,4000,8001,8002,8082 | grep LISTEN

# Restart all services
./scripts/utilities/stop-all-services.sh && ./scripts/launch/start-all-services.sh

# Clear all logs
rm /tmp/*.log

# Database backup
pg_dump rankmybrand > backup_$(date +%Y%m%d).sql

# Check for exposed secrets
./scripts/utilities/check-sensitive-files.sh
```

---

## Support and Documentation

- **Architecture Docs**: `/docs/architecture/`
- **Deployment Guides**: `/docs/guides/`
- **Troubleshooting**: `/docs/troubleshooting/`
- **API Documentation**: http://localhost:4000/api/docs (when running)

For detailed documentation on specific components, refer to the `/docs` folder.