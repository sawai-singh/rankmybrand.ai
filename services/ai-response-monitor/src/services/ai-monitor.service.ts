import path from 'path';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import * as promClient from 'prom-client';
import { CollectorOrchestrator } from '../collectors/orchestrator';
import { SessionManager } from '../session/session-manager';
import { AIResponse, CollectionJob, CollectionOptions } from '../types';

// Import Foundation components
const foundationPath = path.resolve(__dirname, '../../../foundation/src');
const { Microservice } = require(path.join(foundationPath, 'core/microservice'));

export class AIMonitorService extends Microservice {
  private dbPool: Pool;
  private redis: Redis;
  private orchestrator: CollectorOrchestrator;
  private sessionManager: SessionManager;
  private collectionQueue: Queue;
  private collectionWorker?: Worker;
  
  // Custom metrics
  private responsesCollected: promClient.Counter<string>;
  private collectionDuration: promClient.Histogram<string>;
  private apiCosts: promClient.Counter<string>;
  private cacheHitRate: promClient.Gauge<string>;
  
  constructor() {
    super({
      serviceName: 'ai-response-monitor',
      version: '1.0.0',
      port: parseInt(process.env.SERVICE_PORT || '3001'),
      corsOptions: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true
      },
      rateLimitConfig: {
        enabled: true,
        maxTokens: 1000,
        refillRate: 100
      }
    });
    
