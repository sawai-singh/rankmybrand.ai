/**
 * Enhanced Query Generation Types
 * Defines the structure for comprehensive brand visibility query generation
 */

export enum QueryCategory {
  PROBLEM_UNAWARE = 'problem_unaware',
  SOLUTION_SEEKING = 'solution_seeking',
  BRAND_SPECIFIC = 'brand_specific',
  COMPARISON = 'comparison',
  PURCHASE_INTENT = 'purchase_intent',
  USE_CASE = 'use_case'
}

export enum QueryIntent {
  INFORMATIONAL = 'informational',
  COMMERCIAL = 'commercial',
  TRANSACTIONAL = 'transactional',
  NAVIGATIONAL = 'navigational',
  INVESTIGATIONAL = 'investigational'
}

export enum TargetPersona {
  DECISION_MAKER = 'decision_maker',
  END_USER = 'end_user',
  TECHNICAL_BUYER = 'technical_buyer',
  ECONOMIC_BUYER = 'economic_buyer',
  INFLUENCER = 'influencer',
  RESEARCHER = 'researcher'
}

export enum PlatformOptimization {
  CHATGPT = 'chatgpt',
  GEMINI = 'gemini',
  CLAUDE = 'claude',
  PERPLEXITY = 'perplexity',
  UNIVERSAL = 'universal'
}

export interface QueryMetadata {
  query: string;
  category: QueryCategory;
  intent: QueryIntent;
  priority: number; // 1-10 scale
  persona: TargetPersona;
  platform_optimization: PlatformOptimization;
  expected_serp_type: 'list' | 'comparison' | 'explanation' | 'recommendation' | 'mixed';
  specificity_level: 'broad' | 'medium' | 'long_tail';
  commercial_value: 'high' | 'medium' | 'low';
}

export interface EnhancedCompanyContext {
  // Basic company info
  company: {
    id: number;
    name: string;
    domain: string;
    industry: string;
    sub_industry?: string;
    description: string;
    company_size: 'startup' | 'smb' | 'mid_market' | 'enterprise';
    years_in_business?: number;
    unique_value_proposition?: string;
    headquarters_location?: string;
  };
  
  // Market positioning
  market_position: {
    is_market_leader: boolean;
    is_challenger: boolean;
    is_disruptor: boolean;
    is_niche_player: boolean;
    market_share_estimate?: 'dominant' | 'significant' | 'moderate' | 'small' | 'emerging';
    growth_trajectory?: 'rapid' | 'steady' | 'stable' | 'declining';
  };
  
  // Target audience
  target_audience: {
    primary_persona: string;
    secondary_personas: string[];
    geographic_markets: string[];
    industry_verticals: string[];
    company_sizes: string[];
    use_cases: string[];
  };
  
  // Products and services
  products_services: {
    main_offerings: string[];
    key_features: string[];
    key_benefits: string[];
    pricing_model: 'subscription' | 'one_time' | 'usage_based' | 'freemium' | 'custom';
    price_range?: 'premium' | 'mid_range' | 'budget' | 'free';
    delivery_model?: 'saas' | 'on_premise' | 'hybrid' | 'physical' | 'service';
  };
  
  // Competitive landscape
  competitors: {
    direct_competitors: string[];
    indirect_competitors: string[];
    competitive_advantages: string[];
    competitive_weaknesses: string[];
    market_differentiators: string[];
  };
  
  // Search landscape insights
  search_landscape: {
    industry_search_volume: 'high' | 'medium' | 'low';
    seasonality_factors?: string[];
    trending_topics: string[];
    common_pain_points: string[];
    regulatory_considerations?: string[];
    industry_jargon: string[];
  };
}

export interface QueryGenerationRequest {
  company_id: number;
  context: EnhancedCompanyContext;
  force_regenerate?: boolean;
  query_count?: number; // Default 48
  custom_instructions?: string;
}

export interface QueryGenerationResponse {
  company_id: number;
  queries: QueryMetadata[];
  generation_timestamp: Date;
  model_used: string;
  success: boolean;
  message?: string;
}

export interface QueryPerformanceMetrics {
  query_id: number;
  query: string;
  category: QueryCategory;
  times_searched: number;
  brand_appeared: number;
  average_position: number;
  sentiment_scores: {
    positive: number;
    neutral: number;
    negative: number;
  };
  competitor_mentions: string[];
  last_checked: Date;
}

export interface QueryCategoryDistribution {
  category: QueryCategory;
  count: number;
  percentage: number;
  high_priority_count: number;
  coverage_score: number; // 0-100
}

export interface QueryGenerationPrompt {
  system_prompt: string;
  user_prompt: string;
  context: EnhancedCompanyContext;
  output_format: object;
  examples?: object[];
}