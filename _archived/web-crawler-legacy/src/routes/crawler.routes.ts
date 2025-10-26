import { FastifyPluginAsync } from 'fastify';
import { CrawlerService } from '../services/crawler.service';
import { DatabaseService } from '../services/database.service';
import { QueueService } from '../services/queue.service';
import { logger } from '../utils/logger';

export const crawlerRoutes: FastifyPluginAsync = async (server) => {
  const db = new DatabaseService();
  const queue = new QueueService();
  const crawler = new CrawlerService(db, queue);
  
  await db.connect();
  await queue.initialize();
  await crawler.initialize();
  
  // Start crawl job
  server.post('/', async (request, reply) => {
    try {
      const { url, depth = 2, userId } = request.body as any;
      
      if (!url) {
        return reply.status(400).send({ error: 'URL is required' });
      }
      
      const job = await crawler.createCrawlJob(url, depth, userId);
      
      return reply.send({
        jobId: job.id,
        status: job.status,
        url: job.url,
        depth: job.depth
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start crawl job');
      return reply.status(500).send({ error: 'Failed to start crawl job' });
    }
  });
  
  // Get crawl job status
  server.get('/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params as any;
      const job = await db.getCrawlJob(jobId);
      
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      
      return reply.send(job);
    } catch (error) {
      logger.error({ error }, 'Failed to get crawl job');
      return reply.status(500).send({ error: 'Failed to get crawl job' });
    }
  });
  
  // Get crawl results
  server.get('/:jobId/results', async (request, reply) => {
    try {
      const { jobId } = request.params as any;
      const job = await db.getCrawlJob(jobId);
      
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      
      return reply.send({
        jobId: job.id,
        status: job.status,
        results: job.results || [],
        pagesScanned: job.pagesScanned,
        duration: job.duration
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get crawl results');
      return reply.status(500).send({ error: 'Failed to get crawl results' });
    }
  });
};