// Type definitions for the GEO Web Crawler

export interface CrawlJob {
  id: string;
  domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pagesLimit: number;
  pagesCrawled: number;
  startedAt?: Date;
  completedAt?: Date;
  config: CrawlConfig;
  createdAt: Date;
}

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  targetKeywords: string[];
  semanticContext?: Record<string, any>;
  includeSubdomains: boolean;
  jsRenderingBudget: number;
  rateLimitPerSecond: number;
  maxConcurrency?: number;
  timeout?: number;
}

export interface CrawlResult {
  url: string;
  crawlTimestamp: Date;
  renderMethod: 'static' | 'dynamic';
  responseTimeMs: number;
  citations: CitationData;
  statistics: StatisticsData;
  quotations: QuotationData;
  fluency: FluencyData;
  authority: AuthorityData;
  relevance: RelevanceData;
  meta: PageMetadata;
  links: ExtractedLink[];
}

export interface CitationData {
  count: number;
  types: Record<string, number>;
  density: number;
  hasReferenceSection: boolean;
  confidence: number;
}

export interface StatisticsData {
  count: number;
  types: Record<string, number>;
  density: number;
  relevance: number;
  contexts: StatisticContext[];
}

export interface StatisticContext {
  match: string;
  context: string;
  type: string;
  isImportant: boolean;
}

export interface QuotationData {
  count: number;
  attributed: number;
  authorityScore: number;
  sources: QuoteSource[];
  confidence: number;
}

export interface QuoteSource {
  quote: string;
  author: string;
  authorityScore: number;
  type: 'attributed' | 'block';
}

export interface FluencyData {
  readabilityScores: {
    fleschKincaid: number;
    gunningFog: number;
  };
  structure: ContentStructure;
  overall: number;
  aiOptimized: boolean;
}

export interface ContentStructure {
  hasH1: boolean;
  h2Count: number;
  h3Count: number;
  paragraphCount: number;
  listCount: number;
  avgParagraphLength: number;
  hasTableOfContents: boolean;
  hasConclusion: boolean;
}

export interface AuthorityData {
  signals: AuthoritySignals;
  score: number;
  confidence: number;
}

export interface AuthoritySignals {
  https: boolean;
  wwwSubdomain: boolean;
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasAuthorSchema: boolean;
  hasAuthorBio: boolean;
  authorName: string | null;
  socialLinks: {
    twitter: boolean;
    linkedin: boolean;
    facebook: boolean;
    youtube: boolean;
  };
  socialCount: number;
  externalLinkCount: number;
  authorityLinks: number;
  hasOrganizationSchema: boolean;
  hasArticleSchema: boolean;
}

export interface RelevanceData {
  keywordMatches: Record<string, KeywordMatch>;
  semanticScore: number;
  topicalCoverage: number;
  contextAlignment: number;
  overall: number;
}

export interface KeywordMatch {
  count: number;
  weightedScore: number;
}

export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  author: string;
  publishDate: string;
  wordCount: number;
}

export interface ExtractedLink {
  url: string;
  anchor: string;
  isInternal: boolean;
}

export interface GEOScores {
  overall: number;
  citation: number;
  statistics: number;
  quotation: number;
  fluency: number;
  authority: number;
  relevance: number;
  confidence: {
    citation: number;
    statistics: number;
    quotation: number;
    fluency: number;
    authority: number;
    relevance: number;
  };
}

export interface Recommendation {
  metric: 'citation' | 'statistics' | 'quotation' | 'fluency' | 'authority' | 'relevance';
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  affectedPages?: number;
}

export interface CrawlSummary {
  url: string;
  pagesCrawled: number;
  crawlDurationSeconds: number;
  avgResponseTimeMs: number;
  jsRenderedPages: number;
  errors: number;
  timestamp: Date;
}

export interface DomainReport {
  crawlSummary: CrawlSummary;
  domainScores: GEOScores;
  topPerformingPages: TopPage[];
  improvementOpportunities: ImprovementOpportunity[];
  technicalIssues: TechnicalIssue[];
  aiCrawlerCompatibility: AICrawlerCompatibility;
  detailedPageAnalysis: DetailedPageAnalysis[];
}

export interface TopPage {
  url: string;
  geoScore: number;
  strengths: string[];
  improvementPotential: number;
}

export interface ImprovementOpportunity {
  metric: string;
  currentScore: number;
  potentialScore: number;
  topActions: Recommendation[];
}

export interface TechnicalIssue {
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedPages: number;
  recommendation: string;
}

export interface AICrawlerCompatibility {
  gptbotAllowed: boolean;
  perplexitybotAllowed: boolean;
  robotsTxtOptimal: boolean;
  recommendations: string[];
}

export interface DetailedPageAnalysis {
  url: string;
  scores: Record<string, { value: number; confidence: number }>;
  recommendations: Recommendation[];
  extractionDetails: {
    renderMethod: 'static' | 'dynamic';
    processingTimeMs: number;
    wordCount: number;
    citationsFound: number;
    statisticsFound: number;
    quotesFound: number;
  };
}

export interface URLFrontierItem {
  url: string;
  priority: number;
  depth: number;
  timestamp: number;
}

export interface RobotsData {
  isAllowed: (url: string, userAgent?: string) => boolean;
  crawlDelay: number;
  sitemaps: string[];
}

export interface RenderDecision {
  needs: boolean;
  reason: string | null;
}

export interface CrawlStats {
  crawled: number;
  skipped: number;
  errors: number;
  jsRendered: number;
  avgResponseTime: number;
  startTime: number;
}

export interface WebSocketMessage {
  type: 'progress' | 'complete' | 'error' | 'recommendation';
  data: any;
}
