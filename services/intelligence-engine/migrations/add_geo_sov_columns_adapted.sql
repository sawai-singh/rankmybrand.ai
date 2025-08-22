-- Migration: Add GEO and SOV scoring columns (Adapted for actual schema)
-- Date: 2025-08-22
-- Purpose: Integrate GEO and SOV calculators into AI visibility workflow

-- =====================================================
-- 1. Add columns to ai_responses table (actual table name)
-- =====================================================

ALTER TABLE ai_responses 
ADD COLUMN IF NOT EXISTS geo_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS sov_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS context_completeness_score NUMERIC(5,2);

-- Add comments for documentation
COMMENT ON COLUMN ai_responses.geo_score IS 'Generative Engine Optimization score (0-100) for this specific response';
COMMENT ON COLUMN ai_responses.sov_score IS 'Share of Voice percentage (0-100) for brand vs competitors in this response';
COMMENT ON COLUMN ai_responses.context_completeness_score IS 'How completely brand information is conveyed (0-100)';

-- =====================================================
-- 2. Add columns to ai_visibility_reports table
-- =====================================================

ALTER TABLE ai_visibility_reports
ADD COLUMN IF NOT EXISTS geo_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS sov_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS context_completeness_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5,2);

-- Add comments
COMMENT ON COLUMN ai_visibility_reports.geo_score IS 'Overall GEO score averaged across all responses';
COMMENT ON COLUMN ai_visibility_reports.sov_score IS 'Overall Share of Voice averaged across all responses';
COMMENT ON COLUMN ai_visibility_reports.context_completeness_score IS 'Overall context completeness averaged across all responses';
COMMENT ON COLUMN ai_visibility_reports.overall_score IS 'Weighted overall score using enhanced formula';

-- =====================================================
-- 3. Create score_breakdown table for detailed tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS score_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES ai_visibility_reports(id) ON DELETE CASCADE,
    
    -- Component scores (all 0-100 scale)
    visibility NUMERIC(5,2),
    sentiment NUMERIC(5,2),
    recommendation NUMERIC(5,2),
    geo NUMERIC(5,2),
    sov NUMERIC(5,2),
    context_completeness NUMERIC(5,2),
    
    -- Overall weighted score
    overall NUMERIC(5,2),
    
    -- Metadata
    formula_version VARCHAR(50) DEFAULT 'v2_enhanced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one breakdown per report
    UNIQUE(report_id)
);

COMMENT ON TABLE score_breakdown IS 'Detailed breakdown of all scoring components for each report';

-- =====================================================
-- 4. Add provider-specific score tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_score_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES ai_visibility_reports(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    
    -- Provider-specific scores
    response_count INTEGER DEFAULT 0,
    avg_geo_score NUMERIC(5,2),
    avg_sov_score NUMERIC(5,2),
    avg_sentiment_score NUMERIC(5,2),
    visibility_rate NUMERIC(5,2),  -- Percentage of responses mentioning brand
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Composite key for unique provider per report
    UNIQUE(report_id, provider)
);

COMMENT ON TABLE provider_score_metrics IS 'Provider-specific performance metrics for each report';

-- =====================================================
-- 5. Create indexes for performance
-- =====================================================

-- Index for GEO and SOV queries
CREATE INDEX IF NOT EXISTS idx_ai_responses_geo_sov 
ON ai_responses(report_id, geo_score, sov_score)
WHERE geo_score IS NOT NULL OR sov_score IS NOT NULL;

-- Index for score breakdown queries
CREATE INDEX IF NOT EXISTS idx_score_breakdown_report 
ON score_breakdown(report_id);

-- Index for provider metrics
CREATE INDEX IF NOT EXISTS idx_provider_metrics_report 
ON provider_score_metrics(report_id, provider);

-- Index for finding low-scoring reports
CREATE INDEX IF NOT EXISTS idx_reports_low_scores
ON ai_visibility_reports(geo_score, sov_score)
WHERE geo_score < 50 OR sov_score < 30;

-- =====================================================
-- 6. Create helper functions
-- =====================================================

