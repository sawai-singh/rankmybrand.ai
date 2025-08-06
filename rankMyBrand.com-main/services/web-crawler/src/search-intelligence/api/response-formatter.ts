/**
 * Response Formatter for Search Intelligence API
 * Formats raw analysis data into structured API responses
 */

import {
  SearchAnalysis,
  SearchRanking,
  BrandMention,
  CompetitorAnalysis,
  QueryType
} from '../types/search-intelligence.types.js';

export interface SearchIntelligenceResponse {
  analysisId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    totalQueries: number;
    completedQueries: number;
    currentQuery?: string;
  };
  results?: {
    visibilityScore: number;
    rankings: RankingResult[];
    competitors: CompetitorAnalysisResult[];
    brandAuthority: BrandAuthorityScore;
    recommendations: Recommendation[];
    aiVisibilityPrediction: {
      score: number;
      likelihood: 'high' | 'medium' | 'low';
      factors: string[];
    };
  };
  costs: {
    queriesUsed: number;
    costIncurred: number;
    remainingBudget: number;
  };
}

export interface RankingResult {
  query: string;
  position: number | null;
  url: string | null;
  queryType: QueryType;
  serpFeatures: {
    hasFeaturedSnippet: boolean;
    hasKnowledgePanel: boolean;
    hasPeopleAlsoAsk: boolean;
    hasLocalPack: boolean;
    hasShoppingResults: boolean;
  };
  visibility: {
    score: number;
    estimatedTraffic: number;
    clickThroughRate: number;
  };
}

export interface CompetitorAnalysisResult {
  domain: string;
  averagePosition: number;
  visibilityScore: number;
  queryOverlap: number;
  strengthAgainstUs: string[];
  weaknessAgainstUs: string[];
}

export interface BrandAuthorityScore {
  overallScore: number;
  tier: 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topSources: Array<{
    domain: string;
    authority: number;
    mentionCount: number;
  }>;
}

export interface Recommendation {
  type: 'content' | 'technical' | 'competitive' | 'authority';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedImpact: number;
  relatedQueries?: string[];
}

/**
 * Format raw analysis results into API response
 */
export function formatSearchIntelResponse(
  rawResults: any,
  progress?: any
): SearchIntelligenceResponse {
  const analysis = rawResults.analysis;
  const rankings = rawResults.rankings || [];
  const mentions = rawResults.mentions || [];
  const competitors = rawResults.competitors || [];
  const aiPrediction = rawResults.aiPrediction;

  // Calculate progress
  const totalQueries = analysis?.totalQueries || 20;
  const completedQueries = rankings.length;
  const progressPercent = Math.round((completedQueries / totalQueries) * 100);

  // Format response
  const response: SearchIntelligenceResponse = {
    analysisId: analysis?.id || rawResults.analysisId || 'unknown',
    status: analysis?.status || rawResults.status || 'processing',
    progress: progress || {
      totalQueries,
      completedQueries,
      currentQuery: analysis?.status === 'processing' ? getCurrentQuery(analysis) : undefined
    },
    costs: {
      queriesUsed: completedQueries,
      costIncurred: completedQueries * 0.01, // $0.01 per query
      remainingBudget: calculateRemainingBudget(completedQueries)
    }
  };

  // Add results if analysis is completed
  if (analysis?.status === 'completed') {
    response.results = {
      visibilityScore: analysis?.visibilityScore || calculateVisibilityScore(rankings),
      rankings: formatRankings(rankings),
      competitors: formatCompetitors(competitors, rankings),
      brandAuthority: formatBrandAuthority(mentions, analysis),
      recommendations: generateRecommendations(rankings, competitors, mentions),
      aiVisibilityPrediction: formatAIPrediction(aiPrediction, rankings)
    };
  }

  return response;
}

/**
 * Format ranking results
 */
function formatRankings(rankings: SearchRanking[]): RankingResult[] {
  return rankings.map(ranking => {
    const ctr = calculateCTR(ranking.position);
    const traffic = estimateTraffic(ranking.position, ctr);
    const score = calculatePositionScore(ranking.position);

    return {
      query: ranking.query,
      position: ranking.position || null,
      url: ranking.urlFound || null,
      queryType: ranking.queryType,
      serpFeatures: {
        hasFeaturedSnippet: ranking.serpFeatures?.hasFeaturedSnippet || false,
        hasKnowledgePanel: ranking.serpFeatures?.hasKnowledgePanel || false,
        hasPeopleAlsoAsk: ranking.serpFeatures?.hasPeopleAlsoAsk || false,
        hasLocalPack: ranking.serpFeatures?.hasLocalPack || false,
        hasShoppingResults: ranking.serpFeatures?.hasShoppingResults || false
      },
      visibility: {
        score,
        estimatedTraffic: traffic,
        clickThroughRate: ctr
      }
    };
  });
}

