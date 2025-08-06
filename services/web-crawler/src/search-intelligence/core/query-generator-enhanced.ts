/**
 * Enhanced Query Generator
 * Intelligently generates search queries with AI-focused relevance scoring
 */

import { Logger } from '../../utils/logger.js';
import {
  QueryGenerationContext,
  GeneratedQuery,
  QueryType,
  QueryIntent,
  QueryGeneratorConfig
} from '../types/search-intelligence.types.js';

interface QueryPattern {
  template: string;
  type: QueryType;
  intent: QueryIntent;
  baseRelevance: number;
  baseDifficulty: number;
  modifiers?: string[];
}

interface IndustryTemplate {
  industry: string;
  patterns: QueryPattern[];
  commonModifiers: string[];
  targetAudience: string[];
}

export class EnhancedQueryGenerator {
  private logger: Logger;
  private queryPatterns: Map<QueryType, QueryPattern[]>;
  private industryTemplates: Map<string, IndustryTemplate>;
  private defaultConfig: QueryGeneratorConfig;

  constructor(config?: Partial<QueryGeneratorConfig>) {
    this.logger = new Logger('EnhancedQueryGenerator');
    this.defaultConfig = {
      minQueries: 10,
      maxQueries: 20,
      includeCompetitors: true,
      includeLocation: false,
      ...config
    };
    this.initializePatterns();
    this.initializeIndustryTemplates();
  }

  /**
   * Initialize comprehensive query patterns with AI relevance
   */
  private initializePatterns(): void {
    this.queryPatterns = new Map([
      [QueryType.BRAND, [
        { template: '{brand}', type: QueryType.BRAND, intent: QueryIntent.NAVIGATIONAL, baseRelevance: 9, baseDifficulty: 3 },
        { template: '{brand} reviews', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 5 },
        { template: '{brand} vs competitors', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 6 },
        { template: 'is {brand} worth it', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 7 },
        { template: '{brand} {modifier}', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 7, baseDifficulty: 5 },
        { template: '{brand} customer experiences', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 6 }
      ]],
      
      [QueryType.PRODUCT, [
        { template: '{product} {location}', type: QueryType.PRODUCT, intent: QueryIntent.COMMERCIAL, baseRelevance: 7, baseDifficulty: 4 },
        { template: 'best {product} {year}', type: QueryType.PRODUCT, intent: QueryIntent.COMMERCIAL, baseRelevance: 10, baseDifficulty: 8 },
        { template: '{product} near me', type: QueryType.PRODUCT, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 6, baseDifficulty: 3 },
        { template: '{brand} {product} review', type: QueryType.PRODUCT, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 5 },
        { template: 'buy {product} online', type: QueryType.PRODUCT, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 7, baseDifficulty: 9 },
        { template: '{product} for {audience}', type: QueryType.PRODUCT, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 6 }
      ]],
      
      [QueryType.SERVICE, [
        { template: '{service} providers {location}', type: QueryType.SERVICE, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 5 },
        { template: 'affordable {service}', type: QueryType.SERVICE, intent: QueryIntent.COMMERCIAL, baseRelevance: 7, baseDifficulty: 7 },
        { template: '{service} companies', type: QueryType.SERVICE, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 6 },
        { template: 'professional {service} services', type: QueryType.SERVICE, intent: QueryIntent.COMMERCIAL, baseRelevance: 7, baseDifficulty: 6 },
        { template: '{service} cost calculator', type: QueryType.SERVICE, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 5 }
      ]],
      
      [QueryType.TRANSACTIONAL, [
        { template: 'buy {product}', type: QueryType.TRANSACTIONAL, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 7, baseDifficulty: 9 },
        { template: '{product} pricing', type: QueryType.TRANSACTIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 5 },
        { template: '{product} deals', type: QueryType.TRANSACTIONAL, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 6, baseDifficulty: 8 },
        { template: '{brand} discount code', type: QueryType.TRANSACTIONAL, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 5, baseDifficulty: 7 },
        { template: 'sign up {brand}', type: QueryType.TRANSACTIONAL, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 6, baseDifficulty: 4 },
        { template: '{product} free trial', type: QueryType.TRANSACTIONAL, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 7, baseDifficulty: 5 }
      ]],
      
      [QueryType.INFORMATIONAL, [
        { template: 'how to choose {product}', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 10, baseDifficulty: 6 },
        { template: 'what is {service}', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 9, baseDifficulty: 4 },
        { template: '{product} guide', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 9, baseDifficulty: 5 },
        { template: '{product} tutorial', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 8, baseDifficulty: 4 },
        { template: 'benefits of {product}', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 9, baseDifficulty: 5 },
        { template: '{product} best practices', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 10, baseDifficulty: 6 }
      ]],
      
      [QueryType.COMPARISON, [
        { template: '{brand} vs {competitor}', type: QueryType.COMPARISON, intent: QueryIntent.COMMERCIAL, baseRelevance: 10, baseDifficulty: 7 },
        { template: '{product} alternatives', type: QueryType.COMPARISON, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 8 },
        { template: 'compare {products}', type: QueryType.COMPARISON, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 6 },
        { template: '{brand} or {competitor} which is better', type: QueryType.COMPARISON, intent: QueryIntent.COMMERCIAL, baseRelevance: 10, baseDifficulty: 7 },
        { template: '{product} comparison {year}', type: QueryType.COMPARISON, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 8 }
      ]],
      
      [QueryType.LONG_TAIL, [
        { template: 'why do people use {brand} for {purpose}', type: QueryType.LONG_TAIL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 10, baseDifficulty: 4 },
        { template: 'how does {brand} help with {problem}', type: QueryType.LONG_TAIL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 10, baseDifficulty: 5 },
        { template: 'what makes {brand} different from {competitor}', type: QueryType.LONG_TAIL, intent: QueryIntent.COMMERCIAL, baseRelevance: 10, baseDifficulty: 6 },
        { template: 'is {brand} good for {audience}', type: QueryType.LONG_TAIL, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 5 },
        { template: 'can {brand} integrate with {tool}', type: QueryType.LONG_TAIL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 8, baseDifficulty: 4 },
        { template: '{brand} case study {industry}', type: QueryType.LONG_TAIL, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 5 }
      ]]
    ]);
  }

