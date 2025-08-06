/**
 * In-House SERP Scraper
 * Real Google search results without paid APIs
 * Built by a proper architect who doesn't rely on mocks!
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import {
  SerpApiProvider,
  SerpApiResponse,
  SerpResult,
  SerpFeatures
} from '../types/search-intelligence.types.js';

interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  userAgents?: string[];
  searchDomain?: string;
  maxRetries?: number;
}

export class InHouseSerpScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: ScraperConfig;
  private userAgents: string[];
  private currentUAIndex: number = 0;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      searchDomain: config.searchDomain || 'google.com',
      maxRetries: config.maxRetries || 3,
      userAgents: config.userAgents || this.getDefaultUserAgents()
    };
    this.userAgents = this.config.userAgents!;
  }

  /**
   * Initialize the browser
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });

      // Create context with random user agent
      this.context = await this.browser.newContext({
        userAgent: this.getNextUserAgent(),
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        // Block unnecessary resources for faster loading
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      // Add stealth scripts to avoid detection
      await this.context.addInitScript(() => {
        // Override webdriver detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });

      logger.info('[InHouseSerpScraper] In-house SERP scraper initialized');
    } catch (error) {
      logger.error('[InHouseSerpScraper] Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Search Google and extract results
   */
  async search(
    query: string,
    options: {
      searchDepth?: number;
      location?: string;
      device?: 'desktop' | 'mobile';
    } = {}
  ): Promise<SerpApiResponse> {
    if (!this.context) {
      await this.initialize();
    }

    const page = await this.context!.newPage();
    const startTime = Date.now();

    try {
      // Block images, fonts, and media for faster loading
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Build search URL
      const searchUrl = this.buildSearchUrl(query, options);
      logger.info(`[InHouseSerpScraper] Searching: ${query}`);

      // Navigate to Google
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      // Handle consent forms if they appear
      await this.handleConsentForms(page);

      // Wait for results to load
      await page.waitForSelector('#search', { timeout: 10000 }).catch(() => {
        logger.warn('[InHouseSerpScraper] Search results selector not found, continuing anyway');
      });

      // Extract HTML
      const html = await page.content();
      
      // Debug: Save HTML for inspection
      if (process.env.NODE_ENV === 'development') {
        const fs = await import('fs/promises');
        await fs.writeFile('/tmp/google-search.html', html);
        logger.info('[InHouseSerpScraper] Saved HTML to /tmp/google-search.html');
      }
      
      // Parse results
      const results = this.parseSearchResults(html, query);
      const searchTime = (Date.now() - startTime) / 1000;

      logger.info(`[InHouseSerpScraper] Found ${results.results.length} results in ${searchTime}s`);

      return {
        ...results,
        searchTime
      };

    } catch (error) {
      logger.error('[InHouseSerpScraper] Search failed:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Parse Google search results HTML
   */
  private parseSearchResults(html: string, query: string): SerpApiResponse {
    const $ = cheerio.load(html);
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
      totalOrganicResults: 0
    };

    // Extract organic results
    $('.g').each((index, element) => {
      const $el = $(element);
      
      // Skip if it's an ad
      if ($el.find('[data-text-ad]').length > 0 || $el.text().includes('Sponsored')) {
        return;
      }

      // Extract URL
      const $link = $el.find('a[href]').first();
      const url = $link.attr('href');
      if (!url || !url.startsWith('http')) return;

      // Extract title
      const title = $el.find('h3').first().text().trim();
      if (!title) return;

      // Extract snippet
      const snippet = $el.find('[data-sncf]').text().trim() || 
                     $el.find('.VwiC3b').text().trim() ||
                     $el.find('[style="-webkit-line-clamp:2"]').text().trim();

      results.push({
        position: results.length + 1,
        url,
        domain: new URL(url).hostname,
        title,
        snippet,
        isAd: false
      });
    });

    // Check for SERP features
    features.hasFeaturedSnippet = $('.xpdopen, .kp-blk').length > 0;
    features.hasKnowledgePanel = $('.kp-wholepage, #rhs .kp-blk').length > 0;
    features.hasPeopleAlsoAsk = $('[data-q], .related-question-pair').length > 0;
    features.hasLocalPack = $('.H93uF').length > 0;
    features.hasShoppingResults = $('[data-offer-id], .sh-dgr__content').length > 0;
    features.hasVideoCarousel = $('.video-voyager, g-scrolling-carousel').length > 0;
    features.hasNewsResults = $('.WlydOe, .ftSUBd').length > 0;
    features.hasImagePack = $('.ivg-i, .islrc').length > 0;
    features.totalOrganicResults = results.length;

    // Extract total results count
    const totalResultsText = $('#result-stats').text();
    const totalMatch = totalResultsText.match(/[\d,]+/);
    const totalResults = totalMatch ? parseInt(totalMatch[0].replace(/,/g, '')) : 0;

    return {
      query,
      results,
      features,
      totalResults
    };
  }

  /**
   * Build Google search URL
   */
  private buildSearchUrl(query: string, options: any): string {
    const params = new URLSearchParams({
      q: query,
      num: String(options.searchDepth || 20),
      hl: 'en',
      gl: 'us'
    });

    if (options.location) {
      params.append('near', options.location);
    }

    return `https://www.${this.config.searchDomain}/search?${params}`;
  }

  /**
   * Handle Google consent forms
   */
  private async handleConsentForms(page: Page): Promise<void> {
    try {
      // Try to click "Accept all" or similar buttons
      const consentSelectors = [
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
        '#L2AGLb', // Google's consent button ID
        '[aria-label="Accept all"]'
      ];

      for (const selector of consentSelectors) {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(1000);
          break;
        }
      }
    } catch (error) {
      // Consent form handling is optional
      logger.debug('[InHouseSerpScraper] No consent form found or already accepted');
    }
  }

  /**
   * Get next user agent in rotation
   */
  private getNextUserAgent(): string {
    const ua = this.userAgents[this.currentUAIndex];
    this.currentUAIndex = (this.currentUAIndex + 1) % this.userAgents.length;
    return ua;
  }

  /**
   * Get default user agents
   */
  private getDefaultUserAgents(): string[] {
    return [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    logger.info('[InHouseSerpScraper] In-house SERP scraper cleaned up');
  }
}

/**
 * Create a SERP API compatible wrapper
 */
export class InHouseSerpProvider {
  private scraper: InHouseSerpScraper;
  private initialized: boolean = false;

  constructor() {
    this.scraper = new InHouseSerpScraper({
      headless: true,
      timeout: 30000
    });
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.scraper.initialize();
      this.initialized = true;
    }
  }

  async search(
    query: string,
    options: any = {}
  ): Promise<SerpApiResponse> {
    try {
      return await this.scraper.search(query, options);
    } catch (error) {
      logger.error('[InHouseSerpProvider] In-house SERP search failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.scraper.cleanup();
  }
}