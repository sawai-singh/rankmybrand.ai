import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { PlaywrightBlocker } from '@cliqz/adblocker-playwright';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions, Citation } from '../types';
import { AntiDetection } from '../anti-detection';

interface ScrapingTarget {
  name: string;
  url: string;
  selectors: {
    input: string;
    submit: string;
    response: string;
    citations?: string;
    loading?: string;
  };
  requiresAuth: boolean;
  waitStrategy?: 'networkidle' | 'domcontentloaded' | 'selector';
  maxWaitTime?: number;
}

const SCRAPING_CONFIGS: Record<string, ScrapingTarget> = {
  'google-sge': {
    name: 'Google SGE',
    url: 'https://google.com',
    selectors: {
      input: 'textarea[name="q"], input[name="q"]',
      submit: 'button[type="submit"], input[type="submit"]',
      response: '[data-ai-response], .ai-response, .sge-response',
      citations: 'cite, .citation-link',
      loading: '.loading-indicator'
    },
    requiresAuth: false,
    waitStrategy: 'networkidle',
    maxWaitTime: 30000
  },
  'bing-chat': {
    name: 'Bing Chat',
    url: 'https://www.bing.com/chat',
    selectors: {
      input: '#searchbox, textarea[placeholder*="Ask"], .b_searchbox',
      submit: '#search_icon, button[type="submit"]',
      response: '.b_answerCard, .cib-message, [data-content-type="text"]',
      citations: '.b_factrow a, .citation-link',
      loading: '.loading, .typing-indicator'
    },
    requiresAuth: false,
    waitStrategy: 'selector',
    maxWaitTime: 45000
  },
  'you-com': {
    name: 'You.com',
    url: 'https://you.com',
    selectors: {
      input: 'textarea[placeholder*="Ask"], input[type="text"]',
      submit: 'button[type="submit"], button:has-text("Search")',
      response: '[data-testid="youchat-answer"], .chatAnswer',
      citations: '.source-link, a[href*="source"]'
    },
    requiresAuth: false,
    waitStrategy: 'selector',
    maxWaitTime: 30000
  },
  'phind': {
    name: 'Phind',
    url: 'https://www.phind.com',
    selectors: {
      input: 'textarea[placeholder*="Ask"], .search-input',
      submit: 'button[type="submit"], button:has-text("Search")',
      response: '.answer-content, .result-streaming',
      citations: '.source-item a'
    },
    requiresAuth: false,
    waitStrategy: 'selector',
    maxWaitTime: 30000
  },
  'gemini': {
    name: 'Google Gemini',
    url: 'https://gemini.google.com',
    selectors: {
      input: '.ql-editor, textarea[placeholder*="Enter"]',
      submit: 'button[aria-label*="Send"], button:has-text("Send")',
      response: '.model-response, .message-content',
      citations: '.source-link'
    },
    requiresAuth: true,
    waitStrategy: 'selector',
    maxWaitTime: 30000
  }
};

export class PlaywrightCollector extends BaseCollector {
  private browser?: Browser;
  private context?: BrowserContext;
  private antiDetection: AntiDetection;
  private config: ScrapingTarget;
  private blocker?: PlaywrightBlocker;
  
  constructor(platform: string, redis: Redis) {
    super(platform, redis);
    this.antiDetection = new AntiDetection();
    this.config = SCRAPING_CONFIGS[platform];
    
    if (!this.config) {
      throw new Error(`No configuration found for platform: ${platform}`);
    }
  }
  
  async initialize(): Promise<void> {
    // Launch browser with stealth settings
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS_BROWSER !== 'false',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    // Initialize ad blocker
    this.blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
  }
  
