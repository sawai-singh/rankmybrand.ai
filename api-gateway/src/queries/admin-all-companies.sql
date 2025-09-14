-- WORKING QUERY FOR ADMIN ALL COMPANIES ENDPOINT
-- Created: 2025-08-31
-- Updated: 2025-09-01 - Changed to order by latest activity instead of creation date
-- This query successfully fetches all company data with proper JOINs to onboarding sessions
-- IMPORTANT: Do not modify without testing! This query is critical for the admin dashboard.

WITH latest_sessions AS (
  SELECT DISTINCT ON (COALESCE(company_data->>'domain', 
                               SUBSTRING(session_id FROM 'onboarding:[0-9]+:(.*)$')))
    *,
    COALESCE(company_data->>'domain', 
             SUBSTRING(session_id FROM 'onboarding:[0-9]+:(.*)$')) as extracted_domain
  FROM onboarding_sessions
  ORDER BY COALESCE(company_data->>'domain', 
                     SUBSTRING(session_id FROM 'onboarding:[0-9]+:(.*)$')), 
           created_at DESC
)
SELECT 
  c.id as company_id,
  c.name as company_name,
  c.domain,
  c.description as company_description,
  c.industry,
  c.created_at,
  c.latest_geo_score,
  c.user_edited,
  c.data_completeness,
  c.confidence_score,
  COALESCE(ls.email, u.email, c.created_by) as user_email,
  COALESCE(u.id, (SELECT id FROM users WHERE email = ls.email LIMIT 1)) as user_id,
  ls.session_id,
  ls.status as session_status,
  ls.created_at as session_started,
  ls.completed_at as session_completed,
  ls.original_company_data->>'name' as original_name,
  ls.edited_company_data->>'name' as current_name,
  ls.final_company_data->>'name' as final_name,
  ls.original_company_data->>'description' as original_description,
  ls.edited_company_data->>'description' as current_description,
  ls.final_company_data->>'description' as final_description,
  ls.original_company_data->>'industry' as original_industry,
  ls.final_company_data->>'industry' as final_industry,
  ls.total_edits as edit_count,
  ls.description_edit_count,
  jsonb_build_object(
    'suggested', ls.suggested_competitors,
    'added', ls.user_added_competitors,
    'removed', ls.removed_competitors,
    'final', ls.final_competitors
  ) as competitor_journey,
  ls.original_company_data,
  ls.edited_company_data,
  ls.final_company_data,
  ls.time_on_company_step,
  ls.time_on_description_step,
  ls.time_on_competitor_step,
  (SELECT COUNT(*) FROM ai_queries WHERE company_id = c.id) as query_count,
  ut.dashboard_ready,
  ut.dashboard_url,
  ut.email_sent,
  ud.dashboard_status,
  ud.dashboard_id,
  CASE 
    WHEN ut.dashboard_ready THEN 'Dashboard Ready'
    WHEN (SELECT COUNT(*) FROM ai_queries WHERE company_id = c.id) >= 48 THEN 'Queries Complete'
    WHEN (SELECT COUNT(*) FROM ai_queries WHERE company_id = c.id) > 0 THEN 'Generating Queries'
    WHEN c.id IS NOT NULL THEN 'Company Created'
    ELSE 'Onboarding'
  END as journey_status,
  -- Add a column to show the latest activity timestamp
  GREATEST(c.created_at, COALESCE(ls.created_at, c.created_at)) as latest_activity
FROM companies c
LEFT JOIN users u ON c.id = u.company_id
-- Join with the latest session for each domain
LEFT JOIN latest_sessions ls ON c.domain = ls.extracted_domain
LEFT JOIN user_tracking ut ON ut.email = COALESCE(ls.email, u.email, c.created_by) OR ut.company_id = c.id
LEFT JOIN user_dashboards ud ON ud.user_email = COALESCE(ls.email, u.email, c.created_by, ut.email)
WHERE c.id IS NOT NULL
ORDER BY GREATEST(c.created_at, COALESCE(ls.created_at, c.created_at)) DESC
LIMIT 200;