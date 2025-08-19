import { z } from 'zod';

// API configuration - Use Docker service names in production, localhost in development
const isDocker = process.env.NEXT_PUBLIC_IS_DOCKER === 'true';
const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY || (isDocker ? 'http://api-gateway:4000' : 'http://localhost:4000');
const GEO_CALCULATOR = process.env.NEXT_PUBLIC_GEO_CALCULATOR || (isDocker ? 'http://intelligence-engine:8002' : 'http://localhost:8002');  // Now using Intelligence Engine
const WEB_CRAWLER = process.env.NEXT_PUBLIC_WEB_CRAWLER || (isDocker ? 'http://web-crawler:3002' : 'http://localhost:3002');
const INTELLIGENCE_ENGINE = process.env.NEXT_PUBLIC_INTELLIGENCE_ENGINE || (isDocker ? 'http://intelligence-engine:8002' : 'http://localhost:8002');
const ACTION_CENTER = process.env.NEXT_PUBLIC_ACTION_CENTER || (isDocker ? 'http://action-center:8082' : 'http://localhost:8082');

// Request types
export interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
  timeout?: number;
}

// Error handling
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

// Base fetch wrapper with timeout and error handling
async function fetchWithTimeout(url: string, config: RequestConfig = {}) {
  const { timeout = 30000, params, ...fetchConfig } = config;
  
  // Add query params
  if (params) {
    const searchParams = new URLSearchParams(params);
    url = `${url}?${searchParams.toString()}`;
  }
  
  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  // Setup headers
  const headers = new Headers(fetchConfig.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && fetchConfig.body) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchConfig,
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ApiError(response.status, response.statusText, errorData);
    }
    
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Request Timeout');
    }
    
    throw error;
  }
}

// API client class
class ApiClient {
  // Auth endpoints
  async login(email: string, password: string) {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }
  
  async logout() {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/auth/logout`, {
      method: 'POST',
    });
    return response.json();
  }
  
  async getCurrentUser() {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/auth/me`);
    return response.json();
  }
  
  async refreshToken() {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/auth/refresh`, {
      method: 'POST',
    });
    return response.json();
  }
  
  // Dashboard endpoints
  async getDashboardMetrics() {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/dashboard/metrics`);
    return response.json();
  }
  
  async getActivityFeed(limit = 10) {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/dashboard/activity`, {
      params: { limit: limit.toString() },
    });
    return response.json();
  }
  
  async getInsights() {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/dashboard/insights`);
    return response.json();
  }
  
  // GEO Calculator endpoints
  async analyzeGeo(query: string, platforms?: string[]) {
    const response = await fetchWithTimeout(`${GEO_CALCULATOR}/api/v1/geo/analyze`, {
      method: 'POST',
      body: JSON.stringify({ query, platforms }),
    });
    return response.json();
  }
  
  async batchAnalyzeGeo(queries: string[]) {
    const response = await fetchWithTimeout(`${GEO_CALCULATOR}/api/v1/geo/analyze/batch`, {
      method: 'POST',
      body: JSON.stringify({ queries }),
    });
    return response.json();
  }
  
  async getGeoScores() {
    const response = await fetchWithTimeout(`${GEO_CALCULATOR}/api/v1/geo/scores`);
    return response.json();
  }
  
  // Web Crawler endpoints
  async startCrawl(url: string, depth = 2) {
    const response = await fetchWithTimeout(`${WEB_CRAWLER}/api/crawl`, {
      method: 'POST',
      body: JSON.stringify({ url, depth }),
    });
    return response.json();
  }
  
  async getCrawlStatus(jobId: string) {
    const response = await fetchWithTimeout(`${WEB_CRAWLER}/api/crawl/${jobId}`);
    return response.json();
  }
  
  // Intelligence Engine endpoints
  async analyzeContent(content: string, type: 'sentiment' | 'entities' | 'gaps') {
    const response = await fetchWithTimeout(`${INTELLIGENCE_ENGINE}/api/intelligence/analyze`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    });
    return response.json();
  }
  
  async getIntelligenceScores() {
    const response = await fetchWithTimeout(`${INTELLIGENCE_ENGINE}/api/intelligence/scores`);
    return response.json();
  }
  
  async getContentGaps() {
    const response = await fetchWithTimeout(`${INTELLIGENCE_ENGINE}/api/intelligence/gaps`);
    return response.json();
  }
  
  // Action Center endpoints
  async generateRecommendations() {
    const response = await fetchWithTimeout(`${ACTION_CENTER}/api/actions/generate`, {
      method: 'POST',
    });
    return response.json();
  }
  
  async executeAction(actionId: string, target: string) {
    const response = await fetchWithTimeout(`${ACTION_CENTER}/api/actions/execute`, {
      method: 'POST',
      body: JSON.stringify({ actionId, target }),
    });
    return response.json();
  }
  
  async getActionHistory() {
    const response = await fetchWithTimeout(`${ACTION_CENTER}/api/actions/history`);
    return response.json();
  }
  
  // Competitor endpoints
  async getCompetitors() {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/competitors`);
    return response.json();
  }
  
  async addCompetitor(domain: string) {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/competitors`, {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
    return response.json();
  }
  
  async removeCompetitor(competitorId: string) {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/competitors/${competitorId}`, {
      method: 'DELETE',
    });
    return response.json();
  }
  
  // Settings endpoints
  async updateUserSettings(settings: Record<string, any>) {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/settings/user`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response.json();
  }
  
  async updateOrganizationSettings(settings: Record<string, any>) {
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/settings/organization`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response.json();
  }
  
  // File upload
  async uploadFile(file: File, type: 'logo' | 'document') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await fetchWithTimeout(`${API_GATEWAY}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
    return response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiError };

// Zod schemas for API responses
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.enum(['owner', 'admin', 'analyst', 'viewer']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MetricSchema = z.object({
  label: z.string(),
  value: z.number(),
  change: z.number(),
  changePercent: z.number(),
  history: z.array(z.number()),
});

export const InsightSchema = z.object({
  id: z.string(),
  type: z.enum(['info', 'warning', 'success', 'error']),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  actionable: z.boolean(),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
  })).optional(),
  createdAt: z.string(),
});

export const CompetitorSchema = z.object({
  id: z.string(),
  domain: z.string(),
  name: z.string(),
  geoScore: z.number(),
  shareOfVoice: z.number(),
  lastAnalyzed: z.string(),
});

export const ActivitySchema = z.object({
  id: z.string(),
  type: z.enum(['success', 'warning', 'info', 'error']),
  message: z.string(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string(),
});

// Type exports
export type User = z.infer<typeof UserSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type Activity = z.infer<typeof ActivitySchema>;