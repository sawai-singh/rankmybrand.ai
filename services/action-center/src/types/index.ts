export interface MetricsEvent {
  brandId: string;
  platform: string;
  geoScore: number;
  shareOfVoice: number;
  sentiment: {
    score: number;
    label: string;
  };
  mentions: BrandMention[];
  citations: Citation[];
  contentGaps: ContentGap[];
  timestamp: string;
  correlationId?: string;
}

export interface ContentGap {
  id: string;
  type: string;
  description: string;
  priority: number;
  queryExamples: string[];
  competitorAdvantage: number;
  estimatedSearchVolume?: number;
  estimatedImpact: number;
}

export interface BrandMention {
  text: string;
  sentiment: number;
  position: number;
  context: string;
}

export interface Citation {
  url: string;
  domain: string;
  title?: string;
  authorityScore: number;
}

export interface Recommendation {
  id: string;
  brandId: string;
  type: RecommendationType;
  subtype?: string;
  title: string;
  description: string;
  priority: number;
  estimatedImpact: number;
  implementationEffort: 'easy' | 'medium' | 'hard';
  autoExecutable: boolean;
  status: RecommendationStatus;
  content?: string;
  metadata?: Record<string, any>;
  implementation?: ImplementationDetails;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

export type RecommendationType = 
  | 'content_creation'
  | 'technical_optimization'
  | 'link_building'
  | 'competitive_response'
  | 'meta_optimization'
  | 'schema_markup'
  | 'faq_addition';

export type RecommendationStatus = 
  | 'pending'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface ImplementationDetails {
  platform?: string;
  method?: string;
  targetUrl?: string;
  parameters?: Record<string, any>;
  rollbackData?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  recommendationId: string;
  platform?: string;
  resultUrl?: string;
  resultId?: string;
  error?: string;
  executionTimeMs: number;
  rollbackAvailable: boolean;
}

export interface ExecutionTransaction {
  id: string;
  recommendationId: string;
  startedAt: Date;
  steps: ExecutionStep[];
  status: 'pending' | 'committed' | 'rolled_back';
}

export interface ExecutionStep {
  action: string;
  platform: string;
  request: any;
  response?: any;
  error?: string;
  rollbackData?: any;
}

export interface Brand {
  id: string;
  name: string;
  domain: string;
  platform?: 'wordpress' | 'webflow' | 'custom';
  tone?: string;
  keywords?: string[];
  competitors?: string[];
  settings?: BrandSettings;
}

export interface BrandSettings {
  autoExecutionEnabled: boolean;
  approvedTypes: string[];
  maxDailyExecutions: number;
  draftModeOnly: boolean;
  notificationChannels: string[];
}

export interface ApprovalRequest {
  id: string;
  recommendationId: string;
  requestedBy: string;
  requestedAt: Date;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  respondedAt?: Date;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  includeSchema?: boolean;
  includeCitations?: boolean;
  targetLength?: number;
}