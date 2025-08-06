/**
 * SERP Cache Manager
 * Caches search results with compression and TTL management
 */

import { Redis } from 'ioredis';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Logger } from './logger.js';
import {
  CacheConfig,
  SearchResults,
  CacheStats
} from '../types/serp-client.types.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class SerpCacheManager {
  private logger: Logger;
  private redis: Redis;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    totalSize: number;
    compressionSavings: number;
  };

  constructor(redis: Redis, config: CacheConfig) {
    this.logger = new Logger('SerpCacheManager');
    this.redis = redis;
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      totalSize: 0,
      compressionSavings: 0
    };
    
    if (config.warmupQueries && config.warmupQueries.length > 0) {
      this.logger.info(`Cache warmup configured with ${config.warmupQueries.length} queries`);
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(query: string, options: any = {}): string {
    const normalized = query.toLowerCase().trim();
    const optionsKey = [
      options.location || 'global',
      options.language || 'en',
      options.device || 'desktop',
      options.num || '10',
      options.start || '0'
    ].join(':');
    
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${this.config.namespace}:${date}:${normalized}:${optionsKey}`;
  }

  /**
   * Get cached results
   */
  async get(query: string, options: any = {}): Promise<SearchResults | null> {
    if (!this.config.enabled) return null;
    
    const key = this.generateCacheKey(query, options);
    
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        this.stats.misses++;
        return null;
      }
      
      // Decompress if needed
      let data: string;
      if (this.config.compress) {
        const buffer = Buffer.from(cached, 'base64');
        const decompressed = await gunzip(buffer);
        data = decompressed.toString();
      } else {
        data = cached;
      }
      
      const results = JSON.parse(data);
      
      // Mark as cached
      results.cached = true;
      
      this.stats.hits++;
      this.logger.debug(`Cache hit for query: ${query}`);
      
      return results;
    } catch (error) {
      this.logger.error(`Cache get error for ${query}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached results
   */
  async set(query: string, results: SearchResults, options: any = {}): Promise<void> {
    if (!this.config.enabled) return;
    
    const key = this.generateCacheKey(query, options);
    
    try {
      const data = JSON.stringify(results);
      const originalSize = Buffer.byteLength(data);
      
      let toStore: string;
      if (this.config.compress) {
        const compressed = await gzip(data);
        toStore = compressed.toString('base64');
        const compressedSize = compressed.length;
        this.stats.compressionSavings += (originalSize - compressedSize);
        this.logger.debug(`Compressed ${originalSize} bytes to ${compressedSize} bytes (${Math.round((1 - compressedSize/originalSize) * 100)}% savings)`);
      } else {
        toStore = data;
      }
      
      // Set with TTL
      await this.redis.set(key, toStore, 'EX', this.config.ttl);
      
      this.stats.totalSize += toStore.length;
      this.logger.debug(`Cached results for query: ${query}`);
      
      // Update cache index for stats
      await this.updateCacheIndex(key, query, options);
    } catch (error) {
      this.logger.error(`Cache set error for ${query}:`, error);
    }
  }

  /**
   * Delete cached results
   */
  async delete(query: string, options: any = {}): Promise<void> {
    const key = this.generateCacheKey(query, options);
    await this.redis.del(key);
    await this.removeCacheIndex(key);
    this.logger.debug(`Deleted cache for query: ${query}`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    const pattern = `${this.config.namespace}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.info(`Cleared ${keys.length} cached entries`);
    }
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      totalSize: 0,
      compressionSavings: 0
    };
  }

  /**
   * Warm up cache with common queries
   */
  async warmup(
    queryFunction: (query: string) => Promise<SearchResults>
  ): Promise<void> {
    if (!this.config.warmupQueries || this.config.warmupQueries.length === 0) {
      return;
    }
    
    this.logger.info(`Starting cache warmup with ${this.config.warmupQueries.length} queries`);
    
    for (const query of this.config.warmupQueries) {
      try {
        // Check if already cached
        const existing = await this.get(query);
        if (existing) {
          this.logger.debug(`Warmup: ${query} already cached`);
          continue;
        }
        
        // Fetch and cache
        const results = await queryFunction(query);
        await this.set(query, results);
        this.logger.debug(`Warmup: cached ${query}`);
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(`Warmup failed for ${query}:`, error);
      }
    }
    
    this.logger.info('Cache warmup completed');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const pattern = `${this.config.namespace}:index:*`;
    const indexKeys = await this.redis.keys(pattern);
    
    let oldestEntry = new Date();
    let newestEntry = new Date(0);
    let totalEntries = 0;
    
    for (const key of indexKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const entry = JSON.parse(data);
        const timestamp = new Date(entry.timestamp);
        
        if (timestamp < oldestEntry) oldestEntry = timestamp;
        if (timestamp > newestEntry) newestEntry = timestamp;
        totalEntries++;
      }
    }
    
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
    
    const compressionRatio = this.stats.totalSize > 0 
      ? this.stats.compressionSavings / (this.stats.totalSize + this.stats.compressionSavings) 
      : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: totalEntries,
      oldestEntry,
      newestEntry,
      compressionRatio: this.config.compress ? compressionRatio : undefined
    };
  }

  /**
   * Update cache index for tracking
   */
  private async updateCacheIndex(key: string, query: string, options: any): Promise<void> {
    const indexKey = `${this.config.namespace}:index:${key}`;
    const indexData = {
      query,
      options,
      timestamp: new Date().toISOString(),
      key
    };
    
    await this.redis.set(
      indexKey,
      JSON.stringify(indexData),
      'EX',
      this.config.ttl
    );
  }

  /**
   * Remove from cache index
   */
  private async removeCacheIndex(key: string): Promise<void> {
    const indexKey = `${this.config.namespace}:index:${key}`;
    await this.redis.del(indexKey);
  }

  /**
   * Get all cached queries
   */
  async getCachedQueries(): Promise<Array<{ query: string; options: any; timestamp: string }>> {
    const pattern = `${this.config.namespace}:index:*`;
    const indexKeys = await this.redis.keys(pattern);
    
    const queries = [];
    for (const key of indexKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const entry = JSON.parse(data);
        queries.push({
          query: entry.query,
          options: entry.options,
          timestamp: entry.timestamp
        });
      }
    }
    
    return queries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Prune old cache entries
   */
  async prune(): Promise<number> {
    // Redis handles TTL automatically, but we can clean up index entries
    const pattern = `${this.config.namespace}:index:*`;
    const indexKeys = await this.redis.keys(pattern);
    
    let pruned = 0;
    for (const indexKey of indexKeys) {
      const key = indexKey.replace(':index:', ':');
      const exists = await this.redis.exists(key);
      
      if (!exists) {
        await this.redis.del(indexKey);
        pruned++;
      }
    }
    
    if (pruned > 0) {
      this.logger.info(`Pruned ${pruned} orphaned index entries`);
    }
    
    return pruned;
  }

  /**
   * Export cache for backup
   */
  async export(): Promise<Array<{ key: string; data: any }>> {
    const pattern = `${this.config.namespace}:*`;
    const keys = await this.redis.keys(pattern);
    
    const exported = [];
    for (const key of keys) {
      if (key.includes(':index:')) continue; // Skip index entries
      
      const data = await this.redis.get(key);
      if (data) {
        exported.push({ key, data });
      }
    }
    
    return exported;
  }

  /**
   * Import cache from backup
   */
  async import(data: Array<{ key: string; data: any }>): Promise<void> {
    for (const item of data) {
      await this.redis.set(item.key, item.data, 'EX', this.config.ttl);
    }
    
    this.logger.info(`Imported ${data.length} cache entries`);
  }
}