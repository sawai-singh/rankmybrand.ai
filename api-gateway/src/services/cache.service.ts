/**
 * Redis Cache Service
 * Provides caching functionality for company lookups, scores, and query generation
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface CacheConfig {
  ttl: {
    company: number;      // Company lookup cache TTL (24 hours)
    scores: number;       // Score data cache TTL (1 hour)
    queries: number;      // Query generation cache TTL (6 hours)
    metrics: number;      // Dashboard metrics cache TTL (5 minutes)
    heatmap: number;      // Heatmap data cache TTL (15 minutes)
    activities: number;   // Activity feed cache TTL (2 minutes)
  };
  prefix: {
    company: string;
    scores: string;
    queries: string;
    metrics: string;
    heatmap: string;
    activities: string;
  };
}

export class CacheService {
  private redis: Redis;
  private config: CacheConfig;
  private hitCount: Map<string, number> = new Map();
  private missCount: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3
    });

    // Configure cache TTLs and prefixes
    this.config = {
      ttl: {
        company: 86400,     // 24 hours for company data
        scores: 3600,       // 1 hour for score data
        queries: 21600,     // 6 hours for generated queries
        metrics: 300,       // 5 minutes for dashboard metrics
        heatmap: 900,       // 15 minutes for heatmap data
        activities: 120     // 2 minutes for activity feed
      },
      prefix: {
        company: 'cache:company:',
        scores: 'cache:scores:',
        queries: 'cache:queries:',
        metrics: 'cache:metrics:',
        heatmap: 'cache:heatmap:',
        activities: 'cache:activities:'
      }
    };

    // Monitor cache performance
    this.startMonitoring();
  }

  /**
   * Cache company lookup results
   */
  async cacheCompanyLookup(email: string, companyData: any): Promise<void> {
    const domain = email.split('@')[1];
    const key = `${this.config.prefix.company}${domain}`;
    
    try {
      await this.redis.setex(
        key,
        this.config.ttl.company,
        JSON.stringify({
          data: companyData,
          cachedAt: new Date().toISOString(),
          email: email
        })
      );
      logger.debug(`Cached company data for domain: ${domain}`);
    } catch (error) {
      logger.error('Error caching company data:', error);
    }
  }

  /**
   * Get cached company lookup
   */
  async getCachedCompany(email: string): Promise<any | null> {
    const domain = email.split('@')[1];
    const key = `${this.config.prefix.company}${domain}`;
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit('company');
        logger.debug(`Cache hit for company domain: ${domain}`);
        return JSON.parse(cached).data;
      }
      this.recordMiss('company');
      return null;
    } catch (error) {
      logger.error('Error getting cached company:', error);
      return null;
    }
  }

  /**
   * Cache GEO/SOV scores for quick dashboard loads
   */
  async cacheScores(companyId: number, reportId: string, scores: any): Promise<void> {
    const key = `${this.config.prefix.scores}${companyId}:${reportId}`;
    
    try {
      await this.redis.setex(
        key,
        this.config.ttl.scores,
        JSON.stringify({
          scores,
          cachedAt: new Date().toISOString(),
          companyId,
          reportId
        })
      );
      logger.debug(`Cached scores for company ${companyId}, report ${reportId}`);
    } catch (error) {
      logger.error('Error caching scores:', error);
    }
  }

  /**
   * Get cached scores
   */
  async getCachedScores(companyId: number, reportId?: string): Promise<any | null> {
    const pattern = reportId 
      ? `${this.config.prefix.scores}${companyId}:${reportId}`
      : `${this.config.prefix.scores}${companyId}:*`;
    
    try {
      if (reportId) {
        const cached = await this.redis.get(pattern);
        if (cached) {
          this.recordHit('scores');
          return JSON.parse(cached).scores;
        }
      } else {
        // Get latest scores for company
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          // Sort by key to get latest
          keys.sort().reverse();
          const cached = await this.redis.get(keys[0]);
          if (cached) {
            this.recordHit('scores');
            return JSON.parse(cached).scores;
          }
        }
      }
      this.recordMiss('scores');
      return null;
    } catch (error) {
      logger.error('Error getting cached scores:', error);
      return null;
    }
  }

  /**
   * Cache generated queries for similar companies/industries
   */
  async cacheQueries(industry: string, queries: any[]): Promise<void> {
    const key = `${this.config.prefix.queries}${industry.toLowerCase().replace(/\s+/g, '_')}`;
    
    try {
      await this.redis.setex(
        key,
        this.config.ttl.queries,
        JSON.stringify({
          queries,
          cachedAt: new Date().toISOString(),
          industry
        })
      );
      logger.debug(`Cached ${queries.length} queries for industry: ${industry}`);
    } catch (error) {
      logger.error('Error caching queries:', error);
    }
  }

  /**
   * Get cached queries for an industry
   */
  async getCachedQueries(industry: string): Promise<any[] | null> {
    const key = `${this.config.prefix.queries}${industry.toLowerCase().replace(/\s+/g, '_')}`;
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit('queries');
        logger.debug(`Cache hit for queries in industry: ${industry}`);
        return JSON.parse(cached).queries;
      }
      this.recordMiss('queries');
      return null;
    } catch (error) {
      logger.error('Error getting cached queries:', error);
      return null;
    }
  }

  /**
   * Cache dashboard metrics
   */
  async cacheMetrics(companyId: number, metrics: any): Promise<void> {
    const key = `${this.config.prefix.metrics}${companyId}`;
    
    try {
      await this.redis.setex(
        key,
        this.config.ttl.metrics,
        JSON.stringify({
          metrics,
          cachedAt: new Date().toISOString()
        })
      );
      logger.debug(`Cached dashboard metrics for company: ${companyId}`);
    } catch (error) {
      logger.error('Error caching metrics:', error);
    }
  }

  /**
   * Get cached dashboard metrics
   */
  async getCachedMetrics(companyId: number): Promise<any | null> {
    const key = `${this.config.prefix.metrics}${companyId}`;
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit('metrics');
        return JSON.parse(cached).metrics;
      }
      this.recordMiss('metrics');
      return null;
    } catch (error) {
      logger.error('Error getting cached metrics:', error);
      return null;
    }
  }

  /**
   * Cache heatmap data
   */
  async cacheHeatmap(companyId: number, heatmapData: any): Promise<void> {
    const key = `${this.config.prefix.heatmap}${companyId}`;
    
    try {
      await this.redis.setex(
        key,
        this.config.ttl.heatmap,
        JSON.stringify({
          data: heatmapData,
          cachedAt: new Date().toISOString()
        })
      );
      logger.debug(`Cached heatmap data for company: ${companyId}`);
    } catch (error) {
      logger.error('Error caching heatmap:', error);
    }
  }

  /**
   * Get cached heatmap data
   */
  async getCachedHeatmap(companyId: number): Promise<any | null> {
    const key = `${this.config.prefix.heatmap}${companyId}`;
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.recordHit('heatmap');
        return JSON.parse(cached).data;
      }
      this.recordMiss('heatmap');
      return null;
    } catch (error) {
      logger.error('Error getting cached heatmap:', error);
      return null;
    }
  }

  /**
   * Invalidate cache for a specific type and key
   */
  async invalidate(type: keyof CacheConfig['prefix'], identifier: string): Promise<void> {
    const key = `${this.config.prefix[type]}${identifier}`;
    
    try {
      await this.redis.del(key);
      logger.debug(`Invalidated cache for ${type}: ${identifier}`);
    } catch (error) {
      logger.error('Error invalidating cache:', error);
    }
  }

  /**
   * Clear all caches of a specific type
   */
  async clearType(type: keyof CacheConfig['prefix']): Promise<void> {
    const pattern = `${this.config.prefix[type]}*`;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Cleared ${keys.length} cache entries for type: ${type}`);
      }
    } catch (error) {
      logger.error('Error clearing cache type:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    const stats: any = {
      hitRates: {},
      totalHits: 0,
      totalMisses: 0,
      cacheSize: {},
      uptime: new Date().getTime() - this.lastReset.getTime()
    };

    // Calculate hit rates for each cache type
    for (const [type, hits] of this.hitCount) {
      const misses = this.missCount.get(type) || 0;
      const total = hits + misses;
      stats.hitRates[type] = total > 0 ? (hits / total * 100).toFixed(2) + '%' : '0%';
      stats.totalHits += hits;
      stats.totalMisses += misses;
    }

    // Get cache sizes
    for (const [type, prefix] of Object.entries(this.config.prefix)) {
      const keys = await this.redis.keys(`${prefix}*`);
      stats.cacheSize[type] = keys.length;
    }

    // Overall hit rate
    const totalRequests = stats.totalHits + stats.totalMisses;
    stats.overallHitRate = totalRequests > 0 
      ? (stats.totalHits / totalRequests * 100).toFixed(2) + '%' 
      : '0%';

    return stats;
  }

  /**
   * Monitor cache performance
   */
  private startMonitoring(): void {
    // Reset counters every hour
    setInterval(() => {
      const stats = {
        timestamp: new Date().toISOString(),
        hitRates: {} as any,
        totalHits: 0,
        totalMisses: 0
      };

      for (const [type, hits] of this.hitCount) {
        const misses = this.missCount.get(type) || 0;
        const total = hits + misses;
        stats.hitRates[type] = total > 0 ? (hits / total * 100).toFixed(2) + '%' : '0%';
        stats.totalHits += hits;
        stats.totalMisses += misses;
      }

      // Log performance metrics
      if (stats.totalHits + stats.totalMisses > 0) {
        logger.info('Cache performance metrics:', stats);
      }

      // Reset counters
      this.hitCount.clear();
      this.missCount.clear();
      this.lastReset = new Date();
    }, 3600000); // 1 hour
  }

  /**
   * Record cache hit
   */
  private recordHit(type: string): void {
    this.hitCount.set(type, (this.hitCount.get(type) || 0) + 1);
  }

  /**
   * Record cache miss
   */
  private recordMiss(type: string): void {
    this.missCount.set(type, (this.missCount.get(type) || 0) + 1);
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    logger.info('Disconnected from Redis cache');
  }
}

// Export singleton instance
export const cacheService = new CacheService();