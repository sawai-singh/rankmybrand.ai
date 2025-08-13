import Redis from 'ioredis';
import { Pool } from 'pg';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { OpenAICollector } from './openai.collector';
import { AnthropicCollector } from './anthropic.collector';
import { PerplexityCollector } from './perplexity.collector';
import { PlaywrightCollector } from './playwright.collector';
import { AIResponse, CollectionOptions, CollectorMetrics } from '../types';
import path from 'path';

// Import Foundation EventBus
const foundationPath = path.resolve(__dirname, '../../../foundation/src');
const { EventBus } = require(path.join(foundationPath, 'core/event-bus'));

export class CollectorOrchestrator {
  private collectors: Map<string, BaseCollector> = new Map();
  private redis: Redis;
  private dbPool: Pool;
  private eventBus: any;
  private concurrencyLimit: any;
  
  constructor(redis: Redis, dbPool: Pool) {
    this.redis = redis;
    this.dbPool = dbPool;
    this.eventBus = new EventBus({ host: process.env.REDIS_HOST });
    
    // Set concurrency limit for parallel processing
    const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '10');
    this.concurrencyLimit = pLimit(concurrency);
  }
  
  async initialize(): Promise<void> {
    console.log('Initializing collectors...');
    
    // Initialize API-based collectors
    const apiCollectors = [
      { name: 'openai', collector: new OpenAICollector(this.redis) },
      { name: 'anthropic', collector: new AnthropicCollector(this.redis) },
      { name: 'perplexity', collector: new PerplexityCollector(this.redis) }
    ];
    
    // Initialize web scraping collectors
    const scrapingCollectors = [
      { name: 'google-sge', collector: new PlaywrightCollector('google-sge', this.redis) },
      { name: 'bing-chat', collector: new PlaywrightCollector('bing-chat', this.redis) },
      { name: 'you-com', collector: new PlaywrightCollector('you-com', this.redis) },
      { name: 'phind', collector: new PlaywrightCollector('phind', this.redis) },
      { name: 'gemini', collector: new PlaywrightCollector('gemini', this.redis) }
    ];
    
    // Initialize all collectors
    const allCollectors = [...apiCollectors, ...scrapingCollectors];
    
    for (const { name, collector } of allCollectors) {
      try {
        await collector.initialize();
        const isValid = await collector.validate();
        
        if (isValid) {
          this.collectors.set(name, collector);
          console.log(`✅ Collector ${name} initialized successfully`);
        } else {
          console.warn(`⚠️ Collector ${name} validation failed, skipping`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to initialize ${name} collector:`, error.message);
      }
    }
    
    console.log(`Initialized ${this.collectors.size} collectors`);
  }
  
  async collectResponses(
    platforms: string[],
    prompts: string[],
    options?: CollectionOptions
  ): Promise<AIResponse[]> {
    const results: AIResponse[] = [];
    const errors: { platform: string; prompt: string; error: string }[] = [];
    
    // Create collection tasks
    const tasks = [];
    for (const platform of platforms) {
      const collector = this.collectors.get(platform);
      
      if (!collector) {
        console.warn(`Collector ${platform} not available`);
        continue;
      }
      
      for (const prompt of prompts) {
        // Create task with concurrency limiting
        const task = this.concurrencyLimit(async () => {
          try {
            console.log(`Collecting from ${platform}: "${prompt.substring(0, 50)}..."`);
            
            const response = await collector.collect(prompt, options);
            
            // Store in database
            await this.storeResponse(response);
            
            // Publish success event
            await this.eventBus.publish('ai.responses.collected', {
              type: 'response.success',
              data: {
                platform,
                prompt,
                responseId: response.id,
                tokensUsed: response.tokensUsed,
                cost: response.cost
              }
            });
            
            return response;
          } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            
            errors.push({ platform, prompt, error: errorMessage });
            
            // Publish error event
            await this.eventBus.publish('ai.responses.errors', {
              type: 'response.error',
              data: {
                platform,
                prompt,
                error: errorMessage
              }
            });
            
            // Check if we should retry with a different platform
            if (error.retryAfter) {
              console.log(`Rate limited on ${platform}, will retry after ${error.retryAfter}s`);
            }
            
            throw error;
          }
        });
        
        tasks.push(task);
      }
    }
    
    // Execute all tasks in parallel (with concurrency limit)
    const settledResults = await Promise.allSettled(tasks);
    
    // Process results
    for (const result of settledResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
    
    // Log summary
    console.log(`Collection complete: ${results.length} successful, ${errors.length} failed`);
    
    if (errors.length > 0) {
      console.error('Collection errors:', errors);
    }
    
    return results;
  }
  
  private async storeResponse(response: AIResponse): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      // Get or create platform ID
      const platformResult = await client.query(
        'SELECT id FROM ai_monitor.platforms WHERE name = $1',
        [response.platform]
      );
      
      if (platformResult.rowCount === 0) {
        throw new Error(`Platform ${response.platform} not found`);
      }
      
      const platformId = platformResult.rows[0].id;
      
      // Store prompt if not exists
      const promptResult = await client.query(
        `INSERT INTO ai_monitor.prompts (brand_id, prompt_text, prompt_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (brand_id, prompt_text) DO UPDATE SET prompt_text = EXCLUDED.prompt_text
         RETURNING id`,
        [uuidv4(), response.prompt, 'general'] // TODO: Get actual brand_id from context
      );
      
      const promptId = promptResult.rows[0].id;
      
      // Store response
      await client.query(
        `INSERT INTO ai_monitor.responses 
         (id, platform_id, prompt_id, response_text, response_metadata, citations, 
          processing_time_ms, tokens_used, cost_cents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          response.id,
          platformId,
          promptId,
          response.response,
          JSON.stringify(response.metadata || {}),
          JSON.stringify(response.citations || []),
          response.processingTime,
          response.tokensUsed,
          response.cost ? Math.round(response.cost * 100) : 0, // Convert to cents
          response.timestamp
        ]
      );
    } finally {
      client.release();
    }
  }
  
  async getActiveCollectors(): Promise<string[]> {
    return Array.from(this.collectors.keys());
  }
  
  async getCollectorStatus(platform: string): Promise<{
    available: boolean;
    healthy: boolean;
    metrics?: any;
  }> {
    const collector = this.collectors.get(platform);
    
    if (!collector) {
      return { available: false, healthy: false };
    }
    
    const healthy = await collector.isHealthy();
    const metrics = await collector.getMetrics();
    
    return {
      available: true,
      healthy,
      metrics
    };
  }
  
  async getMetrics(): Promise<CollectorMetrics[]> {
    const metrics: CollectorMetrics[] = [];
    
    for (const [platform, collector] of this.collectors) {
      const collectorMetrics = await collector.getMetrics();
      
      metrics.push({
        platform,
        totalRequests: collectorMetrics.totalRequests,
        successfulRequests: collectorMetrics.successfulRequests,
        failedRequests: collectorMetrics.failedRequests,
        averageResponseTime: collectorMetrics.averageResponseTime,
        totalCost: collectorMetrics.totalCost,
        cacheHitRate: collectorMetrics.cacheHitRate,
        lastUpdated: new Date()
      });
    }
    
    return metrics;
  }
  
  async getStatistics(): Promise<{
    totalResponses: number;
    totalCost: number;
    averageResponseTime: number;
    successRate: number;
    platformBreakdown: Record<string, number>;
    hourlyTrend: any[];
  }> {
    const client = await this.dbPool.connect();
    
    try {
      // Get total responses
      const totalResult = await client.query(
        'SELECT COUNT(*) as total FROM ai_monitor.responses'
      );
      
      // Get cost summary
      const costResult = await client.query(
        'SELECT SUM(cost_cents) as total_cost FROM ai_monitor.responses'
      );
      
      // Get average response time
      const avgTimeResult = await client.query(
        'SELECT AVG(processing_time_ms) as avg_time FROM ai_monitor.responses'
      );
      
      // Get platform breakdown
      const platformResult = await client.query(
        `SELECT p.name, COUNT(r.*) as count
         FROM ai_monitor.responses r
         JOIN ai_monitor.platforms p ON r.platform_id = p.id
         GROUP BY p.name`
      );
      
      // Get hourly trend for last 24 hours
      const trendResult = await client.query(
        `SELECT 
           date_trunc('hour', created_at) as hour,
           COUNT(*) as count,
           AVG(processing_time_ms) as avg_time
         FROM ai_monitor.responses
         WHERE created_at > NOW() - INTERVAL '24 hours'
         GROUP BY date_trunc('hour', created_at)
         ORDER BY hour`
      );
      
      const platformBreakdown: Record<string, number> = {};
      platformResult.rows.forEach(row => {
        platformBreakdown[row.name] = parseInt(row.count);
      });
      
      return {
        totalResponses: parseInt(totalResult.rows[0].total),
        totalCost: parseFloat(costResult.rows[0].total_cost || '0') / 100, // Convert from cents
        averageResponseTime: parseFloat(avgTimeResult.rows[0].avg_time || '0'),
        successRate: 95, // TODO: Calculate actual success rate
        platformBreakdown,
        hourlyTrend: trendResult.rows
      };
    } finally {
      client.release();
    }
  }
  
  /**
   * Intelligent platform selection based on prompt type and availability
   */
  async selectOptimalPlatform(
    prompt: string,
    preferredPlatforms?: string[]
  ): Promise<string> {
    // Get available collectors
    const available = Array.from(this.collectors.keys());
    
    if (available.length === 0) {
      throw new Error('No collectors available');
    }
    
    // Filter by preferred platforms if specified
    const candidates = preferredPlatforms
      ? available.filter(p => preferredPlatforms.includes(p))
      : available;
    
    if (candidates.length === 0) {
      return available[0]; // Fallback to any available
    }
    
    // Get metrics for each candidate
    const platformMetrics = await Promise.all(
      candidates.map(async (platform) => {
        const collector = this.collectors.get(platform)!;
        const metrics = await collector.getMetrics();
        
        return {
          platform,
          score: this.calculatePlatformScore(metrics)
        };
      })
    );
    
    // Sort by score and return best platform
    platformMetrics.sort((a, b) => b.score - a.score);
    
    return platformMetrics[0].platform;
  }
  
  private calculatePlatformScore(metrics: any): number {
    // Score based on success rate, response time, and cost
    const successWeight = 0.5;
    const speedWeight = 0.3;
    const costWeight = 0.2;
    
    const successScore = metrics.successRate || 0;
    const speedScore = Math.max(0, 100 - (metrics.averageResponseTime / 100));
    const costScore = Math.max(0, 100 - metrics.totalCost);
    
    return (successScore * successWeight) +
           (speedScore * speedWeight) +
           (costScore * costWeight);
  }
}