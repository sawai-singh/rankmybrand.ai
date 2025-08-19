-- AI Visibility Database Schema
-- Stores queries, responses, and analysis results for historical tracking

-- AI Visibility Reports table
CREATE TABLE IF NOT EXISTS ai_visibility_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    report_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Report metadata
    trigger_source VARCHAR(50) NOT NULL, -- 'report_generation', 'manual', 'scheduled'
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processing_time_seconds DECIMAL(10,2),
    
    -- Summary metrics
    queries_generated INTEGER NOT NULL DEFAULT 0,
    total_llm_calls INTEGER NOT NULL DEFAULT 0,
    overall_visibility_score DECIMAL(5,2) CHECK (overall_visibility_score >= 0 AND overall_visibility_score <= 100),
    brand_mention_rate DECIMAL(5,4) CHECK (brand_mention_rate >= 0 AND brand_mention_rate <= 1),
    positive_sentiment_rate DECIMAL(5,4) CHECK (positive_sentiment_rate >= 0 AND positive_sentiment_rate <= 1),
    competitive_position VARCHAR(50), -- 'leader', 'challenger', 'follower', 'niche'
    
    -- Platform-specific scores (JSON)
    platform_scores JSONB,
    
    -- Insights (JSON arrays)
    strengths JSONB,
    weaknesses JSONB,
    opportunities JSONB,
    recommendations JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Queries table - stores all generated queries
CREATE TABLE IF NOT EXISTS ai_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(255) NOT NULL REFERENCES ai_visibility_reports(report_id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    query_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Query content
    query_text TEXT NOT NULL,
    intent VARCHAR(50), -- 'navigational', 'informational', 'transactional', 'commercial', 'comparative'
    buyer_journey_stage VARCHAR(50), -- 'awareness', 'consideration', 'decision', 'retention'
    
    -- Query metrics
    complexity_score DECIMAL(3,2) CHECK (complexity_score >= 0 AND complexity_score <= 1),
    competitive_relevance DECIMAL(3,2) CHECK (competitive_relevance >= 0 AND competitive_relevance <= 1),
    priority_score DECIMAL(3,2) CHECK (priority_score >= 0 AND priority_score <= 1),
    
    -- Semantic variations (JSON array)
    semantic_variations JSONB,
    
    -- Expected SERP features (JSON array)
    expected_serp_features JSONB,
    
    -- Persona alignment
    persona_alignment VARCHAR(255),
    industry_specificity DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Responses table - stores LLM responses to queries
CREATE TABLE IF NOT EXISTS ai_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id VARCHAR(255) NOT NULL,
    report_id VARCHAR(255) NOT NULL REFERENCES ai_visibility_reports(report_id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Response metadata
    provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google', 'perplexity'
    model_version VARCHAR(100),
    response_time_ms INTEGER,
    
    -- Response content
    response_text TEXT NOT NULL,
    response_summary TEXT,
    
    -- Analysis results
    brand_mentioned BOOLEAN DEFAULT FALSE,
    competitor_mentions JSONB, -- Array of competitor names mentioned
    sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral', 'mixed'
    sentiment_score DECIMAL(3,2), -- -1 to 1
    
    -- Visibility metrics
    prominence_score DECIMAL(3,2), -- How prominently the brand was mentioned
    recommendation_strength VARCHAR(20), -- 'strong', 'moderate', 'weak', 'none'
    competitive_advantage BOOLEAN DEFAULT FALSE,
    
    -- Additional analysis
    key_phrases JSONB, -- Important phrases extracted
    mentioned_features JSONB, -- Product features mentioned
    mentioned_benefits JSONB, -- Benefits mentioned
    call_to_action TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggregated platform scores over time
CREATE TABLE IF NOT EXISTS platform_visibility_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    report_id VARCHAR(255) REFERENCES ai_visibility_reports(report_id) ON DELETE SET NULL,
    
    platform VARCHAR(50) NOT NULL,
    score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    mention_count INTEGER DEFAULT 0,
    total_queries INTEGER DEFAULT 0,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, platform, recorded_at)
);

-- Query performance tracking
CREATE TABLE IF NOT EXISTS query_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id VARCHAR(255) NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    total_responses INTEGER DEFAULT 0,
    brand_mentions INTEGER DEFAULT 0,
    positive_mentions INTEGER DEFAULT 0,
    negative_mentions INTEGER DEFAULT 0,
    neutral_mentions INTEGER DEFAULT 0,
    
    avg_prominence_score DECIMAL(3,2),
    conversion_potential DECIMAL(3,2), -- Likelihood of driving conversions
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive analysis results
CREATE TABLE IF NOT EXISTS competitive_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(255) NOT NULL REFERENCES ai_visibility_reports(report_id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    competitor_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    competitor_name VARCHAR(255),
    
    mention_count INTEGER DEFAULT 0,
    co_mention_count INTEGER DEFAULT 0, -- Times both were mentioned together
    wins INTEGER DEFAULT 0, -- Times our company was preferred
    losses INTEGER DEFAULT 0, -- Times competitor was preferred
    ties INTEGER DEFAULT 0, -- Times both were mentioned equally
    
    relative_visibility_score DECIMAL(5,2), -- -100 to 100 (negative means competitor is more visible)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ai_reports_company_id ON ai_visibility_reports(company_id);
CREATE INDEX idx_ai_reports_generated_at ON ai_visibility_reports(generated_at DESC);
CREATE INDEX idx_ai_queries_report_id ON ai_queries(report_id);
CREATE INDEX idx_ai_queries_company_id ON ai_queries(company_id);
CREATE INDEX idx_ai_responses_query_id ON ai_responses(query_id);
CREATE INDEX idx_ai_responses_report_id ON ai_responses(report_id);
CREATE INDEX idx_ai_responses_provider ON ai_responses(provider);
CREATE INDEX idx_platform_scores_company_id ON platform_visibility_scores(company_id);
CREATE INDEX idx_competitive_visibility_company_id ON competitive_visibility(company_id);

-- Create a view for admin dashboard to easily fetch historical queries
CREATE OR REPLACE VIEW admin_historical_queries AS
SELECT 
    q.id,
    q.company_id,
    q.query_id,
    q.query_text,
    q.intent,
    q.buyer_journey_stage,
    q.complexity_score,
    q.competitive_relevance,
    q.priority_score,
    q.created_at,
    r.report_id,
    r.generated_at as report_generated_at,
    r.overall_visibility_score as report_score,
    COUNT(DISTINCT ar.id) as response_count,
    SUM(CASE WHEN ar.brand_mentioned THEN 1 ELSE 0 END) as brand_mention_count,
    AVG(ar.sentiment_score) as avg_sentiment_score
FROM ai_queries q
INNER JOIN ai_visibility_reports r ON q.report_id = r.report_id
LEFT JOIN ai_responses ar ON q.query_id = ar.query_id
GROUP BY 
    q.id, q.company_id, q.query_id, q.query_text, q.intent,
    q.buyer_journey_stage, q.complexity_score, q.competitive_relevance,
    q.priority_score, q.created_at, r.report_id, r.generated_at, r.overall_visibility_score;

-- Add triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_visibility_reports_updated_at 
    BEFORE UPDATE ON ai_visibility_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_query_performance_updated_at 
    BEFORE UPDATE ON query_performance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();