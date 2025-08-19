/**
 * Unified API Client for all RankMyBrand services
 * Integrates with GEO Calculator, Web Crawler, and Search Intelligence
 */

import axios, { AxiosInstance } from 'axios';
import io, { Socket } from 'socket.io-client';

// Service URLs from environment - Use API Gateway for all services
const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
const GEO_API = API_GATEWAY; // Use API Gateway
const CRAWLER_API = API_GATEWAY; // Use API Gateway
const SEARCH_API = API_GATEWAY; // Use API Gateway
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';
const DASHBOARD_WS = 'ws://localhost:4000/ws';

// Types
export interface GEOScore {
  domain: string;
  score: number;
  platforms: {
    chatgpt: number;
    claude: number;
    perplexity: number;
    gemini: number;
    bing: number;
    you: number;
    poe: number;
    huggingchat: number;
  };
  shareOfVoice: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  citationCount: number;
  competitorAnalysis: Array<{
    domain: string;
    score: number;
    position: number;
  }>;
  insights: string[];
  recommendations: string[];
  timestamp: string;
}

export interface CrawlJob {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: {
    pages: number;
    keywords: string[];
    content: any;
  };
}

export interface SearchIntelligence {
  query: string;
  results: Array<{
    platform: string;
    ranking: number;
    cited: boolean;
    sentiment: string;
    excerpt: string;
  }>;
  overallScore: number;
  improvements: string[];
}

export interface RealTimeMetrics {
  geoScore: number;
  trend: 'up' | 'down' | 'stable';
  alerts: Array<{
    type: 'competitor' | 'ranking' | 'citation';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  lastUpdate: string;
}

/**
 * Main API Client Class
 */
class RankMyBrandAPI {
  private geoClient: AxiosInstance;
  private crawlerClient: AxiosInstance;
  private searchClient: AxiosInstance;
  private wsConnection: Socket | null = null;
  private subscribers: Map<string, Set<Function>> = new Map();

  constructor() {
    // Initialize HTTP clients with interceptors
    this.geoClient = this.createClient(GEO_API, 'GEO');
    this.crawlerClient = this.createClient(CRAWLER_API, 'Crawler');
    this.searchClient = this.createClient(SEARCH_API, 'Search');
  }

