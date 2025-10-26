/**
 * Unified API Client for all RankMyBrand services
 * Integrates with GEO Calculator, Web Crawler, and Search Intelligence
 */

import axios, { AxiosInstance } from 'axios';
import io, { Socket } from 'socket.io-client';
import { env } from '../env';

// Service URLs from validated environment - Use API Gateway for all services
const API_GATEWAY = env.NEXT_PUBLIC_API_GATEWAY;
const GEO_API = API_GATEWAY; // Use API Gateway
const SEARCH_API = API_GATEWAY; // Use API Gateway
const WS_URL = env.NEXT_PUBLIC_WS_URL;
const DASHBOARD_WS = env.NEXT_PUBLIC_WS_URL;

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
  private searchClient: AxiosInstance;
  private wsConnection: Socket | null = null;
  private subscribers: Map<string, Set<Function>> = new Map();

  constructor() {
    // Initialize HTTP clients with interceptors
    this.geoClient = this.createClient(GEO_API, 'GEO');
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
  // Dashboard Data Methods
  // ========================================

  /**
   * Get dashboard data by audit ID
   */
  async getDashboardData(auditId: string): Promise<any> {
    // Fetch from Intelligence Engine API
    const { data } = await axios.get(`${env.NEXT_PUBLIC_INTELLIGENCE_ENGINE}/api/dashboard/detailed/${auditId}`);
    return data.data || data;
  }

  /**
   * Get audit responses by audit ID
   */
  async getAuditResponses(auditId: string): Promise<any> {
    const { data } = await axios.get(`${API_GATEWAY}/api/audit/${auditId}/responses`);
    return data;
  }

  /**
   * Get audit insights by audit ID
   */
  async getAuditInsights(auditId: string): Promise<any> {
    const { data} = await axios.get(`${API_GATEWAY}/api/audit/${auditId}/insights`);
    return data;
  }

  /**
   * Get audit queries by audit ID
   */
  async getAuditQueries(auditId: string): Promise<any> {
    const { data } = await axios.get(`${API_GATEWAY}/api/audit/${auditId}/queries`);
    return data;
  }

  /**
   * Get current audit data
   */
  async getCurrentAudit(): Promise<any> {
    // Get the latest audit for the current user/company
    const { data } = await this.geoClient.get('/api/audit/current');
    return data;
  }

  // ========================================
  // Strategic Intelligence Methods (118-Call Architecture)
  // ========================================

  /**
   * Get complete strategic intelligence (all layers)
   * Uses dashboard endpoint which contains all strategic intelligence data
   */
  async getStrategicIntelligence(auditId: string): Promise<any> {
    try {
      const dashboardData = await this.getDashboardData(auditId);

      if (!dashboardData) {
        console.warn(`No dashboard data found for audit ${auditId}`);
        return {
          category_insights: {},
          strategic_priorities: {},
          executive_summary_v2: {},
          buyer_journey_insights: {},
          intelligence_metadata: {},
          error: 'Dashboard data not found'
        };
      }

      return {
        category_insights: dashboardData.category_insights || {},
        strategic_priorities: dashboardData.strategic_priorities || {},
        executive_summary_v2: dashboardData.executive_summary_v2 || {},
        buyer_journey_insights: dashboardData.buyer_journey_insights || {},
        intelligence_metadata: dashboardData.intelligence_metadata || {}
      };
    } catch (error) {
      console.error('Failed to fetch strategic intelligence:', error);
      return {
        category_insights: {},
        strategic_priorities: {},
        executive_summary_v2: {},
        buyer_journey_insights: {},
        intelligence_metadata: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Layer 1: Category Insights
   */
  async getCategoryInsights(auditId: string, category?: string): Promise<any> {
    try {
      const dashboardData = await this.getDashboardData(auditId);
      if (!dashboardData) {
        return {
          audit_id: auditId,
          company_name: 'Unknown',
          categories: {}
        };
      }

      const categoryInsights = dashboardData.category_insights || {};

      // Transform insights to match component expectations
      const transformInsight = (insight: any) => ({
        title: insight.title || '',
        priority: insight.impact?.toLowerCase() || insight.priority || 'medium', // "High" -> "high"
        implementation_complexity: insight.difficulty?.toLowerCase() || insight.implementation_complexity || 'medium',
        estimated_impact: insight.expected_roi || insight.estimated_impact || '',
        rationale: insight.description || insight.competitive_advantage || insight.rationale || '',
        budget_estimate: insight.implementation?.budget || insight.budget_estimate,
        timeline: insight.timeline || '',
        personalized_for: insight.persona_message ? {
          company_size: 'Enterprise',
          persona: 'Marketing Director'
        } : undefined
      });

      // Transform each category
      const transformedCategories: any = {};
      for (const [categoryKey, categoryData] of Object.entries(categoryInsights)) {
        if (typeof categoryData === 'object' && categoryData !== null) {
          transformedCategories[categoryKey] = {
            recommendations: Array.isArray((categoryData as any).recommendations)
              ? (categoryData as any).recommendations.map(transformInsight)
              : [],
            competitive_gaps: Array.isArray((categoryData as any).competitive_gaps)
              ? (categoryData as any).competitive_gaps.map(transformInsight)
              : [],
            content_opportunities: Array.isArray((categoryData as any).content_opportunities)
              ? (categoryData as any).content_opportunities.map(transformInsight)
              : []
          };
        }
      }

      // If requesting single category
      if (category && category !== 'all') {
        return {
          audit_id: auditId,
          category: category,
          insights: transformedCategories[category] || {}
        };
      }

      // Return in CategoryInsightsResponse format
      return {
        audit_id: auditId,
        company_name: dashboardData.company_name || 'Unknown',
        categories: transformedCategories
      };
    } catch (error) {
      console.error('Failed to fetch category insights:', error);
      return {
        audit_id: auditId,
        company_name: 'Unknown',
        categories: {}
      };
    }
  }

  /**
   * Get Layer 2: Strategic Priorities
   */
  async getStrategicPriorities(auditId: string, type?: string): Promise<any> {
    try {
      const dashboardData = await this.getDashboardData(auditId);
      if (!dashboardData) {
        return {
          audit_id: auditId,
          company_name: 'Unknown',
          overall_score: 0,
          priorities: {}
        };
      }

      const strategicPriorities = dashboardData.strategic_priorities || {};

      // Transform priorities to match component expectations
      const transformPriority = (item: any) => {
        const p = item.priority || {};
        return {
          ...item,
          priority: {
            ...p,
            // Map database fields to expected component fields
            why_strategic: p.strategic_rationale || p.why_strategic || '',
            combined_impact: p.business_impact?.pipeline_impact || p.business_impact?.revenue_impact || p.combined_impact || '',
            roi_estimate: p.expected_roi?.return || p.roi_estimate || '',
            implementation: {
              budget: p.implementation?.budget || p.expected_roi?.investment || '',
              timeline: p.implementation?.timeline || '',
              team_required: p.implementation?.team_required || [],
              key_milestones: p.quick_wins || p.implementation?.key_milestones || []
            }
          }
        };
      };

      // Transform each priority type
      const transformedPriorities: any = {};
      for (const [key, value] of Object.entries(strategicPriorities)) {
        if (Array.isArray(value)) {
          transformedPriorities[key] = value.map(transformPriority);
        }
      }

      // Return in StrategicPrioritiesResponse format
      return {
        audit_id: auditId,
        company_name: dashboardData.company_name || 'Unknown',
        overall_score: parseFloat(dashboardData.overall_score) || 0,
        priorities: transformedPriorities
      };
    } catch (error) {
      console.error('Failed to fetch strategic priorities:', error);
      return {
        audit_id: auditId,
        company_name: 'Unknown',
        overall_score: 0,
        priorities: {}
      };
    }
  }

  /**
   * Get Layer 3: Executive Summary
   * Returns formatted data for ExecutiveSummaryCard component
   */
  async getExecutiveSummary(auditId: string): Promise<any> {
    try {
      const dashboardData = await this.getDashboardData(auditId);
      if (!dashboardData) return {};

      const executiveSummary = dashboardData.executive_summary_v2 || {};
      const summary = executiveSummary.summary || {};
      const situation = summary.situation_assessment || {};
      const roadmap = summary.implementation_roadmap || {};
      const outcomes = summary.expected_outcomes || {};
      const priorities = summary.strategic_priorities || [];

      // Transform database structure to match ExecutiveBrief interface
      const executive_brief = {
        current_state: {
          overall_score: parseFloat(dashboardData.overall_score) || 0,
          key_strengths: [situation.current_state || 'Analysis in progress'],
          critical_weaknesses: [situation.strategic_gap || 'Analyzing competitive gaps']
        },
        strategic_roadmap: {
          quick_wins: roadmap.phase_1_30_days || [],
          q1_priorities: roadmap.phase_2_90_days || [],
          q2_priorities: roadmap.phase_3_6_months || []
        },
        resource_allocation: {
          budget_required: priorities[0]?.investment || 'Analysis in progress',
          timeline: priorities[0]?.timeline || 'TBD',
          team_needs: ['Marketing', 'Content', 'Analytics']
        },
        expected_outcomes: {
          score_improvement: outcomes['12_months'] || 'Calculating projections',
          revenue_impact: priorities[0]?.business_impact || 'Analysis in progress',
          competitive_position: situation.competitive_position || 'Analyzing market position'
        },
        board_presentation: {
          key_messages: [summary.executive_brief || 'Generating insights'],
          risk_assessment: [situation.strategic_gap || 'Assessing risks'],
          success_metrics: summary.success_metrics || []
        }
      };

      // Format response to match ExecutiveSummaryResponse
      return {
        executive_brief,
        persona: executiveSummary.persona || 'Marketing Director',
        company: {
          name: dashboardData.company_name || 'Unknown Company',
          domain: dashboardData.company_domain || '',
          industry: dashboardData.industry || 'Unknown Industry',
        },
        scores: {
          overall: parseFloat(dashboardData.overall_score) || 0,
          geo: parseFloat(dashboardData.geo_score) || 0,
          sov: parseFloat(dashboardData.sov_score) || 0,
        }
      };
    } catch (error) {
      console.error('Failed to fetch executive summary:', error);
      return {
        executive_brief: {
          current_state: { overall_score: 0, key_strengths: [], critical_weaknesses: [] },
          strategic_roadmap: { quick_wins: [], q1_priorities: [], q2_priorities: [] },
          resource_allocation: { budget_required: 'N/A', timeline: 'N/A', team_needs: [] },
          expected_outcomes: { score_improvement: 'N/A', revenue_impact: 'N/A', competitive_position: 'N/A' },
          board_presentation: { key_messages: [], risk_assessment: [], success_metrics: [] }
        },
        persona: 'Marketing Director',
        company: { name: 'Unknown', domain: '', industry: 'Unknown' },
        scores: { overall: 0, geo: 0, sov: 0 }
      };
    }
  }

  /**
   * Get Phase 2: Buyer Journey Insights
   */
  async getBuyerJourneyInsights(auditId: string, category?: string): Promise<any> {
    try {
      const dashboardData = await this.getDashboardData(auditId);
      if (!dashboardData) {
        return {
          audit_id: auditId,
          company_name: 'Unknown',
          buyer_journey: {}
        };
      }

      const buyerJourneyInsights = dashboardData.buyer_journey_insights || {};

      // If requesting single category
      if (category && category !== 'all') {
        return {
          audit_id: auditId,
          category: category,
          batches: buyerJourneyInsights[category] || {}
        };
      }

      // Return in BuyerJourneyInsightsResponse format
      return {
        audit_id: auditId,
        company_name: dashboardData.company_name || 'Unknown',
        buyer_journey: buyerJourneyInsights
      };
    } catch (error) {
      console.error('Failed to fetch buyer journey insights:', error);
      return {
        audit_id: auditId,
        company_name: 'Unknown',
        buyer_journey: {}
      };
    }
  }

  /**
   * Get Intelligence Metadata (performance metrics)
   */
  async getIntelligenceMetadata(auditId: string): Promise<any> {
    try {
      const dashboardData = await this.getDashboardData(auditId);
      if (!dashboardData) return {};

      return dashboardData.intelligence_metadata || {};
    } catch (error) {
      console.error('Failed to fetch intelligence metadata:', error);
      return {};
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
      const [geoScore, recommendations] = await Promise.all([
        this.getDetailedAnalysis(domain),
        this.getContentRecommendations(domain).catch(() => null),
      ]);

      return {
        geoScore,
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