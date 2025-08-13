# AI RESPONSE MONITOR MODULE - IMPLEMENTATION SPECIFICATION

## Module Identity
- **Name**: AI Response Monitor
- **ID**: AI-MONITOR-001
- **Version**: 1.0.0
- **Priority**: HIGH - Critical for GEO data collection
- **Timeline**: 2 weeks
- **Dependencies**: Foundation Infrastructure Module

## Purpose
Collect and monitor responses from AI platforms (ChatGPT, Claude, Perplexity, Google SGE, Bing Chat) in real-time, beating AthenaHQ's daily batch processing with instant data collection and 8+ AI platform support (vs their 5).

## Key Differentiators vs AthenaHQ
- **Real-time collection** vs their daily batch
- **8+ AI platforms** vs their 5
- **Session management** for continuous monitoring
- **Anti-detection** measures built-in
- **Cost-efficient** API usage with caching
- **Event-driven** architecture for instant processing

## Technology Stack

### Core Technologies
- **Language**: TypeScript (Node.js 20.11.0)
- **Base Class**: Extends Foundation Microservice
- **Browser Automation**: Playwright (for web scraping)
- **HTTP Client**: Axios with retry logic
- **Queue**: BullMQ for job processing
- **Cache**: Redis for response caching
- **Storage**: PostgreSQL for response history

### AI Platform Integrations

#### 1. API-Based Platforms
```typescript
interface APIProvider {
  name: string;
  endpoint: string;
  authType: 'bearer' | 'api-key' | 'custom';
  rateLimit: { requests: number; window: number };
}

const providers = {
  openai: {
    name: 'ChatGPT',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    rateLimit: { requests: 3000, window: 60000 }
  },
  anthropic: {
    name: 'Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-opus', 'claude-3-sonnet'],
    rateLimit: { requests: 1000, window: 60000 }
  },
  perplexity: {
    name: 'Perplexity',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    models: ['pplx-70b', 'pplx-7b'],
    rateLimit: { requests: 50, window: 60000 }
  }
}
```

#### 2. Web Scraping Platforms
```typescript
interface ScrapingTarget {
  name: string;
  url: string;
  selectors: {
    input: string;
    submit: string;
    response: string;
    citations?: string;
  };
  requiresAuth: boolean;
}

const scrapingTargets = {
  googleSGE: {
    name: 'Google SGE',
    url: 'https://google.com',
    requiresAuth: false,
    antiDetection: true
  },
  bingChat: {
    name: 'Bing Chat',
    url: 'https://bing.com/chat',
    requiresAuth: true,
    antiDetection: true
  },
  you: {
    name: 'You.com',
    url: 'https://you.com',
    requiresAuth: false
  },
  phind: {
    name: 'Phind',
    url: 'https://phind.com',
    requiresAuth: false
  },
  gemini: {
    name: 'Google Gemini',
    url: 'https://gemini.google.com',
    requiresAuth: true
  }
}
```

## Database Schema

```sql
-- AI Response Monitor Schema
CREATE SCHEMA IF NOT EXISTS ai_monitor;

-- AI Platforms Table
CREATE TABLE ai_monitor.platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) CHECK (type IN ('api', 'scraping')),
  endpoint VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompts Table
CREATE TABLE ai_monitor.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_type VARCHAR(50) DEFAULT 'brand_mention',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Responses Table (TimescaleDB)
CREATE TABLE ai_monitor.responses (
  id UUID DEFAULT uuid_generate_v4(),
  platform_id UUID REFERENCES ai_monitor.platforms(id),
  prompt_id UUID REFERENCES ai_monitor.prompts(id),
  session_id VARCHAR(255),
  response_text TEXT NOT NULL,
  response_metadata JSONB DEFAULT '{}',
  citations JSONB DEFAULT '[]',
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
);

-- Convert to hypertable
SELECT create_hypertable('ai_monitor.responses', 'created_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE);

-- Sessions Table
CREATE TABLE ai_monitor.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id UUID REFERENCES ai_monitor.platforms(id),
  session_token TEXT,
  cookies JSONB,
  user_agent TEXT,
  proxy_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Collection Jobs Table
CREATE TABLE ai_monitor.collection_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL,
  platforms JSONB NOT NULL,
  prompts JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  results JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_responses_platform ON ai_monitor.responses(platform_id, created_at DESC);
CREATE INDEX idx_responses_prompt ON ai_monitor.responses(prompt_id, created_at DESC);
CREATE INDEX idx_responses_session ON ai_monitor.responses(session_id);
CREATE INDEX idx_jobs_status ON ai_monitor.collection_jobs(status, created_at DESC);
CREATE INDEX idx_sessions_active ON ai_monitor.sessions(platform_id, is_active) WHERE is_active = true;
```

