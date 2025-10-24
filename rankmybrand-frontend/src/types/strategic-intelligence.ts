/**
 * TypeScript Types for 118-Call Strategic Intelligence Architecture
 * Layer 1-3 + Phase 2 Buyer Journey Insights
 */

// ============================================
// Layer 1: Category Insights (18 LLM calls)
// ============================================

export interface CategoryInsight {
  title: string;
  priority: 'high' | 'medium' | 'low';
  implementation_complexity: 'low' | 'medium' | 'high';
  estimated_impact: string;
  rationale: string;
  budget_estimate?: string;
  timeline?: string;
  personalized_for?: {
    company_size: string;
    persona: string;
  };
}

export interface CategoryInsights {
  recommendations: CategoryInsight[];
  competitive_gaps: CategoryInsight[];
  content_opportunities: CategoryInsight[];
}

export interface AllCategoryInsights {
  [category: string]: CategoryInsights; // e.g., "comparison", "purchase_intent", etc.
}

// ============================================
// Layer 2: Strategic Priorities (3 LLM calls)
// ============================================

export interface StrategicPriority {
  rank: number;
  title: string;
  source_categories: string[];
  funnel_stages_impacted: string[];
  combined_impact: string;
  roi_estimate?: string;
  implementation: {
    budget: string;
    timeline: string;
    team_required: string[];
    key_milestones: string[];
  };
  why_strategic: string;
}

export interface StrategicPriorityWithType {
  rank: number;
  priority: StrategicPriority;
  source_categories: string[];
  funnel_stages_impacted: string[];
}

export interface AllStrategicPriorities {
  recommendations?: StrategicPriorityWithType[];
  competitive_gaps?: StrategicPriorityWithType[];
  content_opportunities?: StrategicPriorityWithType[];
}

// ============================================
// Layer 3: Executive Summary (1 LLM call)
// ============================================

export interface ExecutiveBrief {
  current_state: {
    overall_score: number;
    key_strengths: string[];
    critical_weaknesses: string[];
  };
  strategic_roadmap: {
    q1_priorities: string[];
    q2_priorities: string[];
    quick_wins: string[];
  };
  resource_allocation: {
    budget_required: string;
    team_needs: string[];
    timeline: string;
  };
  expected_outcomes: {
    score_improvement: string;
    revenue_impact: string;
    competitive_position: string;
  };
  board_presentation: {
    key_messages: string[];
    risk_assessment: string[];
    success_metrics: string[];
  };
}

export interface ExecutiveSummary {
  summary: ExecutiveBrief;
  persona: string;
  company_id: number;
}

// ============================================
// Phase 2: Buyer Journey Insights (96 LLM calls)
// ============================================

export interface BatchInsights {
  recommendations?: any[];
  competitive_gaps?: any[];
  content_opportunities?: any[];
  per_response_metrics?: any[];
}

export interface BuyerJourneyInsights {
  [category: string]: {
    [batchNumber: string]: BatchInsights;
  };
}

// ============================================
// Performance Metadata
// ============================================

export interface IntelligenceMetadata {
  total_llm_calls: number;
  phase2_calls: number;
  layer1_calls: number;
  layer2_calls: number;
  layer3_calls: number;
  total_cost: number;
  processing_time_seconds: number;
  phase2_time_seconds?: number;
  layer1_time_seconds?: number;
  layer2_time_seconds?: number;
  layer3_time_seconds?: number;
}

// ============================================
// Complete Strategic Intelligence Response
// ============================================

export interface StrategicIntelligence {
  category_insights: AllCategoryInsights;
  strategic_priorities: AllStrategicPriorities;
  executive_summary: ExecutiveSummary;
  buyer_journey_insights: BuyerJourneyInsights;
  metadata: IntelligenceMetadata;
}

export interface StrategicIntelligenceResponse {
  audit_id: string;
  company_name: string;
  overall_score: number;
  strategic_intelligence: StrategicIntelligence;
}

// ============================================
// Individual Endpoint Response Types
// ============================================

export interface CategoryInsightsResponse {
  audit_id: string;
  company_name: string;
  categories: AllCategoryInsights;
}

export interface CategoryInsightsSingleResponse {
  audit_id: string;
  category: string;
  insights: CategoryInsights;
}

export interface StrategicPrioritiesResponse {
  audit_id: string;
  company_name: string;
  overall_score: number;
  priorities: AllStrategicPriorities;
}

export interface StrategicPrioritiesSingleResponse {
  audit_id: string;
  type: string;
  priorities: StrategicPriorityWithType[];
}

export interface ExecutiveSummaryResponse {
  audit_id: string;
  company: {
    name: string;
    domain: string;
    industry: string;
  };
  scores: {
    overall: number;
    geo: number;
    sov: number;
  };
  executive_brief: ExecutiveBrief;
  persona: string;
  generated_at: string;
}

export interface BuyerJourneyInsightsResponse {
  audit_id: string;
  company_name: string;
  buyer_journey: BuyerJourneyInsights;
}

export interface BuyerJourneyInsightsSingleResponse {
  audit_id: string;
  category: string;
  batches: {
    [batchNumber: string]: BatchInsights;
  };
}

export interface MetadataResponse {
  audit_id: string;
  llm_metrics: {
    total_calls: number;
    phase2_calls: number;
    layer1_calls: number;
    layer2_calls: number;
    layer3_calls: number;
    total_cost: number;
    processing_time: number;
  };
  timing_breakdown: {
    phase2_seconds: number;
    layer1_seconds: number;
    layer2_seconds: number;
    layer3_seconds: number;
  };
}

// ============================================
// Buyer Journey Categories (for filtering)
// ============================================

export const BUYER_JOURNEY_CATEGORIES = [
  'problem_unaware',
  'solution_seeking',
  'brand_specific',
  'comparison',
  'purchase_intent',
  'use_case',
] as const;

export type BuyerJourneyCategory = typeof BUYER_JOURNEY_CATEGORIES[number];

// ============================================
// Priority Types (for filtering)
// ============================================

export const PRIORITY_TYPES = [
  'recommendations',
  'competitive_gaps',
  'content_opportunities',
] as const;

export type PriorityType = typeof PRIORITY_TYPES[number];
