/**
 * Smart Crawler Integration
 * Enhanced integration between SmartCrawler and Search Intelligence
 */

import { EventEmitter } from 'events';
import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { BrandExtractor } from '../extractors/brand-extractor.js';
import { CompetitorDetector } from '../extractors/competitor-detector.js';
import { SearchIntelOptions } from '../types/search-intelligence.types.js';
import { Logger } from '../../utils/logger.js';

export interface CrawlConfig {
  url: string;
  domain: string;
  maxPages?: number;
  includeSearchIntel?: boolean;
  searchIntelOptions?: SearchIntelOptions;
  [key: string]: any;
}

export interface CrawledPage {
  url: string;
  content: string;
  metadata: {
    title?: string;
    description?: string;
    keywords?: string[];
    structuredData?: any;
  };
}

/**
 * Enhanced Smart Crawler with Search Intelligence
 */
export class SmartCrawler extends EventEmitter {
  private logger: Logger;
  private searchIntelService: SearchIntelligenceService;
  private brandExtractor: BrandExtractor;
  private competitorDetector: CompetitorDetector;
  private jobId: string;
  private domain: string;
  private extractedBrands: string[] = [];
  private extractedProducts: string[] = [];

  constructor() {
    super();
    this.logger = new Logger('SmartCrawler');
    this.searchIntelService = new SearchIntelligenceService();
    this.brandExtractor = new BrandExtractor();
    this.competitorDetector = new CompetitorDetector();
    this.jobId = '';
    this.domain = '';
  }

  /**
   * Main crawl method with Search Intelligence integration
   */
  async crawl(config: CrawlConfig): Promise<any> {
    this.jobId = this.generateJobId();
    this.domain = config.domain || this.extractDomain(config.url);

    this.logger.info(`Starting crawl job ${this.jobId} for ${this.domain}`);
    this.emit('crawl:start', { jobId: this.jobId, domain: this.domain });

    try {
      // Perform the actual crawling (simplified for example)
      const crawledPages = await this.performCrawl(config);
      
      // Extract brand and product information during crawl
      await this.extractBrandInfo(crawledPages);

      // Store crawl results
      const crawlResult = {
        jobId: this.jobId,
        domain: this.domain,
        pagesCount: crawledPages.length,
        status: 'completed',
        completedAt: new Date()
      };

      // Run Search Intelligence if enabled
      if (config.includeSearchIntel) {
        await this.runSearchIntelligence(crawledPages, config.searchIntelOptions);
      }

      this.emit('crawl:complete', crawlResult);
      return crawlResult;

    } catch (error) {
      this.logger.error(`Crawl job ${this.jobId} failed:`, error);
      this.emit('crawl:error', { jobId: this.jobId, error });
      throw error;
    }
  }

  /**
   * Perform the actual crawling
   */
  private async performCrawl(config: CrawlConfig): Promise<CrawledPage[]> {
    // This is a simplified version - actual implementation would:
    // 1. Use a real crawler library (Puppeteer, Playwright, etc.)
    // 2. Handle robots.txt
    // 3. Implement proper rate limiting
    // 4. Extract structured data
    
    const pages: CrawledPage[] = [];
    const maxPages = config.maxPages || 50;
    
    // Simulate crawling
    this.logger.info(`Crawling up to ${maxPages} pages from ${config.url}`);
    
    // For now, return mock data
    pages.push({
      url: config.url,
      content: '<html>...</html>',
      metadata: {
        title: 'Example Page',
        description: 'Example description',
        keywords: ['example', 'test']
      }
    });

    return pages;
  }

  /**
   * Extract brand information from crawled pages
   */
  private async extractBrandInfo(pages: CrawledPage[]): Promise<void> {
    const priorityPages = this.getPriorityPages(pages);
    
    for (const page of priorityPages) {
      const brandInfo = await this.brandExtractor.extractBrandInfo(
        page.content,
        page.metadata,
        this.domain
      );

      if (brandInfo.brand) {
        this.extractedBrands.push(brandInfo.brand);
      }
      if (brandInfo.products) {
        this.extractedProducts.push(...brandInfo.products);
      }
    }

    // Deduplicate
    this.extractedBrands = [...new Set(this.extractedBrands)];
    this.extractedProducts = [...new Set(this.extractedProducts)];

    this.logger.info(`Extracted brands: ${this.extractedBrands.join(', ')}`);
    this.logger.info(`Extracted products: ${this.extractedProducts.join(', ')}`);
  }

