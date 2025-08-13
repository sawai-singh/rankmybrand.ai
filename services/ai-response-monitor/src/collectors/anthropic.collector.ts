import Anthropic from '@anthropic-ai/sdk';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions } from '../types';

export class AnthropicCollector extends BaseCollector {
  private client?: Anthropic;
  private models: string[] = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
  
  constructor(redis: Redis) {
    super('anthropic', redis);
  }
  
  async initialize(): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    this.client = new Anthropic({
      apiKey,
      maxRetries: 2
    });
    
    // Test connection
    await this.validate();
  }
  
  async validate(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      // Make a minimal API call to validate the key
      // Anthropic doesn't have a models endpoint, so we'll try a minimal completion
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      
      return response.id !== undefined;
    } catch (error: any) {
      console.error('Anthropic validation failed:', error.message);
      return false;
    }
  }
  
  async collect(prompt: string, options?: CollectionOptions): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }
    
    const startTime = Date.now();
    const responseId = uuidv4();
    
    try {
      // Check cache first
      const cacheKey = `${prompt}:${options?.model || 'claude-3-sonnet-20240229'}`;
      const { data: cachedResponse, fromCache } = await this.withCache(
        cacheKey,
        options?.cacheTTL || this.cacheTTL,
        async () => {
          // Execute with rate limiting
          return this.withRateLimit('api', async () => {
            return this.withRetry(async () => {
              const model = options?.model || 'claude-3-sonnet-20240229';
              
              const message = await this.client!.messages.create({
                model,
                max_tokens: options?.maxTokens || 2000,
                temperature: options?.temperature || 0.7,
                messages: [
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                system: 'You are Claude, a helpful AI assistant. Provide informative, accurate, and well-structured responses.'
              });
              
              // Extract text content from response
              const responseText = message.content
                .filter(block => block.type === 'text')
                .map(block => (block as any).text)
                .join('\n');
              
              return {
                response: responseText,
                model: message.model,
                tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
                inputTokens: message.usage?.input_tokens,
                outputTokens: message.usage?.output_tokens,
                stopReason: message.stop_reason
              };
            }, options?.retries);
          });
        }
      );
      
      const processingTime = Date.now() - startTime;
      const cost = this.calculateCost({
        model: cachedResponse.model,
        inputTokens: cachedResponse.inputTokens,
        outputTokens: cachedResponse.outputTokens
      });
      
      const aiResponse: AIResponse = {
        id: responseId,
        platform: 'anthropic',
        prompt,
        response: cachedResponse.response,
        model: cachedResponse.model,
        tokensUsed: cachedResponse.tokensUsed,
        processingTime,
        cost,
        metadata: {
          fromCache,
          stopReason: cachedResponse.stopReason,
          inputTokens: cachedResponse.inputTokens,
          outputTokens: cachedResponse.outputTokens
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
      
      // Handle specific Anthropic errors
      if (error.status === 401) {
        throw new Error('Invalid Anthropic API key');
      } else if (error.status === 429) {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      } else if (error.status === 400) {
        throw new Error(`Invalid request: ${error.message}`);
      }
      
      throw new Error(`Anthropic collection failed: ${error.message}`);
    }
  }
  
  calculateCost(usage: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  }): number {
    if (!usage.inputTokens || !usage.outputTokens) {
      return 0;
    }
    
    // Anthropic pricing (in cents per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-opus-20240229': { input: 1.5, output: 7.5 },
      'claude-3-sonnet-20240229': { input: 0.3, output: 1.5 },
      'claude-3-haiku-20240307': { input: 0.025, output: 0.125 }
    };
    
    const model = usage.model || 'claude-3-sonnet-20240229';
    const modelPricing = pricing[model] || pricing['claude-3-sonnet-20240229'];
    
    const inputCost = (usage.inputTokens / 1000) * modelPricing.input;
    const outputCost = (usage.outputTokens / 1000) * modelPricing.output;
    
    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return this.models;
  }
  
  /**
   * Stream response (for long responses)
   */
  async *collectStream(
    prompt: string,
    options?: CollectionOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }
    
    const stream = await this.client.messages.create({
      model: options?.model || 'claude-3-sonnet-20240229',
      max_tokens: options?.maxTokens || 2000,
      temperature: options?.temperature || 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true
    });
    
    for await (const messageStreamEvent of stream) {
      if (messageStreamEvent.type === 'content_block_delta') {
        const delta = messageStreamEvent.delta;
        if (delta.type === 'text_delta') {
          yield delta.text;
        }
      }
    }
  }
}