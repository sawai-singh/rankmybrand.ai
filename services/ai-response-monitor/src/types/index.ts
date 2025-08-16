export interface AIResponse {
  id?: string;
  platform: string;
  prompt: string;
  response: string;
  model?: string;
  citations?: Citation[];
  tokensUsed?: number;
  processingTime: number;
  cost?: number; // in cents
  sessionId?: string;
  metadata?: AIResponseMetadata;
  timestamp: Date;
}

export interface AIResponseMetadata {
  brand_id?: string;
  customer_id?: string;
  session_id?: string;
  platform?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface Citation {
  title: string;
  url: string;
  snippet?: string;
  position?: number;
  domain?: string;
}

export interface CollectionJob {
  id: string;
  brandId: string;
  platforms: string[];
  prompts: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: AIResponse[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface CollectionOptions {
  useCache?: boolean;
  cacheTTL?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface PlatformConfig {
  name: string;
  type: 'api' | 'scraping';
  endpoint?: string;
  apiKey?: string;
  models?: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
  selectors?: {
    input: string;
    submit: string;
    response: string;
    citations?: string;
  };
  requiresAuth?: boolean;
  antiDetection?: boolean;
  isActive?: boolean;
}

export interface SessionData {
  id: string;
  platform: string;
  token?: string;
  cookies?: Record<string, string>[];
  userAgent?: string;
  proxy?: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CollectorMetrics {
  platform: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalCost: number;
  cacheHitRate: number;
  lastError?: string;
  lastUpdated: Date;
}