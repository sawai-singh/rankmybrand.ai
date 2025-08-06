import fetch from 'node-fetch';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { z } from 'zod';

// Response schemas
const CrawlJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  estimatedTime: z.number(),
  websocketUrl: z.string()
});

const CrawlStatusResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  domain: z.string(),
  config: z.any(),
  progress: z.object({
    pagesCrawled: z.number(),
    pagesLimit: z.number(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable()
  }),
  summary: z.object({
    totalPages: z.number(),
    avgResponseTime: z.number(),
    jsRenderedPages: z.number(),
    avgGeoScore: z.number(),
    lastCrawled: z.string()
  }),
  scores: z.any(),
  topPerformingPages: z.array(z.any()),
  recommendations: z.array(z.any())
});

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  targetKeywords?: string[];
  includeSubdomains?: boolean;
}

export interface WebCrawlerClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export class WebCrawlerClient extends EventEmitter {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private activeWebSockets: Map<string, WebSocket> = new Map();

  constructor(options: WebCrawlerClientOptions = {}) {
    super();
    this.baseUrl = options.baseUrl || 'http://localhost:3002';
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Start a new crawl job
   */
  async startCrawl(url: string, options: CrawlOptions = {}) {
    const response = await this.request('/api/crawl', {
      method: 'POST',
      body: JSON.stringify({ url, options })
    });

    const data = CrawlJobResponseSchema.parse(await response.json());
    
    // Automatically connect to WebSocket if in Node.js environment
    if (typeof window === 'undefined') {
      this.connectWebSocket(data.jobId, data.websocketUrl);
    }
    
    return data;
  }

  /**
   * Get crawl job status
   */
  async getCrawlStatus(jobId: string) {
    const response = await this.request(`/api/crawl/${jobId}`);
    return CrawlStatusResponseSchema.parse(await response.json());
  }

  /**
   * Get crawled pages for a job
   */
  async getCrawledPages(jobId: string, page = 1, limit = 50) {
    const response = await this.request(
      `/api/crawl/${jobId}/pages?page=${page}&limit=${limit}`
    );
    return response.json();
  }

  /**
   * Stop a running crawl job
   */
  async stopCrawl(jobId: string) {
    const response = await this.request(`/api/crawl/${jobId}/stop`, {
      method: 'POST'
    });
    return response.json();
  }

  /**
   * Get score distribution for a metric
   */
  async getScoreDistribution(
    jobId: string, 
    metric: 'overall' | 'citation' | 'statistics' | 'quotation' | 'fluency' | 'authority' | 'relevance'
  ) {
    const response = await this.request(
      `/api/crawl/${jobId}/distribution/${metric}`
    );
    return response.json();
  }

  /**
   * Get errors for a crawl job
   */
  async getCrawlErrors(jobId: string) {
    const response = await this.request(`/api/crawl/${jobId}/errors`);
    return response.json();
  }

  /**
   * Get recent crawl jobs
   */
  async getRecentJobs(limit = 20) {
    const response = await this.request(`/api/crawls/recent?limit=${limit}`);
    return response.json();
  }

  /**
   * Get domain statistics
   */
  async getDomainStats(domain?: string, search?: string, limit = 20) {
    const params = new URLSearchParams();
    if (domain) params.append('domain', domain);
    if (search) params.append('search', search);
    params.append('limit', limit.toString());
    
    const response = await this.request(`/api/domains/stats?${params}`);
    return response.json();
  }

  /**
   * Check service health
   */
  async health() {
    const response = await this.request('/health');
    return response.json();
  }

  /**
   * Wait for crawl completion
   */
  async waitForCompletion(jobId: string, pollInterval = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getCrawlStatus(jobId);
          
          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error('Crawl job failed'));
          } else {
            setTimeout(checkStatus, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkStatus();
    });
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(jobId: string, websocketUrl?: string) {
    const wsUrl = websocketUrl || `${this.baseUrl.replace('http', 'ws')}/ws/crawl/${jobId}`;
    
    const ws = new WebSocket(wsUrl);
    this.activeWebSockets.set(jobId, ws);
    
    ws.on('open', () => {
      this.emit('websocket:connected', { jobId });
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('progress', { jobId, ...message });
      } catch (error) {
        this.emit('error', { jobId, error });
      }
    });
    
    ws.on('close', () => {
      this.emit('websocket:disconnected', { jobId });
      this.activeWebSockets.delete(jobId);
    });
    
    ws.on('error', (error) => {
      this.emit('websocket:error', { jobId, error });
    });
    
    return ws;
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(jobId: string) {
    const ws = this.activeWebSockets.get(jobId);
    if (ws) {
      ws.close();
      this.activeWebSockets.delete(jobId);
    }
  }

  /**
   * Disconnect all WebSockets
   */
  disconnectAll() {
    this.activeWebSockets.forEach((ws, jobId) => {
      ws.close();
    });
    this.activeWebSockets.clear();
  }

  /**
   * Make authenticated request
   */
  private async request(path: string, options: any = {}) {
    const url = `${this.baseUrl}${path}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      timeout: this.timeout
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }
    
    return response;
  }
}

// Export convenience function
export function createWebCrawlerClient(options?: WebCrawlerClientOptions) {
  return new WebCrawlerClient(options);
}

// Example usage:
/*
import { createWebCrawlerClient } from './web-crawler-client';

const client = createWebCrawlerClient({
  baseUrl: 'https://api.rankmybrand.ai',
  apiKey: 'your-api-key'
});

// Start a crawl
const { jobId } = await client.startCrawl('https://example.com', {
  maxPages: 100,
  targetKeywords: ['AI', 'SEO']
});

// Listen for progress
client.on('progress', (data) => {
  console.log('Progress:', data);
});

// Wait for completion
const result = await client.waitForCompletion(jobId);
console.log('Crawl complete:', result);
*/
