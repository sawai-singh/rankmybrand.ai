# Module Integration Map

## System Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     UNIFIED DASHBOARD                        │
│                    (User Interface Layer)                    │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            ▼                                 ▼
     [WebSocket]                        [REST API]
            │                                 │
┌───────────┴─────────────────────────────────┴───────────────┐
│                      API GATEWAY                             │
│                        (Caddy)                               │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            ▼                                 ▼
    ┌───────────────┐                ┌───────────────┐
    │  Redis        │                │  PostgreSQL   │
    │  Streams      │                │  TimescaleDB  │
    └───────────────┘                └───────────────┘
            │                                 │
    Event Bus (Async)                  Data Store (Sync)
            │                                 │
┌───────────┴─────────────────────────────────┴───────────────┐
│                    MICROSERVICES LAYER                       │
├───────────────────────────────────────────────────────────────┤
│ • Foundation Infrastructure (Base for all)                   │
│ • AI Response Monitor → Intelligence Engine → Action Center  │
│ • GEO Calculator (Existing)                                  │
│ • Web Crawler (Existing)                                     │
└───────────────────────────────────────────────────────────────┘
```

---

## Module Dependencies

### Dependency Tree
```
Foundation Infrastructure
    ├── AI Response Monitor
    │   └── Intelligence Engine
    │       └── Action Center
    │           └── Unified Dashboard
    ├── GEO Calculator (existing, enhanced)
    └── Web Crawler (existing, enhanced)
```

### Module Relationships
| Module | Depends On | Provides To | Communication |
|--------|------------|-------------|---------------|
| Foundation | None | All | Infrastructure |
| AI Response Monitor | Foundation | Intelligence Engine | Redis Streams |
| Intelligence Engine | Foundation, AI Monitor | Action Center | Redis Streams |
| Action Center | Foundation, Intelligence | Dashboard | Redis Streams + REST |
| Unified Dashboard | All modules | Users | WebSocket + REST |
| GEO Calculator | Foundation | Dashboard | REST API |
| Web Crawler | Foundation | Dashboard | REST API |

---

## Event Flow Architecture

### Redis Streams Topics

```yaml
Event_Topics:
  # Core system events
  system.health:
    Publishers: [All Services]
    Consumers: [Dashboard, Monitoring]
    Purpose: Service health status
    
  system.metrics:
    Publishers: [All Services]
    Consumers: [Prometheus, Dashboard]
    Purpose: Performance metrics
    
  # AI data flow
  ai.responses.raw:
    Publishers: [AI Response Monitor]
    Consumers: [Intelligence Engine]
    Purpose: Raw AI platform responses
    Schema:
      - response_id: uuid
      - platform: string
      - prompt: string
      - response: text
      - timestamp: datetime
      
  ai.citations.extracted:
    Publishers: [Intelligence Engine]
    Consumers: [Action Center, Dashboard]
    Purpose: Extracted citations and sources
    Schema:
      - citation_id: uuid
      - response_id: uuid
      - source_url: string
      - source_type: enum
      - authority_score: float
      
  ai.mentions.analyzed:
    Publishers: [Intelligence Engine]
    Consumers: [Action Center, Dashboard]
    Purpose: Brand mention analysis
    Schema:
      - mention_id: uuid
      - brand: string
      - sentiment: float
      - context: text
      - position: int
      
  metrics.calculated:
    Publishers: [Intelligence Engine]
    Consumers: [Dashboard, Action Center]
    Purpose: GEO scores and metrics
    Schema:
      - metric_id: uuid
      - brand_id: uuid
      - geo_score: float
      - share_of_voice: float
      - trend: object
      
  actions.recommended:
    Publishers: [Action Center]
    Consumers: [Dashboard]
    Purpose: Recommended actions
    Schema:
      - action_id: uuid
      - type: string
      - priority: int
      - details: object
      
  actions.executed:
    Publishers: [Action Center]
    Consumers: [Dashboard, Audit]
    Purpose: Executed actions log
    Schema:
      - action_id: uuid
      - status: string
      - result: object
      - timestamp: datetime
```

---

## API Endpoints Map

### Service Endpoints

```yaml
Foundation_Service:
  Base: http://foundation:3000
  Endpoints:
    - GET /health
    - GET /metrics
    - POST /events
    - GET /services
    
