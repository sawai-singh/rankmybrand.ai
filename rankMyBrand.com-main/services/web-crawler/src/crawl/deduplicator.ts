import { createHash } from 'crypto';
import { URL } from 'url';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { RedisWrapper } from '../utils/redis-wrapper.js';

export class Deduplicator {
  private fingerprints: Set<string>;
  private urlHashes: Map<string, string>;
  private redis: RedisWrapper;
  private jobId: string;

  constructor(redis: Redis, jobId: string) {
    this.fingerprints = new Set();
    this.urlHashes = new Map();
    this.redis = new RedisWrapper(redis);
    this.jobId = jobId;
  }

  async initialize(): Promise<void> {
    // Load existing fingerprints from Redis if resuming a crawl
    try {
      const existingFingerprints = await this.redis.smembers(`dedup:${this.jobId}:fingerprints`);
      existingFingerprints.forEach(fp => this.fingerprints.add(fp));
      
      const urlHashEntries = await this.redis.hgetall(`dedup:${this.jobId}:urls`);
      Object.entries(urlHashEntries).forEach(([url, hash]) => {
        this.urlHashes.set(url, hash);
      });
      
      logger.info(`Loaded ${this.fingerprints.size} existing fingerprints for job ${this.jobId}`);
    } catch (error) {
      logger.error(`Error loading deduplication data: ${error}`);
    }
  }

  normalizeURL(url: string): string {
    try {
      const u = new URL(url);
      // Remove query parameters that don't affect content
      const ignoredParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid'];
      const params = new URLSearchParams(u.search);
      
      ignoredParams.forEach(param => params.delete(param));
      
      u.search = params.toString();
      u.hash = ''; // Remove fragment
      
      return u.href.toLowerCase();
    } catch (error) {
      logger.error(`Error normalizing URL for deduplication: ${error}`);
      return url.toLowerCase();
    }
  }

  async isDuplicate(url: string, content: string): Promise<boolean> {
    const normalizedURL = this.normalizeURL(url);
    const contentHash = this.hashContent(content);
    
    // Check if exact content exists
    if (this.fingerprints.has(contentHash)) {
      logger.debug(`Duplicate content found for URL: ${url}`);
      return true;
    }
    
    // Check if URL was crawled with different content (page updated)
    if (this.urlHashes.has(normalizedURL)) {
      const oldHash = this.urlHashes.get(normalizedURL)!;
      if (oldHash !== contentHash) {
        // Page updated, remove old fingerprint
        this.fingerprints.delete(oldHash);
        await this.redis.srem(`dedup:${this.jobId}:fingerprints`, oldHash);
        logger.info(`Page updated: ${url}`);
      } else {
        // Same content, same URL
        return true;
      }
    }
    
    // Add new fingerprint
    this.fingerprints.add(contentHash);
    this.urlHashes.set(normalizedURL, contentHash);
    
    // Persist to Redis
    await Promise.all([
      this.redis.sadd(`dedup:${this.jobId}:fingerprints`, contentHash),
      this.redis.hset(`dedup:${this.jobId}:urls`, normalizedURL, contentHash)
    ]);
    
    // Set expiration for cleanup (7 days)
    await Promise.all([
      this.redis.expire(`dedup:${this.jobId}:fingerprints`, 604800),
      this.redis.expire(`dedup:${this.jobId}:urls`, 604800)
    ]);
    
    return false;
  }

  private hashContent(content: string): string {
    // Remove whitespace variations to detect near-duplicates
    const normalizedContent = content
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    return createHash('sha256').update(normalizedContent).digest('hex');
  }

  async getSimilarityHash(content: string): Promise<string> {
    // Create a simhash for near-duplicate detection
    // This is a simplified version - in production, use a proper simhash library
    const tokens = content.toLowerCase().split(/\s+/);
    const shingles = new Set<string>();
    
    // Create 3-word shingles
    for (let i = 0; i < tokens.length - 2; i++) {
      shingles.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
    
    // Hash shingles
    const hashes = Array.from(shingles).map(shingle => 
      createHash('md5').update(shingle).digest('hex')
    );
    
    // Simple similarity hash (not a true simhash, but works for basic dedup)
    return createHash('sha256').update(hashes.sort().join('')).digest('hex').substring(0, 16);
  }

  async isNearDuplicate(content: string, threshold: number = 0.9): Promise<boolean> {
    const simHash = await this.getSimilarityHash(content);
    const exists = await this.redis.sismember(`dedup:${this.jobId}:simhashes`, simHash);
    
    if (!exists) {
      await this.redis.sadd(`dedup:${this.jobId}:simhashes`, simHash);
      await this.redis.expire(`dedup:${this.jobId}:simhashes`, 604800); // 7 days
    }
    
    return exists === 1;
  }

  async getStats(): Promise<{
    uniquePages: number;
    duplicatesFound: number;
    updatedPages: number;
  }> {
    const uniquePages = this.fingerprints.size;
    const totalUrls = this.urlHashes.size;
    
    // Note: This is approximate as we don't track exact counts
    return {
      uniquePages,
      duplicatesFound: parseInt(await this.redis.get(`dedup:${this.jobId}:duplicates`) || '0'),
      updatedPages: parseInt(await this.redis.get(`dedup:${this.jobId}:updates`) || '0')
    };
  }

  async cleanup(): Promise<void> {
    // Clean up Redis keys for this job
    const keys = [
      `dedup:${this.jobId}:fingerprints`,
      `dedup:${this.jobId}:urls`,
      `dedup:${this.jobId}:simhashes`,
      `dedup:${this.jobId}:duplicates`,
      `dedup:${this.jobId}:updates`
    ];
    
    await this.redis.del(...keys);
    this.fingerprints.clear();
    this.urlHashes.clear();
  }
}
