import * as cheerio from 'cheerio';
import { StatisticsData, StatisticContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class StatisticsExtractor {
  private static readonly STATISTICS_PATTERNS = {
    percentage: {
      pattern: /(\d+(?:\.\d+)?)\s*%/g,
      context: /(?:\w+\s+){0,5}(\d+(?:\.\d+)?)\s*%(?:\s+\w+){0,5}/g,
      validator: (match: RegExpMatchArray) => {
        const num = parseFloat(match[1]);
        return num >= 0 && num <= 100;
      }
    },
    
    currency: {
      usd: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      eur: /€\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      gbp: /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      generic: /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|EUR|GBP|CAD|AUD)/g,
      millions: /\$\s*(\d+(?:\.\d+)?)\s*(?:million|billion|M|B)/gi
    },
    
    comparisons: {
      multiplier: /(\d+(?:\.\d+)?)[xX]\s+(?:faster|slower|better|worse|more|less|higher|lower|bigger|smaller|greater)/gi,
      percentage: /(\d+(?:\.\d+)?)\s*%\s+(?:increase|decrease|growth|decline|rise|fall|improvement|reduction|more|less|higher|lower)/gi,
      relative: /(\d+(?:\.\d+)?)\s+times?\s+(?:more|less|greater|smaller|higher|lower|faster|slower)/gi,
      versus: /(\d+(?:\.\d+)?)\s+(?:vs\.?|versus|compared to)\s+(\d+(?:\.\d+)?)/gi
    },
    
    magnitude: {
      pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(million|billion|thousand|K|M|B|trillion|T)\b/gi,
      converter: {
        'thousand': 1000, 'K': 1000, 'k': 1000,
        'million': 1000000, 'M': 1000000, 'm': 1000000,
        'billion': 1000000000, 'B': 1000000000, 'b': 1000000000,
        'trillion': 1000000000000, 'T': 1000000000000, 't': 1000000000000
      }
    },
    
    temporal: {
      year: /\b(19|20)\d{2}\b/g,
      yearRange: /\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\b/g,
      date: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
      quarter: /Q[1-4]\s+\d{4}/gi,
      month: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi
    },
    
    scientific: {
      pValue: /p\s*[<=>]\s*0\.\d+/gi,
      confidence: /(\d{2,3})\s*%\s*(?:confidence|CI|confidence interval)/gi,
      correlation: /r\s*=\s*[+-]?0\.\d+/gi,
      nValue: /n\s*=\s*\d+/gi,
      significance: /(?:significant at|α\s*=)\s*0\.\d+/gi
    },
    
    rankings: {
      ordinal: /\b(\d+)(?:st|nd|rd|th)\s+(?:place|rank|position|largest|smallest|best|worst)/gi,
      topN: /\btop\s+(\d+)\b/gi,
      ranking: /#(\d+)\s+(?:in|among|of)/gi,
      outOf: /(\d+)\s+(?:out of|of)\s+(\d+)/gi
    },
    
    measurements: {
      metric: /(\d+(?:\.\d+)?)\s*(?:km|m|cm|mm|kg|g|mg|L|ml|°C|°F)/g,
      imperial: /(\d+(?:\.\d+)?)\s*(?:miles?|feet|ft|inches?|in|pounds?|lbs?|oz|gallons?|gal)/gi,
      time: /(\d+(?:\.\d+)?)\s*(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?|ms)/gi,
      data: /(\d+(?:\.\d+)?)\s*(?:GB|MB|KB|TB|gigabytes?|megabytes?|kilobytes?|terabytes?)/gi
    }
  };

  static extract(text: string, html: string): StatisticsData {
    const stats: StatisticsData = {
      count: 0,
      types: {},
      density: 0,
      relevance: 0,
      contexts: []
    };

    try {
      const $ = cheerio.load(html);
      
      // Extract statistics by category
      for (const [category, patterns] of Object.entries(this.STATISTICS_PATTERNS)) {
        stats.types[category] = 0;
        
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern instanceof RegExp) {
            const matches = Array.from(text.matchAll(pattern));
            
            // Validate and process matches
            for (const match of matches) {
              if (this.isValidStatistic(match, type, category)) {
                stats.types[category]++;
                
                // Extract context
                const context = this.extractContext(text, match.index || 0, match[0]);
                const isImportant = this.isImportantStatistic($, match[0], context.fullContext);
                
                stats.contexts.push({
                  match: match[0],
                  context: context.snippet,
                  type: category,
                  isImportant
                });
              }
            }
          }
        }
        
        stats.count += stats.types[category];
      }
      
      // Calculate metrics
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      stats.density = wordCount > 0 ? (stats.count / wordCount) * 100 : 0;
      
      // Calculate relevance based on important statistics
      const importantStats = stats.contexts.filter(ctx => ctx.isImportant).length;
      stats.relevance = stats.count > 0 ? importantStats / stats.count : 0;
      
      logger.debug(`Statistics extraction complete: ${stats.count} statistics found, density: ${stats.density.toFixed(2)}`);
      
    } catch (error) {
      logger.error(`Error extracting statistics: ${error}`);
    }

    return stats;
  }

  private static isValidStatistic(
    match: RegExpMatchArray, 
    type: string, 
    category: string
  ): boolean {
    // Category-specific validation
    if (category === 'percentage') {
      const num = parseFloat(match[1]);
      return num >= 0 && num <= 100;
    }
    
    if (category === 'temporal' && type === 'year') {
      const year = parseInt(match[0]);
      const currentYear = new Date().getFullYear();
      // Reasonable year range
      return year >= 1900 && year <= currentYear + 10;
    }
    
    if (category === 'currency') {
      // Remove commas and validate
      const amount = match[1].replace(/,/g, '');
      const num = parseFloat(amount);
      // Reasonable currency range (not too small or impossibly large)
      return num >= 0.01 && num < 1e15;
    }
    
    if (category === 'rankings' && type === 'ordinal') {
      const rank = parseInt(match[1]);
      // Reasonable ranking
      return rank >= 1 && rank <= 10000;
    }
    
    return true;
  }

  private static extractContext(
    text: string, 
    matchIndex: number, 
    matchText: string
  ): { snippet: string; fullContext: string } {
    const contextRadius = 50;
    const fullContextRadius = 200;
    
    const start = Math.max(0, matchIndex - contextRadius);
    const end = Math.min(text.length, matchIndex + matchText.length + contextRadius);
    
    const fullStart = Math.max(0, matchIndex - fullContextRadius);
    const fullEnd = Math.min(text.length, matchIndex + matchText.length + fullContextRadius);
    
    const snippet = text.substring(start, end).trim();
    const fullContext = text.substring(fullStart, fullEnd);
    
    return { snippet, fullContext };
  }

  private static isImportantStatistic(
    $: cheerio.CheerioAPI, 
    statistic: string, 
    context: string
  ): boolean {
    // Check if statistic appears in important elements
    const importantSelectors = [
      'h1', 'h2', 'h3',
      'strong', 'em', 'b',
      '.highlight', '.important',
      '.statistic', '.fact', '.key-stat',
      '.summary', '.key-takeaway',
      '[class*="stat"]', '[class*="metric"]',
      'mark'
    ];
    
    for (const selector of importantSelectors) {
      const elements = $(selector);
      for (let i = 0; i < elements.length; i++) {
        if ($(elements[i]).text().includes(statistic)) {
          return true;
        }
      }
    }
    
    // Check if it's in a data table
    const inTable = $('table td, table th').filter((_, elem) => 
      $(elem).text().includes(statistic)
    ).length > 0;
    
    if (inTable) return true;
    
    // Check context for importance indicators
    const importanceIndicators = [
      'key finding',
      'significant',
      'important',
      'notable',
      'remarkable',
      'shows that',
      'demonstrates',
      'reveals',
      'indicates',
      'according to'
    ];
    
    const contextLower = context.toLowerCase();
    return importanceIndicators.some(indicator => 
      contextLower.includes(indicator)
    );
  }

  static analyzeStatisticalQuality(stats: StatisticsData): {
    quality: 'high' | 'medium' | 'low';
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    
    // Check variety
    const activeCategories = Object.entries(stats.types)
      .filter(([_, count]) => count > 0)
      .length;
    
    if (activeCategories >= 4) {
      strengths.push('Good variety of statistical types');
    } else if (activeCategories < 2) {
      weaknesses.push('Limited variety of statistics');
      recommendations.push('Include different types of data: percentages, comparisons, and temporal data');
    }
    
    // Check density
    if (stats.density > 2 && stats.density < 5) {
      strengths.push('Optimal statistical density');
    } else if (stats.density < 1) {
      weaknesses.push('Low statistical density');
      recommendations.push('Add more data points to support your claims');
    } else if (stats.density > 8) {
      weaknesses.push('May be overwhelming readers with too many statistics');
      recommendations.push('Consider visualizing some data instead of listing all numbers');
    }
    
    // Check relevance
    if (stats.relevance > 0.3) {
      strengths.push('Statistics are well-emphasized');
    } else {
      weaknesses.push('Statistics lack emphasis');
      recommendations.push('Highlight key statistics using formatting or placement');
    }
    
    // Check for comparisons
    if (stats.types.comparisons && stats.types.comparisons > 0) {
      strengths.push('Includes comparative data');
    } else {
      recommendations.push('Add comparisons to provide context for your statistics');
    }
    
    // Determine overall quality
    let quality: 'high' | 'medium' | 'low';
    if (strengths.length >= 3 && weaknesses.length <= 1) {
      quality = 'high';
    } else if (strengths.length >= weaknesses.length) {
      quality = 'medium';
    } else {
      quality = 'low';
    }
    
    return { quality, strengths, weaknesses, recommendations };
  }

  static formatStatisticsForAI(contexts: StatisticContext[]): string {
    // Format statistics in a way that's optimal for AI consumption
    const formatted = contexts
      .filter(ctx => ctx.isImportant)
      .map(ctx => `• ${ctx.match} (${ctx.type}): ${ctx.context}`)
      .join('\n');
    
    return `Key Statistics:\n${formatted}`;
  }
}
