/**
 * Tests for Enhanced Ranking Analyzer v2
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedRankingAnalyzer } from '../ranking-analyzer-v2.js';
import {
  RankingAnalysisConfig,
  PositionResult,
  RankingAnalysisResult
} from '../../types/ranking-analyzer.types.js';
import {
  SearchResults,
  SerpResult,
  GeneratedQuery,
  QueryType,
  SerpFeatures
} from '../../types/search-intelligence.types.js';

describe('EnhancedRankingAnalyzer', () => {
  let analyzer: EnhancedRankingAnalyzer;
  let config: RankingAnalysisConfig;

  beforeEach(() => {
    config = {
      targetDomain: 'example.com',
      competitors: ['competitor1.com', 'competitor2.com', 'competitor3.com'],
      includeSubdomains: true,
      trackSerpFeatures: true,
      calculateVisibility: true,
      identifyPatterns: true
    };
    analyzer = new EnhancedRankingAnalyzer(config);
  });

  describe('analyzeRankings', () => {
    it('should analyze rankings for multiple queries', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'best CRM software',
          type: QueryType.COMPARISON,
          intent: 'commercial',
          difficulty: 8,
          priority: 'high',
          monthlySearchVolume: 5000,
          aiRelevance: 8
        },
        {
          query: 'example.com reviews',
          type: QueryType.BRAND,
          intent: 'investigational',
          difficulty: 3,
          priority: 'high',
          monthlySearchVolume: 1000,
          aiRelevance: 9
        }
      ];

      const searchResults = new Map<string, SearchResults>([
        ['best CRM software', createMockSearchResults('best CRM software', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/crm' },
          { position: 2, domain: 'example.com', url: 'https://example.com/crm-software' },
          { position: 3, domain: 'competitor2.com', url: 'https://competitor2.com/best-crm' }
        ])],
        ['example.com reviews', createMockSearchResults('example.com reviews', [
          { position: 1, domain: 'review-site.com', url: 'https://review-site.com/example' },
          { position: 2, domain: 'example.com', url: 'https://example.com/' },
          { position: 3, domain: 'competitor1.com', url: 'https://competitor1.com/vs-example' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);

      expect(result).toBeDefined();
      expect(result.domain).toBe('example.com');
      expect(result.totalQueries).toBe(2);
      expect(result.queriesAnalyzed).toBe(2);
      expect(result.rankings).toHaveLength(2);
      expect(result.summary.totalRankings).toBe(2);
      expect(result.summary.averagePosition).toBe(2);
    });

    it('should handle queries with no search results', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'test query',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'medium',
          monthlySearchVolume: 100,
          aiRelevance: 5
        }
      ];

      const searchResults = new Map<string, SearchResults>();

      const result = await analyzer.analyzeRankings(queries, searchResults);

      expect(result.rankings).toHaveLength(0);
      expect(result.summary.totalRankings).toBe(0);
      expect(result.summary.notRankingCount).toBe(0);
    });
  });

  describe('Position Detection', () => {
    it('should detect target domain positions correctly', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'medium',
        monthlySearchVolume: 1000,
        aiRelevance: 7
      }];

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'other.com', url: 'https://other.com' },
          { position: 2, domain: 'example.com', url: 'https://example.com/page1' },
          { position: 5, domain: 'www.example.com', url: 'https://www.example.com/page2' },
          { position: 8, domain: 'blog.example.com', url: 'https://blog.example.com/post' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const ranking = result.rankings[0];

      expect(ranking.position).toBe(2);
      expect(ranking.multipleUrls).toHaveLength(3);
      expect(ranking.multipleUrls[0].position).toBe(2);
      expect(ranking.multipleUrls[1].position).toBe(5);
      expect(ranking.multipleUrls[2].position).toBe(8);
    });

    it('should detect subdomain matches when enabled', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'medium',
        monthlySearchVolume: 1000,
        aiRelevance: 7
      }];

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'blog.example.com', url: 'https://blog.example.com/post' },
          { position: 2, domain: 'docs.example.com', url: 'https://docs.example.com/guide' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const ranking = result.rankings[0];

      expect(ranking.position).toBe(1);
      expect(ranking.multipleUrls).toHaveLength(2);
    });

    it('should identify homepage rankings', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.BRAND,
        intent: 'navigational',
        difficulty: 2,
        priority: 'high',
        monthlySearchVolume: 5000,
        aiRelevance: 10
      }];

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'example.com', url: 'https://example.com/' },
          { position: 2, domain: 'example.com', url: 'https://example.com/about' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const ranking = result.rankings[0];

      expect(ranking.isHomepage).toBe(true);
      expect(result.summary.homepageRankings).toBe(1);
    });
  });

  describe('SERP Feature Recognition', () => {
    it('should recognize and track SERP features', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'medium',
        monthlySearchVolume: 1000,
        aiRelevance: 7
      }];

      const features: SerpFeatures = {
        hasFeaturedSnippet: true,
        hasKnowledgePanel: true,
        hasPeopleAlsoAsk: true,
        hasLocalPack: false,
        hasShoppingResults: false,
        hasVideoCarousel: true,
        hasNewsResults: false,
        hasImagePack: true,
        hasTwitterResults: true,
        totalOrganicResults: 10
      };

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'example.com', url: 'https://example.com/page' }
        ], features)]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const ranking = result.rankings[0];

      expect(ranking.serpFeatures.hasFeaturedSnippet).toBe(true);
      expect(ranking.serpFeatures.featuredSnippetIsOurs).toBe(true);
      expect(ranking.serpFeatures.hasKnowledgePanel).toBe(true);
      expect(ranking.serpFeatures.hasPeopleAlsoAsk).toBe(true);
      expect(ranking.serpFeatures.hasVideoResults).toBe(true);
    });

    it('should detect featured snippet ownership', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'medium',
        monthlySearchVolume: 1000,
        aiRelevance: 8
      }];

      const features: SerpFeatures = {
        hasFeaturedSnippet: true,
        hasKnowledgePanel: false,
        hasPeopleAlsoAsk: false,
        hasLocalPack: false,
        hasShoppingResults: false,
        hasVideoCarousel: false,
        hasNewsResults: false,
        hasImagePack: false,
        hasTwitterResults: false,
        totalOrganicResults: 10
      };

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/page' },
          { position: 2, domain: 'example.com', url: 'https://example.com/page' }
        ], features)]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const ranking = result.rankings[0];

      expect(ranking.serpFeatures.hasFeaturedSnippet).toBe(true);
      expect(ranking.serpFeatures.featuredSnippetIsOurs).toBe(false);
    });
  });

  describe('Competitor Tracking', () => {
    it('should track competitor positions accurately', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.COMPARISON,
        intent: 'commercial',
        difficulty: 7,
        priority: 'high',
        monthlySearchVolume: 3000,
        aiRelevance: 8
      }];

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/page' },
          { position: 2, domain: 'competitor2.com', url: 'https://competitor2.com/page' },
          { position: 3, domain: 'example.com', url: 'https://example.com/page' },
          { position: 4, domain: 'competitor3.com', url: 'https://competitor3.com/page' },
          { position: 5, domain: 'other.com', url: 'https://other.com/page' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const ranking = result.rankings[0];

      expect(ranking.competitorPositions).toHaveLength(3);
      expect(ranking.competitorPositions[0].domain).toBe('competitor1.com');
      expect(ranking.competitorPositions[0].position).toBe(1);
      expect(ranking.competitorPositions[1].domain).toBe('competitor2.com');
      expect(ranking.competitorPositions[1].position).toBe(2);
      expect(ranking.competitorPositions[2].domain).toBe('competitor3.com');
      expect(ranking.competitorPositions[2].position).toBe(4);
    });

    it('should calculate competitor analysis metrics', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'query 1',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'medium',
          monthlySearchVolume: 1000,
          aiRelevance: 7
        },
        {
          query: 'query 2',
          type: QueryType.COMPARISON,
          intent: 'commercial',
          difficulty: 8,
          priority: 'high',
          monthlySearchVolume: 2000,
          aiRelevance: 9
        }
      ];

      const searchResults = new Map<string, SearchResults>([
        ['query 1', createMockSearchResults('query 1', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/1' },
          { position: 2, domain: 'example.com', url: 'https://example.com/1' }
        ])],
        ['query 2', createMockSearchResults('query 2', [
          { position: 1, domain: 'example.com', url: 'https://example.com/2' },
          { position: 2, domain: 'competitor1.com', url: 'https://competitor1.com/2' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const competitor1 = result.competitorAnalysis.competitors.find(
        c => c.domain === 'competitor1.com'
      );

      expect(competitor1).toBeDefined();
      expect(competitor1!.queriesRanking).toBe(2);
      expect(competitor1!.winsAgainstUs).toBe(1);
      expect(competitor1!.lossesToUs).toBe(1);
    });
  });

  describe('AI Visibility Prediction', () => {
    it('should calculate AI citation likelihood based on position', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'top 3 query',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'medium',
          monthlySearchVolume: 1000,
          aiRelevance: 8
        },
        {
          query: 'page 2 query',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'medium',
          monthlySearchVolume: 1000,
          aiRelevance: 8
        }
      ];

      const searchResults = new Map<string, SearchResults>([
        ['top 3 query', createMockSearchResults('top 3 query', [
          { position: 1, domain: 'example.com', url: 'https://example.com/1' }
        ])],
        ['page 2 query', createMockSearchResults('page 2 query', [
          { position: 15, domain: 'example.com', url: 'https://example.com/2' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      
      expect(result.rankings[0].visibilityScore.aiCitationLikelihood).toBeGreaterThan(80);
      expect(result.rankings[1].visibilityScore.aiCitationLikelihood).toBeLessThan(40);
    });

    it('should boost AI visibility for featured snippets', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'medium',
        monthlySearchVolume: 1000,
        aiRelevance: 9
      }];

      const features: SerpFeatures = {
        hasFeaturedSnippet: true,
        hasKnowledgePanel: false,
        hasPeopleAlsoAsk: false,
        hasLocalPack: false,
        hasShoppingResults: false,
        hasVideoCarousel: false,
        hasNewsResults: false,
        hasImagePack: false,
        hasTwitterResults: false,
        totalOrganicResults: 10
      };

      const searchResults = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 1, domain: 'example.com', url: 'https://example.com/page' }
        ], features)]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const aiVisibility = result.aiVisibilityPrediction;

      expect(aiVisibility.overallScore).toBeGreaterThan(70);
      expect(aiVisibility.citationLikelihood.high).toBeGreaterThan(50);
    });
  });

  describe('Pattern Recognition', () => {
    it('should identify content gaps', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'gap query 1',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'high',
          monthlySearchVolume: 2000,
          aiRelevance: 8
        },
        {
          query: 'gap query 2',
          type: QueryType.COMPARISON,
          intent: 'commercial',
          difficulty: 7,
          priority: 'medium',
          monthlySearchVolume: 1500,
          aiRelevance: 7
        }
      ];

      const searchResults = new Map<string, SearchResults>([
        ['gap query 1', createMockSearchResults('gap query 1', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/1' },
          { position: 2, domain: 'competitor2.com', url: 'https://competitor2.com/1' }
        ])],
        ['gap query 2', createMockSearchResults('gap query 2', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/2' },
          { position: 2, domain: 'competitor3.com', url: 'https://competitor3.com/2' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);

      expect(result.patterns.contentGaps).toHaveLength(2);
      expect(result.patterns.contentGaps[0].query).toBe('gap query 1');
      expect(result.patterns.contentGaps[0].competitorCount).toBe(2);
      expect(result.patterns.contentGaps[0].opportunityScore).toBeGreaterThan(50);
    });

    it('should analyze patterns by query type', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'info query 1',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'medium',
          monthlySearchVolume: 1000,
          aiRelevance: 7
        },
        {
          query: 'info query 2',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 4,
          priority: 'medium',
          monthlySearchVolume: 800,
          aiRelevance: 8
        },
        {
          query: 'brand query',
          type: QueryType.BRAND,
          intent: 'navigational',
          difficulty: 2,
          priority: 'high',
          monthlySearchVolume: 5000,
          aiRelevance: 10
        }
      ];

      const searchResults = new Map<string, SearchResults>([
        ['info query 1', createMockSearchResults('info query 1', [
          { position: 5, domain: 'example.com', url: 'https://example.com/1' }
        ])],
        ['info query 2', createMockSearchResults('info query 2', [
          { position: 3, domain: 'example.com', url: 'https://example.com/2' }
        ])],
        ['brand query', createMockSearchResults('brand query', [
          { position: 1, domain: 'example.com', url: 'https://example.com/' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);
      const infoPattern = result.patterns.byQueryType.get(QueryType.INFORMATIONAL);
      const brandPattern = result.patterns.byQueryType.get(QueryType.BRAND);

      expect(infoPattern).toBeDefined();
      expect(infoPattern!.averagePosition).toBe(4);
      expect(infoPattern!.rankingRate).toBe(1);
      expect(brandPattern).toBeDefined();
      expect(brandPattern!.averagePosition).toBe(1);
    });
  });

  describe('Opportunity Identification', () => {
    it('should find low hanging fruit opportunities', async () => {
      const queries: GeneratedQuery[] = [
        {
          query: 'opportunity 1',
          type: QueryType.INFORMATIONAL,
          intent: 'informational',
          difficulty: 5,
          priority: 'medium',
          monthlySearchVolume: 2000,
          aiRelevance: 7
        },
        {
          query: 'opportunity 2',
          type: QueryType.COMPARISON,
          intent: 'commercial',
          difficulty: 6,
          priority: 'high',
          monthlySearchVolume: 3000,
          aiRelevance: 8
        }
      ];

      const searchResults = new Map<string, SearchResults>([
        ['opportunity 1', createMockSearchResults('opportunity 1', [
          { position: 11, domain: 'example.com', url: 'https://example.com/1' }
        ])],
        ['opportunity 2', createMockSearchResults('opportunity 2', [
          { position: 15, domain: 'example.com', url: 'https://example.com/2' }
        ])]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);

      expect(result.opportunities.lowHangingFruit).toHaveLength(2);
      expect(result.opportunities.lowHangingFruit[0].currentPosition).toBeGreaterThanOrEqual(11);
      expect(result.opportunities.lowHangingFruit[0].estimatedEffort).toBeDefined();
      expect(result.opportunities.lowHangingFruit[0].recommendations.length).toBeGreaterThan(0);
    });

    it('should identify featured snippet opportunities', async () => {
      const queries: GeneratedQuery[] = [{
        query: 'snippet opportunity',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'high',
        monthlySearchVolume: 5000,
        aiRelevance: 9
      }];

      const features: SerpFeatures = {
        hasFeaturedSnippet: true,
        hasKnowledgePanel: false,
        hasPeopleAlsoAsk: false,
        hasLocalPack: false,
        hasShoppingResults: false,
        hasVideoCarousel: false,
        hasNewsResults: false,
        hasImagePack: false,
        hasTwitterResults: false,
        totalOrganicResults: 10
      };

      const searchResults = new Map<string, SearchResults>([
        ['snippet opportunity', createMockSearchResults('snippet opportunity', [
          { position: 1, domain: 'competitor1.com', url: 'https://competitor1.com/page' },
          { position: 3, domain: 'example.com', url: 'https://example.com/page' }
        ], features)]
      ]);

      const result = await analyzer.analyzeRankings(queries, searchResults);

      expect(result.opportunities.featuredSnippetOpportunities).toHaveLength(1);
      expect(result.opportunities.featuredSnippetOpportunities[0].currentPosition).toBe(3);
      expect(result.opportunities.featuredSnippetOpportunities[0].currentSnippetHolder).toBe('competitor1.com');
      expect(result.opportunities.featuredSnippetOpportunities[0].recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Historical Comparison', () => {
    it('should save and compare snapshots', async () => {
      const queries1: GeneratedQuery[] = [{
        query: 'test query',
        type: QueryType.INFORMATIONAL,
        intent: 'informational',
        difficulty: 5,
        priority: 'medium',
        monthlySearchVolume: 1000,
        aiRelevance: 7
      }];

      const searchResults1 = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 10, domain: 'example.com', url: 'https://example.com/page' }
        ])]
      ]);

      // First analysis
      await analyzer.analyzeRankings(queries1, searchResults1);
      const snapshots = analyzer.getSnapshots();
      expect(snapshots).toHaveLength(1);

      // Second analysis with improved ranking
      const searchResults2 = new Map<string, SearchResults>([
        ['test query', createMockSearchResults('test query', [
          { position: 5, domain: 'example.com', url: 'https://example.com/page' }
        ])]
      ]);

      const result2 = await analyzer.analyzeRankings(queries1, searchResults2);
      const comparison = analyzer.compareWithSnapshot(snapshots[0].id, result2.rankings);

      expect(comparison).toBeDefined();
      expect(comparison!.summary.improved).toBe(1);
      expect(comparison!.changes[0].change).toBe(-5); // Negative is improvement
      expect(comparison!.changes[0].impact).toBe('high');
    });
  });
});

// Helper function to create mock search results
function createMockSearchResults(
  query: string,
  results: Array<{ position: number; domain: string; url: string }>,
  features?: SerpFeatures
): SearchResults {
  const serpResults: SerpResult[] = results.map(r => ({
    position: r.position,
    url: r.url,
    title: `${r.domain} - Title`,
    snippet: `Snippet for ${r.domain}`,
    domain: r.domain,
    isAd: false
  }));

  return {
    query,
    results: serpResults,
    features: features || {
      hasFeaturedSnippet: false,
      hasKnowledgePanel: false,
      hasPeopleAlsoAsk: false,
      hasLocalPack: false,
      hasShoppingResults: false,
      hasVideoCarousel: false,
      hasNewsResults: false,
      hasImagePack: false,
      hasTwitterResults: false,
      totalOrganicResults: 10
    },
    totalResults: results.length,
    searchTime: 0.5,
    cost: 0.01,
    provider: 'mock',
    cached: false,
    timestamp: new Date()
  };
}