  async validate(): Promise<boolean> {
    if (!this.browser) {
      return false;
    }
    
    try {
      const context = await this.createStealthContext();
      const page = await context.newPage();
      
      await page.goto(this.config.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      const inputExists = await page.locator(this.config.selectors.input).count() > 0;
      
      await page.close();
      await context.close();
      
      return inputExists;
    } catch (error) {
      console.error(`Validation failed for ${this.name}:`, error);
      return false;
    }
  }
  
  async collect(prompt: string, options?: CollectionOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const responseId = uuidv4();
    
    const context = await this.createStealthContext();
    const page = await context.newPage();
    
    try {
      // Enable ad blocking
      if (this.blocker) {
        await this.blocker.enableBlockingInPage(page);
      }
      
      // Apply anti-detection measures
      await this.antiDetection.preparePageEvasion(page);
      
      // Navigate to the platform
      await page.goto(this.config.url, { 
        waitUntil: this.config.waitStrategy || 'networkidle',
        timeout: 30000 
      });
      
      // Handle authentication if required
      if (this.config.requiresAuth) {
        const isLoggedIn = await this.checkAuthentication(page);
        if (!isLoggedIn) {
          throw new Error(`Authentication required for ${this.name}`);
        }
      }
      
      // Wait for and interact with the input field
      await page.waitForSelector(this.config.selectors.input, { 
        timeout: 10000,
        state: 'visible' 
      });
      
      // Type with human-like delays
      await this.antiDetection.humanType(page, this.config.selectors.input, prompt);
      
      // Small delay before submitting
      await this.delay(500 + Math.random() * 1000);
      
      // Submit the query
      await this.submitQuery(page);
      
      // Wait for response
      const responseText = await this.waitForResponse(page);
      
      // Extract citations if available
      const citations = await this.extractCitations(page);
      
      const processingTime = Date.now() - startTime;
      
      const aiResponse: AIResponse = {
        id: responseId,
        platform: this.name,
        prompt,
        response: responseText,
        citations,
        processingTime,
        metadata: {
          url: page.url(),
          scraped: true
        },
        timestamp: new Date()
      };
      
      // Track metrics
      this.trackMetrics(true, 0, processingTime);
      
      // Publish response
      await this.publishResponse(aiResponse);
      
      return this.sanitizeResponse(aiResponse);
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      // Take screenshot for debugging
      if (process.env.NODE_ENV === 'development') {
        await page.screenshot({ 
          path: `error-${this.name}-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      // Track failed request
      this.trackMetrics(false, 0, processingTime);
      
      throw new Error(`${this.name} scraping failed: ${error.message}`);
      
    } finally {
      await page.close();
      await context.close();
    }
  }
  
  private async createStealthContext(): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: this.antiDetection.getRandomUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York
      deviceScaleFactor: 1,
      hasTouch: false,
      colorScheme: 'light',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    // Add cookies if we have a session
    const sessionCookies = await this.getSessionCookies();
    if (sessionCookies && sessionCookies.length > 0) {
      await context.addCookies(sessionCookies);
    }
    
    return context;
  }
  
  private async checkAuthentication(page: Page): Promise<boolean> {
    // Check for common authentication indicators
    const loggedInSelectors = [
      '[aria-label*="Account"]',
      '.user-avatar',
      '.profile-picture',
      '[data-user-id]'
    ];
    
    for (const selector of loggedInSelectors) {
      if (await page.locator(selector).count() > 0) {
        return true;
      }
    }
    
    return false;
  }
  
  private async submitQuery(page: Page): Promise<void> {
    // Try multiple strategies to submit
    const submitButton = page.locator(this.config.selectors.submit);
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
    } else {
      // Try pressing Enter
      await page.keyboard.press('Enter');
    }
  }
  
  private async waitForResponse(page: Page): Promise<string> {
    const maxWait = this.config.maxWaitTime || 30000;
    const startTime = Date.now();
    
    // Wait for loading indicator to disappear if exists
    if (this.config.selectors.loading) {
      try {
        await page.waitForSelector(this.config.selectors.loading, {
          state: 'hidden',
          timeout: 5000
        });
      } catch {
        // Loading indicator might not appear
      }
    }
    
    // Wait for response selector
    await page.waitForSelector(this.config.selectors.response, {
      timeout: maxWait,
      state: 'visible'
    });
    
    // Wait a bit for content to stabilize
    await this.delay(1000);
    
    // Extract all response text
    const responseElements = await page.locator(this.config.selectors.response).all();
    const responseTexts = await Promise.all(
      responseElements.map(el => el.textContent())
    );
    
    const responseText = responseTexts
      .filter(text => text && text.trim())
      .join('\n\n');
    
    if (!responseText) {
      throw new Error('No response text found');
    }
    
    return responseText;
  }
  
  private async extractCitations(page: Page): Promise<Citation[]> {
    if (!this.config.selectors.citations) {
      return [];
    }
    
    const citations: Citation[] = [];
    
    try {
      const citationElements = await page.locator(this.config.selectors.citations).all();
      
      for (let i = 0; i < citationElements.length; i++) {
        const element = citationElements[i];
        const href = await element.getAttribute('href');
        const text = await element.textContent();
        
        if (href) {
          citations.push({
            title: text || `Source ${i + 1}`,
            url: href.startsWith('http') ? href : `https://${this.extractDomain(this.config.url)}${href}`,
            position: i + 1,
            domain: this.extractDomain(href)
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to extract citations from ${this.name}:`, error);
    }
    
    return citations;
  }
  
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
  
  private async getSessionCookies(): Promise<any[]> {
    // TODO: Implement session cookie retrieval from storage
    return [];
  }
  
  calculateCost(usage: any): number {
    // Web scraping has no direct API cost
    return 0;
  }
  
  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}