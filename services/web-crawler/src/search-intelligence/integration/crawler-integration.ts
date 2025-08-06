/**
 * Web Crawler Integration
 * Integrates Search Intelligence with the existing web crawler
 */

import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { BrandExtractor } from '../extractors/brand-extractor.js';
import { CompetitorDetector } from '../extractors/competitor-detector.js';
import { SearchIntelOptions } from '../types/search-intelligence.types.js';
import { Logger } from '../../utils/logger.js';

export class CrawlerSearchIntelIntegration {
  private logger: Logger;
  private searchService: SearchIntelligenceService;
  private brandExtractor: BrandExtractor;
  private competitorDetector: CompetitorDetector;

  constructor() {
    this.logger = new Logger('CrawlerSearchIntelIntegration');
    this.searchService = new SearchIntelligenceService();
    this.brandExtractor = new BrandExtractor();
    this.competitorDetector = new CompetitorDetector();
  }

  /**
   * Process crawl job with search intelligence
   */
  async processCrawlJob(
    crawlJobId: string,
    domain: string,
    pages: Array<{ url: string; content: string; metadata: any }>,
    options?: SearchIntelOptions
  ): Promise<void> {
    this.logger.info(`Processing search intelligence for crawl job ${crawlJobId}`);

    try {
      // Extract brand information from homepage or about page
      const brandInfo = await this.extractBrandInfo(pages, domain);
      
      // Detect competitors from content
      const competitors = await this.detectCompetitors(pages, domain, brandInfo.industry);

      // Merge with provided options
      const searchOptions: SearchIntelOptions = {
        ...options,
        industry: brandInfo.industry || options?.industry,
        productKeywords: [...(brandInfo.products || []), ...(options?.productKeywords || [])],
        competitors: [...new Set([...competitors, ...(options?.competitors || [])])].slice(0, 5)
      };

      // Start search intelligence analysis
      const analysis = await this.searchService.analyzeSearchIntelligence(
        brandInfo.brand,
        domain,
        searchOptions,
        crawlJobId
      );

      this.logger.info(`Started search intelligence analysis ${analysis.id} for ${domain}`);

      // Set up event listeners for progress tracking
      this.setupEventListeners(analysis.id, crawlJobId);

    } catch (error) {
      this.logger.error(`Failed to process search intelligence for crawl ${crawlJobId}:`, error);
      throw error;
    }
  }

  /**
   * Extract brand information from crawled pages
   */
  private async extractBrandInfo(
    pages: Array<{ url: string; content: string; metadata: any }>,
    domain: string
  ): Promise<any> {
    // Prioritize homepage and about page
    const priorityPages = pages
      .filter(p => {
        const url = p.url.toLowerCase();
        return url === `https://${domain}/` || 
               url === `http://${domain}/` ||
               url.includes('/about') ||
               url.includes('/company');
      })
      .slice(0, 3);

    if (priorityPages.length === 0) {
      priorityPages.push(pages[0]); // Fallback to first page
    }

    // Extract from each priority page
    const extractedInfo = await Promise.all(
      priorityPages.map(page => 
        this.brandExtractor.extractBrandInfo(page.content, page.metadata, domain)
      )
    );

    // Merge extracted information
    return this.mergeBrandInfo(extractedInfo);
  }

  /**
   * Detect competitors from crawled content
   */
  private async detectCompetitors(
    pages: Array<{ url: string; content: string; metadata: any }>,
    domain: string,
    industry?: string
  ): Promise<string[]> {
    // Combine content from multiple pages
    const combinedContent = pages
      .slice(0, 10) // Limit to first 10 pages
      .map(p => p.content)
      .join('\n');

    const detectedCompetitors = await this.competitorDetector.detectCompetitors({
      content: combinedContent,
      domain,
      industry
    });

    return detectedCompetitors
      .filter(c => c.confidence > 0.7)
      .map(c => c.domain)
      .slice(0, 5);
  }

  /**
   * Merge brand information from multiple pages
   */
  private mergeBrandInfo(infoArray: any[]): any {
    const merged = {
      brand: '',
      products: [] as string[],
      industry: '',
      tagline: '',
      competitors: [] as string[],
      keywords: [] as string[]
    };

    // Use most common or longest brand name
    const brandCounts = new Map<string, number>();
    infoArray.forEach(info => {
      if (info.brand) {
        brandCounts.set(info.brand, (brandCounts.get(info.brand) || 0) + 1);
      }
    });
    
    merged.brand = Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || infoArray[0]?.brand || '';

    // Merge arrays and deduplicate
    infoArray.forEach(info => {
      if (info.products) merged.products.push(...info.products);
      if (info.competitors) merged.competitors.push(...info.competitors);
      if (info.keywords) merged.keywords.push(...info.keywords);
      if (info.industry && !merged.industry) merged.industry = info.industry;
      if (info.tagline && !merged.tagline) merged.tagline = info.tagline;
    });

    // Deduplicate
    merged.products = [...new Set(merged.products)].slice(0, 10);
    merged.competitors = [...new Set(merged.competitors)].slice(0, 5);
    merged.keywords = [...new Set(merged.keywords)].slice(0, 20);

    return merged;
  }