  /**
   * Initialize industry-specific templates
   */
  private initializeIndustryTemplates(): void {
    this.industryTemplates = new Map([
      ['technology', {
        industry: 'technology',
        patterns: [
          { template: '{brand} API documentation', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 8, baseDifficulty: 3 },
          { template: '{brand} integration guide', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 9, baseDifficulty: 4 },
          { template: '{brand} developer resources', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 8, baseDifficulty: 3 },
          { template: '{brand} security features', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 5 }
        ],
        commonModifiers: ['enterprise', 'cloud', 'SaaS', 'open-source', 'AI-powered'],
        targetAudience: ['developers', 'IT managers', 'CTOs', 'startups', 'enterprises']
      }],
      
      ['ecommerce', {
        industry: 'ecommerce',
        patterns: [
          { template: '{brand} shipping policy', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 7, baseDifficulty: 3 },
          { template: '{brand} return process', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 3 },
          { template: '{brand} customer service', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 4 },
          { template: '{brand} size guide', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 7, baseDifficulty: 3 }
        ],
        commonModifiers: ['online', 'cheap', 'discount', 'authentic', 'fast delivery'],
        targetAudience: ['shoppers', 'bargain hunters', 'fashion enthusiasts', 'tech buyers']
      }],
      
      ['healthcare', {
        industry: 'healthcare',
        patterns: [
          { template: '{brand} patient reviews', type: QueryType.BRAND, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 5 },
          { template: '{brand} insurance accepted', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 3 },
          { template: '{brand} appointment booking', type: QueryType.TRANSACTIONAL, intent: QueryIntent.TRANSACTIONAL, baseRelevance: 7, baseDifficulty: 4 },
          { template: '{brand} treatment options', type: QueryType.INFORMATIONAL, intent: QueryIntent.INFORMATIONAL, baseRelevance: 9, baseDifficulty: 5 }
        ],
        commonModifiers: ['certified', 'licensed', 'specialist', 'near me', 'emergency'],
        targetAudience: ['patients', 'caregivers', 'healthcare professionals', 'insurance holders']
      }],
      
      ['finance', {
        industry: 'finance',
        patterns: [
          { template: '{brand} interest rates', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 4 },
          { template: '{brand} fees structure', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 8, baseDifficulty: 3 },
          { template: 'is {brand} FDIC insured', type: QueryType.INFORMATIONAL, intent: QueryIntent.COMMERCIAL, baseRelevance: 9, baseDifficulty: 3 },
          { template: '{brand} mobile app', type: QueryType.PRODUCT, intent: QueryIntent.NAVIGATIONAL, baseRelevance: 7, baseDifficulty: 3 }
        ],
        commonModifiers: ['best', 'lowest fees', 'high yield', 'secure', 'trusted'],
        targetAudience: ['investors', 'savers', 'businesses', 'retirees', 'students']
      }]
    ]);
  }

