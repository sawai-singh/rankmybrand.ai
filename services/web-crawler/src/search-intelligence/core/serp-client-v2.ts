/**
 * Enhanced SERP Client v2
 * Robust SERP API client with cost management, caching, and rate limiting
 */

import { Redis } from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';
import { CostManager } from '../utils/cost-manager.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { SerpCacheManager } from '../utils/serp-cache-manager.js';
import { CircuitBreaker, CircuitBreakerFactory } from '../utils/circuit-breaker.js';
import {
  SerpClientConfig,
  SerpApiProvider,
  SearchOptions,
  BatchOptions,
  SearchResults,
  BatchResults,
  SerpResult,
  SerpFeatures,
  UsageStats,
  SerpApiError,
  SearchMetadata
} from '../types/serp-client.types.js';

export class EnhancedSerpClient {
  private logger: Logger;
  private config: SerpClientConfig;
  private costManager: CostManager;
  private rateLimiter: RateLimiter;
  private cacheManager: SerpCacheManager;
  private circuitBreakerFactory: CircuitBreakerFactory;
  private httpClients: Map<SerpApiProvider, AxiosInstance>;
  private providerPriority: SerpApiProvider[];

  constructor(
    private redis: Redis,
    config: SerpClientConfig
  ) {
    this.logger = new Logger('EnhancedSerpClient');
    this.config = config;
    
    // Initialize managers
    this.costManager = new CostManager(redis, config.costManagement);
    this.rateLimiter = new RateLimiter(config.rateLimiting);
    this.cacheManager = new SerpCacheManager(redis, config.cache);
    this.circuitBreakerFactory = new CircuitBreakerFactory();
    
    // Initialize HTTP clients for each provider
    this.httpClients = new Map();
    this.providerPriority = [];
    this.initializeProviders();
    
    this.logger.info('Enhanced SERP client initialized');
  }

  /**
   * Initialize provider clients
   */
  private initializeProviders(): void {
    // Sort providers by priority
    const sortedProviders = [...this.config.providers]
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    this.providerPriority = sortedProviders.map(p => p.name);
    
    // Create HTTP clients
    for (const provider of sortedProviders) {
      const client = axios.create({
        baseURL: provider.baseUrl,
        timeout: 30000,
        headers: {
          'User-Agent': 'RankMyBrand-SearchIntelligence/1.0'
        }
      });
      
      this.httpClients.set(provider.name, client);
      
      // Create circuit breaker for each provider
      this.circuitBreakerFactory.getBreaker(provider.name, {
        failureThreshold: 5,
        timeout: 60000,
        errorFilter: (error) => {
          // Don't count rate limits as failures
          return error.statusCode !== 429;
        }
      });
    }
  }

