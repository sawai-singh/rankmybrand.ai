/**
 * Cache Pre-warmer
 * Pre-warms cache with common queries to improve performance
 */

import { SerpClientV2 } from '../core/serp-client-v2.js';
import { SerpCacheManager } from '../utils/serp-cache-manager.js';
import { logger } from '../../utils/logger.js';
import { Redis } from 'ioredis';
import type { SearchOptions } from '../types/serp-client.types.js';

interface PrewarmConfig {
  industries: string[];
  commonBrands: string[];
  locations?: string[];
  maxQueriesPerCategory: number;
}

export class CachePrewarmer {
  private serpClient: SerpClientV2;
  private cacheManager: SerpCacheManager;
  private redis: Redis;
  
  constructor(serpClient: SerpClientV2, redis: Redis) {
    this.serpClient = serpClient;
    this.redis = redis;
    this.cacheManager = new SerpCacheManager(redis);
  }

  /**
   * Pre-warm cache with common queries
   */
  async prewarmCache(config: PrewarmConfig): Promise<void> {
    logger.info('Starting cache pre-warming');
    
    const queries = this.generateCommonQueries(config);
    const startTime = Date.now();
    let warmed = 0;
    let errors = 0;
    
    for (const { query, options } of queries) {
      try {
        // Check if already cached
        const cached = await this.cacheManager.get(query, options || {});
        if (cached) {
          continue;
        }
        
        // Fetch and cache
        await this.serpClient.search(query, options);
        warmed++;
        
        // Rate limit pre-warming
        await this.sleep(200); // 5 queries per second max
      } catch (error) {
        errors++;
        logger.error(`Failed to pre-warm query: ${query}`, error);
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Cache pre-warming completed: ${warmed} queries warmed, ${errors} errors, took ${duration}ms`);
  }

  /**
   * Generate common queries based on patterns
   */
  private generateCommonQueries(config: PrewarmConfig): Array<{ query: string; options?: SearchOptions }> {
    const queries: Array<{ query: string; options?: SearchOptions }> = [];
    
    // Industry-specific queries
    for (const industry of config.industries) {
      queries.push(...this.generateIndustryQueries(industry, config.maxQueriesPerCategory));
    }
    
    // Brand comparison queries
    for (let i = 0; i < config.commonBrands.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 3, config.commonBrands.length); j++) {
        queries.push({
          query: `${config.commonBrands[i]} vs ${config.commonBrands[j]}`
        });
      }
    }
    
    // Location-based queries if provided
    if (config.locations) {
      for (const location of config.locations) {
        for (const industry of config.industries) {
          queries.push({
            query: `best ${industry} software ${location}`,
            options: { location }
          });
        }
      }
    }
    
    // Common how-to queries
    queries.push(...this.generateHowToQueries(config.industries));
    
    return queries;
  }

  /**
   * Generate industry-specific queries
   */
  private generateIndustryQueries(industry: string, limit: number): Array<{ query: string }> {
    const templates = [
      `best ${industry} software`,
      `top ${industry} platforms`,
      `${industry} software comparison`,
      `${industry} tools for business`,
      `enterprise ${industry} solutions`,
      `${industry} software reviews`,
      `how to choose ${industry} software`,
      `${industry} software pricing`,
      `${industry} automation tools`,
      `${industry} integration guide`
    ];
    
    return templates.slice(0, limit).map(template => ({ query: template }));
  }

  /**
   * Generate common how-to queries
   */
  private generateHowToQueries(industries: string[]): Array<{ query: string }> {
    const queries: Array<{ query: string }> = [];
    
    const howToTemplates = [
      'how to implement',
      'how to optimize',
      'how to integrate',
      'how to choose',
      'how to evaluate'
    ];
    
    for (const industry of industries) {
      for (const template of howToTemplates) {
        queries.push({ query: `${template} ${industry} software` });
      }
    }
    
    return queries;
  }

  /**
   * Pre-warm cache based on historical data
   */
  async prewarmFromHistory(days: number = 7): Promise<void> {
    logger.info(`Pre-warming cache from last ${days} days of history`);
    
    try {
      // Get popular queries from history
      const popularQueries = await this.getPopularQueries(days);
      
      for (const { query, count } of popularQueries) {
        try {
          const cached = await this.cacheManager.get(query, {});
          if (!cached && count > 5) { // Only pre-warm if queried >5 times
            await this.serpClient.search(query);
            await this.sleep(200);
          }
        } catch (error) {
          logger.error(`Failed to pre-warm historical query: ${query}`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to pre-warm from history', error);
    }
  }

  /**
   * Get popular queries from Redis history
   */
  private async getPopularQueries(days: number): Promise<Array<{ query: string; count: number }>> {
    const key = 'search:query:history';
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    
    try {
      // Get queries from sorted set
      const queries = await this.redis.zrevrangebyscore(
        key,
        now,
        cutoff,
        'WITHSCORES',
        'LIMIT',
        0,
        100
      );
      
      const result: Array<{ query: string; count: number }> = [];
      for (let i = 0; i < queries.length; i += 2) {
        result.push({
          query: queries[i],
          count: parseInt(queries[i + 1])
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get popular queries', error);
      return [];
    }
  }

  /**
   * Schedule periodic cache warming
   */
  schedulePeriodicWarming(intervalHours: number = 6): void {
    setInterval(async () => {
      try {
        await this.prewarmFromHistory(3); // Warm from last 3 days
      } catch (error) {
        logger.error('Periodic cache warming failed', error);
      }
    }, intervalHours * 60 * 60 * 1000);
    
    logger.info(`Scheduled cache warming every ${intervalHours} hours`);
  }

  /**
   * Analyze cache efficiency
   */
  async analyzeCacheEfficiency(): Promise<{
    totalQueries: number;
    cachedQueries: number;
    hitRate: number;
    avgSavings: number;
    topMissedQueries: string[];
  }> {
    const stats = await this.cacheManager.getStats();
    const hitRate = stats.hits / (stats.hits + stats.misses) || 0;
    
    // Calculate average cost savings
    const avgCostPerQuery = 0.01;
    const avgTimePerQuery = 2000; // 2 seconds
    const avgSavings = stats.hits * avgCostPerQuery;
    
    // Get top missed queries
    const missedQueries = await this.redis.zrevrange(
      'cache:misses',
      0,
      9,
      'WITHSCORES'
    );
    
    const topMissedQueries: string[] = [];
    for (let i = 0; i < missedQueries.length; i += 2) {
      topMissedQueries.push(missedQueries[i]);
    }
    
    return {
      totalQueries: stats.hits + stats.misses,
      cachedQueries: stats.hits,
      hitRate: hitRate * 100,
      avgSavings,
      topMissedQueries
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}