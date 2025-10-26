/**
 * Search Intelligence API Routes
 * RESTful endpoints and WebSocket support for search intelligence
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebSocket } from 'ws';
import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { SearchIntelOptions } from '../types/search-intelligence.types.js';
import { Logger } from '../../utils/logger.js';

interface StartAnalysisBody {
  brand: string;
  domain: string;
  options?: SearchIntelOptions;
  crawlJobId?: string;
}

interface AnalysisParams {
  analysisId: string;
}

export async function searchIntelRoutes(fastify: FastifyInstance) {
  const logger = new Logger('SearchIntelRoutes');
  const searchService = new SearchIntelligenceService();

  // WebSocket connections for real-time updates
  const wsConnections = new Map<string, Set<WebSocket>>();

  // Set up WebSocket support
  fastify.register(async function (fastify) {
    fastify.get('/ws/search-intel/:analysisId', { websocket: true }, (connection, req) => {
      const { analysisId } = req.params as AnalysisParams;
      const ws = connection.socket;

      // Add connection to tracking
      if (!wsConnections.has(analysisId)) {
        wsConnections.set(analysisId, new Set());
      }
      wsConnections.get(analysisId)!.add(ws);

      logger.info(`WebSocket connected for analysis ${analysisId}`);

      // Send initial status
      searchService.getAnalysisProgress(analysisId).then(progress => {
        if (progress) {
          ws.send(JSON.stringify({
            type: 'progress',
            data: progress
          }));
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        const connections = wsConnections.get(analysisId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            wsConnections.delete(analysisId);
          }
        }
        logger.info(`WebSocket disconnected for analysis ${analysisId}`);
      });
    });
  });

  // Listen for search service events
  searchService.on('analysis:progress', (event) => {
    const connections = wsConnections.get(event.analysisId);
    if (connections) {
      const message = JSON.stringify({
        type: 'progress',
        data: event
      });
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  });

  searchService.on('analysis:status', (event) => {
    const connections = wsConnections.get(event.analysisId);
    if (connections) {
      const message = JSON.stringify({
        type: 'status',
        data: event
      });
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  });

  searchService.on('analysis:complete', (event) => {
    const connections = wsConnections.get(event.analysisId);
    if (connections) {
      const message = JSON.stringify({
        type: 'complete',
        data: event
      });
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  });

  searchService.on('analysis:error', (event) => {
    const connections = wsConnections.get(event.analysisId);
    if (connections) {
      const message = JSON.stringify({
        type: 'error',
        data: event
      });
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  });

  /**
   * Start a new search intelligence analysis
   */
  fastify.post<{ Body: StartAnalysisBody }>(
    '/api/search-intel/analyze',
    {
      schema: {
        body: {
          type: 'object',
          required: ['brand', 'domain'],
          properties: {
            brand: { type: 'string', minLength: 1 },
            domain: { type: 'string', minLength: 1 },
            crawlJobId: { type: 'string' },
            options: {
              type: 'object',
              properties: {
                maxQueries: { type: 'number', minimum: 1, maximum: 50 },
                includeCompetitors: { type: 'boolean' },
                competitors: { type: 'array', items: { type: 'string' } },
                searchDepth: { type: 'number', minimum: 10, maximum: 100 },
                includeLocalSearch: { type: 'boolean' },
                targetLocations: { type: 'array', items: { type: 'string' } },
                industry: { type: 'string' },
                productKeywords: { type: 'array', items: { type: 'string' } },
                skipCache: { type: 'boolean' },
                apiProvider: { type: 'string', enum: ['serpapi', 'valueserp', 'scaleserp', 'mock'] }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              brand: { type: 'string' },
              domain: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
              websocketUrl: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: StartAnalysisBody }>, reply: FastifyReply) => {
      try {
        const { brand, domain, options, crawlJobId } = request.body;

        // Start analysis
        const analysis = await searchService.analyzeSearchIntelligence(
          brand,
          domain,
          options || {},
          crawlJobId
        );

        // Return analysis with WebSocket URL
        return {
          id: analysis.id,
          brand: analysis.brand,
          domain: analysis.domain,
          status: analysis.status,
          createdAt: analysis.createdAt,
          websocketUrl: `/ws/search-intel/${analysis.id}`
        };
      } catch (error) {
        logger.error('Failed to start analysis:', error);
        reply.code(500).send({
          error: 'Failed to start search intelligence analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Get analysis status and progress
   */
  fastify.get<{ Params: AnalysisParams }>(
    '/api/search-intel/analyze/:analysisId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['analysisId'],
          properties: {
            analysisId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              analysis: { type: 'object' },
              progress: { type: 'object' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: AnalysisParams }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;

        const [results, progress] = await Promise.all([
          searchService.getAnalysisResults(analysisId),
          searchService.getAnalysisProgress(analysisId)
        ]);

        if (!results) {
          reply.code(404).send({ error: 'Analysis not found' });
          return;
        }

        return {
          analysis: results.analysis,
          progress
        };
      } catch (error) {
        logger.error('Failed to get analysis:', error);
        reply.code(500).send({
          error: 'Failed to get analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Get full analysis results
   */
  fastify.get<{ Params: AnalysisParams }>(
    '/api/search-intel/analyze/:analysisId/results',
    {
      schema: {
        params: {
          type: 'object',
          required: ['analysisId'],
          properties: {
            analysisId: { type: 'string' }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: AnalysisParams }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;

        const results = await searchService.getAnalysisResults(analysisId);

        if (!results) {
          reply.code(404).send({ error: 'Analysis not found' });
          return;
        }

        return results;
      } catch (error) {
        logger.error('Failed to get analysis results:', error);
        reply.code(500).send({
          error: 'Failed to get analysis results',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Cancel an active analysis
   */
  fastify.post<{ Params: AnalysisParams }>(
    '/api/search-intel/analyze/:analysisId/cancel',
    {
      schema: {
        params: {
          type: 'object',
          required: ['analysisId'],
          properties: {
            analysisId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: AnalysisParams }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;

        const cancelled = await searchService.cancelAnalysis(analysisId);

        if (cancelled) {
          return {
            success: true,
            message: 'Analysis cancelled successfully'
          };
        } else {
          return {
            success: false,
            message: 'Analysis not found or already completed'
          };
        }
      } catch (error) {
        logger.error('Failed to cancel analysis:', error);
        reply.code(500).send({
          error: 'Failed to cancel analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Get analyses for a domain
   */
  fastify.get<{ Querystring: { domain: string; limit?: number } }>(
    '/api/search-intel/domain',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['domain'],
          properties: {
            domain: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { domain, limit = 10 } = request.query;

        const analyses = await searchService.analysisRepo.findByDomain(domain, limit);

        return {
          domain,
          analyses,
          count: analyses.length
        };
      } catch (error) {
        logger.error('Failed to get domain analyses:', error);
        reply.code(500).send({
          error: 'Failed to get domain analyses',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Get recent analyses
   */
  fastify.get<{ Querystring: { limit?: number } }>(
    '/api/search-intel/recent',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { limit = 20 } = request.query;

        const analyses = await searchService.analysisRepo.getRecent(limit);

        return {
          analyses,
          count: analyses.length
        };
      } catch (error) {
        logger.error('Failed to get recent analyses:', error);
        reply.code(500).send({
          error: 'Failed to get recent analyses',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Get search intelligence statistics
   */
  fastify.get(
    '/api/search-intel/stats',
    async (request, reply) => {
      try {
        const stats = await searchService.analysisRepo.getStatistics();

        return stats;
      } catch (error) {
        logger.error('Failed to get statistics:', error);
        reply.code(500).send({
          error: 'Failed to get statistics',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Cleanup on shutdown
  fastify.addHook('onClose', async () => {
    // Close all WebSocket connections
    wsConnections.forEach((connections, analysisId) => {
      connections.forEach(ws => {
        ws.close(1000, 'Server shutting down');
      });
    });
    wsConnections.clear();

    // Shutdown search service
    await searchService.shutdown();
  });
}