AI_Response_Monitor:
  Base: http://ai-monitor:3001
  Endpoints:
    - POST /collect
    - GET /status/{job_id}
    - GET /platforms
    - POST /schedule
    
Intelligence_Engine:
  Base: http://intelligence:3002
  Endpoints:
    - GET /analysis/{brand_id}
    - GET /citations/{brand_id}
    - GET /mentions/{brand_id}
    - GET /competitors/{brand_id}
    
Action_Center:
  Base: http://actions:3003
  Endpoints:
    - GET /recommendations/{brand_id}
    - POST /execute/{action_id}
    - GET /history/{brand_id}
    - POST /schedule/{action_id}
    
GEO_Calculator:
  Base: http://geo-calc:8000
  Endpoints:
    - POST /api/v1/geo/analyze
    - GET /api/v1/geo/analysis/{domain}
    - POST /api/v1/geo/analyze/batch
    
Web_Crawler:
  Base: http://crawler:3002
  Endpoints:
    - POST /api/crawl
    - GET /api/crawl/{jobId}
    - GET /api/crawl/{jobId}/pages
```

---

## Data Flow Patterns

### 1. AI Response Collection Flow
```
User Request → Dashboard → API Gateway → AI Monitor
    ↓
AI Monitor queries platforms (ChatGPT, Claude, etc.)
    ↓
Raw responses → Redis Stream: ai.responses.raw
    ↓
Intelligence Engine consumes stream
    ↓
Processes data (citations, mentions, sentiment)
    ↓
Publishes to multiple streams:
    - ai.citations.extracted
    - ai.mentions.analyzed
    - metrics.calculated
```

### 2. Action Execution Flow
```
Intelligence Engine → metrics.calculated stream
    ↓
Action Center consumes metrics
    ↓
Generates recommendations based on gaps
    ↓
Publishes to actions.recommended stream
    ↓
Dashboard displays recommendations
    ↓
User approves action
    ↓
Action Center executes (CMS update, content creation)
    ↓
Publishes to actions.executed stream
    ↓
Dashboard shows completion status
```

### 3. Real-time Update Flow
```
Any Service → Redis Stream Event
    ↓
Dashboard WebSocket Service listening
    ↓
Filters events for user's brand
    ↓
Pushes update via WebSocket
    ↓
UI updates without refresh
```

---

## Inter-Service Communication

### Synchronous Communication (REST)
Used for:
- Direct queries (GET requests)
- User-initiated actions
- Health checks
- Service discovery

### Asynchronous Communication (Redis Streams)
Used for:
- Event notifications
- Data processing pipelines
- Background jobs
- Real-time updates

### Communication Rules
1. **No direct database access** between services
2. **Events for state changes**, REST for queries
3. **Circuit breakers** on all external calls
4. **Retry with exponential backoff**
5. **Timeout after 5 seconds**

---

## Database Access Patterns

### Service Database Ownership
| Service | Database/Schema | Access |
|---------|----------------|--------|
| Foundation | public.services, public.events | Read/Write |
| AI Monitor | ai_monitor.* | Read/Write |
| Intelligence | intelligence.* | Read/Write |
| Action Center | actions.* | Read/Write |
| GEO Calculator | geo.* | Read/Write |
| Web Crawler | crawler.* | Read/Write |

### Shared Data Access
- **Read-only views** for cross-service data
- **No direct foreign keys** across schemas
- **Event sourcing** for audit trail
- **CQRS pattern** for read/write separation

---

## Message Queue Patterns

### BullMQ Job Queues
```yaml
Queues:
  ai-collection-queue:
    Processor: AI Response Monitor
    Jobs:
      - Scheduled platform queries
      - On-demand collections
      - Retry failed collections
    
  analysis-queue:
    Processor: Intelligence Engine
    Jobs:
      - Citation extraction
      - Sentiment analysis
      - GEO score calculation
    
  action-queue:
    Processor: Action Center
    Jobs:
      - Content generation
      - CMS updates
      - Report generation
    
  crawler-queue:
    Processor: Web Crawler
    Jobs:
      - Site crawling
      - Sitemap processing
      - Content extraction
