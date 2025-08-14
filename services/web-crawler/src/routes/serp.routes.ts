import { FastifyPluginAsync } from 'fastify';
import { SERPService } from '../services/serp.service';
import { DatabaseService } from '../services/database.service';
import { logger } from '../utils/logger';

export const serpRoutes: FastifyPluginAsync = async (server) => {
  const db = new DatabaseService();
  await db.connect();
  
  const serpService = new SERPService(db);
  await serpService.initialize();
  
  // Analyze SERP for query
  server.post('/serp/analyze', async (request, reply) => {
    try {
      const { query, platforms = ['google'] } = request.body as any;
      
      if (!query) {
        return reply.status(400).send({ error: 'Query is required' });
      }
      
      const results = await serpService.analyzeQuery(query, platforms);
      
      return reply.send(results);
    } catch (error) {
      logger.error({ error }, 'Failed to analyze SERP');
      return reply.status(500).send({ error: 'Failed to analyze SERP' });
    }
  });
  
  // Get competitors for domain
  server.get('/serp/competitors/:domain', async (request, reply) => {
    try {
      const { domain } = request.params as any;
      
      if (!domain) {
        return reply.status(400).send({ error: 'Domain is required' });
      }
      
      const competitors = await serpService.getCompetitors(domain);
      
      return reply.send({ domain, competitors });
    } catch (error) {
      logger.error({ error }, 'Failed to get competitors');
      return reply.status(500).send({ error: 'Failed to get competitors' });
    }
  });
};