  /**
   * Generate queries with enhanced intelligence
   */
  async generateQueries(
    context: QueryGenerationContext,
    config: QueryGeneratorConfig = this.defaultConfig
  ): Promise<GeneratedQuery[]> {
    this.logger.info(`Generating enhanced queries for ${context.brand}`);
    
    const queries: GeneratedQuery[] = [];
    const usedQueries = new Set(context.previousQueries?.map(q => q.toLowerCase()) || []);
    
    // Extract entities from context
    const entities = this.extractEntities(context);
    
    // Get industry-specific patterns
    const industryPatterns = this.getIndustryPatterns(context.industry);
    
    // Generate queries by type with priority
    const typeDistribution = this.calculateTypeDistribution(context, config);
    
    for (const [type, count] of typeDistribution.entries()) {
      const patterns = [
        ...(this.queryPatterns.get(type) || []),
        ...(type === QueryType.LONG_TAIL ? this.generateConversationalPatterns(context) : [])
      ];
      
      const typeQueries = this.generateQueriesForType(
        patterns,
        context,
        entities,
        usedQueries,
        count
      );
      
      queries.push(...typeQueries);
    }
    
    // Add industry-specific queries
    if (industryPatterns.length > 0) {
      const industryQueries = this.generateQueriesForType(
        industryPatterns,
        context,
        entities,
        usedQueries,
        Math.ceil(config.maxQueries * 0.2) // 20% industry-specific
      );
      queries.push(...industryQueries);
    }
    
    // Score and prioritize queries
    const scoredQueries = this.scoreAndPrioritizeQueries(queries, context, config);
    
    // Ensure diversity
    const diverseQueries = this.ensureQueryDiversity(scoredQueries);
    
    // Limit to configured range
    const finalQueries = diverseQueries.slice(0, config.maxQueries);
    
    // Ensure minimum queries
    if (finalQueries.length < config.minQueries) {
      const additionalQueries = this.generateFallbackQueries(
        context,
        config.minQueries - finalQueries.length,
        usedQueries
      );
      finalQueries.push(...additionalQueries);
    }
    
    this.logger.info(`Generated ${finalQueries.length} enhanced queries for ${context.brand}`);
    return finalQueries;
  }

