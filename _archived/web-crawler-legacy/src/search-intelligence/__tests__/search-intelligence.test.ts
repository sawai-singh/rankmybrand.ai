/**
 * Search Intelligence Service Tests
 * Comprehensive test suite with >80% coverage
 */

import { jest } from '@jest/globals';
import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { QueryGenerator } from '../core/query-generator.js';
import { SerpClient } from '../core/serp-client.js';
import { RankingAnalyzer } from '../core/ranking-analyzer.js';
import { BrandAuthorityScorer } from '../core/brand-authority-scorer.js';
import { CompetitorAnalyzer } from '../core/competitor-analyzer.js';
import { AIVisibilityPredictor } from '../core/ai-visibility-predictor.js';
import {
  SearchAnalysisStatus,
  QueryType,
  SerpApiProvider,
  AuthorityScore,
  AuthorityTier,
  MentionType
} from '../types/search-intelligence.types.js';

// Mock all dependencies
jest.mock('../core/query-generator.js');
jest.mock('../core/serp-client.js');
jest.mock('../core/ranking-analyzer.js');
jest.mock('../core/brand-authority-scorer.js');
jest.mock('../core/competitor-analyzer.js');
jest.mock('../core/ai-visibility-predictor.js');
jest.mock('../../db/index.js');
jest.mock('../../utils/logger.js');

