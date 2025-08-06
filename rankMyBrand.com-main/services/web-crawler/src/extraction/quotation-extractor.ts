import * as cheerio from 'cheerio';
import { QuotationData, QuoteSource } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class QuotationExtractor {
  private static readonly QUOTATION_PATTERNS = {
    direct: {
      double: /"([^"]{10,500})"/g,
      single: /'([^']{10,500})'/g,
      smart: /["""]([^"""]{10,500})["""]/g,
      multiline: /"([^"]+(?:\n[^"]+)*)"/g,
      curly: /[„""]([^"""]{10,500})["""]/g
    },
    
    block: {
      blockquote: /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      quoteClass: /<(?:p|div|span)[^>]+class="[^"]*(?:quote|quotation|pullquote)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi,
      testimonial: /<(?:div|section)[^>]+class="[^"]*(?:testimonial|review|feedback)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/gi,
      figure: /<figure[^>]*class="[^"]*quote[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi
    },
    
    attributed: {
      dashAuthor: /"([^"]+)"\s*[-—–]\s*([A-Z][^,\n]{2,50})/g,
      saidPattern: /([A-Z][^,]{2,50})\s+(?:said|stated|wrote|explained|noted|added|remarked|commented|observed|mentioned|declared|announced)[^"]*"([^"]+)"/g,
      accordingTo: /According\s+to\s+([^,]+?),?\s*"([^"]+)"/gi,
      colonQuote: /([A-Z][^:]{2,50}):\s*"([^"]+)"/g,
      citedQuote: /"([^"]+)"\s*\(([^)]+)\)/g,
      wrotePattern: /([A-Z][^,]{2,50})\s+writes?[^"]*"([^"]+)"/g,
      asXSaid: /As\s+([^,]+?)\s+(?:said|put it|stated|wrote)[^"]*"([^"]+)"/gi
    },
    
    structured: {
      qAndA: /<(?:dt|strong)[^>]*>(?:Q:|Question:?)[^<]*<\/(?:dt|strong)>\s*<(?:dd|p)[^>]*>([\s\S]*?)<\/(?:dd|p)>/gi,
      interview: /(?:Interviewer|Q|Question):\s*([^?\n]+\?)\s*(?:A|Answer|[A-Z][^:]+):\s*([^?\n]+)/gi
    }
  };

  static extract(text: string, html: string): QuotationData {
    const quotes: QuotationData = {
      count: 0,
      attributed: 0,
      authorityScore: 0,
      sources: [],
      confidence: 0
    };

    try {
      const $ = cheerio.load(html);
      const extractedQuotes = new Set<string>(); // Avoid duplicates
      
      // Extract quotes with attribution first (highest value)
      this.extractAttributedQuotes(text, $, quotes, extractedQuotes);
      
      // Extract block quotes
      this.extractBlockQuotes($, quotes, extractedQuotes);
      
      // Extract direct quotes without attribution
      this.extractDirectQuotes(text, quotes, extractedQuotes);
      
      // Calculate authority score
      if (quotes.sources.length > 0) {
        quotes.authorityScore = quotes.sources.reduce((sum, s) => sum + s.authorityScore, 0) / quotes.sources.length;
      }
      
      // Calculate confidence
      quotes.confidence = this.calculateConfidence(quotes);
      
      logger.debug(`Quotation extraction complete: ${quotes.count} quotes found, ${quotes.attributed} attributed`);
      
    } catch (error) {
      logger.error(`Error extracting quotations: ${error}`);
    }

    return quotes;
  }

  private static extractAttributedQuotes(
    text: string,
    $: cheerio.CheerioAPI,
    quotes: QuotationData,
    extractedQuotes: Set<string>
  ): void {
    // Process each attribution pattern
    for (const [type, pattern] of Object.entries(this.QUOTATION_PATTERNS.attributed)) {
      if (pattern instanceof RegExp) {
        const matches = Array.from(text.matchAll(new RegExp(pattern.source, pattern.flags)));
        
        for (const match of matches) {
          let quote: string;
          let author: string;
          
          // Handle different match patterns
          if (type === 'dashAuthor' || type === 'citedQuote') {
            quote = match[1];
            author = match[2];
          } else {
            // Most patterns have author first, then quote
            author = match[1];
            quote = match[2];
          }
          
          // Clean and validate
          quote = this.cleanQuote(quote);
          author = this.cleanAuthor(author);
          
          if (this.isValidQuote(quote) && !extractedQuotes.has(quote)) {
            extractedQuotes.add(quote);
            quotes.count++;
            quotes.attributed++;
            
            const authorityScore = this.assessAuthorAuthority(author, $, text);
            quotes.sources.push({
              quote: this.truncateQuote(quote),
              author,
              authorityScore,
              type: 'attributed'
            });
          }
        }
      }
    }
  }

  private static extractBlockQuotes(
    $: cheerio.CheerioAPI,
    quotes: QuotationData,
    extractedQuotes: Set<string>
  ): void {
    // Extract from blockquote elements
    $('blockquote, .quote, .quotation, .pullquote, .testimonial').each((_, elem) => {
      const $elem = $(elem);
      let quoteText = $elem.text().trim();
      
      // Look for citation within or near the blockquote
      let cite = '';
      
      // Check for cite element
      const $cite = $elem.find('cite, .cite, .attribution, .author');
      if ($cite.length > 0) {
        cite = $cite.text().trim();
        // Remove citation from quote text
        quoteText = quoteText.replace(cite, '').trim();
      }
      
      // Check for cite attribute
      if (!cite && $elem.attr('cite')) {
        cite = $elem.attr('cite') || '';
      }
      
      // Check for adjacent citation
      if (!cite) {
        const $next = $elem.next();
        if ($next.is('cite, .cite, .attribution, p.attribution')) {
          cite = $next.text().trim();
        }
      }
      
      quoteText = this.cleanQuote(quoteText);
      
      if (this.isValidQuote(quoteText) && !extractedQuotes.has(quoteText)) {
        extractedQuotes.add(quoteText);
        quotes.count++;
        
        if (cite) {
          quotes.attributed++;
          quotes.sources.push({
            quote: this.truncateQuote(quoteText),
            author: this.cleanAuthor(cite),
            authorityScore: this.assessAuthorAuthority(cite, $, $elem.html() || ''),
            type: 'block'
          });
        } else {
          quotes.sources.push({
            quote: this.truncateQuote(quoteText),
            author: '',
            authorityScore: 0,
            type: 'block'
          });
        }
      }
    });
  }

  private static extractDirectQuotes(
    text: string,
    quotes: QuotationData,
    extractedQuotes: Set<string>
  ): void {
    // Extract unattributed direct quotes
    for (const [type, pattern] of Object.entries(this.QUOTATION_PATTERNS.direct)) {
      if (pattern instanceof RegExp) {
        const matches = Array.from(text.matchAll(pattern));
        
        for (const match of matches) {
          const quote = this.cleanQuote(match[1]);
          
          if (this.isValidQuote(quote) && !extractedQuotes.has(quote)) {
            extractedQuotes.add(quote);
            quotes.count++;
            
            // Try to find nearby attribution
            const attribution = this.findNearbyAttribution(text, match.index || 0, quote);
            
            if (attribution) {
              quotes.attributed++;
              quotes.sources.push({
                quote: this.truncateQuote(quote),
                author: attribution,
                authorityScore: 30, // Lower score for inferred attribution
                type: 'attributed'
              });
            }
          }
        }
      }
    }
  }

  private static cleanQuote(quote: string): string {
    return quote
      .replace(/\s+/g, ' ')
      .replace(/^["'"'"]|["'"'"]$/g, '')
      .trim();
  }

  private static cleanAuthor(author: string): string {
    return author
      .replace(/\s+/g, ' ')
      .replace(/^[-—–\s]+|[-—–\s]+$/g, '')
      .replace(/\([^)]+\)$/, '') // Remove trailing parentheses
      .trim();
  }

  private static isValidQuote(quote: string): boolean {
    // Minimum length
    if (quote.length < 10 || quote.length > 500) {
      return false;
    }
    
    // Should contain actual words
    const wordCount = quote.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 3) {
      return false;
    }
    
    // Filter out code or technical strings
    if (/^[a-z_]+$|^\W+$|^[\d\s]+$/.test(quote)) {
      return false;
    }
    
    // Filter out likely false positives
    const falsePositivePatterns = [
      /^(yes|no|okay|ok|sure|maybe|perhaps)$/i,
      /^(click here|read more|learn more|see more)$/i,
      /^https?:\/\//,
      /^[A-Z]{2,}$/, // All caps abbreviations
      /^\d+$/ // Just numbers
    ];
    
    return !falsePositivePatterns.some(pattern => pattern.test(quote));
  }

  private static truncateQuote(quote: string, maxLength: number = 100): string {
    if (quote.length <= maxLength) {
      return quote;
    }
    return quote.substring(0, maxLength) + '...';
  }

  private static assessAuthorAuthority(
    author: string, 
    $: cheerio.CheerioAPI,
    context: string
  ): number {
    let score = 50; // Base score
    
    // Check for credentials in author string
    const credentials = /(?:Dr\.?|Professor|Prof\.?|PhD|Ph\.D|M\.?D\.?|CEO|President|Director|Founder|Chairman|SVP|VP|CTO|CFO|CMO)/i;
    if (credentials.test(author)) {
      score += 20;
    }
    
    // Check for organization mentions
    const organizations = /(?:University|Institute|Corporation|Inc\.?|Ltd\.?|Foundation|Academy|College|School|Hospital|Center|Centre|Association|Society)/i;
    if (organizations.test(author)) {
      score += 15;
    }
    
    // Check for professional titles
    const titles = /(?:researcher|scientist|analyst|expert|specialist|consultant|advisor|author|journalist|reporter|editor)/i;
    if (titles.test(author)) {
      score += 10;
    }
    
    // Check if author appears multiple times in the document
    const authorLastName = author.split(' ').pop() || '';
    if (authorLastName.length > 2) {
      const mentions = (context.match(new RegExp(authorLastName, 'gi')) || []).length;
      if (mentions > 3) {
        score += 10;
      }
    }
    
    // Check for author bio or description nearby
    const $authorElements = $(`[class*="author"], [class*="bio"], [id*="author"]`);
    if ($authorElements.text().includes(authorLastName)) {
      score += 5;
    }
    
    return Math.min(score, 100);
  }

  private static findNearbyAttribution(
    text: string, 
    quoteIndex: number, 
    quote: string
  ): string | null {
    // Look for attribution within 100 characters before or after the quote
    const searchRadius = 100;
    const before = text.substring(Math.max(0, quoteIndex - searchRadius), quoteIndex);
    const after = text.substring(quoteIndex + quote.length, quoteIndex + quote.length + searchRadius);
    
    // Patterns for nearby attribution
    const attributionPatterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+)(?:\s+said|\s+wrote|\s+stated)/,
      /(?:said|wrote|stated|according to)\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
      /[-—]\s*([A-Z][a-z]+ [A-Z][a-z]+)$/,
      /^([A-Z][a-z]+ [A-Z][a-z]+)\s*[-—]/
    ];
    
    // Check before text
    for (const pattern of attributionPatterns) {
      const match = before.match(pattern);
      if (match && match[1]) {
        return this.cleanAuthor(match[1]);
      }
    }
    
    // Check after text
    for (const pattern of attributionPatterns) {
      const match = after.match(pattern);
      if (match && match[1]) {
        return this.cleanAuthor(match[1]);
      }
    }
    
    return null;
  }

  private static calculateConfidence(quotes: QuotationData): number {
    let confidence = 0;
    
    // Base confidence from having quotes
    if (quotes.count > 0) {
      confidence += 0.2;
    }
    
    // Attribution rate
    const attributionRate = quotes.count > 0 ? quotes.attributed / quotes.count : 0;
    confidence += attributionRate * 0.4;
    
    // Authority score contribution
    const normalizedAuthority = quotes.authorityScore / 100;
    confidence += normalizedAuthority * 0.3;
    
    // Variety bonus
    const hasBlockQuotes = quotes.sources.some(s => s.type === 'block');
    const hasAttributedQuotes = quotes.sources.some(s => s.type === 'attributed');
    if (hasBlockQuotes && hasAttributedQuotes) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1);
  }

  static analyzeQuotationQuality(quotes: QuotationData): {
    quality: 'high' | 'medium' | 'low';
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check quote count
    if (quotes.count === 0) {
      issues.push('No quotes found');
      suggestions.push('Add expert quotes or testimonials to build credibility');
    } else if (quotes.count === 1) {
      suggestions.push('Consider adding more quotes for better authority');
    }
    
    // Check attribution
    if (quotes.count > 0 && quotes.attributed === 0) {
      issues.push('No quotes have attribution');
      suggestions.push('Always attribute quotes to their sources');
    } else if (quotes.attributed < quotes.count * 0.8) {
      issues.push('Many quotes lack attribution');
      suggestions.push('Add author names and credentials to unattributed quotes');
    }
    
    // Check authority
    if (quotes.authorityScore < 50 && quotes.count > 0) {
      issues.push('Quote sources lack authority indicators');
      suggestions.push('Include quotes from recognized experts with titles or affiliations');
    }
    
    // Determine quality
    let quality: 'high' | 'medium' | 'low';
    if (quotes.count >= 2 && quotes.attributed === quotes.count && quotes.authorityScore >= 70) {
      quality = 'high';
    } else if (quotes.count > 0 && quotes.attributed > 0) {
      quality = 'medium';
    } else {
      quality = 'low';
    }
    
    return { quality, issues, suggestions };
  }
}
