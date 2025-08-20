# MODULE INTEGRATION MAP - RANKMYBRAND.AI
*Last Updated: December 2024 - PLATFORM LIVE*

## 🚀 PLATFORM STATUS: LAUNCHED AND OPERATIONAL

### Current Live Services
- **Dashboard**: http://localhost:3000 ✅
- **Launch Script**: `/launch.sh` - Starts all services
- **Stop Script**: `/stop.sh` - Graceful shutdown
- **All Modules**: 100% Complete and integrated

## 🔄 COMPLETE INTEGRATION ARCHITECTURE

### Data Flow Overview
```
User Input → Dashboard (Module 4)
    ↓
Collection Request → AI Collector (Module 1)
    ↓
Raw Responses → Intelligence Engine (Module 2)
    ↓
Metrics & Gaps → Action Center (Module 3)
    ↓
Recommendations → Dashboard (Module 4)
    ↓
User Action → Execution → CMS/Platforms
```

## 📡 EVENT STREAMS MAP

### Redis Streams Topology
```yaml
Streams:
  ai.responses.raw:
    Producer: AI Collector (Module 1)
    Consumers: 
      - Intelligence Engine (Module 2)
      - Dashboard (Module 4) [for raw data view]
    
  metrics.calculated:
    Producer: Intelligence Engine (Module 2)
    Consumers:
      - Action Center (Module 3)
      - Dashboard (Module 4)
    
  gaps.identified:
    Producer: Intelligence Engine (Module 2)
    Consumers:
      - Action Center (Module 3)
      - Dashboard (Module 4)
    
  recommendations.ready:
    Producer: Action Center (Module 3)
    Consumers:
      - Dashboard (Module 4)
      - Notification Service
    
  automation.status:
    Producer: Action Center (Module 3)
    Consumers:
      - Dashboard (Module 4)
      - Audit Logger
    
  system.health:
    Producers: All Modules
    Consumers:
      - Dashboard (Module 4)
      - Monitoring Stack
```

## 🔌 MODULE-TO-MODULE INTERFACES

### Module 1 → Module 2
```typescript
// Event: ai.responses.raw
interface AIResponse {
  id: string;
  platform: 'chatgpt' | 'claude' | 'perplexity' | ...;
  promptText: string;
  responseText: string;
  citations: Citation[];
  metadata: {
    timestamp: Date;
    latency: number;
    model: string;
    temperature?: number;
  };
  sessionId: string;
  brandId: string;
}
```

### Module 2 → Module 3
```typescript
// Event: metrics.calculated
interface CalculatedMetrics {
  brandId: string;
  timestamp: Date;
  geoScore: number; // 0-100
  shareOfVoice: number; // percentage
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  platformScores: Map<Platform, Score>;
  trends: TrendData[];
}

// Event: gaps.identified
interface ContentGap {
  id: string;
  brandId: string;
  type: 'missing_info' | 'competitor_advantage' | 'unanswered_query';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  affectedQueries: string[];
  competitorAdvantage?: CompetitorData;
  suggestedAction: string;
}
```

### Module 3 → Module 4
```typescript
// Event: recommendations.ready
interface Recommendation {
  id: string;
  brandId: string;
  title: string;
  description: string;
  type: 'content' | 'schema' | 'faq' | 'meta';
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: number; // estimated % improvement
  effort: 'low' | 'medium' | 'high';
  autoApproved: boolean;
  content?: GeneratedContent;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
}

// Event: automation.status
interface AutomationStatus {
  recommendationId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  progress: number; // 0-100
  platform?: 'wordpress' | 'shopify' | 'webflow';
  changes?: Change[];
  error?: string;
  rollbackAvailable: boolean;
}
```

