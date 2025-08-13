# 🚀 RANKMYBRAND.AI - MASTER PROJECT INSTRUCTIONS

## 🎯 PROJECT MISSION
Build the world's most advanced Generative Engine Optimization (GEO) platform that destroys AthenaHQ's market position by offering superior features at 50% lower cost.

## 🏆 COMPETITIVE TARGETS TO BEAT (AthenaHQ)
- **Data Collection**: <5 min (vs their ~10 min)
- **AI Platforms**: 8+ (vs their 5)
- **Real-time Updates**: Yes (vs their batch/daily)
- **Auto-execution**: Yes (vs their manual)
- **Pricing**: $79-199/mo (vs their $270-545/mo)
- **Response Time**: <100ms p99 (vs their ~500ms)
- **Infrastructure Cost**: <$50/mo (vs their $5000+/mo)

## 📁 PROJECT STRUCTURE
```
/Users/sawai/Desktop/rankmybrand.ai/
├── .claude/                      # THIS DIRECTORY - Project context
│   ├── instructions.md          # You are reading this
│   ├── prompts/                 # Module implementation prompts
│   └── context/                 # Current status and decisions
├── services/
│   ├── foundation/              # Module 1 - BUILD THIS FIRST
│   ├── geo-calculator/          # EXISTING - Don't break
│   ├── web-crawler/             # EXISTING - Has search-intelligence
│   ├── ai-response-monitor/     # Module 2 - TODO
│   ├── intelligence-engine/     # Module 3 - TODO
│   ├── action-center/          # Module 4 - TODO
│   └── unified-dashboard/      # Module 5 - TODO
└── infrastructure/
    └── docker/
        └── docker-compose.yml   # Main orchestration
```

## ⚙️ TECHNOLOGY STACK (Latest Versions - Dec 2024)
```yaml
Languages:
  - Node.js: 20.11.0 LTS
  - Python: 3.12+
  - TypeScript: 5.3+

Databases:
  - PostgreSQL: 16.1
  - TimescaleDB: 2.13.1
  - Redis: 7.2.4
  - ChromaDB: 0.4.22 (vectors)

Infrastructure:
  - Docker: 24.0.7
  - Docker Compose: 2.23.0
  - Docker Swarm (not K8s - too expensive)

API & Gateway:
  - Caddy: 2.7.6 (auto HTTPS!)
  - Express: 4.18.2
  - FastAPI: 0.109.0

Message Queue:
  - Redis Streams (not Kafka - too expensive)
  - BullMQ: 5.1.1

Monitoring:
  - Prometheus: 2.48.1
  - Grafana: 10.3.1
  - Loki: 2.9.4 (logs)
  - Tempo: 2.3.1 (traces)
```

## 🏗️ MODULE IMPLEMENTATION ORDER

### Phase 1: Foundation (Week 1)
**Module: Foundation Infrastructure**
- Status: READY TO BUILD
- Location: `/services/foundation/`
- Purpose: Core infrastructure all modules depend on
- Key Components:
  - Redis Streams event bus
  - PostgreSQL + TimescaleDB
  - Caddy API gateway
  - Monitoring stack
  - Service discovery

### Phase 2: AI Data Collection (Weeks 2-3)
**Module: AI Response Monitor**
- Status: TODO
- Location: `/services/ai-response-monitor/`
- Purpose: Collect responses from ChatGPT, Claude, Perplexity, etc.
- Key Components:
  - OpenAI API integration
  - Anthropic API integration
  - Web scraping with Playwright
  - Session management
  - Anti-detection

### Phase 3: Intelligence (Weeks 4-5)
**Module: Intelligence Engine**
- Status: TODO
- Location: `/services/intelligence-engine/`
- Purpose: Process AI responses, calculate GEO scores
- Key Components:
  - Citation extraction
  - Sentiment analysis
  - GEO score calculation
  - Competitor analysis

