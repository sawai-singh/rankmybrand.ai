-- Migration: Create user dashboard tracking tables
-- Purpose: Track dashboard URLs and status for each user

-- Create user_dashboards table
CREATE TABLE IF NOT EXISTS user_dashboards (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  company_id INTEGER REFERENCES companies(id),
  dashboard_id VARCHAR(255) UNIQUE NOT NULL,
  dashboard_url TEXT NOT NULL,
  dashboard_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP,
  access_count INTEGER DEFAULT 0
);

-- Add dashboard tracking columns to user_tracking
ALTER TABLE user_tracking 
ADD COLUMN IF NOT EXISTS dashboard_ready BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dashboard_ready_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS dashboard_url TEXT,
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_dashboards_email ON user_dashboards(user_email);
CREATE INDEX IF NOT EXISTS idx_user_dashboards_dashboard_id ON user_dashboards(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboards_status ON user_dashboards(dashboard_status);
CREATE INDEX IF NOT EXISTS idx_user_tracking_dashboard_ready ON user_tracking(dashboard_ready);

-- Create view for admin dashboard to see user journey with dashboard status
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
    END as journey_status
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

-- Function to automatically create dashboard after queries are generated
CREATE OR REPLACE FUNCTION auto_create_dashboard()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id INTEGER;
    v_user_email VARCHAR(255);
    v_dashboard_id VARCHAR(255);
    v_dashboard_url TEXT;
BEGIN
    -- Get company ID from the new query
    v_company_id := NEW.company_id;
    
    -- Get user email associated with this company
    SELECT email INTO v_user_email
    FROM user_tracking
    WHERE company_id = v_company_id
    LIMIT 1;
    
    IF v_user_email IS NOT NULL THEN
        -- Check if we have enough queries (at least 40)
        IF (SELECT COUNT(*) FROM ai_queries WHERE company_id = v_company_id) >= 40 THEN
            -- Check if dashboard doesn't already exist
            IF NOT EXISTS (SELECT 1 FROM user_dashboards WHERE user_email = v_user_email) THEN
                -- Generate dashboard ID and URL
                v_dashboard_id := md5(v_user_email || v_company_id || NOW()::text);
                v_dashboard_url := 'http://localhost:3000/dashboard/' || v_dashboard_id;
                
                -- Create dashboard entry
                INSERT INTO user_dashboards (user_email, company_id, dashboard_id, dashboard_url, dashboard_status)
                VALUES (v_user_email, v_company_id, v_dashboard_id, v_dashboard_url, 'active')
                ON CONFLICT (user_email) DO NOTHING;
                
                -- Update user tracking
                UPDATE user_tracking 
                SET dashboard_ready = true, 
                    dashboard_ready_at = CURRENT_TIMESTAMP,
                    dashboard_url = v_dashboard_url
                WHERE email = v_user_email;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create dashboard when queries are generated
DROP TRIGGER IF EXISTS trigger_auto_create_dashboard ON ai_queries;
CREATE TRIGGER trigger_auto_create_dashboard
AFTER INSERT ON ai_queries
FOR EACH ROW
EXECUTE FUNCTION auto_create_dashboard();

-- Add comments for documentation
COMMENT ON TABLE user_dashboards IS 'Stores unique dashboard URLs and status for each user';
COMMENT ON COLUMN user_dashboards.dashboard_status IS 'Status: pending, active, suspended, archived';
COMMENT ON COLUMN user_tracking.dashboard_ready IS 'Indicates if user dashboard is fully generated and ready';
COMMENT ON COLUMN user_tracking.email_sent IS 'Tracks if dashboard link email has been sent to user';