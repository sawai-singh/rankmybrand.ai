// Shared type definitions across all services
export interface BrandContext {
  brand_id: string;
  customer_id: string;
  session_id?: string;
  timestamp: string;
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata: ResponseMetadata;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMetadata {
  service: string;
  version: string;
  requestId: string;
  processingTime: number;
  brand_id?: string;
  customer_id?: string;
}

export interface EventPayload<T = unknown> {
  type: string;
  data: T;
  correlationId: string;
  context: BrandContext;
}

export interface StreamMessage {
  id: string;
  stream: string;
  fields: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
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

export interface ClientMessage {
  type: 'ping' | 'subscribe' | 'unsubscribe' | 'request' | 'action';
  streams?: string[];
  resource?: string;
  action?: string;
  recommendationId?: string;
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