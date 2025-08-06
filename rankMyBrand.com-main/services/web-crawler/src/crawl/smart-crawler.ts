import { EventEmitter } from 'events';
import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import { Redis } from 'ioredis';
import { URL } from 'url';
import { URLFrontier } from './url-frontier.js';
import { Deduplicator } from './deduplicator.js';
import { RenderingDecider } from './rendering-decider.js';
import { CitationExtractor } from '../extraction/citation-extractor.js';
import { StatisticsExtractor } from '../extraction/statistics-extractor.js';
import { QuotationExtractor } from '../extraction/quotation-extractor.js';
import { FluencyExtractor } from '../extraction/fluency-extractor.js';
import { AuthorityExtractor } from '../extraction/authority-extractor.js';
import { RelevanceExtractor } from '../extraction/relevance-extractor.js';
import { 
  CrawlConfig, 
  CrawlResult, 
  CrawlStats, 
  ExtractedLink,
  GEOScores,
  Recommendation,
  WebSocketMessage 
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

interface SmartCrawlerOptions extends CrawlConfig {
  jobId: string;
  redis: Redis;
  onProgress?: (message: WebSocketMessage) => void;
}

export class SmartCrawler extends EventEmitter {
  private config: SmartCrawlerOptions;
  private urlFrontier: URLFrontier;
  private deduplicator: Deduplicator;
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private stats: CrawlStats;
  private redis: Redis;
  private isRunning: boolean = false;
  private workers: Promise<void>[] = [];

  constructor(options: SmartCrawlerOptions) {
    super();
    this.config = {
      maxPages: options.maxPages || 500,
      maxDepth: options.maxDepth || 3,
      targetKeywords: options.targetKeywords || [],
      semanticContext: options.semanticContext || {},
      includeSubdomains: options.includeSubdomains || false,
      jsRenderingBudget: options.jsRenderingBudget || 0.1,
      rateLimitPerSecond: options.rateLimitPerSecond || 5,
      jobId: options.jobId,
      redis: options.redis,
      onProgress: options.onProgress
    };
    
    this.redis = options.redis;
    this.urlFrontier = new URLFrontier(this.redis, this.config.maxDepth);
    this.deduplicator = new Deduplicator(this.redis, this.config.jobId);
    
    this.stats = {
      crawled: 0,
      skipped: 0,
      errors: 0,
      jsRendered: 0,
      avgResponseTime: 0,
      startTime: Date.now()
    };
  }

  async crawl(seedURLs: string[]): Promise<void> {
    try {
      this.isRunning = true;
      logger.info(`Starting crawl job ${this.config.jobId} with ${seedURLs.length} seed URLs`);
      
      // Initialize components
      await this.deduplicator.initialize();
      await this.initializeBrowser();
      
      // Add seed URLs to frontier
      for (const url of seedURLs) {
        await this.urlFrontier.addURL(url, 1.0, 0);
      }
      
      // Start sitemap discovery
      this.discoverSitemaps(seedURLs);
      
      // Start crawl workers
      const workerCount = Math.min(this.config.maxConcurrency || 5, 5);
      for (let i = 0; i < workerCount; i++) {
        this.workers.push(this.crawlWorker(i));
      }
      
      // Wait for all workers to complete
      await Promise.all(this.workers);
      
      logger.info(`Crawl job ${this.config.jobId} completed: ${this.stats.crawled} pages crawled`);
      
    } catch (error) {
      logger.error(`Crawl job ${this.config.jobId} failed: ${error}`);
      throw error;
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  private async crawlWorker(workerId: number): Promise<void> {
    logger.info(`Worker ${workerId} started`);
    
    while (this.isRunning && this.stats.crawled < this.config.maxPages) {
      try {
        const urlItem = await this.urlFrontier.getNextURL();
        
        if (!urlItem) {
          // No URLs available, wait a bit
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        const result = await this.crawlPage(urlItem.url, urlItem.depth);
        
        if (result) {
          await this.processResult(result, urlItem.depth);
          
          // Update progress
          this.updateProgress({
            type: 'progress',
            data: {
              pagesCrawled: this.stats.crawled,
              currentUrl: urlItem.url,
              queueSize: await this.urlFrontier.getQueueSize(),
              avgResponseTime: this.stats.avgResponseTime
            }
          });
        }
        
      } catch (error) {
        logger.error(`Worker ${workerId} error: ${error}`);
        this.stats.errors++;
      }
    }
    
    logger.info(`Worker ${workerId} finished`);
  }

  private async crawlPage(url: string, depth: number): Promise<CrawlResult | null> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Crawling ${url} (depth: ${depth})`);
      
      // First, try static crawling
      const response = await fetch(url, {
        headers: {
          'User-Agent': config.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Check for duplicate content
      if (await this.deduplicator.isDuplicate(url, html)) {
        this.stats.skipped++;
        logger.debug(`Skipping duplicate content: ${url}`);
        return null;
      }
      
      // Decide if JavaScript rendering is needed
      const renderDecision = await RenderingDecider.needsJavaScript(url, headers, html);
      
      let finalHTML = html;
      let renderMethod: 'static' | 'dynamic' = 'static';
      
      if (renderDecision.needs && this.shouldUseJSRendering()) {
        try {
          logger.debug(`Using JavaScript rendering for ${url} (reason: ${renderDecision.reason})`);
          finalHTML = await this.renderWithPlaywright(url);
          renderMethod = 'dynamic';
          this.stats.jsRendered++;
        } catch (error) {
          logger.warn(`JS rendering failed for ${url}, using static HTML: ${error}`);
        }
      }
      
      // Extract content and GEO metrics
      const $ = cheerio.load(finalHTML);
      const text = this.extractCleanText($);
      
      // Extract all GEO metrics
      const crawlResult: CrawlResult = {
        url,
        crawlTimestamp: new Date(),
        renderMethod,
        responseTimeMs: Date.now() - startTime,
        
        // GEO metrics
        citations: CitationExtractor.extract(finalHTML, text),
        statistics: StatisticsExtractor.extract(text, finalHTML),
        quotations: QuotationExtractor.extract(text, finalHTML),
        fluency: FluencyExtractor.extract(text, finalHTML),
        authority: await AuthorityExtractor.extract(url, finalHTML),
        relevance: await RelevanceExtractor.extract(
          { text, html: finalHTML },
          this.config.targetKeywords,
          this.config.semanticContext
        ),
        
        // Metadata
        meta: {
          title: $('title').text().trim(),
          description: $('meta[name="description"]').attr('content') || '',
          canonical: $('link[rel="canonical"]').attr('href') || '',
          author: $('meta[name="author"]').attr('content') || '',
          publishDate: this.extractPublishDate($) || '',
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length
        },
        
        // Extract links for frontier
        links: this.extractLinks($, url, depth)
      };
      
      this.stats.crawled++;
      this.updateStats(Date.now() - startTime);
      
      return crawlResult;
      
    } catch (error) {
      logger.error(`Error crawling ${url}: ${error}`);
      this.stats.errors++;
      return null;
    }
  }

  private async renderWithPlaywright(url: string): Promise<string> {
    if (!this.browserContext) {
      throw new Error('Browser context not initialized');
    }
    
    const page = await this.browserContext.newPage();
    
    try {
      // Set viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Navigate with timeout
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 15000
      });
      
      // Wait for main content
      await page.waitForSelector('main, article, [role="main"], #content', {
        timeout: 5000
      }).catch(() => {
        // Don't fail if selector not found
        logger.debug(`Main content selector not found for ${url}`);
      });
      
      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      // Get final HTML
      const html = await page.content();
      return html;
      
    } finally {
      await page.close();
    }
  }

  private shouldUseJSRendering(): boolean {
    const jsRatio = this.stats.jsRendered / Math.max(this.stats.crawled, 1);
    return jsRatio < this.config.jsRenderingBudget;
  }

  private extractCleanText($: cheerio.CheerioAPI): string {
    // Remove script and style elements
    $('script, style, noscript').remove();
    
    // Get text from body
    const text = $('body').text();
    
    // Clean up whitespace
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractLinks($: cheerio.CheerioAPI, baseURL: string, currentDepth: number): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const base = new URL(baseURL);
    const maxLinks = 50; // Limit links per page
    
    $('a[href]').each((i, elem) => {
      if (links.length >= maxLinks) return false; // Stop collecting
      
      const href = $(elem).attr('href');
      if (!href) return;
      
      try {
        const url = new URL(href, base);
        
        // Filter links
        if (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          (url.hostname === base.hostname || (this.config.includeSubdomains && url.hostname.endsWith(base.hostname))) &&
          !url.pathname.match(/\.(pdf|jpg|jpeg|png|gif|zip|mp4|mp3|doc|docx|xls|xlsx)$/i) &&
          !url.pathname.includes('/tag/') &&
          !url.pathname.includes('/page/') && // Pagination
          url.pathname !== '/feed' &&
          url.pathname !== '/sitemap.xml'
        ) {
          links.push({
            url: url.href,
            anchor: $(elem).text().trim(),
            isInternal: url.hostname === base.hostname
          });
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });
    
    return links;
  }

  private extractPublishDate($: cheerio.CheerioAPI): string {
    // Try multiple strategies to extract publish date
    const selectors = [
      'meta[property="article:published_time"]',
      'meta[name="publish_date"]',
      'meta[name="date"]',
      'time[datetime]',
      '.publish-date',
      '.date-published',
      '[itemprop="datePublished"]'
    ];
    
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        const date = element.attr('content') || 
                    element.attr('datetime') || 
                    element.text();
        if (date) return date.trim();
      }
    }
    
    return '';
  }

  private async processResult(result: CrawlResult, depth: number): Promise<void> {
    // Calculate GEO scores
    const scores = this.calculateGEOScores(result);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(result, scores);
    
    // Store result in database (emit event for database service to handle)
    this.emit('pageProcessed', {
      result,
      scores,
      recommendations
    });
    
    // Add discovered URLs to frontier
    for (const link of result.links) {
      if (depth < this.config.maxDepth) {
        // Calculate priority based on anchor text relevance
        const priority = this.calculateURLPriority(link.anchor);
        await this.urlFrontier.addURL(link.url, priority, depth + 1);
      }
    }
    
    // Real-time update
    if (recommendations.length > 0) {
      this.updateProgress({
        type: 'recommendation',
        data: {
          url: result.url,
          recommendations: recommendations.slice(0, 3) // Top 3
        }
      });
    }
  }

  private calculateGEOScores(result: CrawlResult): GEOScores {
    const scores: GEOScores = {
      overall: 0,
      citation: 0,
      statistics: 0,
      quotation: 0,
      fluency: 0,
      authority: 0,
      relevance: 0,
      confidence: {
        citation: 0,
        statistics: 0,
        quotation: 0,
        fluency: 0,
        authority: 0,
        relevance: 0
      }
    };
    
    // Citation Score (0-100)
    scores.citation = Math.min(
      (result.citations.density * 20) + 
      (result.citations.hasReferenceSection ? 20 : 0) +
      (result.citations.confidence * 60),
      100
    );
    scores.confidence.citation = result.citations.confidence;
    
    // Statistics Score (0-100)
    scores.statistics = Math.min(
      (result.statistics.density * 15) +
      (result.statistics.relevance * 50) +
      (Object.keys(result.statistics.types).filter(t => result.statistics.types[t] > 0).length * 7),
      100
    );
    scores.confidence.statistics = Math.min(result.statistics.density / 2, 1);
    
    // Quotation Score (0-100)
    scores.quotation = Math.min(
      (result.quotations.count > 0 ? 20 : 0) +
      ((result.quotations.attributed / Math.max(result.quotations.count, 1)) * 40) +
      (result.quotations.authorityScore * 0.4),
      100
    );
    scores.confidence.quotation = result.quotations.confidence;
    
    // Fluency Score (0-100)
    scores.fluency = result.fluency.overall;
    scores.confidence.fluency = 0.9; // High confidence in calculation
    
    // Authority Score (0-100)
    scores.authority = result.authority.score;
    scores.confidence.authority = result.authority.confidence;
    
    // Relevance Score (0-100)
    scores.relevance = result.relevance.overall;
    scores.confidence.relevance = Math.min(result.relevance.overall / 100, 1);
    
    // Overall GEO Score (weighted average)
    scores.overall = (
      scores.citation * 0.2 +
      scores.statistics * 0.2 +
      scores.quotation * 0.15 +
      scores.fluency * 0.15 +
      scores.authority * 0.15 +
      scores.relevance * 0.15
    );
    
    return scores;
  }

  private generateRecommendations(result: CrawlResult, scores: GEOScores): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Citation recommendations
    if (scores.citation < 70) {
      if (!result.citations.hasReferenceSection) {
        recommendations.push({
          metric: 'citation',
          priority: 'high',
          action: 'Add a references or bibliography section',
          impact: '+20 points',
          effort: 'medium'
        });
      }
      
      if (result.citations.density < 1) {
        recommendations.push({
          metric: 'citation',
          priority: 'high',
          action: `Add ${Math.ceil(3 - result.citations.count)} more citations to reach optimal density`,
          impact: '+15 points',
          effort: 'low'
        });
      }
    }
    
    // Statistics recommendations
    if (scores.statistics < 70) {
      const missingTypes = ['percentage', 'comparisons', 'temporal'].filter(
        type => !result.statistics.types[type] || result.statistics.types[type] === 0
      );
      
      if (missingTypes.length > 0) {
        recommendations.push({
          metric: 'statistics',
          priority: 'medium',
          action: `Add statistics with ${missingTypes.join(', ')} data`,
          impact: '+10-15 points',
          effort: 'medium'
        });
      }
    }
    
    // Quotation recommendations
    if (scores.quotation < 60) {
      if (result.quotations.count === 0) {
        recommendations.push({
          metric: 'quotation',
          priority: 'medium',
          action: 'Add 2-3 expert quotes with attribution',
          impact: '+30 points',
          effort: 'medium'
        });
      } else if (result.quotations.attributed < result.quotations.count) {
        recommendations.push({
          metric: 'quotation',
          priority: 'high',
          action: 'Add attribution to unnamed quotes',
          impact: '+15 points',
          effort: 'low'
        });
      }
    }
    
    // Fluency recommendations
    if (scores.fluency < 70) {
      if (!result.fluency.structure.hasH1) {
        recommendations.push({
          metric: 'fluency',
          priority: 'high',
          action: 'Add a clear H1 heading',
          impact: '+10 points',
          effort: 'low'
        });
      }
      
      if (result.fluency.structure.h2Count < 3) {
        recommendations.push({
          metric: 'fluency',
          priority: 'medium',
          action: 'Add more subheadings (H2) to break up content',
          impact: '+5-10 points',
          effort: 'low'
        });
      }
    }
    
    // Authority recommendations
    if (scores.authority < 70) {
      if (!result.authority.signals.hasAuthorBio) {
        recommendations.push({
          metric: 'authority',
          priority: 'high',
          action: 'Add author bio with credentials',
          impact: '+15 points',
          effort: 'medium'
        });
      }
      
      if (!result.authority.signals.https) {
        recommendations.push({
          metric: 'authority',
          priority: 'critical',
          action: 'Enable HTTPS for the website',
          impact: '+10 points',
          effort: 'high'
        });
      }
    }
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
    
    return recommendations;
  }

  private calculateURLPriority(anchorText: string): number {
    // Base priority
    let priority = 0.5;
    
    // Boost if anchor text contains target keywords
    const anchorLower = anchorText.toLowerCase();
    for (const keyword of this.config.targetKeywords) {
      if (anchorLower.includes(keyword.toLowerCase())) {
        priority += 0.1;
      }
    }
    
    // Boost for certain page types
    const importantPatterns = ['guide', 'how to', 'tutorial', 'best', 'top'];
    for (const pattern of importantPatterns) {
      if (anchorLower.includes(pattern)) {
        priority += 0.05;
      }
    }
    
    return Math.min(priority, 1.0);
  }

  private async discoverSitemaps(seedURLs: string[]): Promise<void> {
    for (const seedURL of seedURLs) {
      try {
        const domain = new URL(seedURL).origin;
        const sitemapURLs = [
          `${domain}/sitemap.xml`,
          `${domain}/sitemap_index.xml`,
          `${domain}/sitemap.xml.gz`
        ];
        
        for (const sitemapURL of sitemapURLs) {
          try {
            const response = await fetch(sitemapURL, {
              headers: { 'User-Agent': config.USER_AGENT },
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
              const xml = await response.text();
              const urls = await this.urlFrontier.parseSitemap(xml);
              
              logger.info(`Found ${urls.length} URLs in sitemap: ${sitemapURL}`);
              
              // Add high-priority pages from sitemap
              for (const url of urls.slice(0, 100)) { // Top 100
                await this.urlFrontier.addURL(url, 0.8, 0);
              }
              
              break; // Found sitemap, no need to check others
            }
          } catch (error) {
            // Sitemap not found or error, continue
          }
        }
      } catch (error) {
        logger.error(`Error discovering sitemaps: ${error}`);
      }
    }
  }

  private async initializeBrowser(): Promise<void> {
    if (config.JS_RENDERING_ENABLED) {
      this.browser = await chromium.launch({
        headless: config.BROWSER_HEADLESS,
        args: [
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
      
      this.browserContext = await this.browser.newContext({
        userAgent: config.USER_AGENT,
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });
    }
  }

  private updateStats(responseTime: number): void {
    // Update average response time
    const totalTime = this.stats.avgResponseTime * (this.stats.crawled - 1) + responseTime;
    this.stats.avgResponseTime = totalTime / this.stats.crawled;
  }

  private updateProgress(message: WebSocketMessage): void {
    if (this.config.onProgress) {
      this.config.onProgress(message);
    }
    this.emit('progress', message);
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.browserContext) {
        await this.browserContext.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      await this.urlFrontier.clear();
      await this.deduplicator.cleanup();
    } catch (error) {
      logger.error(`Error during cleanup: ${error}`);
    }
  }

  async stop(): Promise<void> {
    logger.info(`Stopping crawl job ${this.config.jobId}`);
    this.isRunning = false;
    await Promise.all(this.workers);
  }

  getStats(): CrawlStats {
    return { ...this.stats };
  }
}
