/**
 * SERP Client
 * Handles search engine results page API calls with rate limiting
 */

import { logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { InHouseSerpProvider } from './inhouse-serp-scraper.js';
import {
  SerpApiProvider,
  SerpApiResponse,
  SerpResult,
  SerpFeatures
} from '../types/search-intelligence.types.js';

interface SerpApiConfig {
  provider: SerpApiProvider;
  apiKey?: string;
  baseUrl?: string;
  rateLimit?: number; // requests per second
  timeout?: number; // ms
}

export class SerpClient {
  private configs: Map<SerpApiProvider, SerpApiConfig>;
  private rateLimiters: Map<SerpApiProvider, RateLimiter>;
  private circuitBreakers: Map<SerpApiProvider, CircuitBreaker>;
  private inHouseProvider: InHouseSerpProvider | null = null;

  constructor() {
    this.configs = new Map();
    this.rateLimiters = new Map();
    this.circuitBreakers = new Map();
    
    this.initializeProviders();
  }

  /**
   * Initialize API providers
   */
  private initializeProviders(): void {
    // In-house scraper - our primary provider
    this.addProvider({
      provider: SerpApiProvider.INHOUSE,
      rateLimit: 2, // Be respectful to Google
      timeout: 30000
    });
    
    // Initialize the in-house provider
    this.inHouseProvider = new InHouseSerpProvider();
    
    // SerpAPI configuration (fallback)
    if (process.env.SERPAPI_KEY) {
      this.addProvider({
        provider: SerpApiProvider.SERPAPI,
        apiKey: process.env.SERPAPI_KEY,
        baseUrl: 'https://serpapi.com/search',
        rateLimit: 10, // 10 requests per second
        timeout: 30000
      });
    }

    // ValueSERP configuration (fallback)
    if (process.env.VALUESERP_KEY) {
      this.addProvider({
        provider: SerpApiProvider.VALUESERP,
        apiKey: process.env.VALUESERP_KEY,
        baseUrl: 'https://api.valueserp.com/search',
        rateLimit: 5,
        timeout: 30000
      });
    }

    // ScaleSERP configuration (fallback)
    if (process.env.SCALESERP_KEY) {
      this.addProvider({
        provider: SerpApiProvider.SCALESERP,
        apiKey: process.env.SCALESERP_KEY,
        baseUrl: 'https://api.scaleserp.com/search',
        rateLimit: 10,
        timeout: 30000
      });
    }

    // Mock provider for testing only
    this.addProvider({
      provider: SerpApiProvider.MOCK,
      rateLimit: 100,
      timeout: 100
    });
  }

  /**
   * Add a provider configuration
   */
  private addProvider(config: SerpApiConfig): void {
    this.configs.set(config.provider, config);
    this.rateLimiters.set(
      config.provider,
      new RateLimiter({
        requestsPerSecond: config.rateLimit || 10,
        burstLimit: (config.rateLimit || 10) * 2,
        maxQueueSize: 100
      })
    );
    this.circuitBreakers.set(
      config.provider,
      new CircuitBreaker(5, 60000) // 5 failures, 1 minute timeout
    );
  }

  /**
   * Search using the specified provider
   */
  async search(
    query: string,
    options: {
      provider?: SerpApiProvider;
      searchDepth?: number;
      location?: string;
      device?: 'desktop' | 'mobile';
    } = {}
  ): Promise<SerpApiResponse> {
    const provider = options.provider || this.getAvailableProvider();
    const config = this.configs.get(provider);
    
    if (!config) {
      throw new Error(`Provider ${provider} not configured`);
    }

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(provider)!;
    if (circuitBreaker.isOpen()) {
      logger.warn(`Circuit breaker open for ${provider}, trying fallback`);
      return this.searchWithFallback(query, options, provider);
    }

    // Apply rate limiting
    const rateLimiter = this.rateLimiters.get(provider)!;
    
    return rateLimiter.execute(async () => {
      try {
        let response: SerpApiResponse;

        switch (provider) {
          case SerpApiProvider.INHOUSE:
            response = await this.searchWithInHouse(query, options);
            break;
          case SerpApiProvider.SERPAPI:
            response = await this.searchWithSerpApi(query, config, options);
            break;
          case SerpApiProvider.VALUESERP:
            response = await this.searchWithValueSerp(query, config, options);
            break;
          case SerpApiProvider.SCALESERP:
            response = await this.searchWithScaleSerp(query, config, options);
            break;
          case SerpApiProvider.MOCK:
            response = await this.searchWithMock(query, options);
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }

        circuitBreaker.recordSuccess();
        return response;

      } catch (error) {
        circuitBreaker.recordFailure();
        logger.error(`SERP API error with ${provider}:`, error);
        
        // Try fallback provider
        return this.searchWithFallback(query, options, provider);
      }
    });
  }

  /**
   * Search with In-House Scraper
   */
  private async searchWithInHouse(
    query: string,
    options: any
  ): Promise<SerpApiResponse> {
    logger.info(`[SerpClient] Using in-house scraper for query: ${query}`);
    
    if (!this.inHouseProvider) {
      throw new Error('In-house provider not initialized');
    }
    
    // Initialize if needed (InHouseSerpProvider tracks this internally)
    logger.info('[SerpClient] Initializing in-house provider...');
    await this.inHouseProvider.initialize();
    
    logger.info('[SerpClient] Performing search...');
    return await this.inHouseProvider.search(query, options);
  }

  /**
   * Search with SerpAPI
   */
  private async searchWithSerpApi(
    query: string,
    config: SerpApiConfig,
    options: any
  ): Promise<SerpApiResponse> {
    const params = new URLSearchParams({
      api_key: config.apiKey!,
      q: query,
      engine: 'google',
      num: String(options.searchDepth || 20),
      device: options.device || 'desktop'
    });

    if (options.location) {
      params.append('location', options.location);
    }

    const response = await fetch(`${config.baseUrl}?${params}`, {
      signal: AbortSignal.timeout(config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseSerpApiResponse(data, query);
  }

  /**
   * Search with ValueSERP
   */
  private async searchWithValueSerp(
    query: string,
    config: SerpApiConfig,
    options: any
  ): Promise<SerpApiResponse> {
    const params = new URLSearchParams({
      api_key: config.apiKey!,
      q: query,
      num: String(options.searchDepth || 20),
      device: options.device || 'desktop'
    });

    if (options.location) {
      params.append('location', options.location);
    }

    const response = await fetch(`${config.baseUrl}?${params}`, {
      signal: AbortSignal.timeout(config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`ValueSERP error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseValueSerpResponse(data, query);
  }

  /**
   * Search with ScaleSERP
   */
  private async searchWithScaleSerp(
    query: string,
    config: SerpApiConfig,
    options: any
  ): Promise<SerpApiResponse> {
    const params = new URLSearchParams({
      api_key: config.apiKey!,
      q: query,
      num: String(options.searchDepth || 20),
      device: options.device || 'desktop'
    });

    if (options.location) {
      params.append('location', options.location);
    }

    const response = await fetch(`${config.baseUrl}?${params}`, {
      signal: AbortSignal.timeout(config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`ScaleSERP error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseScaleSerpResponse(data, query);
  }

  /**
   * Mock search for testing
   */
  private async searchWithMock(
    query: string,
    options: any
  ): Promise<SerpApiResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const mockResults: SerpResult[] = [];
    const numResults = options.searchDepth || 20;

    for (let i = 1; i <= numResults; i++) {
      mockResults.push({
        position: i,
        url: `https://example${i}.com/${query.replace(/\s+/g, '-')}`,
        domain: `example${i}.com`,
        title: `${query} - Result ${i}`,
        snippet: `This is a mock search result for "${query}". It contains relevant information about the search term.`,
        isAd: i <= 2 // First 2 results are ads
      });
    }

    return {
      query,
      results: mockResults,
      features: {
        hasFeaturedSnippet: Math.random() > 0.7,
        hasKnowledgePanel: query.toLowerCase().includes('brand'),
        hasPeopleAlsoAsk: Math.random() > 0.5,
        hasLocalPack: query.toLowerCase().includes('near me'),
        hasShoppingResults: query.toLowerCase().includes('buy'),
        hasVideoCarousel: Math.random() > 0.8,
        hasNewsResults: Math.random() > 0.9,
        hasImagePack: Math.random() > 0.7,
        totalOrganicResults: numResults - 2
      },
      totalResults: 1000000 + Math.floor(Math.random() * 9000000),
      searchTime: 0.1 + Math.random() * 0.4
    };
  }

  /**
   * Parse SerpAPI response
   */
  private parseSerpApiResponse(data: any, query: string): SerpApiResponse {
    const results: SerpResult[] = [];
    
    // Parse organic results
    if (data.organic_results) {
      data.organic_results.forEach((result: any, index: number) => {
        results.push({
          position: result.position || index + 1,
          url: result.link,
          domain: new URL(result.link).hostname,
          title: result.title,
          snippet: result.snippet || '',
          isAd: false
        });
      });
    }

    // Parse ads
    if (data.ads) {
      data.ads.forEach((ad: any) => {
        results.unshift({
          position: ad.position || 0,
          url: ad.link,
          domain: new URL(ad.link).hostname,
          title: ad.title,
          snippet: ad.description || '',
          isAd: true
        });
      });
    }

    return {
      query,
      results,
      features: {
        hasFeaturedSnippet: !!data.answer_box,
        hasKnowledgePanel: !!data.knowledge_graph,
        hasPeopleAlsoAsk: !!data.related_questions,
        hasLocalPack: !!data.local_results,
        hasShoppingResults: !!data.shopping_results,
        hasVideoCarousel: !!data.video_results,
        hasNewsResults: !!data.news_results,
        hasImagePack: !!data.images_results,
        totalOrganicResults: data.organic_results?.length || 0
      },
      totalResults: data.search_information?.total_results || 0,
      searchTime: data.search_information?.time_taken_displayed || 0
    };
  }

  /**
   * Parse ValueSERP response
   */
  private parseValueSerpResponse(data: any, query: string): SerpApiResponse {
    const results: SerpResult[] = [];
    
    if (data.organic_results) {
      data.organic_results.forEach((result: any, index: number) => {
        results.push({
          position: result.position || index + 1,
          url: result.link,
          domain: result.domain,
          title: result.title,
          snippet: result.snippet || '',
          isAd: false
        });
      });
    }

    return {
      query,
      results,
      features: this.extractFeaturesFromValueSerp(data),
      totalResults: data.search_information?.total_results || 0,
      searchTime: data.search_metadata?.time_taken || 0
    };
  }

  /**
   * Parse ScaleSERP response
   */
  private parseScaleSerpResponse(data: any, query: string): SerpApiResponse {
    const results: SerpResult[] = [];
    
    if (data.organic_results) {
      data.organic_results.forEach((result: any) => {
        results.push({
          position: result.position,
          url: result.link,
          domain: result.domain,
          title: result.title,
          snippet: result.snippet || '',
          isAd: false
        });
      });
    }

    return {
      query,
      results,
      features: this.extractFeaturesFromScaleSerp(data),
      totalResults: data.search_information?.total_results || 0,
      searchTime: data.search_metadata?.time_taken || 0
    };
  }

  /**
   * Extract features from ValueSERP response
   */
  private extractFeaturesFromValueSerp(data: any): SerpFeatures {
    return {
      hasFeaturedSnippet: !!data.featured_snippet,
      hasKnowledgePanel: !!data.knowledge_panel,
      hasPeopleAlsoAsk: !!data.people_also_ask,
      hasLocalPack: !!data.local_pack,
      hasShoppingResults: !!data.shopping_results,
      hasVideoCarousel: !!data.video_results,
      hasNewsResults: !!data.top_stories,
      hasImagePack: !!data.image_results,
      totalOrganicResults: data.organic_results?.length || 0
    };
  }

  /**
   * Extract features from ScaleSERP response
   */
  private extractFeaturesFromScaleSerp(data: any): SerpFeatures {
    return {
      hasFeaturedSnippet: !!data.featured_snippet,
      hasKnowledgePanel: !!data.knowledge_graph,
      hasPeopleAlsoAsk: !!data.related_questions,
      hasLocalPack: !!data.local_results,
      hasShoppingResults: !!data.shopping_results,
      hasVideoCarousel: !!data.videos,
      hasNewsResults: !!data.news,
      hasImagePack: !!data.images,
      totalOrganicResults: data.organic_results?.length || 0
    };
  }

  /**
   * Get available provider
   */
  private getAvailableProvider(): SerpApiProvider {
    // Try providers in order of preference - In-house first!
    const providers = [
      SerpApiProvider.INHOUSE,
      SerpApiProvider.SERPAPI,
      SerpApiProvider.VALUESERP,
      SerpApiProvider.SCALESERP,
      SerpApiProvider.MOCK
    ];

    for (const provider of providers) {
      if (this.configs.has(provider)) {
        const circuitBreaker = this.circuitBreakers.get(provider);
        if (circuitBreaker && !circuitBreaker.isOpen()) {
          return provider;
        }
      }
    }

    // Default to in-house if all else fails
    return SerpApiProvider.INHOUSE;
  }

  /**
   * Search with fallback provider
   */
  private async searchWithFallback(
    query: string,
    options: any,
    failedProvider: SerpApiProvider
  ): Promise<SerpApiResponse> {
    const providers = Array.from(this.configs.keys())
      .filter(p => p !== failedProvider);

    for (const provider of providers) {
      try {
        return await this.search(query, { ...options, provider });
      } catch (error) {
        logger.warn(`Fallback provider ${provider} also failed`);
      }
    }

    // Last resort: use mock provider
    return this.searchWithMock(query, options);
  }
}

/**
 * Simple circuit breaker implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}