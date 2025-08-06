/**
 * Search Intelligence Service
 * Core service for analyzing brand visibility in search results
 */

import { EventEmitter } from 'events';
import { Logger } from './utils/logger.js';
import { pool } from '../db/index.js';
import {
  SearchAnalysis,
  SearchAnalysisStatus,
  SearchIntelOptions,
  SearchIntelResult,
  SearchIntelProgress,
  AIVisibilityPrediction,
  BrandAuthorityMetrics,
  AuthorityScore
} from './types/search-intelligence.types.js';
import { QueryGenerator } from './core/query-generator.js';
import { SerpClient } from './core/serp-client.js';
import { RankingAnalyzer } from './core/ranking-analyzer.js';
import { BrandAuthorityScorer } from './core/brand-authority-scorer.js';
import { CompetitorAnalyzer } from './core/competitor-analyzer.js';
import { AIVisibilityPredictor } from './core/ai-visibility-predictor.js';
import { SearchAnalysisRepository } from './repositories/search-analysis-repository.js';
import { SearchRankingRepository } from './repositories/search-ranking-repository.js';
import { BrandMentionRepository } from './repositories/brand-mention-repository.js';
import { CacheManager } from './utils/cache-manager.js';
import { BudgetManager } from './utils/budget-manager.js';

export class SearchIntelligenceService extends EventEmitter {
  private logger: Logger;
  private queryGenerator: QueryGenerator;
  private serpClient: SerpClient;
  private rankingAnalyzer: RankingAnalyzer;
  private authorityScorer: BrandAuthorityScorer;
  private competitorAnalyzer: CompetitorAnalyzer;
  private aiPredictor: AIVisibilityPredictor;
  private analysisRepo: SearchAnalysisRepository;
  private rankingRepo: SearchRankingRepository;
  private mentionRepo: BrandMentionRepository;
  private cacheManager: CacheManager;
  private budgetManager: BudgetManager;
  private activeAnalyses: Map<string, AbortController> = new Map();

  constructor() {
    super();
    this.logger = new Logger('SearchIntelligenceService');
    
    // Initialize core components
    this.queryGenerator = new QueryGenerator();
    this.serpClient = new SerpClient();
    this.rankingAnalyzer = new RankingAnalyzer();
    this.authorityScorer = new BrandAuthorityScorer();
    this.competitorAnalyzer = new CompetitorAnalyzer();
    this.aiPredictor = new AIVisibilityPredictor();
    
    // Initialize repositories
    this.analysisRepo = new SearchAnalysisRepository(pool);
    this.rankingRepo = new SearchRankingRepository(pool);
    this.mentionRepo = new BrandMentionRepository(pool);
    
    // Initialize utilities
    this.cacheManager = new CacheManager();
    this.budgetManager = new BudgetManager();
  }

  /**
   * Start a new search intelligence analysis (alias for API compatibility)
   */
  async startAnalysis(
    brand: string,
    domain: string,
    options: SearchIntelOptions = {},
    crawlJobId?: string
  ): Promise<string> {
    const analysis = await this.analyzeSearchIntelligence(brand, domain, options, crawlJobId);
    return analysis.id;
  }

  /**
   * Start a new search intelligence analysis
   */
  async analyzeSearchIntelligence(
    brand: string,
    domain: string,
    options: SearchIntelOptions = {},
    crawlJobId?: string
  ): Promise<SearchAnalysis> {
    this.logger.info(`Starting search intelligence analysis for ${brand} (${domain})`);
    
    // Create analysis record
    const analysis = await this.analysisRepo.create({
      brand,
      domain,
      crawlJobId,
      status: SearchAnalysisStatus.PENDING,
      metadata: {
        competitors: options.competitors,
        industry: options.industry,
        targetMarket: options.targetLocations?.join(', ')
      }
    });

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.activeAnalyses.set(analysis.id, abortController);

    // Start async processing
    this.processAnalysis(analysis, options, abortController.signal)
      .catch(error => {
        this.logger.error(`Analysis failed for ${analysis.id}:`, error);
        this.handleAnalysisError(analysis.id, error);
      })
      .finally(() => {
        this.activeAnalyses.delete(analysis.id);
      });

    return analysis;
  }

