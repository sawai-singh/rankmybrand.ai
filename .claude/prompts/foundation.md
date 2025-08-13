# FOUNDATION INFRASTRUCTURE MODULE - IMPLEMENTATION SPECIFICATION

## Module Identity
- **Name**: Foundation Infrastructure Module (Lean Version)
- **ID**: FOUNDATION-001
- **Version**: 2.0.0
- **Priority**: CRITICAL - All other modules depend on this
- **Timeline**: 1 week
- **Cost**: <$50/month using free tiers and self-hosted solutions

## Purpose
Provide production-quality infrastructure that enables:
- Real-time event processing (vs AthenaHQ's batch)
- Sub-100ms latency (vs their 500ms+)
- 99.99% availability
- Auto-scaling capabilities
- Comprehensive monitoring
- All at 1/100th the cost of enterprise solutions

## Technology Stack

### Core Components

#### 1. Message Queue System
**Technology**: Redis Streams + BullMQ
```javascript
// Redis Streams for event bus (Kafka-like functionality)
const streams = {
  'ai.responses': { maxLen: 100000, consumer: 'ai-processor-group' },
  'metrics.raw': { maxLen: 50000, consumer: 'metrics-processor-group' },
  'actions.pending': { maxLen: 10000, consumer: 'action-processor-group' }
};

// BullMQ for job processing
const queues = {
  'crawl-jobs': { concurrency: 5, rateLimit: { max: 100, duration: 60000 } },
  'ai-queries': { concurrency: 10, rateLimit: { max: 50, duration: 60000 } }
};
```

#### 2. API Gateway
**Technology**: Caddy 2.7.6
- Automatic HTTPS with Let's Encrypt
- Built-in rate limiting
- JWT authentication
- Reverse proxy to microservices

#### 3. Databases
- **Primary**: PostgreSQL 16.1 with TimescaleDB 2.13.1
- **Cache**: Redis 7.2.4 (same instance as message queue)
- **Vector**: ChromaDB 0.4.22 (self-hosted)
- **Object Storage**: MinIO (S3-compatible)

#### 4. Monitoring Stack
- **Metrics**: Prometheus 2.48.1 + Grafana 10.3.1
- **Logs**: Grafana Loki 2.9.4
- **Traces**: Grafana Tempo 2.3.1
- **Uptime**: Uptime Kuma
- **Errors**: Sentry (free tier)

#### 5. Container Orchestration
**Technology**: Docker Swarm
- Simpler than Kubernetes
- Built into Docker
- No additional cost
- Can migrate to K8s later when needed

## Database Schema

```sql
-- Main foundation database (PostgreSQL with TimescaleDB)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Core events table (event sourcing)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable for automatic partitioning
SELECT create_hypertable('events', 'created_at', chunk_time_interval => INTERVAL '1 day');

-- API keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  rate_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Service registry for service discovery
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  health_endpoint VARCHAR(255),
  status VARCHAR(20) DEFAULT 'unknown',
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_events_stream ON events(stream_id, created_at DESC);
CREATE INDEX idx_api_keys_active ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_services_status ON services(status, last_heartbeat DESC);
```

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  # PostgreSQL with TimescaleDB
  postgres:
    image: timescale/timescaledb:2.13.1-pg16
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: rankmybrand
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 10s
      retries: 5

  # Redis for cache + streams + queues
  redis:
    image: redis:7.2.4-alpine
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  # Caddy API Gateway (automatic HTTPS!)
  caddy:
    image: caddy:2.7.6-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - postgres
      - redis

  # Prometheus
  prometheus:
    image: prom/prometheus:v2.48.1
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"

  # Grafana
  grafana:
    image: grafana/grafana:10.3.1
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: redis-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3000:3000"
    depends_on:
      - prometheus

  # Loki for logs
  loki:
    image: grafana/loki:2.9.4
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  # ChromaDB for vector storage
  chromadb:
    image: chromadb/chroma:0.4.22
    volumes:
      - chroma_data:/chroma/chroma
    ports:
      - "8000:8000"

  # BullMQ Board for job monitoring
  bullboard:
    image: deadly0/bull-board:latest
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    ports:
      - "3010:3000"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
  prometheus_data:
  grafana_data:
  loki_data:
  chroma_data:

networks:
  default:
    name: rankmybrand_network
```

## Core Implementation Files

### 1. Event Bus Implementation (`src/event-bus.ts`)
```typescript
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export class EventBus {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
  }
  
  async publish(stream: string, event: any): Promise<string> {
    const id = await this.redis.xadd(
      stream,
      'MAXLEN', '~', '100000',  // Keep ~100K messages
      '*',  // Auto-generate ID
      'event_type', event.type,
      'data', JSON.stringify(event.data),
      'timestamp', Date.now().toString(),
      'correlation_id', event.correlationId || uuidv4()
    );
    
    // Update metrics
    await this.redis.hincrby('metrics:events', stream, 1);
    
    return id;
  }
  
  async subscribe(
    stream: string, 
    group: string, 
    consumer: string,
    handler: (event: any) => Promise<void>
  ) {
    // Create consumer group if not exists
    try {
      await this.redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
    } catch (err) {
      // Group already exists, ignore
    }
    
    // Consume messages
    while (true) {
      const messages = await this.redis.xreadgroup(
        'GROUP', group, consumer,
        'COUNT', '10',
        'BLOCK', '1000',
        'STREAMS', stream, '>'
      );
      
      if (messages) {
        for (const [stream, streamMessages] of messages) {
          for (const message of streamMessages) {
            const [id, fields] = message;
            const event = this.parseMessage(fields);
            
            try {
              await handler(event);
              // Acknowledge message
              await this.redis.xack(stream, group, id);
            } catch (error) {
              console.error('Error processing message:', error);
              // Message will be retried
            }
          }
        }
      }
    }
  }
  
  private parseMessage(fields: string[]): any {
    const result: any = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      result[key] = key === 'data' ? JSON.parse(value) : value;
    }
    return result;
  }
}
```

### 2. Service Registry (`src/service-registry.ts`)
```typescript
import { Pool } from 'pg';

