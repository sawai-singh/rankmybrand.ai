/**
 * AI Visibility Predictor
 * Predicts likelihood of appearing in AI-generated responses
 */

import { Logger } from '../utils/logger.js';
import {
  AIVisibilityPrediction,
  SearchRanking,
  BrandMention,
  BrandAuthorityMetrics,
  CompetitorAnalysis,
  AuthorityScore,
  QueryType
} from '../types/search-intelligence.types.js';

interface PredictionFactors {
  searchVisibility: number;
  authorityScore: number;
  contentRelevance: number;
  competitivePosition: number;
  technicalFactors: number;
}

export class AIVisibilityPredictor {
  private logger: Logger;
  private weights: PredictionFactors;

  constructor() {
    this.logger = new Logger('AIVisibilityPredictor');
    
    // Weights based on AI search engine behavior research
    this.weights = {
      searchVisibility: 0.25,    // Search rankings influence
      authorityScore: 0.30,       // Domain authority and mentions
      contentRelevance: 0.20,     // Content structure and relevance
      competitivePosition: 0.15,  // Relative to competitors
      technicalFactors: 0.10      // Technical SEO factors
    };
  }

  /**
   * Predict AI visibility based on various factors
   */
  async predictVisibility(data: {
    rankings: SearchRanking[];
    mentions: BrandMention[];
    authorityMetrics: BrandAuthorityMetrics;
    competitors: CompetitorAnalysis[];
    domain: string;
  }): Promise<AIVisibilityPrediction> {
    this.logger.info(`Predicting AI visibility for ${data.domain}`);

    // Calculate individual factor scores
    const factors: PredictionFactors = {
      searchVisibility: this.calculateSearchVisibilityScore(data.rankings),
      authorityScore: this.calculateAuthorityFactorScore(data.authorityMetrics),
      contentRelevance: this.calculateContentRelevanceScore(data.rankings),
      competitivePosition: this.calculateCompetitivePositionScore(data.rankings, data.competitors),
      technicalFactors: this.calculateTechnicalScore(data.domain, data.rankings)
    };

    // Calculate weighted prediction score
    const predictedScore = this.calculateWeightedScore(factors);
    const confidence = this.calculateConfidence(data);

    // Identify strengths and weaknesses
    const strengths = this.identifyStrengths(factors, data);
    const weaknesses = this.identifyWeaknesses(factors, data);

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, data);

    // Determine competitive position
    const competitivePosition = this.determineCompetitivePosition(
      predictedScore,
      data.competitors
    );