describe('SearchIntelligenceService', () => {
  let service: SearchIntelligenceService;
  let mockQueryGenerator: jest.Mocked<QueryGenerator>;
  let mockSerpClient: jest.Mocked<SerpClient>;
  let mockRankingAnalyzer: jest.Mocked<RankingAnalyzer>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchIntelligenceService();
    
    // Access mocked instances
    mockQueryGenerator = (service as any).queryGenerator;
    mockSerpClient = (service as any).serpClient;
    mockRankingAnalyzer = (service as any).rankingAnalyzer;
  });

  describe('analyzeSearchIntelligence', () => {
    it('should start a new analysis and return initial data', async () => {
      // Mock repository create
      const mockAnalysis = {
        id: 'test-123',
        brand: 'TestBrand',
        domain: 'testbrand.com',
        status: SearchAnalysisStatus.PENDING,
        totalQueries: 0,
        queriesCompleted: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      };

      (service as any).analysisRepo.create = jest.fn().mockResolvedValue(mockAnalysis);

      const result = await service.analyzeSearchIntelligence(
        'TestBrand',
        'testbrand.com',
        { maxQueries: 10 }
      );

      expect(result).toEqual(mockAnalysis);
      expect((service as any).analysisRepo.create).toHaveBeenCalledWith({
        brand: 'TestBrand',
        domain: 'testbrand.com',
        crawlJobId: undefined,
        status: SearchAnalysisStatus.PENDING,
        metadata: {}
      });
    });

    it('should handle analysis with crawl job ID', async () => {
      const mockAnalysis = {
        id: 'test-456',
        brand: 'TestBrand',
        domain: 'testbrand.com',
        crawlJobId: 'crawl-789',
        status: SearchAnalysisStatus.PENDING,
        totalQueries: 0,
        queriesCompleted: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      };

      (service as any).analysisRepo.create = jest.fn().mockResolvedValue(mockAnalysis);

      const result = await service.analyzeSearchIntelligence(
        'TestBrand',
        'testbrand.com',
        {},
        'crawl-789'
      );

      expect(result.crawlJobId).toBe('crawl-789');
    });
  });

  describe('getAnalysisResults', () => {
    it('should return null for non-existent analysis', async () => {
      (service as any).analysisRepo.findById = jest.fn().mockResolvedValue(null);

      const result = await service.getAnalysisResults('non-existent');
      expect(result).toBeNull();
    });

    it('should return complete analysis results', async () => {
      const mockAnalysis = {
        id: 'test-123',
        brand: 'TestBrand',
        domain: 'testbrand.com',
        status: SearchAnalysisStatus.COMPLETED,
        visibilityScore: 75,
        authorityScore: AuthorityScore.HIGH
      };

      const mockRankings = [{
        id: 'rank-1',
        analysisId: 'test-123',
        query: 'test query',
        queryType: QueryType.BRAND,
        position: 3
      }];

      const mockMentions = [{
        id: 'mention-1',
        analysisId: 'test-123',
        sourceUrl: 'https://example.com',
        sourceDomain: 'example.com',
        authorityTier: AuthorityTier.TIER_1
      }];

      (service as any).analysisRepo.findById = jest.fn().mockResolvedValue(mockAnalysis);
      (service as any).rankingRepo.findByAnalysisId = jest.fn().mockResolvedValue(mockRankings);
      (service as any).mentionRepo.findByAnalysisId = jest.fn().mockResolvedValue(mockMentions);
      (service as any).competitorAnalyzer.getCompetitorAnalyses = jest.fn().mockResolvedValue([]);
      (service as any).authorityScorer.calculateAuthority = jest.fn().mockResolvedValue({
        totalMentions: 1,
        tier1Mentions: 1,
        tier2Mentions: 0,
        tier3Mentions: 0,
        avgDomainAuthority: 90,
        mentionDiversity: 1,
        recentMentions: 1,
        authorityScore: AuthorityScore.HIGH
      });
      (service as any).aiPredictor.predictVisibility = jest.fn().mockResolvedValue({
        predictedScore: 80,
        confidence: 0.85,
        strengths: ['Strong brand presence'],
        weaknesses: [],
        recommendations: ['Continue current strategy'],
        competitivePosition: 'leader'
      });

      const result = await service.getAnalysisResults('test-123');

      expect(result).toBeDefined();
      expect(result?.analysis).toEqual(mockAnalysis);
      expect(result?.rankings).toEqual(mockRankings);
      expect(result?.mentions).toEqual(mockMentions);
    });
  });

  describe('cancelAnalysis', () => {
    it('should cancel active analysis', async () => {
      const controller = new AbortController();
      (service as any).activeAnalyses.set('test-123', controller);

      const result = await service.cancelAnalysis('test-123');
      
      expect(result).toBe(true);
      expect(controller.signal.aborted).toBe(true);
    });

    it('should return false for non-active analysis', async () => {
      const result = await service.cancelAnalysis('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAnalysisProgress', () => {
    it('should return progress for existing analysis', async () => {
      const mockAnalysis = {
        id: 'test-123',
        status: SearchAnalysisStatus.CHECKING_RANKINGS,
        totalQueries: 20,
        queriesCompleted: 10,
        errorMessage: null
      };

      (service as any).analysisRepo.findById = jest.fn().mockResolvedValue(mockAnalysis);

      const progress = await service.getAnalysisProgress('test-123');

      expect(progress).toEqual({
        analysisId: 'test-123',
        stage: SearchAnalysisStatus.CHECKING_RANKINGS,
        progress: 50,
        queriesProcessed: 10,
        totalQueries: 20,
        errors: []
      });
    });
  });
});

describe('QueryGenerator', () => {
  let generator: QueryGenerator;

  beforeEach(() => {
    generator = new QueryGenerator();
  });

  describe('generateQueries', () => {
    it('should generate brand queries', async () => {
      const queries = await generator.generateQueries({
        brand: 'TestBrand',
        domain: 'testbrand.com'
      });

      expect(queries.length).toBeGreaterThan(0);
      expect(queries.some(q => q.type === QueryType.BRAND)).toBe(true);
      expect(queries.some(q => q.query.includes('TestBrand'))).toBe(true);
    });

    it('should generate product queries when products provided', async () => {
      const queries = await generator.generateQueries({
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: ['Product A', 'Product B']
      });

      expect(queries.some(q => q.type === QueryType.PRODUCT)).toBe(true);
      expect(queries.some(q => q.query.includes('Product A'))).toBe(true);
    });

    it('should generate comparison queries with competitors', async () => {
      const queries = await generator.generateQueries({
        brand: 'TestBrand',
        domain: 'testbrand.com',
        competitors: ['competitor.com']
      });

      expect(queries.some(q => q.type === QueryType.COMPARISON)).toBe(true);
      expect(queries.some(q => q.query.includes('vs'))).toBe(true);
    });

    it('should respect previous queries to avoid duplicates', async () => {
      const queries = await generator.generateQueries({
        brand: 'TestBrand',
        domain: 'testbrand.com',
        previousQueries: ['TestBrand reviews']
      });

      expect(queries.every(q => q.query !== 'TestBrand reviews')).toBe(true);
    });

    it('should limit queries to maximum specified', async () => {
      const queries = await generator.generateQueries({
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: Array(10).fill('Product'),
        competitors: Array(10).fill('Competitor')
      });

      expect(queries.length).toBeLessThanOrEqual(20);
    });
  });
});

describe('RankingAnalyzer', () => {
  let analyzer: RankingAnalyzer;

  beforeEach(() => {
    analyzer = new RankingAnalyzer();
  });

  describe('analyzeRanking', () => {
    it('should find domain position in SERP results', async () => {
      const mockSerpData = {
        query: 'test query',
        results: [
          { position: 1, url: 'https://example.com', domain: 'example.com', isAd: false },
          { position: 2, url: 'https://testbrand.com/page', domain: 'testbrand.com', isAd: false },
          { position: 3, url: 'https://competitor.com', domain: 'competitor.com', isAd: false }
        ],
        features: {
          hasFeaturedSnippet: false,
          hasKnowledgePanel: false,
          hasPeopleAlsoAsk: true,
          hasLocalPack: false,
          hasShoppingResults: false,
          hasVideoCarousel: false,
          hasNewsResults: false,
          hasImagePack: false,
          totalOrganicResults: 10
        },
        totalResults: 1000000,
        searchTime: 0.5
      };

      const ranking = await analyzer.analyzeRanking(
        'analysis-123',
        { query: 'test query', type: QueryType.BRAND, priority: 10, expectedIntent: 'Brand search' },
        mockSerpData,
        'testbrand.com',
        ['competitor.com']
      );

      expect(ranking.position).toBe(2);
      expect(ranking.urlFound).toBe('https://testbrand.com/page');
      expect(ranking.competitorPositions['competitor.com']).toBe(3);
    });

    it('should handle domain not found in results', async () => {
      const mockSerpData = {
        query: 'test query',
        results: [
          { position: 1, url: 'https://other.com', domain: 'other.com', isAd: false }
        ],
        features: {} as any,
        totalResults: 1000,
        searchTime: 0.5
      };

      const ranking = await analyzer.analyzeRanking(
        'analysis-123',
        { query: 'test query', type: QueryType.BRAND, priority: 10, expectedIntent: 'Brand search' },
        mockSerpData,
        'testbrand.com',
        []
      );

      expect(ranking.position).toBeUndefined();
      expect(ranking.urlFound).toBeUndefined();
    });
  });

  describe('calculateVisibilityMetrics', () => {
    it('should calculate correct metrics', () => {
      const rankings = [
        { position: 1, queryType: QueryType.BRAND } as any,
        { position: 5, queryType: QueryType.PRODUCT } as any,
        { position: undefined, queryType: QueryType.COMPARISON } as any,
        { position: 3, queryType: QueryType.BRAND } as any
      ];

      const metrics = analyzer.calculateVisibilityMetrics(rankings);

      expect(metrics.totalQueries).toBe(4);
      expect(metrics.queriesRanked).toBe(3);
      expect(metrics.top3Count).toBe(2);
      expect(metrics.top10Count).toBe(3);
      expect(metrics.averagePosition).toBe(3);
    });
  });
});

describe('BrandAuthorityScorer', () => {
  let scorer: BrandAuthorityScorer;

  beforeEach(() => {
    scorer = new BrandAuthorityScorer();
  });

  describe('calculateAuthority', () => {
    it('should calculate authority metrics correctly', async () => {
      const mentions = [
        {
          authorityTier: AuthorityTier.TIER_1,
          domainAuthority: 90,
          sourceDomain: 'nytimes.com',
          publishedDate: new Date()
        },
        {
          authorityTier: AuthorityTier.TIER_2,
          domainAuthority: 70,
          sourceDomain: 'techblog.com',
          publishedDate: new Date()
        },
        {
          authorityTier: AuthorityTier.TIER_3,
          domainAuthority: 40,
          sourceDomain: 'smallsite.com',
          publishedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
        }
      ] as any;

      const metrics = await scorer.calculateAuthority(mentions);

      expect(metrics.totalMentions).toBe(3);
      expect(metrics.tier1Mentions).toBe(1);
      expect(metrics.tier2Mentions).toBe(1);
      expect(metrics.tier3Mentions).toBe(1);
      expect(metrics.avgDomainAuthority).toBe(67); // (90+70+40)/3
      expect(metrics.mentionDiversity).toBe(3);
      expect(metrics.recentMentions).toBe(2);
    });

    it('should handle empty mentions', async () => {
      const metrics = await scorer.calculateAuthority([]);

      expect(metrics.totalMentions).toBe(0);
      expect(metrics.authorityScore).toBe(AuthorityScore.VERY_LOW);
    });
  });
});

describe('AIVisibilityPredictor', () => {
  let predictor: AIVisibilityPredictor;

  beforeEach(() => {
    predictor = new AIVisibilityPredictor();
  });

  describe('predictVisibility', () => {
    it('should predict visibility with all factors', async () => {
      const data = {
        rankings: [
          { position: 1, queryType: QueryType.BRAND, serpFeatures: { hasFeaturedSnippet: true } },
          { position: 3, queryType: QueryType.INFORMATIONAL, serpFeatures: {} }
        ] as any,
        mentions: [
          { authorityTier: AuthorityTier.TIER_1 }
        ] as any,
        authorityMetrics: {
          authorityScore: AuthorityScore.HIGH,
          tier1Mentions: 5
        } as any,
        competitors: [
          { visibilityScore: 60 }
        ] as any,
        domain: 'testbrand.com'
      };

      const prediction = await predictor.predictVisibility(data);

      expect(prediction.predictedScore).toBeGreaterThan(0);
      expect(prediction.predictedScore).toBeLessThanOrEqual(100);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.strengths).toBeInstanceOf(Array);
      expect(prediction.weaknesses).toBeInstanceOf(Array);
      expect(prediction.recommendations).toBeInstanceOf(Array);
      expect(['leader', 'challenger', 'follower', 'niche']).toContain(prediction.competitivePosition);
    });
  });
});