  /**
   * Extract entities from context using simple NLP
   */
  private extractEntities(context: QueryGenerationContext): {
    products: string[];
    services: string[];
    features: string[];
    problems: string[];
    tools: string[];
  } {
    const entities = {
      products: context.products || [],
      services: [],
      features: [],
      problems: [],
      tools: []
    };
    
    // Extract from products (simple heuristics)
    if (context.products) {
      context.products.forEach(product => {
        // Check if it's a service
        if (product.toLowerCase().includes('service') || 
            product.toLowerCase().includes('consulting') ||
            product.toLowerCase().includes('support')) {
          entities.services.push(product);
        }
        
        // Extract features (words ending in -ing, -tion, -ment)
        const featurePatterns = /\b\w+(ing|tion|ment|ity|ance|ence)\b/gi;
        const matches = product.match(featurePatterns);
        if (matches) {
          entities.features.push(...matches);
        }
      });
    }
    
    // Common problem keywords
    const problemKeywords = ['issue', 'problem', 'challenge', 'difficulty', 'error', 'bug'];
    const toolKeywords = ['api', 'sdk', 'plugin', 'integration', 'app', 'software'];
    
    // Extract from custom modifiers
    if (context.customModifiers) {
      context.customModifiers.forEach(modifier => {
        if (problemKeywords.some(kw => modifier.toLowerCase().includes(kw))) {
          entities.problems.push(modifier);
        }
        if (toolKeywords.some(kw => modifier.toLowerCase().includes(kw))) {
          entities.tools.push(modifier);
        }
      });
    }
    
    return entities;
  }

  /**
   * Get industry-specific patterns
   */
  private getIndustryPatterns(industry?: string): QueryPattern[] {
    if (!industry) return [];
    
    const template = this.industryTemplates.get(industry.toLowerCase());
    if (!template) {
      // Try to find partial match
      for (const [key, value] of this.industryTemplates.entries()) {
        if (industry.toLowerCase().includes(key) || key.includes(industry.toLowerCase())) {
          return value.patterns;
        }
      }
    }
    
    return template?.patterns || [];
  }

  /**
   * Calculate optimal type distribution based on context
   */
  private calculateTypeDistribution(
    context: QueryGenerationContext,
    config: QueryGeneratorConfig
  ): Map<QueryType, number> {
    const distribution = new Map<QueryType, number>();
    const totalQueries = config.maxQueries;
    
    // Base distribution
    distribution.set(QueryType.BRAND, Math.ceil(totalQueries * 0.20)); // 20%
    distribution.set(QueryType.INFORMATIONAL, Math.ceil(totalQueries * 0.20)); // 20%
    distribution.set(QueryType.LONG_TAIL, Math.ceil(totalQueries * 0.15)); // 15%
    
    // Conditional distribution
    if (context.products && context.products.length > 0) {
      distribution.set(QueryType.PRODUCT, Math.ceil(totalQueries * 0.15)); // 15%
    }
    
    if (config.includeCompetitors && context.competitors && context.competitors.length > 0) {
      distribution.set(QueryType.COMPARISON, Math.ceil(totalQueries * 0.15)); // 15%
    }
    
    if (this.isServiceIndustry(context.industry)) {
      distribution.set(QueryType.SERVICE, Math.ceil(totalQueries * 0.10)); // 10%
    }
    
    distribution.set(QueryType.TRANSACTIONAL, Math.ceil(totalQueries * 0.10)); // 10%
    
    if (config.includeLocation) {
      distribution.set(QueryType.LOCAL, Math.ceil(totalQueries * 0.05)); // 5%
    }
    
    return distribution;
  }