### Phase 4: Automation (Weeks 6-7)
**Module: Action Center**
- Status: TODO
- Location: `/services/action-center/`
- Purpose: Generate recommendations and auto-execute
- Key Components:
  - GPT-4 recommendations
  - CMS integrations
  - Auto-publishing
  - A/B testing

### Phase 5: User Interface (Weeks 8-9)
**Module: Unified Dashboard**
- Status: TODO
- Location: `/services/unified-dashboard/`
- Purpose: Single dashboard for all metrics
- Key Components:
  - Next.js 14 frontend
  - Real-time WebSocket
  - Interactive charts
  - Export functionality

## 💰 COST CONSTRAINTS
Total infrastructure budget: **<$50/month**
- VPS hosting: $20-40/month
- Domain: $1/month
- Backups: $5/month
- SSL: Free (Let's Encrypt via Caddy)
- Monitoring: Free (self-hosted)

## 🚨 CRITICAL RULES

### ALWAYS:
✅ Write production-ready code (no MVPs)
✅ Use real data and real APIs (no mocks)
✅ Include error handling
✅ Add comprehensive logging
✅ Write tests (>85% coverage)
✅ Document everything
✅ Consider costs
✅ Think about scale (10,000 users)

### NEVER:
❌ Use expensive cloud services unnecessarily
❌ Mock or stub production features
❌ Hardcode credentials
❌ Skip error handling
❌ Ignore performance
❌ Create technical debt
❌ Over-engineer initially

## 🔧 DEVELOPMENT WORKFLOW

### Starting a New Module:
1. Read the module prompt in `.claude/prompts/[module-name].md`
2. Create module directory structure
3. Set up Docker services
4. Implement core functionality
5. Add tests
6. Integrate with event bus
7. Add monitoring
8. Update documentation

### Module Structure Template:
```
services/[module-name]/
├── src/
│   ├── api/          # REST endpoints
│   ├── services/     # Business logic
│   ├── repositories/ # Database access
│   ├── events/       # Event handlers
│   ├── models/       # Data models
│   └── utils/        # Helpers
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/
│   └── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 TESTING REQUIREMENTS
- Unit tests: >85% coverage
- Integration tests: All API endpoints
- E2E tests: Critical user flows
- Performance tests: Must handle 1000 req/sec
- All tests use REAL services (not mocks)

## 📊 SUCCESS METRICS
Each module must achieve:
- Response time: <100ms p99
- Error rate: <0.1%
- Availability: >99.9%
- Memory usage: <500MB
- Can handle 1000 req/sec

## 🛠️ USEFUL COMMANDS

```bash
# Start all services
cd /Users/sawai/Desktop/rankmybrand.ai
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Run tests
npm test

# Check service health
curl http://localhost/health

# View metrics
open http://localhost:3000  # Grafana

# Connect to Redis
redis-cli -h localhost -p 6379

# Connect to PostgreSQL
psql -h localhost -U postgres -d rankmybrand

# Build a specific service
docker-compose build [service-name]

# Scale a service
docker-compose up -d --scale [service-name]=3
```

## 📝 CONTEXT FILES REFERENCE
- **This file**: Overall project instructions
- `.claude/prompts/`: Detailed prompts for each module
- `.claude/context/current-status.md`: What's built, what's next
- `.claude/context/architecture.md`: Technical decisions
- `RANKMYBRAND_UNIFIED_CONTEXT_MAP.md`: Original project context

## 🎯 CURRENT TASK
**BUILD THE FOUNDATION MODULE FIRST**
1. Read `.claude/prompts/foundation.md`
2. Create `/services/foundation/` directory
3. Implement according to specifications
4. Test thoroughly
5. Update status in `.claude/context/current-status.md`

## 💡 REMEMBER
We're not just building another GEO tool. We're building the platform that makes AthenaHQ obsolete. Every line of code should be production-ready, cost-effective, and scalable.

**AthenaHQ charges $270-545/month. We'll beat them at $79-199/month with better features.**
