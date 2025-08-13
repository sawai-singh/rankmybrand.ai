import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { recommendationRouter } from './routes/recommendations';
import { executionRouter } from './routes/executions';
import { approvalRouter } from './routes/approvals';
import { brandRouter } from './routes/brands';
import { metricsRouter } from './routes/metrics';
import { healthRouter } from './routes/health';
import { Database } from '../lib/database';
import { MetricsCollector } from '../lib/metrics';
import { logger } from '../lib/logger';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { rateLimiter } from './middleware/rate-limiter';
import { authentication } from './middleware/auth';

export class ApiServer {
  private app: express.Application;
  private db: Database;
  private metrics: MetricsCollector;
  private port: number;

  constructor(db: Database, metrics: MetricsCollector) {
    this.db = db;
    this.metrics = metrics;
    this.port = parseInt(process.env.API_PORT || '8082');
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true
    }));

    // Performance middleware
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(requestLogger);
    this.app.use(this.metrics.middleware());
    this.app.use(rateLimiter);
    
    // Authentication (if enabled)
    if (process.env.API_AUTH_ENABLED === 'true') {
      this.app.use(authentication);
    }
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/recommendations', recommendationRouter(this.db));
    this.app.use('/api/executions', executionRouter(this.db));
    this.app.use('/api/approvals', approvalRouter(this.db));
    this.app.use('/api/brands', brandRouter(this.db));
    this.app.use('/api/metrics', metricsRouter(this.metrics));
    this.app.use('/api/health', healthRouter(this.db));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Action Center API',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        documentation: '/api/docs'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Error handler (must be last)
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`API Server started on port ${this.port}`);
        logger.info(`Health check: http://localhost:${this.port}/api/health`);
        resolve();
      });
    });
  }

  getApp(): express.Application {
    return this.app;
  }
}