  /**
   * Generate conversational patterns for AI search
   */
  private generateConversationalPatterns(context: QueryGenerationContext): QueryPattern[] {
    const patterns: QueryPattern[] = [];
    
    // Question-based patterns
    const questionStarters = ['how can', 'what are', 'why should', 'when to use', 'where to find'];
    const actions = ['choose', 'implement', 'integrate', 'optimize', 'troubleshoot'];
    const purposes = context.industry ? 
      this.getIndustryPurposes(context.industry) : 
      ['business growth', 'efficiency', 'cost savings', 'customer satisfaction'];
    
    questionStarters.forEach(starter => {
      actions.forEach(action => {
        purposes.forEach(purpose => {
          patterns.push({
            template: `${starter} {brand} ${action} for ${purpose}`,
            type: QueryType.LONG_TAIL,
            intent: QueryIntent.INFORMATIONAL,
            baseRelevance: 10,
            baseDifficulty: 4
          });
        });
      });
    });
    
    // Natural language patterns
    patterns.push(
      {
        template: 'explain how {brand} works in simple terms',
        type: QueryType.LONG_TAIL,
        intent: QueryIntent.INFORMATIONAL,
        baseRelevance: 10,
        baseDifficulty: 3
      },
      {
        template: 'pros and cons of using {brand} for {purpose}',
        type: QueryType.LONG_TAIL,
        intent: QueryIntent.COMMERCIAL,
        baseRelevance: 10,
        baseDifficulty: 5
      },
      {
        template: 'step by step guide to getting started with {brand}',
        type: QueryType.LONG_TAIL,
        intent: QueryIntent.INFORMATIONAL,
        baseRelevance: 9,
        baseDifficulty: 4
      }
    );
    
    return patterns;
  }

  /**
   * Get industry-specific purposes
   */
  private getIndustryPurposes(industry: string): string[] {
    const purposes: Record<string, string[]> = {
      technology: ['software development', 'data analysis', 'automation', 'security'],
      ecommerce: ['online sales', 'inventory management', 'customer retention', 'conversion optimization'],
      healthcare: ['patient care', 'medical records', 'appointment scheduling', 'treatment planning'],
      finance: ['investment strategy', 'risk management', 'financial planning', 'compliance']
    };
    
    return purposes[industry.toLowerCase()] || ['business operations', 'productivity', 'growth', 'optimization'];
  }

