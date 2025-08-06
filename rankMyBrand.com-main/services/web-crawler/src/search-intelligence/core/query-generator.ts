/**
 * Query Generator
 * Intelligently generates search queries based on brand and context
 */

import { Logger } from '../utils/logger.js';
import {
  QueryGenerationContext,
  GeneratedQuery,
  QueryType
} from '../types/search-intelligence.types.js';

export class QueryGenerator {
  private logger: Logger;
  private queryPatterns: Map<QueryType, string[]>;

  constructor() {
    this.logger = new Logger('QueryGenerator');
    this.initializeQueryPatterns();
  }

  /**
   * Initialize query patterns for different types
   */
  private initializeQueryPatterns(): void {
    this.queryPatterns = new Map([
      [QueryType.BRAND, [
        '{brand}',
        '{brand} reviews',
        '{brand} {industry}',
        'is {brand} good',
        '{brand} customer service',
        '{brand} complaints',
        '{brand} alternatives'
      ]],
      [QueryType.PRODUCT, [
        '{brand} {product}',
        'best {product} {brand}',
        '{brand} {product} review',
        '{brand} {product} price',
        '{brand} {product} features',
        'buy {brand} {product}',
        '{brand} {product} vs'
      ]],
      [QueryType.SERVICE, [
        '{brand} services',
        '{brand} {industry} services',
        'hire {brand}',
        '{brand} pricing',
        '{brand} service areas',
        'how much does {brand} cost',
        '{brand} service reviews'
      ]],
      [QueryType.COMPARISON, [
        '{brand} vs {competitor}',
        '{brand} or {competitor}',
        'compare {brand} and {competitor}',
        '{brand} vs {competitor} {industry}',
        'difference between {brand} and {competitor}',
        '{brand} {competitor} comparison',
        'which is better {brand} or {competitor}'
      ]],
      [QueryType.INFORMATIONAL, [
        'what is {brand}',
        'how does {brand} work',
        '{brand} guide',
        '{brand} tutorial',
        '{brand} FAQ',
        'about {brand}',
        '{brand} history'
      ]],
      [QueryType.TRANSACTIONAL, [
        'buy {brand}',
        '{brand} discount',
        '{brand} coupon',
        '{brand} promo code',
        '{brand} sale',
        '{brand} free trial',
        'sign up {brand}'
      ]],
      [QueryType.LOCAL, [
        '{brand} near me',
        '{brand} {location}',
        '{brand} locations',
        '{brand} store hours',
        '{brand} directions',
        'closest {brand}',
        '{brand} {location} reviews'
      ]]
    ]);
  }

  /**
   * Generate search queries based on context
   */
  async generateQueries(context: QueryGenerationContext): Promise<GeneratedQuery[]> {
    this.logger.info(`Generating queries for ${context.brand}`);
    
    const queries: GeneratedQuery[] = [];
    const usedQueries = new Set(context.previousQueries || []);

    // Generate brand queries (highest priority)
    this.addQueries(queries, QueryType.BRAND, context, usedQueries, 10);

    // Generate product queries if products provided
    if (context.products && context.products.length > 0) {
      for (const product of context.products.slice(0, 3)) { // Limit to top 3 products
        this.addQueries(
          queries,
          QueryType.PRODUCT,
          { ...context, currentProduct: product },
          usedQueries,
          8
        );
      }
    }

    // Generate service queries if it's a service industry
    if (this.isServiceIndustry(context.industry)) {
      this.addQueries(queries, QueryType.SERVICE, context, usedQueries, 7);
    }

    // Generate comparison queries if competitors provided
    if (context.competitors && context.competitors.length > 0) {
      for (const competitor of context.competitors.slice(0, 3)) { // Limit to top 3 competitors
        this.addQueries(
          queries,
          QueryType.COMPARISON,
          { ...context, currentCompetitor: competitor },
          usedQueries,
          9
        );
      }
    }

    // Add informational queries
    this.addQueries(queries, QueryType.INFORMATIONAL, context, usedQueries, 5);

    // Add transactional queries
    this.addQueries(queries, QueryType.TRANSACTIONAL, context, usedQueries, 6);

    // Add local queries if applicable
    if (this.shouldIncludeLocalQueries(context)) {
      this.addQueries(queries, QueryType.LOCAL, context, usedQueries, 4);
    }

    // Sort by priority and limit to top queries
    queries.sort((a, b) => b.priority - a.priority);
    const maxQueries = 20;
    const finalQueries = queries.slice(0, maxQueries);

    // Add some long-tail variations
    const longTailQueries = this.generateLongTailQueries(context, usedQueries);
    finalQueries.push(...longTailQueries.slice(0, Math.max(0, maxQueries - finalQueries.length)));

    this.logger.info(`Generated ${finalQueries.length} queries for ${context.brand}`);
    return finalQueries;
  }

