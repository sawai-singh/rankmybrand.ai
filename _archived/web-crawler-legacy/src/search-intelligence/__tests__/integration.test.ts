/**
 * Search Intelligence Integration Tests
 * Tests the complete flow and integration between components
 */

import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { SerpApiProvider } from '../types/search-intelligence.types.js';
import { CacheManager } from '../utils/cache-manager.js';
import { BudgetManager } from '../utils/budget-manager.js';

describe('Search Intelligence Integration Tests', () => {
  let service: SearchIntelligenceService;
  let cacheManager: CacheManager;
  let budgetManager: BudgetManager;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use test database
    
    service = new SearchIntelligenceService();
    cacheManager = new CacheManager();
    budgetManager = new BudgetManager();
  });

  afterAll(async () => {
    await service.shutdown();
    await cacheManager.close();
  });

  describe('Complete Analysis Flow', () => {
    it('should complete a full analysis with mock provider', async () => {
      const analysis = await service.analyzeSearchIntelligence(
        'TestBrand',
        'testbrand.com',
        {
          maxQueries: 5,
          apiProvider: SerpApiProvider.MOCK,
          includeCompetitors: true,
          industry: 'Technology'
        }
      );

      expect(analysis).toBeDefined();
      expect(analysis.id).toBeTruthy();
      expect(analysis.brand).toBe('TestBrand');

      // Wait for analysis to complete (with timeout)
      const maxWaitTime = 30000; // 30 seconds
      const startTime = Date.now();
      let completed = false;

      while (!completed && Date.now() - startTime < maxWaitTime) {
        const progress = await service.getAnalysisProgress(analysis.id);
        if (progress?.stage === 'completed' || progress?.stage === 'failed') {
          completed = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Get final results
      const results = await service.getAnalysisResults(analysis.id);
      
      expect(results).toBeDefined();
      expect(results?.analysis.status).toBe('completed');
      expect(results?.rankings.length).toBeGreaterThan(0);
      expect(results?.aiPrediction).toBeDefined();
      expect(results?.aiPrediction.predictedScore).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Cache Integration', () => {
    it('should cache SERP results', async () => {
      const cacheKey = 'serp:test cache query';
      const testData = {
        query: 'test cache query',
        results: [],
        features: {} as any,
        totalResults: 100,
        searchTime: 0.5
      };

      // Set cache
      await cacheManager.set(cacheKey, testData, {
        ttl: 300,
        compress: true
      });

      // Verify cache
      const cached = await cacheManager.get(cacheKey);
      expect(cached).toEqual(testData);

      // Check TTL
      const ttl = await cacheManager.getTTL(cacheKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cacheManager.get('non-existent-key');
      expect(result).toBeNull();
    });
  });

  describe('Budget Management', () => {
    beforeEach(async () => {
      // Reset usage for tests
      await budgetManager.resetUsage(SerpApiProvider.MOCK);
    });

    it('should track and limit API usage', async () => {
      // Set a low limit for testing
      budgetManager.setProviderLimit(SerpApiProvider.MOCK, 5, 100);

      // Use credits
      let canProceed = true;
      for (let i = 0; i < 10; i++) {
        canProceed = await budgetManager.checkAndDeductCredits(SerpApiProvider.MOCK, 1);
        if (i < 5) {
          expect(canProceed).toBe(true);
        } else {
          expect(canProceed).toBe(false);
        }
      }
    });

    it('should provide accurate quota information', async () => {
      budgetManager.setProviderLimit(SerpApiProvider.MOCK, 10, 100);
      
      // Use some credits
      await budgetManager.checkAndDeductCredits(SerpApiProvider.MOCK, 3);

      const quota = await budgetManager.getQuota(SerpApiProvider.MOCK);
      
      expect(quota.provider).toBe(SerpApiProvider.MOCK);
      expect(quota.usedCredits).toBe(3);
      expect(quota.remainingCredits).toBe(7);
      expect(quota.resetDate).toBeInstanceOf(Date);
    });

    it('should calculate costs correctly', () => {
      const cost = budgetManager.getEstimatedCost(SerpApiProvider.SERPAPI, 100);
      expect(cost).toBe(0.5); // $0.005 * 100
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis cancellation', async () => {
      const analysis = await service.analyzeSearchIntelligence(
        'CancelTest',
        'canceltest.com',
        { maxQueries: 20, apiProvider: SerpApiProvider.MOCK }
      );

      // Cancel immediately
      const cancelled = await service.cancelAnalysis(analysis.id);
      expect(cancelled).toBe(true);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check status
      const results = await service.getAnalysisResults(analysis.id);
      expect(['cancelled', 'failed']).toContain(results?.analysis.status);
    });

    it('should handle provider failures gracefully', async () => {
      // This would test failover to mock provider
      const analysis = await service.analyzeSearchIntelligence(
        'FailoverTest',
        'failovertest.com',
        {
          maxQueries: 3,
          apiProvider: 'invalid-provider' as any
        }
      );

      expect(analysis).toBeDefined();
      // The service should fall back to mock provider
    });
  });

  describe('WebSocket Events', () => {
    it('should emit progress events during analysis', async () => {
      const events: any[] = [];
      
      service.on('analysis:progress', (event) => {
        events.push(event);
      });

      const analysis = await service.analyzeSearchIntelligence(
        'EventTest',
        'eventtest.com',
        { maxQueries: 3, apiProvider: SerpApiProvider.MOCK }
      );

      // Wait for some events
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].analysisId).toBe(analysis.id);
      
      service.removeAllListeners('analysis:progress');
    });
  });

  describe('Repository Integration', () => {
    it('should persist and retrieve analysis data', async () => {
      const analysis = await service.analyzeSearchIntelligence(
        'PersistTest',
        'persisttest.com',
        { maxQueries: 2, apiProvider: SerpApiProvider.MOCK }
      );

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Retrieve from repository
      const retrieved = await (service as any).analysisRepo.findById(analysis.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(analysis.id);
      expect(retrieved.brand).toBe('PersistTest');

      // Check related data
      const rankings = await (service as any).rankingRepo.findByAnalysisId(analysis.id);
      expect(rankings.length).toBeGreaterThan(0);
    });

    it('should retrieve analyses by domain', async () => {
      // Create multiple analyses for same domain
      await service.analyzeSearchIntelligence(
        'DomainTest1',
        'domaintest.com',
        { maxQueries: 1, apiProvider: SerpApiProvider.MOCK }
      );

      await service.analyzeSearchIntelligence(
        'DomainTest2',
        'domaintest.com',
        { maxQueries: 1, apiProvider: SerpApiProvider.MOCK }
      );

      const domainAnalyses = await (service as any).analysisRepo.findByDomain('domaintest.com');
      
      expect(domainAnalyses.length).toBeGreaterThanOrEqual(2);
      expect(domainAnalyses.every((a: any) => a.domain === 'domaintest.com')).toBe(true);
    });
  });
});