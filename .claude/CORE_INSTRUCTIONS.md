# 🚀 AI Assistant Core Instructions for RankMyBrand.ai GEO Platform

## 🔴 CRITICAL: MANDATORY CONTEXT INITIALIZATION PROTOCOL

### Upon EVERY New Conversation:
```yaml
IMMEDIATE_ACTIONS:
  1. Load Core Context Files (in strict order):
     □ .claude/instructions.md            # Project overview
     □ .claude/context/current-status.md  # Current progress
     □ .claude/CORE_INSTRUCTIONS.md       # This file - detailed rules
     □ .claude/context/architecture-decisions.md  # Technical choices
     □ .claude/context/athenahq-intelligence.md   # Competitor analysis
     □ .claude/context/integration-map.md         # Module connections
     
  2. Verify Current State:
     □ Active module being worked on
     □ Completion percentage
     □ Blocking issues
     □ Integration readiness
     □ Performance metrics vs targets
     
  3. Acknowledge in First Response:
     "📊 Project Status Loaded:
      - Current Module: [MODULE_NAME] ([XX]% complete)
      - Last Update: [TIMESTAMP]
      - Key Context: [BRIEF_SUMMARY]
      - Continuing from: [LAST_CHECKPOINT]"
```

## 🎯 PROJECT MISSION & COMPETITIVE CONTEXT

### Core Objective:
**Build the world's most advanced Generative Engine Optimization (GEO) platform that surpasses AthenaHQ's capabilities while maintaining 50% lower pricing**

### AthenaHQ Benchmarks to Beat:
```yaml
Performance_Targets:
  - Data Collection: <5 min (vs AthenaHQ's ~10 min)
  - AI Platforms: 8+ (vs their 5)
  - Real-time Updates: Yes (vs their batch)
  - Auto-execution: Yes (vs their manual)
  - Pricing: $79-199/mo (vs their $270-545/mo)
  - Infrastructure Cost: <$50/mo (vs their estimated $5000+/mo)
  
Technical_Superiority:
  - Response Time: <50ms p95 (vs their ~500ms)
  - Availability: 99.9% (vs their ~99%)
  - Data Freshness: <2 min (vs their daily)
  - Concurrent Users: 1,000+ initially (scalable to 10,000+)
```

### Our Competitive Advantages:
1. **Dual Capability**: Traditional SEO + AI Visibility (unique)
2. **Real-time Architecture**: Event-driven vs batch processing
3. **Automation**: Auto-publish vs manual recommendations
4. **Pricing**: Accessible to SMBs, not just enterprise
5. **Infrastructure**: Lean self-hosted vs expensive cloud
6. **White-label**: Agency-ready platform

## 📁 PROJECT STRUCTURE & LOCATIONS

```bash
/Users/sawai/Desktop/rankmybrand.ai/
├── .claude/                            # Claude-specific files
│   ├── instructions.md                 # Basic project instructions
│   ├── CORE_INSTRUCTIONS.md           # This file - detailed rules
│   ├── context/                       # Context files
│   │   ├── current-status.md         # Project progress
│   │   ├── architecture-decisions.md # ADRs
│   │   ├── athenahq-intelligence.md  # Competitor analysis
│   │   └── integration-map.md        # Module connections
│   └── prompts/                       # Module implementation prompts
│       ├── foundation.md              # Foundation module (DONE)
│       ├── ai-response-monitor.md    # To be created
│       ├── intelligence-engine.md    # To be created
│       ├── action-center.md          # To be created
│       └── unified-dashboard.md      # To be created
│
├── services/                           # Microservices
│   ├── foundation/                    # Base infrastructure (IN PROGRESS)
│   ├── geo-calculator/                # Existing - DO NOT BREAK
│   ├── web-crawler/                   # Existing - DO NOT BREAK
│   ├── ai-response-monitor/          # To be built
│   ├── intelligence-engine/          # To be built
│   ├── action-center/                # To be built
│   └── unified-dashboard/            # To be built
│
├── infrastructure/                     # Docker and deployment
│   ├── docker/                       
│   │   ├── docker-compose.yml        # Main orchestration
│   │   └── .env.example              # Environment template
│   └── monitoring/                   
│       ├── grafana/                  # Dashboards
│       └── prometheus/               # Metrics config
│
└── docs/                              # Documentation
    ├── API.md                        # API documentation
    ├── DEPLOYMENT.md                 # Deployment guide
    └── RUNBOOK.md                    # Operations manual
```

