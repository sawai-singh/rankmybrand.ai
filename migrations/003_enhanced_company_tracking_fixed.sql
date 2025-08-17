-- =====================================================
-- Migration: Enhanced Company Information Tracking
-- Purpose: Track original vs edited company data, user journey, and audit trail
-- Author: RankMyBrand Product Architecture Team
-- Date: 2025-08-17
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Enhance companies table with journey tracking
-- =====================================================
-- Add original data columns
ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS original_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS original_description TEXT,
    ADD COLUMN IF NOT EXISTS original_industry VARCHAR(100),
    ADD COLUMN IF NOT EXISTS original_keywords TEXT[];

-- Add user-edited final versions
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS final_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS final_description TEXT,
    ADD COLUMN IF NOT EXISTS final_industry VARCHAR(100),
    ADD COLUMN IF NOT EXISTS final_keywords TEXT[];

-- Add edit tracking columns
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS user_edited BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_edited_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS edited_by_user_id INTEGER REFERENCES users(id);

-- Add journey metadata
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2),
    ADD COLUMN IF NOT EXISTS data_completeness NUMERIC(3,2);

-- Add version control
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER REFERENCES users(id);

-- =====================================================
-- 2. Create company edit history table
-- =====================================================
CREATE TABLE IF NOT EXISTS company_edit_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    edit_source VARCHAR(50),
    edit_step VARCHAR(50),
    edit_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edit_history_company ON company_edit_history(company_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_user ON company_edit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_created ON company_edit_history(created_at);

-- =====================================================
-- 3. Enhance onboarding_sessions with detailed tracking
-- =====================================================
-- Add company data version tracking
ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS original_company_data JSONB,
    ADD COLUMN IF NOT EXISTS edited_company_data JSONB,
    ADD COLUMN IF NOT EXISTS final_company_data JSONB;

-- Add description journey tracking
ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS ai_generated_descriptions JSONB,
    ADD COLUMN IF NOT EXISTS selected_description TEXT,
    ADD COLUMN IF NOT EXISTS edited_description TEXT,
    ADD COLUMN IF NOT EXISTS description_edit_count INTEGER DEFAULT 0;

-- Add competitor journey tracking
ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS suggested_competitors JSONB,
    ADD COLUMN IF NOT EXISTS user_added_competitors JSONB,
    ADD COLUMN IF NOT EXISTS removed_competitors JSONB,
    ADD COLUMN IF NOT EXISTS final_competitors JSONB;

-- Add user interaction tracking
ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS total_edits INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_on_company_step INTEGER,
    ADD COLUMN IF NOT EXISTS time_on_description_step INTEGER,
    ADD COLUMN IF NOT EXISTS time_on_competitor_step INTEGER;

-- Add quality metrics
ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS data_quality_score NUMERIC(3,2),
    ADD COLUMN IF NOT EXISTS completeness_score NUMERIC(3,2);

-- =====================================================
-- 4. Create user journey analytics table
-- =====================================================
CREATE TABLE IF NOT EXISTS user_journey_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    company_id INTEGER REFERENCES companies(id),
    journey_stage VARCHAR(50) NOT NULL,
    stage_started_at TIMESTAMP NOT NULL,
    stage_completed_at TIMESTAMP,
    time_spent_seconds INTEGER,
    actions_taken JSONB,
    edits_made JSONB,
    clicks_count INTEGER DEFAULT 0,
    form_submissions INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    dropped_off BOOLEAN DEFAULT FALSE,
    drop_off_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journey_user ON user_journey_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_session ON user_journey_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_journey_stage ON user_journey_analytics(journey_stage);

-- =====================================================
-- 5. Create company enrichment log
-- =====================================================
CREATE TABLE IF NOT EXISTS company_enrichment_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    enrichment_type VARCHAR(50),
    enrichment_source VARCHAR(100),
    enrichment_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_response JSONB,
    extracted_data JSONB,
    confidence_scores JSONB,
    data_quality NUMERIC(3,2),
    fields_enriched INTEGER,
    fields_failed INTEGER,
    api_credits_used INTEGER,
    api_cost_usd NUMERIC(10,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrichment_company ON company_enrichment_log(company_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_timestamp ON company_enrichment_log(enrichment_timestamp);

-- =====================================================
-- 6. Create view for admin dashboard
-- =====================================================
CREATE OR REPLACE VIEW admin_company_insights AS
SELECT 
    c.id as company_id,
    c.domain,
    c.name as current_name,
    c.original_name,
    c.final_name,
    c.description as current_description,
    c.original_description,
    c.final_description,
    c.user_edited,
    c.edit_count,
    c.data_completeness,
    c.latest_geo_score,
    u.id as user_id,
    u.email as user_email,
    u.created_at as user_created_at,
    os.session_id,
    os.current_step,
    os.completed as onboarding_completed,
    os.total_edits,
    os.time_on_company_step,
    os.time_on_description_step,
    os.time_on_competitor_step,
    os.data_quality_score,
    COUNT(DISTINCT ceh.id) as total_edit_events,
    MAX(ceh.created_at) as last_edited_at,
    COUNT(DISTINCT cel.id) as enrichment_attempts,
    MAX(cel.data_quality) as best_enrichment_quality,
    COUNT(DISTINCT uja.id) as journey_stages_tracked,
    SUM(uja.time_spent_seconds) as total_journey_time
FROM companies c
LEFT JOIN users u ON u.company_id = c.id
LEFT JOIN onboarding_sessions os ON os.email = u.email
LEFT JOIN company_edit_history ceh ON ceh.company_id = c.id
LEFT JOIN company_enrichment_log cel ON cel.company_id = c.id
LEFT JOIN user_journey_analytics uja ON uja.company_id = c.id
GROUP BY 
    c.id, c.domain, c.name, c.original_name, c.final_name,
    c.description, c.original_description, c.final_description,
    c.user_edited, c.edit_count, c.data_completeness, c.latest_geo_score,
    u.id, u.email, u.created_at,
    os.session_id, os.current_step, os.completed, os.total_edits,
    os.time_on_company_step, os.time_on_description_step, 
    os.time_on_competitor_step, os.data_quality_score;

-- =====================================================
-- 7. Create function to get complete company journey
-- =====================================================
CREATE OR REPLACE FUNCTION get_company_journey(p_company_id INTEGER)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'company', row_to_json(c.*),
        'edits', (
            SELECT json_agg(row_to_json(e.*))
            FROM company_edit_history e
            WHERE e.company_id = p_company_id
            ORDER BY e.created_at DESC
        ),
        'enrichments', (
            SELECT json_agg(row_to_json(en.*))
            FROM company_enrichment_log en
            WHERE en.company_id = p_company_id
            ORDER BY en.created_at DESC
        ),
        'journey_stages', (
            SELECT json_agg(row_to_json(j.*))
            FROM user_journey_analytics j
            WHERE j.company_id = p_company_id
            ORDER BY j.created_at
        )
    ) INTO result
    FROM companies c
    WHERE c.id = p_company_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Grant permissions
-- =====================================================
GRANT SELECT ON admin_company_insights TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON company_edit_history TO PUBLIC;
GRANT SELECT, INSERT ON company_enrichment_log TO PUBLIC;
GRANT SELECT, INSERT ON user_journey_analytics TO PUBLIC;

-- =====================================================
-- 9. Add comments for documentation
-- =====================================================
COMMENT ON TABLE company_edit_history IS 'Audit trail of all edits made to company information';
COMMENT ON TABLE company_enrichment_log IS 'Log of all enrichment attempts and their results';
COMMENT ON TABLE user_journey_analytics IS 'Detailed tracking of user journey through onboarding';
COMMENT ON VIEW admin_company_insights IS 'Aggregated view for admin dashboard with complete company journey data';

COMMIT;