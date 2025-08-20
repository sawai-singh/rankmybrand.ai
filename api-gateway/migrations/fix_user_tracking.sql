-- Fix user_tracking table to include company_id

-- Add company_id column to user_tracking if it doesn't exist
ALTER TABLE user_tracking 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- Add missing columns
ALTER TABLE user_tracking
ADD COLUMN IF NOT EXISTS first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0;

-- Update company_id for existing users based on onboarding_sessions
UPDATE user_tracking ut
SET company_id = os.company_id
FROM onboarding_sessions os
WHERE ut.email = os.email
AND ut.company_id IS NULL;

-- Create or replace the view with correct joins
CREATE OR REPLACE VIEW user_journey_complete AS
SELECT 
    ut.email,
    ut.first_visit,
    ut.last_activity,
    ut.page_views,
    ut.dashboard_ready,
    ut.dashboard_ready_at,
    ut.email_sent,
    ut.email_sent_at,
    c.id as company_id,
    c.name as company_name,
    c.domain as company_domain,
    c.industry,
    COUNT(DISTINCT aq.id) as query_count,
    COUNT(DISTINCT comp.id) as competitor_count,
    ud.dashboard_url,
    ud.dashboard_status,
    ud.dashboard_id,
    ud.last_accessed,
    ud.access_count,
    CASE 
        WHEN ut.dashboard_ready THEN 'Dashboard Ready'
        WHEN COUNT(aq.id) > 0 THEN 'Queries Generated'
        WHEN c.id IS NOT NULL THEN 'Company Created'
        ELSE 'Onboarding Started'
    END as journey_status,
    CASE
        WHEN COUNT(aq.id) >= 48 THEN 'Complete'
        WHEN COUNT(aq.id) > 0 THEN 'Partial'
        ELSE 'Pending'
    END as query_generation_status
FROM user_tracking ut
LEFT JOIN companies c ON ut.company_id = c.id
LEFT JOIN ai_queries aq ON c.id = aq.company_id
LEFT JOIN competitors comp ON c.id = comp.company_id
LEFT JOIN user_dashboards ud ON ut.email = ud.user_email
GROUP BY 
    ut.email, ut.first_visit, ut.last_activity, ut.page_views,
    ut.dashboard_ready, ut.dashboard_ready_at, ut.email_sent, ut.email_sent_at,
    c.id, c.name, c.domain, c.industry,
    ud.dashboard_url, ud.dashboard_status, ud.dashboard_id, ud.last_accessed, ud.access_count
ORDER BY ut.last_activity DESC;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_tracking_company_id ON user_tracking(company_id);