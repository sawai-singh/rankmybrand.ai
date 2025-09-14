-- =====================================================
-- ENHANCED DASHBOARD DATA TABLE - Additional Columns
-- =====================================================

-- Add missing critical columns to dashboard_data table
ALTER TABLE dashboard_data 
-- Sentiment Metrics
ADD COLUMN IF NOT EXISTS avg_sentiment_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS sentiment_trend VARCHAR(20),

-- Competitor Deep Analysis
ADD COLUMN IF NOT EXISTS competitor_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS top_competitors JSONB, -- Top 5 with detailed metrics
ADD COLUMN IF NOT EXISTS competitor_sentiment_analysis JSONB,
ADD COLUMN IF NOT EXISTS competitive_position VARCHAR(50), -- leader/challenger/follower
ADD COLUMN IF NOT EXISTS market_share_vs_competitors JSONB,

-- Query Performance Metrics
ADD COLUMN IF NOT EXISTS best_performing_query_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS worst_performing_query_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS query_category_scores JSONB,

-- Provider Detailed Metrics
ADD COLUMN IF NOT EXISTS provider_consistency_scores JSONB, -- Variance in responses
ADD COLUMN IF NOT EXISTS provider_brand_accuracy JSONB, -- How accurately they represent brand

-- Trend Analysis (if historical data exists)
ADD COLUMN IF NOT EXISTS score_change_from_last_audit NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS trend_direction VARCHAR(20), -- up/down/stable
ADD COLUMN IF NOT EXISTS improvement_rate NUMERIC(5,2),

-- Response Quality Metrics
ADD COLUMN IF NOT EXISTS avg_response_length INTEGER,
ADD COLUMN IF NOT EXISTS response_quality_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS citation_rate NUMERIC(5,2), -- How often brand is cited as authority

-- Brand Strength Indicators
ADD COLUMN IF NOT EXISTS brand_authority_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS brand_trust_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS brand_expertise_mentions INTEGER,

-- Geographic & Demographic Insights
ADD COLUMN IF NOT EXISTS geo_coverage_map JSONB, -- Which regions mentioned
ADD COLUMN IF NOT EXISTS industry_specific_score NUMERIC(5,2),

-- Content & SEO Insights
ADD COLUMN IF NOT EXISTS content_type_performance JSONB, -- blog/video/whitepaper mentions
ADD COLUMN IF NOT EXISTS keyword_visibility JSONB,
ADD COLUMN IF NOT EXISTS schema_markup_recommendations JSONB,

-- Strategic Metrics
ADD COLUMN IF NOT EXISTS strategic_positioning_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS innovation_perception_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS thought_leadership_score NUMERIC(5,2),

-- Action Items & Timeline
ADD COLUMN IF NOT EXISTS immediate_actions JSONB, -- This week
ADD COLUMN IF NOT EXISTS month_1_priorities JSONB,
ADD COLUMN IF NOT EXISTS quarter_priorities JSONB,
ADD COLUMN IF NOT EXISTS estimated_improvement_potential NUMERIC(5,2),

-- Executive Insights
ADD COLUMN IF NOT EXISTS ceo_summary TEXT,
ADD COLUMN IF NOT EXISTS cmo_summary TEXT,
ADD COLUMN IF NOT EXISTS competitive_threats JSONB,
ADD COLUMN IF NOT EXISTS market_opportunities JSONB;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_dashboard_competitor_count ON dashboard_data(competitor_count);
CREATE INDEX IF NOT EXISTS idx_dashboard_sentiment_score ON dashboard_data(avg_sentiment_score);
CREATE INDEX IF NOT EXISTS idx_dashboard_competitive_position ON dashboard_data(competitive_position);
CREATE INDEX IF NOT EXISTS idx_dashboard_trend ON dashboard_data(trend_direction);

-- Update existing record with calculated values
UPDATE dashboard_data 
SET 
    -- Calculate average sentiment score
    avg_sentiment_score = (
        SELECT AVG(
            CASE 
                WHEN sentiment = 'positive' THEN 100
                WHEN sentiment = 'neutral' THEN 50
                WHEN sentiment = 'negative' THEN 0
                ELSE 50
            END
        ) 
        FROM ai_responses 
        WHERE audit_id = dashboard_data.audit_id
    ),
    
    -- Count competitors mentioned
    competitor_count = (
        SELECT COUNT(DISTINCT value->>'name')
        FROM ai_responses,
        LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(competitor_mentions) = 'array' 
                THEN competitor_mentions 
                ELSE '[]'::jsonb 
            END
        ) AS value
        WHERE audit_id = dashboard_data.audit_id
    ),
    
    -- Determine competitive position
    competitive_position = CASE
        WHEN sov_score > 60 THEN 'Leader'
        WHEN sov_score > 40 THEN 'Challenger'
        WHEN sov_score > 20 THEN 'Follower'
        ELSE 'Niche Player'
    END,
    
    -- Set trend (would need historical data)
    trend_direction = 'baseline', -- First audit, no trend yet
    
    updated_at = NOW()
WHERE audit_id = 'c157e1b8-ac73-4ee4-b093-2e8d69e52b88';

-- Extract competitor names from response texts
WITH competitor_extraction AS (
    SELECT 
        audit_id,
        ARRAY_AGG(DISTINCT competitor) AS competitors
    FROM (
        SELECT 
            audit_id,
            CASE 
                WHEN response_text LIKE '%McKinsey%' THEN 'McKinsey'
                WHEN response_text LIKE '%BCG%' THEN 'BCG'
                WHEN response_text LIKE '%Deloitte%' THEN 'Deloitte'
                WHEN response_text LIKE '%Accenture%' THEN 'Accenture'
                WHEN response_text LIKE '%PwC%' THEN 'PwC'
                WHEN response_text LIKE '%EY%' OR response_text LIKE '%Ernst%' THEN 'EY'
                WHEN response_text LIKE '%KPMG%' THEN 'KPMG'
                WHEN response_text LIKE '%Booz%' THEN 'Booz Allen'
                WHEN response_text LIKE '%Oliver Wyman%' THEN 'Oliver Wyman'
            END AS competitor
        FROM audit_responses
        WHERE audit_id = 'c157e1b8-ac73-4ee4-b093-2e8d69e52b88'
    ) AS comp_mentions
    WHERE competitor IS NOT NULL
    GROUP BY audit_id
)
UPDATE dashboard_data d
SET main_competitors = to_jsonb(ce.competitors)
FROM competitor_extraction ce
WHERE d.audit_id = ce.audit_id;