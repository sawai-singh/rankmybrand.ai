import * as cheerio from 'cheerio';
import { RenderDecision } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class RenderingDecider {
  private static readonly JS_INDICATORS = {
    reactApp: /<div id="root">\s*<\/div>|__REACT_|_app-\w+\.js|React\.createElement/i,
    vueApp: /<div id="app">\s*<\/div>|Vue\.use|new Vue\(|v-if=|v-for=/i,
    angularApp: /<app-root>|ng-version=|angular\.js|ng-app=/i,
    nextJS: /_next\/static|__NEXT_DATA__|next\.config\.js/i,
    nuxtJS: /_nuxt\/|window\.__NUXT__|nuxt\.config\.js/i,
    gatsby: /___gatsby|gatsby-script|gatsby-link/i,
    svelteKit: /__sveltekit|\.svelte-kit/i,
    lazyLoad: /data-src=|lazy-load|loading="lazy"|data-lazy|lozad/i,
    infiniteScroll: /infinite-scroll|load-more|IntersectionObserver|waypoint/i,
    clientRouting: /react-router|vue-router|angular\/router|router-link/i,
    dynamicContent: /ajax|XMLHttpRequest|fetch\(|axios|superagent/i,
    jsonLd: /<script[^>]+type="application\/ld\+json"[^>]*>\s*<\/script>/i,
    emptyContent: /<(main|article|section)[^>]*>\s*<\/(main|article|section)>/i
  };

  private static readonly CONTENT_SELECTORS = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    '#main-content',
    '.main-content',
    '[data-testid="article-body"]',
    '.article-body',
    '.post-content'
  ];

  static async needsJavaScript(
    url: string, 
    headers: Record<string, string>, 
    initialHTML: string
  ): Promise<RenderDecision> {
    try {
      // Quick check: API response
      if (headers['content-type']?.includes('application/json')) {
        return { needs: true, reason: 'json-api-response' };
      }

      // Quick check: Very small HTML (likely a shell)
      if (initialHTML.length < 1000 && !initialHTML.includes('<article')) {
        return { needs: true, reason: 'minimal-html-shell' };
      }

      // Check for JavaScript framework indicators
      for (const [framework, pattern] of Object.entries(this.JS_INDICATORS)) {
        if (pattern.test(initialHTML)) {
          logger.debug(`Detected ${framework} on ${url}`);
          
          // Special handling for certain frameworks
          if (framework === 'jsonLd' && this.hasContentBesideJsonLd(initialHTML)) {
            continue; // JSON-LD alone doesn't require JS rendering if content exists
          }
          
          if (framework === 'lazyLoad' && this.hasInitialContent(initialHTML)) {
            continue; // Lazy loading with initial content might not need JS
          }
          
          return { needs: true, reason: framework };
        }
      }

      // Load HTML with cheerio for deeper analysis
      const $ = cheerio.load(initialHTML);

      // Check if main content is present
      const hasContent = this.hasSubstantialContent($);
      if (!hasContent) {
        // Check for loading indicators
        const loadingIndicators = [
          '.loading',
          '.spinner',
          '[class*="load"]',
          '[class*="spinner"]',
          '.skeleton',
          '[class*="skeleton"]'
        ];
        
        const hasLoadingIndicator = loadingIndicators.some(selector => $(selector).length > 0);
        if (hasLoadingIndicator) {
          return { needs: true, reason: 'loading-indicator' };
        }

        // Check for "app" containers that might be populated by JS
        const appContainers = ['#app', '#root', '.app-container', '[id*="app"]'];
        const hasEmptyAppContainer = appContainers.some(selector => {
          const element = $(selector);
          return element.length > 0 && element.text().trim().length < 50;
        });
        
        if (hasEmptyAppContainer) {
          return { needs: true, reason: 'empty-app-container' };
        }

        return { needs: true, reason: 'no-substantial-content' };
      }

      // Check for client-side data attributes
      const hasClientData = $('[data-react-props], [data-vue-props], [data-component]').length > 0;
      if (hasClientData && !hasContent) {
        return { needs: true, reason: 'client-side-data' };
      }

      // Check meta tags for hints
      const metaGenerator = $('meta[name="generator"]').attr('content')?.toLowerCase() || '';
      const requiresJsFrameworks = ['gatsby', 'next.js', 'nuxt.js', 'create-react-app'];
      if (requiresJsFrameworks.some(fw => metaGenerator.includes(fw))) {
        return { needs: true, reason: `meta-generator-${metaGenerator}` };
      }

      // URL patterns that often require JS
      const urlPatterns = [
        /\/app\//,
        /\/dashboard/,
        /\/admin/,
        /\#\//,  // Hash routing
        /\/spa\//  // Single Page App indicator
      ];
      
      if (urlPatterns.some(pattern => pattern.test(url))) {
        return { needs: true, reason: 'url-pattern-suggests-spa' };
      }

      // If we have substantial content, we probably don't need JS
      return { needs: false, reason: null };

    } catch (error) {
      logger.error(`Error in rendering decision for ${url}: ${error}`);
      // Default to static rendering on error
      return { needs: false, reason: 'error-default-static' };
    }
  }

  private static hasSubstantialContent($: cheerio.CheerioAPI): boolean {
    // Check each content selector
    for (const selector of this.CONTENT_SELECTORS) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        
        // Consider it substantial if we have at least 100 words
        if (wordCount >= 100) {
          return true;
        }

        // Or if we have multiple paragraphs
        const paragraphs = element.find('p').length;
        if (paragraphs >= 3) {
          return true;
        }

        // Or if we have structured content
        const hasStructuredContent = 
          element.find('h1, h2, h3').length > 0 &&
          element.find('p, li').length > 5;
        
        if (hasStructuredContent) {
          return true;
        }
      }
    }

    // Check for article-specific indicators
    const hasArticleIndicators = 
      $('meta[property="article:published_time"]').length > 0 ||
      $('[itemprop="articleBody"]').length > 0 ||
      $('.post-content, .entry-content').text().trim().length > 200;

    return hasArticleIndicators;
  }

  private static hasContentBesideJsonLd(html: string): boolean {
    // Remove JSON-LD scripts and check remaining content
    const htmlWithoutJsonLd = html.replace(/<script[^>]+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '');
    const textContent = htmlWithoutJsonLd.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return textContent.length > 500;
  }

  private static hasInitialContent(html: string): boolean {
    // Quick check for initial content presence
    const $ = cheerio.load(html);
    const visibleText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = visibleText.split(/\s+/).length;
    return wordCount > 200;
  }

  static shouldRetryWithJS(
    html: string, 
    expectedContent?: { 
      minWords?: number; 
      requiredSelectors?: string[] 
    }
  ): boolean {
    const $ = cheerio.load(html);
    
    // Check word count if specified
    if (expectedContent?.minWords) {
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const wordCount = text.split(/\s+/).length;
      if (wordCount < expectedContent.minWords) {
        return true;
      }
    }

    // Check required selectors if specified
    if (expectedContent?.requiredSelectors) {
      for (const selector of expectedContent.requiredSelectors) {
        if ($(selector).length === 0) {
          return true;
        }
      }
    }

    // Check for error indicators that might need JS
    const errorIndicators = [
      'Enable JavaScript',
      'JavaScript is disabled',
      'Please enable JavaScript',
      'requires JavaScript',
      'noscript'
    ];

    const bodyText = $('body').text();
    return errorIndicators.some(indicator => 
      bodyText.toLowerCase().includes(indicator.toLowerCase())
    );
  }
}
