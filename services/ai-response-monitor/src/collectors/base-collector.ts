import Redis from 'ioredis';
import { createHash } from 'crypto';
import path from 'path';
import { AIResponse, CollectionOptions } from '../types';

// Import Foundation components
const foundationPath = path.resolve(__dirname, '../../../foundation/src');
const { EventBus } = require(path.join(foundationPath, 'core/event-bus'));
const { RateLimiter } = require(path.join(foundationPath, 'core/rate-limiter'));

export abstract class BaseCollector {
  protected name: string;
  protected redis: Redis;
  protected rateLimiter: RateLimiter;
  protected eventBus: EventBus;
  protected cacheEnabled: boolean;
  protected cacheTTL: number;
  
  // Metrics
  protected totalRequests: number = 0;
  protected successfulRequests: number = 0;
  protected failedRequests: number = 0;
  protected totalCost: number = 0;
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;
  
  constructor(name: string, redis: Redis) {
    this.name = name;
    this.redis = redis;
    this.rateLimiter = new RateLimiter({ host: process.env.REDIS_HOST });
    this.eventBus = new EventBus({ host: process.env.REDIS_HOST });
    this.cacheEnabled = process.env.CACHE_ENABLED === 'true';
    this.cacheTTL = parseInt(process.env.CACHE_TTL || '3600');
  }
  
  /**
   * Abstract method to be implemented by specific collectors
   */
  abstract collect(prompt: string, options?: CollectionOptions): Promise<AIResponse>;
  
  /**
   * Initialize the collector (e.g., API client setup)
   */
  abstract initialize(): Promise<void>;
  
  /**
   * Validate if the collector is properly configured
   */
  abstract validate(): Promise<boolean>;
  
  /**
   * Get the cost for a specific model/usage
   */
  abstract calculateCost(usage: unknown): number;
  
  /**
   * Execute function with rate limiting
   */
  protected async withRateLimit<T>(
    key: string,
    fn: () => Promise<T>,
    config?: { maxTokens?: number; refillRate?: number }
  ): Promise<T> {
    const rateLimitKey = `ai-monitor:${this.name}:${key}`;
    const defaultConfig = {
      maxTokens: parseInt(process.env[`${this.name.toUpperCase()}_RATE_LIMIT`] || '100'),
      refillRate: parseInt(process.env[`${this.name.toUpperCase()}_RATE_WINDOW`] || '60000') / 1000
    };
    
    const result = await this.rateLimiter.checkLimit(rateLimitKey, config || defaultConfig);
    
    if (!result.allowed) {
      const error = new Error(`Rate limit exceeded for ${this.name}. Retry after ${result.retryAfter}s`);
      (error as Error & { retryAfter?: number }).retryAfter = result.retryAfter;
      throw error;
    }
    
    return fn();
  }
  