/**
 * Format competitor analysis results
 */
function formatCompetitors(
  competitors: CompetitorAnalysis[],
  rankings: SearchRanking[]
): CompetitorAnalysisResult[] {
  return competitors.map(comp => {
    const overlap = calculateQueryOverlap(comp, rankings);
    const strengths = identifyCompetitorStrengths(comp, rankings);
    const weaknesses = identifyCompetitorWeaknesses(comp, rankings);

    return {
      domain: comp.competitorDomain,
      averagePosition: comp.averagePosition || 0,
      visibilityScore: comp.visibilityScore || 0,
      queryOverlap: overlap,
      strengthAgainstUs: strengths,
      weaknessAgainstUs: weaknesses
    };
  });
}

/**
 * Format brand authority score
 */
function formatBrandAuthority(
  mentions: BrandMention[],
  analysis: SearchAnalysis
): BrandAuthorityScore {
  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0
  };

  const sourceCounts = new Map<string, { count: number; totalAuthority: number }>();

  mentions.forEach(mention => {
    // Count sentiment
    const sentiment = mention.sentiment || 'neutral';
    sentimentCounts[sentiment as keyof typeof sentimentCounts]++;

    // Count sources
    const domain = new URL(mention.url).hostname;
    if (!sourceCounts.has(domain)) {
      sourceCounts.set(domain, { count: 0, totalAuthority: 0 });
    }
    const source = sourceCounts.get(domain)!;
    source.count++;
    source.totalAuthority += mention.authorityScore || 50;
  });

  // Calculate top sources
  const topSources = Array.from(sourceCounts.entries())
    .map(([domain, data]) => ({
      domain,
      authority: Math.round(data.totalAuthority / data.count),
      mentionCount: data.count
    }))
    .sort((a, b) => b.authority - a.authority)
    .slice(0, 5);

  return {
    overallScore: analysis.authorityScore || 50,
    tier: getAuthorityTier(analysis.authorityScore || 50),
    totalMentions: mentions.length,
    sentimentBreakdown: {
      positive: Math.round((sentimentCounts.positive / mentions.length) * 100),
      neutral: Math.round((sentimentCounts.neutral / mentions.length) * 100),
      negative: Math.round((sentimentCounts.negative / mentions.length) * 100)
    },
    topSources
  };
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  rankings: SearchRanking[],
  competitors: CompetitorAnalysis[],
  mentions: BrandMention[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Content recommendations
  const missingQueries = rankings.filter(r => !r.position);
  if (missingQueries.length > 0) {
    recommendations.push({
      type: 'content',
      priority: 'high',
      title: 'Create content for missing queries',
      description: `You're not ranking for ${missingQueries.length} important queries. Creating targeted content could significantly improve visibility.`,
      estimatedImpact: 8,
      relatedQueries: missingQueries.slice(0, 5).map(r => r.query)
    });
  }

  // Technical recommendations
  const poorRankings = rankings.filter(r => r.position && r.position > 10);
  if (poorRankings.length > 5) {
    recommendations.push({
      type: 'technical',
      priority: 'medium',
      title: 'Improve on-page SEO for poor rankings',
      description: `${poorRankings.length} queries rank beyond page 1. Technical improvements could move them higher.`,
      estimatedImpact: 6,
      relatedQueries: poorRankings.slice(0, 5).map(r => r.query)
    });
  }

  // Competitive recommendations
  const highCompetition = competitors.filter(c => c.visibilityScore > 70);
  if (highCompetition.length > 0) {
    recommendations.push({
      type: 'competitive',
      priority: 'medium',
      title: 'Analyze competitor strategies',
      description: `${highCompetition.length} competitors have high visibility. Study their content and backlink strategies.`,
      estimatedImpact: 7
    });
  }

  // Authority recommendations
  if (mentions.length < 10) {
    recommendations.push({
      type: 'authority',
      priority: 'high',
      title: 'Build brand authority',
      description: 'Low brand mention count indicates need for PR and link building efforts.',
      estimatedImpact: 9
    });
  }

  return recommendations.sort((a, b) => b.estimatedImpact - a.estimatedImpact).slice(0, 5);
}

/**
 * Format AI visibility prediction
 */
