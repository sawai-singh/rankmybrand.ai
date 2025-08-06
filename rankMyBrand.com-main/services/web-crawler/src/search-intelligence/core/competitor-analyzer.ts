/**
 * Competitor Analyzer
 * Analyzes competitor performance in search results
 */

import { Logger } from '../utils/logger.js';
import { query } from '../../db/index.js';
import {
  CompetitorAnalysis,
  SearchRanking,
  QueryType
} from '../types/search-intelligence.types.js';

export class CompetitorAnalyzer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CompetitorAnalyzer');
  }

  /**
   * Analyze competitors based on search rankings
   */
  async analyzeCompetitors(
    analysisId: string,
    rankings: SearchRanking[],
    knownCompetitors: string[]
  ): Promise<CompetitorAnalysis[]> {
    this.logger.info(`Analyzing competitors for analysis ${analysisId}`);

    // Discover competitors from rankings if not provided
    const competitors = knownCompetitors.length > 0
      ? knownCompetitors
      : this.discoverCompetitors(rankings);

    const analyses: CompetitorAnalysis[] = [];

    for (const competitor of competitors) {
      const analysis = await this.analyzeCompetitor(
        analysisId,
        competitor,
        rankings
      );
      
      if (analysis) {
        analyses.push(analysis);
        await this.saveCompetitorAnalysis(analysis);
      }
    }

    // Sort by visibility score
    analyses.sort((a, b) => b.visibilityScore - a.visibilityScore);

    return analyses;
  }

  /**
   * Analyze a single competitor
   */
  private async analyzeCompetitor(
    analysisId: string,
    competitorDomain: string,
    rankings: SearchRanking[]
  ): Promise<CompetitorAnalysis | null> {
    const competitorRankings = this.getCompetitorRankings(rankings, competitorDomain);
    
    if (competitorRankings.length === 0) {
      return null;
    }

    const totalQueries = rankings.length;
    const rankedQueries = competitorRankings.length;
    
    // Calculate metrics
    const positions = competitorRankings.map(r => r.position);
    const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
    const top3Count = positions.filter(pos => pos <= 3).length;
    const top10Count = positions.filter(pos => pos <= 10).length;
    const notFoundCount = totalQueries - rankedQueries;

    // Calculate visibility score (0-100)
    const visibilityScore = this.calculateCompetitorVisibilityScore({
      totalQueries,
      rankedQueries,
      avgPosition,
      top3Count,
      top10Count
    });

    return {
      id: this.generateId(),
      analysisId,
      competitorDomain,
      avgPosition: Math.round(avgPosition * 10) / 10,
      top3Count,
      top10Count,
      notFoundCount,
      visibilityScore,
      createdAt: new Date()
    };
  }

  /**
   * Get competitor rankings from search results
   */
  private getCompetitorRankings(
    rankings: SearchRanking[],
    competitorDomain: string
  ): Array<{ position: number; queryType: QueryType }> {
    const competitorRankings: Array<{ position: number; queryType: QueryType }> = [];
    
    for (const ranking of rankings) {
      const position = ranking.competitorPositions[competitorDomain];
      if (position) {
        competitorRankings.push({
          position,
          queryType: ranking.queryType
        });
      }
    }

    return competitorRankings;
  }

  /**
   * Discover competitors from search rankings
   */
  private discoverCompetitors(rankings: SearchRanking[]): string[] {
    const domainFrequency = new Map<string, number>();

    // Count domain occurrences
    for (const ranking of rankings) {
      for (const [domain, position] of Object.entries(ranking.competitorPositions)) {
        if (position <= 10) { // Only consider top 10 positions
          domainFrequency.set(domain, (domainFrequency.get(domain) || 0) + 1);
        }
      }
    }

    // Sort by frequency and return top competitors
    const sortedDomains = Array.from(domainFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 competitors
      .map(([domain]) => domain);

    this.logger.info(`Discovered ${sortedDomains.length} competitors from rankings`);
    return sortedDomains;
  }

  /**
   * Calculate competitor visibility score
   */
  private calculateCompetitorVisibilityScore(metrics: {
    totalQueries: number;
    rankedQueries: number;
    avgPosition: number;
    top3Count: number;
    top10Count: number;
  }): number {
    let score = 0;

    // Coverage score (0-40 points)
    const coverageRate = metrics.rankedQueries / metrics.totalQueries;
    score += coverageRate * 40;

    // Position score (0-30 points)
    const positionScore = Math.max(0, 30 - (metrics.avgPosition - 1) * 2);
    score += positionScore;

    // Top placement score (0-30 points)
    const top3Rate = metrics.top3Count / metrics.totalQueries;
    const top10Rate = metrics.top10Count / metrics.totalQueries;
    score += (top3Rate * 20) + (top10Rate * 10);

    return Math.round(Math.min(100, score));
  }

  /**
   * Save competitor analysis to database
   */
  private async saveCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    await db.query(
      `INSERT INTO competitor_analyses 
       (id, analysis_id, competitor_domain, avg_position, top_3_count, 
        top_10_count, not_found_count, visibility_score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        analysis.id,
        analysis.analysisId,
        analysis.competitorDomain,
        analysis.avgPosition,
        analysis.top3Count,
        analysis.top10Count,
        analysis.notFoundCount,
        analysis.visibilityScore,
        analysis.createdAt
      ]
    );
  }

  /**
   * Get competitor analyses for an analysis
   */
  async getCompetitorAnalyses(analysisId: string): Promise<CompetitorAnalysis[]> {
    const result = await query(
      `SELECT * FROM competitor_analyses 
       WHERE analysis_id = $1 
       ORDER BY visibility_score DESC`,
      [analysisId]
    );

    return result.rows.map(row => ({
      id: row.id,
      analysisId: row.analysis_id,
      competitorDomain: row.competitor_domain,
      avgPosition: parseFloat(row.avg_position),
      top3Count: row.top_3_count,
      top10Count: row.top_10_count,
      notFoundCount: row.not_found_count,
      visibilityScore: parseFloat(row.visibility_score),
      createdAt: row.created_at
    }));
  }

  /**
   * Generate competitive insights
   */
  generateCompetitiveInsights(
    targetVisibility: number,
    competitors: CompetitorAnalysis[]
  ): string[] {
    const insights: string[] = [];

    if (competitors.length === 0) {
      insights.push('No significant competitors identified in search results');
      return insights;
    }

    // Find position relative to competitors
    const betterCompetitors = competitors.filter(c => c.visibilityScore > targetVisibility);
    const worseCompetitors = competitors.filter(c => c.visibilityScore <= targetVisibility);

    if (betterCompetitors.length === 0) {
      insights.push('Leading visibility compared to all identified competitors');
    } else if (worseCompetitors.length === 0) {
      insights.push('Trailing all major competitors in search visibility');
    } else {
      insights.push(`Outperforming ${worseCompetitors.length} of ${competitors.length} competitors`);
    }

    // Identify strongest competitor
    const topCompetitor = competitors[0];
    if (topCompetitor.visibilityScore > targetVisibility) {
      const gap = topCompetitor.visibilityScore - targetVisibility;
      insights.push(`${topCompetitor.competitorDomain} leads with ${gap} point visibility advantage`);
    }

    // Analyze competitive gaps
    const avgCompetitorScore = competitors.reduce((sum, c) => sum + c.visibilityScore, 0) / competitors.length;
    if (targetVisibility < avgCompetitorScore - 10) {
      insights.push('Significant visibility gap compared to competitor average');
    } else if (targetVisibility > avgCompetitorScore + 10) {
      insights.push('Strong competitive advantage in search visibility');
    }

    // Top 3 position analysis
    const avgTop3Rate = competitors.reduce((sum, c) => sum + (c.top3Count / c.top10Count), 0) / competitors.length;
    if (avgTop3Rate > 0.5) {
      insights.push('Competitors dominate top 3 positions - focus on high-value keywords');
    }

    return insights;
  }

  /**
   * Get competitive recommendations
   */
  getCompetitiveRecommendations(
    targetMetrics: any,
    competitors: CompetitorAnalysis[]
  ): string[] {
    const recommendations: string[] = [];

    if (competitors.length === 0) {
      return recommendations;
    }

    // Analyze top performer strategies
    const topCompetitor = competitors[0];
    if (topCompetitor.visibilityScore > 70) {
      recommendations.push(`Study ${topCompetitor.competitorDomain}'s content strategy and keyword targeting`);
    }

    // Coverage recommendations
    const avgCoverage = competitors.reduce((sum, c) => 
      sum + ((c.top10Count + c.top3Count) / (c.top10Count + c.top3Count + c.notFoundCount)), 0
    ) / competitors.length;

    if (avgCoverage > 0.5) {
      recommendations.push('Competitors have broad keyword coverage - expand your target keyword list');
    }

    // Position improvement recommendations
    const competitorsWithBetterAvgPosition = competitors.filter(c => 
      c.avgPosition < targetMetrics.avgPosition
    );

    if (competitorsWithBetterAvgPosition.length > competitors.length / 2) {
      recommendations.push('Focus on improving content quality to match competitor ranking positions');
      recommendations.push('Analyze top-ranking competitor pages for content gaps');
    }

    // Specific competitive tactics
    const dominantCompetitors = competitors.filter(c => c.top3Count > 5);
    if (dominantCompetitors.length > 0) {
      recommendations.push('Consider creating comparison content against dominant competitors');
      recommendations.push('Target long-tail variations where competition is less intense');
    }

    return recommendations;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}