export class ServiceRegistry {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rankmybrand',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    });
  }
  
  async register(service: {
    name: string;
    host: string;
    port: number;
    healthEndpoint?: string;
  }) {
    const query = `
      INSERT INTO services (name, host, port, health_endpoint, status, last_heartbeat)
      VALUES ($1, $2, $3, $4, 'healthy', NOW())
      ON CONFLICT (name) 
      DO UPDATE SET 
        host = $2,
        port = $3,
        health_endpoint = $4,
        status = 'healthy',
        last_heartbeat = NOW()
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      service.name,
      service.host,
      service.port,
      service.healthEndpoint || '/health'
    ]);
    
    return result.rows[0].id;
  }
  
  async heartbeat(serviceName: string) {
    await this.pool.query(
      'UPDATE services SET last_heartbeat = NOW() WHERE name = $1',
      [serviceName]
    );
  }
  
  async discover(serviceName: string) {
    const result = await this.pool.query(
      'SELECT * FROM services WHERE name = $1 AND status = $2',
      [serviceName, 'healthy']
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Service ${serviceName} not found or unhealthy`);
    }
    
    return result.rows[0];
  }
}
```

### 3. Rate Limiter (`src/rate-limiter.ts`)
```typescript
import Redis from 'ioredis';

export class RateLimiter {
  private redis: Redis;
  private maxTokens: number = 1000;
  private refillRate: number = 100;  // tokens per second
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }
  
  async checkLimit(apiKey: string): Promise<boolean> {
    const key = `rate_limit:${apiKey}`;
    const now = Date.now();
    
    // Get current bucket state
    const bucket = await this.redis.hgetall(key);
    
    if (!bucket.tokens) {
      // Initialize bucket
      await this.redis.hmset(key, {
        tokens: this.maxTokens,
        lastRefill: now
      });
      return true;
    }
    
    // Calculate tokens to add
    const timePassed = (now - parseInt(bucket.lastRefill)) / 1000;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);
    const newTokens = Math.min(
      this.maxTokens,
      parseInt(bucket.tokens) + tokensToAdd
    );
    
    if (newTokens < 1) {
      throw new Error('Rate limit exceeded');
    }
    
    // Consume token
    await this.redis.hmset(key, {
      tokens: newTokens - 1,
      lastRefill: now
    });
    
    return true;
  }
}
```

### 4. Microservice Base Class (`src/microservice.ts`)
```typescript
import express from 'express';
import { EventBus } from './event-bus';
import { ServiceRegistry } from './service-registry';
import promClient from 'prom-client';

export class MicroService {
  private app: express.Application;
  private eventBus: EventBus;
  private registry: ServiceRegistry;
  private metrics: promClient.Registry;
  
