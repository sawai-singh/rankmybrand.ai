import { chromium, Browser, BrowserContext } from 'playwright';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import PQueue from 'p-queue';
import { URL } from 'url';
import crypto from 'crypto';
import { DatabaseService } from './database.service';
import { QueueService } from './queue.service';
import { logger } from '../utils/logger';
import { CrawlJob, PageData } from '../types/crawler.types';

export class CrawlerService {
  private browser: Browser | null = null;
  private queue: PQueue;
  private contexts: Map<string, BrowserContext> = new Map();
  
  constructor(
    private db: DatabaseService,
    private queueService: QueueService
  ) {
    this.queue = new PQueue({ 
      concurrency: parseInt(process.env.CRAWLER_CONCURRENCY || '5'),
      interval: 1000,
      intervalCap: 10
    });
  }
  
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    logger.info('Crawler service initialized');
  }
  
  async shutdown(): Promise<void> {
    await this.queue.onIdle();
    
    for (const [, context] of this.contexts) {
      await context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    logger.info('Crawler service shut down');
  }
  
  async createCrawlJob(url: string, depth: number = 2, userId?: string): Promise<CrawlJob> {
    const jobId = this.generateJobId();
    
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL provided');
    }
    
    // Check robots.txt
    const canCrawl = await this.checkRobotsTxt(url);
    if (!canCrawl) {
      throw new Error('Crawling not allowed by robots.txt');
    }
    
    // Create job in database
    const job = await this.db.createCrawlJob({
      id: jobId,
      url,
      depth,
      userId,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Add to processing queue
    await this.queueService.addJob('crawl', {
      jobId,
      url,
      depth,
      userId
    });
    
    // Start processing asynchronously
    this.processCrawlJob(job).catch(error => {
      logger.error({ error, jobId }, 'Failed to process crawl job');
      this.updateJobStatus(jobId, 'failed', error.message);
    });
    
    return job;
  }
  
  async getCrawlJob(jobId: string): Promise<CrawlJob | null> {
    return this.db.getCrawlJob(jobId);
  }
  
  private async processCrawlJob(job: CrawlJob): Promise<void> {
    const startTime = Date.now();
    const visited = new Set<string>();
    const results: PageData[] = [];
    
    try {
      await this.updateJobStatus(job.id, 'processing');
      
      // Create isolated context for this crawl
      const context = await this.browser!.newContext({
        userAgent: process.env.USER_AGENT || 'RankMyBrand.ai Crawler/1.0',
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });
      
      this.contexts.set(job.id, context);
      
      // Crawl starting from the root URL
      await this.crawlPage(job.url, job.depth, visited, results, context);
      
      // Store results in database
      await this.db.storeCrawlResults(job.id, results);
      
      // Update job with results
      await this.db.updateCrawlJob(job.id, {
        status: 'completed',
        pagesScanned: results.length,
        duration: Date.now() - startTime,
        completedAt: new Date(),
        results: {
          pages: results.length,
          totalSize: results.reduce((acc, page) => acc + (page.size || 0), 0),
          avgLoadTime: results.reduce((acc, page) => acc + (page.loadTime || 0), 0) / results.length
        }
      });
      
      // Clean up context
      await context.close();
      this.contexts.delete(job.id);
      
      logger.info({ jobId: job.id, pagesScanned: results.length }, 'Crawl job completed');
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Crawl job failed');
      await this.updateJobStatus(job.id, 'failed', (error as Error).message);
      throw error;
    }
  }
  
  private async crawlPage(
    url: string,
    depth: number,
    visited: Set<string>,
    results: PageData[],
    context: BrowserContext
  ): Promise<void> {
    if (depth < 0 || visited.has(url)) {
      return;
    }
    
    visited.add(url);
    
    const page = await context.newPage();
    
    try {
      const startTime = Date.now();
      
      // Navigate to page with timeout
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (!response) {
        throw new Error('Failed to load page');
      }
      
      const loadTime = Date.now() - startTime;
      const content = await page.content();
      const $ = load(content);
      
      // Extract page data
      const pageData: PageData = {
        url,
        title: $('title').text() || $('meta[property="og:title"]').attr('content') || '',
        description: $('meta[name="description"]').attr('content') || 
                    $('meta[property="og:description"]').attr('content') || '',
        keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [],
        h1: $('h1').map((_, el) => $(el).text()).get(),
        h2: $('h2').map((_, el) => $(el).text()).get(),
        images: $('img').map((_, el) => $(el).attr('src')).get().filter(Boolean),
        links: $('a[href]').map((_, el) => $(el).attr('href')).get().filter(Boolean),
        statusCode: response.status(),
        contentType: response.headers()['content-type'] || '',
        size: content.length,
        loadTime,
        crawledAt: new Date()
      };
      
      // Extract structured data if present
      const jsonLd = $('script[type="application/ld+json"]').html();
      if (jsonLd) {
        try {
          pageData.structuredData = JSON.parse(jsonLd);
        } catch (e) {
          logger.warn({ url, error: e }, 'Failed to parse structured data');
        }
      }
      
      // Extract Open Graph data
      pageData.openGraph = {
        title: $('meta[property="og:title"]').attr('content'),
        description: $('meta[property="og:description"]').attr('content'),
        image: $('meta[property="og:image"]').attr('content'),
        url: $('meta[property="og:url"]').attr('content'),
        type: $('meta[property="og:type"]').attr('content'),
      };
      
      results.push(pageData);
      
      // Crawl linked pages if depth allows
      if (depth > 0) {
        const links = this.extractInternalLinks(url, pageData.links);
        
        for (const link of links.slice(0, 10)) { // Limit to 10 links per page
          await this.queue.add(() => 
            this.crawlPage(link, depth - 1, visited, results, context)
          );
        }
      }
    } catch (error) {
      logger.error({ error, url }, 'Failed to crawl page');
    } finally {
      await page.close();
    }
  }
  
  private extractInternalLinks(baseUrl: string, links: string[]): string[] {
    const base = new URL(baseUrl);
    const internalLinks: string[] = [];
    
    for (const link of links) {
      try {
        const url = new URL(link, baseUrl);
        
        // Only follow internal links
        if (url.hostname === base.hostname) {
          internalLinks.push(url.href);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    return [...new Set(internalLinks)];
  }
  
  private async checkRobotsTxt(url: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/robots.txt`;
      
      const response = await fetch(robotsUrl);
      if (!response.ok) {
        // No robots.txt means we can crawl
        return true;
      }
      
      const robotsTxt = await response.text();
      const robots = robotsParser(robotsUrl, robotsTxt);
      
      return robots.isAllowed(url, process.env.USER_AGENT || 'RankMyBrand.ai Crawler/1.0') ?? true;
    } catch (error) {
      // If we can't check robots.txt, assume we can crawl
      logger.warn({ error, url }, 'Failed to check robots.txt');
      return true;
    }
  }
  
  private async updateJobStatus(jobId: string, status: string, error?: string): Promise<void> {
    await this.db.updateCrawlJob(jobId, { 
      status: status as 'queued' | 'processing' | 'completed' | 'failed', 
      error,
      updatedAt: new Date() 
    });
  }
  
  private generateJobId(): string {
    return `crawl_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}