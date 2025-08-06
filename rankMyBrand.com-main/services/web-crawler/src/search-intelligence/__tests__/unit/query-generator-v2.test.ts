/**
 * Unit Tests for Enhanced Query Generator v2
 * Tests AI relevance scoring, query generation, and industry templates
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryGeneratorV2 } from '../../core/query-generator-v2.js';
import type { QueryContext, GeneratedQuery, QueryConfig } from '../../types/search-intelligence.types.js';

describe('QueryGeneratorV2', () => {
  let generator: QueryGeneratorV2;
  let mockContext: QueryContext;

  beforeEach(() => {
    generator = new QueryGeneratorV2();
    mockContext = {
      brand: 'TestBrand',
      domain: 'testbrand.com',
      industry: 'technology',
      products: ['Product A', 'Product B'],
      competitors: ['competitor1.com', 'competitor2.com'],
      targetAudience: ['developers', 'startups'],
      keywords: ['innovation', 'solutions']
    };
  });

  describe('Query Generation', () => {
    it('should generate queries within specified range', async () => {
      const config: QueryConfig = {
        minQueries: 10,
        maxQueries: 20
      };

      const queries = await generator.generateQueriesWithConfig(mockContext, config);
      
      expect(queries.length).toBeGreaterThanOrEqual(10);
      expect(queries.length).toBeLessThanOrEqual(20);
    });

    it('should include all query types', async () => {
      const queries = await generator.generateQueries(mockContext);
      const queryTypes = new Set(queries.map(q => q.type));

      expect(queryTypes).toContain('brand');
      expect(queryTypes).toContain('product');
      expect(queryTypes).toContain('service');
      expect(queryTypes).toContain('transactional');
      expect(queryTypes).toContain('informational');
      expect(queryTypes).toContain('comparison');
      expect(queryTypes).toContain('long-tail');
    });

    it('should generate industry-specific queries', async () => {
      const queries = await generator.generateQueries(mockContext);
      const techKeywords = ['software', 'platform', 'API', 'cloud', 'SaaS'];
      
      const hasTechTerms = queries.some(q => 
        techKeywords.some(keyword => q.query.toLowerCase().includes(keyword.toLowerCase()))
      );

      expect(hasTechTerms).toBe(true);
    });

    it('should include competitor comparison queries', async () => {
      const config: QueryConfig = { includeCompetitors: true };
      const queries = await generator.generateQueriesWithConfig(mockContext, config);

      const comparisonQueries = queries.filter(q => 
        q.type === 'comparison' && 
        q.query.toLowerCase().includes('vs')
      );

      expect(comparisonQueries.length).toBeGreaterThan(0);
    });

    it('should generate location-based queries when enabled', async () => {
      const config: QueryConfig = { 
        includeLocation: true,
        location: 'San Francisco'
      };
      const queries = await generator.generateQueriesWithConfig(mockContext, config);

      const locationQueries = queries.filter(q => 
        q.query.toLowerCase().includes('san francisco')
      );

      expect(locationQueries.length).toBeGreaterThan(0);
    });
  });

  describe('AI Relevance Scoring', () => {
    it('should assign relevance scores between 1-10', async () => {
      const queries = await generator.generateQueries(mockContext);

      queries.forEach(query => {
        expect(query.aiRelevance).toBeGreaterThanOrEqual(1);
        expect(query.aiRelevance).toBeLessThanOrEqual(10);
      });
    });

    it('should score informational queries higher for AI relevance', async () => {
      const queries = await generator.generateQueries(mockContext);
      
      const informationalQueries = queries.filter(q => q.type === 'informational');
      const transactionalQueries = queries.filter(q => q.type === 'transactional');

      const avgInfoScore = informationalQueries.reduce((sum, q) => sum + q.aiRelevance, 0) / informationalQueries.length;
      const avgTransScore = transactionalQueries.reduce((sum, q) => sum + q.aiRelevance, 0) / transactionalQueries.length;

      expect(avgInfoScore).toBeGreaterThan(avgTransScore);
    });

    it('should score how-to queries highly', async () => {
      const queries = await generator.generateQueries(mockContext);
      const howToQueries = queries.filter(q => q.query.toLowerCase().startsWith('how to'));

      howToQueries.forEach(query => {
        expect(query.aiRelevance).toBeGreaterThanOrEqual(7);
      });
    });
  });

  describe('Difficulty Estimation', () => {
    it('should assign difficulty scores between 1-10', async () => {
      const queries = await generator.generateQueries(mockContext);

      queries.forEach(query => {
        expect(query.difficulty).toBeGreaterThanOrEqual(1);
        expect(query.difficulty).toBeLessThanOrEqual(10);
      });
    });

    it('should rate generic terms as more difficult', async () => {
      const queries = await generator.generateQueries(mockContext);
      
      const genericQuery = queries.find(q => q.query === 'software solutions');
      const specificQuery = queries.find(q => q.query.includes('TestBrand'));

      if (genericQuery && specificQuery) {
        expect(genericQuery.difficulty).toBeGreaterThan(specificQuery.difficulty);
      }
    });
  });

  describe('Query Portfolio Analysis', () => {
    it('should provide comprehensive portfolio analysis', async () => {
      const queries = await generator.generateQueries(mockContext);
      const analysis = generator.analyzeQueryPortfolio(queries);

      expect(analysis).toHaveProperty('totalQueries');
      expect(analysis).toHaveProperty('typeDistribution');
      expect(analysis).toHaveProperty('intentDistribution');
      expect(analysis).toHaveProperty('averageAIRelevance');
      expect(analysis).toHaveProperty('averageDifficulty');
      expect(analysis).toHaveProperty('highValueQueries');
      expect(analysis).toHaveProperty('recommendations');
    });

    it('should identify high-value queries correctly', async () => {
      const queries = await generator.generateQueries(mockContext);
      const analysis = generator.analyzeQueryPortfolio(queries);

      analysis.highValueQueries.forEach(query => {
        expect(query.aiRelevance).toBeGreaterThanOrEqual(7);
        expect(query.difficulty).toBeLessThanOrEqual(6);
      });
    });

    it('should provide actionable recommendations', async () => {
      const queries = await generator.generateQueries(mockContext);
      const analysis = generator.analyzeQueryPortfolio(queries);

      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('NLP Entity Extraction', () => {
    it('should extract entities from content', () => {
      const content = 'TestBrand offers Product A and Product B for enterprise customers';
      const entities = (generator as any).extractEntities(content);

      expect(entities).toContain('TestBrand');
      expect(entities).toContain('Product A');
      expect(entities).toContain('Product B');
    });

    it('should handle various entity formats', () => {
      const content = 'CEO John Smith announced the new AI-powered platform v2.0';
      const entities = (generator as any).extractEntities(content);

      expect(entities).toContain('John Smith');
      expect(entities).toContain('AI-powered platform');
      expect(entities).toContain('v2.0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context gracefully', async () => {
      const emptyContext: QueryContext = {
        brand: '',
        domain: '',
        products: [],
        competitors: []
      };

      const queries = await generator.generateQueries(emptyContext);
      expect(queries.length).toBeGreaterThan(0);
    });

    it('should handle special characters in brand names', async () => {
      const specialContext: QueryContext = {
        ...mockContext,
        brand: 'Test&Brand™',
        products: ['Product® One']
      };

      const queries = await generator.generateQueries(specialContext);
      expect(queries).toBeDefined();
      expect(queries.length).toBeGreaterThan(0);
    });

    it('should limit queries to maxQueries even with many variations', async () => {
      const config: QueryConfig = {
        maxQueries: 5,
        includeCompetitors: true,
        includeLocation: true,
        targetAudience: ['developers', 'designers', 'managers', 'executives']
      };

      const queries = await generator.generateQueriesWithConfig(mockContext, config);
      expect(queries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Performance', () => {
    it('should generate queries quickly', async () => {
      const startTime = Date.now();
      await generator.generateQueries(mockContext);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should cache repeated patterns', async () => {
      // First generation
      const queries1 = await generator.generateQueries(mockContext);
      
      // Second generation with same context
      const startTime = Date.now();
      const queries2 = await generator.generateQueries(mockContext);
      const endTime = Date.now();

      // Second generation should be faster due to caching
      expect(endTime - startTime).toBeLessThan(50);
      expect(queries2.length).toBeCloseTo(queries1.length, 5);
    });
  });
});