-- Function to calculate weighted overall score
CREATE OR REPLACE FUNCTION calculate_enhanced_overall_score(
    p_geo NUMERIC,
    p_sov NUMERIC,
    p_recommendation NUMERIC,
    p_sentiment NUMERIC,
    p_visibility NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
    -- Enhanced formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)
    RETURN ROUND((
        COALESCE(p_geo, 0) * 0.30 +
        COALESCE(p_sov, 0) * 0.25 +
        COALESCE(p_recommendation, 0) * 0.20 +
        COALESCE(p_sentiment, 0) * 0.15 +
        COALESCE(p_visibility, 0) * 0.10
    )::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get report score summary
CREATE OR REPLACE FUNCTION get_report_score_summary(p_report_id UUID)
RETURNS TABLE (
    metric_name VARCHAR,
    score NUMERIC,
    weight NUMERIC,
    weighted_contribution NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (VALUES
        ('GEO Score', 
         (SELECT geo_score FROM ai_visibility_reports WHERE id = p_report_id),
         0.30,
         (SELECT geo_score * 0.30 FROM ai_visibility_reports WHERE id = p_report_id)),
        ('Share of Voice',
         (SELECT sov_score FROM ai_visibility_reports WHERE id = p_report_id),
         0.25,
         (SELECT sov_score * 0.25 FROM ai_visibility_reports WHERE id = p_report_id)),
        ('Recommendation',
         (SELECT AVG(CASE 
            WHEN recommendation_strength = 'STRONG' THEN 100
            WHEN recommendation_strength = 'MODERATE' THEN 60
            WHEN recommendation_strength = 'WEAK' THEN 30
            ELSE 0 END)
          FROM ai_responses WHERE report_id = p_report_id),
         0.20,
         (SELECT AVG(CASE 
            WHEN recommendation_strength = 'STRONG' THEN 100
            WHEN recommendation_strength = 'MODERATE' THEN 60
            WHEN recommendation_strength = 'WEAK' THEN 30
            ELSE 0 END) * 0.20
          FROM ai_responses WHERE report_id = p_report_id)),
        ('Sentiment',
         (SELECT AVG(sentiment_score * 100) FROM ai_responses WHERE report_id = p_report_id),
         0.15,
         (SELECT AVG(sentiment_score * 100) * 0.15 FROM ai_responses WHERE report_id = p_report_id)),
        ('Visibility',
         (SELECT AVG(CASE WHEN brand_mentioned THEN 100 ELSE 0 END) 
          FROM ai_responses WHERE report_id = p_report_id),
         0.10,
         (SELECT AVG(CASE WHEN brand_mentioned THEN 100 ELSE 0 END) * 0.10
          FROM ai_responses WHERE report_id = p_report_id))
    ) AS t(metric_name, score, weight, weighted_contribution);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Create triggers for automatic updates
-- =====================================================

-- Trigger to update report scores when responses are analyzed
CREATE OR REPLACE FUNCTION update_report_aggregate_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_report_id VARCHAR;
    v_geo_avg NUMERIC;
    v_sov_avg NUMERIC;
    v_completeness_avg NUMERIC;
    v_overall NUMERIC;
BEGIN
    v_report_id := COALESCE(NEW.report_id, OLD.report_id);
    
    -- Calculate averages from all responses
    SELECT 
        AVG(geo_score),
        AVG(sov_score),
        AVG(context_completeness_score)
    INTO v_geo_avg, v_sov_avg, v_completeness_avg
    FROM ai_responses
    WHERE report_id = v_report_id
    AND geo_score IS NOT NULL;
    
    -- Calculate overall score using enhanced formula
    v_overall := calculate_enhanced_overall_score(
        v_geo_avg,
        v_sov_avg,
        (SELECT AVG(CASE 
            WHEN recommendation_strength = 'STRONG' THEN 100
            WHEN recommendation_strength = 'MODERATE' THEN 60
            WHEN recommendation_strength = 'WEAK' THEN 30
            ELSE 0 END)
         FROM ai_responses WHERE report_id = v_report_id),
        (SELECT AVG(sentiment_score * 100) FROM ai_responses WHERE report_id = v_report_id),
        (SELECT AVG(CASE WHEN brand_mentioned THEN 100 ELSE 0 END) 
         FROM ai_responses WHERE report_id = v_report_id)
    );
    
    -- Update report table
    UPDATE ai_visibility_reports
    SET 
        geo_score = v_geo_avg,
        sov_score = v_sov_avg,
        context_completeness_score = v_completeness_avg,
        overall_score = v_overall
    WHERE id = v_report_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ai_responses updates
DROP TRIGGER IF EXISTS trg_update_report_scores ON ai_responses;
CREATE TRIGGER trg_update_report_scores
AFTER INSERT OR UPDATE OF geo_score, sov_score, context_completeness_score
ON ai_responses
FOR EACH ROW
EXECUTE FUNCTION update_report_aggregate_scores();

-- =====================================================
-- 8. Grant permissions (adjust user as needed)
-- =====================================================

-- Grant appropriate permissions to application user
-- GRANT SELECT, INSERT, UPDATE ON score_breakdown TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON provider_score_metrics TO your_app_user;

-- =====================================================
-- Rollback script (if needed)
-- =====================================================
/*
-- To rollback this migration:
ALTER TABLE ai_responses 
DROP COLUMN IF EXISTS geo_score,
DROP COLUMN IF EXISTS sov_score,
DROP COLUMN IF EXISTS context_completeness_score;

ALTER TABLE ai_visibility_reports
DROP COLUMN IF EXISTS geo_score,
DROP COLUMN IF EXISTS sov_score,
DROP COLUMN IF EXISTS context_completeness_score,
DROP COLUMN IF EXISTS overall_score;

DROP TABLE IF EXISTS score_breakdown;
DROP TABLE IF EXISTS provider_score_metrics;
DROP FUNCTION IF EXISTS calculate_enhanced_overall_score;
DROP FUNCTION IF EXISTS get_report_score_summary;
DROP FUNCTION IF EXISTS update_report_aggregate_scores;
*/