### Module 4 WebSocket Events
```typescript
// WebSocket Server (Module 4 specific)
interface WebSocketEvents {
  // Incoming from backend
  'metrics.update': MetricsData;
  'recommendations.new': Recommendation[];
  'automation.status': AutomationStatus;
  'system.alert': SystemAlert;
  'activity.stream': ActivityItem;
  'competitor.update': CompetitorChange;
  
  // Outgoing from client
  'request.metrics': { brandId: string };
  'action.approve': { recommendationId: string };
  'action.reject': { recommendationId: string };
  'automation.pause': { recommendationId: string };
  'automation.rollback': { recommendationId: string };
  'export.request': ExportConfig;
}
```

## 🗄️ SHARED DATABASE SCHEMA

### Cross-Module Tables
```sql
-- Used by multiple modules
CREATE TABLE brands (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  domain VARCHAR(255),
  created_at TIMESTAMP,
  -- Used by: All modules
);

CREATE TABLE competitors (
  id UUID PRIMARY KEY,
  brand_id UUID REFERENCES brands(id),
  name VARCHAR(255),
  domain VARCHAR(255),
  -- Used by: Modules 2, 3, 4
);

CREATE TABLE platforms (
  id UUID PRIMARY KEY,
  name VARCHAR(50),
  api_enabled BOOLEAN,
  scraping_enabled BOOLEAN,
  -- Used by: Modules 1, 2, 4
);
```

### Module-Specific Tables with Foreign Keys
```sql
-- Module 1 tables referencing shared
CREATE TABLE ai_responses (
  brand_id UUID REFERENCES brands(id),
  platform_id UUID REFERENCES platforms(id),
  -- Module 1 specific columns...
);

-- Module 2 tables referencing Module 1
CREATE TABLE brand_mentions (
  response_id UUID REFERENCES ai_responses(id),
  brand_id UUID REFERENCES brands(id),
  competitor_id UUID REFERENCES competitors(id),
  -- Module 2 specific columns...
);

-- Module 3 tables referencing Module 2
CREATE TABLE recommendations (
  brand_id UUID REFERENCES brands(id),
  gap_id UUID REFERENCES content_gaps(id),
  -- Module 3 specific columns...
);

-- Module 4 tables referencing all
CREATE TABLE dashboard_views (
  user_id UUID,
  brand_id UUID REFERENCES brands(id),
  -- Module 4 specific columns...
);
```

## 🔐 AUTHENTICATION & AUTHORIZATION

### API Gateway Routes (Caddy)
```
api.rankmybrand.ai {
  /v1/collect/* → Module 1 (port 8001)
  /v1/analyze/* → Module 2 (port 8002)
  /v1/actions/* → Module 3 (port 8003)
  /v1/dashboard/* → Module 4 (port 3000)
  /ws/* → WebSocket Server (port 3001)
}
```

### JWT Token Flow
```typescript
// Shared JWT structure
interface JWTPayload {
  userId: string;
  brandId: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
  iat: number;
  exp: number;
}

// Module authentication
const authenticateRequest = (token: string): JWTPayload => {
  // All modules use same JWT secret from env
  return jwt.verify(token, process.env.JWT_SECRET);
};
```

## 🏃 JOB QUEUE INTEGRATION

### BullMQ Queue Structure
```typescript
// Shared job types
enum JobType {
  // Module 1
  COLLECT_AI_RESPONSE = 'collect-ai-response',
  REFRESH_CACHE = 'refresh-cache',
  
  // Module 2
  ANALYZE_RESPONSE = 'analyze-response',
  CALCULATE_METRICS = 'calculate-metrics',
  
  // Module 3
  GENERATE_CONTENT = 'generate-content',
  EXECUTE_ACTION = 'execute-action',
  
  // Module 4
  EXPORT_REPORT = 'export-report',
  SEND_NOTIFICATION = 'send-notification'
}

// Job priorities
enum Priority {
  CRITICAL = 1,  // User-initiated actions
  HIGH = 2,      // Real-time updates
  NORMAL = 3,    // Regular processing
  LOW = 4        // Background tasks
}
```

