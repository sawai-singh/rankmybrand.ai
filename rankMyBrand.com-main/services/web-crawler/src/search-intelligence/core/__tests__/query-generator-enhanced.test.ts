/**
 * Tests for Enhanced Query Generator
 */

import { EnhancedQueryGenerator } from '../query-generator-enhanced.js';
import {
  QueryGenerationContext,
  QueryGeneratorConfig,
  QueryType,
  QueryIntent
} from '../../types/search-intelligence.types.js';

describe('EnhancedQueryGenerator', () => {
  let generator: EnhancedQueryGenerator;
  
  beforeEach(() => {
    generator = new EnhancedQueryGenerator();
  });

  describe('Basic Query Generation', () => {
    it('should generate minimum required queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com'
      };
      
      const config: QueryGeneratorConfig = {
        minQueries: 10,
        maxQueries: 20,
        includeCompetitors: false,
        includeLocation: false
      };
      
      const queries = await generator.generateQueries(context, config);
      
      expect(queries.length).toBeGreaterThanOrEqual(config.minQueries);
      expect(queries.length).toBeLessThanOrEqual(config.maxQueries);
    });

    it('should generate queries with all required fields', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com'
      };
      
      const queries = await generator.generateQueries(context);
      
      queries.forEach(query => {
        expect(query).toHaveProperty('query');
        expect(query).toHaveProperty('type');
        expect(query).toHaveProperty('intent');
        expect(query).toHaveProperty('priority');
        expect(query).toHaveProperty('expectedDifficulty');
        expect(query).toHaveProperty('aiRelevance');
        
        expect(query.expectedDifficulty).toBeGreaterThanOrEqual(1);
        expect(query.expectedDifficulty).toBeLessThanOrEqual(10);
        expect(query.aiRelevance).toBeGreaterThanOrEqual(1);
        expect(query.aiRelevance).toBeLessThanOrEqual(10);
        expect(['high', 'medium', 'low']).toContain(query.priority);
      });
    });
  });

  describe('Query Types Distribution', () => {
    it('should include all major query types', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: ['Product A', 'Product B'],
        competitors: ['Competitor1', 'Competitor2'],
        industry: 'technology'
      };
      
      const queries = await generator.generateQueries(context);
      const types = new Set(queries.map(q => q.type));
      
      expect(types.has(QueryType.BRAND)).toBe(true);
      expect(types.has(QueryType.INFORMATIONAL)).toBe(true);
      expect(types.has(QueryType.LONG_TAIL)).toBe(true);
    });

    it('should generate product queries when products are provided', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: ['CRM Software', 'Analytics Tool']
      };
      
      const queries = await generator.generateQueries(context);
      const productQueries = queries.filter(q => q.type === QueryType.PRODUCT);
      
      expect(productQueries.length).toBeGreaterThan(0);
      expect(productQueries.some(q => q.query.includes('CRM Software'))).toBe(true);
    });

    it('should generate comparison queries when competitors are provided', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        competitors: ['CompetitorA', 'CompetitorB']
      };
      
      const config: QueryGeneratorConfig = {
        minQueries: 10,
        maxQueries: 20,
        includeCompetitors: true,
        includeLocation: false
      };
      
      const queries = await generator.generateQueries(context, config);
      const comparisonQueries = queries.filter(q => q.type === QueryType.COMPARISON);
      
      expect(comparisonQueries.length).toBeGreaterThan(0);
      expect(comparisonQueries.some(q => q.query.includes('vs CompetitorA'))).toBe(true);
    });
  });

  describe('Industry-Specific Queries', () => {
    it('should generate technology-specific queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'TechCorp',
        domain: 'techcorp.com',
        industry: 'technology'
      };
      
      const queries = await generator.generateQueries(context);
      
      const techQueries = queries.filter(q => 
        q.query.includes('API') || 
        q.query.includes('integration') || 
        q.query.includes('developer') ||
        q.query.includes('security')
      );
      
      expect(techQueries.length).toBeGreaterThan(0);
    });

    it('should generate ecommerce-specific queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'ShopBrand',
        domain: 'shopbrand.com',
        industry: 'ecommerce'
      };
      
      const queries = await generator.generateQueries(context);
      
      const ecomQueries = queries.filter(q => 
        q.query.includes('shipping') || 
        q.query.includes('return') || 
        q.query.includes('customer service') ||
        q.query.includes('size guide')
      );
      
      expect(ecomQueries.length).toBeGreaterThan(0);
    });

    it('should generate healthcare-specific queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'HealthClinic',
        domain: 'healthclinic.com',
        industry: 'healthcare'
      };
      
      const queries = await generator.generateQueries(context);
      
      const healthQueries = queries.filter(q => 
        q.query.includes('patient') || 
        q.query.includes('insurance') || 
        q.query.includes('appointment') ||
        q.query.includes('treatment')
      );
      
      expect(healthQueries.length).toBeGreaterThan(0);
    });
  });

  describe('AI Relevance and Difficulty Scoring', () => {
    it('should assign high AI relevance to conversational queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com'
      };
      
      const queries = await generator.generateQueries(context);
      const conversationalQueries = queries.filter(q => 
        q.type === QueryType.LONG_TAIL ||
        q.query.match(/^(how|what|why|when|where)/i)
      );
      
      conversationalQueries.forEach(query => {
        expect(query.aiRelevance).toBeGreaterThanOrEqual(8);
      });
    });

    it('should assign appropriate difficulty scores', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com'
      };
      
      const queries = await generator.generateQueries(context);
      
      // Brand queries should have lower difficulty
      const brandQuery = queries.find(q => q.query === 'TestBrand');
      expect(brandQuery?.expectedDifficulty).toBeLessThanOrEqual(5);
      
      // Competitive queries should have higher difficulty
      const competitiveQueries = queries.filter(q => 
        q.query.includes('best') || q.query.includes('buy')
      );
      competitiveQueries.forEach(query => {
        expect(query.expectedDifficulty).toBeGreaterThanOrEqual(5);
      });
    });
  });

  describe('Query Intent Classification', () => {
    it('should correctly classify query intents', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: ['Software']
      };
      
      const queries = await generator.generateQueries(context);
      
      // Check transactional intent
      const transactionalQueries = queries.filter(q => q.intent === QueryIntent.TRANSACTIONAL);
      transactionalQueries.forEach(query => {
        expect(
          query.query.includes('buy') ||
          query.query.includes('price') ||
          query.query.includes('sign up') ||
          query.query.includes('free trial')
        ).toBe(true);
      });
      
      // Check informational intent
      const informationalQueries = queries.filter(q => q.intent === QueryIntent.INFORMATIONAL);
      informationalQueries.forEach(query => {
        expect(
          query.query.includes('how') ||
          query.query.includes('what') ||
          query.query.includes('guide') ||
          query.query.includes('tutorial')
        ).toBe(true);
      });
    });
  });

  describe('Location-Based Queries', () => {
    it('should generate location queries when configured', async () => {
      const context: QueryGenerationContext = {
        brand: 'LocalBrand',
        domain: 'localbrand.com',
        targetMarket: 'New York'
      };
      
      const config: QueryGeneratorConfig = {
        minQueries: 10,
        maxQueries: 20,
        includeCompetitors: false,
        includeLocation: true
      };
      
      const queries = await generator.generateQueries(context, config);
      const locationQueries = queries.filter(q => 
        q.query.includes('New York') || q.query.includes('near me')
      );
      
      expect(locationQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Modifiers and Target Audience', () => {
    it('should use custom modifiers in queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        customModifiers: ['enterprise', 'cloud-based', 'AI-powered']
      };
      
      const queries = await generator.generateQueries(context);
      const modifierQueries = queries.filter(q => 
        context.customModifiers!.some(mod => q.query.includes(mod))
      );
      
      expect(modifierQueries.length).toBeGreaterThan(0);
    });

    it('should target specific audiences when provided', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        targetAudience: ['small businesses', 'startups'],
        products: ['Business Software']
      };
      
      const queries = await generator.generateQueries(context);
      const audienceQueries = queries.filter(q => 
        q.query.includes('small businesses') || q.query.includes('startups')
      );
      
      expect(audienceQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Query Diversity and Deduplication', () => {
    it('should not generate duplicate queries', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: ['Product A'],
        competitors: ['Competitor1']
      };
      
      const queries = await generator.generateQueries(context);
      const uniqueQueries = new Set(queries.map(q => q.query.toLowerCase()));
      
      expect(uniqueQueries.size).toBe(queries.length);
    });

    it('should respect previous queries to avoid duplicates', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        previousQueries: ['TestBrand reviews', 'TestBrand pricing', 'TestBrand vs Competitor1']
      };
      
      const queries = await generator.generateQueries(context);
      
      context.previousQueries!.forEach(prevQuery => {
        expect(queries.every(q => q.query.toLowerCase() !== prevQuery.toLowerCase())).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimal context gracefully', async () => {
      const context: QueryGenerationContext = {
        brand: 'X',
        domain: 'x.com'
      };
      
      const queries = await generator.generateQueries(context);
      
      expect(queries.length).toBeGreaterThanOrEqual(10);
      expect(queries.every(q => q.query.includes('X'))).toBe(true);
    });

    it('should handle unknown industry', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        industry: 'unknown-industry-xyz'
      };
      
      const queries = await generator.generateQueries(context);
      
      expect(queries.length).toBeGreaterThanOrEqual(10);
    });

    it('should generate fallback queries when needed', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        previousQueries: Array(50).fill(0).map((_, i) => `TestBrand query ${i}`)
      };
      
      const config: QueryGeneratorConfig = {
        minQueries: 10,
        maxQueries: 20,
        includeCompetitors: false,
        includeLocation: false
      };
      
      const queries = await generator.generateQueries(context, config);
      
      expect(queries.length).toBeGreaterThanOrEqual(config.minQueries);
    });
  });

  describe('Query Validation', () => {
    it('should validate and clean generated queries', () => {
      const testQueries = [
        { query: 'AB', type: QueryType.BRAND, intent: QueryIntent.NAVIGATIONAL, priority: 'high' as const, expectedDifficulty: 3, aiRelevance: 5 },
        { query: 'Valid Query', type: QueryType.BRAND, intent: QueryIntent.NAVIGATIONAL, priority: 'high' as const, expectedDifficulty: 3, aiRelevance: 5 },
        { query: 'the a an', type: QueryType.BRAND, intent: QueryIntent.NAVIGATIONAL, priority: 'high' as const, expectedDifficulty: 3, aiRelevance: 5 },
        { query: 'A'.repeat(101), type: QueryType.BRAND, intent: QueryIntent.NAVIGATIONAL, priority: 'high' as const, expectedDifficulty: 3, aiRelevance: 5 }
      ];
      
      const validQueries = generator.validateQueries(testQueries);
      
      expect(validQueries.length).toBe(1);
      expect(validQueries[0].query).toBe('Valid Query');
    });
  });

  describe('Performance', () => {
    it('should generate queries efficiently', async () => {
      const context: QueryGenerationContext = {
        brand: 'TestBrand',
        domain: 'testbrand.com',
        products: Array(10).fill(0).map((_, i) => `Product ${i}`),
        competitors: Array(10).fill(0).map((_, i) => `Competitor ${i}`),
        industry: 'technology'
      };
      
      const startTime = Date.now();
      const queries = await generator.generateQueries(context);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(queries.length).toBeGreaterThanOrEqual(10);
    });
  });
});