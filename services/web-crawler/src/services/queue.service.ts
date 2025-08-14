import Bull from 'bull';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

export class QueueService {
  private queues: Map<string, Bull.Queue> = new Map();
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  
  async initialize(): Promise<void> {
    // Create crawl queue
    const crawlQueue = new Bull('crawl', {
      redis: {
        host: this.redis.options.host,
        port: this.redis.options.port as number,
        password: this.redis.options.password,
      }
    });
    
    this.queues.set('crawl', crawlQueue);
    
    logger.info('Queue service initialized');
  }
  
  async addJob(queueName: string, data: any, options?: Bull.JobOptions): Promise<Bull.Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    return queue.add(data, options);
  }
  
  async getJob(queueName: string, jobId: string): Promise<Bull.Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    return queue.getJob(jobId);
  }
  
  async shutdown(): Promise<void> {
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }
    
    await this.redis.quit();
  }
}