  /**
   * Search with automatic provider selection
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResults> {
    const startTime = Date.now();
    
    // Check cache first
    if (!options.bypassCache) {
      const cached = await this.cacheManager.get(query, options);
      if (cached) {
        this.logger.debug(`Cache hit for query: ${query}`);
        return cached;
      }
    }
    
    // Select provider
    const provider = options.provider || await this.selectProvider();
    if (!provider) {
      throw new Error('No available SERP API providers');
    }
    
    // Get provider config
    const providerConfig = this.config.providers.find(p => p.name === provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }
    
    // Check budget
    const cost = providerConfig.costPerQuery;
    const budgetCheck = await this.costManager.canMakeQuery(cost, provider);
    if (!budgetCheck.allowed) {
      const error = new Error(budgetCheck.reason!) as SerpApiError;
      error.name = 'BudgetExceededError';
      error.provider = provider;
      error.cost = cost;
      error.retryable = false;
      error.fallbackAvailable = true;
      throw error;
    }
    
    // Execute search with rate limiting
    try {
      const results = await this.rateLimiter.execute(
        () => this.executeSearch(provider, query, options),
        this.getPriority(options),
        `search-${query}-${provider}`
      );
      
      // Track cost
      await this.costManager.trackQuery(cost, provider, query);
      
      // Add metadata
      results.cost = cost;
      results.cached = false;
      results.provider = provider;
      results.searchTime = Date.now() - startTime;
      
      // Cache results
      if (this.config.cache.enabled) {
        await this.cacheManager.set(query, results, options);
      }
      
      return results;
    } catch (error) {
      // Try fallback providers
      if (this.shouldFallback(error)) {
        return this.searchWithFallback(query, options, provider);
      }
      throw error;
    }
  }

  /**
   * Batch search with progress tracking
   */
  async batchSearch(
    queries: string[],
    options: BatchOptions = {}
  ): Promise<BatchResults> {
    const startTime = Date.now();
    const results = new Map<string, SearchResults>();
    const errors: Array<{ query: string; error: string }> = [];
    
    let completed = 0;
    let failed = 0;
    let cached = 0;
    let totalCost = 0;
    
    // Process in batches
    const concurrency = options.concurrency || this.config.rateLimiting.concurrentRequests;
    const batches = this.chunkArray(queries, concurrency);
    
    for (const batch of batches) {
      const promises = batch.map(async (query) => {
        try {
          const result = await this.search(query, options);
          results.set(query, result);
          
          if (result.cached) {
            cached++;
          }
          totalCost += result.cost;
          completed++;
          
          // Progress callback
          if (options.progressCallback) {
            options.progressCallback({
              total: queries.length,
              completed,
              failed,
              cached,
              estimatedCost: totalCost,
              elapsedTime: Date.now() - startTime
            });
          }
        } catch (error) {
          failed++;
          errors.push({
            query,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Stop on budget exceeded if configured
          if (options.stopOnBudgetExceeded && error instanceof Error && error.name === 'BudgetExceededError') {
            throw error;
          }
        }
      });
      
      await Promise.all(promises);
    }
    
    return {
      queries,
      results,
      summary: {
        totalQueries: queries.length,
        successful: completed,
        failed,
        cached,
        totalCost,
        totalTime: Date.now() - startTime,
        errors
      }
    };
  }

  /**
   * Execute search for a specific provider
   */
  private async executeSearch(
    provider: SerpApiProvider,
    query: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    const breaker = this.circuitBreakerFactory.getBreaker(provider);
    
    return breaker.execute(async () => {
      switch (provider) {
        case SerpApiProvider.SERPAPI:
          return this.searchWithSerpApi(query, options);
        case SerpApiProvider.VALUESERP:
          return this.searchWithValueSerp(query, options);
        case SerpApiProvider.SCALESERP:
          return this.searchWithScaleSerp(query, options);
        case SerpApiProvider.MOCK:
          return this.searchWithMock(query, options);
        default:
          throw new Error(`Provider ${provider} not implemented`);
      }
    });
  }

  /**
   * Search with SerpAPI
   */
  private async searchWithSerpApi(
    query: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    const client = this.httpClients.get(SerpApiProvider.SERPAPI)!;
    const providerConfig = this.config.providers.find(p => p.name === SerpApiProvider.SERPAPI)!;
    
    const params = {
      api_key: providerConfig.apiKey,
      q: query,
      engine: 'google',
      num: options.num || 20,
      start: options.start || 0,
      gl: this.getCountryCode(options.location),
      hl: options.language || 'en',
      device: options.device || 'desktop',
      safe: options.safeSearch ? 'active' : 'off'
    };
    
    const response = await client.get('/search', { params });
    
    // Parse response
    const results: SerpResult[] = [];
    const features: SerpFeatures = {
      hasFeaturedSnippet: false,
      hasKnowledgePanel: false,
      hasPeopleAlsoAsk: false,
      hasLocalPack: false,
      hasShoppingResults: false,
      hasVideoCarousel: false,
      hasNewsResults: false,
      hasImagePack: false,
      hasTwitterResults: false,
      totalOrganicResults: 0
    };
    
    // Parse organic results
    if (response.data.organic_results) {
      features.totalOrganicResults = response.data.organic_results.length;
      
      response.data.organic_results.forEach((result: any, index: number) => {
        results.push({
          position: result.position || index + 1,
          url: result.link,
          domain: new URL(result.link).hostname,
          title: result.title,
          snippet: result.snippet || '',
          isAd: false,
          additionalInfo: {
            date: result.date,
            sitelinks: result.sitelinks?.map((s: any) => ({
              title: s.title,
              url: s.link
            }))
          }
        });
      });
    }
    
    // Parse SERP features
    if (response.data.answer_box) features.hasFeaturedSnippet = true;
    if (response.data.knowledge_graph) features.hasKnowledgePanel = true;
    if (response.data.related_questions) features.hasPeopleAlsoAsk = true;
    if (response.data.local_results) features.hasLocalPack = true;
    if (response.data.shopping_results) features.hasShoppingResults = true;
    if (response.data.video_results) features.hasVideoCarousel = true;
    if (response.data.top_stories) features.hasNewsResults = true;
    if (response.data.images_results) features.hasImagePack = true;
    if (response.data.twitter_results) features.hasTwitterResults = true;
    
    // Parse ads
    if (response.data.ads) {
      response.data.ads.forEach((ad: any, index: number) => {
        results.unshift({
          position: index + 1,
          url: ad.link,
          domain: new URL(ad.link).hostname,
          title: ad.title,
          snippet: ad.description || '',
          isAd: true
        });
      });
    }
    
    const metadata: SearchMetadata = {
      timestamp: new Date(),
      responseTime: response.data.search_metadata?.processed_at || Date.now(),
      apiCreditsUsed: 1,
      cacheKey: this.cacheManager.generateCacheKey(query, options)
    };
    
    return {
      query,
      results,
      features,
      totalResults: response.data.search_information?.total_results || results.length,
      searchTime: response.data.search_metadata?.total_time_taken || 0,
      cached: false,
      provider: SerpApiProvider.SERPAPI,
      cost: providerConfig.costPerQuery,
      metadata
    };
  }

  /**
   * Search with ValueSerp (implementation placeholder)
   */
  private async searchWithValueSerp(
    query: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    // Similar implementation to SerpAPI but with ValueSerp API format
    throw new Error('ValueSerp provider not yet implemented');
  }

  /**
   * Search with ScaleSERP (implementation placeholder)
   */
  private async searchWithScaleSerp(
    query: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    // Similar implementation to SerpAPI but with ScaleSERP API format
    throw new Error('ScaleSERP provider not yet implemented');
  }

  /**
   * Mock search for testing
   */
  private async searchWithMock(
    query: string,
    options: SearchOptions
  ): Promise<SearchResults> {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
    
    const results: SerpResult[] = [
      {
        position: 1,
        url: 'https://example.com',
        domain: 'example.com',
        title: `${query} - Example Result`,
        snippet: `This is a mock result for ${query}`,
        isAd: false
      },
      {
        position: 2,
        url: 'https://test.com',
        domain: 'test.com',
        title: `Test result for ${query}`,
        snippet: 'Another mock result',
        isAd: false
      }
    ];
    
    const features: SerpFeatures = {
      hasFeaturedSnippet: Math.random() > 0.7,
      hasKnowledgePanel: Math.random() > 0.8,
      hasPeopleAlsoAsk: Math.random() > 0.5,
      hasLocalPack: false,
      hasShoppingResults: false,
      hasVideoCarousel: false,
      hasNewsResults: false,
      hasImagePack: false,
      hasTwitterResults: false,
      totalOrganicResults: results.length
    };
    
    return {
      query,
      results,
      features,
      totalResults: 100,
      searchTime: 100,
      cached: false,
      provider: SerpApiProvider.MOCK,
      cost: 0,
      metadata: {
        timestamp: new Date(),
        responseTime: 100,
        apiCreditsUsed: 0,
        cacheKey: this.cacheManager.generateCacheKey(query, options)
      }
    };
  }

  /**
   * Select best available provider
   */
  private async selectProvider(): Promise<SerpApiProvider | null> {
    for (const provider of this.providerPriority) {
      const breaker = this.circuitBreakerFactory.getBreaker(provider);
      if (breaker.isHealthy()) {
        return provider;
      }
    }
    
    // All providers are down, try half-open ones
    for (const provider of this.providerPriority) {
      const breaker = this.circuitBreakerFactory.getBreaker(provider);
      const state = breaker.getState();
      if (state.state === 'half-open') {
        return provider;
      }
    }
    
    return null;
  }

  /**
   * Search with fallback providers
   */
  private async searchWithFallback(
    query: string,
    options: SearchOptions,
    failedProvider: SerpApiProvider
  ): Promise<SearchResults> {
    const remainingProviders = this.providerPriority.filter(p => p !== failedProvider);
    
    for (const provider of remainingProviders) {
      try {
        this.logger.info(`Falling back to ${provider} after ${failedProvider} failed`);
        return await this.search(query, { ...options, provider });
      } catch (error) {
        this.logger.error(`Fallback provider ${provider} also failed:`, error);
        continue;
      }
    }
    
    // All providers failed, check cache
    if (this.config.errorHandling.fallbackToCacheOnError) {
      const cached = await this.cacheManager.get(query, options);
      if (cached) {
        this.logger.info('All providers failed, returning stale cache');
        return cached;
      }
    }
    
    throw new Error('All SERP providers failed');
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    const [costStats, cacheStats] = await Promise.all([
      this.costManager.getStats(),
      this.cacheManager.getStats()
    ]);
    
    const providerStats = [];
    for (const provider of this.config.providers) {
      const breaker = this.circuitBreakerFactory.getBreaker(provider.name);
      const breakerStats = breaker.getStats();
      
      providerStats.push({
        provider: provider.name,
        queriesCount: breakerStats.requests,
        totalCost: 0, // Would need to track per provider
        averageResponseTime: 0, // Would need to track
        errorRate: breakerStats.failures / Math.max(1, breakerStats.requests),
        availability: breakerStats.state === 'closed' ? 1 : 0
      });
    }
    
    return {
      cost: costStats,
      cache: cacheStats,
      providers: providerStats,
      rateLimit: this.rateLimiter.getStats()
    };
  }

  /**
   * Warm up cache
   */
  async warmupCache(): Promise<void> {
    await this.cacheManager.warmup(
      (query) => this.search(query, { provider: SerpApiProvider.MOCK })
    );
  }

  /**
   * Helper functions
   */
  private shouldFallback(error: any): boolean {
    return error.retryable !== false && 
           error.name !== 'BudgetExceededError' &&
           this.config.errorHandling.fallbackToCacheOnError;
  }

  private getPriority(options: SearchOptions): number {
    // Higher priority for smaller result sets
    if (options.num && options.num <= 10) return 3;
    if (options.device === 'mobile') return 4;
    return 5;
  }

  private getCountryCode(location?: string): string {
    // Map location to country code
    const locationMap: Record<string, string> = {
      'united states': 'us',
      'united kingdom': 'uk',
      'canada': 'ca',
      'australia': 'au',
      'germany': 'de',
      'france': 'fr',
      'japan': 'jp',
      'india': 'in'
    };
    
    if (!location) return 'us';
    return locationMap[location.toLowerCase()] || 'us';
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.rateLimiter.destroy();
    await this.cacheManager.prune();
    this.circuitBreakerFactory.clear();
    this.logger.info('SERP client destroyed');
  }
}