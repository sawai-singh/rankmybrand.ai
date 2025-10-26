/**
 * Logger wrapper for Search Intelligence
 * Re-exports the main logger utility
 */

import { logger } from '../../utils/logger.js';

export { logger };

// Create a Logger class for compatibility
export class Logger {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  info(message: string, ...args: any[]) {
    logger.info(`[${this.prefix}] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]) {
    logger.error(`[${this.prefix}] ${message}`, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    logger.warn(`[${this.prefix}] ${message}`, ...args);
  }
  
  debug(message: string, ...args: any[]) {
    logger.debug(`[${this.prefix}] ${message}`, ...args);
  }
}