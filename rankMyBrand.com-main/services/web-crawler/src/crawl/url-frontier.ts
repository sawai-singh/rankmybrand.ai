import { URL } from 'url';
import PQueue from 'p-queue';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import robotsParser from 'robots-parser';
import { URLFrontierItem, RobotsData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { RedisWrapper } from '../utils/redis-wrapper.js';

interface QueuedURL {
  url: string;
  priority: number;
  depth: number;
  timestamp: number;
}

export class URLFrontier {
  private domainQueues: Map<string, PQueue>;
  private robotsCache: LRUCache<string, RobotsData>;
  private crawlDelay: Map<string, number>;
  private lastCrawlTime: Map<string, number>;
  private redis: RedisWrapper;
  private seenUrls: Set<string>;
  private maxDepth: number;

  constructor(redis: Redis, maxDepth: number = 3) {
    this.domainQueues = new Map();
    this.robotsCache = new LRUCache<string, RobotsData>({
      max: 10000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    });
    this.crawlDelay = new Map();
    this.lastCrawlTime = new Map();
    this.redis = new RedisWrapper(redis);
    this.seenUrls = new Set();
    this.maxDepth = maxDepth;
  }

  async addURL(url: string, priority: number = 0.5, depth: number = 0): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeURL(url);
      const urlHash = this.hashURL(normalizedUrl);

      // Check if we've already seen this URL
      if (this.seenUrls.has(urlHash)) {
        return false;
      }

      // Check depth limit
      if (depth > this.maxDepth) {
        logger.debug(`URL ${url} exceeds max depth of ${this.maxDepth}`);
        return false;
      }

      const domain = new URL(normalizedUrl).hostname;

      // Check robots.txt
      const robots = await this.getRobots(domain);
      if (!robots.isAllowed(normalizedUrl, 'RankMyBrand-Bot')) {
        logger.info(`URL ${normalizedUrl} blocked by robots.txt`);
        return false;
      }

      // Initialize domain queue if needed
      if (!this.domainQueues.has(domain)) {
        this.domainQueues.set(domain, new PQueue({ 
          concurrency: 1,
          interval: this.getCrawlDelay(domain),
          intervalCap: 1
        }));
      }

      // Add to Redis sorted set for persistence
      await this.redis.zadd(
        `frontier:${domain}`,
        priority,
        JSON.stringify({ url: normalizedUrl, depth, timestamp: Date.now() })
      );

      this.seenUrls.add(urlHash);
      logger.debug(`Added URL to frontier: ${normalizedUrl} (priority: ${priority}, depth: ${depth})`);
      return true;
    } catch (error) {
      logger.error(`Error adding URL to frontier: ${error}`);
      return false;
    }
  }

  async getNextURL(): Promise<URLFrontierItem | null> {
    // Round-robin across domains with rate limiting
    const domains = Array.from(this.domainQueues.keys());
    
    for (const domain of domains) {
      const lastCrawl = this.lastCrawlTime.get(domain) || 0;
      const delay = this.getCrawlDelay(domain);
      
      if (Date.now() - lastCrawl >= delay) {
        // Get highest priority URL from Redis
        // Use zrangebyscore to get the highest priority item
        const items = await this.redis.zrangebyscore(`frontier:${domain}`, '-inf', '+inf', 'WITHSCORES', 'LIMIT', 0, 1);
        
        if (items.length >= 2) {
          const data = JSON.parse(items[0]);
          const priority = parseFloat(items[1]);
          
          // Remove from Redis
          await this.redis.zrem(`frontier:${domain}`, items[0]);
          
          // Update last crawl time
          this.lastCrawlTime.set(domain, Date.now());
          
          return {
            url: data.url,
            priority,
            depth: data.depth,
            timestamp: data.timestamp
          };
        }
      }
    }
    
    return null;
  }

  async getRobots(domain: string): Promise<RobotsData> {
    const cached = this.robotsCache.get(domain);
    if (cached) {
      return cached;
    }

    try {
      // Check Redis cache first
      const redisKey = `robots:${domain}`;
      const cachedRobots = await this.redis.get(redisKey);
      
      if (cachedRobots) {
        const robots = robotsParser(`https://${domain}/robots.txt`, cachedRobots);
        const robotsData: RobotsData = {
          isAllowed: (url: string, userAgent?: string) => robots.isAllowed(url, userAgent || 'RankMyBrand-Bot'),
          crawlDelay: robots.getCrawlDelay('RankMyBrand-Bot') || 0,
          sitemaps: robots.getSitemaps()
        };
        this.robotsCache.set(domain, robotsData);
        return robotsData;
      }

      // Fetch robots.txt
      const robotsUrl = `https://${domain}/robots.txt`;
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': 'RankMyBrand-Bot/1.0' },
        signal: AbortSignal.timeout(5000)
      });

      let robotsTxt = '';
      if (response.ok) {
        robotsTxt = await response.text();
        // Cache in Redis
        await this.redis.set(redisKey, robotsTxt, 'EX', 86400); // 24 hours
      }

      const robots = robotsParser(robotsUrl, robotsTxt);
      const robotsData: RobotsData = {
        isAllowed: (url: string, userAgent?: string) => robots.isAllowed(url, userAgent || 'RankMyBrand-Bot'),
        crawlDelay: robots.getCrawlDelay('RankMyBrand-Bot') || 0,
        sitemaps: robots.getSitemaps()
      };

      this.robotsCache.set(domain, robotsData);
      
      // Set crawl delay
      if (robotsData.crawlDelay > 0) {
        this.crawlDelay.set(domain, robotsData.crawlDelay * 1000); // Convert to ms
      }

      return robotsData;
    } catch (error) {
      logger.error(`Error fetching robots.txt for ${domain}: ${error}`);
      // Return permissive robots on error
      return {
        isAllowed: () => true,
        crawlDelay: 0,
        sitemaps: []
      };
    }
  }

  normalizeURL(url: string): string {
    try {
      const u = new URL(url);
      // Remove fragment
      u.hash = '';
      // Sort query parameters for consistency
      const params = new URLSearchParams(u.search);
      const sortedParams = new URLSearchParams();
      Array.from(params.keys()).sort().forEach(key => {
        sortedParams.set(key, params.get(key)!);
      });
      u.search = sortedParams.toString();
      // Lowercase hostname
      u.hostname = u.hostname.toLowerCase();
      // Remove trailing slash
      u.pathname = u.pathname.replace(/\/$/, '');
      return u.href;
    } catch (error) {
      logger.error(`Error normalizing URL ${url}: ${error}`);
      return url;
    }
  }

  private hashURL(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  private getCrawlDelay(domain: string): number {
    // Check if we have a specific delay for this domain
    const specificDelay = this.crawlDelay.get(domain);
    if (specificDelay) {
      return specificDelay;
    }
    
    // Default to 200ms (5 requests per second)
    return 200;
  }

  async getQueueSize(domain?: string): Promise<number> {
    if (domain) {
      const size = await this.redis.zcard(`frontier:${domain}`);
      return size;
    }

    // Get total size across all domains
    let total = 0;
    const domains = Array.from(this.domainQueues.keys());
    for (const d of domains) {
      total += await this.redis.zcard(`frontier:${d}`);
    }
    return total;
  }

  async clear(): Promise<void> {
    const domains = Array.from(this.domainQueues.keys());
    for (const domain of domains) {
      await this.redis.del(`frontier:${domain}`);
    }
    this.domainQueues.clear();
    this.seenUrls.clear();
    this.lastCrawlTime.clear();
  }

  async parseSitemap(xml: string): Promise<string[]> {
    const urls: string[] = [];
    const urlPattern = /<loc>(.*?)<\/loc>/g;
    let match;
    
    while ((match = urlPattern.exec(xml)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  }
}
