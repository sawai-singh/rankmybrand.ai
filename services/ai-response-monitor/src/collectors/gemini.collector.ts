import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions } from '../types';

export class GeminiCollector extends BaseCollector {
  private client?: GoogleGenerativeAI;
  private models: string[] = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-pro-vision'];
  
  constructor(redis: Redis) {
    super('gemini', redis);
  }
  
  async initialize(): Promise<void> {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }
    
    this.client = new GoogleGenerativeAI(apiKey);
    
    // Test connection and validate
    const isValid = await this.validate();
    if (!isValid) {
      throw new Error('Gemini API validation failed (invalid key or no model access)');
    }
  }
  
  async validate(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      // Make a minimal API call to validate the key
      const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent('Hi');
      
      return result.response?.text() !== undefined;
    } catch (error: any) {
      console.error('Gemini validation failed:', error.message);
      return false;
    }
  }
  
  async collect(prompt: string, options?: CollectionOptions): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }
    
    const startTime = Date.now();
    const responseId = uuidv4();
    
    try {
      // Check cache first - hash the prompt to avoid Redis key issues
      const modelName = options?.model || (process as any).env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash';
      const crypto = require('crypto');
      const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
      const cacheKey = `gemini:${modelName}:${promptHash}`;
      
      const { data: cachedResponse, fromCache } = await this.withCache(
        cacheKey,
        options?.cacheTTL || this.cacheTTL,
        async () => {
          // Execute with rate limiting
          return this.withRateLimit('api', async () => {
            return this.withRetry(async () => {
              const model = this.client!.getGenerativeModel({
                model: modelName,
                generationConfig: {
                  temperature: options?.temperature || 0.7,
                  maxOutputTokens: options?.maxTokens || 2000,
                  topK: options?.topK || 40,
                  topP: options?.topP || 0.95,
                },
                safetySettings: [
                  {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                  },
                ],
              });
              
              // Add system prompt if provided
              const fullPrompt = options?.systemPrompt 
                ? `${options.systemPrompt}\n\n${prompt}`
                : prompt;
              
              const result = await model.generateContent(fullPrompt);
              const response = result.response;
              
              // Extract token counts if available
              const usage = response.usageMetadata;
              const tokensUsed = usage ? usage.promptTokenCount + usage.candidatesTokenCount : undefined;
              
              return {
                response: response.text(),
                model: modelName,
                tokensUsed,
                promptTokens: usage?.promptTokenCount,
                completionTokens: usage?.candidatesTokenCount,
                finishReason: response.candidates?.[0]?.finishReason,
                safetyRatings: response.candidates?.[0]?.safetyRatings
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
        platform: 'gemini',
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
          completionTokens: cachedResponse.completionTokens,
          safetyRatings: cachedResponse.safetyRatings
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
      
      // Handle specific Gemini errors - check status first
      if (error.status === 401 || error.message?.includes('API key')) {
        throw new Error('Invalid Google AI API key');
      } else if (error.status === 429) {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      } else if (error.status === 400 || error.message?.includes('invalid')) {
        throw new Error(`Invalid request: ${error.message}`);
      } else if (error.status === 503) {
        throw new Error('Gemini service temporarily unavailable');
      } else if (error.message?.includes('safety')) {
        throw new Error('Content blocked by safety filters');
      }
      
      throw new Error(`Gemini collection failed: ${error.message}`);
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
    
    // Gemini pricing in DOLLARS per 1M tokens (consistent units)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gemini-1.5-pro': { prompt: 3.5, completion: 10.5 },       // $3.50/$10.50 per 1M tokens
      'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },    // $0.075/$0.30 per 1M tokens
      'gemini-pro': { prompt: 0.5, completion: 1.5 },            // $0.50/$1.50 per 1M tokens
      'gemini-pro-vision': { prompt: 0.5, completion: 1.5 }      // $0.50/$1.50 per 1M tokens
    };
    
    const model = usage.model || (process as any).env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash';
    const modelPricing = pricing[model] || pricing['gemini-1.5-flash']; // fallback to cheapest
    
    // Cost in dollars per 1M tokens
    const promptCost = (usage.promptTokens / 1_000_000) * modelPricing.prompt;
    const completionCost = (usage.completionTokens / 1_000_000) * modelPricing.completion;
    
    // Keep higher precision internally, round to 4 decimal places
    return Math.round((promptCost + completionCost) * 10000) / 10000;
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
      throw new Error('Gemini client not initialized');
    }
    
    const modelName = options?.model || (process as any).env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash';
    const model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens || 2000,
      }
    });
    
    // Add system prompt if provided
    const fullPrompt = options?.systemPrompt 
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt;
    
    const result = await model.generateContentStream(fullPrompt);
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}