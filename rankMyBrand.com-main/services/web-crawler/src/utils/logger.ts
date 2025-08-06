import winston from 'winston';
import { config } from './config.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  const msg = stack || message;
  return `${timestamp} [${level}]: ${msg}`;
});

// Custom format for file output
const fileFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const msg = stack || message;
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${level}]: ${msg} ${metaStr}`;
});

// Create the logger
export const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        consoleFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
      format: fileFormat
    })
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/rejections.log',
      format: fileFormat
    })
  ]
});

// Stream for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper functions for structured logging
export const logCrawlStart = (jobId: string, config: any) => {
  logger.info('Crawl job started', {
    jobId,
    config: {
      maxPages: config.maxPages,
      maxDepth: config.maxDepth,
      targetKeywords: config.targetKeywords
    }
  });
};

export const logCrawlComplete = (jobId: string, stats: any) => {
  logger.info('Crawl job completed', {
    jobId,
    stats
  });
};

export const logPageCrawled = (url: string, scores: any, duration: number) => {
  logger.debug('Page crawled', {
    url,
    scores,
    duration
  });
};

export const logError = (context: string, error: Error, metadata?: any) => {
  logger.error(`Error in ${context}`, {
    error: error.message,
    stack: error.stack,
    ...metadata
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.debug(`Performance: ${operation}`, {
    duration,
    ...metadata
  });
};

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  mkdirSync(`${__dirname}/../../logs`, { recursive: true });
} catch (error) {
  // Directory might already exist
}
