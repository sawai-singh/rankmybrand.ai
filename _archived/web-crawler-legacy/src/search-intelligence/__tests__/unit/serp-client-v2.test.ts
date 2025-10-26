/**
 * Unit Tests for Enhanced SERP Client v2
 * Tests multi-provider support, failover, caching, and cost management
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { SerpClientV2 } from '../../core/serp-client-v2.js';
import { SerpCacheManager } from '../../utils/serp-cache-manager.js';
import { CostManager } from '../../utils/cost-manager.js';
import { RateLimiter } from '../../utils/rate-limiter.js';
import { CircuitBreaker } from '../../utils/circuit-breaker.js';
import type { SerpProvider, SearchOptions, SearchResult } from '../../types/serp-client.types.js';
import { Redis } from 'ioredis';

// Mock dependencies
jest.mock('../../utils/serp-cache-manager.js');
jest.mock('../../utils/cost-manager.js');
jest.mock('../../utils/rate-limiter.js');
jest.mock('../../utils/circuit-breaker.js');
jest.mock('ioredis');
jest.mock('node-fetch');

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('SerpClientV2', () => {
  let client: SerpClientV2;
  let mockCache: jest.Mocked<SerpCacheManager>;
  let mockCostManager: jest.Mocked<CostManager>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;

  const mockApiKeys = {
    serpapi: 'test-serpapi-key',
    valueserp: 'test-valueserp-key',
    scaleserp: 'test-scaleserp-key'
  };

  const mockSearchResult: SearchResult = {
    query: 'test query',
    provider: 'serpapi',
    organicResults: [
      {
        position: 1,
        title: 'Test Result 1',
        url: 'https://example.com/1',
        snippet: 'Test snippet 1'
      },
      {
        position: 2,
        title: 'Test Result 2',
        url: 'https://example.com/2',
        snippet: 'Test snippet 2'
      }
    ],
    serpFeatures: {
      hasFeaturedSnippet: true,
      hasKnowledgePanel: false,
      hasPeopleAlsoAsk: true,
      hasLocalPack: false
    },
    totalResults: 1000000,
    cached: false,
    cost: 0.01,
    timestamp: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockCache = new SerpCacheManager(new Redis()) as jest.Mocked<SerpCacheManager>;
    mockCostManager = new CostManager(new Redis()) as jest.Mocked<CostManager>;
    mockRateLimiter = new RateLimiter() as jest.Mocked<RateLimiter>;
    mockCircuitBreaker = new CircuitBreaker() as jest.Mocked<CircuitBreaker>;

    client = new SerpClientV2(mockApiKeys);
    (client as any).cache = mockCache;
    (client as any).costManager = mockCostManager;
    (client as any).rateLimiter = mockRateLimiter;
    (client as any).circuitBreakers.serpapi = mockCircuitBreaker;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Search Functionality', () => {
    it('should return cached results when available', async () => {
      mockCache.get.mockResolvedValue(mockSearchResult);
      mockCostManager.canAfford.mockResolvedValue(true);

      const result = await client.search('test query');

      expect(mockCache.get).toHaveBeenCalledWith('test query', {});
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(mockSearchResult);
      expect(result.cached).toBe(true);
    });

    it('should fetch from API when cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          organic_results: [
            { position: 1, title: 'Result 1', link: 'https://example.com/1', snippet: 'Snippet 1' }
          ],
          search_information: { total_results: 1000000 },
          answer_box: { snippet: 'Featured snippet' }
        })
      });

      const result = await client.search('test query');

      expect(mockFetch).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockCostManager.recordCost).toHaveBeenCalled();
      expect(result.cached).toBe(false);
    });

    it('should respect search options', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      const options: SearchOptions = {
        location: 'San Francisco',
        num: 50,
        preferredProvider: 'valueserp'
      };

      await client.search('test query', options);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('valueserp'),
        expect.any(Object)
      );
    });
  });

  describe('Provider Failover', () => {
    it('should failover to next provider on error', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call
        .mockRejectedValueOnce(new Error('Provider unavailable'))
        .mockImplementation(async (fn) => fn());

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      const result = await client.search('test query');

      expect(mockCircuitBreaker.call).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should throw when all providers fail', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockRejectedValue(new Error('All providers failed'));

      await expect(client.search('test query')).rejects.toThrow('All SERP providers failed');
    });
  });

  describe('Cost Management', () => {
    it('should check budget before searching', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(false);

      await expect(client.search('test query')).rejects.toThrow('Daily budget exceeded');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should record costs after successful search', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      await client.search('test query');

      expect(mockCostManager.recordCost).toHaveBeenCalledWith(
        'serpapi',
        0.01,
        expect.any(String)
      );
    });

    it('should emit warning at 80% budget', async () => {
      mockCostManager.getDailySpend.mockResolvedValue(8.0);
      mockCostManager.getConfig.mockReturnValue({ dailyLimit: 10, monthlyLimit: 300 });

      const warningHandler = jest.fn();
      client.on('budget:warning', warningHandler);

      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      await client.search('test query');

      expect(warningHandler).toHaveBeenCalledWith({
        level: 'warning',
        percentage: 80,
        dailySpend: 8.0,
        dailyLimit: 10
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(false);

      await expect(client.search('test query')).rejects.toThrow('Rate limit exceeded');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should wait for rate limit when configured', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockRateLimiter.timeUntilNextToken.mockResolvedValue(100);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      const options: SearchOptions = { waitForRateLimit: true };
      
      const startTime = Date.now();
      await client.search('test query', options);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Batch Operations', () => {
    it('should batch multiple queries efficiently', async () => {
      const queries = ['query 1', 'query 2', 'query 3'];
      
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      const results = await client.batchSearch(queries);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should emit progress during batch search', async () => {
      const queries = ['query 1', 'query 2'];
      const progressHandler = jest.fn();
      
      client.on('batch:progress', progressHandler);
      
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      await client.batchSearch(queries);

      expect(progressHandler).toHaveBeenCalledWith({
        completed: 1,
        total: 2,
        percentage: 50
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(client.search('test query')).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await client.search('test query');

      expect(result.organicResults).toEqual([]);
      expect(result.error).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should use different cache keys for different options', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCostManager.canAfford.mockResolvedValue(true);
      mockRateLimiter.checkLimit.mockResolvedValue(true);
      mockCircuitBreaker.call.mockImplementation(async (fn) => fn());
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] })
      });

      await client.search('test query', { location: 'New York' });
      await client.search('test query', { location: 'London' });

      expect(mockCache.get).toHaveBeenCalledWith('test query', { location: 'New York' });
      expect(mockCache.get).toHaveBeenCalledWith('test query', { location: 'London' });
    });

    it('should clear cache when requested', async () => {
      await client.clearCache();
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should track usage statistics', async () => {
      mockCache.get.mockResolvedValue(mockSearchResult);
      mockCostManager.canAfford.mockResolvedValue(true);

      await client.search('test query');
      const stats = await client.getStats();

      expect(stats).toHaveProperty('totalSearches');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('providerUsage');
    });
  });
});