/**
 * Rate Limiter
 * Token bucket algorithm with queue for SERP API rate limiting
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger.js';
import { RateLimitConfig, RateLimitStats } from '../types/serp-client.types.js';

interface QueueItem {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
  timestamp: number;
  retries: number;
}

export class RateLimiter extends EventEmitter {
  private logger: Logger;
  private config: RateLimitConfig;
  private tokens: number;
  private lastRefill: number;
  private queue: QueueItem[] = [];
  private activeRequests: number = 0;
  private isProcessing: boolean = false;
  private stats: {
    totalRequests: number;
    throttledRequests: number;
    peakRate: number;
    lastMinuteRequests: number[];
  };

  constructor(config: RateLimitConfig) {
    super();
    this.logger = new Logger('RateLimiter');
    this.config = config;
    this.tokens = config.burstLimit;
    this.lastRefill = Date.now();
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      peakRate: 0,
      lastMinuteRequests: Array(60).fill(0)
    };
    
    // Start the token refill timer
    this.startRefillTimer();
    
    // Start stats tracking
    this.startStatsTimer();
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(
    fn: () => Promise<T>,
    priority: number = 5,
    id?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: id || `req-${Date.now()}-${Math.random()}`,
        execute: fn,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
        retries: 0
      };
      
      this.enqueue(item);
    });
  }

  /**
   * Add item to queue
   */
  private enqueue(item: QueueItem): void {
    // Insert based on priority (lower number = higher priority)
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority < this.queue[i].priority) {
        this.queue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.queue.push(item);
    }
    
    this.logger.debug(`Enqueued request ${item.id}, queue size: ${this.queue.length}`);
    this.emit('queued', { id: item.id, queueSize: this.queue.length });
    
    // Try to process queue
    this.processQueue();
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.activeRequests < this.config.concurrentRequests) {
      if (!this.consumeToken()) {
        // No tokens available, wait for refill
        this.stats.throttledRequests++;
        break;
      }
      
      const item = this.queue.shift()!;
      this.activeRequests++;
      this.stats.totalRequests++;
      
      // Update peak rate
      const currentRate = this.getCurrentRate();
      if (currentRate > this.stats.peakRate) {
        this.stats.peakRate = currentRate;
      }
      
      this.logger.debug(`Processing request ${item.id}, active: ${this.activeRequests}`);
      this.emit('processing', { id: item.id, activeRequests: this.activeRequests });
      
      // Execute with retry logic
      this.executeWithRetry(item);
    }
    
    this.isProcessing = false;
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(item: QueueItem): Promise<void> {
    try {
      const result = await item.execute();
      item.resolve(result);
      this.emit('completed', { id: item.id });
    } catch (error) {
      item.retries++;
      
      if (item.retries < this.config.maxRetries && this.isRetryableError(error)) {
        this.logger.warn(`Retrying request ${item.id}, attempt ${item.retries}/${this.config.maxRetries}`);
        
        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(item.retries);
        
        setTimeout(() => {
          this.enqueue(item);
        }, delay);
        
        this.emit('retry', { id: item.id, attempt: item.retries, delay });
      } else {
        this.logger.error(`Request ${item.id} failed after ${item.retries} retries`);
        item.reject(error);
        this.emit('failed', { id: item.id, error });
      }
    } finally {
      this.activeRequests--;
      
      // Process next item in queue
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Consume a token
   */
  private consumeToken(): boolean {
    this.refillTokens();
    
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    
    return false;
  }

  /**
   * Refill tokens based on rate
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.config.requestsPerSecond;
    
    this.tokens = Math.min(this.config.burstLimit, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Start token refill timer
   */
  private startRefillTimer(): void {
    setInterval(() => {
      this.refillTokens();
      
      // Try to process queue if we have tokens
      if (this.tokens > 0 && this.queue.length > 0) {
        this.processQueue();
      }
    }, 100); // Check every 100ms
  }

  /**
   * Start stats tracking timer
   */
  private startStatsTimer(): void {
    setInterval(() => {
      // Shift stats array and add current minute's requests
      this.stats.lastMinuteRequests.shift();
      this.stats.lastMinuteRequests.push(0);
    }, 1000); // Every second
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoffDelay(retries: number): number {
    if (this.config.backoffStrategy === 'exponential') {
      return Math.min(30000, Math.pow(2, retries) * 1000); // Max 30 seconds
    } else {
      return Math.min(30000, retries * 2000); // Linear: 2s, 4s, 6s...
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors and 5xx status codes are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }
    
    // Rate limit errors are retryable
    if (error.statusCode === 429) {
      return true;
    }
    
    return false;
  }

  /**
   * Get current request rate
   */
  private getCurrentRate(): number {
    const recentRequests = this.stats.lastMinuteRequests.slice(-10).reduce((a, b) => a + b, 0);
    return recentRequests / 10; // Average over last 10 seconds
  }

  /**
   * Get rate limit statistics
   */
  getStats(): RateLimitStats {
    return {
      currentRate: this.getCurrentRate(),
      peakRate: this.stats.peakRate,
      throttledRequests: this.stats.throttledRequests,
      queueSize: this.queue.length
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    const queueSize = this.queue.length;
    
    // Reject all queued items
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    this.logger.info(`Cleared ${queueSize} items from queue`);
    this.emit('queueCleared', { itemsCleared: queueSize });
  }

  /**
   * Get queue info
   */
  getQueueInfo(): {
    size: number;
    oldestItem?: { id: string; age: number };
    priorities: Record<number, number>;
  } {
    const info = {
      size: this.queue.length,
      oldestItem: undefined as { id: string; age: number } | undefined,
      priorities: {} as Record<number, number>
    };
    
    if (this.queue.length > 0) {
      const oldest = this.queue[this.queue.length - 1];
      info.oldestItem = {
        id: oldest.id,
        age: Date.now() - oldest.timestamp
      };
      
      // Count by priority
      this.queue.forEach(item => {
        info.priorities[item.priority] = (info.priorities[item.priority] || 0) + 1;
      });
    }
    
    return info;
  }

  /**
   * Wait for queue to be empty
   */
  async waitForEmpty(): Promise<void> {
    return new Promise(resolve => {
      if (this.queue.length === 0 && this.activeRequests === 0) {
        resolve();
        return;
      }
      
      const checkEmpty = () => {
        if (this.queue.length === 0 && this.activeRequests === 0) {
          this.removeListener('completed', checkEmpty);
          this.removeListener('failed', checkEmpty);
          resolve();
        }
      };
      
      this.on('completed', checkEmpty);
      this.on('failed', checkEmpty);
    });
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    this.clearQueue();
    this.removeAllListeners();
  }
}