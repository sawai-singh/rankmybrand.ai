import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import Redis from 'ioredis';
import { SmartCrawler } from '../crawl/smart-crawler.js';
import { repositories } from '../db/repositories/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

// Request schemas
const CrawlRequestSchema = z.object({
  url: z.string().url(),
  options: z.object({
    maxPages: z.number().min(1).max(1000).default(500),
    maxDepth: z.number().min(1).max(5).default(3),
    targetKeywords: z.array(z.string()).default([]),
    includeSubdomains: z.boolean().default(false)
  }).optional()
});

const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50)
});

// Active crawl jobs tracking
const activeCrawlers = new Map<string, SmartCrawler>();

export async function crawlRoutes(fastify: FastifyInstance, redis: Redis) {
  // Start a new crawl
  fastify.post('/crawl', {
    schema: {
      body: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          options: {
            type: 'object',
            properties: {
              maxPages: { type: 'number', minimum: 1, maximum: 1000, default: 500 },
              maxDepth: { type: 'number', minimum: 1, maximum: 5, default: 3 },
              targetKeywords: { type: 'array', items: { type: 'string' }, default: [] },
              includeSubdomains: { type: 'boolean', default: false }
            }
          }
        },
        required: ['url']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string' },
            estimatedTime: { type: 'number' },
            websocketUrl: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof CrawlRequestSchema> }>, reply: FastifyReply) => {
    try {
      const { url, options } = request.body;
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname;
      
      // Create crawl job in database
      const crawlJob = await repositories.crawlJob.create(domain, {
        maxPages: options?.maxPages || config.MAX_PAGES_PER_CRAWL,
        maxDepth: options?.maxDepth || config.DEFAULT_CRAWL_DEPTH,
        targetKeywords: options?.targetKeywords || [],
        includeSubdomains: options?.includeSubdomains || false,
        jsRenderingBudget: config.JS_RENDERING_BUDGET,
        rateLimitPerSecond: config.RATE_LIMIT_PER_SECOND
      });
      
      // Update status to processing
      await repositories.crawlJob.updateStatus(crawlJob.id, 'processing');
      
      // Create and start crawler
      const crawler = new SmartCrawler({
        ...crawlJob.config,
        jobId: crawlJob.id,
        redis,
        onProgress: (message) => {
          // Emit WebSocket message
          fastify.websocketServer.clients.forEach((client: any) => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify({
                jobId: crawlJob.id,
                ...message
              }));
            }
          });
        }
      });
      
      // Track active crawler
      activeCrawlers.set(crawlJob.id, crawler);
      
      // Handle crawler events
      crawler.on('pageProcessed', async ({ result, scores, recommendations }) => {
        try {
          await repositories.crawledPage.create(crawlJob.id, result, scores, recommendations);
          await repositories.crawlJob.incrementPagesCrawled(crawlJob.id);
        } catch (error) {
          logger.error('Error saving crawled page', error);
        }
      });
      
      // Start crawling in background
      crawler.crawl([url])
        .then(async () => {
          await repositories.crawlJob.updateStatus(crawlJob.id, 'completed');
          logger.info(`Crawl job ${crawlJob.id} completed successfully`);
        })
        .catch(async (error) => {
          logger.error(`Crawl job ${crawlJob.id} failed`, error);
          await repositories.crawlJob.updateStatus(crawlJob.id, 'failed');
          await repositories.crawlJob.incrementErrors(crawlJob.id, error);
        })
        .finally(() => {
          activeCrawlers.delete(crawlJob.id);
        });
      
      // Estimate time based on pages and complexity
      const estimatedTime = Math.ceil((options?.maxPages || 500) * 0.12); // ~0.12 seconds per page
      
      return reply.send({
        jobId: crawlJob.id,
        status: 'processing',
        estimatedTime,
        websocketUrl: `wss://${request.hostname}/ws/crawl/${crawlJob.id}`
      });
      
    } catch (error) {
      logger.error('Error starting crawl', error);
      return reply.status(500).send({
        error: 'Failed to start crawl',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get crawl job status
  fastify.get('/crawl/:jobId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' }
        },
        required: ['jobId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      
      // Get job from database
      const job = await repositories.crawlJob.findById(jobId);
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      
      // Get statistics
      const stats = await repositories.crawlJob.getStats(jobId);
      const avgScores = await repositories.crawledPage.getAverageScores(jobId);
      const topPages = await repositories.crawledPage.getTopPerformingPages(jobId, 'overall', 5);
      
      // Get recommendations summary
      const pages = await repositories.crawledPage.findByJobId(jobId, 100);
      const allRecommendations = pages.flatMap(p => p.recommendations || []);
      
      const recommendationSummary = allRecommendations.reduce((acc: any, rec: any) => {
        const key = `${rec.metric}-${rec.action}`;
        if (!acc[key]) {
          acc[key] = { ...rec, count: 0 };
        }
        acc[key].count++;
        return acc;
      }, {});
      
      const topRecommendations = Object.values(recommendationSummary)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);
      
      return reply.send({
        jobId: job.id,
        status: job.status,
        domain: job.domain,
        config: job.config,
        progress: {
          pagesCrawled: job.pagesCrawled,
          pagesLimit: job.pagesLimit,
          startedAt: job.startedAt,
          completedAt: job.completedAt
        },
        summary: {
          totalPages: parseInt(stats.total_pages),
          avgResponseTime: parseFloat(stats.avg_response_time),
          jsRenderedPages: parseInt(stats.js_rendered_pages),
          avgGeoScore: parseFloat(stats.avg_geo_score),
          lastCrawled: stats.last_crawled
        },
        scores: avgScores,
        topPerformingPages: topPages,
        recommendations: topRecommendations
      });
      
    } catch (error) {
      logger.error('Error getting crawl job', error);
      return reply.status(500).send({
        error: 'Failed to get crawl job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get crawled pages for a job
  fastify.get('/crawl/:jobId/pages', {
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' }
        },
        required: ['jobId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { jobId: string },
    Querystring: z.infer<typeof PaginationSchema>
  }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      const { page = 1, limit = 50 } = request.query;
      
      const offset = (page - 1) * limit;
      const pages = await repositories.crawledPage.findByJobId(jobId, limit, offset);
      
      // Get total count for pagination
      const stats = await repositories.crawlJob.getStats(jobId);
      const total = parseInt(stats.total_pages);
      
      return reply.send({
        pages: pages.map(page => ({
          url: page.url,
          scores: page.geo_scores,
          recommendations: page.recommendations,
          crawledAt: page.crawled_at,
          responseTime: page.response_time_ms,
          renderMethod: page.render_method
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
      
    } catch (error) {
      logger.error('Error getting crawled pages', error);
      return reply.status(500).send({
        error: 'Failed to get crawled pages',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Stop a crawl job
  fastify.post('/crawl/:jobId/stop', {
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' }
        },
        required: ['jobId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      
      const crawler = activeCrawlers.get(jobId);
      if (crawler) {
        await crawler.stop();
        return reply.send({ message: 'Crawl job stopped' });
      }
      
      return reply.status(404).send({ error: 'Active crawl job not found' });
      
    } catch (error) {
      logger.error('Error stopping crawl', error);
      return reply.status(500).send({
        error: 'Failed to stop crawl',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get score distribution for a metric
  fastify.get('/crawl/:jobId/distribution/:metric', {
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' },
          metric: { 
            type: 'string', 
            enum: ['overall', 'citation', 'statistics', 'quotation', 'fluency', 'authority', 'relevance'] 
          }
        },
        required: ['jobId', 'metric']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { jobId: string; metric: string } 
  }>, reply: FastifyReply) => {
    try {
      const { jobId, metric } = request.params;
      
      const distribution = await repositories.crawledPage.getScoreDistribution(jobId, metric);
      
      return reply.send({
        metric,
        distribution: distribution.map(d => ({
          range: d.range,
          count: parseInt(d.count)
        }))
      });
      
    } catch (error) {
      logger.error('Error getting score distribution', error);
      return reply.status(500).send({
        error: 'Failed to get score distribution',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get errors for a crawl job
  fastify.get('/crawl/:jobId/errors', {
    schema: {
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' }
        },
        required: ['jobId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      
      const errors = await repositories.crawlError.findByJobId(jobId);
      const summary = await repositories.crawlError.getErrorSummary(jobId);
      
      return reply.send({
        errors: errors.map(e => ({
          url: e.url,
          errorType: e.error_type,
          errorMessage: e.error_message,
          occurredAt: e.occurred_at
        })),
        summary: summary.map(s => ({
          errorType: s.error_type,
          count: parseInt(s.count),
          lastOccurred: s.last_occurred
        }))
      });
      
    } catch (error) {
      logger.error('Error getting crawl errors', error);
      return reply.status(500).send({
        error: 'Failed to get crawl errors',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get recent crawl jobs
  fastify.get('/crawls/recent', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { limit = 20 } = request.query;
      
      const jobs = await repositories.crawlJob.getRecentJobs(limit);
      
      return reply.send({
        jobs: jobs.map(job => ({
          id: job.id,
          domain: job.domain,
          status: job.status,
          pagesCrawled: job.pagesCrawled,
          pagesLimit: job.pagesLimit,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        }))
      });
      
    } catch (error) {
      logger.error('Error getting recent jobs', error);
      return reply.status(500).send({
        error: 'Failed to get recent jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get domain statistics
  fastify.get('/domains/stats', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { domain?: string; search?: string; limit?: number } 
  }>, reply: FastifyReply) => {
    try {
      const { domain, search, limit = 20 } = request.query;
      
      // Refresh materialized view periodically
      await repositories.domainStatistics.refresh();
      
      if (domain) {
        const stats = await repositories.domainStatistics.getByDomain(domain);
        if (!stats) {
          return reply.status(404).send({ error: 'Domain not found' });
        }
        return reply.send(stats);
      }
      
      if (search) {
        const results = await repositories.domainStatistics.search(search, limit);
        return reply.send({ results });
      }
      
      const topDomains = await repositories.domainStatistics.getTopDomains(limit);
      return reply.send({ domains: topDomains });
      
    } catch (error) {
      logger.error('Error getting domain statistics', error);
      return reply.status(500).send({
        error: 'Failed to get domain statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
