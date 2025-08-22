export interface ClientMessage {
  type: 'ping' | 'subscribe' | 'unsubscribe' | 'request' | 'action';
  streams?: string[];
  resource?: string;
  action?: string;
  recommendationId?: string;
  brandId?: string;
  [key: string]: unknown;
}

export interface StreamData {
  [key: string]: string | number | boolean | object;
}

export interface BroadcastMessage {
  type: string;
  data: unknown;
  timestamp: string;
  streamId?: string;
}

export interface MetricsData {
  geoScore: number;
  shareOfVoice: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  citationCount: number;
  platformScores: Record<string, number>;
}

export interface GeoSovProgress {
  stage: 'analyzing' | 'calculating_geo' | 'calculating_sov' | 'aggregating' | 'complete';
  progress: number; // 0-100
  currentProvider?: string;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
  geoScore?: number;
  sovScore?: number;
  message?: string;
}

export interface RecommendationData {
  id: string;
  title: string;
  description: string;
  priority: string;
  impact: number;
  effort: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface CompetitorData {
  id: string;
  name: string;
  geoScore: number;
  shareOfVoice: number;
  position?: number[];
  color: string;
}