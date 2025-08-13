import { Page } from 'playwright';
import UserAgent from 'user-agents';

export class AntiDetection {
  private userAgents: string[];
  private currentUserAgentIndex: number = 0;
  
  constructor() {
    // Generate a pool of realistic user agents
    this.userAgents = this.generateUserAgentPool();
  }
  
  private generateUserAgentPool(): string[] {
    const agents: string[] = [];
    
    // Generate diverse user agents
    for (let i = 0; i < 50; i++) {
      const userAgent = new UserAgent({
        deviceCategory: 'desktop',
        platform: 'Win32',
        vendor: /chrome/i
      });
      agents.push(userAgent.toString());
    }
    
    // Add some specific popular user agents
    agents.push(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    );
    
    return agents;
  }
  
  getRandomUserAgent(): string {
    const agent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    return agent;
  }
  
  async preparePageEvasion(page: Page): Promise<void> {
    // Remove webdriver flag
    await page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // @ts-ignore
      window.navigator.chrome = {
        runtime: {},
      };
      
      // @ts-ignore
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
            description: "Portable Document Format", 
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          }
        ],
      });
      
      // @ts-ignore
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Fix chrome runtime
      // @ts-ignore
      if (!window.chrome) {
        // @ts-ignore
        window.chrome = {};
      }
      
      // @ts-ignore
      if (!window.chrome.runtime) {
        // @ts-ignore
        window.chrome.runtime = {};
      }
    });
    
    // Add realistic mouse movements
    await this.addMouseMovements(page);
    
    // Add realistic viewport jitter
    await this.addViewportJitter(page);
    
    // Randomize canvas fingerprint
    await this.randomizeCanvas(page);
    
    // Randomize WebGL fingerprint
    await this.randomizeWebGL(page);
    
    // Override timezone detection
    await this.overrideTimezone(page);
  }
  
  private async addMouseMovements(page: Page): Promise<void> {
    // Simulate natural mouse movements
    const mouse = page.mouse;
    
    // Move mouse in a natural curve pattern
    for (let i = 0; i < 3; i++) {
      const startX = Math.random() * 1920;
      const startY = Math.random() * 1080;
      const endX = Math.random() * 1920;
      const endY = Math.random() * 1080;
      
      // Create bezier curve points
      const steps = 20;
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = startX + (endX - startX) * t + (Math.random() - 0.5) * 10;
        const y = startY + (endY - startY) * t + (Math.random() - 0.5) * 10;
        
        await mouse.move(x, y);
        await this.delay(20 + Math.random() * 30);
      }
      
      await this.delay(100 + Math.random() * 200);
    }
  }
  
  private async addViewportJitter(page: Page): Promise<void> {
    // Slightly adjust viewport to seem more natural
    const viewportSizes = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 }
    ];
    
    const randomViewport = viewportSizes[Math.floor(Math.random() * viewportSizes.length)];
    
    // Add small random adjustments
    randomViewport.width += Math.floor(Math.random() * 10) - 5;
    randomViewport.height += Math.floor(Math.random() * 10) - 5;
    
    await page.setViewportSize(randomViewport);
  }
  
  private async randomizeCanvas(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      // @ts-ignore
      HTMLCanvasElement.prototype.getContext = function(type, attributes) {
        if (type === '2d') {
          const context = originalGetContext.call(this, type, attributes);
          const originalFillText = context.fillText;
          
          // @ts-ignore
          context.fillText = function(...args) {
            // Add tiny random noise to text rendering
            context.shadowBlur = Math.random() * 0.0001;
            return originalFillText.apply(this, args);
          };
          
          return context;
        }
        return originalGetContext.call(this, type, attributes);
      };
    });
  }
  
  private async randomizeWebGL(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      // @ts-ignore
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // Randomize WebGL vendor and renderer
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };
    });
  }
  
  private async overrideTimezone(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // @ts-ignore
      Date.prototype.getTimezoneOffset = function() {
        return 300; // EST timezone offset
      };
      
      // @ts-ignore
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        return {
          timeZone: 'America/New_York',
          locale: 'en-US'
        };
      };
    });
  }
  
  async humanType(page: Page, selector: string, text: string): Promise<void> {
    const element = page.locator(selector);
    await element.click();
    
    // Clear existing text with human-like behavior
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await this.delay(50 + Math.random() * 100);
    
    // Type with variable delays
    for (const char of text) {
      await page.keyboard.type(char);
      
      // Variable typing speed
      const baseDelay = 50;
      const variation = Math.random() * 150;
      
      // Occasionally add longer pauses (thinking)
      const thinkingPause = Math.random() < 0.1 ? 500 + Math.random() * 1000 : 0;
      
      await this.delay(baseDelay + variation + thinkingPause);
    }
  }
  
  async humanScroll(page: Page): Promise<void> {
    const scrolls = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < scrolls; i++) {
      const direction = Math.random() > 0.3 ? 1 : -1; // Mostly scroll down
      const distance = 100 + Math.random() * 300;
      
      await page.mouse.wheel(0, direction * distance);
      await this.delay(500 + Math.random() * 1000);
    }
  }
  
  async randomClick(page: Page): Promise<void> {
    // Perform random clicks on the page (but not on buttons/links)
    const x = Math.random() * 1920;
    const y = Math.random() * 1080;
    
    await page.mouse.click(x, y);
    await this.delay(100 + Math.random() * 200);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Check if we're being detected
   */
  async checkDetection(page: Page): Promise<boolean> {
    // Check for common bot detection elements
    const detectionSelectors = [
      '.cf-browser-verification', // Cloudflare
      '#px-captcha', // PerimeterX
      '.g-recaptcha', // Google reCAPTCHA
      '[id*="captcha"]',
      '[class*="captcha"]',
      '[class*="bot-detection"]',
      'iframe[src*="recaptcha"]',
      'iframe[src*="captcha"]'
    ];
    
    for (const selector of detectionSelectors) {
      const element = await page.locator(selector).count();
      if (element > 0) {
        console.warn(`Bot detection element found: ${selector}`);
        return true;
      }
    }
    
    // Check page title for detection keywords
    const title = await page.title();
    const detectionKeywords = ['blocked', 'denied', 'captcha', 'verify', 'checking your browser'];
    
    for (const keyword of detectionKeywords) {
      if (title.toLowerCase().includes(keyword)) {
        console.warn(`Bot detection keyword in title: ${keyword}`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get browser args for maximum stealth
   */
  getBrowserArgs(): string[] {
    return [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-features=site-per-process',
      '--enable-features=NetworkService',
      '--allow-running-insecure-content',
      '--disable-features=VizDisplayCompositor',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features',
      '--disable-features=BlockInsecurePrivateNetworkRequests'
    ];
  }
}