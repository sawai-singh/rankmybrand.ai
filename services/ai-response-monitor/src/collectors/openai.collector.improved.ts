import OpenAI from 'openai';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions } from '../types';

interface OpenAIConfig {
  apiKey?: string;
  organization?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
  dangerouslyAllowBrowser?: boolean;
}

interface CostLimits {
  daily?: number;
  monthly?: number;
  perRequest?: number;
}

export class ImprovedOpenAICollector extends BaseCollector {
  private client?: OpenAI;
  private models: string[] = ['gpt-5-nano-2025-08-07'];
  private costLimits: CostLimits = {};
  private dailyCost: number = 0;
  private monthlyCost: number = 0;
  private lastResetDate: Date = new Date();
  private requestIdMap: Map<string, any> = new Map();
  
  constructor(redis: Redis, config?: OpenAIConfig) {
    super('openai', redis);
    this.initializeCostLimits();
  }
  
  private initializeCostLimits() {
    this.costLimits = {
      daily: parseFloat(process.env.OPENAI_DAILY_COST_LIMIT || '100'),
      monthly: parseFloat(process.env.OPENAI_MONTHLY_COST_LIMIT || '3000'),
      perRequest: parseFloat(process.env.OPENAI_PER_REQUEST_COST_LIMIT || '1')
    };
  }
  
