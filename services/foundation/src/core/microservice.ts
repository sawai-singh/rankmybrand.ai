import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { EventBus } from './event-bus';
import { ServiceRegistry } from './service-registry';
import { RateLimiter } from './rate-limiter';
import * as promClient from 'prom-client';
import { logger, httpLogStream } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type to include our custom properties
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

export interface MicroserviceConfig {
  serviceName: string;
  version?: string;
  port?: number;
  corsOptions?: cors.CorsOptions;
  rateLimitConfig?: {
    enabled?: boolean;
    maxTokens?: number;
    refillRate?: number;
  };
}

export abstract class Microservice {
  protected app: Application;
  protected eventBus: EventBus;
  protected registry: ServiceRegistry;
  protected rateLimiter: RateLimiter;
  protected metrics: promClient.Registry;
  protected config: MicroserviceConfig;
  
  // Prometheus metrics
  private httpRequestDuration: promClient.Histogram<string>;
  private httpRequestTotal: promClient.Counter<string>;
  private httpRequestErrors: promClient.Counter<string>;
  
  constructor(config: MicroserviceConfig) {
    this.config = {
      version: '1.0.0',
      port: 3000,
      ...config
    };
    
    this.app = express();
    this.eventBus = new EventBus();
    this.registry = new ServiceRegistry();
    this.rateLimiter = new RateLimiter();
    this.metrics = new promClient.Registry();
    
    // Initialize Prometheus metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: `${this.config.serviceName}_http_request_duration_ms`,
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000]
    });
    
    this.httpRequestTotal = new promClient.Counter({
      name: `${this.config.serviceName}_http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    
    this.httpRequestErrors = new promClient.Counter({
      name: `${this.config.serviceName}_http_request_errors_total`,
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type']
    });
    
    this.metrics.registerMetric(this.httpRequestDuration);
    this.metrics.registerMetric(this.httpRequestTotal);
    this.metrics.registerMetric(this.httpRequestErrors);
    
    this.setupMiddleware();
    this.setupBaseRoutes();
    this.setupMetrics();
    this.setupErrorHandling();
  }
  
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }));
    
    // CORS
    this.app.use(cors(this.config.corsOptions || {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request tracking
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
      req.startTime = Date.now();
      res.setHeader('X-Correlation-ID', req.correlationId);
      res.setHeader('X-Service-Name', this.config.serviceName);
      res.setHeader('X-Service-Version', this.config.version || '1.0.0');
      
      // Log request
      logger.info(`${req.method} ${req.path}`, {
        correlationId: req.correlationId,
        service: this.config.serviceName,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Track response
      const originalSend = res.send;
      res.send = function(data: any) {
        const duration = Date.now() - (req.startTime || 0);
        
        // Update metrics
        this.httpRequestDuration.observe(
          { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
          duration
        );
        
        this.httpRequestTotal.inc({
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode
        });
        
        // Log response
        logger.info(`Response sent`, {
          correlationId: req.correlationId,
          statusCode: res.statusCode,
          duration: `${duration}ms`
        });
        
        return originalSend.call(this, data);
      }.bind(res);
      
      next();
    });
    
    // Rate limiting (if enabled)
    if (this.config.rateLimitConfig?.enabled) {
      this.app.use(async (req: Request, res: Response, next: NextFunction) => {
        const key = req.ip || 'unknown';
        const result = await this.rateLimiter.checkLimit(key, this.config.rateLimitConfig);
        
        res.setHeader('X-RateLimit-Limit', String(this.config.rateLimitConfig?.maxTokens || 1000));
        res.setHeader('X-RateLimit-Remaining', String(result.remainingTokens));
        res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
        
        if (!result.allowed) {
          if (result.retryAfter) {
            res.setHeader('Retry-After', String(result.retryAfter));
          }
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: result.retryAfter
          });
        }
        
        next();
      });
    }
  }
  
  private setupBaseRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: this.config.serviceName,
        version: this.config.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
    
    // Readiness check
    this.app.get('/ready', async (req: Request, res: Response) => {
      try {
        // Check dependencies
        const checks = await this.performReadinessChecks();
        
        const allHealthy = Object.values(checks).every(check => check === 'ok');
        
        res.status(allHealthy ? 200 : 503).json({
          ready: allHealthy,
          checks,
          service: this.config.serviceName,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(503).json({
          ready: false,
          error: 'Readiness check failed',
          service: this.config.serviceName
        });
      }
    });
    
    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', this.metrics.contentType);
        const metrics = await this.metrics.metrics();
        res.end(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    });
    
    // Service info
    this.app.get('/info', (req: Request, res: Response) => {
      res.json({
        service: this.config.serviceName,
        version: this.config.version,
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
        features: this.getServiceFeatures()
      });
    });
  }
  
  private setupMetrics(): void {
    // Collect default metrics
    promClient.collectDefaultMetrics({
      register: this.metrics,
      prefix: `${this.config.serviceName}_`,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });
    
    // Custom business metrics can be added by derived classes
    this.setupCustomMetrics();
  }
  
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        correlationId: req.correlationId
      });
    });
    
    // Global error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      const statusCode = err.statusCode || err.status || 500;
      const errorId = uuidv4();
      
      // Log error
      logger.error('Unhandled error', {
        errorId,
        correlationId: req.correlationId,
        error: {
          message: err.message,
          stack: err.stack,
          statusCode
        }
      });
      
      // Update error metrics
      this.httpRequestErrors.inc({
        method: req.method,
        route: req.route?.path || req.path,
        error_type: err.constructor.name
      });
      
      // Send response
      res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : err.message,
        errorId,
        correlationId: req.correlationId,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }
  
  async start(): Promise<void> {
    const port = this.config.port || parseInt(process.env.SERVICE_PORT || '3000');
    const host = process.env.SERVICE_HOST || '0.0.0.0';
    
    try {
      // Register with service discovery
      await this.registry.register({
        name: this.config.serviceName,
        host: process.env.HOSTNAME || 'localhost',
        port,
        healthEndpoint: '/health',
        metadata: {
          version: this.config.version,
          startTime: new Date().toISOString()
        }
      });
      
      // Initialize service-specific components
      await this.initialize();
      
      // Start server
      this.app.listen(port, host, () => {
        logger.info(`${this.config.serviceName} v${this.config.version} listening on ${host}:${port}`);
        
        // Publish service started event
        this.eventBus.publish('system.service.started', {
          type: 'service.started',
          data: {
            service: this.config.serviceName,
            version: this.config.version,
            port,
            timestamp: new Date().toISOString()
          }
        });
      });
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error(`Failed to start ${this.config.serviceName}:`, error);
      process.exit(1);
    }
  }
  
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`${signal} received, starting graceful shutdown`);
        
        try {
          // Deregister from service discovery
          await this.registry.deregister(this.config.serviceName);
          
          // Publish service stopping event
          await this.eventBus.publish('system.service.stopping', {
            type: 'service.stopping',
            data: {
              service: this.config.serviceName,
              timestamp: new Date().toISOString()
            }
          });
          
          // Custom cleanup
          await this.shutdown();
          
          // Disconnect from infrastructure
          await this.eventBus.disconnect();
          await this.registry.disconnect();
          await this.rateLimiter.disconnect();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    });
  }
  
  // Protected methods for derived classes
  protected getEventBus(): EventBus {
    return this.eventBus;
  }
  
  protected getRegistry(): ServiceRegistry {
    return this.registry;
  }
  
  protected getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }
  
  protected getApp(): Application {
    return this.app;
  }
  
  protected getMetrics(): promClient.Registry {
    return this.metrics;
  }
  
  // Abstract methods to be implemented by derived classes
  protected abstract initialize(): Promise<void>;
  protected abstract shutdown(): Promise<void>;
  protected abstract performReadinessChecks(): Promise<Record<string, string>>;
  protected abstract getServiceFeatures(): string[];
  protected abstract setupCustomMetrics(): void;
}