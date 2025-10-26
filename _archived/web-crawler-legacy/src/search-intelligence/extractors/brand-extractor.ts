/**
 * Brand Extractor
 * Extract brand and product information from crawled pages
 */

import { Logger } from '../../utils/logger.js';

export interface BrandInfo {
  brand: string;
  products: string[];
  industry?: string;
  tagline?: string;
  competitors: string[];
  keywords: string[];
}

export class BrandExtractor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('BrandExtractor');
  }

  /**
   * Extract brand information from page content
   */
  async extractBrandInfo(
    content: string,
    metadata: any,
    domain: string
  ): Promise<BrandInfo> {
    const brand = this.extractBrandName(content, metadata, domain);
    const products = this.extractProducts(content, metadata);
    const industry = this.extractIndustry(content, metadata);
    const tagline = this.extractTagline(content, metadata);
    const competitors = this.extractCompetitors(content);
    const keywords = this.extractKeywords(content, metadata);

    return {
      brand,
      products,
      industry,
      tagline,
      competitors,
      keywords
    };
  }

  /**
   * Extract brand name
   */
  private extractBrandName(content: string, metadata: any, domain: string): string {
    // Try metadata first
    if (metadata.ogSiteName) {
      return metadata.ogSiteName;
    }

    if (metadata.applicationName) {
      return metadata.applicationName;
    }

    // Try to extract from title
    if (metadata.title) {
      const titleParts = metadata.title.split(/[-|•·]/);
      if (titleParts.length > 1) {
        // Often the brand is the last part
        const lastPart = titleParts[titleParts.length - 1].trim();
        if (lastPart.length < 30) {
          return lastPart;
        }
      }
    }

    // Try to extract from domain
    const domainParts = domain.split('.');
    if (domainParts.length > 0) {
      const brandFromDomain = domainParts[0]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return brandFromDomain;
    }

    return domain;
  }

  /**
   * Extract product names
   */
  private extractProducts(content: string, metadata: any): string[] {
    const products = new Set<string>();

    // Common product patterns
    const productPatterns = [
      /(?:our|the)\s+(\w+(?:\s+\w+){0,2})\s+(?:product|service|solution|platform|app|software|tool)/gi,
      /(?:introducing|announcing|launch(?:ing)?)\s+(\w+(?:\s+\w+){0,2})/gi,
      /(\w+(?:\s+\w+){0,2})\s+(?:™|®|©)/g,
      /(?:try|get|download|buy)\s+(\w+(?:\s+\w+){0,2})\s+(?:now|today|free)/gi
    ];

    productPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2 && match[1].length < 30) {
          products.add(match[1].trim());
        }
      }
    });

    // Check schema.org Product data
    const schemaProducts = this.extractSchemaProducts(content);
    schemaProducts.forEach(p => products.add(p));

    // Filter out common words
    const commonWords = new Set(['the', 'our', 'your', 'this', 'that', 'these', 'those']);
    return Array.from(products)
      .filter(p => !commonWords.has(p.toLowerCase()))
      .slice(0, 10);
  }

  /**
   * Extract industry/category
   */
  private extractIndustry(content: string, metadata: any): string | undefined {
    // Check metadata
    if (metadata.category) {
      return metadata.category;
    }

    // Industry keywords mapping
    const industryKeywords: Record<string, string[]> = {
      'Technology': ['software', 'app', 'platform', 'digital', 'tech', 'IT', 'cloud', 'SaaS'],
      'E-commerce': ['shop', 'store', 'buy', 'cart', 'checkout', 'products', 'marketplace'],
      'Finance': ['financial', 'banking', 'investment', 'trading', 'fintech', 'payment'],
      'Healthcare': ['health', 'medical', 'patient', 'clinic', 'hospital', 'wellness'],
      'Education': ['learn', 'course', 'education', 'training', 'tutorial', 'academy'],
      'Marketing': ['marketing', 'advertising', 'SEO', 'campaign', 'promotion', 'brand'],
      'Real Estate': ['property', 'real estate', 'housing', 'apartment', 'rental'],
      'Travel': ['travel', 'booking', 'hotel', 'flight', 'vacation', 'tourism'],
      'Food & Beverage': ['food', 'restaurant', 'delivery', 'cuisine', 'dining', 'meal'],
      'Entertainment': ['movie', 'music', 'game', 'entertainment', 'streaming', 'media']
    };

    const contentLower = content.toLowerCase();
    let bestMatch = { industry: '', score: 0 };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      let score = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          score += matches.length;
        }
      });

      if (score > bestMatch.score) {
        bestMatch = { industry, score };
      }
    }

    return bestMatch.score > 3 ? bestMatch.industry : undefined;
  }

  /**
   * Extract tagline or slogan
   */
  private extractTagline(content: string, metadata: any): string | undefined {
    // Check metadata
    if (metadata.description && metadata.description.length < 100) {
      return metadata.description;
    }

    // Look for tagline patterns
    const taglinePatterns = [
      /<(?:h1|h2)[^>]*>([^<]+)<\/(?:h1|h2)>/i,
      /class="tagline"[^>]*>([^<]+)</i,
      /class="slogan"[^>]*>([^<]+)</i,
      /class="hero-text"[^>]*>([^<]+)</i
    ];

    for (const pattern of taglinePatterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].length < 100) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract potential competitors
   */
  private extractCompetitors(content: string): string[] {
    const competitors = new Set<string>();

    // Competitor mention patterns
    const patterns = [
      /(?:vs\.?|versus|compared to|alternative to|competitor|unlike)\s+(\w+(?:\s+\w+){0,2})/gi,
      /(\w+(?:\s+\w+){0,2})\s+(?:vs\.?|versus)\s+(?:us|our)/gi,
      /better than\s+(\w+(?:\s+\w+){0,2})/gi,
      /switch from\s+(\w+(?:\s+\w+){0,2})/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2 && match[1].length < 30) {
          const competitor = match[1].trim();
          // Filter out generic words
          if (!/^(the|our|your|them|other|another)$/i.test(competitor)) {
            competitors.add(competitor);
          }
        }
      }
    });

    return Array.from(competitors).slice(0, 5);
  }

  /**
   * Extract important keywords
   */
  private extractKeywords(content: string, metadata: any): string[] {
    const keywords = new Set<string>();

    // Get meta keywords
    if (metadata.keywords) {
      metadata.keywords.split(',').forEach((kw: string) => {
        keywords.add(kw.trim());
      });
    }

    // Extract from headings
    const headingRegex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
    const headings = content.matchAll(headingRegex);
    for (const match of headings) {
      const words = match[1].split(/\s+/)
        .filter(w => w.length > 3 && !/^(the|and|for|with|from)$/i.test(w));
      words.forEach(w => keywords.add(w.toLowerCase()));
    }

    // Extract emphasized words
    const emphasisRegex = /<(?:strong|b|em)[^>]*>([^<]+)<\/(?:strong|b|em)>/gi;
    const emphasized = content.matchAll(emphasisRegex);
    for (const match of emphasized) {
      const words = match[1].split(/\s+/)
        .filter(w => w.length > 3);
      words.forEach(w => keywords.add(w.toLowerCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }

  /**
   * Extract schema.org Product data
   */
  private extractSchemaProducts(content: string): string[] {
    const products: string[] = [];

    try {
      // Look for JSON-LD schema
      const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      const matches = content.matchAll(jsonLdRegex);

      for (const match of matches) {
        try {
          const data = JSON.parse(match[1]);
          
          // Handle single product
          if (data['@type'] === 'Product' && data.name) {
            products.push(data.name);
          }
          
          // Handle product list
          if (Array.isArray(data)) {
            data.forEach(item => {
              if (item['@type'] === 'Product' && item.name) {
                products.push(item.name);
              }
            });
          }
          
          // Handle graph structure
          if (data['@graph'] && Array.isArray(data['@graph'])) {
            data['@graph'].forEach((item: any) => {
              if (item['@type'] === 'Product' && item.name) {
                products.push(item.name);
              }
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    } catch (error) {
      this.logger.debug('Error extracting schema products:', error);
    }

    return products;
  }
}