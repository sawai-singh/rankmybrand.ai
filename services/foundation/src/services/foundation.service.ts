import { Microservice, MicroserviceConfig } from '../core/microservice';
import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import * as promClient from 'prom-client';

export class FoundationService extends Microservice {
  private dbPool: Pool;
  private redisClient: Redis;
  
  // Custom metrics
  private eventProcessedCounter: promClient.Counter<string>;
  private serviceRegistrations: promClient.Gauge<string>;
  private dbConnectionsGauge: promClient.Gauge<string>;
  
  constructor(config: MicroserviceConfig) {
    super(config);
    
    // Initialize database pool
    this.dbPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rankmybrand',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Initialize Redis client
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
    
    // Initialize custom metrics
    this.eventProcessedCounter = new promClient.Counter({
      name: 'foundation_events_processed_total',
      help: 'Total number of events processed',
      labelNames: ['event_type', 'status']
    });
    
    this.serviceRegistrations = new promClient.Gauge({
      name: 'foundation_registered_services',
      help: 'Number of registered services',
      labelNames: ['status']
    });
    
    this.dbConnectionsGauge = new promClient.Gauge({
      name: 'foundation_db_connections',
      help: 'Database connection pool metrics',
      labelNames: ['state']
    });
    
    // Setup routes
    this.setupRoutes();
  }
  
  protected async initialize(): Promise<void> {
    try {
      // Test database connection
      const client = await this.dbPool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connection established');
      
      // Test Redis connection
      await this.redisClient.ping();
      logger.info('Redis connection established');
      
      // Start monitoring loops
      this.startMonitoring();
      
      // Subscribe to system events
      await this.subscribeToSystemEvents();
      
    } catch (error) {
      logger.error('Failed to initialize Foundation Service:', error);
      throw error;
    }
  }
  
