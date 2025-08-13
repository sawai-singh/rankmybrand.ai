import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  maxTokens?: number;
  refillRate?: number;  // tokens per second
  windowMs?: number;   // for sliding window
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  resetAt: Date;
  retryAfter?: number;  // seconds
}

export class RateLimiter {
  private redis: Redis;
  private defaultMaxTokens: number;
  private defaultRefillRate: number;
  private defaultWindowMs: number;
  
  constructor(redisConfig?: {
    host?: string;
    port?: number;
    password?: string;
  }, defaultConfig?: RateLimitConfig) {
    this.redis = new Redis({
      host: redisConfig?.host || process.env.REDIS_HOST || 'localhost',
      port: redisConfig?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: redisConfig?.password || process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000)
    });

    this.defaultMaxTokens = defaultConfig?.maxTokens || 
      parseInt(process.env.RATE_LIMIT_MAX_TOKENS || '1000');
    this.defaultRefillRate = defaultConfig?.refillRate || 
      parseInt(process.env.RATE_LIMIT_REFILL_RATE || '100');
    this.defaultWindowMs = defaultConfig?.windowMs || 60000; // 1 minute

    this.redis.on('error', (err) => {
      logger.error('RateLimiter Redis error:', err);
    });
  }

  /**
   * Token bucket algorithm for rate limiting
   */
  async checkLimit(
    key: string, 
    config?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const maxTokens = config?.maxTokens || this.defaultMaxTokens;
    const refillRate = config?.refillRate || this.defaultRefillRate;
    const bucketKey = `rate_limit:token_bucket:${key}`;
    const now = Date.now();

    try {
      // Lua script for atomic token bucket operations
      const luaScript = `
        local key = KEYS[1]
        local max_tokens = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or max_tokens
        local last_refill = tonumber(bucket[2]) or now
        
        -- Calculate tokens to add
        local time_passed = (now - last_refill) / 1000
        local tokens_to_add = math.floor(time_passed * refill_rate)
        tokens = math.min(max_tokens, tokens + tokens_to_add)
        
        if tokens >= requested then
          tokens = tokens - requested
          redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
          redis.call('EXPIRE', key, 3600)
          return {1, tokens, 0}
        else
          local wait_time = math.ceil((requested - tokens) / refill_rate)
          return {0, tokens, wait_time}
        end
      `;

      const result = await this.redis.eval(
        luaScript,
        1,
        bucketKey,
        maxTokens,
        refillRate,
        now,
        1  // requesting 1 token
      ) as [number, number, number];

      const [allowed, remainingTokens, waitTime] = result;
      
      // Update metrics
      if (allowed === 1) {
        await this.redis.hincrby('metrics:rate_limit:allowed', key, 1);
      } else {
        await this.redis.hincrby('metrics:rate_limit:rejected', key, 1);
      }

      return {
        allowed: allowed === 1,
        remainingTokens,
        resetAt: new Date(now + (waitTime * 1000)),
        retryAfter: waitTime > 0 ? waitTime : undefined
      };
    } catch (error) {
      logger.error(`Rate limit check failed for ${key}:`, error);
      // On error, allow the request but log it
      return {
        allowed: true,
        remainingTokens: 0,
        resetAt: new Date(now + 1000)
      };
    }
  }

  /**
   * Sliding window log algorithm for more precise rate limiting
   */
  async checkWindowLimit(
    key: string,
    maxRequests: number,
    windowMs?: number
  ): Promise<RateLimitResult> {
    const window = windowMs || this.defaultWindowMs;
    const windowKey = `rate_limit:window:${key}`;
    const now = Date.now();
    const windowStart = now - window;

    try {
      const pipe = this.redis.pipeline();
      
      // Remove old entries
      pipe.zremrangebyscore(windowKey, '-inf', windowStart);
      
      // Count current window requests
      pipe.zcard(windowKey);
      
      // Add current request
      pipe.zadd(windowKey, now, `${now}-${Math.random()}`);
      
      // Set expiry
      pipe.expire(windowKey, Math.ceil(window / 1000));
      
      const results = await pipe.exec();
      
      if (!results) {
        throw new Error('Pipeline execution failed');
      }

      const count = results[1][1] as number;
      
      if (count < maxRequests) {
        await this.redis.hincrby('metrics:rate_limit:window:allowed', key, 1);
        
        return {
          allowed: true,
          remainingTokens: maxRequests - count - 1,
          resetAt: new Date(now + window)
        };
      } else {
        // Remove the request we just added since it's not allowed
        await this.redis.zrem(windowKey, `${now}-${Math.random()}`);
        await this.redis.hincrby('metrics:rate_limit:window:rejected', key, 1);
        
        // Get the oldest entry to calculate when a slot will be free
        const oldest = await this.redis.zrange(windowKey, 0, 0, 'WITHSCORES');
        const oldestTime = oldest.length > 1 ? parseInt(oldest[1]) : now;
        const resetTime = oldestTime + window;
        
        return {
          allowed: false,
          remainingTokens: 0,
          resetAt: new Date(resetTime),
          retryAfter: Math.ceil((resetTime - now) / 1000)
        };
      }
    } catch (error) {
      logger.error(`Window rate limit check failed for ${key}:`, error);
      // On error, allow the request but log it
      return {
        allowed: true,
        remainingTokens: 0,
        resetAt: new Date(now + window)
      };
    }
  }

  /**
   * Get current rate limit status without consuming a token
   */
  async getStatus(key: string, config?: RateLimitConfig): Promise<{
    remainingTokens: number;
    maxTokens: number;
    refillRate: number;
  }> {
    const maxTokens = config?.maxTokens || this.defaultMaxTokens;
    const refillRate = config?.refillRate || this.defaultRefillRate;
    const bucketKey = `rate_limit:token_bucket:${key}`;
    const now = Date.now();

    try {
      const bucket = await this.redis.hmget(bucketKey, 'tokens', 'last_refill');
      const currentTokens = parseInt(bucket[0] || String(maxTokens));
      const lastRefill = parseInt(bucket[1] || String(now));
      
      // Calculate current tokens with refill
      const timePassed = (now - lastRefill) / 1000;
      const tokensToAdd = Math.floor(timePassed * refillRate);
      const tokens = Math.min(maxTokens, currentTokens + tokensToAdd);
      
      return {
        remainingTokens: tokens,
        maxTokens,
        refillRate
      };
    } catch (error) {
      logger.error(`Failed to get rate limit status for ${key}:`, error);
      return {
        remainingTokens: 0,
        maxTokens,
        refillRate
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    const bucketKey = `rate_limit:token_bucket:${key}`;
    const windowKey = `rate_limit:window:${key}`;
    
    try {
      await this.redis.del(bucketKey, windowKey);
      logger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to reset rate limit for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limit metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    try {
      const [allowed, rejected, windowAllowed, windowRejected] = await Promise.all([
        this.redis.hgetall('metrics:rate_limit:allowed'),
        this.redis.hgetall('metrics:rate_limit:rejected'),
        this.redis.hgetall('metrics:rate_limit:window:allowed'),
        this.redis.hgetall('metrics:rate_limit:window:rejected')
      ]);
      
      return {
        tokenBucket: {
          allowed: this.sumValues(allowed),
          rejected: this.sumValues(rejected),
          byKey: { allowed, rejected }
        },
        slidingWindow: {
          allowed: this.sumValues(windowAllowed),
          rejected: this.sumValues(windowRejected),
          byKey: { allowed: windowAllowed, rejected: windowRejected }
        }
      };
    } catch (error) {
      logger.error('Failed to get rate limit metrics:', error);
      return {};
    }
  }

  private sumValues(obj: Record<string, string>): number {
    return Object.values(obj).reduce((sum, val) => sum + parseInt(val || '0'), 0);
  }

  /**
   * Clean up old rate limit entries
   */
  async cleanup(olderThanMs: number = 86400000): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    
    try {
      // Find and delete old window keys
      const windowKeys = await this.redis.keys('rate_limit:window:*');
      
      for (const key of windowKeys) {
        await this.redis.zremrangebyscore(key, '-inf', cutoff);
        const card = await this.redis.zcard(key);
        if (card === 0) {
          await this.redis.del(key);
        }
      }
      
      logger.info(`Rate limiter cleanup completed, removed entries older than ${olderThanMs}ms`);
    } catch (error) {
      logger.error('Rate limiter cleanup failed:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    logger.info('RateLimiter disconnected from Redis');
  }
}