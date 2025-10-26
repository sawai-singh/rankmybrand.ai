/**
 * Crawler Integration Tests
 * Test the integration between SmartCrawler and Search Intelligence
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SmartCrawler } from '../../integration/smart-crawler-integration.js';
import { SearchIntelligenceService } from '../../search-intelligence-service.js';
import { BrandExtractor } from '../../extractors/brand-extractor.js';
import { CompetitorDetector } from '../../extractors/competitor-detector.js';

// Mock dependencies
jest.mock('../../search-intelligence-service.js');
jest.mock('../../extractors/brand-extractor.js');
jest.mock('../../extractors/competitor-detector.js');

describe('SmartCrawler with Search Intelligence', () => {
  let crawler: SmartCrawler;
  let mockSearchService: jest.Mocked<SearchIntelligenceService>;
  let mockBrandExtractor: jest.Mocked<BrandExtractor>;
  let mockCompetitorDetector: jest.Mocked<CompetitorDetector>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create crawler instance
    crawler = new SmartCrawler();
    
    // Get mock instances
    mockSearchService = (crawler as any).searchIntelService as jest.Mocked<SearchIntelligenceService>;
    mockBrandExtractor = (crawler as any).brandExtractor as jest.Mocked<BrandExtractor>;
    mockCompetitorDetector = (crawler as any).competitorDetector as jest.Mocked<CompetitorDetector>;
  });

  describe('Crawl with Search Intelligence', () => {
    it('should run search intelligence after crawl when enabled', async () => {
      // Mock crawled pages
      const crawledPages = [
        {
          url: 'https://example.com/',
          content: '<html><body>Example Brand - Homepage</body></html>',
          metadata: {
            title: 'Example Brand - The Best Solution',
            description: 'Example Brand provides innovative solutions'
          }
        },
        {
          url: 'https://example.com/about',
          content: '<html><body>About Example Brand</body></html>',
          metadata: {
            title: 'About Us - Example Brand',
            description: 'Learn about Example Brand'
          }
        }
      ];

      // Mock brand extraction
      mockBrandExtractor.extractBrandInfo.mockResolvedValue({
        brand: 'Example Brand',
        products: ['Product A', 'Product B'],
        industry: 'Technology',
        competitors: [],
        keywords: ['innovative', 'solutions']
      });

      // Mock competitor detection
      mockCompetitorDetector.detectCompetitors.mockResolvedValue([
        { domain: 'competitor1.com', confidence: 0.85 },
        { domain: 'competitor2.com', confidence: 0.75 }
      ]);

      // Mock search intelligence analysis
      const mockAnalysis = {
        id: 'si-123',
        brand: 'Example Brand',
        domain: 'example.com',
        status: 'processing'
      };
      mockSearchService.analyzeSearchIntelligence.mockResolvedValue(mockAnalysis);

      // Override performCrawl to return mock pages
      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      // Track events
      const events: any[] = [];
      crawler.on('crawl:start', (data) => events.push({ type: 'crawl:start', data }));
      crawler.on('crawl:complete', (data) => events.push({ type: 'crawl:complete', data }));
      crawler.on('searchintel:progress', (data) => events.push({ type: 'searchintel:progress', data }));

      // Run crawl with search intelligence
      const result = await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: true,
        searchIntelOptions: {
          maxQueries: 15,
          includeCompetitors: true
        }
      });

      // Verify crawl completed
      expect(result.status).toBe('completed');
      expect(result.domain).toBe('example.com');

      // Verify brand extraction was called
      expect(mockBrandExtractor.extractBrandInfo).toHaveBeenCalledTimes(2);

      // Verify competitor detection was called
      expect(mockCompetitorDetector.detectCompetitors).toHaveBeenCalled();

      // Verify search intelligence was started
      expect(mockSearchService.analyzeSearchIntelligence).toHaveBeenCalledWith(
        'Example Brand',
        'example.com',
        expect.objectContaining({
          maxQueries: 15,
          includeCompetitors: true,
          productKeywords: expect.arrayContaining(['Product A', 'Product B']),
          competitors: expect.arrayContaining(['competitor1.com', 'competitor2.com'])
        }),
        result.jobId
      );

      // Verify events were emitted
      expect(events.some(e => e.type === 'crawl:start')).toBe(true);
      expect(events.some(e => e.type === 'crawl:complete')).toBe(true);
    });

    it('should not run search intelligence when disabled', async () => {
      const crawledPages = [{
        url: 'https://example.com/',
        content: '<html><body>Test</body></html>',
        metadata: {}
      }];

      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: false
      });

      expect(mockSearchService.analyzeSearchIntelligence).not.toHaveBeenCalled();
    });
  });

  describe('Brand Extraction', () => {
    it('should prioritize homepage and about pages', async () => {
      const crawledPages = [
        { url: 'https://example.com/blog/post1', content: 'Blog post', metadata: {} },
        { url: 'https://example.com/', content: 'Homepage', metadata: {} },
        { url: 'https://example.com/products', content: 'Products', metadata: {} },
        { url: 'https://example.com/about', content: 'About', metadata: {} },
        { url: 'https://example.com/contact', content: 'Contact', metadata: {} }
      ];

      mockBrandExtractor.extractBrandInfo.mockResolvedValue({
        brand: 'Test Brand',
        products: [],
        industry: 'Tech'
      });

      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: true
      });

      // Should have called brand extractor with homepage and about page
      const calls = mockBrandExtractor.extractBrandInfo.mock.calls;
      const extractedUrls = calls.map(call => {
        const pages = crawledPages.filter(p => p.content === call[0]);
        return pages[0]?.url;
      });

      expect(extractedUrls).toContain('https://example.com/');
      expect(extractedUrls).toContain('https://example.com/about');
    });

    it('should merge brand information from multiple pages', async () => {
      const crawledPages = [
        { url: 'https://example.com/', content: 'Homepage', metadata: {} },
        { url: 'https://example.com/about', content: 'About', metadata: {} }
      ];

      // Return different info from each page
      mockBrandExtractor.extractBrandInfo
        .mockResolvedValueOnce({
          brand: 'Example Brand',
          products: ['Product A'],
          industry: 'Technology'
        })
        .mockResolvedValueOnce({
          brand: 'Example Brand',
          products: ['Product B', 'Product C'],
          competitors: ['competitor1.com']
        });

      mockCompetitorDetector.detectCompetitors.mockResolvedValue([]);
      mockSearchService.analyzeSearchIntelligence.mockResolvedValue({
        id: 'si-123',
        brand: 'Example Brand',
        domain: 'example.com',
        status: 'processing'
      });

      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: true
      });

      // Verify merged products were passed to search intelligence
      expect(mockSearchService.analyzeSearchIntelligence).toHaveBeenCalledWith(
        'Example Brand',
        'example.com',
        expect.objectContaining({
          productKeywords: expect.arrayContaining(['Product A', 'Product B', 'Product C'])
        }),
        expect.any(String)
      );
    });
  });

  describe('Competitor Detection', () => {
    it('should detect and include high-confidence competitors', async () => {
      const crawledPages = [
        { url: 'https://example.com/', content: 'We compete with Competitor1 and Competitor2', metadata: {} }
      ];

      mockBrandExtractor.extractBrandInfo.mockResolvedValue({
        brand: 'Example',
        products: []
      });

      mockCompetitorDetector.detectCompetitors.mockResolvedValue([
        { domain: 'competitor1.com', confidence: 0.9 },
        { domain: 'competitor2.com', confidence: 0.8 },
        { domain: 'maybe-competitor.com', confidence: 0.5 } // Below threshold
      ]);

      mockSearchService.analyzeSearchIntelligence.mockResolvedValue({
        id: 'si-123',
        brand: 'Example',
        domain: 'example.com',
        status: 'processing'
      });

      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: true
      });

      // Should only include high-confidence competitors
      expect(mockSearchService.analyzeSearchIntelligence).toHaveBeenCalledWith(
        'Example',
        'example.com',
        expect.objectContaining({
          competitors: expect.arrayContaining(['competitor1.com', 'competitor2.com'])
        }),
        expect.any(String)
      );

      const passedCompetitors = mockSearchService.analyzeSearchIntelligence.mock.calls[0][2].competitors;
      expect(passedCompetitors).not.toContain('maybe-competitor.com');
    });
  });

  describe('Event Tracking', () => {
    it('should track search intelligence progress', async () => {
      const crawledPages = [
        { url: 'https://example.com/', content: 'Test', metadata: {} }
      ];

      mockBrandExtractor.extractBrandInfo.mockResolvedValue({
        brand: 'Test',
        products: []
      });

      mockCompetitorDetector.detectCompetitors.mockResolvedValue([]);

      const mockAnalysis = {
        id: 'si-123',
        brand: 'Test',
        domain: 'example.com',
        status: 'processing'
      };
      mockSearchService.analyzeSearchIntelligence.mockResolvedValue(mockAnalysis);

      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      // Track events
      const progressEvents: any[] = [];
      crawler.on('searchintel:progress', (data) => progressEvents.push(data));

      const crawlResult = await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: true
      });

      // Simulate progress events
      mockSearchService.emit('analysis:progress', {
        analysisId: 'si-123',
        progress: 50,
        completedQueries: 10,
        totalQueries: 20
      });

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify progress event was captured
      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].jobId).toBe(crawlResult.jobId);
      expect(progressEvents[0].progress).toBe(50);
    });

    it('should handle search intelligence errors gracefully', async () => {
      const crawledPages = [
        { url: 'https://example.com/', content: 'Test', metadata: {} }
      ];

      mockBrandExtractor.extractBrandInfo.mockResolvedValue({
        brand: 'Test',
        products: []
      });

      mockCompetitorDetector.detectCompetitors.mockResolvedValue([]);
      mockSearchService.analyzeSearchIntelligence.mockRejectedValue(
        new Error('API limit exceeded')
      );

      (crawler as any).performCrawl = jest.fn().mockResolvedValue(crawledPages);

      // Track events
      const errorEvents: any[] = [];
      crawler.on('searchintel:error', (data) => errorEvents.push(data));

      // Should not throw - crawl should complete even if search intel fails
      const result = await crawler.crawl({
        url: 'https://example.com',
        domain: 'example.com',
        includeSearchIntel: true
      });

      expect(result.status).toBe('completed');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].error.message).toBe('API limit exceeded');
    });
  });

  describe('Get Search Intel Results', () => {
    it('should retrieve search intelligence results for crawl job', async () => {
      const mockAnalyses = [{
        id: 'si-123',
        crawlJobId: 'crawl-123',
        createdAt: new Date()
      }];

      const mockResults = {
        analysis: { id: 'si-123', status: 'completed' },
        rankings: []
      };

      mockSearchService.analysisRepo = {
        findByCrawlJobId: jest.fn().mockResolvedValue(mockAnalyses)
      } as any;
      mockSearchService.getAnalysisResults.mockResolvedValue(mockResults);

      // Set jobId
      (crawler as any).jobId = 'crawl-123';

      const results = await crawler.getSearchIntelResults();

      expect(results).toEqual(mockResults);
      expect(mockSearchService.analysisRepo.findByCrawlJobId).toHaveBeenCalledWith('crawl-123');
    });

    it('should return null if no analysis exists', async () => {
      mockSearchService.analysisRepo = {
        findByCrawlJobId: jest.fn().mockResolvedValue([])
      } as any;

      (crawler as any).jobId = 'crawl-123';

      const results = await crawler.getSearchIntelResults();

      expect(results).toBeNull();
    });
  });
});