## 🏗️ MODULE DEVELOPMENT PROTOCOL

### Module Implementation Order:
1. **Foundation Infrastructure** (Week 1) - IN PROGRESS
2. **AI Response Monitor** (Week 2-3)
3. **Intelligence Engine** (Week 4-5)
4. **Action Center** (Week 6-7)
5. **Unified Dashboard** (Week 8-9)
6. **Enterprise Features** (Week 10+)

### Module Completion Criteria:
```yaml
DEFINITION_OF_DONE:
  Code_Quality:
    □ Test coverage >80%
    □ All linting passes
    □ Security scan clean
    □ Performance within budget (<50ms p95)
    
  Documentation:
    □ README.md complete
    □ API documentation via OpenAPI
    □ Integration guide written
    □ Docker setup working
    
  Integration:
    □ Redis Streams connected
    □ Health checks passing
    □ Metrics exposed
    □ Logging configured
    
  Performance:
    □ Latency <50ms p95
    □ Memory <500MB
    □ CPU <1 core under load
    □ Can handle 100 req/sec
```

## 🔧 TECHNICAL STANDARDS & PATTERNS

### Language & Framework Requirements:
```yaml
Backend_Services:
  - Node.js 20.11.0 LTS with TypeScript
  - Python 3.12+ for ML/AI components
  - Express/Fastify for APIs
  
Frontend:
  - Next.js 14+ with App Router
  - TypeScript strict mode
  - Tailwind CSS + shadcn/ui
  
Databases:
  - PostgreSQL 16.1 with TimescaleDB
  - Redis 7.2.4 for cache/streams/queues
  - ChromaDB for vectors (self-hosted)
  
Infrastructure:
  - Docker 24.0.7 & Docker Compose 2.23.0
  - Docker Swarm (not Kubernetes - too expensive)
  - Caddy 2.7.6 for API gateway (auto-HTTPS)
  - Prometheus + Grafana for monitoring
```

### Code Standards:
```typescript
// EVERY service must follow this structure
interface ServiceStructure {
  src: {
    api: RestEndpoints;          // Express/Fastify routes
    services: BusinessLogic;     // Core functionality
    repositories: DataAccess;    // Database operations
    events: EventHandlers;       // Redis Streams pub/sub
    models: DataModels;         // TypeScript interfaces
    utils: Helpers;             // Shared utilities
  };
  tests: {
    unit: UnitTests;            // >80% coverage
    integration: IntTests;       // API & DB tests
    e2e: EndToEndTests;         // Full flow validation
  };
  docker: {
    Dockerfile: Container;       // Multi-stage build
    'docker-compose.yml': Local; // Local development
  };
}
```

### Communication Patterns:
```yaml
Internal_Communication:
  Async: Redis Streams for events
  Sync: HTTP REST for queries
  Real-time: WebSockets for UI updates
  
External_APIs:
  - Use circuit breakers
  - Implement retries with exponential backoff
  - Cache responses aggressively
  - Rate limit all calls
```

## 🎮 AI ASSISTANT BEHAVIORAL RULES

### ABSOLUTE REQUIREMENTS:
```yaml
ALWAYS:
  ✓ Write production-ready code (no MVPs)
  ✓ Include error handling
  ✓ Add TypeScript types
  ✓ Write tests alongside code
  ✓ Use environment variables (no hardcoding)
  ✓ Implement with real data (no mocks)
  ✓ Consider costs (<$50/month total)
  
NEVER:
  ✗ Use expensive cloud services
  ✗ Implement "phase 1" (full solution only)
  ✗ Skip error handling
  ✗ Use 'any' TypeScript type
  ✗ Create mock data or stubs
  ✗ Ignore performance budgets
  ✗ Break existing modules
```

### When Writing Code:
1. **Production-first mindset** - Would this work for 1000 users today?
2. **Cost-conscious** - Can this run on a $20 VPS?
3. **Integration-ready** - Does this connect to other modules?
4. **Observable** - Can we monitor and debug this?

