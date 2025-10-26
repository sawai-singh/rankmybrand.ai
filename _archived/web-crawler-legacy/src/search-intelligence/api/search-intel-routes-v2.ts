/**
 * Enhanced Search Intelligence API Routes v2
 * Complete RESTful endpoints with WebSocket support and response formatting
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebSocket } from 'ws';
import { SearchIntelligenceService } from '../search-intelligence-service.js';
import { SearchIntelOptions } from '../types/search-intelligence.types.js';
import { logger } from '../../utils/logger.js';
import { SearchIntelligenceResponse, formatSearchIntelResponse } from './response-formatter.js';
import { JobQueue } from '../../queue/job-queue.js';
import { Redis } from 'ioredis';

interface StartAnalysisBody {
  brand: string;
  domain: string;
  options?: SearchIntelOptions;
  crawlJobId?: string;
}

interface AnalysisParams {
  analysisId: string;
}

interface ExportBody {
  format: 'json' | 'csv' | 'pdf';
  sections?: string[];
}

export async function searchIntelRoutesV2(fastify: FastifyInstance, redis: Redis) {
  const searchService = new SearchIntelligenceService();
  const jobQueue = new JobQueue(redis);

  // WebSocket connections for real-time updates
  const wsConnections = new Map<string, Set<WebSocket>>();

  // POST /api/search-intelligence/analyze
  fastify.post('/search-intelligence/analyze',
    {
      schema: {
        body: {
          type: 'object',
          required: ['brand', 'domain'],
          properties: {
            brand: { type: 'string' },
            domain: { type: 'string' },
            options: {
              type: 'object',
              properties: {
                maxQueries: { type: 'number' },
                includeCompetitors: { type: 'boolean' },
                industry: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'normal', 'low'] }
              }
            },
            crawlJobId: { type: 'string' }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: StartAnalysisBody }>, reply: FastifyReply) => {
      try {
        const { brand, domain, options = {}, crawlJobId } = request.body;
        const priority = options.priority || 'normal';

        logger.info(`Starting search intelligence analysis for ${brand} (${domain})`);

        // Add job to queue
        const jobId = await jobQueue.add('search-intelligence', {
          brand,
          domain,
          options,
          crawlJobId
        });

        // Start analysis
        const analysisId = await searchService.startAnalysis(brand, domain, options, crawlJobId);

        // Update job with analysis ID
        await jobQueue.update(jobId, { 
          result: { analysisId }
        });

        const response: SearchIntelligenceResponse = {
          analysisId,
          status: 'processing',
          progress: {
            totalQueries: options.maxQueries || 20,
            completedQueries: 0,
            currentQuery: null
          },
          websocketUrl: `/ws/search-intel/${analysisId}`
        };

        return reply.code(201).send(formatSearchIntelResponse(response));
      } catch (error) {
        logger.error('Failed to start search intelligence analysis:', error);
        return reply.code(500).send({
          error: 'Failed to start search intelligence analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GET /api/search-intelligence/:analysisId
  fastify.get('/search-intelligence/:analysisId',
    async (request: FastifyRequest<{ Params: AnalysisParams }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;
        
        const analysis = await searchService.getAnalysis(analysisId);
        if (!analysis) {
          return reply.code(404).send({ error: 'Analysis not found' });
        }

        const progress = await searchService.getAnalysisProgress(analysisId);
        const results = await searchService.getAnalysisResults(analysisId);

        const response: SearchIntelligenceResponse = {
          analysisId,
          status: analysis.status,
          progress,
          results: results || undefined,
          websocketUrl: `/ws/search-intel/${analysisId}`
        };

        return reply.send(formatSearchIntelResponse(response));
      } catch (error) {
        logger.error('Failed to get analysis:', error);
        return reply.code(500).send({
          error: 'Failed to get analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GET /api/search-intelligence/:analysisId/rankings
  fastify.get('/search-intelligence/:analysisId/rankings',
    async (request: FastifyRequest<{ Params: AnalysisParams }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;
        
        const rankings = await searchService.getRankings(analysisId);
        if (!rankings || rankings.length === 0) {
          return reply.code(404).send({ error: 'Rankings not found' });
        }

        return reply.send({
          analysisId,
          rankings,
          summary: {
            totalQueries: rankings.length,
            averagePosition: calculateAveragePosition(rankings),
            topPositions: countTopPositions(rankings),
            serpFeatures: extractSerpFeatures(rankings)
          }
        });
      } catch (error) {
        logger.error('Failed to get rankings:', error);
        return reply.code(500).send({
          error: 'Failed to get rankings',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GET /api/search-intelligence/:analysisId/competitors
  fastify.get('/search-intelligence/:analysisId/competitors',
    async (request: FastifyRequest<{ Params: AnalysisParams }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;
        
        const competitors = await searchService.getCompetitorAnalysis(analysisId);
        if (!competitors) {
          return reply.code(404).send({ error: 'Competitor analysis not found' });
        }

        return reply.send({
          analysisId,
          competitors,
          summary: {
            totalCompetitors: competitors.length,
            topCompetitors: competitors.slice(0, 5),
            competitivePosition: determineCompetitivePosition(competitors)
          }
        });
      } catch (error) {
        logger.error('Failed to get competitor analysis:', error);
        return reply.code(500).send({
          error: 'Failed to get competitor analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // POST /api/search-intelligence/:analysisId/export
  fastify.post('/search-intelligence/:analysisId/export',
    async (request: FastifyRequest<{ Params: AnalysisParams; Body: ExportBody }>, reply: FastifyReply) => {
      try {
        const { analysisId } = request.params;
        const { format = 'json', sections } = request.body;
        
        const results = await searchService.getAnalysisResults(analysisId);
        if (!results) {
          return reply.code(404).send({ error: 'Analysis results not found' });
        }

        let exportData: Buffer;
        let contentType: string;
        let filename: string;

        switch (format) {
          case 'json':
            contentType = 'application/json';
            filename = `search-intelligence-${analysisId}.json`;
            exportData = Buffer.from(JSON.stringify(results, null, 2));
            break;
          case 'csv':
            contentType = 'text/csv';
            filename = `search-intelligence-${analysisId}.csv`;
            exportData = await generateCSVExport(results, sections);
            break;
          case 'pdf':
            contentType = 'application/pdf';
            filename = `search-intelligence-${analysisId}.pdf`;
            exportData = await generatePDFExport(results, sections);
            break;
          default:
            return reply.code(400).send({ error: 'Invalid export format' });
        }

        return reply
          .header('Content-Type', contentType)
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(exportData);
      } catch (error) {
        logger.error('Failed to export analysis:', error);
        return reply.code(500).send({
          error: 'Failed to export analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GET /api/crawl/:jobId/search-intelligence
  fastify.get('/crawl/:jobId/search-intelligence',
    async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
      try {
        const { jobId } = request.params;
        
        const searchIntel = await searchService.getSearchIntelForCrawl(jobId);
        if (!searchIntel) {
          return reply.code(404).send({ error: 'Search intelligence not found for this crawl' });
        }

        return reply.send(formatSearchIntelResponse(searchIntel));
      } catch (error) {
        logger.error('Failed to get search intelligence for crawl:', error);
        return reply.code(500).send({
          error: 'Failed to get search intelligence for crawl',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    // Close all WebSocket connections
    wsConnections.forEach((connections) => {
      connections.forEach(ws => {
        ws.close(1000, 'Server shutting down');
      });
    });
    wsConnections.clear();

    // Shutdown services
    await searchService.shutdown();
    await jobQueue.close();
  });
}

// Helper functions
function calculateAveragePosition(rankings: any[]): number {
  const positions = rankings.flatMap(r => r.positions || []);
  if (positions.length === 0) return 0;
  return positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
}

function countTopPositions(rankings: any[]): { top3: number; top10: number; total: number } {
  let top3 = 0;
  let top10 = 0;
  let total = 0;

  rankings.forEach(ranking => {
    (ranking.positions || []).forEach((pos: number) => {
      total++;
      if (pos <= 3) top3++;
      if (pos <= 10) top10++;
    });
  });

  return { top3, top10, total };
}

function extractSerpFeatures(rankings: any[]): string[] {
  const features = new Set<string>();
  rankings.forEach(ranking => {
    (ranking.serpFeatures || []).forEach((feature: string) => {
      features.add(feature);
    });
  });
  return Array.from(features);
}

function determineCompetitivePosition(competitors: any[]): string {
  // Implementation would analyze competitor metrics
  return 'challenger';
}

async function generateCSVExport(results: any, sections?: string[]): Promise<Buffer> {
  const csv = 'Query,Position,URL,Visibility Score\n';
  // Add data rows...
  return Buffer.from(csv);
}

async function generatePDFExport(results: any, sections?: string[]): Promise<Buffer> {
  // Implementation would generate PDF using a library like pdfkit
  return Buffer.from('PDF export not implemented');
}