    return {
      predictedScore: Math.round(predictedScore),
      confidence,
      strengths,
      weaknesses,
      recommendations,
      competitivePosition
    };
  }

  /**
   * Calculate search visibility score (0-100)
   */
  private calculateSearchVisibilityScore(rankings: SearchRanking[]): number {
    if (rankings.length === 0) return 0;

    let score = 0;
    const rankedQueries = rankings.filter(r => r.position !== undefined);
    
    // Coverage component (40%)
    const coverageRate = rankedQueries.length / rankings.length;
    score += coverageRate * 40;

    // Position component (40%)
    if (rankedQueries.length > 0) {
      const avgPosition = rankedQueries.reduce((sum, r) => sum + (r.position || 20), 0) / rankedQueries.length;
      const positionScore = Math.max(0, 40 - (avgPosition - 1) * 2);
      score += positionScore;
    }

    // SERP features component (20%)
    const featuredSnippets = rankings.filter(r => 
      r.serpFeatures.hasFeaturedSnippet && r.position === 1
    ).length;
    const knowledgePanels = rankings.filter(r => 
      r.serpFeatures.hasKnowledgePanel
    ).length;
    
    score += (featuredSnippets / rankings.length) * 10;
    score += (knowledgePanels / rankings.length) * 10;

    return Math.min(100, score);
  }

  /**
   * Calculate authority factor score (0-100)
   */
  private calculateAuthorityFactorScore(metrics: BrandAuthorityMetrics): number {
    const scoreMap: Record<AuthorityScore, number> = {
      [AuthorityScore.VERY_HIGH]: 90,
      [AuthorityScore.HIGH]: 70,
      [AuthorityScore.MEDIUM]: 50,
      [AuthorityScore.LOW]: 30,
      [AuthorityScore.VERY_LOW]: 10
    };

    let baseScore = scoreMap[metrics.authorityScore];

    // Bonus for tier 1 mentions
    baseScore += Math.min(10, metrics.tier1Mentions * 2);

    // Bonus for diversity
    baseScore += Math.min(10, metrics.mentionDiversity / 2);

    return Math.min(100, baseScore);
  }

  /**
   * Calculate content relevance score (0-100)
   */
  private calculateContentRelevanceScore(rankings: SearchRanking[]): number {
    if (rankings.length === 0) return 0;

    let score = 0;

    // Query type distribution (40%)
    const queryTypes = new Set(rankings.map(r => r.queryType));
    const typesCovered = queryTypes.size;
    score += (typesCovered / Object.keys(QueryType).length) * 40;

    // Informational query performance (30%)
    const informationalRankings = rankings.filter(r => 
      r.queryType === QueryType.INFORMATIONAL && r.position !== undefined
    );
    if (informationalRankings.length > 0) {
      const avgInfoPosition = informationalRankings.reduce((sum, r) => 
        sum + (r.position || 20), 0
      ) / informationalRankings.length;
      score += Math.max(0, 30 - (avgInfoPosition - 1) * 1.5);
    }

    // Brand query performance (30%)
    const brandRankings = rankings.filter(r => 
      r.queryType === QueryType.BRAND && r.position !== undefined
    );
    if (brandRankings.length > 0) {
      const avgBrandPosition = brandRankings.reduce((sum, r) => 
        sum + (r.position || 20), 0
      ) / brandRankings.length;
      score += Math.max(0, 30 - (avgBrandPosition - 1) * 3);
    }

    return Math.min(100, score);
  }

  /**
   * Calculate competitive position score (0-100)
   */
  private calculateCompetitivePositionScore(
    rankings: SearchRanking[],
    competitors: CompetitorAnalysis[]
  ): number {
    if (competitors.length === 0) return 50; // Neutral if no competitors

    // Calculate own visibility score for comparison
    const ownMetrics = this.calculateOwnMetrics(rankings);
    
    // Compare against competitors
    let betterThan = 0;
    let totalComparisons = 0;

    for (const competitor of competitors) {
      totalComparisons++;
      if (ownMetrics.visibilityScore > competitor.visibilityScore) {
        betterThan++;
      }
    }

    // Base score on relative position
    const relativePosition = betterThan / totalComparisons;
    let score = relativePosition * 80;

    // Bonus for being top performer
    if (relativePosition === 1) {
      score += 20;
    } else if (relativePosition >= 0.8) {
      score += 10;
    }

    return Math.round(score);
  }

  /**
   * Calculate technical score (0-100)
   */
  private calculateTechnicalScore(domain: string, rankings: SearchRanking[]): number {
    let score = 50; // Base score

    // HTTPS bonus
    if (domain.startsWith('https://') || !domain.includes('://')) {
      score += 10;
    }

    // Domain age and type bonuses (simulated)
    if (domain.endsWith('.edu') || domain.endsWith('.gov')) {
      score += 20;
    } else if (domain.endsWith('.org')) {
      score += 10;
    }

    // Clean URL structure bonus
    const hasCleanUrls = rankings.some(r => 
      r.urlFound && !r.urlFound.includes('?') && r.urlFound.split('/').length <= 6
    );
    if (hasCleanUrls) {
      score += 10;
    }

    // Mobile-friendly assumption (would check in real implementation)
    score += 10;

    return Math.min(100, score);
  }

  /**
   * Calculate weighted prediction score
   */
  private calculateWeightedScore(factors: PredictionFactors): number {
    let weightedScore = 0;

    for (const [factor, score] of Object.entries(factors)) {
      const weight = this.weights[factor as keyof PredictionFactors];
      weightedScore += score * weight;
    }

    return weightedScore;
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(data: any): number {
    let confidence = 0.5; // Base confidence

    // More data points increase confidence
    if (data.rankings.length >= 20) confidence += 0.2;
    else if (data.rankings.length >= 10) confidence += 0.1;

    // Authority mentions increase confidence
    if (data.mentions.length >= 10) confidence += 0.1;
    if (data.authorityMetrics.tier1Mentions > 0) confidence += 0.1;

    // Competitor data increases confidence
    if (data.competitors.length >= 5) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  /**
   * Calculate own metrics for comparison
   */
  private calculateOwnMetrics(rankings: SearchRanking[]): any {
    const rankedQueries = rankings.filter(r => r.position !== undefined);
    const avgPosition = rankedQueries.length > 0
      ? rankedQueries.reduce((sum, r) => sum + (r.position || 0), 0) / rankedQueries.length
      : 20;

    const visibilityScore = this.calculateSearchVisibilityScore(rankings);

    return {
      avgPosition,
      visibilityScore,
      top3Count: rankedQueries.filter(r => r.position && r.position <= 3).length,
      top10Count: rankedQueries.filter(r => r.position && r.position <= 10).length
    };
  }

  /**
   * Identify strengths based on factors
   */
  private identifyStrengths(factors: PredictionFactors, data: any): string[] {
    const strengths: string[] = [];

    if (factors.searchVisibility >= 70) {
      strengths.push('Strong search engine visibility across target queries');
    }

    if (factors.authorityScore >= 70) {
      strengths.push('High domain authority with quality backlinks');
    }

    if (factors.contentRelevance >= 70) {
      strengths.push('Well-optimized content matching search intent');
    }

    if (factors.competitivePosition >= 70) {
      strengths.push('Leading position among competitors');
    }

    if (data.authorityMetrics.tier1Mentions > 3) {
      strengths.push('Featured in major authoritative publications');
    }

    const brandRankings = data.rankings.filter((r: SearchRanking) => 
      r.queryType === QueryType.BRAND && r.position === 1
    );
    if (brandRankings.length > 0) {
      strengths.push('Dominates brand-related searches');
    }

    return strengths;
  }

  /**
   * Identify weaknesses based on factors
   */
  private identifyWeaknesses(factors: PredictionFactors, data: any): string[] {
    const weaknesses: string[] = [];

    if (factors.searchVisibility < 30) {
      weaknesses.push('Poor search engine visibility');
    }

    if (factors.authorityScore < 30) {
      weaknesses.push('Low domain authority and limited quality backlinks');
    }

    if (factors.contentRelevance < 30) {
      weaknesses.push('Content not well-aligned with search intent');
    }

    if (factors.competitivePosition < 30) {
      weaknesses.push('Significantly behind competitors in visibility');
    }

    if (data.authorityMetrics.tier1Mentions === 0) {
      weaknesses.push('No presence in tier 1 authoritative sources');
    }

    const coverageRate = data.rankings.filter((r: SearchRanking) => r.position).length / data.rankings.length;
    if (coverageRate < 0.3) {
      weaknesses.push('Low keyword coverage - missing from most searches');
    }

    return weaknesses;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(factors: PredictionFactors, data: any): string[] {
    const recommendations: string[] = [];

    // Search visibility recommendations
    if (factors.searchVisibility < 50) {
      recommendations.push('Improve on-page SEO for target keywords');
      recommendations.push('Create more comprehensive content covering user intent');
    }

    // Authority recommendations
    if (factors.authorityScore < 50) {
      recommendations.push('Develop digital PR strategy to earn high-quality backlinks');
      recommendations.push('Create newsworthy content to attract media coverage');
    }

    // Content relevance recommendations
    if (factors.contentRelevance < 50) {
      recommendations.push('Analyze top-ranking content and identify gaps');
      recommendations.push('Create in-depth guides and resources for informational queries');
    }

    // Competitive recommendations
    if (factors.competitivePosition < 50) {
      recommendations.push('Study competitor content strategies and identify opportunities');
      recommendations.push('Target less competitive long-tail keywords');
    }

    // Specific tactical recommendations
    const informationalRankings = data.rankings.filter((r: SearchRanking) => 
      r.queryType === QueryType.INFORMATIONAL
    );
    if (informationalRankings.length < 5) {
      recommendations.push('Create more educational and how-to content');
    }

    if (data.authorityMetrics.recentMentions < 5) {
      recommendations.push('Increase PR activities for fresh brand mentions');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Determine competitive position
   */
  private determineCompetitivePosition(
    score: number,
    competitors: CompetitorAnalysis[]
  ): 'leader' | 'challenger' | 'follower' | 'niche' {
    if (competitors.length === 0) {
      return score >= 70 ? 'leader' : 'niche';
    }

    const avgCompetitorScore = competitors.reduce((sum, c) => 
      sum + c.visibilityScore, 0
    ) / competitors.length;

    if (score > avgCompetitorScore + 20) {
      return 'leader';
    } else if (score > avgCompetitorScore - 10) {
      return 'challenger';
    } else if (competitors.length > 5 && score < 30) {
      return 'niche';
    } else {
      return 'follower';
    }
  }
}