  constructor(private serviceName: string) {
    this.app = express();
    this.eventBus = new EventBus();
    this.registry = new ServiceRegistry();
    this.metrics = new promClient.Registry();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupMetrics();
  }
  
  private setupMiddleware() {
    this.app.use(express.json());
    
    // Correlation ID middleware
    this.app.use((req, res, next) => {
      req.correlationId = req.headers['x-correlation-id'] || 
                          crypto.randomUUID();
      res.setHeader('X-Correlation-ID', req.correlationId);
      next();
    });
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path} - ${req.correlationId}`);
      next();
    });
  }
  
  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        service: this.serviceName,
        timestamp: new Date().toISOString()
      });
    });
    
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', this.metrics.contentType);
      res.end(await this.metrics.metrics());
    });
  }
  
  private setupMetrics() {
    promClient.collectDefaultMetrics({ 
      register: this.metrics,
      prefix: `${this.serviceName}_`
    });
  }
  
  async start(port: number) {
    // Register with service discovery
    await this.registry.register({
      name: this.serviceName,
      host: process.env.HOSTNAME || 'localhost',
      port,
      healthEndpoint: '/health'
    });
    
    // Start heartbeat
    setInterval(() => this.registry.heartbeat(this.serviceName), 30000);
    
    // Start server
    this.app.listen(port, () => {
      console.log(`${this.serviceName} listening on port ${port}`);
    });
  }
  
  // Helper methods for derived services
  protected getEventBus() { return this.eventBus; }
  protected getApp() { return this.app; }
}
```

## Deliverables Checklist
- [ ] Docker Compose setup with all services
- [ ] PostgreSQL schema with TimescaleDB
- [ ] Redis Streams event bus implementation
- [ ] Caddy configuration with auto-HTTPS
- [ ] Service discovery implementation
- [ ] BullMQ job queue setup
- [ ] Prometheus + Grafana monitoring
- [ ] Health check endpoints
- [ ] API authentication with JWT
- [ ] Rate limiting implementation
- [ ] Circuit breaker pattern
- [ ] Integration test suite
- [ ] Deployment script
- [ ] README with setup instructions

## Testing Requirements

### Integration Tests
```javascript
describe('Foundation Integration Tests', () => {
  it('should publish and consume events via Redis Streams', async () => {
    const eventBus = new EventBus();
    const testEvent = {
      type: 'user.created',
      data: { id: '123', name: 'Test User' }
    };
    
    // Publish event
    const messageId = await eventBus.publish('test.stream', testEvent);
    expect(messageId).toBeTruthy();
    
    // Consume event
    const received = await new Promise((resolve) => {
      eventBus.subscribe('test.stream', 'test-group', 'test-consumer', 
        async (event) => {
          resolve(event);
        }
      );
    });
    
    expect(received.data).toEqual(testEvent.data);
  });
  
  it('should enforce rate limits', async () => {
    const limiter = new RateLimiter();
    const apiKey = 'test-key-12345';
    
    // Should allow initial requests
    for (let i = 0; i < 100; i++) {
      await limiter.checkLimit(apiKey);
    }
    
    // Should eventually hit limit
    let limitHit = false;
    for (let i = 0; i < 1000; i++) {
      try {
        await limiter.checkLimit(apiKey);
      } catch (err) {
        limitHit = true;
        break;
      }
    }
    
    expect(limitHit).toBe(true);
  });
});
```

## Success Criteria
- All services start with `docker-compose up`
- Health checks return 200 OK
- Can publish 10K events/second to Redis Streams
- Grafana shows real metrics
- API gateway handles 1000 req/sec
- Total cost < $50/month
- Memory usage < 4GB
- Setup time < 30 minutes

## Commands to Run
```bash
# Create module directory
mkdir -p /Users/sawai/Desktop/rankmybrand.ai/services/foundation
cd /Users/sawai/Desktop/rankmybrand.ai/services/foundation

# Initialize project
npm init -y
npm install express ioredis pg bullmq prom-client uuid
npm install -D @types/node @types/express typescript jest @types/jest

# Start services
docker-compose up -d

# Check health
curl http://localhost/health

# View logs
docker-compose logs -f

# Run tests
npm test

# Access Grafana
open http://localhost:3000
```

## Important Notes
1. **NO MOCKS** - All connections are real
2. **Production Quality** - Error handling, logging, monitoring included
3. **Cost Effective** - Using free/self-hosted solutions
4. **Scalable** - Can grow from 1 to 10,000 users
5. **Beats AthenaHQ** - Real-time vs batch, faster, cheaper
