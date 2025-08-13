import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { MetricsEvent, Recommendation } from '../types';
import { RecommendationGenerator } from '../generators/recommendation-generator';
import { AutoExecutor } from '../executors/auto-executor';
import { Database } from '../lib/database';
import { EventBus } from '../lib/event-bus';
import { NotificationService } from '../lib/notification';
import { MetricsCollector } from '../lib/metrics';
import { logger } from '../lib/logger';

export class ActionProcessor {
  private eventBus: EventBus;
  private generator: RecommendationGenerator;
  private executor: AutoExecutor;
  private db: Database;
  private notifications: NotificationService;
  private metrics: MetricsCollector;
  private recommendationQueue: Queue;
  private worker: Worker | null = null;
  private isProcessing: boolean = false;

  constructor() {
    this.db = new Database();
    this.notifications = new NotificationService();
    this.metrics = new MetricsCollector();
    
    this.eventBus = new EventBus();
    this.generator = new RecommendationGenerator(this.db);
    this.executor = new AutoExecutor(this.db, this.notifications, this.metrics);
    
    // Initialize BullMQ queue
    const connection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null
    });
    
    this.recommendationQueue = new Queue('recommendations', {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });
  }

  async initialize(): Promise<void> {
    // Initialize database
    await this.db.initialize();
    
    // Initialize event bus
    await this.eventBus.initialize();
    
    // Setup worker
    this.setupWorker();
    
    logger.info('Action Processor initialized');
  }

  async start(): Promise<void> {
    this.isProcessing = true;
    
    // Subscribe to metrics stream
    await this.eventBus.subscribe(
      process.env.INPUT_STREAM || 'metrics.calculated',
      process.env.CONSUMER_GROUP || 'action-center-group',
      process.env.CONSUMER_NAME || 'action-worker-1',
      this.processMetrics.bind(this)
    );
    
    logger.info('Action Center started, waiting for metrics...');
    
    // Start health check
    this.startHealthCheck();
  }

  private async processMetrics(event: MetricsEvent): Promise<void> {
    const startTime = Date.now();
    
    logger.info(`Processing metrics for brand ${event.brandId} from ${event.platform}`);
    
    try {
      // Check if we have content gaps to process
      if (!event.contentGaps || event.contentGaps.length === 0) {
        logger.info('No content gaps found, skipping');
        return;
      }
      
      // Generate recommendations for each gap
      const recommendations: Recommendation[] = [];
      
      for (const gap of event.contentGaps) {
        try {
          const recommendation = await this.generator.generateFromGap(gap, event);
          recommendations.push(recommendation);
          
          // Add to queue for async processing
          await this.recommendationQueue.add('process-recommendation', {
            recommendation,
            correlationId: event.correlationId
          });
          
        } catch (error) {
          logger.error(`Failed to generate recommendation for gap ${gap.id}:`, error);
          this.metrics.recordError('generation_failed');
        }
      }
      
      // Sort by priority
      recommendations.sort((a, b) => b.priority - a.priority);
      
      // Store in database
      for (const rec of recommendations) {
        try {
          await this.db.saveRecommendation(rec);
          
          // Publish to stream
          await this.eventBus.publish(
            process.env.OUTPUT_STREAM || 'recommendations.ready',
            {
              type: 'recommendation.created',
              data: rec,
              correlationId: event.correlationId
            }
          );
          
        } catch (error) {
          logger.error(`Failed to save recommendation ${rec.id}:`, error);
          this.metrics.recordError('save_failed');
        }
      }
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordRecommendationsGenerated(
        event.brandId,
        recommendations.length,
        processingTime
      );
      
      logger.info(`Generated ${recommendations.length} recommendations in ${processingTime}ms`);
      
    } catch (error) {
      logger.error('Error processing metrics:', error);
      this.metrics.recordError('processing_failed');
      
      // Send to dead letter queue
      await this.handleError(event, error as Error);
    }
  }

  private setupWorker(): void {
    const connection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null
    });
    
    this.worker = new Worker(
      'recommendations',
      async (job) => {
        const { recommendation, correlationId } = job.data;
        
        logger.info(`Processing recommendation ${recommendation.id} from queue`);
        
        // Check if auto-executable
        if (recommendation.autoExecutable && process.env.AUTO_EXECUTION_ENABLED === 'true') {
          try {
            const result = await this.executor.execute(recommendation);
            
            // Publish execution result
            await this.eventBus.publish(
              process.env.OUTPUT_STREAM || 'recommendations.ready',
              {
                type: 'recommendation.executed',
                data: {
                  recommendationId: recommendation.id,
                  result
                },
                correlationId
              }
            );
            
            this.metrics.recordExecution(
              recommendation.type,
              result.platform || 'unknown',
              result.success ? 'success' : 'failed',
              result.executionTimeMs
            );
            
          } catch (error) {
            logger.error(`Auto-execution failed for ${recommendation.id}:`, error);
            this.metrics.recordError('execution_failed');
            
            // Queue for manual review
            await this.db.createApprovalRequest({
              recommendationId: recommendation.id,
              requestedBy: 'system',
              requestedAt: new Date()
            });
          }
        } else {
          // Queue for approval
          await this.db.createApprovalRequest({
            recommendationId: recommendation.id,
            requestedBy: 'system',
            requestedAt: new Date()
          });
          
          await this.notifications.notifyApprovalRequired(recommendation);
        }
      },
      {
        connection,
        concurrency: parseInt(process.env.MAX_CONCURRENT_RECOMMENDATIONS || '5'),
        limiter: {
          max: 10,
          duration: 60000 // 10 per minute
        }
      }
    );
    
    this.worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`);
    });
    
    this.worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed:`, error);
      this.metrics.recordError('job_failed');
    });
  }

  private async handleError(event: MetricsEvent, error: Error): Promise<void> {
    // Send to dead letter queue
    await this.eventBus.publish('metrics.failed', {
      type: 'processing.failed',
      originalEvent: event,
      error: {
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
  }

  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        // Check database connection
        await this.db.getRecommendationsByBrand('health-check', 1);
        
        // Check Redis connection
        await this.recommendationQueue.getJobCounts();
        
        // Update health status
        this.metrics.setHealthStatus('healthy');
        
      } catch (error) {
        logger.error('Health check failed:', error);
        this.metrics.setHealthStatus('unhealthy');
      }
    }, parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000'));
  }

  async stop(): Promise<void> {
    logger.info('Stopping Action Processor...');
    
    this.isProcessing = false;
    
    // Close worker
    if (this.worker) {
      await this.worker.close();
    }
    
    // Close queue
    await this.recommendationQueue.close();
    
    // Close event bus
    await this.eventBus.close();
    
    // Close database
    await this.db.close();
    
    logger.info('Action Processor stopped');
  }
}