  private setupRoutes(): void {
    const app = this.getApp();
    
    // Service registry endpoints
    app.get('/api/foundation/services', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await this.dbPool.query(
          'SELECT * FROM foundation.services ORDER BY name'
        );
        res.json({
          services: result.rows,
          total: result.rowCount
        });
      } catch (error) {
        next(error);
      }
    });
    
    app.get('/api/foundation/services/:name', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name } = req.params;
        const result = await this.dbPool.query(
          'SELECT * FROM foundation.services WHERE name = $1',
          [name]
        );
        
        if (result.rowCount === 0) {
          res.status(404).json({ error: 'Service not found' });
          return;
        }
        
        res.json(result.rows[0]);
      } catch (error) {
        next(error);
      }
    });
    
    // Event bus status
    app.get('/api/foundation/events/status', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const metrics = await this.getEventBus().getMetrics();
        res.json(metrics);
      } catch (error) {
        next(error);
      }
    });
    
    // Rate limit status
    app.get('/api/foundation/ratelimit/:key', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { key } = req.params;
        const status = await this.getRateLimiter().getStatus(key);
        res.json(status);
      } catch (error) {
        next(error);
      }
    });
    
    // Configuration management
    app.get('/api/foundation/config/:service', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { service } = req.params;
        const environment = req.query.env || 'production';
        
        const result = await this.dbPool.query(
          `SELECT config_key, config_value 
           FROM foundation.configuration 
           WHERE service_name = $1 AND environment = $2 AND is_active = true`,
          [service, environment]
        );
        
        const config: Record<string, any> = {};
        result.rows.forEach(row => {
          config[row.config_key] = row.config_value;
        });
        
        res.json(config);
      } catch (error) {
        next(error);
      }
    });
    
    app.post('/api/foundation/config/:service', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { service } = req.params;
        const { key, value, environment = 'production' } = req.body;
        
        await this.dbPool.query(
          `INSERT INTO foundation.configuration (service_name, config_key, config_value, environment)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (service_name, config_key, environment)
           DO UPDATE SET config_value = $2, updated_at = NOW()`,
          [service, key, value, environment]
        );
        
        // Publish configuration change event
        await this.getEventBus().publish('system.config.changed', {
          type: 'config.changed',
          data: { service, key, value, environment }
        });
        
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    });
    
    // System metrics
    app.get('/api/foundation/metrics/summary', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const [services, events, requests] = await Promise.all([
          this.dbPool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'healthy\') as healthy FROM foundation.services'),
          this.dbPool.query('SELECT COUNT(*) as total FROM foundation.events WHERE created_at > NOW() - INTERVAL \'1 hour\''),
          this.dbPool.query('SELECT COUNT(*) as total, AVG(duration_ms) as avg_duration FROM metrics.http_requests WHERE timestamp > NOW() - INTERVAL \'1 hour\'')
        ]);
        
        res.json({
          services: {
            total: parseInt(services.rows[0].total),
            healthy: parseInt(services.rows[0].healthy)
          },
          events: {
            lastHour: parseInt(events.rows[0].total)
          },
          requests: {
            lastHour: parseInt(requests.rows[0]?.total || '0'),
            avgDuration: parseFloat(requests.rows[0]?.avg_duration || '0')
          }
        });
      } catch (error) {
        next(error);
      }
    });
    
    // Audit log
    app.post('/api/foundation/audit', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { user_id, action, resource_type, resource_id, details } = req.body;
        
        await this.dbPool.query(
          `INSERT INTO foundation.audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent, correlation_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user_id,
            action,
            resource_type,
            resource_id,
            JSON.stringify(details || {}),
            req.ip,
            req.headers['user-agent'],
            req.correlationId
          ]
        );
        
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    });
    
    // Health check with dependencies
    app.get('/api/foundation/health/detailed', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const checks = await this.performReadinessChecks();
        res.json({
          status: 'healthy',
          checks,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        next(error);
      }
    });
  }
  
  private async subscribeToSystemEvents(): Promise<void> {
    // Subscribe to service registration events
    await this.getEventBus().subscribe(
      'system.service.registered',
      'foundation-group',
      'foundation-consumer',
      async (event) => {
        logger.info('Service registered event received:', event);
        this.eventProcessedCounter.inc({ event_type: 'service.registered', status: 'success' });
        await this.updateServiceMetrics();
      }
    );
    
    // Subscribe to service health events
    await this.getEventBus().subscribe(
      'system.service.health',
      'foundation-group',
      'foundation-health-consumer',
      async (event) => {
        logger.debug('Service health event received:', event);
        this.eventProcessedCounter.inc({ event_type: 'service.health', status: 'success' });
      }
    );
  }
  
  private startMonitoring(): void {
    // Update metrics every 30 seconds
    setInterval(async () => {
      await this.updateServiceMetrics();
      await this.updateDatabaseMetrics();
    }, 30000);
  }
  
  private async updateServiceMetrics(): Promise<void> {
    try {
      const result = await this.dbPool.query(
        'SELECT status, COUNT(*) as count FROM foundation.services GROUP BY status'
      );
      
      result.rows.forEach(row => {
        this.serviceRegistrations.set({ status: row.status }, parseInt(row.count));
      });
    } catch (error) {
      logger.error('Failed to update service metrics:', error);
    }
  }
  
  private async updateDatabaseMetrics(): Promise<void> {
    try {
      const poolMetrics = {
        total: this.dbPool.totalCount,
        idle: this.dbPool.idleCount,
        waiting: this.dbPool.waitingCount
      };
      
      this.dbConnectionsGauge.set({ state: 'total' }, poolMetrics.total);
      this.dbConnectionsGauge.set({ state: 'idle' }, poolMetrics.idle);
      this.dbConnectionsGauge.set({ state: 'waiting' }, poolMetrics.waiting);
    } catch (error) {
      logger.error('Failed to update database metrics:', error);
    }
  }
  
  protected async shutdown(): Promise<void> {
    logger.info('Shutting down Foundation Service...');
    
    // Close database pool
    await this.dbPool.end();
    
    // Close Redis connection
    this.redisClient.disconnect();
    
    logger.info('Foundation Service shutdown complete');
  }
  
  protected async performReadinessChecks(): Promise<Record<string, string>> {
    const checks: Record<string, string> = {};
    
    // Check database
    try {
      const client = await this.dbPool.connect();
      await client.query('SELECT 1');
      client.release();
      checks.database = 'ok';
    } catch (error) {
      checks.database = 'failed';
    }
    
    // Check Redis
    try {
      await this.redisClient.ping();
      checks.redis = 'ok';
    } catch (error) {
      checks.redis = 'failed';
    }
    
    // Check event bus
    try {
      const metrics = await this.getEventBus().getMetrics();
      checks.eventBus = metrics ? 'ok' : 'degraded';
    } catch (error) {
      checks.eventBus = 'failed';
    }
    
    return checks;
  }
  
  protected getServiceFeatures(): string[] {
    return [
      'service-registry',
      'event-bus',
      'rate-limiting',
      'configuration-management',
      'audit-logging',
      'metrics-collection',
      'health-monitoring'
    ];
  }
  
  protected setupCustomMetrics(): void {
    // Register custom metrics
    this.getMetrics().registerMetric(this.eventProcessedCounter);
    this.getMetrics().registerMetric(this.serviceRegistrations);
    this.getMetrics().registerMetric(this.dbConnectionsGauge);
  }
}