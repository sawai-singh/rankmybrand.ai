import * as cheerio from 'cheerio';
import { CitationData } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class CitationExtractor {
  private static readonly CITATION_PATTERNS = {
    // Academic citations
    numeric: {
      inline: /\[(\d+)\]/g,
      superscript: /<sup>(\d+)<\/sup>/g,
      parenthetical: /\((\d+)\)/g
    },
    
    // Author-year citations
    authorYear: {
      standard: /\(([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*),?\s*(\d{4})\)/g,
      etAl: /\(([A-Z][a-z]+\s+et\s+al\.,?\s*\d{4})\)/g,
      multipleAuthors: /\(([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)*)\s*,?\s*(\d{4})\)/g,
      harvardStyle: /([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*)\s+\((\d{4})\)/g
    },
    
    // Web citations
    links: {
      footnote: /<a[^>]+href="#fn-?\d+"[^>]*>.*?<\/a>/gi,
      reference: /<a[^>]+class="[^"]*(?:citation|reference|cite|ref)[^"]*"[^>]*>.*?<\/a>/gi,
      sourceLink: /<a[^>]+(?:title|data-citation)="[^"]*(?:source|citation|reference)[^"]*"[^>]*>.*?<\/a>/gi
    },
    
    // Reference sections
    bibliography: {
      section: /<(?:div|section)[^>]*(?:class|id)="[^"]*(?:references?|bibliography|citations?|works-cited|sources)[^"]*"[^>]*>[\s\S]*?<\/(?:div|section)>/gi,
      list: /<(?:ol|ul)[^>]*(?:class|id)="[^"]*(?:references?|citations?|bibliography)[^"]*"[^>]*>[\s\S]*?<\/(?:ol|ul)>/gi,
      heading: /<h[1-6][^>]*>(?:References?|Bibliography|Works Cited|Sources|Citations?)<\/h[1-6]>/gi
    },

    // Inline citations
    inline: {
      source: /\((?:Source|Quelle|Fonte):\s*[^)]+\)/gi,
      accordingTo: /(?:According to|As per|Per)\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|\w+(?:\s+\w+)*)\s*(?:\(\d{4}\))?/gi,
      citedIn: /(?:cited in|quoted in|as cited in)\s+[^,.]+(?:\s*\(\d{4}\))?/gi
    }
  };

  static extract(html: string, text: string): CitationData {
    const citations: CitationData = {
      count: 0,
      types: {},
      density: 0,
      hasReferenceSection: false,
      confidence: 0
    };

    try {
      // Extract from HTML structure
      const $ = cheerio.load(html);
      
      // Check for reference section
      citations.hasReferenceSection = this.hasReferenceSection($);
      
      // Count different citation types
      for (const [type, patterns] of Object.entries(this.CITATION_PATTERNS)) {
        citations.types[type] = 0;
        
        if (type === 'bibliography') {
          // Special handling for bibliography sections
          if (citations.hasReferenceSection) {
            const refCount = this.countReferencesInSection($);
            citations.types[type] = refCount;
          }
        } else {
          // Count pattern matches
          for (const [subtype, pattern] of Object.entries(patterns)) {
            if (pattern instanceof RegExp) {
              const matches = text.match(pattern) || [];
              
              // Filter out false positives
              const validMatches = this.filterFalsePositives(matches, subtype, text);
              citations.types[type] += validMatches.length;
            }
          }
        }
        
        citations.count += citations.types[type];
      }
      
      // Calculate density per 100 words
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      citations.density = wordCount > 0 ? (citations.count / wordCount) * 100 : 0;
      
      // Calculate confidence based on variety and structure
      citations.confidence = this.calculateConfidence(citations);
      
      // Log extraction results
      logger.debug(`Citation extraction complete: ${citations.count} citations found, density: ${citations.density.toFixed(2)}`);
      
    } catch (error) {
      logger.error(`Error extracting citations: ${error}`);
    }

    return citations;
  }

  private static hasReferenceSection($: cheerio.CheerioAPI): boolean {
    // Check for reference section by various indicators
    const referenceSelectors = [
      '[class*="reference"]',
      '[id*="reference"]',
      '[class*="bibliography"]',
      '[id*="bibliography"]',
      '.citations',
      '#citations',
      '.works-cited',
      '.sources'
    ];
    
    // Check if any reference selector exists
    for (const selector of referenceSelectors) {
      if ($(selector).length > 0) {
        return true;
      }
    }
    
    // Check for reference headings
    const headingTexts = ['references', 'bibliography', 'works cited', 'sources', 'citations'];
    let hasReferenceHeading = false;
    
    $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
      const text = $(elem).text().toLowerCase().trim();
      if (headingTexts.some(ref => text.includes(ref))) {
        hasReferenceHeading = true;
        return false; // Break the loop
      }
    });
    
    return hasReferenceHeading;
  }

  private static countReferencesInSection($: cheerio.CheerioAPI): number {
    let count = 0;
    
    // Find reference sections
    const referenceSections = $(
      '.references, #references, .bibliography, #bibliography, ' +
      '[class*="reference-list"], [class*="citation-list"]'
    );
    
    if (referenceSections.length > 0) {
      // Count list items in reference sections
      count += referenceSections.find('li').length;
      
      // Count paragraphs that look like references (if not in a list)
      if (count === 0) {
        referenceSections.find('p').each((_, elem) => {
          const text = $(elem).text();
          // Check if paragraph looks like a reference (has year in parentheses)
          if (/\(\d{4}\)|\d{4}\./.test(text)) {
            count++;
          }
        });
      }
    }
    
    // If still no references found, look for numbered references
    if (count === 0) {
      const numberedRefs = $('p, li').filter((_, elem) => {
        const text = $(elem).text().trim();
        return /^\[\d+\]|^\d+\.|^\(\d+\)/.test(text);
      });
      count = numberedRefs.length;
    }
    
    return count;
  }

  private static filterFalsePositives(
    matches: RegExpMatchArray, 
    subtype: string, 
    context: string
  ): string[] {
    return matches.filter(match => {
      // Filter out common false positives
      
      // For numeric citations, avoid matches that are clearly not citations
      if (subtype === 'inline' || subtype === 'parenthetical') {
        const num = parseInt(match.replace(/\D/g, ''));
        // Likely not a citation if number is too large or in certain contexts
        if (num > 200) return false;
        
        // Check surrounding context
        const index = context.indexOf(match);
        const before = context.substring(Math.max(0, index - 20), index).toLowerCase();
        const after = context.substring(index + match.length, index + match.length + 20).toLowerCase();
        
        // Skip if it's likely a year, price, or measurement
        if (before.includes('$') || before.includes('€') || before.includes('£')) return false;
        if (after.includes('px') || after.includes('em') || after.includes('%')) return false;
        if (before.includes('chapter') || before.includes('section')) return false;
      }
      
      // For author-year citations, ensure it's not just a company name with year
      if (subtype === 'standard' || subtype === 'harvardStyle') {
        // Check if it's likely a company/product name
        const corporateIndicators = ['Inc', 'Corp', 'LLC', 'Ltd', 'Company', 'Microsoft', 'Google', 'Apple'];
        if (corporateIndicators.some(indicator => match.includes(indicator))) {
          return false;
        }
      }
      
      return true;
    });
  }

  private static calculateConfidence(citations: CitationData): number {
    let confidence = 0;
    
    // Base confidence from having a reference section
    if (citations.hasReferenceSection) {
      confidence += 0.4;
    }
    
    // Variety of citation types
    const activeTypes = Object.entries(citations.types)
      .filter(([_, count]) => count > 0)
      .length;
    const typeVarietyScore = Math.min(activeTypes / 4, 0.3); // Max 0.3 for variety
    confidence += typeVarietyScore;
    
    // Density score
    if (citations.density > 0.5 && citations.density < 5) {
      // Reasonable citation density
      confidence += 0.2;
    } else if (citations.density > 0.1) {
      // Some citations present
      confidence += 0.1;
    }
    
    // Consistency check
    if (citations.hasReferenceSection && citations.count > 5) {
      // Has both inline citations and reference section
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1);
  }

  static extractDetailedCitations(html: string): {
    citations: Array<{
      text: string;
      type: string;
      context: string;
    }>;
    references: Array<{
      text: string;
      authors: string[];
      year?: string;
      title?: string;
    }>;
  } {
    const $ = cheerio.load(html);
    const detailed = {
      citations: [] as any[],
      references: [] as any[]
    };

    // Extract inline citations with context
    $('p, li').each((_, elem) => {
      const text = $(elem).text();
      
      // Check for numeric citations
      const numericMatches = text.matchAll(/\[(\d+)\]/g);
      for (const match of numericMatches) {
        const index = text.indexOf(match[0]);
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(text.length, index + match[0].length + 50);
        
        detailed.citations.push({
          text: match[0],
          type: 'numeric',
          context: text.substring(contextStart, contextEnd)
        });
      }
    });

    // Extract references from reference section
    const refSection = $('.references, #references, .bibliography, #bibliography');
    if (refSection.length > 0) {
      refSection.find('li, p').each((_, elem) => {
        const refText = $(elem).text().trim();
        if (refText.length > 20) { // Likely a reference
          const reference = this.parseReference(refText);
          if (reference) {
            detailed.references.push(reference);
          }
        }
      });
    }

    return detailed;
  }

  private static parseReference(text: string): any {
    // Simple reference parser
    const reference: any = { text };
    
    // Extract year
    const yearMatch = text.match(/\((\d{4})\)|\b(\d{4})\b\./);
    if (yearMatch) {
      reference.year = yearMatch[1] || yearMatch[2];
    }
    
    // Extract authors (simplified)
    const authorsMatch = text.match(/^([^.]+?)(?:\s*\(\d{4}\)|\s*\d{4})/);
    if (authorsMatch) {
      reference.authors = authorsMatch[1]
        .split(/,|&|and/)
        .map(author => author.trim())
        .filter(author => author.length > 0);
    }
    
    return reference;
  }
}