  /**
   * Add queries of a specific type
   */
  private addQueries(
    queries: GeneratedQuery[],
    type: QueryType,
    context: QueryGenerationContext & { currentProduct?: string; currentCompetitor?: string },
    usedQueries: Set<string>,
    basePriority: number
  ): void {
    const patterns = this.queryPatterns.get(type) || [];
    
    for (const pattern of patterns) {
      const query = this.fillPattern(pattern, context);
      
      if (query && !usedQueries.has(query.toLowerCase())) {
        usedQueries.add(query.toLowerCase());
        queries.push({
          query,
          type,
          priority: this.calculatePriority(basePriority, pattern, context),
          expectedIntent: this.getExpectedIntent(type, pattern)
        });
      }
    }
  }

  /**
   * Fill pattern with context values
   */
  private fillPattern(
    pattern: string,
    context: QueryGenerationContext & { currentProduct?: string; currentCompetitor?: string }
  ): string {
    let filled = pattern
      .replace(/{brand}/g, context.brand)
      .replace(/{industry}/g, context.industry || '')
      .replace(/{product}/g, context.currentProduct || '')
      .replace(/{competitor}/g, context.currentCompetitor || '')
      .replace(/{location}/g, context.targetMarket || '');

    // Clean up extra spaces
    filled = filled.replace(/\s+/g, ' ').trim();
    
    // Skip if we have unfilled placeholders
    if (filled.includes('{') && filled.includes('}')) {
      return '';
    }

    return filled;
  }

  /**
   * Calculate query priority based on various factors
   */
  private calculatePriority(
    basePriority: number,
    pattern: string,
    context: QueryGenerationContext
  ): number {
    let priority = basePriority;

    // Boost exact brand match patterns
    if (pattern === '{brand}') {
      priority += 2;
    }

    // Boost patterns with industry relevance
    if (pattern.includes('{industry}') && context.industry) {
      priority += 1;
    }

    // Boost comparison queries if competitors are important
    if (pattern.includes('{competitor}') && context.competitors?.length) {
      priority += 1;
    }

    return Math.min(10, priority);
  }

  /**
   * Get expected user intent for a query pattern
   */
  private getExpectedIntent(type: QueryType, pattern: string): string {
    const intentMap: Record<string, string> = {
      '{brand}': 'Brand discovery and general information',
      '{brand} reviews': 'Evaluating brand reputation and customer satisfaction',
      '{brand} vs {competitor}': 'Comparing options before making a decision',
      'buy {brand}': 'Ready to purchase or sign up',
      'what is {brand}': 'Learning about the brand for the first time',
      '{brand} {product}': 'Researching specific product offerings',
      '{brand} near me': 'Finding local presence or services',
      'is {brand} good': 'Seeking validation before commitment'
    };

    return intentMap[pattern] || `${type} intent`;
  }

  /**
   * Generate long-tail queries based on context
   */
  private generateLongTailQueries(
    context: QueryGenerationContext,
    usedQueries: Set<string>
  ): GeneratedQuery[] {
    const longTailQueries: GeneratedQuery[] = [];
    const templates = [
      'how to choose {brand} for {industry}',
      'why do people use {brand}',
      '{brand} pros and cons',
      'switching to {brand} from {competitor}',
      'getting started with {brand}',
      '{brand} case studies',
      'who uses {brand}',
      '{brand} for small business',
      '{brand} enterprise solutions'
    ];

    for (const template of templates) {
      const query = this.fillPattern(template, context);
      if (query && !usedQueries.has(query.toLowerCase())) {
        longTailQueries.push({
          query,
          type: QueryType.INFORMATIONAL,
          priority: 3,
          expectedIntent: 'In-depth research and evaluation'
        });
      }
    }

    return longTailQueries;
  }

  /**
   * Check if industry is service-based
   */
  private isServiceIndustry(industry?: string): boolean {
    if (!industry) return false;
    
    const serviceIndustries = [
      'consulting', 'agency', 'service', 'contractor', 'freelance',
      'repair', 'maintenance', 'cleaning', 'delivery', 'logistics',
      'healthcare', 'legal', 'accounting', 'design', 'marketing'
    ];

    return serviceIndustries.some(service => 
      industry.toLowerCase().includes(service)
    );
  }

  /**
   * Check if local queries should be included
   */
  private shouldIncludeLocalQueries(context: QueryGenerationContext): boolean {
    // Include if target market is specified
    if (context.targetMarket) return true;

    // Include for certain industries
    const localIndustries = [
      'restaurant', 'retail', 'store', 'clinic', 'gym',
      'salon', 'repair', 'service', 'dealer', 'showroom'
    ];

    return localIndustries.some(industry => 
      context.industry?.toLowerCase().includes(industry) || false
    );
  }

  /**
   * Validate and clean generated queries
   */
  validateQueries(queries: GeneratedQuery[]): GeneratedQuery[] {
    return queries.filter(query => {
      // Remove queries that are too short
      if (query.query.length < 3) return false;
      
      // Remove queries with only stop words
      const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at'];
      const words = query.query.toLowerCase().split(' ');
      if (words.every(word => stopWords.includes(word))) return false;

      return true;
    });
  }
}