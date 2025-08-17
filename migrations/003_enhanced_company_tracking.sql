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
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
    -- Original data (as fetched/generated)
    original_name VARCHAR(255),
    original_description TEXT,
    original_industry VARCHAR(100),
    original_keywords TEXT[],
    
    -- User-edited final versions
    final_name VARCHAR(255),
    final_description TEXT,
    final_industry VARCHAR(100),
    final_keywords TEXT[],
    
    -- Edit tracking
    user_edited BOOLEAN DEFAULT FALSE,
    edit_count INTEGER DEFAULT 0,
    first_edited_at TIMESTAMP,
    last_edited_at TIMESTAMP,
    edited_by_user_id INTEGER REFERENCES users(id),
    
    -- Journey metadata
    source_type VARCHAR(50), -- 'user_input', 'enrichment', 'ai_generated'
    confidence_score NUMERIC(3,2), -- How confident we are in the data
    data_completeness NUMERIC(3,2), -- Percentage of fields filled
    
    -- Version control
    version INTEGER DEFAULT 1,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    approved_by_user_id INTEGER REFERENCES users(id);

-- =====================================================
-- 2. Create company edit history table
-- =====================================================
CREATE TABLE IF NOT EXISTS company_edit_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    
    -- What was edited
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    
    -- Context
    edit_source VARCHAR(50), -- 'onboarding', 'dashboard', 'api', 'admin'
    edit_step VARCHAR(50), -- Which step in the journey
    edit_reason TEXT, -- Optional reason for edit
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_edit_history_company ON company_edit_history(company_id);
CREATE INDEX idx_edit_history_user ON company_edit_history(user_id);
CREATE INDEX idx_edit_history_created ON company_edit_history(created_at);

-- =====================================================
-- 3. Enhance onboarding_sessions with detailed tracking
-- =====================================================
ALTER TABLE onboarding_sessions ADD COLUMN IF NOT EXISTS
    -- Company data versions
    original_company_data JSONB, -- Data as initially provided/fetched
    edited_company_data JSONB,   -- User edits during onboarding
    final_company_data JSONB,    -- Final version submitted
    
    -- Description journey
    ai_generated_descriptions JSONB, -- Array of AI suggestions
    selected_description TEXT,        -- Which one user selected
    edited_description TEXT,          -- Final edited version
    description_edit_count INTEGER DEFAULT 0,
    
    -- Competitor journey
    suggested_competitors JSONB,      -- What we suggested
    user_added_competitors JSONB,     -- What user added manually
    removed_competitors JSONB,        -- What user removed
    final_competitors JSONB,          -- Final list
    
    -- User interaction tracking
    total_edits INTEGER DEFAULT 0,
    time_on_company_step INTEGER,     -- Seconds
    time_on_description_step INTEGER, -- Seconds
    time_on_competitor_step INTEGER,  -- Seconds
    
    -- Quality metrics
    data_quality_score NUMERIC(3,2),
    completeness_score NUMERIC(3,2);

-- =====================================================
-- 4. Create user journey analytics table
-- =====================================================
CREATE TABLE IF NOT EXISTS user_journey_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    company_id INTEGER REFERENCES companies(id),
    
    -- Journey stages
    journey_stage VARCHAR(50) NOT NULL,
    stage_started_at TIMESTAMP NOT NULL,
    stage_completed_at TIMESTAMP,
    time_spent_seconds INTEGER,
    
    -- Actions taken
    actions_taken JSONB, -- Array of actions with timestamps
    edits_made JSONB,    -- Detailed edit information
    
    -- Engagement metrics
    clicks_count INTEGER DEFAULT 0,
    form_submissions INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    
    -- Drop-off analysis
    dropped_off BOOLEAN DEFAULT FALSE,
    drop_off_reason VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journey_user ON user_journey_analytics(user_id);
CREATE INDEX idx_journey_session ON user_journey_analytics(session_id);
CREATE INDEX idx_journey_stage ON user_journey_analytics(journey_stage);

-- =====================================================
-- 5. Create company enrichment log
-- =====================================================
CREATE TABLE IF NOT EXISTS company_enrichment_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    
    -- Enrichment details
    enrichment_type VARCHAR(50), -- 'clearbit', 'apollo', 'manual', 'ai'
    enrichment_source VARCHAR(100),
    enrichment_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Data captured
    raw_response JSONB,           -- Raw API response
    extracted_data JSONB,          -- What we extracted
    confidence_scores JSONB,       -- Field-level confidence
    
    -- Quality metrics
    data_quality NUMERIC(3,2),
    fields_enriched INTEGER,
    fields_failed INTEGER,
    
    -- Cost tracking
    api_credits_used INTEGER,
    api_cost_usd NUMERIC(10,4),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enrichment_company ON company_enrichment_log(company_id);
CREATE INDEX idx_enrichment_timestamp ON company_enrichment_log(enrichment_timestamp);

-- =====================================================
-- 6. Create materialized view for admin dashboard
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_company_insights AS
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
    
    -- User information
    u.id as user_id,
    u.email as user_email,
    u.created_at as user_created_at,
    
    -- Onboarding journey
    os.session_id,
    os.current_step,
    os.completed as onboarding_completed,
    os.total_edits,
    os.time_on_company_step,
    os.time_on_description_step,
    os.time_on_competitor_step,
    os.data_quality_score,
    
    -- Edit statistics
    COUNT(DISTINCT ceh.id) as total_edit_events,
    MAX(ceh.created_at) as last_edited_at,
    
    -- Enrichment statistics
    COUNT(DISTINCT cel.id) as enrichment_attempts,
    MAX(cel.data_quality) as best_enrichment_quality,
    
    -- Journey analytics
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