  /**
   * Process the analysis asynchronously
   */
  private async processAnalysis(
    analysis: SearchAnalysis,
    options: SearchIntelOptions,
    signal: AbortSignal
  ): Promise<void> {
    try {
      // Update status: Generating queries
      await this.updateAnalysisStatus(analysis.id, SearchAnalysisStatus.GENERATING_QUERIES);
      
      // Generate search queries
      const queries = await this.queryGenerator.generateQueries({
        brand: analysis.brand,
        domain: analysis.domain,
        industry: options.industry,
        products: options.productKeywords,
        competitors: options.competitors
      });

      if (signal.aborted) throw new Error('Analysis cancelled');

      // Update total queries
      await this.analysisRepo.update(analysis.id, {
        totalQueries: queries.length
      });

      // Update status: Checking rankings
      await this.updateAnalysisStatus(analysis.id, SearchAnalysisStatus.CHECKING_RANKINGS);

      // Check rankings for each query
      const rankings = [];
      let queriesCompleted = 0;

      for (const query of queries) {
        if (signal.aborted) throw new Error('Analysis cancelled');

        // Check budget
        const canProceed = await this.budgetManager.checkAndDeductCredits(
          options.apiProvider || 'serpapi',
          1
        );

        if (!canProceed) {
          this.logger.warn('Budget limit reached, stopping analysis');
          break;
        }

        // Check cache first
        const cacheKey = `serp:${query.query}`;
        let serpData = await this.cacheManager.get(cacheKey);

        if (!serpData || options.skipCache) {
          // Fetch fresh data
          this.logger.info(`[SearchIntelligenceService] Fetching SERP data for query: ${query.query} with provider: ${options.apiProvider || 'default'}`);
          try {
            serpData = await this.serpClient.search(query.query, {
              provider: options.apiProvider,
              searchDepth: options.searchDepth
            });
            this.logger.info(`[SearchIntelligenceService] SERP data fetched successfully for: ${query.query}`);
          } catch (error) {
            this.logger.error(`[SearchIntelligenceService] Failed to fetch SERP data for: ${query.query}`, error);
            throw error;
          }

          // Cache the results
          await this.cacheManager.set(cacheKey, serpData, {
            ttl: 86400, // 24 hours
            namespace: 'serp',
            compress: true
          });
        }

        // Analyze ranking
        const ranking = await this.rankingAnalyzer.analyzeRanking(
          analysis.id,
          query,
          serpData,
          analysis.domain,
          options.competitors || []
        );

        rankings.push(ranking);
        await this.rankingRepo.create(ranking);

        queriesCompleted++;
        await this.analysisRepo.update(analysis.id, { queriesCompleted });

        // Emit progress
        this.emitProgress(analysis.id, {
          stage: SearchAnalysisStatus.CHECKING_RANKINGS,
          progress: Math.round((queriesCompleted / queries.length) * 50),
          currentQuery: query.query,
          queriesProcessed: queriesCompleted,
          totalQueries: queries.length
        });
      }

      if (signal.aborted) throw new Error('Analysis cancelled');

      // Update status: Analyzing mentions
      await this.updateAnalysisStatus(analysis.id, SearchAnalysisStatus.ANALYZING_MENTIONS);

      // Extract and analyze brand mentions
      const mentions = await this.extractBrandMentions(analysis, rankings);
      
      // Calculate brand authority
      const authorityMetrics = await this.authorityScorer.calculateAuthority(mentions);

      if (signal.aborted) throw new Error('Analysis cancelled');

      // Update status: Analyzing competitors
      await this.updateAnalysisStatus(analysis.id, SearchAnalysisStatus.ANALYZING_COMPETITORS);

      // Analyze competitors
      const competitorAnalyses = await this.competitorAnalyzer.analyzeCompetitors(
        analysis.id,
        rankings,
        options.competitors || []
      );

      if (signal.aborted) throw new Error('Analysis cancelled');

      // Update status: Calculating scores
      await this.updateAnalysisStatus(analysis.id, SearchAnalysisStatus.CALCULATING_SCORES);

      // Calculate visibility score
      const visibilityScore = this.calculateVisibilityScore(rankings);

      // Predict AI visibility
      const aiPrediction = await this.aiPredictor.predictVisibility({
        rankings,
        mentions,
        authorityMetrics,
        competitorAnalyses,
        domain: analysis.domain
      });

      // Update analysis with final scores
      await this.analysisRepo.update(analysis.id, {
        status: SearchAnalysisStatus.COMPLETED,
        visibilityScore,
        authorityScore: authorityMetrics.authorityScore,
        completedAt: new Date(),
        metadata: {
          ...analysis.metadata,
          apiCreditsUsed: queriesCompleted,
          processingTimeMs: Date.now() - analysis.createdAt.getTime()
        }
      });

      // Emit completion
      this.emit('analysis:complete', {
        analysisId: analysis.id,
        result: {
          analysis: await this.analysisRepo.findById(analysis.id),
          rankings,
          mentions,
          competitors: competitorAnalyses,
          authorityMetrics,
          aiPrediction
        }
      });

    } catch (error) {
      if (error.message === 'Analysis cancelled') {
        await this.analysisRepo.update(analysis.id, {
          status: SearchAnalysisStatus.CANCELLED
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Extract brand mentions from search results
   */
  private async extractBrandMentions(
    analysis: SearchAnalysis,
    rankings: any[]
  ): Promise<any[]> {
    const mentions = [];
    const processedUrls = new Set<string>();

    for (const ranking of rankings) {
      if (!ranking.urlFound || processedUrls.has(ranking.urlFound)) {
        continue;
      }

      processedUrls.add(ranking.urlFound);

      // Extract mentions from the found URL
      const mention = await this.authorityScorer.extractMention(
        ranking.urlFound,
        analysis.brand
      );

      if (mention) {
        const savedMention = await this.mentionRepo.create({
          ...mention,
          analysisId: analysis.id
        });
        mentions.push(savedMention);
      }
    }

    return mentions;
  }

  /**
   * Calculate overall visibility score
   */
  private calculateVisibilityScore(rankings: any[]): number {
    if (rankings.length === 0) return 0;

    let score = 0;
    let weight = 0;

    for (const ranking of rankings) {
      if (ranking.position) {
        // Points based on position (higher position = more points)
        const positionScore = Math.max(0, 21 - ranking.position);
        const queryWeight = ranking.queryType === 'brand' ? 2 : 1;
        
        score += positionScore * queryWeight;
        weight += 20 * queryWeight; // Max possible score
      }
    }

    return weight > 0 ? Math.round((score / weight) * 100) : 0;
  }

  /**
   * Update analysis status and emit progress
   */
  private async updateAnalysisStatus(
    analysisId: string,
    status: SearchAnalysisStatus
  ): Promise<void> {
    await this.analysisRepo.update(analysisId, { status });
    
    this.emit('analysis:status', {
      analysisId,
      status
    });
  }

  /**
   * Emit progress update
   */
  private emitProgress(analysisId: string, progress: Partial<SearchIntelProgress>): void {
    this.emit('analysis:progress', {
      analysisId,
      ...progress
    });
  }

  /**
   * Handle analysis error
   */
  private async handleAnalysisError(analysisId: string, error: Error): Promise<void> {
    await this.analysisRepo.update(analysisId, {
      status: SearchAnalysisStatus.FAILED,
      errorMessage: error.message
    });

    this.emit('analysis:error', {
      analysisId,
      error: error.message
    });
  }

  /**
   * Get analysis by ID
   */
  async getAnalysis(analysisId: string): Promise<SearchAnalysis | null> {
    try {
      return await this.analysisRepo.findById(analysisId);
    } catch (error) {
      this.logger.error('Failed to get analysis:', error);
      return null;
    }
  }

  /**
   * Get rankings for an analysis
   */
  async getRankings(analysisId: string): Promise<SearchRanking[]> {
    try {
      return await this.rankingRepo.findByAnalysisId(analysisId);
    } catch (error) {
      this.logger.error('Failed to get rankings:', error);
      return [];
    }
  }

  /**
   * Get competitor analysis
   */
  async getCompetitorAnalysis(analysisId: string): Promise<CompetitorAnalysis[]> {
    try {
      const rankings = await this.rankingRepo.findByAnalysisId(analysisId);
      return await this.competitorAnalyzer.analyzeCompetitors(rankings);
    } catch (error) {
      this.logger.error('Failed to get competitor analysis:', error);
      return [];
    }
  }

  /**
   * Get search intelligence for a crawl job
   */
  async getSearchIntelForCrawl(crawlJobId: string): Promise<any> {
    try {
      const analysis = await this.analysisRepo.findByCrawlJobId(crawlJobId);
      if (!analysis) return null;
      
      const results = await this.getAnalysisResults(analysis.id);
      const progress = await this.getAnalysisProgress(analysis.id);
      
      return {
        analysis,
        progress,
        results
      };
    } catch (error) {
      this.logger.error('Failed to get search intel for crawl:', error);
      return null;
    }
  }

  /**
   * Get analysis by ID with full results
   */
  async getAnalysisResults(analysisId: string): Promise<SearchIntelResult | null> {
    const analysis = await this.analysisRepo.findById(analysisId);
    if (!analysis) return null;

    const [rankings, mentions, competitors] = await Promise.all([
      this.rankingRepo.findByAnalysisId(analysisId),
      this.mentionRepo.findByAnalysisId(analysisId),
      this.competitorAnalyzer.getCompetitorAnalyses(analysisId)
    ]);

    const authorityMetrics = await this.authorityScorer.calculateAuthority(mentions);
    const aiPrediction = await this.aiPredictor.predictVisibility({
      rankings,
      mentions,
      authorityMetrics,
      competitors,
      domain: analysis.domain
    });

    return {
      analysis,
      rankings,
      mentions,
      competitors,
      authorityMetrics,
      aiPrediction
    };
  }

  /**
   * Cancel an active analysis
   */
  async cancelAnalysis(analysisId: string): Promise<boolean> {
    const controller = this.activeAnalyses.get(analysisId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Get analysis progress
   */
  async getAnalysisProgress(analysisId: string): Promise<SearchIntelProgress | null> {
    const analysis = await this.analysisRepo.findById(analysisId);
    if (!analysis) return null;

    const progress = (analysis.queriesCompleted / analysis.totalQueries) * 100;
    
    return {
      analysisId,
      stage: analysis.status,
      progress: Math.round(progress),
      queriesProcessed: analysis.queriesCompleted,
      totalQueries: analysis.totalQueries,
      errors: analysis.errorMessage ? [analysis.errorMessage] : []
    };
  }

  /**
   * Clean up resources
   */
  async shutdown(): void {
    // Cancel all active analyses
    for (const [analysisId, controller] of this.activeAnalyses) {
      controller.abort();
      await this.analysisRepo.update(analysisId, {
        status: SearchAnalysisStatus.CANCELLED,
        errorMessage: 'Service shutdown'
      });
    }

    this.activeAnalyses.clear();
    await this.cacheManager.close();
  }
}