```

---

## Security & Authentication Flow

### JWT Token Flow
```
User Login → Dashboard
    ↓
Dashboard → API Gateway (credentials)
    ↓
API Gateway validates → Returns JWT
    ↓
Dashboard stores JWT (localStorage)
    ↓
All requests include JWT in header
    ↓
API Gateway validates JWT → Routes to service
    ↓
Service trusts API Gateway validation
```

### Service-to-Service Auth
- Internal services use **mTLS** (if using service mesh)
- Or **shared secret** in headers
- Never exposed to external network

---

## Monitoring Integration Points

### Metrics Collection
```
Each Service → Prometheus metrics endpoint (:9090/metrics)
    ↓
Prometheus scrapes every 30s
    ↓
Grafana queries Prometheus
    ↓
Dashboards show real-time metrics
```

### Log Aggregation
```
Each Service → Stdout/Stderr logs
    ↓
Docker → Loki driver
    ↓
Loki indexes logs
    ↓
Grafana queries Loki
    ↓
Unified log viewing
```

### Distributed Tracing
```
Request enters → API Gateway generates trace ID
    ↓
Trace ID passed to all services
    ↓
Each service adds span
    ↓
Spans sent to Jaeger/Tempo
    ↓
Full request trace visible
```

---

## Deployment Dependencies

### Startup Order
1. **Infrastructure** (PostgreSQL, Redis)
2. **Foundation** (Service discovery, event bus)
3. **Core Services** (AI Monitor, Intelligence, Actions)
4. **API Gateway** (Caddy)
5. **Dashboard** (Frontend)

### Health Check Chain
```
Dashboard → API Gateway → All Services → Dependencies
                                              ↓
                                    PostgreSQL, Redis
```

### Graceful Shutdown
1. Stop accepting new requests
2. Complete in-flight requests (30s timeout)
3. Close Redis Stream consumers
4. Close database connections
5. Exit with status 0

---

## Configuration Sharing

### Environment Variables
```bash
# Shared across all services
DATABASE_URL=postgresql://user:pass@postgres:5432/rankmybrand
REDIS_URL=redis://redis:6379
JWT_SECRET=shared-secret-key
NODE_ENV=production

# Service-specific
AI_MONITOR_PORT=3001
INTELLIGENCE_PORT=3002
ACTION_CENTER_PORT=3003
```

### Shared Configuration
- Stored in PostgreSQL `config` table
- Cached in Redis for performance
- Services poll for changes every 60s
- Or receive update events via streams

---

## Testing Integration Points

### Integration Test Strategy
1. **Docker Compose** for test environment
2. **Seed data** in all databases
3. **Test events** published to streams
4. **Verify** downstream consumption
5. **Check** final state in dashboard

### Contract Testing
- Each service publishes **OpenAPI spec**
- Consumer tests against provider spec
- Breaking changes caught early
- Versioning for backward compatibility

---

## Scaling Considerations

### Horizontal Scaling
- **Stateless services**: Scale by adding instances
- **Load balancing**: Via Docker Swarm
- **Shared state**: In Redis/PostgreSQL
- **Event partitioning**: For parallel processing

### Bottleneck Points
1. **PostgreSQL**: Add read replicas when needed
2. **Redis**: Move to Redis Cluster at scale
3. **AI APIs**: Rate limiting and queuing
4. **Browser automation**: Worker pool expansion

---

## Disaster Recovery

### Backup Strategy
- PostgreSQL: Daily backups to S3
- Redis: AOF persistence + snapshots
- Configuration: Git repository
- Secrets: Encrypted backup

### Recovery Procedures
1. Restore databases from backup
2. Replay events from stream (if within retention)
3. Restart services in order
4. Verify health checks
5. Resume processing

---

## Future Integration Points

### Planned Integrations
1. **Webhook System**: For external notifications
2. **GraphQL Gateway**: For complex queries
3. **WebRTC**: For real-time collaboration
4. **Plugin System**: For extensibility
5. **Data Lake**: For analytics

### Reserved Topics/Queues
- `plugins.*` - For future plugin system
- `analytics.*` - For data warehouse
- `webhooks.*` - For external integrations
- `collaboration.*` - For real-time features

---

*This map is a living document. Update as modules are built and patterns emerge.*