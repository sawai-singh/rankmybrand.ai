-- =====================================================
-- Migration: Session-based Journey View
-- Purpose: Track individual onboarding sessions/journeys
-- Author: RankMyBrand Product Architecture Team  
-- Date: 2025-08-17
-- =====================================================

BEGIN;

-- Create view for individual session journeys
CREATE OR REPLACE VIEW admin_session_journeys AS
SELECT 
    -- Session information
    os.session_id,
    os.email,
    os.status as session_status,
    os.created_at as session_started,
    os.completed_at as session_completed,
    os.last_activity,
    
    -- Company information (current state)
    c.id as company_id,
    c.domain,
    c.name as company_name,
    c.description as company_description,
    c.industry,
    c.latest_geo_score,
    
    -- Original vs Final data tracking
    c.original_name,
    c.original_description,
    c.original_industry,
    c.final_name,
    c.final_description,
    c.final_industry,
    
    -- Journey metadata
    c.user_edited,
    c.edit_count,
    c.data_completeness,
    c.confidence_score,
    
    -- Session-specific journey data
    os.original_company_data,
    os.edited_company_data,
    os.final_company_data,
    os.ai_generated_descriptions,
    os.selected_description,
    os.edited_description,
    os.description_edit_count,
    os.suggested_competitors,
    os.user_added_competitors,
    os.removed_competitors,
    os.final_competitors,
    
    -- Time tracking
    os.time_on_company_step,
    os.time_on_description_step,
    os.time_on_competitor_step,
    os.total_edits,
    
    -- Quality metrics
    os.data_quality_score,
    os.completeness_score,
    os.metadata,
    
    -- User information
    u.id as user_id,
    u.email as user_email,
    u.created_at as user_created_at,
    
    -- Activity summary
    (
        SELECT COUNT(*) 
        FROM activity_log al 
        WHERE al.session_id = os.session_id
    ) as activity_count,
    (
        SELECT json_agg(
            json_build_object(
                'action', al.action_type,
                'timestamp', al.created_at,
                'details', al.action_details
            ) ORDER BY al.created_at DESC
        )
        FROM activity_log al 
        WHERE al.session_id = os.session_id
    ) as activities,
    
    -- Enrichment attempts for this session
    (
        SELECT COUNT(*)
        FROM company_enrichment_log cel
        WHERE cel.company_id = c.id 
        AND cel.created_at >= os.created_at
        AND cel.created_at <= COALESCE(os.completed_at, CURRENT_TIMESTAMP)
    ) as enrichment_attempts,
    
    -- Edit history for this session
    (
        SELECT json_agg(
            json_build_object(
                'field', ceh.field_name,
                'old_value', ceh.old_value,
                'new_value', ceh.new_value,
                'timestamp', ceh.created_at
            ) ORDER BY ceh.created_at DESC
        )
        FROM company_edit_history ceh
        WHERE ceh.session_id = os.session_id
    ) as edit_history

FROM onboarding_sessions os
LEFT JOIN companies c ON c.domain = SPLIT_PART(os.email, '@', 2)
LEFT JOIN users u ON u.email = os.email
ORDER BY os.created_at DESC;

-- Grant permissions
GRANT SELECT ON admin_session_journeys TO PUBLIC;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_created_at 
ON onboarding_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_session_id 
ON activity_log(session_id);

COMMENT ON VIEW admin_session_journeys IS 'Individual session/journey tracking for admin dashboard - shows each onboarding attempt as a separate entry';

COMMIT;