  async initialize(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    this.client = new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORG_ID,
      maxRetries: 3,
      timeout: 30000,
      defaultHeaders: {
        'X-Request-Source': 'rankmybrand-ai-monitor',
        'X-Service-Version': '1.0.0'
      }
    });
    
    // Load cost tracking from Redis
    await this.loadCostTracking();
    
    // Test connection
    await this.validate();
  }
  
  async validate(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      // Make a minimal API call to validate the key
      const models = await this.client.models.list();
      
      // Check if gpt-5-nano-2025-08-07 is available
      const hasTargetModel = models.data.some(
        model => model.id === 'gpt-5-nano-2025-08-07'
      );
      
      if (!hasTargetModel) {
        console.warn('Warning: gpt-5-nano-2025-08-07 not found in available models');
      }
      
      return models.data.length > 0;
    } catch (error: any) {
      console.error('OpenAI validation failed:', error.message);
      return false;
    }
  }
  
  async collect(prompt: string, options?: CollectionOptions): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }
    
    const startTime = Date.now();
    const requestId = options?.requestId || uuidv4();
    const responseId = uuidv4();
    
    // Check cost limits before making request
    await this.checkCostLimits();
    
    try {
      // Store request metadata
      this.requestIdMap.set(requestId, {
        prompt,
        options,
        startTime,
        status: 'pending'
      });
      
      // Check cache first
      const cacheKey = this.generateCacheKey(prompt, options);
      const { data: cachedResponse, fromCache } = await this.withCache(
        cacheKey,
        options?.cacheTTL || this.cacheTTL,
        async () => {
          // Execute with exponential backoff for rate limits
          return this.withExponentialBackoff(async () => {
            return this.executeRequest(prompt, options);
          }, options?.retries || 3);
        }
      );
      
      const processingTime = Date.now() - startTime;
      const cost = this.calculateCost({
        model: cachedResponse.model,
        promptTokens: cachedResponse.promptTokens,
        completionTokens: cachedResponse.completionTokens
      });
      
      // Update cost tracking
      await this.updateCostTracking(cost);
      
      const aiResponse: AIResponse = {
        id: responseId,
        platform: 'openai',
        prompt,
        response: cachedResponse.response,
        model: cachedResponse.model,
        tokensUsed: cachedResponse.tokensUsed,
        processingTime,
        cost,
        metadata: {
          requestId,
          fromCache,
          finishReason: cachedResponse.finishReason,
          promptTokens: cachedResponse.promptTokens,
          completionTokens: cachedResponse.completionTokens,
          systemFingerprint: cachedResponse.systemFingerprint
        },
        timestamp: new Date()
      };
      
      // Update request status
      this.requestIdMap.set(requestId, {
        ...this.requestIdMap.get(requestId),
        status: 'completed',
        responseId,
        processingTime
      });
      
      // Track metrics
      this.trackMetrics(true, cost, processingTime);
      
      // Publish to event bus (only if not from cache)
      if (!fromCache) {
        await this.publishResponse(aiResponse);
        
        // Send telemetry
        await this.sendTelemetry(aiResponse);
      }
      
      return this.sanitizeResponse(aiResponse);
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      // Update request status
      this.requestIdMap.set(requestId, {
        ...this.requestIdMap.get(requestId),
        status: 'failed',
        error: error.message,
        processingTime
      });
      
      // Track failed request
      this.trackMetrics(false, 0, processingTime);
      
      // Enhanced error handling
      throw this.handleError(error);
    }
  }
  
  private async executeRequest(prompt: string, options?: CollectionOptions) {
    const model = options?.model || 'gpt-5-nano-2025-08-07';
    
    // Support for different response formats
    const responseFormat = options?.responseFormat || undefined;
    
    // Support for function calling if provided
    const functions = options?.functions || undefined;
    const functionCall = options?.functionCall || undefined;
    
    const completion = await this.client!.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: options?.systemPrompt || 'You are a helpful assistant. Provide informative and accurate responses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
      top_p: options?.topP || 1,
      frequency_penalty: options?.frequencyPenalty || 0,
      presence_penalty: options?.presencePenalty || 0,
      response_format: responseFormat,
      functions,
      function_call: functionCall,
      user: options?.userId || 'rankmybrand-system',
      seed: options?.seed // For deterministic outputs
    });
    
    const response = completion.choices[0].message.content || '';
    const usage = completion.usage;
    
    return {
      response,
      model: completion.model,
      tokensUsed: usage?.total_tokens,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      finishReason: completion.choices[0].finish_reason,
      systemFingerprint: completion.system_fingerprint,
      functionCall: completion.choices[0].message.function_call
    };
  }
  
  private async withExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (error.status === 429 || error.status === 503) {
          const delay = Math.min(1000 * Math.pow(2, i), 30000);
          console.log(`Rate limit hit, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }
  
  private generateCacheKey(prompt: string, options?: CollectionOptions): string {
    const keyData = {
      prompt,
      model: options?.model || 'gpt-5-nano-2025-08-07',
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      systemPrompt: options?.systemPrompt,
      responseFormat: options?.responseFormat,
      seed: options?.seed
    };
    
    return `openai:${this.hashObject(keyData)}`;
  }
  
  private hashObject(obj: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
      .update(JSON.stringify(obj))
      .digest('hex');
  }
  
  private async checkCostLimits(): Promise<void> {
    // Reset daily/monthly counters if needed
    const now = new Date();
    if (now.getDate() !== this.lastResetDate.getDate()) {
      this.dailyCost = 0;
      if (now.getMonth() !== this.lastResetDate.getMonth()) {
        this.monthlyCost = 0;
      }
      this.lastResetDate = now;
      await this.saveCostTracking();
    }
    
    // Check limits
    if (this.costLimits.daily && this.dailyCost >= this.costLimits.daily) {
      throw new Error(`Daily cost limit of $${this.costLimits.daily} exceeded`);
    }
    
    if (this.costLimits.monthly && this.monthlyCost >= this.costLimits.monthly) {
      throw new Error(`Monthly cost limit of $${this.costLimits.monthly} exceeded`);
    }
  }
  
  private async updateCostTracking(cost: number): Promise<void> {
    this.dailyCost += cost;
    this.monthlyCost += cost;
    this.totalCost += cost;
    
    // Check per-request limit
    if (this.costLimits.perRequest && cost > this.costLimits.perRequest) {
      console.warn(`Request cost $${cost} exceeds per-request limit of $${this.costLimits.perRequest}`);
    }
    
    await this.saveCostTracking();
  }
  
  private async loadCostTracking(): Promise<void> {
    try {
      const data = await this.redis.get('openai:cost:tracking');
      if (data) {
        const tracking = JSON.parse(data);
        this.dailyCost = tracking.dailyCost || 0;
        this.monthlyCost = tracking.monthlyCost || 0;
        this.lastResetDate = new Date(tracking.lastResetDate);
      }
    } catch (error) {
      console.error('Failed to load cost tracking:', error);
    }
  }
  
  private async saveCostTracking(): Promise<void> {
    try {
      await this.redis.set('openai:cost:tracking', JSON.stringify({
        dailyCost: this.dailyCost,
        monthlyCost: this.monthlyCost,
        lastResetDate: this.lastResetDate,
        totalCost: this.totalCost
      }), 'EX', 86400 * 30); // Expire after 30 days
    } catch (error) {
      console.error('Failed to save cost tracking:', error);
    }
  }
  
  private async sendTelemetry(response: AIResponse): Promise<void> {
    // Send telemetry data for monitoring
    try {
      await this.eventBus.emit('telemetry:openai', {
        responseId: response.id,
        model: response.model,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
        processingTime: response.processingTime,
        timestamp: response.timestamp
      });
    } catch (error) {
      console.error('Failed to send telemetry:', error);
    }
  }
  
  private handleError(error: any): Error {
    // Enhanced error handling with specific messages
    if (error.code === 'insufficient_quota') {
      return new Error('OpenAI API quota exceeded. Please check your billing.');
    } else if (error.code === 'invalid_api_key') {
      return new Error('Invalid OpenAI API key. Please check your configuration.');
    } else if (error.status === 429) {
      return new Error(`Rate limit exceeded. Please try again later.`);
    } else if (error.status === 503) {
      return new Error('OpenAI service temporarily unavailable.');
    } else if (error.status === 400) {
      return new Error(`Invalid request: ${error.message}`);
    }
    
    return new Error(`OpenAI request failed: ${error.message}`);
  }
  
  calculateCost(usage: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
  }): number {
    if (!usage.promptTokens || !usage.completionTokens) {
      return 0;
    }
    
    // Updated pricing for gpt-5-nano-2025-08-07
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-5-nano-2025-08-07': { prompt: 0.15, completion: 0.60 }, // $0.15/$0.60 per 1M tokens
      'gpt-4-turbo': { prompt: 1.0, completion: 3.0 },
      'gpt-4': { prompt: 3.0, completion: 6.0 },
      'gpt-3.5-turbo': { prompt: 0.05, completion: 0.15 }
    };
    
    const model = usage.model || 'gpt-5-nano-2025-08-07';
    const modelPricing = pricing[model] || pricing['gpt-5-nano-2025-08-07'];
    
    const promptCost = (usage.promptTokens / 1_000_000) * modelPricing.prompt * 100;
    const completionCost = (usage.completionTokens / 1_000_000) * modelPricing.completion * 100;
    
    return Math.round((promptCost + completionCost) * 100) / 100;
  }
  
  /**
   * Get request history
   */
  async getRequestHistory(limit: number = 100): Promise<any[]> {
    const history = Array.from(this.requestIdMap.entries())
      .slice(-limit)
      .map(([id, data]) => ({ requestId: id, ...data }));
    
    return history;
  }
  
  /**
   * Get cost summary
   */
  async getCostSummary(): Promise<any> {
    return {
      daily: this.dailyCost.toFixed(2),
      monthly: this.monthlyCost.toFixed(2),
      total: this.totalCost.toFixed(2),
      limits: this.costLimits,
      lastReset: this.lastResetDate
    };
  }
  
  /**
   * Stream response with token counting
   */
  async *collectStreamWithTokens(
    prompt: string,
    options?: CollectionOptions
  ): AsyncGenerator<{ content: string; tokens: number }, void, unknown> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }
    
    let totalTokens = 0;
    const stream = await this.client.chat.completions.create({
      model: options?.model || 'gpt-5-nano-2025-08-07',
      messages: [
        {
          role: 'system',
          content: options?.systemPrompt || 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
      stream: true,
      stream_options: {
        include_usage: true
      }
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        // Rough token estimation (actual tokens would need tiktoken)
        const tokens = Math.ceil(content.length / 4);
        totalTokens += tokens;
        yield { content, tokens };
      }
      
      // Check if we have usage data in the chunk
      if (chunk.usage) {
        totalTokens = chunk.usage.total_tokens;
      }
    }
  }
  
  /**
   * Batch process multiple prompts efficiently
   */
  async collectBatch(
    prompts: string[],
    options?: CollectionOptions
  ): Promise<AIResponse[]> {
    const batchSize = options?.batchSize || 5;
    const results: AIResponse[] = [];
    
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchPromises = batch.map(prompt => 
        this.collect(prompt, options).catch(error => ({
          error: error.message,
          prompt
        }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Get available models with details
   */
  async getAvailableModels(): Promise<any[]> {
    if (!this.client) {
      return [{ id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', available: false }];
    }
    
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          created: new Date(model.created * 1000),
          ownedBy: model.owned_by,
          available: true
        }));
    } catch (error) {
      return [{ id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', available: false }];
    }
  }
}