  /**
   * Generate queries for a specific type
   */
  private generateQueriesForType(
    patterns: QueryPattern[],
    context: QueryGenerationContext,
    entities: any,
    usedQueries: Set<string>,
    maxCount: number
  ): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];
    
    for (const pattern of patterns) {
      if (queries.length >= maxCount) break;
      
      const filledQueries = this.fillPattern(pattern, context, entities);
      
      for (const query of filledQueries) {
        if (queries.length >= maxCount) break;
        if (usedQueries.has(query.toLowerCase())) continue;
        
        usedQueries.add(query.toLowerCase());
        queries.push({
          query,
          type: pattern.type,
          intent: pattern.intent,
          priority: 'medium', // Will be updated in scoring
          expectedDifficulty: pattern.baseDifficulty,
          aiRelevance: pattern.baseRelevance
        });
      }
    }
    
    return queries;
  }

  /**
   * Fill pattern with context values
   */
  private fillPattern(
    pattern: QueryPattern,
    context: QueryGenerationContext,
    entities: any
  ): string[] {
    const queries: string[] = [];
    let template = pattern.template;
    
    // Basic replacements
    template = template.replace(/{brand}/g, context.brand);
    template = template.replace(/{industry}/g, context.industry || 'business');
    template = template.replace(/{year}/g, new Date().getFullYear().toString());
    
    // Handle location
    if (template.includes('{location}')) {
      if (context.targetMarket) {
        queries.push(template.replace(/{location}/g, context.targetMarket));
      } else {
        return []; // Skip location-based queries if no location
      }
    }
    
    // Handle products
    if (template.includes('{product}')) {
      if (entities.products.length > 0) {
        entities.products.slice(0, 3).forEach(product => {
          queries.push(template.replace(/{product}/g, product));
        });
      } else {
        queries.push(template.replace(/{product}/g, `${context.brand} product`));
      }
    }
    
    // Handle services
    if (template.includes('{service}')) {
      if (entities.services.length > 0) {
        entities.services.slice(0, 2).forEach(service => {
          queries.push(template.replace(/{service}/g, service));
        });
      } else {
        queries.push(template.replace(/{service}/g, `${context.brand} service`));
      }
    }
    
    // Handle competitors
    if (template.includes('{competitor}')) {
      if (context.competitors && context.competitors.length > 0) {
        context.competitors.slice(0, 3).forEach(competitor => {
          queries.push(template.replace(/{competitor}/g, competitor));
        });
      } else {
        return []; // Skip competitor queries if none provided
      }
    }
    
    // Handle audience
    if (template.includes('{audience}')) {
      if (context.targetAudience && context.targetAudience.length > 0) {
        context.targetAudience.slice(0, 2).forEach(audience => {
          queries.push(template.replace(/{audience}/g, audience));
        });
      } else {
        queries.push(template.replace(/{audience}/g, 'businesses'));
      }
    }
    
    // Handle purpose
    if (template.includes('{purpose}')) {
      const purposes = this.getIndustryPurposes(context.industry || 'general');
      queries.push(template.replace(/{purpose}/g, purposes[0]));
    }
    
    // Handle problem
    if (template.includes('{problem}')) {
      if (entities.problems.length > 0) {
        queries.push(template.replace(/{problem}/g, entities.problems[0]));
      } else {
        queries.push(template.replace(/{problem}/g, 'common challenges'));
      }
    }
    
    // Handle tool
    if (template.includes('{tool}')) {
      if (entities.tools.length > 0) {
        queries.push(template.replace(/{tool}/g, entities.tools[0]));
      } else {
        queries.push(template.replace(/{tool}/g, 'other tools'));
      }
    }
    
    // Handle modifiers
    if (template.includes('{modifier}')) {
      const modifiers = this.getRelevantModifiers(context);
      modifiers.slice(0, 2).forEach(modifier => {
        queries.push(template.replace(/{modifier}/g, modifier));
      });
    }
    
    // If no placeholders, return the template as is
    if (queries.length === 0 && !template.includes('{')) {
      queries.push(template);
    }
    
    // Clean up queries
    return queries.map(q => q.replace(/\s+/g, ' ').trim()).filter(q => q.length > 2);
  }

  /**
   * Get relevant modifiers based on context
   */
  private getRelevantModifiers(context: QueryGenerationContext): string[] {
    const modifiers: string[] = [];
    
    // Add custom modifiers
    if (context.customModifiers) {
      modifiers.push(...context.customModifiers);
    }
    
    // Add industry-specific modifiers
    if (context.industry) {
      const industryTemplate = this.industryTemplates.get(context.industry.toLowerCase());
      if (industryTemplate) {
        modifiers.push(...industryTemplate.commonModifiers);
      }
    }
    
    // Add general modifiers
    modifiers.push('best', 'top rated', 'recommended', 'popular', 'trusted');
    
    return [...new Set(modifiers)]; // Remove duplicates
  }

  /**
   * Score and prioritize queries
   */
  private scoreAndPrioritizeQueries(
    queries: GeneratedQuery[],
    context: QueryGenerationContext,
    config: QueryGeneratorConfig
  ): GeneratedQuery[] {
    return queries.map(query => {
      let commercialValue = 0;
      let aiLikelihood = query.aiRelevance;
      
      // Commercial value scoring
      if (query.intent === QueryIntent.TRANSACTIONAL) {
        commercialValue = 9;
      } else if (query.intent === QueryIntent.COMMERCIAL) {
        commercialValue = 7;
      } else if (query.intent === QueryIntent.INFORMATIONAL) {
        commercialValue = 5;
      } else {
        commercialValue = 3;
      }
      
      // Boost commercial value for certain keywords
      const highValueKeywords = ['buy', 'price', 'cost', 'review', 'compare', 'best'];
      if (highValueKeywords.some(kw => query.query.toLowerCase().includes(kw))) {
        commercialValue = Math.min(10, commercialValue + 2);
      }
      
      // AI likelihood adjustments
      if (query.type === QueryType.LONG_TAIL) {
        aiLikelihood = Math.min(10, aiLikelihood + 1);
      }
      
      if (query.query.split(' ').length > 5) {
        aiLikelihood = Math.min(10, aiLikelihood + 1);
      }
      
      // Question queries are more likely to be used with AI
      if (query.query.includes('?') || query.query.match(/^(how|what|why|when|where|can|should|is)/i)) {
        aiLikelihood = Math.min(10, aiLikelihood + 2);
      }
      
      // Calculate combined score
      const combinedScore = (commercialValue * 0.4) + (aiLikelihood * 0.6);
      
      // Set priority based on combined score
      let priority: 'high' | 'medium' | 'low';
      if (combinedScore >= 8) {
        priority = 'high';
      } else if (combinedScore >= 6) {
        priority = 'medium';
      } else {
        priority = 'low';
      }
      
      return {
        ...query,
        priority,
        aiRelevance: Math.round(aiLikelihood)
      };
    }).sort((a, b) => {
      // Sort by priority then by AI relevance
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.aiRelevance - a.aiRelevance;
    });
  }

  /**
   * Ensure query diversity
   */
  private ensureQueryDiversity(queries: GeneratedQuery[]): GeneratedQuery[] {
    const diverseQueries: GeneratedQuery[] = [];
    const typeCount = new Map<QueryType, number>();
    const intentCount = new Map<QueryIntent, number>();
    
    for (const query of queries) {
      const currentTypeCount = typeCount.get(query.type) || 0;
      const currentIntentCount = intentCount.get(query.intent) || 0;
      
      // Limit each type to prevent over-representation
      if (currentTypeCount < 5 && currentIntentCount < 7) {
        diverseQueries.push(query);
        typeCount.set(query.type, currentTypeCount + 1);
        intentCount.set(query.intent, currentIntentCount + 1);
      }
    }
    
    return diverseQueries;
  }

  /**
   * Generate fallback queries if minimum not met
   */
  private generateFallbackQueries(
    context: QueryGenerationContext,
    count: number,
    usedQueries: Set<string>
  ): GeneratedQuery[] {
    const fallbackQueries: GeneratedQuery[] = [];
    const fallbackTemplates = [
      `${context.brand} official website`,
      `${context.brand} contact information`,
      `${context.brand} customer support`,
      `${context.brand} locations`,
      `${context.brand} about us`,
      `${context.brand} features`,
      `${context.brand} benefits`
    ];
    
    for (const template of fallbackTemplates) {
      if (fallbackQueries.length >= count) break;
      if (usedQueries.has(template.toLowerCase())) continue;
      
      fallbackQueries.push({
        query: template,
        type: QueryType.BRAND,
        intent: QueryIntent.NAVIGATIONAL,
        priority: 'low',
        expectedDifficulty: 3,
        aiRelevance: 5
      });
    }
    
    return fallbackQueries;
  }

  /**
   * Check if industry is service-based
   */
  private isServiceIndustry(industry?: string): boolean {
    if (!industry) return false;
    
    const serviceKeywords = [
      'service', 'consulting', 'agency', 'contractor',
      'healthcare', 'legal', 'accounting', 'marketing',
      'repair', 'maintenance', 'cleaning', 'delivery'
    ];
    
    return serviceKeywords.some(keyword => 
      industry.toLowerCase().includes(keyword)
    );
  }

  /**
   * Validate queries
   */
  validateQueries(queries: GeneratedQuery[]): GeneratedQuery[] {
    return queries.filter(query => {
      // Length check
      if (query.query.length < 3 || query.query.length > 100) return false;
      
      // Must contain brand or product
      const words = query.query.toLowerCase().split(/\s+/);
      if (words.length === 0) return false;
      
      // Remove pure stop word queries
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
      if (words.every(word => stopWords.has(word))) return false;
      
      return true;
    });
  }
}