  /**
   * Execute function with caching
   */
  protected async withCache<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>
  ): Promise<{ data: T; fromCache: boolean }> {
    if (!this.cacheEnabled) {
      const data = await fn();
      this.cacheMisses++;
      return { data, fromCache: false };
    }
    
    const cacheKey = this.getCacheKey(key);
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return { data: JSON.parse(cached), fromCache: true };
    }
    
    // Execute function and cache result
    const data = await fn();
    await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    this.cacheMisses++;
    
    return { data, fromCache: false };
  }
  
  /**
   * Generate cache key
   */
  protected getCacheKey(input: string): string {
    const hash = createHash('md5').update(input).digest('hex');
    return `ai-monitor:cache:${this.name}:${hash}`;
  }
  
  /**
   * Publish response to event bus with required context
   */
  protected async publishResponse(response: AIResponse, context?: { brand_id?: string; customer_id?: string }): Promise<void> {
    // Ensure brand_id and customer_id are included
    const enrichedResponse = {
      ...response,
      brand_id: context?.brand_id || response.metadata?.brand_id,
      customer_id: context?.customer_id || response.metadata?.customer_id,
      metadata: {
        ...response.metadata,
        brand_id: context?.brand_id || response.metadata?.brand_id,
        customer_id: context?.customer_id || response.metadata?.customer_id
      }
    };
    
    await this.eventBus.publish('ai.responses.raw', {
      type: 'response.collected',
      data: enrichedResponse,
      correlationId: response.id,
      brand_id: context?.brand_id || response.metadata?.brand_id,
      customer_id: context?.customer_id || response.metadata?.customer_id,
      metadata: {
        collector: this.name,
        timestamp: new Date().toISOString(),
        brand_id: context?.brand_id || response.metadata?.brand_id,
        customer_id: context?.customer_id || response.metadata?.customer_id
      }
    });
  }
  
  /**
   * Track metrics
   */
  protected trackMetrics(success: boolean, cost?: number, responseTime?: number): void {
    this.totalRequests++;
    
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
    
    if (cost) {
      this.totalCost += cost;
    }
    
    // Store metrics in Redis for aggregation
    this.storeMetrics(responseTime);
  }
  
  private async storeMetrics(responseTime?: number): Promise<void> {
    const metricsKey = `ai-monitor:metrics:${this.name}`;
    
    await this.redis.hincrby(metricsKey, 'total_requests', 1);
    await this.redis.hincrby(metricsKey, 'successful_requests', this.successfulRequests > 0 ? 1 : 0);
    await this.redis.hincrby(metricsKey, 'failed_requests', this.failedRequests > 0 ? 1 : 0);
    
    if (this.totalCost > 0) {
      await this.redis.hincrbyfloat(metricsKey, 'total_cost', this.totalCost);
    }
    
    if (responseTime) {
      await this.redis.lpush(`${metricsKey}:response_times`, responseTime);
      await this.redis.ltrim(`${metricsKey}:response_times`, 0, 999); // Keep last 1000
    }
    
    // Set expiry
    await this.redis.expire(metricsKey, 86400); // 24 hours
  }
  
  /**
   * Get collector metrics
   */
  async getMetrics(): Promise<{
    name: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    totalCost: number;
    cacheHitRate: number;
    averageResponseTime: number;
  }> {
    const metricsKey = `ai-monitor:metrics:${this.name}`;
    const metrics = await this.redis.hgetall(metricsKey);
    
    // Calculate average response time
    const responseTimes = await this.redis.lrange(`${metricsKey}:response_times`, 0, -1);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + parseFloat(time), 0) / responseTimes.length
      : 0;
    
    const totalReqs = parseInt(metrics.total_requests || '0');
    const successReqs = parseInt(metrics.successful_requests || '0');
    const cacheTotal = this.cacheHits + this.cacheMisses;
    
    return {
      name: this.name,
      totalRequests: totalReqs,
      successfulRequests: successReqs,
      failedRequests: parseInt(metrics.failed_requests || '0'),
      successRate: totalReqs > 0 ? (successReqs / totalReqs) * 100 : 0,
      totalCost: parseFloat(metrics.total_cost || '0'),
      cacheHitRate: cacheTotal > 0 ? (this.cacheHits / cacheTotal) * 100 : 0,
      averageResponseTime: avgResponseTime
    };
  }
  
  /**
   * Retry logic with exponential backoff
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.message?.includes('Invalid API key') ||
            error.message?.includes('Insufficient credits')) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  /**
   * Delay helper
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Sanitize response to remove sensitive information
   */
  protected sanitizeResponse(response: AIResponse): AIResponse {
    // Remove any API keys or tokens that might be in the response
    const sanitized = { ...response };
    
    if (sanitized.metadata) {
      delete sanitized.metadata.apiKey;
      delete sanitized.metadata.token;
      delete sanitized.metadata.sessionId;
    }
    
    return sanitized;
  }
  
  /**
   * Check if collector is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      return await this.validate();
    } catch (error) {
      return false;
    }
  }
}