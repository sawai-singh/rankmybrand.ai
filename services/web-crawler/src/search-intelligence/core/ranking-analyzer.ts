/**
 * Ranking Analyzer
 * Analyzes search rankings and extracts insights
 */

import { Logger } from '../../utils/logger.js';
import {
  SearchRanking,
  GeneratedQuery,
  SerpApiResponse,
  SerpFeatures,
  QueryType
} from '../types/search-intelligence.types.js';

export class RankingAnalyzer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RankingAnalyzer');
  }

  /**
   * Analyze ranking for a specific query
   */
  async analyzeRanking(
    analysisId: string,
    query: GeneratedQuery,
    serpData: SerpApiResponse,
    targetDomain: string,
    competitors: string[]
  ): Promise<SearchRanking> {
    this.logger.debug(`Analyzing ranking for query: ${query.query}`);

    // Find target domain position
    const targetPosition = this.findDomainPosition(serpData, targetDomain);
    const targetUrl = this.findDomainUrl(serpData, targetDomain);

    // Find competitor positions
    const competitorPositions = this.findCompetitorPositions(serpData, competitors);

    // Create ranking record
    const ranking: SearchRanking = {
      id: this.generateId(),
      analysisId,
      query: query.query,
      queryType: query.type,
      position: targetPosition,
      urlFound: targetUrl,
      serpFeatures: serpData.features,
      competitorPositions,
      createdAt: new Date()
    };

    this.logger.debug(`Target domain ${targetDomain} found at position ${targetPosition || 'not found'}`);
    
    return ranking;
  }

  /**
   * Find domain position in SERP results
   */
  private findDomainPosition(serpData: SerpApiResponse, domain: string): number | undefined {
    const normalizedDomain = this.normalizeDomain(domain);
    
    for (const result of serpData.results) {
      if (!result.isAd && this.matchesDomain(result.domain, normalizedDomain)) {
        return result.position;
      }
    }
    
    return undefined;
  }

  /**
   * Find domain URL in SERP results
   */
  private findDomainUrl(serpData: SerpApiResponse, domain: string): string | undefined {
    const normalizedDomain = this.normalizeDomain(domain);
    
    for (const result of serpData.results) {
      if (!result.isAd && this.matchesDomain(result.domain, normalizedDomain)) {
        return result.url;
      }
    }
    
    return undefined;
  }

  /**
   * Find competitor positions
   */
  private findCompetitorPositions(
    serpData: SerpApiResponse,
    competitors: string[]
  ): Record<string, number> {
    const positions: Record<string, number> = {};
    
    for (const competitor of competitors) {
      const normalizedCompetitor = this.normalizeDomain(competitor);
      
      for (const result of serpData.results) {
        if (!result.isAd && this.matchesDomain(result.domain, normalizedCompetitor)) {
          positions[competitor] = result.position;
          break;
        }
      }
    }
    
    return positions;
  }

  /**
   * Normalize domain for comparison
   */
  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '');
  }

  /**
   * Check if domains match
   */
  private matchesDomain(resultDomain: string, targetDomain: string): boolean {
    const normalizedResult = this.normalizeDomain(resultDomain);
    return normalizedResult === targetDomain || 
           normalizedResult.endsWith(`.${targetDomain}`) ||
           targetDomain.endsWith(`.${normalizedResult}`);
  }

  /**
   * Calculate visibility metrics for a set of rankings
   */
  calculateVisibilityMetrics(rankings: SearchRanking[]): {
    totalQueries: number;
    queriesRanked: number;
    averagePosition: number;
    top3Count: number;
    top10Count: number;
    featuredSnippets: number;
    queryTypeBreakdown: Record<QueryType, number>;
  } {
    const totalQueries = rankings.length;
    const rankedQueries = rankings.filter(r => r.position !== undefined);
    const queriesRanked = rankedQueries.length;
    
    const averagePosition = queriesRanked > 0
      ? rankedQueries.reduce((sum, r) => sum + (r.position || 0), 0) / queriesRanked
      : 0;

    const top3Count = rankedQueries.filter(r => r.position && r.position <= 3).length;
    const top10Count = rankedQueries.filter(r => r.position && r.position <= 10).length;
    const featuredSnippets = rankings.filter(r => r.serpFeatures.hasFeaturedSnippet).length;

    // Query type breakdown
    const queryTypeBreakdown: Record<QueryType, number> = {} as any;
    for (const type of Object.values(QueryType)) {
      queryTypeBreakdown[type] = rankings.filter(r => r.queryType === type && r.position).length;
    }

    return {
      totalQueries,
      queriesRanked,
      averagePosition: Math.round(averagePosition * 10) / 10,
      top3Count,
      top10Count,
      featuredSnippets,
      queryTypeBreakdown
    };
  }

  /**
   * Analyze SERP features distribution
   */
  analyzeSerpFeatures(rankings: SearchRanking[]): {
    featuredSnippetOpportunities: number;
    knowledgePanelPresence: number;
    peopleAlsoAskPresence: number;
    localPackOpportunities: number;
    shoppingResultsPresence: number;
    competitiveSerpScore: number;
  } {
    const total = rankings.length || 1;

    const featuredSnippetOpportunities = rankings.filter(r => 
      r.serpFeatures.hasFeaturedSnippet && (!r.position || r.position > 1)
    ).length;

    const knowledgePanelPresence = rankings.filter(r => 
      r.serpFeatures.hasKnowledgePanel
    ).length;

    const peopleAlsoAskPresence = rankings.filter(r => 
      r.serpFeatures.hasPeopleAlsoAsk
    ).length;

    const localPackOpportunities = rankings.filter(r => 
      r.serpFeatures.hasLocalPack && r.queryType === QueryType.LOCAL
    ).length;

    const shoppingResultsPresence = rankings.filter(r => 
      r.serpFeatures.hasShoppingResults
    ).length;

    // Calculate competitive SERP score (0-100)
    // Higher score means more competitive SERPs
    const avgOrganicResults = rankings.reduce((sum, r) => 
      sum + r.serpFeatures.totalOrganicResults, 0
    ) / total;

    const avgFeatures = rankings.reduce((sum, r) => {
      let featureCount = 0;
      if (r.serpFeatures.hasFeaturedSnippet) featureCount++;
      if (r.serpFeatures.hasKnowledgePanel) featureCount++;
      if (r.serpFeatures.hasPeopleAlsoAsk) featureCount++;
      if (r.serpFeatures.hasLocalPack) featureCount++;
      if (r.serpFeatures.hasShoppingResults) featureCount++;
      if (r.serpFeatures.hasVideoCarousel) featureCount++;
      if (r.serpFeatures.hasNewsResults) featureCount++;
      if (r.serpFeatures.hasImagePack) featureCount++;
      return sum + featureCount;
    }, 0) / total;

    const competitiveSerpScore = Math.min(100, Math.round(
      (avgOrganicResults * 3) + (avgFeatures * 10)
    ));

    return {
      featuredSnippetOpportunities,
      knowledgePanelPresence,
      peopleAlsoAskPresence,
      localPackOpportunities,
      shoppingResultsPresence,
      competitiveSerpScore
    };
  }

  /**
   * Get ranking insights and recommendations
   */
  generateRankingInsights(rankings: SearchRanking[]): string[] {
    const insights: string[] = [];
    const metrics = this.calculateVisibilityMetrics(rankings);
    const features = this.analyzeSerpFeatures(rankings);

    // Position-based insights
    if (metrics.averagePosition > 15) {
      insights.push('Low overall visibility - average position beyond page 2');
    } else if (metrics.averagePosition > 10) {
      insights.push('Moderate visibility - most rankings on page 2');
    } else if (metrics.averagePosition <= 3) {
      insights.push('Strong visibility - average position in top 3');
    }

    // Coverage insights
    const coverageRate = (metrics.queriesRanked / metrics.totalQueries) * 100;
    if (coverageRate < 30) {
      insights.push(`Low search coverage - only ranking for ${Math.round(coverageRate)}% of queries`);
    } else if (coverageRate > 70) {
      insights.push(`Good search coverage - ranking for ${Math.round(coverageRate)}% of queries`);
    }

    // Featured snippet opportunities
    if (features.featuredSnippetOpportunities > 3) {
      insights.push(`${features.featuredSnippetOpportunities} featured snippet opportunities identified`);
    }

    // Query type performance
    const bestPerformingType = this.getBestPerformingQueryType(rankings);
    if (bestPerformingType) {
      insights.push(`Best performance on ${bestPerformingType} queries`);
    }

    // Competitive landscape
    if (features.competitiveSerpScore > 70) {
      insights.push('Highly competitive SERP landscape with many features');
    }

    return insights;
  }

  /**
   * Get best performing query type
   */
  private getBestPerformingQueryType(rankings: SearchRanking[]): string | null {
    const typePerformance: Record<string, { count: number; avgPosition: number }> = {};

    for (const ranking of rankings) {
      if (ranking.position) {
        if (!typePerformance[ranking.queryType]) {
          typePerformance[ranking.queryType] = { count: 0, avgPosition: 0 };
        }
        
        const current = typePerformance[ranking.queryType];
        current.avgPosition = (current.avgPosition * current.count + ranking.position) / (current.count + 1);
        current.count++;
      }
    }

    let bestType: string | null = null;
    let bestAvgPosition = Infinity;

    for (const [type, performance] of Object.entries(typePerformance)) {
      if (performance.count >= 2 && performance.avgPosition < bestAvgPosition) {
        bestAvgPosition = performance.avgPosition;
        bestType = type;
      }
    }

    return bestType;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}