## Core Implementation

### 1. Main Service Class (`src/services/ai-monitor.service.ts`)
```typescript
import { Microservice } from '../../foundation/src/core/microservice';
import { CollectorOrchestrator } from '../collectors/orchestrator';
import { SessionManager } from '../session/session-manager';

export class AIMonitorService extends Microservice {
  private orchestrator: CollectorOrchestrator;
  private sessionManager: SessionManager;
  
  constructor() {
    super({
      serviceName: 'ai-response-monitor',
      version: '1.0.0',
      port: 3001
    });
    
    this.orchestrator = new CollectorOrchestrator();
    this.sessionManager = new SessionManager();
  }
  
  protected async initialize(): Promise<void> {
    // Initialize collectors
    await this.orchestrator.initialize();
    
    // Subscribe to collection requests
    await this.subscribeToEvents();
    
    // Start job processor
    await this.startJobProcessor();
  }
  
  private async subscribeToEvents(): Promise<void> {
    await this.getEventBus().subscribe(
      'ai.collection.requests',
      'ai-monitor-group',
      'ai-monitor-1',
      async (event) => {
        await this.handleCollectionRequest(event);
      }
    );
  }
}
```

### 2. Collector Orchestrator (`src/collectors/orchestrator.ts`)
```typescript
export class CollectorOrchestrator {
  private collectors: Map<string, BaseCollector>;
  private queue: Queue;
  
  async collectResponses(
    platforms: string[],
    prompts: string[],
    options: CollectionOptions
  ): Promise<CollectionResult[]> {
    const jobs = [];
    
    for (const platform of platforms) {
      const collector = this.collectors.get(platform);
      if (!collector) continue;
      
      for (const prompt of prompts) {
        jobs.push(this.queue.add('collect', {
          platform,
          prompt,
          options
        }));
      }
    }
    
    // Process in parallel with rate limiting
    const results = await Promise.allSettled(jobs);
    
    // Publish results to event bus
    await this.publishResults(results);
    
    return results;
  }
}
```

### 3. Base Collector Class (`src/collectors/base-collector.ts`)
```typescript
export abstract class BaseCollector {
  protected rateLimiter: RateLimiter;
  protected cache: Redis;
  
  abstract collect(prompt: string, options?: any): Promise<AIResponse>;
  
  protected async withRateLimit<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const canProceed = await this.rateLimiter.checkLimit(key);
    if (!canProceed.allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${canProceed.retryAfter}s`);
    }
    return fn();
  }
  
  protected async withCache<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);
    
    const result = await fn();
    await this.cache.setex(key, ttl, JSON.stringify(result));
    return result;
  }
}
```

### 4. OpenAI Collector (`src/collectors/openai.collector.ts`)
```typescript
export class OpenAICollector extends BaseCollector {
  private client: OpenAI;
  
