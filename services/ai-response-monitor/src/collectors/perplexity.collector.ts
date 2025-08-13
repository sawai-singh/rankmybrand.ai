import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { BaseCollector } from './base-collector';
import { AIResponse, CollectionOptions, Citation } from '../types';

export class PerplexityCollector extends BaseCollector {
  private client?: AxiosInstance;
  private models: string[] = ['pplx-70b-online', 'pplx-7b-online', 'pplx-70b-chat', 'pplx-7b-chat'];
  
  constructor(redis: Redis) {
    super('perplexity', redis);
  }
  
  async initialize(): Promise<void> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('Perplexity API key not configured');
    }
    
    this.client = axios.create({
      baseURL: 'https://api.perplexity.ai',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Configure retry logic
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429;
      }
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
      const response = await this.client.post('/chat/completions', {
        model: 'pplx-7b-chat',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      return response.data.id !== undefined;
    } catch (error: any) {
      console.error('Perplexity validation failed:', error.message);
      return false;
    }
  }
  
  async collect(prompt: string, options?: CollectionOptions): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Perplexity client not initialized');
    }
    
    const startTime = Date.now();
    const responseId = uuidv4();
    
    try {
      // Check cache first
      const cacheKey = `${prompt}:${options?.model || 'pplx-70b-online'}`;
      const { data: cachedResponse, fromCache } = await this.withCache(
        cacheKey,
        options?.cacheTTL || this.cacheTTL,
        async () => {
          // Execute with rate limiting
          return this.withRateLimit('api', async () => {
            return this.withRetry(async () => {
              const model = options?.model || 'pplx-70b-online';
              
              // Perplexity-specific parameters
              const requestBody = {
                model,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a helpful assistant that provides accurate information with citations when available.'
                  },
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                max_tokens: options?.maxTokens || 2000,
                temperature: options?.temperature || 0.7,
                top_p: 1,
                return_citations: true, // Perplexity feature
                search_domain_filter: [], // Can limit to specific domains
                return_images: false,
                return_related_questions: false,
                search_recency_filter: 'month' // Get recent information
              };
              
              const response = await this.client!.post('/chat/completions', requestBody);
              const data = response.data;
              
              // Extract citations if available
              const citations = this.extractCitations(data);
              
              return {
                response: data.choices[0].message.content,
                model: data.model,
                tokensUsed: data.usage?.total_tokens,
                promptTokens: data.usage?.prompt_tokens,
                completionTokens: data.usage?.completion_tokens,
                citations,
                finishReason: data.choices[0].finish_reason
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
        platform: 'perplexity',
        prompt,
        response: cachedResponse.response,
        model: cachedResponse.model,
        citations: cachedResponse.citations,
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
      
      // Handle specific Perplexity errors
      if (error.response?.status === 401) {
        throw new Error('Invalid Perplexity API key');
      } else if (error.response?.status === 429) {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid request: ${error.response.data?.error?.message || error.message}`);
      }
      
      throw new Error(`Perplexity collection failed: ${error.message}`);
    }
  }
  
  private extractCitations(response: any): Citation[] {
    const citations: Citation[] = [];
    
    // Perplexity includes citations in the response
    if (response.citations) {
      response.citations.forEach((citation: any, index: number) => {
        citations.push({
          title: citation.title || `Source ${index + 1}`,
          url: citation.url || '',
          snippet: citation.snippet || '',
          position: index + 1,
          domain: citation.domain || this.extractDomain(citation.url)
        });
      });
    }
    
    // Also check for inline citations in the response text
    const responseText = response.choices?.[0]?.message?.content || '';
    const urlRegex = /\[(\d+)\]:\s*(https?:\/\/[^\s]+)/g;
    let match;
    
    while ((match = urlRegex.exec(responseText)) !== null) {
      const position = parseInt(match[1]);
      const url = match[2];
      
      // Check if this citation wasn't already extracted
      if (!citations.find(c => c.url === url)) {
        citations.push({
          title: `Reference ${position}`,
          url,
          position,
          domain: this.extractDomain(url)
        });
      }
    }
    
    return citations;
  }
  
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
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
    
    // Perplexity pricing (estimated - in cents per 1K tokens)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'pplx-70b-online': { prompt: 0.7, completion: 2.8 },
      'pplx-7b-online': { prompt: 0.07, completion: 0.28 },
      'pplx-70b-chat': { prompt: 0.7, completion: 2.8 },
      'pplx-7b-chat': { prompt: 0.07, completion: 0.28 }
    };
    
    const model = usage.model || 'pplx-70b-online';
    const modelPricing = pricing[model] || pricing['pplx-70b-online'];
    
    const promptCost = (usage.promptTokens / 1000) * modelPricing.prompt;
    const completionCost = (usage.completionTokens / 1000) * modelPricing.completion;
    
    return Math.round((promptCost + completionCost) * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return this.models;
  }
  
  /**
   * Search with specific domain filtering
   */
  async searchWithDomains(
    prompt: string,
    domains: string[],
    options?: CollectionOptions
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new Error('Perplexity client not initialized');
    }
    
    const requestBody = {
      model: options?.model || 'pplx-70b-online',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options?.maxTokens || 2000,
      temperature: options?.temperature || 0.7,
      search_domain_filter: domains,
      return_citations: true
    };
    
    const response = await this.client.post('/chat/completions', requestBody);
    const data = response.data;
    
    return {
      id: uuidv4(),
      platform: 'perplexity',
      prompt,
      response: data.choices[0].message.content,
      model: data.model,
      citations: this.extractCitations(data),
      tokensUsed: data.usage?.total_tokens,
      processingTime: 0,
      cost: this.calculateCost({
        model: data.model,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens
      }),
      timestamp: new Date()
    };
  }
}