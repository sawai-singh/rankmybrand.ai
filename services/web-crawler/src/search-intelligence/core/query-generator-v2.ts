/**
 * Query Generator V2
 * Enhanced version with intelligent query generation and AI-focused relevance scoring
 * This replaces the original query-generator.ts with improved functionality
 */

import { EnhancedQueryGenerator } from './query-generator-enhanced.js';
import { Logger } from '../../utils/logger.js';
import {
  QueryGenerationContext,
  GeneratedQuery,
  QueryType,
  QueryGeneratorConfig
} from '../types/search-intelligence.types.js';

/**
 * QueryGenerator class that extends EnhancedQueryGenerator
 * Provides backward compatibility while using enhanced features
 */
export class QueryGenerator extends EnhancedQueryGenerator {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('QueryGeneratorV2');
  }

  /**
   * Generate search queries based on context
   * Backward compatible method that uses enhanced generation
   */
  async generateQueries(context: QueryGenerationContext): Promise<GeneratedQuery[]> {
    this.logger.info(`Generating queries for ${context.brand} using enhanced algorithm`);
    
    // Create config from context
    const config: QueryGeneratorConfig = {
      minQueries: 10,
      maxQueries: 20,
      includeCompetitors: !!(context.competitors && context.competitors.length > 0),
      includeLocation: !!context.targetMarket,
      targetAudience: context.targetAudience,
      industry: context.industry,
      customModifiers: context.customModifiers
    };
    
    // Use enhanced generation
    const enhancedQueries = await super.generateQueries(context, config);
    
    // Add backward compatibility for expectedIntent field
    const compatibleQueries = enhancedQueries.map(query => ({
      ...query,
      expectedIntent: query.expectedIntent || this.getExpectedIntentDescription(query)
    }));
    
    // Log statistics
    this.logQueryStatistics(compatibleQueries);
    
    return compatibleQueries;
  }

  /**
   * Get expected intent description for backward compatibility
   */
  private getExpectedIntentDescription(query: GeneratedQuery): string {
    const intentDescriptions = {
      'commercial': 'Evaluating options and making purchase decisions',
      'informational': 'Learning and researching about the topic',
      'navigational': 'Finding specific websites or pages',
      'transactional': 'Ready to take action or make a purchase'
    };
    
    const typeDescriptions = {
      'brand': 'Brand discovery and reputation research',
      'product': 'Product research and evaluation',
      'service': 'Service provider evaluation',
      'comparison': 'Comparing options before decision',
      'informational': 'Educational and how-to content',
      'transactional': 'Purchase or sign-up intent',
      'local': 'Finding local presence or services',
      'long-tail': 'Detailed research and specific questions'
    };
    
    return `${intentDescriptions[query.intent]} - ${typeDescriptions[query.type]}`;
  }

  /**
   * Log query generation statistics
   */
  private logQueryStatistics(queries: GeneratedQuery[]): void {
    const stats = {
      total: queries.length,
      byType: {} as Record<string, number>,
      byIntent: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      avgDifficulty: 0,
      avgAiRelevance: 0
    };
    
    queries.forEach(query => {
      // Count by type
      stats.byType[query.type] = (stats.byType[query.type] || 0) + 1;
      
      // Count by intent
      stats.byIntent[query.intent] = (stats.byIntent[query.intent] || 0) + 1;
      
      // Count by priority
      stats.byPriority[query.priority] = (stats.byPriority[query.priority] || 0) + 1;
      
      // Sum difficulties and relevance
      stats.avgDifficulty += query.expectedDifficulty;
      stats.avgAiRelevance += query.aiRelevance;
    });
    
    // Calculate averages
    stats.avgDifficulty = Math.round(stats.avgDifficulty / queries.length * 10) / 10;
    stats.avgAiRelevance = Math.round(stats.avgAiRelevance / queries.length * 10) / 10;
    
    this.logger.info('Query generation statistics:', stats);
  }

  /**
   * Additional method to generate queries with explicit config
   * This allows users to take advantage of new features
   */
  async generateQueriesWithConfig(
    context: QueryGenerationContext,
    config: QueryGeneratorConfig
  ): Promise<GeneratedQuery[]> {
    return super.generateQueries(context, config);
  }

  /**
   * Get optimal query configuration based on context
   */
  getOptimalConfig(context: QueryGenerationContext): QueryGeneratorConfig {
    const config: QueryGeneratorConfig = {
      minQueries: 10,
      maxQueries: 20,
      includeCompetitors: true,
      includeLocation: false
    };
    
    // Adjust based on context
    if (context.products && context.products.length > 5) {
      config.maxQueries = 25; // More queries for complex product catalogs
    }
    
    if (context.targetMarket) {
      config.includeLocation = true;
    }
    
    if (!context.competitors || context.competitors.length === 0) {
      config.includeCompetitors = false;
    }
    
    // Industry-specific adjustments
    if (context.industry) {
      const localIndustries = ['restaurant', 'retail', 'healthcare', 'fitness'];
      if (localIndustries.some(ind => context.industry!.toLowerCase().includes(ind))) {
        config.includeLocation = true;
      }
    }
    
    return config;
  }

  /**
   * Analyze query portfolio for insights
   */
  analyzeQueryPortfolio(queries: GeneratedQuery[]): {
    insights: string[];
    recommendations: string[];
    coverage: Record<string, number>;
  } {
    const insights: string[] = [];
    const recommendations: string[] = [];
    const coverage: Record<string, number> = {};
    
    // Analyze type coverage
    const typeCounts = new Map<QueryType, number>();
    queries.forEach(q => {
      typeCounts.set(q.type, (typeCounts.get(q.type) || 0) + 1);
    });
    
    // Check for missing types
    const allTypes = Object.values(QueryType);
    const missingTypes = allTypes.filter(type => !typeCounts.has(type));
    
    if (missingTypes.length > 0) {
      recommendations.push(`Consider adding queries for: ${missingTypes.join(', ')}`);
    }
    
    // Analyze AI relevance
    const avgAiRelevance = queries.reduce((sum, q) => sum + q.aiRelevance, 0) / queries.length;
    if (avgAiRelevance < 7) {
      recommendations.push('Add more conversational and long-tail queries to improve AI visibility');
    } else {
      insights.push(`Strong AI relevance score: ${avgAiRelevance.toFixed(1)}/10`);
    }
    
    // Analyze difficulty distribution
    const highDifficultyQueries = queries.filter(q => q.expectedDifficulty >= 8).length;
    const lowDifficultyQueries = queries.filter(q => q.expectedDifficulty <= 3).length;
    
    if (highDifficultyQueries > queries.length * 0.5) {
      recommendations.push('Portfolio is too competitive. Add more branded and long-tail queries');
    }
    
    if (lowDifficultyQueries < queries.length * 0.2) {
      recommendations.push('Add more easy-win queries like branded terms');
    }
    
    // Calculate coverage
    for (const [type, count] of typeCounts.entries()) {
      coverage[type] = Math.round((count / queries.length) * 100);
    }
    
    // Priority distribution
    const highPriorityCount = queries.filter(q => q.priority === 'high').length;
    if (highPriorityCount < queries.length * 0.3) {
      recommendations.push('Increase focus on high-priority commercial queries');
    }
    
    return { insights, recommendations, coverage };
  }
}