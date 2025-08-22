-- Migration: Add GEO and SOV scoring columns
-- Date: 2025-08-22
-- Purpose: Integrate GEO and SOV calculators into AI visibility workflow

-- =====================================================
-- 1. Add columns to audit_responses table
-- =====================================================

ALTER TABLE audit_responses 
ADD COLUMN IF NOT EXISTS geo_score FLOAT,
ADD COLUMN IF NOT EXISTS sov_score FLOAT,
ADD COLUMN IF NOT EXISTS context_completeness_score FLOAT;

-- Add comments for documentation
COMMENT ON COLUMN audit_responses.geo_score IS 'Generative Engine Optimization score (0-100) for this specific response';
COMMENT ON COLUMN audit_responses.sov_score IS 'Share of Voice percentage (0-100) for brand vs competitors in this response';
COMMENT ON COLUMN audit_responses.context_completeness_score IS 'How completely brand information is conveyed (0-100)';

-- =====================================================
-- 2. Add columns to ai_visibility_audits table
-- =====================================================

ALTER TABLE ai_visibility_audits
ADD COLUMN IF NOT EXISTS geo_score FLOAT,
ADD COLUMN IF NOT EXISTS sov_score FLOAT,
ADD COLUMN IF NOT EXISTS context_completeness_score FLOAT;

-- Add comments
COMMENT ON COLUMN ai_visibility_audits.geo_score IS 'Overall GEO score averaged across all responses';
COMMENT ON COLUMN ai_visibility_audits.sov_score IS 'Overall Share of Voice averaged across all responses';
COMMENT ON COLUMN ai_visibility_audits.context_completeness_score IS 'Overall context completeness averaged across all responses';

-- =====================================================
-- 3. Create audit_score_breakdown table for detailed tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_score_breakdown (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    
    -- Component scores (all 0-100 scale)
    visibility FLOAT,
    sentiment FLOAT,
    recommendation FLOAT,
    geo FLOAT,
    sov FLOAT,
    context_completeness FLOAT,
    
    -- Overall weighted score
    overall FLOAT,
    
    -- Metadata
    formula_version VARCHAR(50) DEFAULT 'v2_enhanced',
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one breakdown per audit
    UNIQUE(audit_id)
);

COMMENT ON TABLE audit_score_breakdown IS 'Detailed breakdown of all scoring components for each audit';

-- =====================================================
-- 4. Add provider-specific score tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_score_metrics (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    
    -- Provider-specific scores
    response_count INTEGER DEFAULT 0,
    avg_geo_score FLOAT,
    avg_sov_score FLOAT,
    avg_sentiment_score FLOAT,
    visibility_rate FLOAT,  -- Percentage of responses mentioning brand
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite key for unique provider per audit
    UNIQUE(audit_id, provider)
);

COMMENT ON TABLE provider_score_metrics IS 'Provider-specific performance metrics for each audit';

-- =====================================================
-- 5. Create indexes for performance
-- =====================================================

-- Index for GEO and SOV queries
CREATE INDEX IF NOT EXISTS idx_audit_responses_geo_sov 
ON audit_responses(audit_id, geo_score, sov_score)
WHERE geo_score IS NOT NULL OR sov_score IS NOT NULL;

-- Index for score breakdown queries
CREATE INDEX IF NOT EXISTS idx_audit_score_breakdown_audit 
ON audit_score_breakdown(audit_id);

-- Index for provider metrics
CREATE INDEX IF NOT EXISTS idx_provider_metrics_audit 
ON provider_score_metrics(audit_id, provider);

-- Index for finding low-scoring audits
CREATE INDEX IF NOT EXISTS idx_audits_low_scores
ON ai_visibility_audits(geo_score, sov_score)
WHERE geo_score < 50 OR sov_score < 30;

-- =====================================================
-- 6. Create helper functions
-- =====================================================

-- Function to calculate weighted overall score
CREATE OR REPLACE FUNCTION calculate_enhanced_overall_score(
    p_geo FLOAT,
    p_sov FLOAT,
    p_recommendation FLOAT,
    p_sentiment FLOAT,
    p_visibility FLOAT
) RETURNS FLOAT AS $$
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

