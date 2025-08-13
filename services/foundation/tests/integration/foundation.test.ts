import { EventBus } from '../../src/core/event-bus';
import { ServiceRegistry } from '../../src/core/service-registry';
import { RateLimiter } from '../../src/core/rate-limiter';
import Redis from 'ioredis';
import { Pool } from 'pg';

// Test configuration
const testConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rankmybrand',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  }
};

describe('Foundation Infrastructure Integration Tests', () => {
  let eventBus: EventBus;
  let serviceRegistry: ServiceRegistry;
  let rateLimiter: RateLimiter;
  let redisClient: Redis;
  let pgPool: Pool;

  beforeAll(async () => {
    // Initialize components
    eventBus = new EventBus(testConfig.redis);
    serviceRegistry = new ServiceRegistry(testConfig.postgres);
    rateLimiter = new RateLimiter(testConfig.redis);
    
    redisClient = new Redis(testConfig.redis);
    pgPool = new Pool(testConfig.postgres);
    
    // Wait for connections
    await redisClient.ping();
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
  });

  afterAll(async () => {
    // Cleanup
    await eventBus.disconnect();
    await serviceRegistry.disconnect();
    await rateLimiter.disconnect();
    await redisClient.quit();
    await pgPool.end();
  });

  describe('Event Bus', () => {
    it('should publish and consume events via Redis Streams', async () => {
      const testStream = 'test.integration.stream';
      const testEvent = {
        type: 'test.event',
        data: { 
          id: '123', 
          message: 'Integration test event',
          timestamp: Date.now()
        }
      };
      
      // Publish event
      const messageId = await eventBus.publish(testStream, testEvent);
      expect(messageId).toBeTruthy();
      expect(messageId).toMatch(/^\d+-\d+$/); // Redis stream ID format
      
      // Consume event
      const received = await new Promise((resolve) => {
        eventBus.subscribe(
          testStream, 
          'test-group', 
          'test-consumer',
          async (event) => {
            resolve(event);
          }
        );
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });
      
      expect(received).toBeTruthy();
      expect(received.event_type).toBe(testEvent.type);
      expect(JSON.parse(received.data)).toEqual(testEvent.data);
    });

    it('should handle multiple consumers in a consumer group', async () => {
      const testStream = 'test.multi.stream';
      const events = [];
      
      // Create multiple consumers
      const consumer1Promise = new Promise((resolve) => {
        eventBus.subscribe(
          testStream,
          'multi-group',
          'consumer-1',
          async (event) => {
            events.push({ consumer: 1, event });
            if (events.length >= 2) resolve(true);
          }
        );
      });
      
      const consumer2Promise = new Promise((resolve) => {
        eventBus.subscribe(
          testStream,
          'multi-group',
          'consumer-2',
          async (event) => {
            events.push({ consumer: 2, event });
            if (events.length >= 2) resolve(true);
          }
        );
      });
      
      // Publish multiple events
      await eventBus.publish(testStream, { type: 'event1', data: { n: 1 } });
      await eventBus.publish(testStream, { type: 'event2', data: { n: 2 } });
      
      // Wait for events to be processed
      await Promise.race([
        Promise.all([consumer1Promise, consumer2Promise]),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
      
      // Each event should be processed by only one consumer
      expect(events.length).toBeGreaterThanOrEqual(2);
      const event1Consumers = events.filter(e => e.event.event_type === 'event1');
      const event2Consumers = events.filter(e => e.event.event_type === 'event2');
      expect(event1Consumers.length).toBe(1);
      expect(event2Consumers.length).toBe(1);
    });

    it('should track event metrics', async () => {
      const metrics = await eventBus.getMetrics();
      
      expect(metrics).toHaveProperty('published');
      expect(metrics).toHaveProperty('consumed');
      expect(metrics).toHaveProperty('errors');
      
      // Should have recorded our test events
      expect(Object.keys(metrics.published).length).toBeGreaterThan(0);
    });
  });

  describe('Service Registry', () => {
    const testService = {
      name: 'test-service',
      host: 'localhost',
      port: 9999,
      healthEndpoint: '/health'
    };

    it('should register and discover services', async () => {
      // Register service
      const serviceId = await serviceRegistry.register(testService);
      expect(serviceId).toBeTruthy();
      expect(serviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      // Discover service
      const discovered = await serviceRegistry.discover(testService.name);
      expect(discovered).toBeTruthy();
      expect(discovered?.name).toBe(testService.name);
      expect(discovered?.host).toBe(testService.host);
      expect(discovered?.port).toBe(testService.port);
      expect(discovered?.status).toBe('healthy');
    });

    it('should update service heartbeat', async () => {
      await serviceRegistry.heartbeat(testService.name);
      
      const service = await serviceRegistry.discover(testService.name);
      expect(service).toBeTruthy();
      expect(service?.status).toBe('healthy');
      
      const lastHeartbeat = new Date(service!.lastHeartbeat!);
      const now = new Date();
      const diff = now.getTime() - lastHeartbeat.getTime();
      expect(diff).toBeLessThan(5000); // Within last 5 seconds
    });

    it('should deregister services', async () => {
      await serviceRegistry.deregister(testService.name);
      
      // Service should be marked as unhealthy
      const service = await serviceRegistry.discover(testService.name);
      expect(service).toBeNull(); // discover only returns healthy services
    });

    it('should list all services', async () => {
      // Register multiple services
      await serviceRegistry.register({
        name: 'service-1',
        host: 'localhost',
        port: 3001
      });
      
      await serviceRegistry.register({
        name: 'service-2',
        host: 'localhost',
        port: 3002
      });
      
      const services = await serviceRegistry.discoverAll('healthy');
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThanOrEqual(2);
      
      const serviceNames = services.map(s => s.name);
      expect(serviceNames).toContain('service-1');
      expect(serviceNames).toContain('service-2');
    });

    it('should get service metrics', async () => {
      const metrics = await serviceRegistry.getMetrics();
      
      expect(metrics).toHaveProperty('total');
      expect(metrics).toHaveProperty('healthy');
      expect(metrics).toHaveProperty('unhealthy');
      expect(metrics).toHaveProperty('unknown');
      
      expect(typeof metrics.total).toBe('string');
      expect(parseInt(metrics.total)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Rate Limiter', () => {
    it('should enforce token bucket rate limits', async () => {
      const testKey = 'test-rate-limit-key';
      const config = { maxTokens: 10, refillRate: 2 };
      
      // Reset any existing limits
      await rateLimiter.reset(testKey);
      
      // Should allow initial requests
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(testKey, config);
        expect(result.allowed).toBe(true);
        expect(result.remainingTokens).toBe(9 - i);
      }
      
      // Should block when tokens exhausted
      const blocked = await rateLimiter.checkLimit(testKey, config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingTokens).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('should enforce sliding window rate limits', async () => {
      const testKey = 'test-window-key';
      const maxRequests = 5;
      const windowMs = 1000; // 1 second window
      
      // Should allow initial requests
      for (let i = 0; i < maxRequests; i++) {
        const result = await rateLimiter.checkWindowLimit(testKey, maxRequests, windowMs);
        expect(result.allowed).toBe(true);
        expect(result.remainingTokens).toBe(maxRequests - i - 1);
      }
      
      // Should block when limit reached
      const blocked = await rateLimiter.checkWindowLimit(testKey, maxRequests, windowMs);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingTokens).toBe(0);
      
      // Should allow again after window passes
      await new Promise(resolve => setTimeout(resolve, windowMs + 100));
      const allowedAgain = await rateLimiter.checkWindowLimit(testKey, maxRequests, windowMs);
      expect(allowedAgain.allowed).toBe(true);
    });

    it('should get rate limit status without consuming tokens', async () => {
      const testKey = 'test-status-key';
      const config = { maxTokens: 100, refillRate: 10 };
      
      await rateLimiter.reset(testKey);
      
      const status = await rateLimiter.getStatus(testKey, config);
      expect(status.remainingTokens).toBe(100);
      expect(status.maxTokens).toBe(100);
      expect(status.refillRate).toBe(10);
      
      // Check limit (consumes 1 token)
      await rateLimiter.checkLimit(testKey, config);
      
      const newStatus = await rateLimiter.getStatus(testKey, config);
      expect(newStatus.remainingTokens).toBeLessThanOrEqual(99);
    });

    it('should track rate limit metrics', async () => {
      const metrics = await rateLimiter.getMetrics();
      
      expect(metrics).toHaveProperty('tokenBucket');
      expect(metrics).toHaveProperty('slidingWindow');
      
      expect(metrics.tokenBucket).toHaveProperty('allowed');
      expect(metrics.tokenBucket).toHaveProperty('rejected');
      
      // Should have recorded our test requests
      expect(metrics.tokenBucket.allowed).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete service lifecycle', async () => {
      const serviceName = 'e2e-test-service';
      
      // 1. Register service
      const serviceId = await serviceRegistry.register({
        name: serviceName,
        host: 'localhost',
        port: 8888,
        metadata: { version: '1.0.0', environment: 'test' }
      });
      
      expect(serviceId).toBeTruthy();
      
      // 2. Publish service started event
      await eventBus.publish('system.service.started', {
        type: 'service.started',
        data: {
          service: serviceName,
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      });
      
      // 3. Check rate limit for service
      const rateLimitResult = await rateLimiter.checkLimit(
        `service:${serviceName}`,
        { maxTokens: 1000, refillRate: 100 }
      );
      expect(rateLimitResult.allowed).toBe(true);
      
      // 4. Send heartbeats
      for (let i = 0; i < 3; i++) {
        await serviceRegistry.heartbeat(serviceName);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 5. Verify service is healthy
      const service = await serviceRegistry.discover(serviceName);
      expect(service).toBeTruthy();
      expect(service?.status).toBe('healthy');
      
      // 6. Deregister service
      await serviceRegistry.deregister(serviceName);
      
      // 7. Publish service stopped event
      await eventBus.publish('system.service.stopped', {
        type: 'service.stopped',
        data: {
          service: serviceName,
          timestamp: new Date().toISOString()
        }
      });
      
      // 8. Verify service is no longer discoverable
      const stoppedService = await serviceRegistry.discover(serviceName);
      expect(stoppedService).toBeNull();
    });
  });
});