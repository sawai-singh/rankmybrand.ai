/**
 * Search Intelligence Types
 * Comprehensive type definitions for the Search Intelligence module
 */

export interface SearchAnalysis {
  id: string;
  crawlJobId?: string;
  brand: string;
  domain: string;
  status: SearchAnalysisStatus;
  totalQueries: number;
  queriesCompleted: number;
  visibilityScore?: number;
  authorityScore?: AuthorityScore;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  metadata: SearchAnalysisMetadata;
}

export enum SearchAnalysisStatus {
  PENDING = 'pending',
  GENERATING_QUERIES = 'generating_queries',
  CHECKING_RANKINGS = 'checking_rankings',
  ANALYZING_MENTIONS = 'analyzing_mentions',
  ANALYZING_COMPETITORS = 'analyzing_competitors',
  CALCULATING_SCORES = 'calculating_scores',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SearchAnalysisMetadata {
  competitors?: string[];
  industry?: string;
  targetMarket?: string;
  productCategories?: string[];
  apiCreditsUsed?: number;
  processingTimeMs?: number;
}

export interface SearchRanking {
  id: string;
  analysisId: string;
  query: string;
  queryType: QueryType;
  position?: number; // null if not found in top 20
  urlFound?: string;
  serpFeatures: SerpFeatures;
  competitorPositions: Record<string, number>;
  createdAt: Date;
}

export enum QueryType {
  BRAND = 'brand',
  PRODUCT = 'product',
  SERVICE = 'service',
  COMPARISON = 'comparison',
  INFORMATIONAL = 'informational',
  TRANSACTIONAL = 'transactional',
  LOCAL = 'local',
  LONG_TAIL = 'long-tail'
}

export enum QueryIntent {
  COMMERCIAL = 'commercial',
  INFORMATIONAL = 'informational',
  NAVIGATIONAL = 'navigational',
  TRANSACTIONAL = 'transactional'
}

export interface SerpFeatures {
  hasFeaturedSnippet: boolean;
  hasKnowledgePanel: boolean;
  hasPeopleAlsoAsk: boolean;
  hasLocalPack: boolean;
  hasShoppingResults: boolean;
  hasVideoCarousel: boolean;
  hasNewsResults: boolean;
  hasImagePack: boolean;
  totalOrganicResults: number;
}

export interface BrandMention {
  id: string;
  analysisId: string;
  sourceUrl: string;
  sourceDomain: string;
  authorityTier: AuthorityTier;
  domainAuthority?: number;
  mentionContext?: string;
  mentionType: MentionType;
  publishedDate?: Date;
  createdAt: Date;
}

export enum AuthorityTier {
  TIER_1 = 1, // Major publications, government, edu
  TIER_2 = 2, // Industry publications, respected blogs
  TIER_3 = 3  // General websites
}

export enum MentionType {
  ARTICLE = 'article',
  REVIEW = 'review',
  NEWS = 'news',
  DIRECTORY = 'directory',
  FORUM = 'forum',
  SOCIAL = 'social',
  PRESS_RELEASE = 'press_release'
}

export interface CompetitorAnalysis {
  id: string;
  analysisId: string;
  competitorDomain: string;
  avgPosition: number;
  top3Count: number;
  top10Count: number;
  notFoundCount: number;
  visibilityScore: number;
  createdAt: Date;
}

export enum AuthorityScore {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

export interface SearchIntelOptions {
  maxQueries?: number; // Default: 20
  includeCompetitors?: boolean; // Default: true
  competitors?: string[]; // Manual competitor list
  searchDepth?: number; // Top N results to analyze (default: 20)
  includeLocalSearch?: boolean; // Include location-based queries
  targetLocations?: string[]; // For local search
  industry?: string; // Help with query generation
  productKeywords?: string[]; // Specific products to analyze
  skipCache?: boolean; // Force fresh results
  apiProvider?: SerpApiProvider; // Which API to use
}

export enum SerpApiProvider {
  INHOUSE = 'inhouse', // Our real scraper - no mocks!
  SERPAPI = 'serpapi',
  VALUESERP = 'valueserp',
  SCALESERP = 'scaleserp',
  MOCK = 'mock' // For testing
}

export interface QueryGeneratorConfig {
  minQueries: number; // 10
  maxQueries: number; // 20
  includeCompetitors: boolean;
  includeLocation: boolean;
  targetAudience?: string[];
  industry?: string;
  customModifiers?: string[];
}

export interface QueryGenerationContext {
  brand: string;
  domain: string;
  industry?: string;
  products?: string[];
  competitors?: string[];
  targetMarket?: string;
  previousQueries?: string[]; // Avoid duplicates
  targetAudience?: string[];
  customModifiers?: string[];
}

export interface GeneratedQuery {
  query: string;
  type: QueryType;
  intent: QueryIntent;
  priority: 'high' | 'medium' | 'low';
  expectedDifficulty: number; // 1-10 ranking difficulty
  aiRelevance: number; // 1-10 likelihood of AI using this query
  expectedIntent?: string; // What we expect users are looking for (legacy, kept for compatibility)
}

export interface SerpApiResponse {
  query: string;
  results: SerpResult[];
  features: SerpFeatures;
  totalResults: number;
  searchTime: number;
}

export interface SerpResult {
  position: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  isAd: boolean;
}

export interface BrandAuthorityMetrics {
  totalMentions: number;
  tier1Mentions: number;
  tier2Mentions: number;
  tier3Mentions: number;
  avgDomainAuthority: number;
  mentionDiversity: number; // Unique domains
  recentMentions: number; // Last 30 days
  authorityScore: AuthorityScore;
}

export interface AIVisibilityPrediction {
  predictedScore: number; // 0-100
  confidence: number; // 0-1
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  competitivePosition: 'leader' | 'challenger' | 'follower' | 'niche';
}

export interface SearchIntelResult {
  analysis: SearchAnalysis;
  rankings: SearchRanking[];
  mentions: BrandMention[];
  competitors: CompetitorAnalysis[];
  authorityMetrics: BrandAuthorityMetrics;
  aiPrediction: AIVisibilityPrediction;
}

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  namespace: string;
  compress: boolean;
}

export interface ApiQuota {
  provider: SerpApiProvider;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  resetDate: Date;
}

export interface SearchIntelProgress {
  analysisId: string;
  stage: SearchAnalysisStatus;
  progress: number; // 0-100
  currentQuery?: string;
  queriesProcessed: number;
  totalQueries: number;
  estimatedTimeRemaining?: number; // seconds
  errors: string[];
}