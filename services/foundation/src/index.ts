import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { FoundationService } from './services/foundation.service';
import { logger } from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
async function main() {
  try {
    logger.info('Starting Foundation Infrastructure Service...');
    
    const service = new FoundationService({
      serviceName: 'foundation',
      version: '1.0.0',
      port: parseInt(process.env.SERVICE_PORT || '3000'),
      corsOptions: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true
      },
      rateLimitConfig: {
        enabled: process.env.RATE_LIMIT_ENABLED === 'true',
        maxTokens: parseInt(process.env.RATE_LIMIT_MAX_TOKENS || '1000'),
        refillRate: parseInt(process.env.RATE_LIMIT_REFILL_RATE || '100')
      }
    });
    
    await service.start();
    
    logger.info('Foundation Infrastructure Service started successfully');
  } catch (error) {
    logger.error('Failed to start Foundation Infrastructure Service:', error);
    process.exit(1);
  }
}

// Start the application
main();