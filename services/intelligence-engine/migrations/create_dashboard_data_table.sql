-- =====================================================
-- COMPREHENSIVE DASHBOARD DATA TABLE
-- Single source of truth for ALL dashboard displays
-- Everything the customer needs to see in one place
-- =====================================================

-- Drop existing table if needed for clean migration
DROP TABLE IF EXISTS dashboard_data CASCADE;

-- Main dashboard data table - the master view
CREATE TABLE dashboard_data (
    -- =====================================================
    -- IDENTIFIERS
    -- =====================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(255) UNIQUE NOT NULL,
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    report_id VARCHAR(255),
    
    -- =====================================================
    -- COMPANY CONTEXT (Enriched Data)
    -- =====================================================
    company_name VARCHAR(255) NOT NULL,
    company_domain VARCHAR(255),
    industry VARCHAR(100),
    sub_industry VARCHAR(100),
    company_size VARCHAR(50), -- 'startup', 'smb', 'midmarket', 'enterprise'
    employee_count INTEGER,
    annual_revenue VARCHAR(50),
    funding_stage VARCHAR(50),
    market_position VARCHAR(50), -- 'leader', 'challenger', 'follower', 'niche'
    headquarters VARCHAR(255),
    
    -- =====================================================
    -- OVERALL SCORES & METRICS
    -- =====================================================
    overall_score NUMERIC(5,2), -- 0-100 composite score
    geo_score NUMERIC(5,2), -- 0-100 Generative Engine Optimization
    sov_score NUMERIC(5,2), -- 0-100 Share of Voice
    visibility_score NUMERIC(5,2), -- 0-100 Brand visibility
    sentiment_score NUMERIC(5,2), -- 0-100 Overall sentiment
    recommendation_score NUMERIC(5,2), -- 0-100 Recommendation strength
    context_completeness_score NUMERIC(5,2), -- 0-100 Information completeness
    
    -- Score breakdowns by category
    score_breakdown JSONB, -- Detailed breakdown of all scores
    score_trends JSONB, -- Historical trends if multiple audits
    
    -- =====================================================
    -- BRAND ANALYSIS
    -- =====================================================
    brand_mentioned_count INTEGER DEFAULT 0,
    brand_mention_rate NUMERIC(5,2), -- Percentage of responses mentioning brand
    brand_first_position_rate NUMERIC(5,2), -- % times brand appears first
    brand_sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative', 'mixed'
    brand_sentiment_distribution JSONB, -- {"positive": 45, "neutral": 35, "negative": 20}
    brand_recommendation_strength VARCHAR(20), -- 'strong', 'moderate', 'weak', 'none'
    
    -- =====================================================
    -- COMPETITOR ANALYSIS
    -- =====================================================
    main_competitors JSONB, -- ["Competitor1", "Competitor2", ...]
    competitor_mentions JSONB, -- Detailed competitor mention analysis
    competitor_comparison JSONB, -- Head-to-head comparisons
    competitive_gaps JSONB, -- Where competitors are winning
    competitive_advantages JSONB, -- Where brand is winning
    market_share_estimate JSONB, -- {"brand": 25, "competitor1": 35, ...}
    
    -- =====================================================
    -- LLM PROVIDER ANALYSIS
    -- =====================================================
    provider_scores JSONB, -- {"openai": {"geo": 85, "sov": 72}, "anthropic": {...}}
    provider_response_times JSONB, -- {"openai": 1250, "anthropic": 980, ...}
    provider_token_usage JSONB, -- {"openai": 15000, "anthropic": 12000, ...}
    provider_sentiment_analysis JSONB, -- Sentiment by provider
    provider_recommendation_analysis JSONB, -- Recommendations by provider
    best_performing_provider VARCHAR(50), -- Which LLM performed best
    worst_performing_provider VARCHAR(50), -- Which LLM performed worst
    
    -- =====================================================
    -- QUERY ANALYSIS
    -- =====================================================
    total_queries INTEGER,
    queries_list JSONB, -- Complete list of all queries
    query_categories JSONB, -- Queries grouped by category
    query_performance JSONB, -- Performance metrics per query
    top_performing_queries JSONB, -- Best queries for visibility
    worst_performing_queries JSONB, -- Queries needing improvement
    
    -- =====================================================
    -- AGGREGATED RECOMMENDATIONS (The Crown Jewel)
    -- =====================================================
    top_recommendations JSONB, -- Top 10-20 prioritized recommendations
    strategic_themes JSONB, -- High-level strategic themes
    quick_wins JSONB, -- Immediate actions (< 1 week)
    long_term_initiatives JSONB, -- Strategic initiatives (3+ months)
    executive_summary TEXT, -- C-suite executive summary
    implementation_roadmap JSONB, -- Phased implementation plan
    estimated_roi JSONB, -- ROI projections for recommendations
    
    -- Persona-specific formatting
    persona_context JSONB, -- Who's reading (CMO, CEO, etc.)
    personalized_narrative TEXT, -- Narrative tailored to reader
    
    -- =====================================================
    -- DETAILED RESPONSE ANALYSIS
    -- =====================================================
    total_responses INTEGER,
    responses_analyzed INTEGER,
    response_details JSONB, -- Detailed analysis per response
    featured_snippet_potential_rate NUMERIC(5,2),
    voice_search_optimization_rate NUMERIC(5,2),
    
    -- =====================================================
    -- SEO & CONTENT INSIGHTS
    -- =====================================================
    content_gaps JSONB, -- Identified content gaps
    content_opportunities JSONB, -- Content creation opportunities
    keyword_performance JSONB, -- How brand performs for key terms
    seo_recommendations JSONB, -- Technical SEO improvements
    
    -- =====================================================
    -- INSIGHTS & TRENDS
    -- =====================================================
    key_insights JSONB, -- Top insights from analysis
    market_trends JSONB, -- Identified market trends
    opportunity_areas JSONB, -- Growth opportunities
    risk_areas JSONB, -- Areas of concern
    
    -- =====================================================
    -- AUDIT METADATA
    -- =====================================================
    audit_status VARCHAR(50) DEFAULT 'processing',
    audit_started_at TIMESTAMPTZ,
    audit_completed_at TIMESTAMPTZ,
    processing_time_seconds INTEGER,
    error_messages JSONB,
    audit_config JSONB, -- Configuration used for audit
    
    -- =====================================================
    -- TIMESTAMPS & VERSIONING
    -- =====================================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_version VARCHAR(20) DEFAULT 'v1.0',
    
    -- =====================================================
    -- INDEXES FOR PERFORMANCE
    -- =====================================================
    CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for fast queries
CREATE INDEX idx_dashboard_company_id ON dashboard_data(company_id);
CREATE INDEX idx_dashboard_user_id ON dashboard_data(user_id);
CREATE INDEX idx_dashboard_audit_id ON dashboard_data(audit_id);
CREATE INDEX idx_dashboard_created_at ON dashboard_data(created_at DESC);
CREATE INDEX idx_dashboard_overall_score ON dashboard_data(overall_score DESC);
CREATE INDEX idx_dashboard_status ON dashboard_data(audit_status);

-- GIN indexes for JSONB columns
CREATE INDEX idx_dashboard_competitors ON dashboard_data USING GIN(main_competitors);
CREATE INDEX idx_dashboard_recommendations ON dashboard_data USING GIN(top_recommendations);
CREATE INDEX idx_dashboard_provider_scores ON dashboard_data USING GIN(provider_scores);

-- =====================================================
-- HELPER VIEW FOR QUICK DASHBOARD ACCESS
-- =====================================================
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    d.id,
    d.audit_id,
    d.company_name,
    d.overall_score,
    d.geo_score,
    d.sov_score,
    d.brand_mention_rate,
    d.brand_sentiment,
    d.top_recommendations,
    d.executive_summary,
    d.audit_status,
    d.created_at,
    -- Calculate improvement potential
    CASE 
        WHEN d.overall_score < 40 THEN 'High'
        WHEN d.overall_score < 70 THEN 'Medium'
        ELSE 'Low'
    END as improvement_potential,
    -- Competitive position
    CASE
        WHEN d.sov_score > 60 THEN 'Market Leader'
        WHEN d.sov_score > 40 THEN 'Competitive'
        WHEN d.sov_score > 20 THEN 'Challenger'
        ELSE 'Needs Improvement'
    END as competitive_position
FROM dashboard_data d
WHERE d.audit_status = 'completed';

-- =====================================================
-- TRIGGER TO UPDATE updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_dashboard_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dashboard_data_timestamp
BEFORE UPDATE ON dashboard_data
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_data_updated_at();

-- =====================================================
-- FUNCTION TO POPULATE DASHBOARD DATA
-- Called after audit completion
-- =====================================================
CREATE OR REPLACE FUNCTION populate_dashboard_data(
    p_audit_id VARCHAR(255)
) RETURNS VOID AS $$
DECLARE
    v_company_id INTEGER;
    v_user_id INTEGER;
BEGIN
    -- This function will be called from Python after aggregation
    -- It consolidates all audit data into the dashboard_data table
    
    -- Get basic info
    SELECT company_id, user_id 
    INTO v_company_id, v_user_id
    FROM ai_visibility_audits 
    WHERE id = p_audit_id;
    
    -- Insert or update dashboard data
    INSERT INTO dashboard_data (
        audit_id,
        company_id,
        user_id,
        audit_status
    ) VALUES (
        p_audit_id,
        v_company_id,
        v_user_id,
        'populating'
    )
    ON CONFLICT (audit_id) 
    DO UPDATE SET
        audit_status = 'populating',
        updated_at = NOW();
        
    -- The actual population will be done from Python
    -- This just creates the record
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE QUERY FOR DASHBOARD API
-- =====================================================
COMMENT ON TABLE dashboard_data IS '
Sample API query for dashboard:

SELECT 
    company_name,
    overall_score,
    geo_score,
    sov_score,
    brand_mention_rate,
    brand_sentiment,
    top_recommendations,
    executive_summary,
    provider_scores,
    competitive_gaps,
    quick_wins,
    audit_completed_at
FROM dashboard_data
WHERE company_id = $1
  AND user_id = $2
  AND audit_status = ''completed''
ORDER BY created_at DESC
LIMIT 1;
';

-- Grant permissions (optional - create user first if needed)
-- GRANT SELECT ON dashboard_data TO dashboard_api_user;
-- GRANT SELECT ON dashboard_summary TO dashboard_api_user;