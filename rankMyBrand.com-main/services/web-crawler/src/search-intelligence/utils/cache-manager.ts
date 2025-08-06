/**
 * Cache Manager
 * Handles Redis caching for search intelligence data
 */

import { createClient, RedisClientType } from 'redis';
import { Logger } from './logger.js';
import { CacheConfig } from '../types/search-intelligence.types.js';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CacheManager {
  private logger: Logger;
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly defaultTTL = 86400; // 24 hours
  private readonly keyPrefix = 'search_intel:';

  constructor() {
    this.logger = new Logger('CacheManager');
    this.connect();
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              this.logger.error('Redis reconnection limit reached');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const cached = await this.client.get(fullKey);
      
      if (!cached) {
        return null;
      }

      // Check if data is compressed
      if (cached.startsWith('gzip:')) {
        const compressed = Buffer.from(cached.substring(5), 'base64');
        const decompressed = await gunzip(compressed);
        return JSON.parse(decompressed.toString());
      }

      return JSON.parse(cached);
    } catch (error) {
      this.logger.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set<T>(
    key: string, 
    value: T, 
    config: Partial<CacheConfig> = {}
  ): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const ttl = config.ttl || this.defaultTTL;
      let data = JSON.stringify(value);

      // Compress if requested and data is large enough
      if (config.compress && data.length > 1024) {
        const compressed = await gzip(Buffer.from(data));
        data = 'gzip:' + compressed.toString('base64');
      }

      if (ttl > 0) {
        await this.client.setEx(fullKey, ttl, data);
      } else {
        await this.client.set(fullKey, data);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to set cache for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const pipeline = this.client.multi();
      keys.forEach(key => pipeline.del(key));
      
      const results = await pipeline.exec();
      return results.length;
    } catch (error) {
      this.logger.error(`Failed to clear pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const exists = await this.client.exists(fullKey);
      return exists > 0;
    } catch (error) {
      this.logger.error(`Failed to check existence for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return -1;
    }

    try {
      const fullKey = this.keyPrefix + key;
      return await this.client.ttl(fullKey);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.keyPrefix + key;
      return await this.client.expire(fullKey, seconds);
    } catch (error) {
      this.logger.error(`Failed to set expiration for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, by = 1): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const fullKey = this.keyPrefix + key;
      return await this.client.incrBy(fullKey, by);
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const fullKeys = keys.map(key => this.keyPrefix + key);
      const values = await this.client.mGet(fullKeys);
      
      return Promise.all(values.map(async (value) => {
        if (!value) return null;
        
        try {
          if (value.startsWith('gzip:')) {
            const compressed = Buffer.from(value.substring(5), 'base64');
            const decompressed = await gunzip(compressed);
            return JSON.parse(decompressed.toString()) as T;
          }
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      }));
    } catch (error) {
      this.logger.error('Failed to get multiple keys:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
  }> {
    if (!this.isConnected || !this.client) {
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: '0'
      };
    }

    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();
      
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        connected: this.isConnected,
        keyCount,
        memoryUsage
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return {
        connected: this.isConnected,
        keyCount: 0,
        memoryUsage: 'unknown'
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.logger.info('Redis connection closed');
    }
  }
}