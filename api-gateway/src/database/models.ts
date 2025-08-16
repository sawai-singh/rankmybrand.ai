/**
 * Database Models for RankMyBrand
 * TypeScript interfaces and types for all database tables
 */

// =====================================================
// USER MODELS
// =====================================================

export interface User {
  id: number;
  email: string;
  work_email?: string;
  password_hash?: string;
  email_verified: boolean;
  email_verification_token?: string;
  magic_link_token?: string;
  magic_link_expires?: Date;
  
  // Profile
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  timezone: string;
  
  // Company
  company_id?: number;
  role: 'user' | 'admin' | 'enterprise';
  
  // Subscription
  subscription_tier: 'free' | 'pro' | 'enterprise';
  subscription_expires?: Date;
  trial_ends?: Date;
  
  // Metadata
  last_login?: Date;
  login_count: number;
  onboarding_completed: boolean;
  onboarding_completed_at?: Date;
  
  // Settings
  settings: Record<string, unknown>;
  preferences: Record<string, unknown>;
  
  // Tracking
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// COMPANY MODELS
// =====================================================

export interface Company {
  id: number;
  
  // Basic info
  name: string;
  domain: string;
  logo_url?: string;
  description?: string;
  
  // Enrichment data
  industry?: string;
  sub_industry?: string;
  company_size?: string;
  employee_count?: number;
  founded_year?: number;
  
  // Location
  headquarters_city?: string;
  headquarters_state?: string;
  headquarters_country?: string;
  headquarters_address?: string;
  
  // Social profiles
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  
  // Technology
  tech_stack?: string[];
  
  // Enrichment metadata
  enrichment_source?: 'clearbit' | 'hunter' | 'apollo' | 'manual' | 'crawler' | 'openai-llm';
  enrichment_data?: Record<string, unknown>;
  enrichment_confidence?: number;
  enrichment_date?: Date;
  
  // Analysis
  latest_geo_score?: number;
  latest_geo_analysis_id?: number;
  latest_analysis_date?: Date;
  
  // Metadata
  tags?: string[];
  keywords?: string[];
  
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// ONBOARDING MODELS
// =====================================================

export interface OnboardingSession {
  id: number;
  session_id: string;
  user_id?: number;
  
  // Session data
  email: string;
  current_step: 'email' | 'company' | 'description' | 'competitors' | 'complete';
  
  // Progress
  email_validated: boolean;
  email_validated_at?: Date;
  
  company_enriched: boolean;
  company_enriched_at?: Date;
  company_data?: Record<string, unknown>;
  
  description_generated: boolean;
  description_generated_at?: Date;
  description_text?: string;
  
  competitors_selected: boolean;
  competitors_selected_at?: Date;
  
  completed: boolean;
  completed_at?: Date;
  
  // Tracking
  time_spent_seconds: number;
  abandonment_reason?: string;
  
  // Jobs
  geo_analysis_job_id?: string;
  crawl_job_id?: string;
  search_analysis_job_id?: string;
  
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

// =====================================================
// COMPETITOR MODELS
// =====================================================

export interface Competitor {
  id: number;
  company_id: number;
  
  // Competitor info
  competitor_name: string;
  competitor_domain: string;
  competitor_company_id?: number;
  
  // Discovery
  discovery_source?: 'serp' | 'manual' | 'industry_db' | 'ai_inference';
  discovery_reason?: string;
  similarity_score?: number;
  confidence_score?: number;
  
  // Tracking
  is_active: boolean;
  added_by_user_id?: number;
  
  // Analysis
  latest_geo_score?: number;
  latest_analysis_date?: Date;
  score_difference?: number;
  
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// SESSION MODELS
// =====================================================

export interface UserSession {
  id: number;
  user_id: number;
  
  session_token: string;
  refresh_token?: string;
  
  ip_address?: string;
  user_agent?: string;
  device_type?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  
  is_active: boolean;
  
  created_at: Date;
  expires_at: Date;
  last_activity: Date;
}

// =====================================================
// ANALYSIS MODELS
// =====================================================

export interface AnalysisHistory {
  id: number;
  company_id: number;
  user_id?: number;
  
  // Type
  analysis_type: 'geo' | 'crawl' | 'search' | 'complete';
  
  // Results
  geo_score?: number;
  share_of_voice?: number;
  sentiment_positive?: number;
  sentiment_neutral?: number;
  sentiment_negative?: number;
  
  // Platform scores
  chatgpt_score?: number;
  claude_score?: number;
  perplexity_score?: number;
  gemini_score?: number;
  bing_score?: number;
  
  // Data
  raw_data?: Record<string, unknown>;
  insights?: string[];
  recommendations?: string[];
  
  created_at: Date;
}

// =====================================================
// NOTIFICATION MODELS
// =====================================================

export interface UserNotification {
  id: number;
  user_id: number;
  
  type: 'email' | 'in_app' | 'push';
  category: 'onboarding' | 'analysis' | 'competitor' | 'alert';
  
  subject?: string;
  message?: string;
  
  is_read: boolean;
  read_at?: Date;
  
  is_sent: boolean;
  sent_at?: Date;
  
  metadata?: Record<string, unknown>;
  
  created_at: Date;
}

// =====================================================
// AUDIT MODELS
// =====================================================

export interface AuditLog {
  id: number;
  user_id?: number;
  
  action: string;
  resource_type?: string;
  resource_id?: number;
  
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  
  ip_address?: string;
  user_agent?: string;
  
  created_at: Date;
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateUserRequest {
  email: string;
  work_email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  company_id?: number;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  timezone?: string;
  settings?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface CreateCompanyRequest {
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  company_size?: string;
  employee_count?: number;
}

export interface CreateOnboardingSessionRequest {
  email: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
}

export interface AddCompetitorRequest {
  company_id: number;
  competitor_name: string;
  competitor_domain: string;
  discovery_source?: string;
  discovery_reason?: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
  magic_link_token?: string;
}

export interface LoginResponse {
  user: User;
  session_token: string;
  refresh_token: string;
  expires_at: Date;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  session_token: string;
  refresh_token: string;
  expires_at: Date;
}

// =====================================================
// QUERY HELPERS
// =====================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  from_date?: Date;
  to_date?: Date;
  status?: string;
  type?: string;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type UserWithCompany = User & {
  company?: Company;
};

export type CompanyWithCompetitors = Company & {
  competitors?: Competitor[];
};

export type OnboardingSessionWithUser = OnboardingSession & {
  user?: User;
};

export type AnalysisWithCompany = AnalysisHistory & {
  company?: Company;
};

// =====================================================
// CONSTANTS
// =====================================================

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  ENTERPRISE: 'enterprise'
} as const;

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
} as const;

export const ANALYSIS_TYPES = {
  GEO: 'geo',
  CRAWL: 'crawl',
  SEARCH: 'search',
  COMPLETE: 'complete'
} as const;

export const NOTIFICATION_TYPES = {
  EMAIL: 'email',
  IN_APP: 'in_app',
  PUSH: 'push'
} as const;

// =====================================================
// TYPE GUARDS
// =====================================================

export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    'role' in obj
  );
}

export function isCompany(obj: unknown): obj is Company {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'domain' in obj
  );
}

export function hasCompanyData(user: User): user is UserWithCompany {
  return 'company' in user && user.company !== undefined;
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  return domainRegex.test(domain);
}