  /**
   * Create axios instance with common configuration
   */
  private createClient(baseURL: string, service: string): AxiosInstance {
    const client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'rankmybrand-frontend',
      },
    });

    // Request interceptor for auth
    client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`[${service}] Request:`, config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error(`[${service}] Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    client.interceptors.response.use(
      (response) => {
        console.log(`[${service}] Response:`, response.status, response.config.url);
        return response;
      },
      (error) => {
        console.error(`[${service}] Response error:`, error.response?.status, error.message);
        this.handleAPIError(error, service);
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Get auth token from storage
   */
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  /**
   * Handle API errors uniformly
   */
  private handleAPIError(error: any, service: string) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 401) {
      // Unauthorized - redirect to access page
      if (typeof window !== 'undefined') {
        window.location.href = '/access';
      }
    } else if (status === 429) {
      // Rate limited
      console.warn(`[${service}] Rate limited. Retrying in 5s...`);
    } else if (status >= 500) {
      // Server error
      console.error(`[${service}] Server error:`, message);
    }
  }

  // ========================================
  // GEO Calculator API Methods
  // ========================================

  /**
   * Get instant GEO score for a domain
   */
  async getInstantScore(domain: string): Promise<GEOScore> {
    const { data } = await this.geoClient.post('/api/analyze/instant', { 
      domain
    });
    return data;
  }

  /**
   * Get detailed GEO analysis
   */
  async getDetailedAnalysis(domain: string, keywords?: string[]): Promise<GEOScore> {
    const { data } = await this.geoClient.post('/api/analyze/complete', {
      domain,
      keywords
    });
    return data;
  }

  /**
   * Get trending domains
   */
  async getTrendingDomains(): Promise<Array<{ domain: string; score: number; change: number }>> {
    const { data } = await this.geoClient.get('/api/v1/geo/trending');
    return data.domains || [];
  }

  /**
   * Compare multiple competitors
   */
  async compareCompetitors(domains: string[]): Promise<any> {
    const { data } = await this.geoClient.post('/api/v1/geo/compare', { domains });
    return data;
  }

  /**
   * Get historical data for a domain
   */
  async getHistoricalData(domain: string, days: number = 30): Promise<any> {
    const { data } = await this.geoClient.get(`/api/v1/geo/history/${domain}`, {
      params: { days }
    });
    return data;
  }

  // ========================================
  // Web Crawler API Methods
  // ========================================

  /**
   * Start a crawl job
   */
  async startCrawl(url: string, options?: { depth?: number; limit?: number }): Promise<CrawlJob> {
    const { data } = await this.crawlerClient.post('/api/crawl', {
      url,
      depth: options?.depth || 2,
      limit: options?.limit || 50,
    });
    return data;
  }

  /**
   * Get crawl job status
   */
  async getCrawlStatus(jobId: string): Promise<CrawlJob> {
    const { data } = await this.crawlerClient.get(`/api/crawl/${jobId}`);
    return data;
  }

  /**
   * Subscribe to crawl job updates via WebSocket
   */
  subscribeToCrawlUpdates(jobId: string, callback: (data: any) => void) {
    const ws = new WebSocket(`${CRAWLER_API.replace('http', 'ws')}/ws/crawl/${jobId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    ws.onerror = (error) => {
      console.error('Crawl WebSocket error:', error);
    };

    return () => ws.close();
  }

  // ========================================
  // Search Intelligence API Methods
  // ========================================

  /**
   * Analyze search intelligence
   */
  async analyzeSearchIntelligence(query: string, domain: string): Promise<SearchIntelligence> {
    const { data } = await this.searchClient.post('/api/search-intelligence/analyze', {
      query,
      domain,
      platforms: ['chatgpt', 'claude', 'perplexity', 'gemini'],
    });
    return data;
  }

  /**
   * Get content recommendations
   */
  async getContentRecommendations(domain: string): Promise<any> {
    const { data } = await this.searchClient.get(`/api/search-intelligence/recommendations/${domain}`);
    return data;
  }

  /**
   * Subscribe to search intelligence updates
   */
  subscribeToSearchUpdates(analysisId: string, callback: (data: any) => void) {
    const ws = new WebSocket(`${SEARCH_API.replace('http', 'ws')}/ws/search-intel/${analysisId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    return () => ws.close();
  }

  // ========================================
  // Real-time WebSocket Methods
  // ========================================

  /**
   * Connect to main WebSocket for real-time updates
   */
  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wsConnection?.connected) {
        resolve();
        return;
      }

      this.wsConnection = io(WS_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.wsConnection.on('connect', () => {
        console.log('WebSocket connected');
        this.setupWebSocketListeners();
        resolve();
      });

      this.wsConnection.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.wsConnection.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });
    });
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupWebSocketListeners() {
    if (!this.wsConnection) return;

    // Listen for real-time metrics
    this.wsConnection.on('metrics', (data: RealTimeMetrics) => {
      this.notifySubscribers('metrics', data);
    });

    // Listen for competitor updates
    this.wsConnection.on('competitor_update', (data: any) => {
      this.notifySubscribers('competitor', data);
    });

    // Listen for ranking changes
    this.wsConnection.on('ranking_change', (data: any) => {
      this.notifySubscribers('ranking', data);
    });

    // Listen for system alerts
    this.wsConnection.on('alert', (data: any) => {
      this.notifySubscribers('alert', data);
    });
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(event: string, callback: Function): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(event)?.delete(callback);
    };
  }

  /**
   * Notify all subscribers of an event
   */
  private notifySubscribers(event: string, data: any) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Emit event to server
   */
  emit(event: string, data: any) {
    if (this.wsConnection?.connected) {
      this.wsConnection.emit(event, data);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.wsConnection) {
      this.wsConnection.disconnect();
      this.wsConnection = null;
    }
  }

  // ========================================
  // Unified Methods
  // ========================================

  /**
   * Get complete brand analysis (combines all services)
   */
  async getCompleteBrandAnalysis(domain: string): Promise<any> {
    try {
      // Run all analyses in parallel
      const [geoScore, crawlJob, recommendations] = await Promise.all([
        this.getDetailedAnalysis(domain),
        this.startCrawl(`https://${domain}`, { depth: 2, limit: 20 }),
        this.getContentRecommendations(domain).catch(() => null),
      ]);

      return {
        geoScore,
        crawlJob,
        recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Complete analysis failed:', error);
      throw error;
    }
  }

  /**
   * Monitor brand in real-time
   */
  async startMonitoring(domain: string, callbacks: {
    onMetrics?: (data: RealTimeMetrics) => void;
    onCompetitor?: (data: any) => void;
    onAlert?: (data: any) => void;
  }): Promise<() => void> {
    // Connect WebSocket
    await this.connectWebSocket();

    // Subscribe to events
    const unsubscribers: Array<() => void> = [];

    if (callbacks.onMetrics) {
      unsubscribers.push(this.subscribe('metrics', callbacks.onMetrics));
    }
    if (callbacks.onCompetitor) {
      unsubscribers.push(this.subscribe('competitor', callbacks.onCompetitor));
    }
    if (callbacks.onAlert) {
      unsubscribers.push(this.subscribe('alert', callbacks.onAlert));
    }

    // Start monitoring on server
    this.emit('start_monitoring', { domain });

    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsub => unsub());
      this.emit('stop_monitoring', { domain });
    };
  }
}

// Export singleton instance
export const api = new RankMyBrandAPI();

// Export for use in React components
export default api;