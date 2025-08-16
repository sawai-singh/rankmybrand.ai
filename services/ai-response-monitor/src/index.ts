import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { AIMonitorService } from './services/ai-monitor.service';
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
    logger.info('Starting AI Response Monitor Service...');
    logger.info('Configuration:', {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      cacheEnabled: process.env.CACHE_ENABLED === 'true',
      headlessBrowser: process.env.HEADLESS_BROWSER !== 'false'
    });
    
    const service = new AIMonitorService();
    await service.start();
    
    logger.info('AI Response Monitor Service started successfully');
    logger.info('Available collectors will be initialized based on API key availability');
    
  } catch (error) {
    logger.error('Failed to start AI Response Monitor Service:', error);
    process.exit(1);
  }
}

// Start the application
main();