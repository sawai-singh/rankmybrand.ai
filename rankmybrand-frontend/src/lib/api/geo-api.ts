import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_GEO_API || 'http://localhost:8000';

export interface GEOAnalysis {
  domain: string;
  score: number;
  shareOfVoice: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  platforms: Record<string, number>;
  competitors: Array<{
    domain: string;
    score: number;
    position: number;
  }>;
  insights: string[];
  timestamp: string;
}

export interface AnalysisRequest {
  domain: string;
  keywords?: string[];
  competitors?: string[];
}

class GeoAPI {
  private client = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async analyze(request: AnalysisRequest): Promise<GEOAnalysis> {
    const { data } = await this.client.post('/api/v1/geo/analyze', request);
    return data;
  }

  async getAnalysis(domain: string): Promise<GEOAnalysis> {
    const { data } = await this.client.get(`/api/v1/geo/analysis/${domain}`);
    return data;
  }

  async getTrending(): Promise<Array<{ domain: string; score: number; change: number }>> {
    const { data } = await this.client.get('/api/v1/geo/trending');
    return data;
  }

  async compareCompetitors(domains: string[]): Promise<any> {
    const { data } = await this.client.post('/api/v1/geo/compare', { domains });
    return data;
  }

  async getRecommendations(domain: string): Promise<any> {
    const { data } = await this.client.get(`/api/v1/geo/recommendations/${domain}`);
    return data;
  }
}

export const geoAPI = new GeoAPI();