## 📊 METRICS & MONITORING

### Shared Prometheus Metrics
```typescript
// All modules expose these metrics
const commonMetrics = {
  // Request metrics
  'http_requests_total': Counter,
  'http_request_duration_seconds': Histogram,
  
  // Business metrics
  'geo_score': Gauge,
  'share_of_voice': Gauge,
  'recommendations_generated': Counter,
  'actions_executed': Counter,
  
  // System metrics
  'memory_usage_bytes': Gauge,
  'cpu_usage_percent': Gauge,
  'redis_connections': Gauge,
  'postgres_connections': Gauge
};
```

### Health Check Endpoints
```typescript
// Every module implements
GET /health
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  version: string,
  uptime: number,
  checks: {
    database: boolean,
    redis: boolean,
    external_apis?: boolean
  }
}
```

## 🔄 INTEGRATION TESTING

### End-to-End Test Flow
```typescript
describe('Complete Integration Flow', () => {
  it('should process from prompt to dashboard update', async () => {
    // 1. Dashboard triggers collection
    await dashboard.requestAnalysis('test-prompt');
    
    // 2. AI Collector processes
    await waitForEvent('ai.responses.raw');
    
    // 3. Intelligence Engine analyzes
    await waitForEvent('metrics.calculated');
    
    // 4. Action Center generates recommendation
    await waitForEvent('recommendations.ready');
    
    // 5. Dashboard receives update via WebSocket
    const update = await waitForWebSocketMessage('recommendations.new');
    
    expect(update).toHaveProperty('recommendations');
    expect(update.recommendations).toHaveLength(greaterThan(0));
  });
});
```

## 🚀 DEPLOYMENT DEPENDENCIES

### Service Start Order
```yaml
# Must start in this order
1. Infrastructure:
   - PostgreSQL
   - Redis
   - Caddy

2. Core Services:
   - Module 1: AI Collector
   - Module 2: Intelligence Engine
   
3. Processing Services:
   - Module 3: Action Center
   - WebSocket Server
   
4. Frontend:
   - Module 4: Dashboard
```

### Environment Variables (Shared)
```env
# All modules need these
DATABASE_URL=postgresql://user:pass@localhost:5432/rankmybrand
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
NODE_ENV=production

# Module-specific (examples)
OPENAI_API_KEY=sk-...        # Modules 1, 3
ANTHROPIC_API_KEY=sk-ant-... # Modules 1, 3
SERP_API_KEY=...             # Module 1
VERCEL_URL=...               # Module 4
WEBSOCKET_URL=...            # Module 4
```

## 📈 PERFORMANCE REQUIREMENTS

### Inter-Module Latency
```yaml
Module Communication SLAs:
  - Event publishing: <10ms
  - Database queries: <50ms
  - API calls between modules: <100ms
  - WebSocket broadcast: <50ms
  - End-to-end flow: <5 seconds
```

### Throughput Requirements
```yaml
Capacity Targets:
  - Module 1: 1000 collections/hour
  - Module 2: 5000 analyses/hour
  - Module 3: 500 content generations/hour
  - Module 4: 100 concurrent WebSocket connections
  - Redis Streams: 10,000 messages/second
```

## 🔧 TROUBLESHOOTING GUIDE

### Common Integration Issues

#### Issue: Events not being consumed
```bash
# Check Redis Streams
redis-cli XINFO STREAM ai.responses.raw
redis-cli XINFO GROUPS ai.responses.raw

# Check consumer lag
redis-cli XPENDING ai.responses.raw intelligence-processor-group
```

#### Issue: WebSocket disconnections
```bash
# Check WebSocket server logs
docker logs websocket-server

# Monitor connections
curl http://localhost:3001/metrics | grep websocket_connections
```

#### Issue: Database connection pool exhausted
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND state_change < now() - interval '10 minutes';
```

---

**INTEGRATION COMPLETE!** All modules are fully integrated and ready for production deployment.