  /**
   * Run Search Intelligence analysis after crawl
   */
  private async runSearchIntelligence(
    crawledPages: CrawledPage[],
    options?: SearchIntelOptions
  ): Promise<void> {
    this.logger.info(`Running Search Intelligence for crawl job ${this.jobId}`);

    try {
      // Detect competitors from content
      const competitors = await this.detectCompetitors(crawledPages, options?.industry);

      // Prepare search intelligence options
      const searchOptions: SearchIntelOptions = {
        ...options,
        productKeywords: [...(options?.productKeywords || []), ...this.extractedProducts],
        competitors: [...new Set([...(options?.competitors || []), ...competitors])].slice(0, 5)
      };

      // Determine brand name
      const brand = this.extractedBrands[0] || this.domain.replace(/\.(com|org|net|io)$/, '');

      // Start analysis
      const analysis = await this.searchIntelService.analyzeSearchIntelligence(
        brand,
        this.domain,
        searchOptions,
        this.jobId
      );

      this.logger.info(`Started Search Intelligence analysis ${analysis.id}`);

      // Set up progress tracking
      this.trackSearchIntelProgress(analysis.id);

    } catch (error) {
      this.logger.error(`Failed to run Search Intelligence:`, error);
      // Don't throw - search intel failure shouldn't fail the crawl
      this.emit('searchintel:error', { jobId: this.jobId, error });
    }
  }

  /**
   * Detect competitors from crawled content
   */
  private async detectCompetitors(
    pages: CrawledPage[],
    industry?: string
  ): Promise<string[]> {
    const combinedContent = pages
      .slice(0, 10)
      .map(p => p.content)
      .join('\n');

    const detected = await this.competitorDetector.detectCompetitors({
      content: combinedContent,
      domain: this.domain,
      industry
    });

    return detected
      .filter(c => c.confidence > 0.7)
      .map(c => c.domain)
      .slice(0, 5);
  }

  /**
   * Track Search Intelligence progress
   */
  private trackSearchIntelProgress(analysisId: string): void {
    const progressHandler = (event: any) => {
      if (event.analysisId === analysisId) {
        this.emit('searchintel:progress', {
          jobId: this.jobId,
          ...event
        });
      }
    };

    const completeHandler = (event: any) => {
      if (event.analysisId === analysisId) {
        this.emit('searchintel:complete', {
          jobId: this.jobId,
          analysisId,
          results: event.results
        });
        // Clean up listeners
        this.searchIntelService.removeListener('analysis:progress', progressHandler);
        this.searchIntelService.removeListener('analysis:complete', completeHandler);
        this.searchIntelService.removeListener('analysis:error', errorHandler);
      }
    };

    const errorHandler = (event: any) => {
      if (event.analysisId === analysisId) {
        this.emit('searchintel:error', {
          jobId: this.jobId,
          analysisId,
          error: event.error
        });
        // Clean up listeners
        this.searchIntelService.removeListener('analysis:progress', progressHandler);
        this.searchIntelService.removeListener('analysis:complete', completeHandler);
        this.searchIntelService.removeListener('analysis:error', errorHandler);
      }
    };

    this.searchIntelService.on('analysis:progress', progressHandler);
    this.searchIntelService.on('analysis:complete', completeHandler);
    this.searchIntelService.on('analysis:error', errorHandler);
  }

  /**
   * Get priority pages for brand extraction
   */
  private getPriorityPages(pages: CrawledPage[]): CrawledPage[] {
    return pages.filter(page => {
      const url = page.url.toLowerCase();
      return url === `https://${this.domain}/` ||
             url === `http://${this.domain}/` ||
             url.includes('/about') ||
             url.includes('/company') ||
             url.includes('/who-we-are');
    }).slice(0, 5);
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get Search Intelligence results for this crawl
   */
  async getSearchIntelResults(): Promise<any> {
    if (!this.jobId) {
      return null;
    }

    const analyses = await this.searchIntelService.analysisRepo.findByCrawlJobId(this.jobId);
    if (analyses.length === 0) {
      return null;
    }

    return this.searchIntelService.getAnalysisResults(analyses[0].id);
  }
}

/**
 * Factory function to create crawler with Search Intelligence
 */
export function createSmartCrawler(): SmartCrawler {
  return new SmartCrawler();
}