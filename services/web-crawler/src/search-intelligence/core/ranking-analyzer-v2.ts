/**
 * Enhanced Ranking Analyzer v2
 * Advanced SERP ranking analysis with AI visibility prediction
 */

import { Logger } from '../../utils/logger.js';
import {
  RankingAnalysisConfig,
  PositionResult,
  UrlPosition,
  SerpFeaturePresence,
  CompetitorPosition,
  VisibilityScore,
  RankingAnalysisResult,
  RankingSummary,
  RankingPatterns,
  RankingOpportunities,
  CompetitorSummary,
  AIVisibilityAnalysis,
  QueryTypePattern,
  ContentGap,
  LowHangingFruit,
  SnippetOpportunity,
  CompetitorGap,
  ContentRecommendation,
  CompetitorPerformance,
  OverlapAnalysis,
  CitationLikelihood,
  AIVisibilityImprovement,
  RankingSnapshot,
  RankingComparison,
  RankingChange
} from '../types/ranking-analyzer.types.js';
import {
  SearchResults,
  SerpResult,
  SerpFeatures,
  QueryType,
  GeneratedQuery
} from '../types/search-intelligence.types.js';
import {
  getCTR,
  getPositionValue,
  getAICitationLikelihood,
  SERP_FEATURE_IMPACT,
  OPPORTUNITY_SCORES,
  DIFFICULTY_FACTORS
} from '../data/ctr-curves.js';

export class EnhancedRankingAnalyzer {
  private logger: Logger;
  private config: RankingAnalysisConfig;
  private snapshots: Map<string, RankingSnapshot> = new Map();

  constructor(config: RankingAnalysisConfig) {
    this.logger = new Logger('EnhancedRankingAnalyzer');
    this.config = config;
  }

  /**
   * Analyze rankings for multiple queries
   */
  async analyzeRankings(
    queries: GeneratedQuery[],
    searchResults: Map<string, SearchResults>
  ): Promise<RankingAnalysisResult> {
    this.logger.info(`Analyzing rankings for ${queries.length} queries across ${searchResults.size} results`);

    const rankings: PositionResult[] = [];
    
    // Process each query
    for (const query of queries) {
      const results = searchResults.get(query.query);
      if (!results) {
        this.logger.warn(`No search results for query: ${query.query}`);
        continue;
      }

      const positionResult = this.analyzeQueryRanking(query, results);
      rankings.push(positionResult);
    }

    // Generate comprehensive analysis
    const summary = this.generateSummary(rankings);
    const patterns = this.identifyPatterns(rankings, queries);
    const opportunities = this.findOpportunities(rankings, patterns);
    const competitorAnalysis = this.analyzeCompetitors(rankings);
    const aiVisibility = this.predictAIVisibility(rankings, summary, patterns);

    // Save snapshot for historical comparison
    this.saveSnapshot(rankings);

    const result: RankingAnalysisResult = {
      domain: this.config.targetDomain,
      totalQueries: queries.length,
      queriesAnalyzed: rankings.length,
      rankings,
      summary,
      patterns,
      opportunities,
      competitorAnalysis,
      aiVisibilityPrediction: aiVisibility
    };

    this.logger.info(`Analysis complete: ${summary.totalRankings} rankings found, avg position: ${summary.averagePosition.toFixed(1)}`);

    return result;
  }

  /**
   * Analyze ranking for a single query
   */
  private analyzeQueryRanking(
    query: GeneratedQuery,
    results: SearchResults
  ): PositionResult {
    // Find all positions for target domain
    const domainPositions = this.findDomainPositions(results.results);
    const primaryPosition = domainPositions.length > 0 ? domainPositions[0] : null;
    
    // Analyze SERP features in detail
    const serpFeatures = this.analyzeSerpFeatures(results.features, results.results);
    
    // Find and analyze competitor positions
    const competitorPositions = this.findCompetitorPositions(results.results);
    
    // Calculate comprehensive visibility score
    const visibilityScore = this.calculateVisibilityScore(
      primaryPosition,
      serpFeatures,
      competitorPositions,
      query.type
    );

    return {
      query: query.query,
      queryType: query.type,
      position: primaryPosition?.position || null,
      url: primaryPosition?.url || null,
      isHomepage: primaryPosition ? this.isHomepage(primaryPosition.url) : false,
      multipleUrls: domainPositions,
      serpFeatures,
      competitorPositions,
      visibilityScore,
      timestamp: new Date()
    };
  }

  /**
   * Find all positions for target domain with subdomain support
   */
  private findDomainPositions(results: SerpResult[]): UrlPosition[] {
    const positions: UrlPosition[] = [];
    
    for (const result of results) {
      if (this.isDomainMatch(result.domain)) {
        positions.push({
          position: result.position,
          url: result.url,
          title: result.title,
          snippet: result.snippet,
          isAd: result.isAd
        });
      }
    }
    
    return positions.sort((a, b) => a.position - b.position);
  }

