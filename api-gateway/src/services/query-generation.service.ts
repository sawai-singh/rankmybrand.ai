/**
 * Query Generation Service
 * Handles AI query generation for companies with proper error handling and retry logic
 */

import { logger } from '../utils/logger';
import { db } from '../database/connection';
import * as http from 'http';

interface QueryGenerationRequest {
  company_id: number;
  company_name: string;
  domain: string;
  industry: string;
  description: string;
  competitors: string[];
  products_services?: string[];
  force_regenerate?: boolean;
}

class QueryGenerationService {
  private static instance: QueryGenerationService;
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5 seconds
  private pendingQueue: Map<number, QueryGenerationRequest> = new Map();
  private processingQueue: Set<number> = new Set();

  private constructor() {
    // Start processing pending queries every 30 seconds
    setInterval(() => this.processPendingQueue(), 30000);
  }

  public static getInstance(): QueryGenerationService {
    if (!QueryGenerationService.instance) {
      QueryGenerationService.instance = new QueryGenerationService();
    }
    return QueryGenerationService.instance;
  }

  /**
   * Schedule query generation for a company
   * This method ensures queries are generated even if the initial attempt fails
   */
  public async scheduleQueryGeneration(companyId: number): Promise<void> {
    try {
      // Check if already processing or scheduled
      if (this.processingQueue.has(companyId) || this.pendingQueue.has(companyId)) {
        logger.info(`Query generation already scheduled for company ${companyId}`);
        return;
      }

      // Check if queries already exist
      const existingQueries = await db.query(
        'SELECT COUNT(*) as count FROM ai_queries WHERE company_id = $1',
        [companyId]
      );

      if (existingQueries.rows[0]?.count > 0) {
        logger.info(`Company ${companyId} already has ${existingQueries.rows[0].count} queries`);
        return;
      }

      // Fetch company details
      const companyResult = await db.query(
        `SELECT c.id, c.name, c.domain, c.industry, c.description,
                array_agg(DISTINCT comp.competitor_name) FILTER (WHERE comp.competitor_name IS NOT NULL) as competitors
         FROM companies c
         LEFT JOIN competitors comp ON c.id = comp.company_id
         WHERE c.id = $1
         GROUP BY c.id`,
        [companyId]
      );

      if (!companyResult.rows[0]) {
        logger.error(`Company ${companyId} not found`);
        return;
      }

      const company = companyResult.rows[0];
      const request: QueryGenerationRequest = {
        company_id: company.id,
        company_name: company.name,
        domain: company.domain,
        industry: company.industry || 'Technology',
        description: company.description || '',
        competitors: company.competitors || [],
        products_services: [],
        force_regenerate: false
      };

      // Add to pending queue
      this.pendingQueue.set(companyId, request);
      logger.info(`Scheduled query generation for company ${company.name} (ID: ${companyId})`);

      // Try to process immediately
      await this.processQueryGeneration(companyId, request);
    } catch (error) {
      logger.error(`Failed to schedule query generation for company ${companyId}:`, error);
      // Even if scheduling fails, we'll retry in the background
    }
  }

  /**
   * Process query generation with retry logic
   */
  private async processQueryGeneration(
    companyId: number, 
    request: QueryGenerationRequest, 
    retryCount: number = 0
  ): Promise<void> {
    if (this.processingQueue.has(companyId)) {
      return;
    }

    this.processingQueue.add(companyId);

    try {
      logger.info(`Processing query generation for ${request.company_name} (attempt ${retryCount + 1})`);

      const success = await this.callIntelligenceEngine(request);

      if (success) {
        // Remove from pending queue on success
        this.pendingQueue.delete(companyId);
        logger.info(`Successfully generated queries for company ${request.company_name}`);
        
        // Verify queries were saved
        const verifyResult = await db.query(
          'SELECT COUNT(*) as count FROM ai_queries WHERE company_id = $1',
          [companyId]
        );
        
        logger.info(`Verified ${verifyResult.rows[0]?.count} queries saved for company ${companyId}`);
      } else if (retryCount < this.maxRetries) {
        // Retry after delay
        logger.warn(`Query generation failed for ${request.company_name}, retrying in ${this.retryDelay}ms...`);
        setTimeout(() => {
          this.processingQueue.delete(companyId);
          this.processQueryGeneration(companyId, request, retryCount + 1);
        }, this.retryDelay);
      } else {
        logger.error(`Query generation failed after ${this.maxRetries} attempts for company ${request.company_name}`);
        // Keep in pending queue for background retry
      }
    } catch (error) {
      logger.error(`Error processing query generation for company ${companyId}:`, error);
      if (retryCount < this.maxRetries) {
        setTimeout(() => {
          this.processingQueue.delete(companyId);
          this.processQueryGeneration(companyId, request, retryCount + 1);
        }, this.retryDelay);
      }
    } finally {
      this.processingQueue.delete(companyId);
    }
  }

  /**
   * Call the Intelligence Engine API to generate queries
   */
  private async callIntelligenceEngine(request: QueryGenerationRequest): Promise<boolean> {
    return new Promise((resolve) => {
      const postData = JSON.stringify(request);
      
      const options = {
        hostname: 'localhost',
        port: 8002,
        path: '/api/ai-visibility/generate-queries',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 60000 // 60 second timeout
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data);
              logger.info(`Intelligence Engine response: ${result.message || 'Success'}`);
              resolve(true);
            } catch (parseError) {
              logger.error('Failed to parse Intelligence Engine response:', parseError);
              resolve(false);
            }
          } else {
            logger.error(`Intelligence Engine returned status ${res.statusCode}: ${data}`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`Intelligence Engine request failed: ${error.message}`);
        resolve(false);
      });

      req.on('timeout', () => {
        logger.error('Intelligence Engine request timed out');
        req.destroy();
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Process any pending queries in the background
   */
  private async processPendingQueue(): Promise<void> {
    if (this.pendingQueue.size === 0) {
      return;
    }

    logger.info(`Processing ${this.pendingQueue.size} pending query generations`);

    for (const [companyId, request] of this.pendingQueue.entries()) {
      if (!this.processingQueue.has(companyId)) {
        await this.processQueryGeneration(companyId, request);
      }
    }
  }

  /**
   * Get status of query generation for a company
   */
  public getStatus(companyId: number): string {
    if (this.processingQueue.has(companyId)) {
      return 'processing';
    }
    if (this.pendingQueue.has(companyId)) {
      return 'pending';
    }
    return 'none';
  }
}

export const queryGenerationService = QueryGenerationService.getInstance();