-- Function to get audit score summary
CREATE OR REPLACE FUNCTION get_audit_score_summary(p_audit_id VARCHAR)
RETURNS TABLE (
    metric_name VARCHAR,
    score FLOAT,
    weight FLOAT,
    weighted_contribution FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (VALUES
        ('GEO Score', 
         (SELECT geo_score FROM ai_visibility_audits WHERE id = p_audit_id),
         0.30,
         (SELECT geo_score * 0.30 FROM ai_visibility_audits WHERE id = p_audit_id)),
        ('Share of Voice',
         (SELECT sov_score FROM ai_visibility_audits WHERE id = p_audit_id),
         0.25,
         (SELECT sov_score * 0.25 FROM ai_visibility_audits WHERE id = p_audit_id)),
        ('Recommendation',
         (SELECT recommendation_score FROM ai_visibility_audits WHERE id = p_audit_id),
         0.20,
         (SELECT recommendation_score * 0.20 FROM ai_visibility_audits WHERE id = p_audit_id)),
        ('Sentiment',
         (SELECT sentiment_score FROM ai_visibility_audits WHERE id = p_audit_id),
         0.15,
         (SELECT sentiment_score * 0.15 FROM ai_visibility_audits WHERE id = p_audit_id)),
        ('Visibility',
         (SELECT brand_mention_rate FROM ai_visibility_audits WHERE id = p_audit_id),
         0.10,
         (SELECT brand_mention_rate * 0.10 FROM ai_visibility_audits WHERE id = p_audit_id))
    ) AS t(metric_name, score, weight, weighted_contribution);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Create materialized view for analytics
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS audit_score_analytics AS
SELECT 
    DATE_TRUNC('day', a.created_at) as audit_date,
    COUNT(*) as audit_count,
    AVG(a.overall_score) as avg_overall_score,
    AVG(a.geo_score) as avg_geo_score,
    AVG(a.sov_score) as avg_sov_score,
    AVG(a.sentiment_score) as avg_sentiment,
    AVG(a.brand_mention_rate) as avg_visibility,
    
    -- Score distribution
    COUNT(*) FILTER (WHERE a.overall_score >= 80) as excellent_count,
    COUNT(*) FILTER (WHERE a.overall_score >= 60 AND a.overall_score < 80) as good_count,
    COUNT(*) FILTER (WHERE a.overall_score >= 40 AND a.overall_score < 60) as moderate_count,
    COUNT(*) FILTER (WHERE a.overall_score < 40) as poor_count,
    
    -- Identify problematic areas
    COUNT(*) FILTER (WHERE a.geo_score < 40) as low_geo_count,
    COUNT(*) FILTER (WHERE a.sov_score < 30) as low_sov_count
    
FROM ai_visibility_audits a
WHERE a.status = 'completed'
GROUP BY DATE_TRUNC('day', a.created_at)
ORDER BY audit_date DESC;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_audit_analytics_date ON audit_score_analytics(audit_date);

-- =====================================================
-- 8. Create triggers for automatic updates
-- =====================================================

-- Trigger to update audit scores when responses are analyzed
CREATE OR REPLACE FUNCTION update_audit_aggregate_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_audit_id VARCHAR;
    v_geo_avg FLOAT;
    v_sov_avg FLOAT;
    v_completeness_avg FLOAT;
BEGIN
    v_audit_id := COALESCE(NEW.audit_id, OLD.audit_id);
    
    -- Calculate averages from all responses
    SELECT 
        AVG(geo_score),
        AVG(sov_score),
        AVG(context_completeness_score)
    INTO v_geo_avg, v_sov_avg, v_completeness_avg
    FROM audit_responses
    WHERE audit_id = v_audit_id
    AND geo_score IS NOT NULL;
    
    -- Update audit table
    UPDATE ai_visibility_audits
    SET 
        geo_score = v_geo_avg,
        sov_score = v_sov_avg,
        context_completeness_score = v_completeness_avg
    WHERE id = v_audit_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit_responses updates
DROP TRIGGER IF EXISTS trg_update_audit_scores ON audit_responses;
CREATE TRIGGER trg_update_audit_scores
AFTER INSERT OR UPDATE OF geo_score, sov_score, context_completeness_score
ON audit_responses
FOR EACH ROW
EXECUTE FUNCTION update_audit_aggregate_scores();

-- =====================================================
-- 9. Populate historical data (if needed)
-- =====================================================

-- This would calculate GEO and SOV for existing audits
-- Only run if you want to backfill historical data
-- UPDATE audit_responses SET geo_score = 50, sov_score = 50 WHERE geo_score IS NULL;

-- =====================================================
-- 10. Grant permissions
-- =====================================================

-- Grant appropriate permissions to application user
-- GRANT SELECT, INSERT, UPDATE ON audit_score_breakdown TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON provider_score_metrics TO your_app_user;
-- GRANT SELECT ON audit_score_analytics TO your_app_user;

-- =====================================================
-- Rollback script (if needed)
-- =====================================================
/*
-- To rollback this migration:
ALTER TABLE audit_responses 
DROP COLUMN IF EXISTS geo_score,
DROP COLUMN IF EXISTS sov_score,
DROP COLUMN IF EXISTS context_completeness_score;

ALTER TABLE ai_visibility_audits
DROP COLUMN IF EXISTS geo_score,
DROP COLUMN IF EXISTS sov_score,
DROP COLUMN IF EXISTS context_completeness_score;

DROP TABLE IF EXISTS audit_score_breakdown;
DROP TABLE IF EXISTS provider_score_metrics;
DROP MATERIALIZED VIEW IF EXISTS audit_score_analytics;
DROP FUNCTION IF EXISTS calculate_enhanced_overall_score;
DROP FUNCTION IF EXISTS get_audit_score_summary;
DROP FUNCTION IF EXISTS update_audit_aggregate_scores;
*/