import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { logger } from './logger';

export class MetricsCollector {
  private recommendationsGenerated: Counter;
  private executionsCounter: Counter;
  private processingDuration: Histogram;
  private queueSize: Gauge;
  private healthStatus: Gauge;
  private errorCounter: Counter;
  private apiRequestDuration: Summary;
  private aiTokenUsage: Counter;
  private rollbackCounter: Counter;
  private approvalQueue: Gauge;

  constructor() {
    // Initialize metrics
    this.recommendationsGenerated = new Counter({
      name: 'action_center_recommendations_generated_total',
      help: 'Total number of recommendations generated',
      labelNames: ['brand_id', 'type', 'subtype']
    });

    this.executionsCounter = new Counter({
      name: 'action_center_executions_total',
      help: 'Total number of executions',
      labelNames: ['type', 'platform', 'status']
    });

    this.processingDuration = new Histogram({
      name: 'action_center_processing_duration_seconds',
      help: 'Duration of processing operations',
      labelNames: ['operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.queueSize = new Gauge({
      name: 'action_center_queue_size',
      help: 'Current size of the recommendation queue',
      labelNames: ['queue_name']
    });

    this.healthStatus = new Gauge({
      name: 'action_center_health_status',
      help: 'Health status of the Action Center (1 = healthy, 0 = unhealthy)'
    });

    this.errorCounter = new Counter({
      name: 'action_center_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'component']
    });

    this.apiRequestDuration = new Summary({
      name: 'action_center_api_request_duration_seconds',
      help: 'Duration of API requests',
      labelNames: ['method', 'route', 'status_code'],
      percentiles: [0.5, 0.9, 0.95, 0.99]
    });

    this.aiTokenUsage = new Counter({
      name: 'action_center_ai_tokens_used_total',
      help: 'Total number of AI tokens used',
      labelNames: ['model', 'operation']
    });

    this.rollbackCounter = new Counter({
      name: 'action_center_rollbacks_total',
      help: 'Total number of rollbacks performed',
      labelNames: ['platform', 'reason']
    });

    this.approvalQueue = new Gauge({
      name: 'action_center_approval_queue_size',
      help: 'Number of recommendations awaiting approval',
      labelNames: ['priority_level']
    });

    logger.info('Metrics collector initialized');
  }

  recordRecommendationsGenerated(
    brandId: string,
    count: number,
    processingTimeMs: number,
    type?: string,
    subtype?: string
  ): void {
    this.recommendationsGenerated.inc({
      brand_id: brandId,
      type: type || 'unknown',
      subtype: subtype || 'none'
    }, count);

    this.processingDuration.observe(
      { operation: 'generate_recommendations' },
      processingTimeMs / 1000
    );
  }

  recordExecution(
    type: string,
    platform: string,
    status: 'success' | 'failed',
    executionTimeMs: number
  ): void {
    this.executionsCounter.inc({
      type,
      platform,
      status
    });

    this.processingDuration.observe(
      { operation: 'execute_recommendation' },
      executionTimeMs / 1000
    );
  }

  recordError(errorType: string, component?: string): void {
    this.errorCounter.inc({
      error_type: errorType,
      component: component || 'unknown'
    });
  }

  recordApiRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.apiRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode.toString()
      },
      durationMs / 1000
    );
  }

  recordAiTokenUsage(model: string, operation: string, tokens: number): void {
    this.aiTokenUsage.inc(
      {
        model,
        operation
      },
      tokens
    );
  }

  recordRollback(platform: string, reason: string): void {
    this.rollbackCounter.inc({
      platform,
      reason
    });
  }

  setQueueSize(queueName: string, size: number): void {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  setApprovalQueueSize(priorityLevel: string, size: number): void {
    this.approvalQueue.set({ priority_level: priorityLevel }, size);
  }

  setHealthStatus(status: 'healthy' | 'unhealthy'): void {
    this.healthStatus.set(status === 'healthy' ? 1 : 0);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  async getMetricsJson(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    
    // Add custom summary
    const summary = {
      recommendations: {
        total: await this.getCounterValue(this.recommendationsGenerated),
        recentRate: this.calculateRate(this.recommendationsGenerated)
      },
      executions: {
        total: await this.getCounterValue(this.executionsCounter),
        successRate: await this.calculateSuccessRate()
      },
      errors: {
        total: await this.getCounterValue(this.errorCounter),
        recentRate: this.calculateRate(this.errorCounter)
      },
      health: {
        status: this.healthStatus.get() === 1 ? 'healthy' : 'unhealthy',
        queues: await this.getQueueMetrics()
      },
      performance: {
        avgProcessingTime: await this.getAverageProcessingTime(),
        p95ProcessingTime: await this.getPercentileProcessingTime(0.95)
      }
    };

    return {
      summary,
      raw: metrics
    };
  }

  private async getCounterValue(counter: Counter): Promise<number> {
    const metric = await counter.get();
    return metric.values.reduce((sum, v) => sum + v.value, 0);
  }

  private calculateRate(counter: Counter, windowSeconds: number = 300): number {
    // This would need a time-series store to calculate properly
    // For now, return 0 as placeholder
    return 0;
  }

  private async calculateSuccessRate(): Promise<number> {
    const metric = await this.executionsCounter.get();
    let success = 0;
    let total = 0;
    
    for (const value of metric.values) {
      total += value.value;
      if (value.labels.status === 'success') {
        success += value.value;
      }
    }
    
    return total > 0 ? (success / total) * 100 : 0;
  }

  private async getQueueMetrics(): Promise<any> {
    const metric = await this.queueSize.get();
    const result: any = {};
    
    for (const value of metric.values) {
      result[value.labels.queue_name as string] = value.value;
    }
    
    return result;
  }

  private async getAverageProcessingTime(): Promise<number> {
    const metric = await this.processingDuration.get();
    if (!metric.values.length) return 0;
    
    let totalTime = 0;
    let totalCount = 0;
    
    for (const value of metric.values) {
      if (value.metricName === 'action_center_processing_duration_seconds_sum') {
        totalTime += value.value;
      }
      if (value.metricName === 'action_center_processing_duration_seconds_count') {
        totalCount += value.value;
      }
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  private async getPercentileProcessingTime(percentile: number): Promise<number> {
    // This would need proper histogram calculation
    // For now, return estimated value
    const avg = await this.getAverageProcessingTime();
    return avg * (1 + percentile);
  }

  // Express middleware for recording HTTP metrics
  middleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordApiRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration
        );
      });
      
      next();
    };
  }
}