  /**
   * Set up event listeners for progress tracking
   */
  private setupEventListeners(analysisId: string, crawlJobId: string): void {
    const progressHandler = (event: any) => {
      if (event.analysisId === analysisId) {
        this.logger.info(`Search intelligence progress for crawl ${crawlJobId}: ${event.progress}%`);
        // Could emit events or update crawl job status here
      }
    };

    const completeHandler = (event: any) => {
      if (event.analysisId === analysisId) {
        this.logger.info(`Search intelligence completed for crawl ${crawlJobId}`);
        this.searchService.removeListener('analysis:progress', progressHandler);
        this.searchService.removeListener('analysis:complete', completeHandler);
        this.searchService.removeListener('analysis:error', errorHandler);
      }
    };

    const errorHandler = (event: any) => {
      if (event.analysisId === analysisId) {
        this.logger.error(`Search intelligence error for crawl ${crawlJobId}:`, event.error);
        this.searchService.removeListener('analysis:progress', progressHandler);
        this.searchService.removeListener('analysis:complete', completeHandler);
        this.searchService.removeListener('analysis:error', errorHandler);
      }
    };

    this.searchService.on('analysis:progress', progressHandler);
    this.searchService.on('analysis:complete', completeHandler);
    this.searchService.on('analysis:error', errorHandler);
  }

  /**
   * Get search intelligence results for a crawl job
   */
  async getResultsForCrawlJob(crawlJobId: string): Promise<any> {
    const analyses = await (this.searchService as any).analysisRepo.findByCrawlJobId(crawlJobId);
    
    if (analyses.length === 0) {
      return null;
    }

    // Get the most recent analysis
    const latestAnalysis = analyses[0];
    return this.searchService.getAnalysisResults(latestAnalysis.id);
  }

  /**
   * Check if search intelligence is enabled for domain
   */
  async shouldRunSearchIntel(domain: string, crawlJobOptions: any): boolean {
    // Check if explicitly enabled
    if (crawlJobOptions.includeSearchIntel === false) {
      return false;
    }

    // Check if domain was recently analyzed
    const recentAnalyses = await (this.searchService as any).analysisRepo.findByDomain(domain, 1);
    if (recentAnalyses.length > 0) {
      const lastAnalysis = recentAnalyses[0];
      const hoursSinceLastAnalysis = (Date.now() - lastAnalysis.createdAt.getTime()) / (1000 * 60 * 60);
      
      // Skip if analyzed within last 24 hours
      if (hoursSinceLastAnalysis < 24) {
        this.logger.info(`Skipping search intelligence for ${domain} - recently analyzed`);
        return false;
      }
    }

    return true;
  }
}

/**
 * Middleware to add search intelligence to crawl routes
 */
export function addSearchIntelRoutes(fastify: any): void {
  const integration = new CrawlerSearchIntelIntegration();

  // Add search intelligence option to crawl endpoint
  fastify.addHook('preHandler', async (request: any, reply: any) => {
    if (request.url === '/api/crawl' && request.method === 'POST') {
      // Extend crawl options schema
      request.body.includeSearchIntel = request.body.includeSearchIntel ?? false;
      request.body.searchIntelOptions = request.body.searchIntelOptions ?? {};
    }
  });

  // Add endpoint to get search intelligence results for crawl
  fastify.get('/api/crawl/:jobId/search-intel', async (request: any, reply: any) => {
    try {
      const { jobId } = request.params;
      const results = await integration.getResultsForCrawlJob(jobId);
      
      if (!results) {
        return reply.code(404).send({ error: 'No search intelligence results found for this crawl job' });
      }

      return results;
    } catch (error) {
      return reply.code(500).send({ 
        error: 'Failed to get search intelligence results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Hook to process search intelligence after crawl completion
 */
export async function processCrawlJobHook(
  crawlJob: any,
  crawledPages: any[],
  integration?: CrawlerSearchIntelIntegration
): Promise<void> {
  if (!integration) {
    integration = new CrawlerSearchIntelIntegration();
  }

  // Check if search intelligence should run
  const shouldRun = await integration.shouldRunSearchIntel(
    crawlJob.domain,
    crawlJob.options || {}
  );

  if (!shouldRun) {
    return;
  }

  // Process search intelligence
  await integration.processCrawlJob(
    crawlJob.id,
    crawlJob.domain,
    crawledPages,
    crawlJob.options?.searchIntelOptions
  );
}