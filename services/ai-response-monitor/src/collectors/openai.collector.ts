import OpenAI from 'openai';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions } from '../types';

export class OpenAICollector extends BaseCollector {
  private client?: OpenAI;
  private models: string[] = ['gpt-5-nano-2025-08-07'];
  
  constructor(redis: Redis) {
    super('openai', redis);
  }
  
  async initialize(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    this.client = new OpenAI({
      apiKey,
      maxRetries: 2,
      timeout: 30000
    });
    
    // Test connection and validate
    const isValid = await this.validate();
    if (!isValid) {
      throw new Error('OpenAI API validation failed (invalid key or no model access)');
    }
  }
  
  async validate(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      // Make a minimal API call to validate the key
      const models = await this.client.models.list();
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
    const responseId = uuidv4();
    
    try {
      // Check cache first - hash the prompt to avoid Redis key issues
      const model = options?.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-5-nano-2025-08-07';
      const crypto = require('crypto');
      const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
      const cacheKey = `openai:${model}:${promptHash}`;
      const { data: cachedResponse, fromCache } = await this.withCache(
        cacheKey,
        options?.cacheTTL || this.cacheTTL,
        async () => {
          // Execute with rate limiting
          return this.withRateLimit('api', async () => {
            return this.withRetry(async () => {
              const completion = await this.client!.chat.completions.create({
                model,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a helpful assistant. Provide informative and accurate responses.'
                  },
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                temperature: options?.temperature || 0.7,
                max_tokens: options?.maxTokens || 2000,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
              });
              
              const response = completion.choices[0].message.content || '';
              const usage = completion.usage;
              
              return {
                response,
                model: completion.model,
                tokensUsed: usage?.total_tokens,
                promptTokens: usage?.prompt_tokens,
                completionTokens: usage?.completion_tokens,
                finishReason: completion.choices[0].finish_reason
              };
            }, options?.retries);
          });
        }
      );
      
      const processingTime = Date.now() - startTime;
      const cost = this.calculateCost({
        model: cachedResponse.model,
        promptTokens: cachedResponse.promptTokens,
        completionTokens: cachedResponse.completionTokens
      });
      
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
          fromCache,
          finishReason: cachedResponse.finishReason,
          promptTokens: cachedResponse.promptTokens,
          completionTokens: cachedResponse.completionTokens
        },
        timestamp: new Date()
      };
      
      // Track metrics
      this.trackMetrics(true, cost, processingTime);
      
      // Publish to event bus (only if not from cache)
      if (!fromCache) {
        await this.publishResponse(aiResponse);
      }
      
      return this.sanitizeResponse(aiResponse);
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      // Track failed request
      this.trackMetrics(false, 0, processingTime);
      
      // Handle specific OpenAI errors - check status first, then error type
      if (error.status === 401 || error.error?.type === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key');
      } else if (error.status === 429) {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      } else if (error.error?.type === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded');
      } else if (error.status === 503) {
        throw new Error('OpenAI service temporarily unavailable');
      }
      
      throw new Error(`OpenAI collection failed: ${error.message}`);
    }
  }
  
  calculateCost(usage: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
  }): number {
    if (!usage.promptTokens || !usage.completionTokens) {
      return 0;
    }
    
    // OpenAI pricing in DOLLARS per 1K tokens (consistent units)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4-turbo-preview': { prompt: 0.01, completion: 0.03 },
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
      'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004 },
      'gpt-5-nano-2025-08-07': { prompt: 0.003, completion: 0.004 },
      'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 }
    };
    
    const model = usage.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-5-nano-2025-08-07';
    const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // fallback to cheapest
    
    // Cost in dollars per 1K tokens
    const promptCost = (usage.promptTokens / 1000) * modelPricing.prompt;
    const completionCost = (usage.completionTokens / 1000) * modelPricing.completion;
    
    // Keep higher precision internally, round to 4 decimal places
    return Math.round((promptCost + completionCost) * 10000) / 10000;
  }
  
  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.client) {
      return this.models;
    }
    
    try {
      const models = await this.client.models.list();
      // Return all chat-capable models, not just those starting with 'gpt'
      const chatModels = models.data
        .filter(model => 
          model.id.includes('gpt') || 
          model.id.includes('claude') || 
          model.id.includes('text-')
        )
        .map(model => model.id);
      
      return chatModels.length > 0 ? chatModels : this.models;
    } catch (error) {
      return this.models;
    }
  }
  
  /**
   * Stream response (for long responses)
   */
  async *collectStream(
    prompt: string,
    options?: CollectionOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }
    
    const stream = await this.client.chat.completions.create({
      model: options?.model || (process as any).env.OPENAI_DEFAULT_MODEL || 'gpt-5-nano-2025-08-07',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Provide informative and accurate responses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
      stream: true
    });
    
    for await (const chunk of stream) {
      const content = chunk?.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}