    // Initialize database connection
    this.dbPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rankmybrand',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20
    });
    
    // Initialize Redis
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });
    
    // Initialize components
    this.orchestrator = new CollectorOrchestrator(this.redis, this.dbPool);
    this.sessionManager = new SessionManager(this.dbPool, this.redis);
    
    // Initialize job queue
    this.collectionQueue = new Queue('ai-collection', {
      connection: this.redis
    });
    
    // Initialize metrics
    this.responsesCollected = new promClient.Counter({
      name: 'ai_responses_collected_total',
      help: 'Total number of AI responses collected',
      labelNames: ['platform', 'status']
    });
    
    this.collectionDuration = new promClient.Histogram({
      name: 'ai_collection_duration_seconds',
      help: 'Duration of AI response collection',
      labelNames: ['platform'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60]
    });
    
    this.apiCosts = new promClient.Counter({
      name: 'ai_api_costs_cents',
      help: 'Total API costs in cents',
      labelNames: ['platform', 'model']
    });
    
    this.cacheHitRate = new promClient.Gauge({
      name: 'ai_cache_hit_ratio',
      help: 'Cache hit ratio for AI responses',
      labelNames: ['platform']
    });
    
    // Setup routes
    this.setupRoutes();
  }
  
  protected async initialize(): Promise<void> {
    // Test database connection
    const client = await this.dbPool.connect();
    await client.query('SELECT 1');
    client.release();
    
    // Initialize database schema
    await this.initializeDatabase();
    
    // Initialize collectors
    await this.orchestrator.initialize();
    
    // Initialize sessions
    await this.sessionManager.initialize();
    
    // Start job worker
    await this.startJobWorker();
    
    // Subscribe to events
    await this.subscribeToEvents();
    
    // Register custom metrics
    this.getMetrics().registerMetric(this.responsesCollected);
    this.getMetrics().registerMetric(this.collectionDuration);
    this.getMetrics().registerMetric(this.apiCosts);
    this.getMetrics().registerMetric(this.cacheHitRate);
  }
  
  private async initializeDatabase(): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      // Create schema if not exists
      await client.query('CREATE SCHEMA IF NOT EXISTS ai_monitor');
      
      // Initialize seed data for platforms
      const platforms = [
        { name: 'openai', type: 'api', endpoint: 'https://api.openai.com/v1/chat/completions' },
        { name: 'anthropic', type: 'api', endpoint: 'https://api.anthropic.com/v1/messages' },
        { name: 'perplexity', type: 'api', endpoint: 'https://api.perplexity.ai/chat/completions' },
        { name: 'google-sge', type: 'scraping', endpoint: 'https://google.com' },
        { name: 'bing-chat', type: 'scraping', endpoint: 'https://bing.com/chat' }
      ];
      
      for (const platform of platforms) {
        await client.query(
          `INSERT INTO ai_monitor.platforms (name, type, endpoint, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (name) DO NOTHING`,
          [platform.name, platform.type, platform.endpoint]
        );
      }
    } finally {
      client.release();
    }
  }
  
  private async startJobWorker(): Promise<void> {
    this.collectionWorker = new Worker(
      'ai-collection',
      async (job) => {
        const { platforms, prompts, options } = job.data;
        
        // Update job status
        await this.updateJobStatus(job.id!, 'processing', 0);
        
        try {
          const results = await this.orchestrator.collectResponses(
            platforms,
            prompts,
            options
          );
          
          // Update job with results
          await this.updateJobStatus(job.id!, 'completed', 100, results);
          
          return results;
        } catch (error: any) {
          await this.updateJobStatus(job.id!, 'failed', 0, null, error.message);
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10')
      }
    );
    
    this.collectionWorker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });
    
    this.collectionWorker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  }
  
  private async subscribeToEvents(): Promise<void> {
    // Subscribe to collection requests from other services
    await this.getEventBus().subscribe(
      'ai.collection.requests',
      'ai-monitor-group',
      'ai-monitor-1',
      async (event) => {
        const { brandId, platforms, prompts, options } = event.data;
        
        // Create collection job
        await this.createCollectionJob(brandId, platforms, prompts, options);
      }
    );
  }
  
  private setupRoutes(): void {
    const app = this.getApp();
    
    // Collection endpoints
    app.post('/api/ai-monitor/collect', async (req, res, next) => {
      try {
        const { brandId, platforms, prompts, options } = req.body;
        
        const job = await this.createCollectionJob(
          brandId,
          platforms,
          prompts,
          options
        );
        
        res.json({ jobId: job.id, status: 'queued' });
      } catch (error) {
        next(error);
      }
    });
    
    app.get('/api/ai-monitor/collect/:jobId', async (req, res, next) => {
      try {
        const { jobId } = req.params;
        
        const result = await this.dbPool.query(
          'SELECT * FROM ai_monitor.collection_jobs WHERE id = $1',
          [jobId]
        );
        
        if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json(result.rows[0]);
      } catch (error) {
        next(error);
      }
    });
    
    app.post('/api/ai-monitor/collect/batch', async (req, res, next) => {
      try {
        const { jobs } = req.body;
        
        const jobIds = [];
        for (const job of jobs) {
          const created = await this.createCollectionJob(
            job.brandId,
            job.platforms,
            job.prompts,
            job.options
          );
          jobIds.push(created.id);
        }
        
        res.json({ jobIds, status: 'queued' });
      } catch (error) {
        next(error);
      }
    });
    
    // Platform management
    app.get('/api/ai-monitor/platforms', async (req, res, next) => {
      try {
        const result = await this.dbPool.query(
          'SELECT * FROM ai_monitor.platforms WHERE is_active = true ORDER BY name'
        );
        
        res.json(result.rows);
      } catch (error) {
        next(error);
      }
    });
    
    app.get('/api/ai-monitor/platforms/:id', async (req, res, next) => {
      try {
        const { id } = req.params;
        
        const result = await this.dbPool.query(
          'SELECT * FROM ai_monitor.platforms WHERE id = $1',
          [id]
        );
        
        if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Platform not found' });
        }
        
        res.json(result.rows[0]);
      } catch (error) {
        next(error);
      }
    });
    
    // Session management
    app.get('/api/ai-monitor/sessions', async (req, res, next) => {
      try {
        const sessions = await this.sessionManager.getActiveSessions();
        res.json(sessions);
      } catch (error) {
        next(error);
      }
    });
    
    app.post('/api/ai-monitor/sessions/rotate', async (req, res, next) => {
      try {
        const { platform } = req.body;
        await this.sessionManager.rotateSession(platform);
        res.json({ success: true, message: `Session rotated for ${platform}` });
      } catch (error) {
        next(error);
      }
    });
    
    // Response history
    app.get('/api/ai-monitor/responses', async (req, res, next) => {
      try {
        const { limit = 100, offset = 0, platform, brandId } = req.query;
        
        let query = 'SELECT * FROM ai_monitor.responses WHERE 1=1';
        const params: any[] = [];
        
        if (platform) {
          params.push(platform);
          query += ` AND platform_id = (SELECT id FROM ai_monitor.platforms WHERE name = $${params.length})`;
        }
        
        if (brandId) {
          params.push(brandId);
          query += ` AND prompt_id IN (SELECT id FROM ai_monitor.prompts WHERE brand_id = $${params.length})`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await this.dbPool.query(query, params);
        
        res.json({
          responses: result.rows,
          total: result.rowCount
        });
      } catch (error) {
        next(error);
      }
    });
    
    app.get('/api/ai-monitor/responses/stats', async (req, res, next) => {
      try {
        const stats = await this.orchestrator.getStatistics();
        res.json(stats);
      } catch (error) {
        next(error);
      }
    });
    
    // Metrics endpoint
    app.get('/api/ai-monitor/metrics', async (req, res, next) => {
      try {
        const metrics = await this.orchestrator.getMetrics();
        res.json(metrics);
      } catch (error) {
        next(error);
      }
    });
  }
  
  private async createCollectionJob(
    brandId: string,
    platforms: string[],
    prompts: string[],
    options?: CollectionOptions
  ): Promise<CollectionJob> {
    // Store job in database
    const result = await this.dbPool.query(
      `INSERT INTO ai_monitor.collection_jobs (brand_id, platforms, prompts, status, progress, created_at)
       VALUES ($1, $2, $3, 'pending', 0, NOW())
       RETURNING *`,
      [brandId, JSON.stringify(platforms), JSON.stringify(prompts)]
    );
    
    const job = result.rows[0];
    
    // Add to queue
    await this.collectionQueue.add('collect', {
      jobId: job.id,
      brandId,
      platforms,
      prompts,
      options
    }, {
      priority: options?.priority === 'high' ? 1 : options?.priority === 'low' ? 3 : 2,
      attempts: options?.retries || 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
    
    return job;
  }
  
  private async updateJobStatus(
    jobId: string,
    status: string,
    progress: number,
    results?: any,
    error?: string
  ): Promise<void> {
    const updateFields = [
      'status = $2',
      'progress = $3'
    ];
    const params: any[] = [jobId, status, progress];
    
    if (status === 'processing' && !results) {
      updateFields.push('started_at = NOW()');
    }
    
    if (status === 'completed') {
      updateFields.push('completed_at = NOW()');
      if (results) {
        params.push(JSON.stringify(results));
        updateFields.push(`results = $${params.length}`);
      }
    }
    
    if (error) {
      params.push(error);
      updateFields.push(`error_message = $${params.length}`);
    }
    
    await this.dbPool.query(
      `UPDATE ai_monitor.collection_jobs SET ${updateFields.join(', ')} WHERE id = $1`,
      params
    );
  }
  
  protected async shutdown(): Promise<void> {
    // Stop worker
    if (this.collectionWorker) {
      await this.collectionWorker.close();
    }
    
    // Close queue
    await this.collectionQueue.close();
    
    // Close connections
    await this.dbPool.end();
    this.redis.disconnect();
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
      await this.redis.ping();
      checks.redis = 'ok';
    } catch (error) {
      checks.redis = 'failed';
    }
    
    // Check collectors
    try {
      const activeCollectors = await this.orchestrator.getActiveCollectors();
      checks.collectors = activeCollectors.length > 0 ? 'ok' : 'no_collectors';
    } catch (error) {
      checks.collectors = 'failed';
    }
    
    return checks;
  }
  
  protected getServiceFeatures(): string[] {
    return [
      'ai-response-collection',
      'multi-platform-support',
      'session-management',
      'anti-detection',
      'response-caching',
      'job-queue-processing',
      'cost-tracking',
      'real-time-monitoring'
    ];
  }
  
  protected setupCustomMetrics(): void {
    // Metrics are registered in initialize()
  }
}