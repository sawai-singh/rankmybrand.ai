/**
 * Search Intelligence Job Processor
 * Handles queued search intelligence analysis jobs
 */

import { Job } from 'bull';
import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { Logger } from '../utils/logger.js';
import { Redis } from 'ioredis';

export interface SearchIntelJobData {
  brand: string;
  domain: string;
  options?: any;
  crawlJobId?: string;
  userId?: string;
  priority?: string;
}

export class SearchIntelJobProcessor {
  private logger: Logger;
  private searchService: SearchIntelligenceService;
  private redis: Redis;
  private activeJobs: Map<string, Job> = new Map();

  constructor(redis: Redis) {
    this.logger = new Logger('SearchIntelJobProcessor');
    this.searchService = new SearchIntelligenceService();
    this.redis = redis;
  }

  /**
   * Process a search intelligence job
   */
  async process(job: Job<SearchIntelJobData>): Promise<any> {
    const { brand, domain, options, crawlJobId, userId } = job.data;
    
    this.logger.info(`Processing search intelligence job ${job.id} for ${domain}`);
    this.activeJobs.set(job.id.toString(), job);

    try {
      // Check rate limits for user
      if (userId) {
        const canProceed = await this.checkUserRateLimit(userId);
        if (!canProceed) {
          throw new Error('User rate limit exceeded');
        }
      }

      // Update job progress
      await job.progress(10);

      // Start analysis
      const analysis = await this.searchService.analyzeSearchIntelligence(
        brand,
        domain,
        options || {},
        crawlJobId
      );

      // Track progress
      const progressHandler = async (event: any) => {
        if (event.analysisId === analysis.id) {
          const progress = Math.round((event.completedQueries / event.totalQueries) * 100);
          await job.progress(progress);
          
          // Update job with current state
          await job.update({
            ...job.data,
            currentQuery: event.currentQuery,
            completedQueries: event.completedQueries,
            costs: event.costs
          });
        }
      };

      const completeHandler = async (event: any) => {
        if (event.analysisId === analysis.id) {
          this.searchService.removeListener('analysis:progress', progressHandler);
          this.searchService.removeListener('analysis:complete', completeHandler);
          this.searchService.removeListener('analysis:error', errorHandler);
        }
      };

      const errorHandler = async (event: any) => {
        if (event.analysisId === analysis.id) {
          this.searchService.removeListener('analysis:progress', progressHandler);
          this.searchService.removeListener('analysis:complete', completeHandler);
          this.searchService.removeListener('analysis:error', errorHandler);
          throw new Error(event.error);
        }
      };

      // Listen for events
      this.searchService.on('analysis:progress', progressHandler);
      this.searchService.on('analysis:complete', completeHandler);
      this.searchService.on('analysis:error', errorHandler);

      // Wait for completion
      const results = await this.waitForCompletion(analysis.id, job);

      // Update user usage
      if (userId) {
        await this.updateUserUsage(userId, results.queriesUsed, results.costIncurred);
      }

      // Clean up
      this.activeJobs.delete(job.id.toString());

      return {
        analysisId: analysis.id,
        status: 'completed',
        results
      };

    } catch (error) {
      this.logger.error(`Failed to process job ${job.id}:`, error);
      this.activeJobs.delete(job.id.toString());
      throw error;
    }
  }

  /**
   * Wait for analysis completion with timeout
   */
  private async waitForCompletion(analysisId: string, job: Job): Promise<any> {
    const timeout = 10 * 60 * 1000; // 10 minutes
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const results = await this.searchService.getAnalysisResults(analysisId);
      
      if (results && results.analysis.status === 'completed') {
        return results;
      }

      if (results && results.analysis.status === 'failed') {
        throw new Error(`Analysis failed: ${results.analysis.error}`);
      }

      // Check if job was cancelled
      const jobState = await job.getState();
      if (jobState === 'failed' || jobState === 'cancelled') {
        await this.searchService.cancelAnalysis(analysisId);
        throw new Error(`Job ${jobState}`);
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('Analysis timeout');
  }

  /**
   * Check user rate limits
   */
  private async checkUserRateLimit(userId: string): Promise<boolean> {
    const key = `search-intel:rate-limit:${userId}`;
    const limit = 100; // 100 analyses per day
    
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, 86400); // 24 hours
    }

    return current <= limit;
  }

  /**
   * Update user usage statistics
   */
  private async updateUserUsage(
    userId: string,
    queriesUsed: number,
    costIncurred: number
  ): Promise<void> {
    const dailyKey = `search-intel:usage:daily:${userId}:${new Date().toISOString().split('T')[0]}`;
    const monthlyKey = `search-intel:usage:monthly:${userId}:${new Date().toISOString().slice(0, 7)}`;

    // Update daily usage
    await this.redis.hincrby(dailyKey, 'queries', queriesUsed);
    await this.redis.hincrbyfloat(dailyKey, 'cost', costIncurred);
    await this.redis.expire(dailyKey, 7 * 86400); // Keep for 7 days

    // Update monthly usage
    await this.redis.hincrby(monthlyKey, 'queries', queriesUsed);
    await this.redis.hincrbyfloat(monthlyKey, 'cost', costIncurred);
    await this.redis.expire(monthlyKey, 90 * 86400); // Keep for 90 days
  }

  /**
   * Cancel a job and its associated analysis
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    try {
      // Get analysis ID from job data
      const jobData = await job.toJSON();
      if (jobData.returnvalue?.analysisId) {
        await this.searchService.cancelAnalysis(jobData.returnvalue.analysisId);
      }

      // Remove the job
      await job.remove();
      this.activeJobs.delete(jobId);

      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): Job[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Clean up on shutdown
   */
  async shutdown(): Promise<void> {
    // Cancel all active jobs
    for (const [jobId, job] of this.activeJobs) {
      try {
        await this.cancelJob(jobId);
      } catch (error) {
        this.logger.error(`Failed to cancel job ${jobId} during shutdown:`, error);
      }
    }

    await this.searchService.shutdown();
  }
}

/**
 * Create job processor for Bull queue
 */
export function createSearchIntelProcessor(redis: Redis) {
  const processor = new SearchIntelJobProcessor(redis);

  return async (job: Job<SearchIntelJobData>) => {
    return processor.process(job);
  };
}

/**
 * Job queue configuration
 */
export const SEARCH_INTEL_QUEUE_CONFIG = {
  name: 'search-intelligence',
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  },
  limiter: {
    max: 10,
    duration: 60000 // 10 jobs per minute
  }
};

/**
 * Priority mappings
 */
export const PRIORITY_WEIGHTS = {
  high: 1,
  normal: 5,
  low: 10
};