  async collect(prompt: string, options?: any): Promise<AIResponse> {
    const cacheKey = `openai:${crypto.createHash('md5').update(prompt).digest('hex')}`;
    
    return this.withCache(cacheKey, 3600, async () => {
      return this.withRateLimit('openai', async () => {
        const startTime = Date.now();
        
        const completion = await this.client.chat.completions.create({
          model: options?.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000
        });
        
        const response: AIResponse = {
          platform: 'openai',
          prompt,
          response: completion.choices[0].message.content,
          model: completion.model,
          tokensUsed: completion.usage?.total_tokens,
          processingTime: Date.now() - startTime,
          cost: this.calculateCost(completion.usage),
          timestamp: new Date()
        };
        
        // Publish to event bus
        await this.eventBus.publish('ai.responses.raw', {
          type: 'response.collected',
          data: response
        });
        
        return response;
      });
    });
  }
}
```

### 5. Playwright Scraper (`src/collectors/playwright.collector.ts`)
```typescript
export class PlaywrightCollector extends BaseCollector {
  private browser: Browser;
  private antiDetection: AntiDetection;
  
  async collect(prompt: string, target: ScrapingTarget): Promise<AIResponse> {
    const context = await this.createStealthContext();
    const page = await context.newPage();
    
    try {
      // Navigate with anti-detection
      await this.antiDetection.preparePageEvasion(page);
      await page.goto(target.url, { waitUntil: 'networkidle' });
      
      // Handle authentication if needed
      if (target.requiresAuth) {
        await this.handleAuth(page, target);
      }
      
      // Input prompt
      await page.fill(target.selectors.input, prompt);
      await page.click(target.selectors.submit);
      
      // Wait for response
      await page.waitForSelector(target.selectors.response, {
        timeout: 30000
      });
      
      // Extract response
      const responseText = await page.textContent(target.selectors.response);
      
      // Extract citations if available
      const citations = target.selectors.citations
        ? await this.extractCitations(page, target.selectors.citations)
        : [];
      
      return {
        platform: target.name,
        prompt,
        response: responseText,
        citations,
        processingTime: Date.now() - startTime,
        timestamp: new Date()
      };
    } finally {
      await page.close();
      await context.close();
    }
  }
  
  private async createStealthContext(): Promise<BrowserContext> {
    return this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: this.antiDetection.getRandomUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      deviceScaleFactor: 1,
      hasTouch: false,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
  }
}
```

### 6. Anti-Detection Module (`src/anti-detection/index.ts`)
```typescript
export class AntiDetection {
  async preparePageEvasion(page: Page): Promise<void> {
    // Remove webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
    
    // Add realistic mouse movements
    await this.addMouseMovements(page);
    
    // Add realistic typing delays
    await this.addTypingDelays(page);
    
    // Randomize viewport and screen
    await this.randomizeFingerprint(page);
    
    // Use residential proxies for high-risk targets
    if (this.requiresProxy(page.url())) {
      await this.setupProxy(page);
    }
  }
  