CREATE UNIQUE INDEX idx_company_insights_company ON admin_company_insights(company_id);
CREATE INDEX idx_company_insights_user ON admin_company_insights(user_email);

-- =====================================================
-- 7. Create triggers for automatic tracking
-- =====================================================

-- Trigger to track edits automatically
CREATE OR REPLACE FUNCTION track_company_edit()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if key fields have changed
    IF OLD.name IS DISTINCT FROM NEW.name OR 
       OLD.description IS DISTINCT FROM NEW.description OR
       OLD.industry IS DISTINCT FROM NEW.industry THEN
       
        -- Update edit tracking fields
        NEW.user_edited := TRUE;
        NEW.edit_count := COALESCE(OLD.edit_count, 0) + 1;
        NEW.last_edited_at := CURRENT_TIMESTAMP;
        
        IF OLD.first_edited_at IS NULL THEN
            NEW.first_edited_at := CURRENT_TIMESTAMP;
        END IF;
        
        -- Store original values if not already stored
        IF OLD.original_name IS NULL AND OLD.name IS NOT NULL THEN
            NEW.original_name := OLD.name;
        END IF;
        
        IF OLD.original_description IS NULL AND OLD.description IS NOT NULL THEN
            NEW.original_description := OLD.description;
        END IF;
        
        -- Update final values
        NEW.final_name := NEW.name;
        NEW.final_description := NEW.description;
        
        -- Increment version
        NEW.version := COALESCE(OLD.version, 1) + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_company_edits ON companies;
CREATE TRIGGER track_company_edits
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION track_company_edit();

-- Trigger to log edit history
CREATE OR REPLACE FUNCTION log_company_edit_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Log name changes
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        INSERT INTO company_edit_history (
            company_id, field_name, old_value, new_value, edit_source
        ) VALUES (
            NEW.id, 'name', OLD.name, NEW.name, 'system'
        );
    END IF;
    
    -- Log description changes
    IF OLD.description IS DISTINCT FROM NEW.description THEN
        INSERT INTO company_edit_history (
            company_id, field_name, old_value, new_value, edit_source
        ) VALUES (
            NEW.id, 'description', OLD.description, NEW.description, 'system'
        );
    END IF;
    
    -- Log industry changes
    IF OLD.industry IS DISTINCT FROM NEW.industry THEN
        INSERT INTO company_edit_history (
            company_id, field_name, old_value, new_value, edit_source
        ) VALUES (
            NEW.id, 'industry', OLD.industry, NEW.industry, 'system'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_company_history ON companies;
CREATE TRIGGER log_company_history
    AFTER UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION log_company_edit_history();

-- =====================================================
-- 8. Create helper functions
-- =====================================================

-- Function to get complete company journey data
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

-- Function to calculate data completeness
CREATE OR REPLACE FUNCTION calculate_data_completeness(p_company_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    total_fields INTEGER := 20; -- Define important fields
    filled_fields INTEGER := 0;
    company_record RECORD;
BEGIN
    SELECT * INTO company_record FROM companies WHERE id = p_company_id;
    
    IF company_record.name IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.description IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.industry IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.logo_url IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.employee_count IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.founded_year IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.headquarters_city IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.linkedin_url IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.website_url IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF company_record.keywords IS NOT NULL AND array_length(company_record.keywords, 1) > 0 THEN 
        filled_fields := filled_fields + 1; 
    END IF;
    
    RETURN ROUND((filled_fields::NUMERIC / total_fields) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. Grant permissions
-- =====================================================
GRANT SELECT ON admin_company_insights TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON company_edit_history TO PUBLIC;
GRANT SELECT, INSERT ON company_enrichment_log TO PUBLIC;
GRANT SELECT, INSERT ON user_journey_analytics TO PUBLIC;

-- =====================================================
-- 10. Add comments for documentation
-- =====================================================
COMMENT ON TABLE company_edit_history IS 'Audit trail of all edits made to company information';
COMMENT ON TABLE company_enrichment_log IS 'Log of all enrichment attempts and their results';
COMMENT ON TABLE user_journey_analytics IS 'Detailed tracking of user journey through onboarding';
COMMENT ON MATERIALIZED VIEW admin_company_insights IS 'Aggregated view for admin dashboard with complete company journey data';

-- =====================================================
-- Refresh the materialized view
-- =====================================================
REFRESH MATERIALIZED VIEW admin_company_insights;

COMMIT;

-- =====================================================
-- Rollback script (if needed)
-- =====================================================
-- BEGIN;
-- DROP MATERIALIZED VIEW IF EXISTS admin_company_insights;
-- DROP TABLE IF EXISTS user_journey_analytics;
-- DROP TABLE IF EXISTS company_enrichment_log;
-- DROP TABLE IF EXISTS company_edit_history;
-- ALTER TABLE companies DROP COLUMN IF EXISTS original_name, ...;
-- ALTER TABLE onboarding_sessions DROP COLUMN IF EXISTS original_company_data, ...;
-- COMMIT;