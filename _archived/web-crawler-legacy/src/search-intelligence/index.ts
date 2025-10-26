/**
 * Search Intelligence Module
 * Main entry point for the Search Intelligence service
 */

export * from './types/search-intelligence.types.js';
export { SearchIntelligenceService } from './search-intelligence-service.js';
export { QueryGenerator } from './core/query-generator.js';
export { SerpClient } from './core/serp-client.js';
export { RankingAnalyzer } from './core/ranking-analyzer.js';
export { BrandAuthorityScorer } from './core/brand-authority-scorer.js';
export { CompetitorAnalyzer } from './core/competitor-analyzer.js';
export { AIVisibilityPredictor } from './core/ai-visibility-predictor.js';
export { searchIntelRoutes } from './api/search-intel-routes.js';

// Re-export repositories for external use
export { SearchAnalysisRepository } from './repositories/search-analysis-repository.js';
export { SearchRankingRepository } from './repositories/search-ranking-repository.js';
export { BrandMentionRepository } from './repositories/brand-mention-repository.js';

// Export utilities
export { CacheManager } from './utils/cache-manager.js';
export { BudgetManager } from './utils/budget-manager.js';
export { SerpParser } from './utils/serp-parser.js';