  private async addMouseMovements(page: Page): Promise<void> {
    // Simulate human-like mouse movements
    const mouse = page.mouse;
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * 1920;
      const y = Math.random() * 1080;
      await mouse.move(x, y, { steps: 10 });
      await this.delay(100 + Math.random() * 200);
    }
  }
  
  private async addTypingDelays(page: Page): Promise<void> {
    // Override type method with realistic delays
    const originalType = page.type.bind(page);
    page.type = async (selector: string, text: string, options?: any) => {
      const chars = text.split('');
      for (const char of chars) {
        await originalType(selector, char, options);
        await this.delay(50 + Math.random() * 150);
      }
    };
  }
}
```

### 7. Session Manager (`src/session/session-manager.ts`)
```typescript
export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  
  async getOrCreateSession(platform: string): Promise<SessionData> {
    const existing = this.sessions.get(platform);
    
    if (existing && !this.isExpired(existing)) {
      return existing;
    }
    
    const session = await this.createNewSession(platform);
    this.sessions.set(platform, session);
    
    // Store in database
    await this.persistSession(session);
    
    return session;
  }
  
  private async createNewSession(platform: string): Promise<SessionData> {
    switch (platform) {
      case 'openai':
        return this.createOpenAISession();
      case 'anthropic':
        return this.createAnthropicSession();
      case 'google':
        return this.createGoogleSession();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  async rotateSession(platform: string): Promise<void> {
    const current = this.sessions.get(platform);
    if (current) {
      await this.invalidateSession(current);
    }
    
    const newSession = await this.createNewSession(platform);
    this.sessions.set(platform, newSession);
  }
}
```

## API Endpoints

```typescript
// Collection endpoints
POST   /api/ai-monitor/collect         // Start collection job
GET    /api/ai-monitor/collect/:jobId  // Get job status
POST   /api/ai-monitor/collect/batch   // Batch collection

// Platform management
GET    /api/ai-monitor/platforms       // List platforms
GET    /api/ai-monitor/platforms/:id   // Get platform details
PUT    /api/ai-monitor/platforms/:id   // Update platform config

// Session management
GET    /api/ai-monitor/sessions        // List active sessions
POST   /api/ai-monitor/sessions/rotate // Rotate session
DELETE /api/ai-monitor/sessions/:id    // Invalidate session

// Response history
GET    /api/ai-monitor/responses       // Get responses
GET    /api/ai-monitor/responses/stats // Response statistics
```

## Testing Strategy

### Unit Tests
```typescript
describe('AI Response Monitor', () => {
  describe('OpenAI Collector', () => {
    it('should collect response from ChatGPT', async () => {
      const collector = new OpenAICollector();
      const response = await collector.collect('What is RankMyBrand?');
      
      expect(response).toHaveProperty('platform', 'openai');
      expect(response).toHaveProperty('response');
      expect(response.response).toBeTruthy();
    });
    
    it('should handle rate limiting', async () => {
      const collector = new OpenAICollector();
      const promises = [];
      
      // Send many requests
      for (let i = 0; i < 100; i++) {
        promises.push(collector.collect(`Test ${i}`));
      }
      
      // Should not all succeed immediately
      const results = await Promise.allSettled(promises);
      const rateLimited = results.filter(r => r.status === 'rejected');
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

## Performance Requirements
- Collection latency: <5 seconds per prompt
- Concurrent collections: 50+ simultaneous
- Cache hit ratio: >80% for repeated prompts
- Session reuse: >90% success rate
- Anti-detection: <1% block rate

## Security Considerations
- Store API keys encrypted in environment variables
- Rotate sessions regularly
- Use residential proxies for high-risk scraping
- Implement exponential backoff on failures
- Never log sensitive responses

## Monitoring & Metrics
```typescript
// Custom Prometheus metrics
ai_responses_collected_total{platform="openai",status="success"}
ai_collection_duration_seconds{platform="anthropic"}
ai_api_costs_cents{platform="openai",model="gpt-4"}
ai_cache_hit_ratio{platform="all"}
ai_session_rotation_total{platform="google",reason="expired"}
ai_scraping_blocked_total{platform="google",reason="captcha"}
```

## Cost Optimization
- Cache responses for 1 hour (configurable)
- Use cheaper models for non-critical prompts
- Batch API calls where possible
- Implement smart retry logic
- Monitor and alert on unusual costs

## Deliverables
- [ ] API collectors (OpenAI, Anthropic, Perplexity)
- [ ] Web scrapers (Google, Bing, You, Phind, Gemini)
- [ ] Session management system
- [ ] Anti-detection measures
- [ ] Job queue processor
- [ ] Response caching layer
- [ ] Monitoring dashboards
- [ ] Integration tests
- [ ] Documentation

## Success Criteria
- Successfully collect from 8+ AI platforms
- Real-time collection (<5 seconds)
- 99% success rate for API calls
- 95% success rate for scraping
- Zero data loss
- Cost <$100/month for 10,000 queries