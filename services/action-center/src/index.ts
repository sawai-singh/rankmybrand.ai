import { ActionProcessor } from './processors/action-processor';
import { ApiServer } from './api/server';
import { Database } from './lib/database';
import { MetricsCollector } from './lib/metrics';
import { logger } from './lib/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info('Starting Action Center...');

    // Initialize shared resources
    const db = new Database();
    const metrics = new MetricsCollector();

    // Initialize database
    await db.initialize();

    // Start API server
    const apiServer = new ApiServer(db, metrics);
    await apiServer.start();

    // Start action processor
    const processor = new ActionProcessor();
    await processor.initialize();
    await processor.start();

    // Handle shutdown gracefully
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await processor.stop();
      await db.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await processor.stop();
      await db.close();
      process.exit(0);
    });

    logger.info('Action Center started successfully');

  } catch (error) {
    logger.error('Failed to start Action Center:', error);
    process.exit(1);
  }
}

// Start the application
main();