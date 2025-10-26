/**
 * SERP Client Types
 * Comprehensive type definitions for the SERP API client
 */

export interface SerpClientConfig {
  providers: SerpProviderConfig[];
  cache: CacheConfig;
  rateLimiting: RateLimitConfig;
  costManagement: CostManagementConfig;
  errorHandling: ErrorHandlingConfig;
}

export interface SerpProviderConfig {
  name: SerpApiProvider;
  apiKey: string;
  baseUrl: string;
  priority: number; // Lower number = higher priority
  enabled: boolean;
  costPerQuery: number; // in dollars
  rateLimit?: number; // requests per second
}

export enum SerpApiProvider {
  SERPAPI = 'serpapi',
  VALUESERP = 'valueserp',
  SCALESERP = 'scaleserp',
  SERPER = 'serper',
  MOCK = 'mock'
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds (24-72 hours)
  namespace: string;
  compress: boolean;
  warmupQueries?: string[]; // Common queries to pre-cache
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  concurrentRequests: number;
  backoffStrategy: 'exponential' | 'linear';
  maxRetries: number;
}

export interface CostManagementConfig {
  dailyBudget: number; // in dollars
  monthlyBudget: number; // in dollars
  defaultCostPerQuery: number; // fallback cost
  budgetAlerts: BudgetAlerts;
  trackingEnabled: boolean;
}

export interface BudgetAlerts {
  warningThreshold: number; // 0.8 = 80%
  criticalThreshold: number; // 0.95 = 95%
  alertCallback?: (alert: BudgetAlert) => void;
}

export interface BudgetAlert {
  type: 'warning' | 'critical';
  currentSpend: number;
  budget: number;
  percentage: number;
  period: 'daily' | 'monthly';
  timestamp: Date;
}

export interface ErrorHandlingConfig {
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number; // failures before opening
  circuitBreakerTimeout: number; // ms before retry
  fallbackToCacheOnError: boolean;
  detailedLogging: boolean;
}

export interface SearchOptions {
  location?: string;
  language?: string;
  device?: 'desktop' | 'mobile';
  num?: number; // results per page
  start?: number; // pagination offset
  safeSearch?: boolean;
  provider?: SerpApiProvider; // Override default provider
  bypassCache?: boolean;
  timeout?: number; // ms
}

export interface BatchOptions extends SearchOptions {
  concurrency?: number;
  progressCallback?: (progress: BatchProgress) => void;
  stopOnBudgetExceeded?: boolean;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  cached: number;
  estimatedCost: number;
  elapsedTime: number;
}

export interface SearchResults {
  query: string;
  results: SerpResult[];
  features: SerpFeatures;
  totalResults: number;
  searchTime: number;
  cached: boolean;
  provider: SerpApiProvider;
  cost: number;
  metadata: SearchMetadata;
}

export interface BatchResults {
  queries: string[];
  results: Map<string, SearchResults>;
  summary: BatchSummary;
}

export interface BatchSummary {
  totalQueries: number;
  successful: number;
  failed: number;
  cached: number;
  totalCost: number;
  totalTime: number;
  errors: Array<{ query: string; error: string }>;
}

export interface SerpResult {
  position: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  isAd: boolean;
  additionalInfo?: {
    rating?: number;
    reviews?: number;
    price?: string;
    date?: string;
    sitelinks?: Array<{ title: string; url: string }>;
  };
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
  hasTwitterResults: boolean;
  totalOrganicResults: number;
}

export interface SearchMetadata {
  timestamp: Date;
  responseTime: number;
  apiCreditsUsed: number;
  cacheKey: string;
  rateLimitRemaining?: number;
}

export interface UsageStats {
  cost: CostStats;
  cache: CacheStats;
  providers: ProviderStats[];
  rateLimit: RateLimitStats;
}

export interface CostStats {
  daily: {
    spent: number;
    budget: number;
    remaining: number;
    percentage: number;
    queriesCount: number;
  };
  monthly: {
    spent: number;
    budget: number;
    remaining: number;
    percentage: number;
    queriesCount: number;
  };
  averageCostPerQuery: number;
  projectedMonthlySpend: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  oldestEntry: Date;
  newestEntry: Date;
  compressionRatio?: number;
}

export interface ProviderStats {
  provider: SerpApiProvider;
  queriesCount: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  availability: number;
}

export interface RateLimitStats {
  currentRate: number;
  peakRate: number;
  throttledRequests: number;
  queueSize: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export interface CostTracker {
  currentDailySpend: number;
  currentMonthlySpend: number;
  queryCount: Map<string, number>; // per API key
  lastReset: {
    daily: Date;
    monthly: Date;
  };
}

export interface SerpApiError extends Error {
  provider: SerpApiProvider;
  statusCode?: number;
  query?: string;
  cost?: number;
  retryable: boolean;
  fallbackAvailable: boolean;
}