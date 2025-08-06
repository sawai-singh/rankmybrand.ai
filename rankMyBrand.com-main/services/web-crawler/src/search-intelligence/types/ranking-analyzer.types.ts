/**
 * Ranking Analyzer Types
 * Type definitions for the ranking analysis engine
 */

import { QueryType, SerpFeatures } from './search-intelligence.types.js';

export interface RankingAnalysisConfig {
  targetDomain: string;
  competitors: string[];
  includeSubdomains: boolean;
  trackSerpFeatures: boolean;
  calculateVisibility: boolean;
  identifyPatterns: boolean;
}

export interface PositionResult {
  query: string;
  queryType: QueryType;
  position: number | null; // null if not found
  url: string | null;
  isHomepage: boolean;
  multipleUrls: UrlPosition[]; // if domain has multiple results
  serpFeatures: SerpFeaturePresence;
  competitorPositions: CompetitorPosition[];
  visibilityScore: VisibilityScore;
  timestamp: Date;
}

export interface UrlPosition {
  position: number;
  url: string;
  title: string;
  snippet: string;
  isAd: boolean;
}

export interface SerpFeaturePresence {
  hasFeaturedSnippet: boolean;
  featuredSnippetUrl?: string;
  featuredSnippetIsOurs: boolean;
  hasKnowledgePanel: boolean;
  knowledgePanelIsOurs: boolean;
  hasLocalPack: boolean;
  localPackPosition?: number;
  hasImageCarousel: boolean;
  hasVideoResults: boolean;
  hasPeopleAlsoAsk: boolean;
  hasShoppingResults: boolean;
  hasNewsResults: boolean;
  hasTwitterResults: boolean;
  totalOrganicResults: number;
  adsCount: number;
}

export interface CompetitorPosition {
  domain: string;
  position: number;
  url: string;
  title: string;
  hasSerpFeatures: boolean;
}

export interface VisibilityScore {
  position: number | null;
  clickThroughRate: number; // Estimated CTR based on position
  serpFeatureBoost: number; // Additional visibility from features
  competitorCount: number; // Competitors ranking above
  visibilityScore: number; // 0-100 overall score
  aiCitationLikelihood: number; // 0-100 prediction
}

export interface RankingAnalysisResult {
  domain: string;
  totalQueries: number;
  queriesAnalyzed: number;
  rankings: PositionResult[];
  summary: RankingSummary;
  patterns: RankingPatterns;
  opportunities: RankingOpportunities;
  competitorAnalysis: CompetitorSummary;
  aiVisibilityPrediction: AIVisibilityAnalysis;
}

export interface RankingSummary {
  totalRankings: number;
  averagePosition: number;
  top3Count: number;
  top10Count: number;
  top20Count: number;
  notRankingCount: number;
  featuredSnippets: number;
  knowledgePanels: number;
  multipleUrlsCount: number;
  homepageRankings: number;
}

export interface RankingPatterns {
  byQueryType: Map<QueryType, QueryTypePattern>;
  positionDistribution: PositionDistribution;
  serpFeatureCorrelation: SerpFeatureCorrelation;
  temporalTrends?: TemporalPattern[];
  contentGaps: ContentGap[];
}

export interface QueryTypePattern {
  queryType: QueryType;
  averagePosition: number;
  rankingRate: number; // % of queries ranking
  topPositions: number; // Count in top 3
  dominantCompetitors: string[];
}

export interface PositionDistribution {
  position1_3: number;
  position4_10: number;
  position11_20: number;
  position21_plus: number;
  notRanking: number;
}

export interface SerpFeatureCorrelation {
  featuredSnippetQueries: string[];
  knowledgePanelQueries: string[];
  highCompetitionQueries: string[]; // Many SERP features
  cleanSerpQueries: string[]; // Few SERP features
}

export interface TemporalPattern {
  period: string;
  averagePosition: number;
  volatility: number; // Position changes
  trend: 'improving' | 'declining' | 'stable';
}

export interface ContentGap {
  query: string;
  queryType: QueryType;
  competitorCount: number;
  topCompetitor: string;
  estimatedDifficulty: number;
  opportunityScore: number; // Based on search volume and competition
}

export interface RankingOpportunities {
  lowHangingFruit: LowHangingFruit[];
  featuredSnippetOpportunities: SnippetOpportunity[];
  competitorGaps: CompetitorGap[];
  contentRecommendations: ContentRecommendation[];
}

export interface LowHangingFruit {
  query: string;
  currentPosition: number;
  url: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  potentialTrafficGain: number;
  recommendations: string[];
}

export interface SnippetOpportunity {
  query: string;
  currentPosition: number;
  currentSnippetHolder: string;
  snippetType: 'paragraph' | 'list' | 'table';
  recommendations: string[];
}

export interface CompetitorGap {
  query: string;
  competitors: string[];
  theirBestPosition: number;
  opportunity: 'create-content' | 'improve-content' | 'build-authority';
}

export interface ContentRecommendation {
  type: 'new-content' | 'content-update' | 'technical-seo' | 'link-building';
  priority: 'high' | 'medium' | 'low';
  queries: string[];
  description: string;
  estimatedImpact: number; // 1-10
}

export interface CompetitorSummary {
  competitors: CompetitorPerformance[];
  dominanceMap: Map<string, string[]>; // competitor -> queries they dominate
  weaknessMap: Map<string, string[]>; // competitor -> queries where we beat them
  overlapAnalysis: OverlapAnalysis;
}

export interface CompetitorPerformance {
  domain: string;
  queriesRanking: number;
  averagePosition: number;
  top3Count: number;
  winsAgainstUs: number;
  lossesToUs: number;
  serpFeatureWins: number;
}

export interface OverlapAnalysis {
  totalOverlap: number; // Queries where both rank
  exclusiveToUs: number; // Only we rank
  exclusiveToThem: Map<string, number>; // Only competitor ranks
  headToHeadWins: number;
  headToHeadLosses: number;
}

export interface AIVisibilityAnalysis {
  overallScore: number; // 0-100
  citationLikelihood: CitationLikelihood;
  strengths: string[];
  weaknesses: string[];
  improvements: AIVisibilityImprovement[];
}

export interface CitationLikelihood {
  high: number; // % of queries with >70% likelihood
  medium: number; // % of queries with 40-70% likelihood
  low: number; // % of queries with <40% likelihood
  factors: {
    positionStrength: number;
    serpFeaturePresence: number;
    contentAuthority: number;
    competitiveLandscape: number;
  };
}

export interface AIVisibilityImprovement {
  action: string;
  impact: 'high' | 'medium' | 'low';
  queries: string[];
  currentScore: number;
  potentialScore: number;
}

export interface CTRCurve {
  position: number;
  ctr: number;
  withFeaturedSnippet?: number;
  withKnowledgePanel?: number;
  withAds?: number;
}

export interface RankingSnapshot {
  id: string;
  domain: string;
  timestamp: Date;
  rankings: Map<string, number>; // query -> position
  summary: {
    totalQueries: number;
    averagePosition: number;
    visibilityScore: number;
  };
}

export interface RankingComparison {
  period1: RankingSnapshot;
  period2: RankingSnapshot;
  changes: RankingChange[];
  summary: {
    improved: number;
    declined: number;
    stable: number;
    gained: number; // New rankings
    lost: number; // Lost rankings
  };
}

export interface RankingChange {
  query: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number; // Negative is improvement
  impact: 'high' | 'medium' | 'low';
}