function formatAIPrediction(
  prediction: any,
  rankings: SearchRanking[]
): {
  score: number;
  likelihood: 'high' | 'medium' | 'low';
  factors: string[];
} {
  if (!prediction) {
    // Calculate from rankings if prediction not available
    const avgPosition = calculateAveragePosition(rankings);
    const score = calculateAIScoreFromPosition(avgPosition);
    
    return {
      score,
      likelihood: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      factors: generateAIFactors(rankings, score)
    };
  }

  return {
    score: prediction.predictedScore,
    likelihood: prediction.predictedScore > 70 ? 'high' : 
                prediction.predictedScore > 40 ? 'medium' : 'low',
    factors: prediction.factors || generateAIFactors(rankings, prediction.predictedScore)
  };
}

// Helper functions
function getCurrentQuery(analysis: SearchAnalysis): string | undefined {
  // Implementation would get current processing query
  return undefined;
}

function calculateRemainingBudget(queriesUsed: number): number {
  const dailyBudget = 10; // $10 daily budget
  const costPerQuery = 0.01;
  return Math.max(0, dailyBudget - (queriesUsed * costPerQuery));
}

function calculateVisibilityScore(rankings: SearchRanking[]): number {
  if (rankings.length === 0) return 0;
  
  const scores = rankings.map(r => calculatePositionScore(r.position));
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  return Math.round(avgScore);
}

function calculatePositionScore(position: number | undefined): number {
  if (!position) return 0;
  if (position === 1) return 100;
  if (position <= 3) return 90;
  if (position <= 5) return 80;
  if (position <= 10) return 70;
  if (position <= 20) return 50;
  return 30;
}

function calculateCTR(position: number | undefined): number {
  if (!position || position > 10) return 0.01;
  
  const ctrCurve = [0.2823, 0.1506, 0.1011, 0.0651, 0.0494, 0.0384, 0.0308, 0.0251, 0.0209, 0.0176];
  return ctrCurve[position - 1] || 0.01;
}

function estimateTraffic(position: number | undefined, ctr: number): number {
  // Assume 1000 searches/month for estimation
  return Math.round(ctr * 1000);
}

function calculateQueryOverlap(comp: CompetitorAnalysis, rankings: SearchRanking[]): number {
  // Calculate percentage of queries where both rank
  return Math.round((comp.commonQueries / rankings.length) * 100);
}

function identifyCompetitorStrengths(comp: CompetitorAnalysis, rankings: SearchRanking[]): string[] {
  const strengths: string[] = [];
  
  if (comp.averagePosition < 5) {
    strengths.push('Strong average ranking position');
  }
  if (comp.visibilityScore > 80) {
    strengths.push('High overall visibility');
  }
  if (comp.brandQueries > 5) {
    strengths.push('Ranking for brand-related queries');
  }
  
  return strengths;
}

function identifyCompetitorWeaknesses(comp: CompetitorAnalysis, rankings: SearchRanking[]): string[] {
  const weaknesses: string[] = [];
  
  if (comp.averagePosition > 15) {
    weaknesses.push('Poor average ranking position');
  }
  if (comp.visibilityScore < 30) {
    weaknesses.push('Low overall visibility');
  }
  if (comp.commonQueries < rankings.length * 0.3) {
    weaknesses.push('Limited query coverage');
  }
  
  return weaknesses;
}

function getAuthorityTier(score: number): 'very-high' | 'high' | 'medium' | 'low' | 'very-low' {
  if (score >= 80) return 'very-high';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'very-low';
}

function calculateAveragePosition(rankings: SearchRanking[]): number {
  const positioned = rankings.filter(r => r.position);
  if (positioned.length === 0) return 999;
  
  const sum = positioned.reduce((acc, r) => acc + (r.position || 0), 0);
  return sum / positioned.length;
}

function calculateAIScoreFromPosition(avgPosition: number): number {
  if (avgPosition <= 3) return 90;
  if (avgPosition <= 5) return 75;
  if (avgPosition <= 10) return 60;
  if (avgPosition <= 20) return 40;
  return 20;
}

function generateAIFactors(rankings: SearchRanking[], score: number): string[] {
  const factors: string[] = [];
  
  if (score > 70) {
    factors.push('Strong search visibility in top positions');
    factors.push('High likelihood of being cited by AI');
  } else if (score > 40) {
    factors.push('Moderate search visibility');
    factors.push('Some queries rank well for AI consideration');
  } else {
    factors.push('Limited search visibility');
    factors.push('Need to improve rankings for AI citations');
  }
  
  const featuredSnippets = rankings.filter(r => r.serpFeatures?.hasFeaturedSnippet).length;
  if (featuredSnippets > 0) {
    factors.push(`${featuredSnippets} featured snippets increase AI visibility`);
  }
  
  return factors;
}