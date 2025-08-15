import { CohereClient } from 'cohere-ai';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions } from '../types';

export class CohereCollector extends BaseCollector {
  private client?: CohereClient;
  private models: string[] = ['command-r-plus', 'command-r', 'command', 'command-nightly', 'command-light'];
  
  constructor(redis: Redis) {
    super('cohere', redis);
  }
  
  async initialize(): Promise<void> {
    const apiKey = process.env.COHERE_API_KEY;
    
    if (!apiKey) {
      throw new Error('Cohere API key not configured');
    }
    
    this.client = new CohereClient({
      token: apiKey,
    });
    
    // Test connection and validate
    const isValid = await this.validate();
    if (!isValid) {
      throw new Error('Cohere API validation failed (invalid key or no model access)');
    }
  }
  
  async validate(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      // Make a minimal API call to validate the key
      const response = await this.client.generate({
        model: 'command',
        prompt: 'Hi',
        maxTokens: 1
      });
      
      return response.generations !== undefined;
    } catch (error: any) {
      console.error('Cohere validation failed:', error.message);
      return false;
    }
  }
  
  async collect(prompt: string, options?: CollectionOptions): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Cohere client not initialized');
    }
    
    const startTime = Date.now();
    const responseId = uuidv4();
    
    try {
      // Check cache first - hash the prompt to avoid Redis key issues
      const model = options?.model || (process as any).env.COHERE_DEFAULT_MODEL || 'command-r';
      const crypto = require('crypto');
      const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
      const cacheKey = `cohere:${model}:${promptHash}`;
      
      const { data: cachedResponse, fromCache } = await this.withCache(
        cacheKey,
        options?.cacheTTL || this.cacheTTL,
        async () => {
          // Execute with rate limiting
          return this.withRateLimit('api', async () => {
            return this.withRetry(async () => {
              // Use chat endpoint for better responses
              const response = await this.client!.chat({
                model,
                message: prompt,
                temperature: options?.temperature || 0.7,
                maxTokens: options?.maxTokens || 2000,
                preamble: options?.systemPrompt || 'You are a helpful AI assistant. Provide informative and accurate responses.',
                chatHistory: [],
                connectors: options?.webSearch ? [{ id: 'web-search' }] : undefined,
                citationQuality: 'accurate',
                promptTruncation: 'AUTO'
              });
              
              // Extract token usage
              const tokensUsed = response.meta?.tokens?.inputTokens && response.meta?.tokens?.outputTokens
                ? response.meta.tokens.inputTokens + response.meta.tokens.outputTokens
                : undefined;
              
              return {
                response: response.text,
                model: model,
                tokensUsed,
                inputTokens: response.meta?.tokens?.inputTokens,
                outputTokens: response.meta?.tokens?.outputTokens,
                citations: response.citations,
                documents: response.documents,
                searchQueries: response.searchQueries,
                searchResults: response.searchResults,
                finishReason: response.finishReason
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
        platform: 'cohere',
        prompt,
        response: cachedResponse.response,
        model: cachedResponse.model,
        tokensUsed: cachedResponse.tokensUsed,
        processingTime,
        cost,
        metadata: {
          fromCache,
          finishReason: cachedResponse.finishReason,
          inputTokens: cachedResponse.inputTokens,
          outputTokens: cachedResponse.outputTokens,
          citations: cachedResponse.citations,
          documents: cachedResponse.documents,
          searchQueries: cachedResponse.searchQueries,
          searchResults: cachedResponse.searchResults
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
      
      // Handle specific Cohere errors - check status first
      if (error.status === 401 || error.message?.includes('invalid api token')) {
        throw new Error('Invalid Cohere API key');
      } else if (error.status === 429 || error.message?.includes('rate limit')) {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      } else if (error.status === 400 || error.message?.includes('invalid')) {
        throw new Error(`Invalid request: ${error.message}`);
      } else if (error.status === 503) {
        throw new Error('Cohere service temporarily unavailable');
      }
      
      throw new Error(`Cohere collection failed: ${error.message}`);
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
    
    // Cohere pricing in DOLLARS per 1M tokens (consistent units)
    const pricing: Record<string, { input: number; output: number }> = {
      'command-r-plus': { input: 3.0, output: 15.0 },     // $3.00/$15.00 per 1M tokens
      'command-r': { input: 0.5, output: 1.5 },           // $0.50/$1.50 per 1M tokens
      'command': { input: 1.0, output: 2.0 },             // $1.00/$2.00 per 1M tokens
      'command-nightly': { input: 1.0, output: 2.0 },     // $1.00/$2.00 per 1M tokens
      'command-light': { input: 0.15, output: 0.6 }       // $0.15/$0.60 per 1M tokens
    };
    
    const model = usage.model || (process as any).env.COHERE_DEFAULT_MODEL || 'command-r';
    const modelPricing = pricing[model] || pricing['command-light']; // fallback to cheapest
    
    // Cost in dollars per 1M tokens
    const inputCost = (usage.inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * modelPricing.output;
    
    // Keep higher precision internally, round to 4 decimal places
    return Math.round((inputCost + outputCost) * 10000) / 10000;
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
      throw new Error('Cohere client not initialized');
    }
    
    const model = options?.model || (process as any).env.COHERE_DEFAULT_MODEL || 'command-r';
    
    const stream = await this.client.chatStream({
      model,
      message: prompt,
      temperature: options?.temperature || 0.7,
      maxTokens: options?.maxTokens || 2000,
      preamble: options?.systemPrompt || 'You are a helpful AI assistant. Provide informative and accurate responses.',
      chatHistory: [],
      connectors: options?.webSearch ? [{ id: 'web-search' }] : undefined
    });
    
    for await (const message of stream) {
      if (message.eventType === 'text-generation') {
        yield message.text;
      }
    }
  }
  
  /**
   * Rerank documents using Cohere's reranking model
   */
  async rerank(
    query: string,
    documents: string[],
    topN?: number
  ): Promise<Array<{ index: number; relevanceScore: number; document: string }>> {
    if (!this.client) {
      throw new Error('Cohere client not initialized');
    }
    
    const response = await this.client.rerank({
      model: 'rerank-english-v3.0',
      query,
      documents,
      topN: topN || 5
    });
    
    return response.results.map(result => ({
      index: result.index,
      relevanceScore: result.relevanceScore,
      document: documents[result.index]
    }));
  }
  
  /**
   * Generate embeddings for text
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('Cohere client not initialized');
    }
    
    const response = await this.client.embed({
      model: 'embed-english-v3.0',
      texts,
      inputType: 'search_document'
    });
    
    return response.embeddings;
  }
}