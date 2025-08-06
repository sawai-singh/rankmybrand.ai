/**
 * Search Intelligence Integration Module
 * 
 * This module provides a clean integration layer for the Search Intelligence
 * functionality in our monolithic architecture.
 */

import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { searchIntelRoutesV2 } from '../search-intelligence/api/search-intel-routes-v2-fixed.js';

// Types for Search Intelligence
interface SearchIntelAnalysis {
  analysisId: string;
  brand: string;
  domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: any;
}

/**
 * Registers Search Intelligence routes with the Fastify instance
 * This is the main integration point for Search Intelligence
 */
export async function registerSearchIntelligence(fastify: FastifyInstance, redis: Redis) {
  logger.info('Registering Search Intelligence routes...');
  
  try {
    // Register the full Search Intelligence API routes
    await searchIntelRoutesV2(fastify, redis);
    
    logger.info('Search Intelligence routes registered successfully');
    
  } catch (error) {
    logger.error('Failed to register Search Intelligence routes:', error);
    // Don't throw - allow service to start
  }
}