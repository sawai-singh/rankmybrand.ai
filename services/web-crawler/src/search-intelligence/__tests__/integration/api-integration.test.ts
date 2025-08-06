/**
 * API Integration Tests
 * Test the complete API flow including WebSocket connections
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fastify, { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { searchIntelRoutesV2 } from '../../api/search-intel-routes-v2.js';
import { SearchIntelligenceService } from '../../search-intelligence-service.js';
import { Redis } from 'ioredis';

// Mock dependencies
jest.mock('../../search-intelligence-service.js');
jest.mock('ioredis');

describe('Search Intelligence API Integration', () => {
  let app: FastifyInstance;
  let mockSearchService: jest.Mocked<SearchIntelligenceService>;
  let mockRedis: jest.Mocked<Redis>;
  const baseUrl = 'http://localhost:3001';

  beforeAll(async () => {
    // Setup mocks
    mockRedis = new Redis() as jest.Mocked<Redis>;
    mockSearchService = new SearchIntelligenceService() as jest.Mocked<SearchIntelligenceService>;

    // Create Fastify app
    app = fastify({ logger: false });
    
    // Add WebSocket support
    await app.register(require('@fastify/websocket'));
    
    // Register routes
    await app.register(searchIntelRoutesV2);

    // Start server
    await app.listen({ port: 3001 });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/search-intelligence/analyze', () => {
    it('should start a new analysis', async () => {
      const mockAnalysis = {
        id: 'test-analysis-123',
        brand: 'TestBrand',
        domain: 'testbrand.com',
        status: 'pending',
        createdAt: new Date()
      };

      mockSearchService.analyzeSearchIntelligence.mockResolvedValue(mockAnalysis);

      const response = await app.inject({
        method: 'POST',
        url: '/api/search-intelligence/analyze',
        payload: {
          brand: 'TestBrand',
          domain: 'testbrand.com',
          options: {
            maxQueries: 10,
            includeCompetitors: true
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.analysisId).toBe('test-analysis-123');
      expect(data.status).toBe('pending');
      expect(data.websocketUrl).toBe('/ws/search-intel/test-analysis-123');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search-intelligence/analyze',
        payload: {
          // Missing required fields
          options: {}
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/search-intelligence/:analysisId', () => {
    it('should return analysis results', async () => {
      const mockResults = {
        analysis: {
          id: 'test-analysis-123',
          status: 'completed',
          visibilityScore: 75
        },
        rankings: [
          {
            query: 'test query',
            position: 3,
            urlFound: 'https://testbrand.com/page'
          }
        ],
        competitors: [],
        mentions: [],
        aiPrediction: {
          predictedScore: 78
        }
      };

      const mockProgress = {
        totalQueries: 10,
        completedQueries: 10,
        currentQuery: null
      };

      mockSearchService.getAnalysisResults.mockResolvedValue(mockResults);
      mockSearchService.getAnalysisProgress.mockResolvedValue(mockProgress);

      const response = await app.inject({
        method: 'GET',
        url: '/api/search-intelligence/test-analysis-123'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.analysisId).toBe('test-analysis-123');
      expect(data.status).toBe('completed');
      expect(data.results).toBeDefined();
      expect(data.results.visibilityScore).toBe(75);
    });

    it('should return 404 for non-existent analysis', async () => {
      mockSearchService.getAnalysisResults.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/search-intelligence/non-existent-id'
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/search-intelligence/:analysisId/rankings', () => {
    it('should return detailed rankings', async () => {
      const mockResults = {
        analysis: {
          id: 'test-analysis-123',
          domain: 'testbrand.com'
        },
        rankings: [
          {
            query: 'test query 1',
            position: 1,
            urlFound: 'https://testbrand.com/page1',
            queryType: 'brand',
            serpFeatures: {
              hasFeaturedSnippet: true
            },
            competitorPositions: {
              'competitor1.com': 2
            }
          },
          {
            query: 'test query 2',
            position: 5,
            urlFound: 'https://testbrand.com/page2',
            queryType: 'informational',
            serpFeatures: {},
            competitorPositions: {}
          }
        ]
      };

      mockSearchService.getAnalysisResults.mockResolvedValue(mockResults);

      const response = await app.inject({
        method: 'GET',
        url: '/api/search-intelligence/test-analysis-123/rankings'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.rankings).toHaveLength(2);
      expect(data.summary.rankedQueries).toBe(2);
      expect(data.summary.averagePosition).toBe(3);
      expect(data.summary.top3Count).toBe(1);
    });
  });

  describe('POST /api/search-intelligence/:analysisId/export', () => {
    it('should export analysis as JSON', async () => {
      const mockResults = {
        analysis: { id: 'test-analysis-123' },
        rankings: [],
        competitors: []
      };

      mockSearchService.getAnalysisResults.mockResolvedValue(mockResults);

      const response = await app.inject({
        method: 'POST',
        url: '/api/search-intelligence/test-analysis-123/export',
        payload: {
          format: 'json',
          sections: ['summary', 'rankings']
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.headers['content-disposition']).toContain('search-intelligence-test-analysis-123.json');
    });
  });

  describe('WebSocket Integration', () => {
    it('should connect to WebSocket and receive events', (done) => {
      const analysisId = 'ws-test-123';
      let ws: WebSocket;

      // Mock initial progress
      mockSearchService.getAnalysisProgress.mockResolvedValue({
        totalQueries: 10,
        completedQueries: 0,
        currentQuery: null
      });

      // Connect to WebSocket
      ws = new WebSocket(`ws://localhost:3001/ws/search-intel/${analysisId}`);

      ws.on('open', () => {
        // Simulate progress event
        setTimeout(() => {
          mockSearchService.emit('analysis:progress', {
            analysisId,
            progress: 50,
            totalQueries: 10,
            completedQueries: 5,
            currentQuery: 'test query'
          });
        }, 100);
      });

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event.type === 'progress' && event.data.progress === 50) {
          expect(event.data.completedQueries).toBe(5);
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle multiple WebSocket connections', async () => {
      const analysisId = 'multi-ws-test';
      const connections: WebSocket[] = [];

      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:3001/ws/search-intel/${analysisId}`);
        connections.push(ws);
      }

      // Wait for all connections to open
      await Promise.all(
        connections.map(ws => new Promise(resolve => {
          ws.on('open', resolve);
        }))
      );

      // All connections should be open
      expect(connections.every(ws => ws.readyState === WebSocket.OPEN)).toBe(true);

      // Clean up
      connections.forEach(ws => ws.close());
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockSearchService.analyzeSearchIntelligence.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/search-intelligence/analyze',
        payload: {
          brand: 'TestBrand',
          domain: 'testbrand.com'
        }
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Failed to start search intelligence analysis');
      expect(data.message).toBe('Service unavailable');
    });
  });

  describe('Crawl Integration', () => {
    it('should get search intelligence for crawl job', async () => {
      const crawlJobId = 'crawl-123';
      const mockAnalyses = [{
        id: 'analysis-for-crawl',
        crawlJobId,
        createdAt: new Date()
      }];

      const mockResults = {
        analysis: {
          id: 'analysis-for-crawl',
          status: 'completed'
        },
        rankings: []
      };

      mockSearchService.analysisRepo = {
        findByCrawlJobId: jest.fn().mockResolvedValue(mockAnalyses)
      } as any;
      mockSearchService.getAnalysisResults.mockResolvedValue(mockResults);
      mockSearchService.getAnalysisProgress.mockResolvedValue({
        totalQueries: 10,
        completedQueries: 10
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/crawl/${crawlJobId}/search-intelligence`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.analysisId).toBe('analysis-for-crawl');
      expect(data.status).toBe('completed');
    });
  });
});

describe('Response Formatting', () => {
  it('should format responses correctly', () => {
    const { formatSearchIntelResponse } = require('../../api/response-formatter');
    
    const rawResults = {
      analysis: {
        id: 'test-123',
        status: 'completed',
        visibilityScore: 75
      },
      rankings: [
        {
          query: 'test query',
          position: 3,
          urlFound: 'https://example.com',
          queryType: 'brand',
          serpFeatures: {
            hasFeaturedSnippet: true
          }
        }
      ],
      mentions: [],
      competitors: [],
      aiPrediction: {
        predictedScore: 80
      }
    };

    const formatted = formatSearchIntelResponse(rawResults);

    expect(formatted.analysisId).toBe('test-123');
    expect(formatted.status).toBe('completed');
    expect(formatted.results).toBeDefined();
    expect(formatted.results.rankings).toHaveLength(1);
    expect(formatted.results.aiVisibilityPrediction.score).toBe(80);
    expect(formatted.results.aiVisibilityPrediction.likelihood).toBe('high');
  });
});