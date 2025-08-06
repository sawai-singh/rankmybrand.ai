import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Redis from 'ioredis';
import { register } from 'prom-client';
import { config } from './utils/config.js';
import { logger, stream } from './utils/logger.js';
import { testConnection, close as closeDB } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { crawlRoutes } from './api/crawl-routes.js';
import { registerSearchIntelligence } from './api/search-intelligence-integration.js';

// Create Redis client
const redis = new Redis(config.REDIS_URL, {
  password: config.REDIS_PASSWORD || undefined,
  db: config.REDIS_DB,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Handle Redis errors
redis.on('error', (err) => {
  logger.error('Redis connection error', err);
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

// Create Fastify instance
const fastify = Fastify({
  logger: false, // We use Winston instead
  trustProxy: true,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
  bodyLimit: 10485760 // 10MB
});

// Register plugins
await fastify.register(cors, {
  origin: config.ALLOWED_ORIGINS,
  credentials: true
});

await fastify.register(helmet, {
  contentSecurityPolicy: false // Disable for API
});

await fastify.register(rateLimit, {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW_MS
});

await fastify.register(websocket);

// Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'RankMyBrand Web Crawler API',
      description: 'GEO-optimized web crawler for AI search visibility',
      version: '1.0.0'
    },
    host: `localhost:${config.PORT}`,
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
      { name: 'crawl', description: 'Crawl operations' },
      { name: 'domains', description: 'Domain statistics' }
    ]
  }
});

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  },
  staticCSP: true,
  transformStaticCSP: (header) => header
});

// Health check route
fastify.get('/health', async (request, reply) => {
  const dbHealthy = await testConnection();
  const redisHealthy = redis.status === 'ready';
  
  const health = {
    status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy'
    }
  };
  
  return reply
    .status(health.status === 'healthy' ? 200 : 503)
    .send(health);
});

// Metrics endpoint
if (config.ENABLE_METRICS) {
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });
}

// API Routes
fastify.register(async function apiRoutes(fastify) {
  await fastify.register((instance, opts, done) => {
    crawlRoutes(instance, redis).then(() => done()).catch(done);
  }, { prefix: '/api' });
  
  // Search Intelligence routes with clean integration
  await fastify.register((instance, opts, done) => {
    registerSearchIntelligence(instance, redis).then(() => done()).catch(done);
  }, { prefix: '/api' });
});

// WebSocket handler for real-time updates
fastify.register(async function wsRoutes(fastify) {
  fastify.get('/ws/crawl/:jobId', { websocket: true }, (connection, req) => {
    const { jobId } = req.params as { jobId: string };
    
    logger.info(`WebSocket connection established for job ${jobId}`);
    
    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        logger.debug(`WebSocket message received for job ${jobId}`, data);
      } catch (error) {
        logger.error('Invalid WebSocket message', error);
      }
    });
    
    connection.socket.on('close', () => {
      logger.info(`WebSocket connection closed for job ${jobId}`);
    });
  });
  
  // Search Intelligence WebSocket
  fastify.get('/ws/search-intel/:analysisId', { websocket: true }, (connection, req) => {
    const { analysisId } = req.params as { analysisId: string };
    
    logger.info(`WebSocket connection established for search intelligence analysis ${analysisId}`);
    
    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        logger.debug(`WebSocket message received for analysis ${analysisId}`, data);
      } catch (error) {
        logger.error('Invalid WebSocket message', error);
      }
    });
    
    connection.socket.on('close', () => {
      logger.info(`WebSocket connection closed for analysis ${analysisId}`);
    });
  });
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method
  });
  
  reply.status(error.statusCode || 500).send({
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'development' ? error.message : 'An error occurred',
    requestId: request.id
  });
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  try {
    await fastify.close();
    await redis.quit();
    await closeDB();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const start = async () => {
  try {
    // Run database migrations
    logger.info('Running database migrations...');
    await runMigrations();
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Start server
    await fastify.listen({
      port: config.PORT,
      host: config.HOST
    });
    
    logger.info(`Server listening on ${config.HOST}:${config.PORT}`);
    logger.info(`Swagger documentation available at http://localhost:${config.PORT}/docs`);
    
    if (config.ENABLE_METRICS) {
      logger.info(`Metrics available at http://localhost:${config.PORT}/metrics`);
    }
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Start the server
start();
