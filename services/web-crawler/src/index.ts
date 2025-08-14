import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from 'dotenv';
import { CrawlerService } from './services/crawler.service';
import { SERPService } from './services/serp.service';
import { DatabaseService } from './services/database.service';
import { QueueService } from './services/queue.service';
import { crawlerRoutes } from './routes/crawler.routes';
import { serpRoutes } from './routes/serp.routes';
import { healthRoutes } from './routes/health.routes';
import { logger } from './utils/logger';

config();

const server = Fastify({
  logger: logger as any,
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  trustProxy: true,
});

async function startServer() {
  try {
    // Initialize services
    const dbService = new DatabaseService();
    await dbService.connect();
    
    const queueService = new QueueService();
    await queueService.initialize();
    
    const crawlerService = new CrawlerService(dbService, queueService);
    await crawlerService.initialize();
    
    const serpService = new SERPService(dbService);
    await serpService.initialize();
    
    // Register plugins
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });
    
    await server.register(cors, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:4000'],
      credentials: true,
    });
    
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });
    
    // Dependency injection
    server.decorate('crawlerService', crawlerService);
    server.decorate('serpService', serpService);
    server.decorate('dbService', dbService);
    server.decorate('queueService', queueService);
    
    // Register routes
    await server.register(healthRoutes, { prefix: '/health' });
    await server.register(crawlerRoutes, { prefix: '/api/crawl' });
    await server.register(serpRoutes, { prefix: '/api/serp' });
    
    // Graceful shutdown
    const gracefulShutdown = async () => {
      server.log.info('Shutting down gracefully...');
      await server.close();
      await crawlerService.shutdown();
      await queueService.shutdown();
      await dbService.disconnect();
      process.exit(0);
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // Start server
    const port = parseInt(process.env.PORT || '3002', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    server.log.info(`Web Crawler Service running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer();