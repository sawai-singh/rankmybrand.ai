/**
 * Prometheus Metrics for Search Intelligence Service
 * Comprehensive metrics collection for monitoring and alerting
 */

import { Registry, Counter, Gauge, Histogram, Summary } from 'prom-client';
import { logger } from '../../utils/logger.js';

export class SearchIntelMetrics {
  private registry: Registry;
  
  // Counters
  public searchesTotal: Counter;
  public searchesCached: Counter;
  public searchesFailed: Counter;
  public apiCostsTotal: Counter;
  public analysesStarted: Counter;
  public analysesCompleted: Counter;
  public analysesFailed: Counter;
  public queriesGenerated: Counter;
  public rateLimitHits: Counter;
  public budgetExceeded: Counter;
  
  // Gauges
  public currentDailySpend: Gauge;
  public currentMonthlySpend: Gauge;
  public cacheHitRate: Gauge;
  public activeAnalyses: Gauge;
  public queueSize: Gauge;
  public cacheSize: Gauge;
  public providerAvailability: Gauge;
  public memoryUsage: Gauge;
  public cpuUsage: Gauge;
  
  // Histograms
  public searchDuration: Histogram;
  public analysisDuration: Histogram;
  public rankingPositions: Histogram;
  public visibilityScores: Histogram;
  public queryGenerationTime: Histogram;
  public apiResponseTime: Histogram;
  public cacheOperationTime: Histogram;
  public databaseQueryTime: Histogram;
  
  // Summaries
  public aiRelevanceScores: Summary;
  public queryDifficulty: Summary;
  public competitorOverlap: Summary;

  constructor(registry?: Registry) {
    this.registry = registry || new Registry();
    this.initializeMetrics();
    this.startCollectors();
  }