  /**
   * Enhanced domain matching with subdomain support
   */
  private isDomainMatch(domain: string): boolean {
    const target = this.config.targetDomain.toLowerCase().replace(/^www\./, '');
    const check = domain.toLowerCase().replace(/^www\./, '');
    
    // Exact match
    if (check === target) {
      return true;
    }
    
    // Subdomain matching if enabled
    if (this.config.includeSubdomains) {
      // Check if it's a subdomain of target
      if (check.endsWith(`.${target}`)) {
        return true;
      }
      // Check if target is subdomain of check (for cases like blog.example.com vs example.com)
      if (target.endsWith(`.${check}`)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if URL is homepage
   */
  private isHomepage(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      return path === '/' || path === '' || path === '/index.html' || path === '/index.php';
    } catch {
      return false;
    }
  }

  /**
   * Comprehensive SERP features analysis
   */
  private analyzeSerpFeatures(
    features: SerpFeatures,
    results: SerpResult[]
  ): SerpFeaturePresence {
    const adsCount = results.filter(r => r.isAd).length;
    const topOrganicDomain = results.find(r => !r.isAd)?.domain || '';
    
    // Check featured snippet ownership
    let featuredSnippetIsOurs = false;
    let featuredSnippetUrl: string | undefined;
    
    if (features.hasFeaturedSnippet && topOrganicDomain) {
      featuredSnippetIsOurs = this.isDomainMatch(topOrganicDomain);
      if (featuredSnippetIsOurs) {
        featuredSnippetUrl = results.find(r => !r.isAd)?.url;
      }
    }
    
    // Check knowledge panel (would need additional data in real implementation)
    const knowledgePanelIsOurs = false; // Placeholder
    
    return {
      hasFeaturedSnippet: features.hasFeaturedSnippet,
      featuredSnippetUrl,
      featuredSnippetIsOurs,
      hasKnowledgePanel: features.hasKnowledgePanel,
      knowledgePanelIsOurs,
      hasLocalPack: features.hasLocalPack,
      localPackPosition: undefined, // Would need additional data
      hasImageCarousel: features.hasImagePack,
      hasVideoResults: features.hasVideoCarousel,
      hasPeopleAlsoAsk: features.hasPeopleAlsoAsk,
      hasShoppingResults: features.hasShoppingResults,
      hasNewsResults: features.hasNewsResults,
      hasTwitterResults: features.hasTwitterResults || false,
      totalOrganicResults: features.totalOrganicResults,
      adsCount
    };
  }

  /**
   * Find competitor positions with detailed analysis
   */
  private findCompetitorPositions(results: SerpResult[]): CompetitorPosition[] {
    const positions: CompetitorPosition[] = [];
    const processedDomains = new Set<string>();
    
    for (const result of results) {
      const normalizedDomain = result.domain.toLowerCase();
      
      // Skip if already processed or is an ad
      if (processedDomains.has(normalizedDomain) || result.isAd) {
        continue;
      }
      
      if (this.isCompetitor(result.domain)) {
        processedDomains.add(normalizedDomain);
        positions.push({
          domain: result.domain,
          position: result.position,
          url: result.url,
          title: result.title,
          hasSerpFeatures: result.position === 1 // Simplified - would need more data
        });
      }
    }
    
    return positions.sort((a, b) => a.position - b.position);
  }

  /**
   * Enhanced competitor detection
   */
  private isCompetitor(domain: string): boolean {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    
    return this.config.competitors.some(comp => {
      const normalizedComp = comp.toLowerCase().replace(/^www\./, '');
      return normalizedDomain === normalizedComp || 
             normalizedDomain.includes(normalizedComp) ||
             normalizedComp.includes(normalizedDomain);
    });
  }

  /**
   * Calculate comprehensive visibility score
   */
  private calculateVisibilityScore(
    position: UrlPosition | null,
    serpFeatures: SerpFeaturePresence,
    competitors: CompetitorPosition[],
    queryType: QueryType
  ): VisibilityScore {
    const pos = position?.position || null;
    const competitorCount = pos ? competitors.filter(c => c.position < pos).length : competitors.length;
    
    // Calculate estimated CTR
    const ctr = pos ? getCTR(
      pos,
      serpFeatures.hasFeaturedSnippet && !serpFeatures.featuredSnippetIsOurs,
      serpFeatures.adsCount > 0
    ) : 0;
    
    // Calculate SERP feature boost/penalty
    let serpFeatureBoost = 0;
    
    if (serpFeatures.featuredSnippetIsOurs) {
      serpFeatureBoost += SERP_FEATURE_IMPACT.featuredSnippet.ownFeature;
    } else if (serpFeatures.hasFeaturedSnippet) {
      serpFeatureBoost += SERP_FEATURE_IMPACT.featuredSnippet.otherHasFeature;
    }
    
    if (serpFeatures.knowledgePanelIsOurs) {
      serpFeatureBoost += SERP_FEATURE_IMPACT.knowledgePanel.ownFeature;
    } else if (serpFeatures.hasKnowledgePanel) {
      serpFeatureBoost += SERP_FEATURE_IMPACT.knowledgePanel.otherHasFeature;
    }
    
    // Ads penalty
    serpFeatureBoost += serpFeatures.adsCount * SERP_FEATURE_IMPACT.ads.perAd;
    
    // Calculate overall visibility score (0-100)
    const positionValue = pos ? getPositionValue(pos) : 0;
    const competitorPenalty = competitorCount * 5;
    const visibilityScore = Math.max(0, Math.min(100, 
      positionValue + serpFeatureBoost - competitorPenalty
    ));
    
    // Calculate AI citation likelihood
    const aiCitationLikelihood = pos ? 
      getAICitationLikelihood(
        pos,
        queryType,
        serpFeatures.featuredSnippetIsOurs || serpFeatures.knowledgePanelIsOurs,
        competitorCount
      ) * 100 : 0;
    
    return {
      position: pos,
      clickThroughRate: ctr,
      serpFeatureBoost,
      competitorCount,
      visibilityScore,
      aiCitationLikelihood
    };
  }

  /**
   * Generate comprehensive summary statistics
   */
  private generateSummary(rankings: PositionResult[]): RankingSummary {
    const ranked = rankings.filter(r => r.position !== null);
    const positions = ranked.map(r => r.position!);
    
    const summary: RankingSummary = {
      totalRankings: ranked.length,
      averagePosition: positions.length > 0 ? 
        positions.reduce((a, b) => a + b, 0) / positions.length : 0,
      top3Count: ranked.filter(r => r.position! <= 3).length,
      top10Count: ranked.filter(r => r.position! <= 10).length,
      top20Count: ranked.filter(r => r.position! <= 20).length,
      notRankingCount: rankings.filter(r => r.position === null).length,
      featuredSnippets: rankings.filter(r => r.serpFeatures.featuredSnippetIsOurs).length,
      knowledgePanels: rankings.filter(r => r.serpFeatures.knowledgePanelIsOurs).length,
      multipleUrlsCount: rankings.filter(r => r.multipleUrls.length > 1).length,
      homepageRankings: rankings.filter(r => r.isHomepage).length
    };
    
    // Round average position
    summary.averagePosition = Math.round(summary.averagePosition * 10) / 10;
    
    return summary;
  }

  /**
   * Identify ranking patterns and trends
   */
  private identifyPatterns(
    rankings: PositionResult[],
    queries: GeneratedQuery[]
  ): RankingPatterns {
    // Analyze by query type
    const byQueryType = this.analyzeByQueryType(rankings);
    
    // Position distribution
    const positionDistribution = {
      position1_3: rankings.filter(r => r.position && r.position <= 3).length,
      position4_10: rankings.filter(r => r.position && r.position >= 4 && r.position <= 10).length,
      position11_20: rankings.filter(r => r.position && r.position >= 11 && r.position <= 20).length,
      position21_plus: rankings.filter(r => r.position && r.position > 20).length,
      notRanking: rankings.filter(r => r.position === null).length
    };
    
    // SERP feature correlation
    const serpFeatureCorrelation = {
      featuredSnippetQueries: rankings
        .filter(r => r.serpFeatures.hasFeaturedSnippet)
        .map(r => r.query),
      knowledgePanelQueries: rankings
        .filter(r => r.serpFeatures.hasKnowledgePanel)
        .map(r => r.query),
      highCompetitionQueries: rankings
        .filter(r => this.countSerpFeatures(r.serpFeatures) >= 5)
        .map(r => r.query),
      cleanSerpQueries: rankings
        .filter(r => this.countSerpFeatures(r.serpFeatures) <= 2)
        .map(r => r.query)
    };
    
    // Identify content gaps
    const contentGaps = this.identifyContentGaps(rankings, queries);
    
    return {
      byQueryType,
      positionDistribution,
      serpFeatureCorrelation,
      contentGaps
    };
  }

  /**
   * Analyze performance by query type
   */
  private analyzeByQueryType(rankings: PositionResult[]): Map<QueryType, QueryTypePattern> {
    const byQueryType = new Map<QueryType, QueryTypePattern>();
    
    for (const queryType of Object.values(QueryType)) {
      const typeRankings = rankings.filter(r => r.queryType === queryType);
      if (typeRankings.length === 0) continue;
      
      const ranked = typeRankings.filter(r => r.position !== null);
      const positions = ranked.map(r => r.position!);
      
      // Find dominant competitors
      const competitorCounts = new Map<string, number>();
      typeRankings.forEach(r => {
        r.competitorPositions.forEach(c => {
          if (!r.position || c.position < r.position) {
            competitorCounts.set(c.domain, (competitorCounts.get(c.domain) || 0) + 1);
          }
        });
      });
      
      const dominantCompetitors = Array.from(competitorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([domain]) => domain);
      
      byQueryType.set(queryType, {
        queryType,
        averagePosition: positions.length > 0 ? 
          positions.reduce((a, b) => a + b, 0) / positions.length : 0,
        rankingRate: typeRankings.length > 0 ? ranked.length / typeRankings.length : 0,
        topPositions: ranked.filter(r => r.position! <= 3).length,
        dominantCompetitors
      });
    }
    
    return byQueryType;
  }

  /**
   * Count SERP features
   */
  private countSerpFeatures(features: SerpFeaturePresence): number {
    let count = 0;
    if (features.hasFeaturedSnippet) count++;
    if (features.hasKnowledgePanel) count++;
    if (features.hasLocalPack) count++;
    if (features.hasImageCarousel) count++;
    if (features.hasVideoResults) count++;
    if (features.hasPeopleAlsoAsk) count++;
    if (features.hasShoppingResults) count++;
    if (features.hasNewsResults) count++;
    if (features.hasTwitterResults) count++;
    count += features.adsCount;
    return count;
  }

  /**
   * Identify content gaps where competitors rank but we don't
   */
  private identifyContentGaps(
    rankings: PositionResult[],
    queries: GeneratedQuery[]
  ): ContentGap[] {
    const gaps: ContentGap[] = [];
    
    const notRanking = rankings.filter(r => r.position === null && r.competitorPositions.length > 0);
    
    for (const ranking of notRanking) {
      const query = queries.find(q => q.query === ranking.query);
      const topCompetitor = ranking.competitorPositions[0];
      
      gaps.push({
        query: ranking.query,
        queryType: ranking.queryType,
        competitorCount: ranking.competitorPositions.length,
        topCompetitor: topCompetitor.domain,
        estimatedDifficulty: this.estimateDifficulty(
          ranking.competitorPositions,
          ranking.serpFeatures
        ),
        opportunityScore: this.calculateOpportunityScore(
          ranking,
          query?.priority || 'medium',
          query?.aiRelevance || 5
        )
      });
    }
    
    return gaps.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  /**
   * Estimate ranking difficulty
   */
  private estimateDifficulty(
    competitors: CompetitorPosition[],
    serpFeatures: SerpFeaturePresence
  ): number {
    let difficulty = 5;
    
    // Competition density factor
    if (competitors.length <= 3) {
      difficulty *= DIFFICULTY_FACTORS.competitionDensity.low.multiplier;
    } else if (competitors.length <= 6) {
      difficulty *= DIFFICULTY_FACTORS.competitionDensity.medium.multiplier;
    } else if (competitors.length <= 10) {
      difficulty *= DIFFICULTY_FACTORS.competitionDensity.high.multiplier;
    } else {
      difficulty *= DIFFICULTY_FACTORS.competitionDensity.extreme.multiplier;
    }
    
    // SERP complexity factor
    const featureCount = this.countSerpFeatures(serpFeatures);
    if (featureCount <= 2) {
      difficulty *= DIFFICULTY_FACTORS.serpComplexity.clean.multiplier;
    } else if (featureCount <= 4) {
      difficulty *= DIFFICULTY_FACTORS.serpComplexity.moderate.multiplier;
    } else if (featureCount <= 6) {
      difficulty *= DIFFICULTY_FACTORS.serpComplexity.complex.multiplier;
    } else {
      difficulty *= DIFFICULTY_FACTORS.serpComplexity.saturated.multiplier;
    }
    
    return Math.min(10, Math.max(1, Math.round(difficulty)));
  }

  /**
   * Calculate opportunity score
   */
  private calculateOpportunityScore(
    ranking: PositionResult,
    priority: string,
    aiRelevance: number
  ): number {
    let score = 50;
    
    // Priority weighting
    if (priority === 'high') score += 20;
    else if (priority === 'low') score -= 10;
    
    // AI relevance boost
    score += (aiRelevance / 10) * 15;
    
    // Competition value
    if (ranking.competitorPositions.length > 5) {
      score += 10; // High competition indicates valuable query
    }
    
    // Query type bonus
    if (ranking.queryType === QueryType.BRAND) {
      score += 20; // Must rank for brand queries
    } else if (ranking.queryType === QueryType.COMPARISON) {
      score += 15; // High conversion value
    } else if (ranking.queryType === QueryType.LONG_TAIL) {
      score += 10; // AI-friendly queries
    }
    
    // SERP feature opportunities
    if (ranking.serpFeatures.hasFeaturedSnippet && !ranking.serpFeatures.featuredSnippetIsOurs) {
      score += 15;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Find ranking opportunities
   */
  private findOpportunities(
    rankings: PositionResult[],
    patterns: RankingPatterns
  ): RankingOpportunities {
    const lowHangingFruit = this.findLowHangingFruit(rankings);
    const featuredSnippetOpportunities = this.findSnippetOpportunities(rankings);
    const competitorGaps = this.findCompetitorGaps(patterns.contentGaps, rankings);
    const contentRecommendations = this.generateContentRecommendations(rankings, patterns);
    
    return {
      lowHangingFruit,
      featuredSnippetOpportunities,
      competitorGaps,
      contentRecommendations
    };
  }

  /**
   * Find low hanging fruit opportunities
   */
  private findLowHangingFruit(rankings: PositionResult[]): LowHangingFruit[] {
    return rankings
      .filter(r => r.position && r.position >= 11 && r.position <= 20)
      .map(r => ({
        query: r.query,
        currentPosition: r.position!,
        url: r.url!,
        estimatedEffort: this.estimateImprovementEffort(r),
        potentialTrafficGain: this.estimateTrafficGain(r.position!, 7),
        recommendations: this.getImprovementRecommendations(r)
      }))
      .sort((a, b) => b.potentialTrafficGain - a.potentialTrafficGain)
      .slice(0, 10);
  }

  /**
   * Estimate improvement effort
   */
  private estimateImprovementEffort(ranking: PositionResult): 'low' | 'medium' | 'high' {
    if (ranking.position! <= 13) return 'low';
    if (ranking.position! <= 17) return 'medium';
    return 'high';
  }

  /**
   * Estimate traffic gain from position improvement
   */
  private estimateTrafficGain(currentPos: number, targetPos: number): number {
    const currentCTR = getCTR(currentPos);
    const targetCTR = getCTR(targetPos);
    const gain = targetCTR - currentCTR;
    
    // Assuming 1000 searches/month for simplicity
    return Math.round(gain * 1000);
  }

  /**
   * Get improvement recommendations
   */
  private getImprovementRecommendations(ranking: PositionResult): string[] {
    const recommendations: string[] = [];
    
    if (ranking.position! > 10) {
      recommendations.push('Improve content depth and comprehensiveness');
      recommendations.push('Add more internal links from high-authority pages');
      recommendations.push('Optimize meta title and description');
    }
    
    if (!ranking.serpFeatures.featuredSnippetIsOurs && ranking.serpFeatures.hasFeaturedSnippet) {
      recommendations.push('Structure content to target featured snippet');
      recommendations.push('Add FAQ section with direct answers');
    }
    
    if (ranking.competitorPositions.length > 5) {
      recommendations.push('Analyze top 3 competitor content for gaps');
      recommendations.push('Build more topical authority with related content');
    }
    
    if (!ranking.isHomepage && ranking.position! > 15) {
      recommendations.push('Consider consolidating with stronger pages');
    }
    
    return recommendations;
  }

  /**
   * Find featured snippet opportunities
   */
  private findSnippetOpportunities(rankings: PositionResult[]): SnippetOpportunity[] {
    return rankings
      .filter(r => 
        r.position && 
        r.position <= 10 && 
        r.serpFeatures.hasFeaturedSnippet && 
        !r.serpFeatures.featuredSnippetIsOurs
      )
      .map(r => ({
        query: r.query,
        currentPosition: r.position!,
        currentSnippetHolder: r.competitorPositions.find(c => c.position === 1)?.domain || 'Unknown',
        snippetType: this.detectSnippetType(r.query),
        recommendations: this.getSnippetRecommendations(r.queryType)
      }))
      .slice(0, 10);
  }

  /**
   * Detect likely snippet type
   */
  private detectSnippetType(query: string): 'paragraph' | 'list' | 'table' {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('why')) {
      return 'paragraph';
    }
    if (lowerQuery.includes('best') || lowerQuery.includes('top') || lowerQuery.includes('list')) {
      return 'list';
    }
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('difference')) {
      return 'table';
    }
    
    return 'paragraph';
  }

  /**
   * Get snippet-specific recommendations
   */
  private getSnippetRecommendations(queryType: QueryType): string[] {
    const general = [
      'Add clear, concise answer in first paragraph',
      'Use the question as an H2 heading',
      'Include structured data markup',
      'Keep answer length between 40-60 words'
    ];
    
    if (queryType === QueryType.INFORMATIONAL) {
      return [
        ...general,
        'Create step-by-step instructions',
        'Use numbered or bulleted lists'
      ];
    }
    
    if (queryType === QueryType.COMPARISON) {
      return [
        ...general,
        'Create comparison table',
        'List pros and cons clearly'
      ];
    }
    
    return general;
  }

  /**
   * Find competitor gaps
   */
  private findCompetitorGaps(
    contentGaps: ContentGap[],
    rankings: PositionResult[]
  ): CompetitorGap[] {
    return contentGaps
      .slice(0, 10)
      .map(gap => {
        const ranking = rankings.find(r => r.query === gap.query);
        return {
          query: gap.query,
          competitors: ranking?.competitorPositions.map(c => c.domain) || [gap.topCompetitor],
          theirBestPosition: ranking?.competitorPositions[0]?.position || 1,
          opportunity: this.determineOpportunityType(gap.estimatedDifficulty)
        };
      });
  }

  /**
   * Determine opportunity type based on difficulty
   */
  private determineOpportunityType(difficulty: number): 'create-content' | 'improve-content' | 'build-authority' {
    if (difficulty < 4) return 'create-content';
    if (difficulty < 7) return 'improve-content';
    return 'build-authority';
  }

  /**
   * Generate content recommendations
   */
  private generateContentRecommendations(
    rankings: PositionResult[],
    patterns: RankingPatterns
  ): ContentRecommendation[] {
    const recommendations: ContentRecommendation[] = [];
    
    // New content for gaps
    if (patterns.contentGaps.length > 5) {
      recommendations.push({
        type: 'new-content',
        priority: 'high',
        queries: patterns.contentGaps.slice(0, 5).map(g => g.query),
        description: 'Create comprehensive content targeting high-opportunity gap queries',
        estimatedImpact: 8
      });
    }
    
    // Content updates for poor rankings
    const poorRankings = rankings.filter(r => r.position && r.position > 10);
    if (poorRankings.length > 0) {
      recommendations.push({
        type: 'content-update',
        priority: 'medium',
        queries: poorRankings.slice(0, 5).map(r => r.query),
        description: 'Update and expand existing content to improve rankings',
        estimatedImpact: 6
      });
    }
    
    // Technical SEO for multiple URLs
    const multiUrlQueries = rankings.filter(r => r.multipleUrls.length > 1);
    if (multiUrlQueries.length > 3) {
      recommendations.push({
        type: 'technical-seo',
        priority: 'medium',
        queries: multiUrlQueries.slice(0, 5).map(r => r.query),
        description: 'Consolidate duplicate content and implement canonical tags',
        estimatedImpact: 5
      });
    }
    
    // Link building for high competition
    const highCompetition = rankings.filter(r => 
      r.competitorPositions.length > 5 && 
      (!r.position || r.position > 5)
    );
    if (highCompetition.length > 0) {
      recommendations.push({
        type: 'link-building',
        priority: 'low',
        queries: highCompetition.slice(0, 5).map(r => r.query),
        description: 'Build authoritative backlinks to compete in difficult SERPs',
        estimatedImpact: 7
      });
    }
    
    return recommendations.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  /**
   * Analyze competitors comprehensively
   */
  private analyzeCompetitors(rankings: PositionResult[]): CompetitorSummary {
    const competitors: CompetitorPerformance[] = [];
    const dominanceMap = new Map<string, string[]>();
    const weaknessMap = new Map<string, string[]>();
    
    // Analyze each competitor
    for (const competitor of this.config.competitors) {
      const performance = this.analyzeCompetitorPerformance(competitor, rankings);
      competitors.push(performance);
      
      // Track where they dominate
      const dominated = rankings
        .filter(r => {
          const compPos = r.competitorPositions.find(c => 
            c.domain.toLowerCase().includes(competitor.toLowerCase())
          );
          return compPos && (!r.position || compPos.position < r.position);
        })
        .map(r => r.query);
      
      if (dominated.length > 0) {
        dominanceMap.set(competitor, dominated);
      }
      
      // Track where we beat them
      const weakness = rankings
        .filter(r => {
          const compPos = r.competitorPositions.find(c => 
            c.domain.toLowerCase().includes(competitor.toLowerCase())
          );
          return r.position && compPos && r.position < compPos.position;
        })
        .map(r => r.query);
      
      if (weakness.length > 0) {
        weaknessMap.set(competitor, weakness);
      }
    }
    
    const overlapAnalysis = this.calculateOverlapAnalysis(rankings);
    
    return {
      competitors,
      dominanceMap,
      weaknessMap,
      overlapAnalysis
    };
  }

  /**
   * Analyze individual competitor performance
   */
  private analyzeCompetitorPerformance(
    competitor: string,
    rankings: PositionResult[]
  ): CompetitorPerformance {
    let queriesRanking = 0;
    let totalPosition = 0;
    let top3Count = 0;
    let winsAgainstUs = 0;
    let lossesToUs = 0;
    let serpFeatureWins = 0;
    
    for (const ranking of rankings) {
      const compPos = ranking.competitorPositions.find(c => 
        c.domain.toLowerCase().includes(competitor.toLowerCase())
      );
      
      if (!compPos) continue;
      
      queriesRanking++;
      totalPosition += compPos.position;
      
      if (compPos.position <= 3) top3Count++;
      
      if (!ranking.position || compPos.position < ranking.position) {
        winsAgainstUs++;
      } else {
        lossesToUs++;
      }
      
      if (compPos.hasSerpFeatures) {
        serpFeatureWins++;
      }
    }
    
    return {
      domain: competitor,
      queriesRanking,
      averagePosition: queriesRanking > 0 ? totalPosition / queriesRanking : 0,
      top3Count,
      winsAgainstUs,
      lossesToUs,
      serpFeatureWins
    };
  }

  /**
   * Calculate overlap analysis
   */
  private calculateOverlapAnalysis(rankings: PositionResult[]): OverlapAnalysis {
    const weRank = rankings.filter(r => r.position !== null).length;
    const theyRank = new Map<string, number>();
    let totalOverlap = 0;
    let headToHeadWins = 0;
    let headToHeadLosses = 0;
    
    for (const ranking of rankings) {
      const hasUs = ranking.position !== null;
      const competitors = ranking.competitorPositions;
      
      if (hasUs && competitors.length > 0) {
        totalOverlap++;
        const bestCompetitor = competitors[0];
        if (ranking.position! < bestCompetitor.position) {
          headToHeadWins++;
        } else {
          headToHeadLosses++;
        }
      }
      
      // Count exclusive competitor rankings
      if (!hasUs) {
        competitors.forEach(c => {
          theyRank.set(c.domain, (theyRank.get(c.domain) || 0) + 1);
        });
      }
    }
    
    return {
      totalOverlap,
      exclusiveToUs: weRank - totalOverlap,
      exclusiveToThem: theyRank,
      headToHeadWins,
      headToHeadLosses
    };
  }

  /**
   * Predict AI visibility with detailed analysis
   */
  private predictAIVisibility(
    rankings: PositionResult[],
    summary: RankingSummary,
    patterns: RankingPatterns
  ): AIVisibilityAnalysis {
    // Calculate citation likelihood distribution
    let high = 0, medium = 0, low = 0;
    
    rankings.forEach(ranking => {
      const likelihood = ranking.visibilityScore.aiCitationLikelihood;
      if (likelihood > 70) high++;
      else if (likelihood > 40) medium++;
      else low++;
    });
    
    const total = rankings.length || 1;
    
    // Calculate factors
    const citationLikelihood: CitationLikelihood = {
      high: (high / total) * 100,
      medium: (medium / total) * 100,
      low: (low / total) * 100,
      factors: {
        positionStrength: this.calculatePositionStrength(summary, total),
        serpFeaturePresence: this.calculateSerpFeatureStrength(summary, total),
        contentAuthority: this.calculateContentAuthority(summary, patterns),
        competitiveLandscape: this.calculateCompetitiveLandscape(rankings)
      }
    };
    
    // Calculate overall AI visibility score
    const overallScore = this.calculateOverallAIScore(citationLikelihood);
    
    // Generate insights
    const { strengths, weaknesses } = this.generateAIInsights(
      rankings, 
      summary, 
      patterns, 
      citationLikelihood
    );
    
    // Generate improvement recommendations
    const improvements = this.generateAIImprovements(
      rankings, 
      overallScore, 
      citationLikelihood
    );
    
    return {
      overallScore,
      citationLikelihood,
      strengths,
      weaknesses,
      improvements
    };
  }

  /**
   * Calculate position strength factor
   */
  private calculatePositionStrength(summary: RankingSummary, total: number): number {
    if (total === 0) return 0;
    
    const top3Weight = 100;
    const top10Weight = 60;
    const top20Weight = 30;
    
    const score = (
      (summary.top3Count * top3Weight) +
      ((summary.top10Count - summary.top3Count) * top10Weight) +
      ((summary.top20Count - summary.top10Count) * top20Weight)
    ) / total;
    
    return Math.min(100, score);
  }

  /**
   * Calculate SERP feature strength
   */
  private calculateSerpFeatureStrength(summary: RankingSummary, total: number): number {
    if (total === 0) return 0;
    
    const featureScore = (
      (summary.featuredSnippets * 100) +
      (summary.knowledgePanels * 80)
    ) / total;
    
    return Math.min(100, featureScore);
  }

  /**
   * Calculate content authority
   */
  private calculateContentAuthority(
    summary: RankingSummary, 
    patterns: RankingPatterns
  ): number {
    let score = 50; // Base score
    
    // Position-based authority
    if (summary.averagePosition > 0 && summary.averagePosition <= 5) {
      score += 30;
    } else if (summary.averagePosition <= 10) {
      score += 20;
    } else if (summary.averagePosition <= 20) {
      score += 10;
    }
    
    // Homepage ranking bonus
    if (summary.homepageRankings > summary.totalRankings * 0.3) {
      score += 10;
    }
    
    // Penalty for content gaps
    if (patterns.contentGaps.length > 10) {
      score -= 20;
    } else if (patterns.contentGaps.length > 5) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate competitive landscape score
   */
  private calculateCompetitiveLandscape(rankings: PositionResult[]): number {
    let totalCompetitors = 0;
    let competitorsAhead = 0;
    
    rankings.forEach(ranking => {
      totalCompetitors += ranking.competitorPositions.length;
      competitorsAhead += ranking.visibilityScore.competitorCount;
    });
    
    const avgCompetition = rankings.length > 0 ? totalCompetitors / rankings.length : 0;
    const avgAhead = rankings.length > 0 ? competitorsAhead / rankings.length : 0;
    
    // Lower competition = higher score
    let score = 100 - (avgCompetition * 10) - (avgAhead * 15);
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate overall AI visibility score
   */
  private calculateOverallAIScore(citation: CitationLikelihood): number {
    const weights = {
      positionStrength: 0.35,
      serpFeaturePresence: 0.25,
      contentAuthority: 0.25,
      competitiveLandscape: 0.15
    };
    
    const score = 
      (citation.factors.positionStrength * weights.positionStrength) +
      (citation.factors.serpFeaturePresence * weights.serpFeaturePresence) +
      (citation.factors.contentAuthority * weights.contentAuthority) +
      (citation.factors.competitiveLandscape * weights.competitiveLandscape);
    
    return Math.round(score);
  }

  /**
   * Generate AI visibility insights
   */
  private generateAIInsights(
    rankings: PositionResult[],
    summary: RankingSummary,
    patterns: RankingPatterns,
    citation: CitationLikelihood
  ): { strengths: string[], weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Strengths
    if (summary.top3Count > rankings.length * 0.25) {
      strengths.push(`Strong top 3 presence (${summary.top3Count} queries)`);
    }
    if (summary.featuredSnippets > 0) {
      strengths.push(`Own ${summary.featuredSnippets} featured snippets`);
    }
    if (citation.high > 30) {
      strengths.push(`${Math.round(citation.high)}% of queries have high AI citation likelihood`);
    }
    if (summary.averagePosition < 5) {
      strengths.push(`Excellent average position (${summary.averagePosition.toFixed(1)})`);
    }
    
    // Weaknesses
    if (summary.notRankingCount > rankings.length * 0.3) {
      weaknesses.push(`Not ranking for ${summary.notRankingCount} important queries`);
    }
    if (summary.averagePosition > 10) {
      weaknesses.push(`Poor average position (${summary.averagePosition.toFixed(1)})`);
    }
    if (patterns.contentGaps.length > 10) {
      weaknesses.push(`${patterns.contentGaps.length} significant content gaps identified`);
    }
    if (citation.low > 50) {
      weaknesses.push(`${Math.round(citation.low)}% of queries have low AI visibility`);
    }
    
    return { strengths, weaknesses };
  }

  /**
   * Generate AI visibility improvements
   */
  private generateAIImprovements(
    rankings: PositionResult[],
    currentScore: number,
    citation: CitationLikelihood
  ): AIVisibilityImprovement[] {
    const improvements: AIVisibilityImprovement[] = [];
    
    // Improve low-hanging fruit
    const improvable = rankings.filter(r => 
      r.position && r.position > 10 && r.position <= 20
    );
    if (improvable.length > 0) {
      improvements.push({
        action: 'Move position 11-20 queries to first page',
        impact: 'high',
        queries: improvable.slice(0, 5).map(r => r.query),
        currentScore,
        potentialScore: currentScore + 15
      });
    }
    
    // Target featured snippets
    const snippetTargets = rankings.filter(r => 
      r.position && 
      r.position <= 10 && 
      r.serpFeatures.hasFeaturedSnippet && 
      !r.serpFeatures.featuredSnippetIsOurs
    );
    if (snippetTargets.length > 0) {
      improvements.push({
        action: 'Optimize for featured snippets',
        impact: 'medium',
        queries: snippetTargets.slice(0, 5).map(r => r.query),
        currentScore,
        potentialScore: currentScore + 10
      });
    }
    
    // Create content for gaps
    if (citation.factors.contentAuthority < 50) {
      improvements.push({
        action: 'Create authoritative content for gap queries',
        impact: 'high',
        queries: rankings
          .filter(r => !r.position)
          .slice(0, 5)
          .map(r => r.query),
        currentScore,
        potentialScore: currentScore + 20
      });
    }
    
    return improvements.sort((a, b) => 
      (b.potentialScore - b.currentScore) - (a.potentialScore - a.currentScore)
    );
  }

  /**
   * Save ranking snapshot for historical comparison
   */
  private saveSnapshot(rankings: PositionResult[]): void {
    const snapshot: RankingSnapshot = {
      id: `snapshot_${Date.now()}`,
      domain: this.config.targetDomain,
      timestamp: new Date(),
      rankings: new Map(rankings.map(r => [r.query, r.position || -1])),
      summary: {
        totalQueries: rankings.length,
        averagePosition: this.calculateAveragePosition(rankings),
        visibilityScore: this.calculateSnapshotVisibility(rankings)
      }
    };
    
    this.snapshots.set(snapshot.id, snapshot);
    
    // Keep only last 10 snapshots
    if (this.snapshots.size > 10) {
      const oldest = Array.from(this.snapshots.values())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      this.snapshots.delete(oldest.id);
    }
  }

  /**
   * Calculate average position for snapshot
   */
  private calculateAveragePosition(rankings: PositionResult[]): number {
    const positions = rankings
      .filter(r => r.position !== null)
      .map(r => r.position!);
    
    return positions.length > 0 ? 
      positions.reduce((a, b) => a + b, 0) / positions.length : 0;
  }

  /**
   * Calculate visibility score for snapshot
   */
  private calculateSnapshotVisibility(rankings: PositionResult[]): number {
    const scores = rankings.map(r => r.visibilityScore.visibilityScore);
    return scores.length > 0 ? 
      scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  /**
   * Compare current rankings with historical snapshot
   */
  compareWithSnapshot(snapshotId: string, currentRankings: PositionResult[]): RankingComparison | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;
    
    const changes: RankingChange[] = [];
    let improved = 0, declined = 0, stable = 0, gained = 0, lost = 0;
    
    // Check each current ranking
    currentRankings.forEach(current => {
      const previousPosition = snapshot.rankings.get(current.query);
      
      if (previousPosition === undefined) {
        // New ranking
        if (current.position) {
          gained++;
          changes.push({
            query: current.query,
            previousPosition: null,
            currentPosition: current.position,
            change: -current.position, // Negative is improvement
            impact: current.position <= 10 ? 'high' : 'medium'
          });
        }
      } else if (previousPosition === -1) {
        // Previously not ranking
        if (current.position) {
          gained++;
          changes.push({
            query: current.query,
            previousPosition: null,
            currentPosition: current.position,
            change: -current.position,
            impact: current.position <= 10 ? 'high' : 'medium'
          });
        } else {
          stable++;
        }
      } else {
        // Previously ranking
        if (!current.position) {
          lost++;
          changes.push({
            query: current.query,
            previousPosition,
            currentPosition: null,
            change: 100, // Lost ranking
            impact: previousPosition <= 10 ? 'high' : 'medium'
          });
        } else {
          const change = current.position - previousPosition;
          if (change < -2) {
            improved++;
          } else if (change > 2) {
            declined++;
          } else {
            stable++;
          }
          
          if (Math.abs(change) > 2) {
            changes.push({
              query: current.query,
              previousPosition,
              currentPosition: current.position,
              change,
              impact: this.calculateChangeImpact(previousPosition, current.position)
            });
          }
        }
      }
    });
    
    // Check for lost rankings
    snapshot.rankings.forEach((position, query) => {
      if (!currentRankings.find(r => r.query === query)) {
        lost++;
        if (position > 0) {
          changes.push({
            query,
            previousPosition: position,
            currentPosition: null,
            change: 100,
            impact: position <= 10 ? 'high' : 'medium'
          });
        }
      }
    });
    
    return {
      period1: snapshot,
      period2: this.createCurrentSnapshot(currentRankings),
      changes: changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)),
      summary: {
        improved,
        declined,
        stable,
        gained,
        lost
      }
    };
  }

  /**
   * Calculate impact of ranking change
   */
  private calculateChangeImpact(
    previousPos: number, 
    currentPos: number
  ): 'high' | 'medium' | 'low' {
    // Moving into or out of top 3
    if ((previousPos > 3 && currentPos <= 3) || (previousPos <= 3 && currentPos > 3)) {
      return 'high';
    }
    
    // Moving into or out of first page
    if ((previousPos > 10 && currentPos <= 10) || (previousPos <= 10 && currentPos > 10)) {
      return 'high';
    }
    
    // Large movement
    if (Math.abs(currentPos - previousPos) > 10) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Create snapshot from current rankings
   */
  private createCurrentSnapshot(rankings: PositionResult[]): RankingSnapshot {
    return {
      id: `current_${Date.now()}`,
      domain: this.config.targetDomain,
      timestamp: new Date(),
      rankings: new Map(rankings.map(r => [r.query, r.position || -1])),
      summary: {
        totalQueries: rankings.length,
        averagePosition: this.calculateAveragePosition(rankings),
        visibilityScore: this.calculateSnapshotVisibility(rankings)
      }
    };
  }

  /**
   * Get all snapshots for trend analysis
   */
  getSnapshots(): RankingSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}