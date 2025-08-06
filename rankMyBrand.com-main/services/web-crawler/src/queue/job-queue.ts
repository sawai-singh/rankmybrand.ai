/**
 * Simple Job Queue Implementation
 * Provides a basic queue interface for the Search Intelligence service
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export interface JobData {
  id: string;
  type: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: string;
}

export class JobQueue {
  private redis: Redis;

  constructor(redis?: Redis) {
    if (redis) {
      this.redis = redis;
    } else {
      // Create a new Redis connection if not provided
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
  }

  async add(type: string, data: any): Promise<string> {
    const jobId = uuidv4();
    const job: JobData = {
      id: jobId,
      type,
      data,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.redis.set(`job:${jobId}`, JSON.stringify(job));
    await this.redis.lpush(`queue:${type}`, jobId);
    
    logger.info(`Job ${jobId} added to queue ${type}`);
    return jobId;
  }

  async get(jobId: string): Promise<JobData | null> {
    const jobData = await this.redis.get(`job:${jobId}`);
    if (!jobData) return null;
    return JSON.parse(jobData);
  }

  async update(jobId: string, updates: Partial<JobData>): Promise<void> {
    const job = await this.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date()
    };

    await this.redis.set(`job:${jobId}`, JSON.stringify(updatedJob));
  }

  async process(type: string, handler: (job: JobData) => Promise<any>): Promise<void> {
    while (true) {
      try {
        // Block and wait for jobs
        const result = await this.redis.brpop(`queue:${type}`, 0);
        if (!result) continue;

        const [, jobId] = result;
        const job = await this.get(jobId);
        if (!job) continue;

        // Update status to processing
        await this.update(jobId, { status: 'processing' });

        try {
          // Process the job
          const jobResult = await handler(job);
          await this.update(jobId, { 
            status: 'completed', 
            result: jobResult 
          });
        } catch (error) {
          await this.update(jobId, { 
            status: 'failed', 
            error: error.message 
          });
          logger.error(`Job ${jobId} failed:`, error);
        }
      } catch (error) {
        logger.error('Queue processing error:', error);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}