  private initializeMetrics(): void {
    // Initialize Counters
    this.searchesTotal = new Counter({
      name: 'search_intel_searches_total',
      help: 'Total number of SERP searches performed',
      labelNames: ['provider', 'status'],
      registers: [this.registry]
    });

    this.searchesCached = new Counter({
      name: 'search_intel_searches_cached',
      help: 'Number of searches served from cache',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.searchesFailed = new Counter({
      name: 'search_intel_searches_failed',
      help: 'Number of failed SERP searches',
      labelNames: ['provider', 'error_type'],
      registers: [this.registry]
    });

    this.apiCostsTotal = new Counter({
      name: 'search_intel_api_costs_total',
      help: 'Total API costs in dollars',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.analysesStarted = new Counter({
      name: 'search_intel_analyses_started',
      help: 'Number of analyses started',
      labelNames: ['industry', 'priority'],
      registers: [this.registry]
    });

    this.analysesCompleted = new Counter({
      name: 'search_intel_analyses_completed',
      help: 'Number of analyses completed successfully',
      labelNames: ['industry'],
      registers: [this.registry]
    });

    this.analysesFailed = new Counter({
      name: 'search_intel_analyses_failed',
      help: 'Number of analyses that failed',
      labelNames: ['error_type'],
      registers: [this.registry]
    });

    this.queriesGenerated = new Counter({
      name: 'search_intel_queries_generated',
      help: 'Total number of search queries generated',
      labelNames: ['type', 'intent'],
      registers: [this.registry]
    });

    this.rateLimitHits = new Counter({
      name: 'search_intel_rate_limit_hits',
      help: 'Number of rate limit hits',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.budgetExceeded = new Counter({
      name: 'search_intel_budget_exceeded',
      help: 'Number of times budget was exceeded',
      labelNames: ['budget_type'],
      registers: [this.registry]
    });

    // Initialize Gauges
    this.currentDailySpend = new Gauge({
      name: 'search_intel_current_daily_spend',
      help: 'Current daily spend in dollars',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.currentMonthlySpend = new Gauge({
      name: 'search_intel_current_monthly_spend',
      help: 'Current monthly spend in dollars',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.cacheHitRate = new Gauge({
      name: 'search_intel_cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [this.registry]
    });

    this.activeAnalyses = new Gauge({
      name: 'search_intel_active_analyses',
      help: 'Number of currently active analyses',
      labelNames: ['status'],
      registers: [this.registry]
    });

    this.queueSize = new Gauge({
      name: 'search_intel_queue_size',
      help: 'Current job queue size',
      labelNames: ['priority'],
      registers: [this.registry]
    });

    this.cacheSize = new Gauge({
      name: 'search_intel_cache_size',
      help: 'Current cache size in MB',
      registers: [this.registry]
    });

    this.providerAvailability = new Gauge({
      name: 'search_intel_provider_availability',
      help: 'Provider availability (1=up, 0=down)',
      labelNames: ['provider'],
      registers: [this.registry]
    });

    this.memoryUsage = new Gauge({
      name: 'search_intel_memory_usage_mb',
      help: 'Memory usage in MB',
      registers: [this.registry]
    });

    this.cpuUsage = new Gauge({
      name: 'search_intel_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry]
    });

    // Initialize Histograms
    this.searchDuration = new Histogram({
      name: 'search_intel_search_duration_seconds',
      help: 'Duration of SERP searches',
      labelNames: ['provider', 'cached'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    this.analysisDuration = new Histogram({
      name: 'search_intel_analysis_duration_seconds',
      help: 'Duration of complete analysis',
      labelNames: ['query_count'],
      buckets: [10, 30, 60, 120, 300, 600],
      registers: [this.registry]
    });

    this.rankingPositions = new Histogram({
      name: 'search_intel_ranking_positions',
      help: 'Distribution of ranking positions',
      labelNames: ['query_type'],
      buckets: [1, 3, 5, 10, 20, 50, 100],
      registers: [this.registry]
    });

    this.visibilityScores = new Histogram({
      name: 'search_intel_visibility_scores',
      help: 'Distribution of visibility scores',
      buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      registers: [this.registry]
    });

    this.queryGenerationTime = new Histogram({
      name: 'search_intel_query_generation_seconds',
      help: 'Time to generate queries',
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });

    this.apiResponseTime = new Histogram({
      name: 'search_intel_api_response_seconds',
      help: 'API response times',
      labelNames: ['provider', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.cacheOperationTime = new Histogram({
      name: 'search_intel_cache_operation_seconds',
      help: 'Cache operation times',
      labelNames: ['operation'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5],
      registers: [this.registry]
    });

    this.databaseQueryTime = new Histogram({
      name: 'search_intel_db_query_seconds',
      help: 'Database query times',
      labelNames: ['query_type'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });

    // Initialize Summaries
    this.aiRelevanceScores = new Summary({
      name: 'search_intel_ai_relevance_scores',
      help: 'Distribution of AI relevance scores',
      labelNames: ['query_type'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry]
    });

    this.queryDifficulty = new Summary({
      name: 'search_intel_query_difficulty',
      help: 'Distribution of query difficulty scores',
      labelNames: ['query_type'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry]
    });

    this.competitorOverlap = new Summary({
      name: 'search_intel_competitor_overlap',
      help: 'Competitor overlap percentage',
      labelNames: ['competitor'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry]
    });
  }

  private startCollectors(): void {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);

    // Update cache hit rate every minute
    setInterval(() => {
      this.updateCacheHitRate();
    }, 60000);
  }

  private collectSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.memoryUsage.set(memUsage.heapUsed / 1024 / 1024);

      // CPU usage (requires additional implementation)
      const cpuUsage = process.cpuUsage();
      // Convert to percentage (simplified)
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
      this.cpuUsage.set(Math.min(cpuPercent, 100));
    } catch (error) {
      logger.error('Error collecting system metrics', error);
    }
  }

  private async updateCacheHitRate(): Promise<void> {
    try {
      const hits = await this.searchesCached._getValue();
      const total = await this.searchesTotal._getValue();
      
      if (total > 0) {
        const hitRate = (hits / total) * 100;
        this.cacheHitRate.set(hitRate);
      }
    } catch (error) {
      logger.error('Error updating cache hit rate', error);
    }
  }

  /**
   * Record a search operation
   */
  recordSearch(provider: string, cached: boolean, duration: number, success: boolean, cost?: number): void {
    this.searchesTotal.inc({ provider, status: success ? 'success' : 'failed' });
    
    if (cached) {
      this.searchesCached.inc({ provider });
    }
    
    if (!success) {
      this.searchesFailed.inc({ provider, error_type: 'api_error' });
    }
    
    if (cost) {
      this.apiCostsTotal.inc({ provider }, cost);
    }
    
    this.searchDuration.observe({ provider, cached: cached.toString() }, duration);
  }

  /**
   * Record an analysis operation
   */
  recordAnalysis(industry: string, priority: string, duration: number, success: boolean): void {
    if (success) {
      this.analysesCompleted.inc({ industry });
      this.analysisDuration.observe({ query_count: '10-20' }, duration);
    } else {
      this.analysesFailed.inc({ error_type: 'analysis_error' });
    }
  }

  /**
   * Record query generation
   */
  recordQueryGeneration(queries: Array<{ type: string; intent: string; aiRelevance: number; difficulty: number }>): void {
    queries.forEach(query => {
      this.queriesGenerated.inc({ type: query.type, intent: query.intent });
      this.aiRelevanceScores.observe({ query_type: query.type }, query.aiRelevance);
      this.queryDifficulty.observe({ query_type: query.type }, query.difficulty);
    });
  }

  /**
   * Record ranking results
   */
  recordRankings(rankings: Array<{ position: number | null; queryType: string }>): void {
    rankings.forEach(ranking => {
      if (ranking.position !== null) {
        this.rankingPositions.observe({ query_type: ranking.queryType }, ranking.position);
      }
    });
  }

  /**
   * Record visibility score
   */
  recordVisibilityScore(score: number): void {
    this.visibilityScores.observe(score);
  }

  /**
   * Update spend metrics
   */
  updateSpend(provider: string, dailySpend: number, monthlySpend: number): void {
    this.currentDailySpend.set({ provider }, dailySpend);
    this.currentMonthlySpend.set({ provider }, monthlySpend);
  }

  /**
   * Update active analyses
   */
  updateActiveAnalyses(pending: number, processing: number): void {
    this.activeAnalyses.set({ status: 'pending' }, pending);
    this.activeAnalyses.set({ status: 'processing' }, processing);
  }

  /**
   * Update queue size
   */
  updateQueueSize(high: number, normal: number, low: number): void {
    this.queueSize.set({ priority: 'high' }, high);
    this.queueSize.set({ priority: 'normal' }, normal);
    this.queueSize.set({ priority: 'low' }, low);
  }

  /**
   * Record rate limit hit
   */
  recordRateLimit(provider: string): void {
    this.rateLimitHits.inc({ provider });
  }

  /**
   * Record budget exceeded
   */
  recordBudgetExceeded(budgetType: 'daily' | 'monthly'): void {
    this.budgetExceeded.inc({ budget_type: budgetType });
  }

  /**
   * Get metrics for Prometheus endpoint
   */
  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get content type for Prometheus
   */
  getContentType(): string {
    return this.registry.contentType;
  }
}

// Export singleton instance
export const metrics = new SearchIntelMetrics();