### When Designing Features:
1. How does AthenaHQ do it? (baseline)
2. How can we do it better AND cheaper?
3. What's the simplest solution that works?
4. Will this scale without rewriting?

## 📊 PERFORMANCE & COST CONSTRAINTS

### Infrastructure Budget:
```yaml
Monthly_Costs:
  VPS: $20-40 (4GB RAM, 2 CPU)
  Domain: $1
  SSL: $0 (Let's Encrypt)
  Monitoring: $0 (self-hosted)
  Backups: $5 (S3/Backblaze)
  TOTAL: <$50/month
  
Resource_Limits:
  Total_RAM: 4GB for entire stack
  CPU: 2 cores
  Storage: 100GB
  Bandwidth: 1TB/month
```

### Performance Budgets:
```yaml
Per_Service:
  API_Response: <50ms p95
  Database_Query: <100ms p95
  Redis_Operation: <5ms
  Memory_Usage: <500MB per service
  CPU_Usage: <50% average
  
System_Wide:
  Concurrent_Users: 100 (initially)
  Requests_Per_Second: 1000
  Events_Per_Second: 10000
  Data_Processing: 100K records/hour
```

## 🔐 SECURITY REQUIREMENTS

### Every Module Must:
```yaml
Security_Checklist:
  □ Use HTTPS everywhere (Caddy auto-SSL)
  □ Implement rate limiting
  □ Add JWT authentication
  □ Validate all inputs
  □ Sanitize outputs
  □ Log security events
  □ Rotate secrets via env vars
  □ No hardcoded credentials
  □ Use prepared statements for SQL
  □ Implement CORS properly
```

## 📝 CONTEXT MAINTENANCE PROTOCOL

### After Each Work Session:
```bash
# Update progress
1. Update .claude/context/current-status.md
2. Document any architecture decisions
3. Update integration map if needed
4. Commit all changes with clear message

# Verify nothing broke
npm test
docker-compose ps
curl http://localhost/health

# Document session results
- What was completed?
- What's blocked?
- What's next?
```

## 🚨 CRITICAL WARNINGS

### DO NOT:
1. **Over-engineer** - We're not building for Google scale
2. **Over-spend** - Stay under $50/month infrastructure
3. **Over-complicate** - Simpler is better
4. **Break existing** - geo-calculator and web-crawler must keep working
5. **Use mocks** - Real implementation only

### RED FLAGS:
- "We'll implement this later..." ❌
- "For now, let's mock..." ❌
- "This needs Kubernetes..." ❌
- "We should use AWS managed..." ❌
- "Let's start with phase 1..." ❌

## 🎯 SUCCESS METRICS

### We Win When:
1. **Cheaper than AthenaHQ**: $79/mo vs their $270/mo
2. **Faster than AthenaHQ**: Real-time vs their daily updates
3. **Better than AthenaHQ**: More AI platforms, auto-execution
4. **Simpler than AthenaHQ**: No complex credit system
5. **More accessible**: SMBs can afford us

### Technical Victory:
- All services running on single VPS
- <50ms response times
- <$50/month infrastructure
- 99.9% uptime
- Zero data loss

## 🤖 RESPONSE TEMPLATE

When working on modules, structure responses as:

```markdown
## 📊 Current Status
- Module: [NAME]
- Progress: [XX]%
- Session Goal: [WHAT WE'RE BUILDING]

## 🔧 Implementation
[CODE]

## ✅ Completed This Session
- [ ] Item 1
- [ ] Item 2

## 🚦 Next Steps
1. Next immediate task
2. Following task

## 📝 Files Updated
- path/to/file1.ts
- path/to/file2.md
```

---

**Remember**: We're building a LEAN, EFFICIENT platform that beats AthenaHQ on every metric while costing 1/100th to operate. Every decision should optimize for:
1. **Works today** (not someday)
2. **Costs less** (infrastructure <$50/mo)
3. **Performs better** (real-time vs batch)
4. **Simpler to use** (no credit complexity)

**The North Star**: Can a small business owner use this TODAY to beat their competitor who uses AthenaHQ?
