-- RankMyBrand Complete Database Schema
-- Tracks ALL user interactions, even incomplete onboarding

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User tracking table (stores EVERY email that enters the system)
CREATE TABLE IF NOT EXISTS user_tracking (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding sessions (tracks every onboarding attempt)
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'started', -- started, email_validated, company_enriched, competitors_selected, completed, abandoned
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    abandoned_at TIMESTAMP,
    time_spent_seconds INTEGER,
    steps_completed JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email) REFERENCES user_tracking(email)
);

-- Company information
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    description TEXT,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    employee_count INTEGER,
    headquarters VARCHAR(255),
    founded_year INTEGER,
    logo_url TEXT,
    website_url TEXT,
    enrichment_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (only for completed registrations)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'user',
    company_id INTEGER,
    onboarding_completed BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (email) REFERENCES user_tracking(email)
);

-- Competitors tracking
CREATE TABLE IF NOT EXISTS competitors (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    competitor_name VARCHAR(255),
    competitor_domain VARCHAR(255),
    discovered_method VARCHAR(50), -- manual, ai_suggested, crawler
    geo_score DECIMAL(5,2),
    share_of_voice DECIMAL(5,2),
    last_analyzed TIMESTAMP,
    analysis_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- GEO Analysis results
CREATE TABLE IF NOT EXISTS geo_analyses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER,
    analysis_type VARCHAR(50), -- instant, complete, scheduled
    overall_score DECIMAL(5,2),
    visibility_score DECIMAL(5,2),
    authority_score DECIMAL(5,2),
    relevance_score DECIMAL(5,2),
    platform_scores JSONB, -- {chatgpt: 75, claude: 80, etc}
    recommendations JSONB,
    raw_analysis JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Activity log (tracks EVERY action)
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    session_id UUID,
    action_type VARCHAR(100), -- page_view, button_click, form_submit, api_call, etc
    action_details JSONB,
    page_url TEXT,
    api_endpoint VARCHAR(255),
    response_status INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email validations (track every email validation attempt)
CREATE TABLE IF NOT EXISTS email_validations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    domain VARCHAR(255),
    is_valid BOOLEAN,
    is_business_email BOOLEAN,
    validation_method VARCHAR(50),
    mx_records JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    api_provider VARCHAR(50), -- openai, anthropic, perplexity, etc
    endpoint VARCHAR(255),
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),
    request_data JSONB,
    response_data JSONB,
    latency_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled jobs
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100),
    company_id INTEGER,
    schedule_cron VARCHAR(100),
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Create indexes for performance
CREATE INDEX idx_user_tracking_email ON user_tracking(email);
CREATE INDEX idx_user_tracking_last_activity ON user_tracking(last_activity);
CREATE INDEX idx_onboarding_sessions_email ON onboarding_sessions(email);
CREATE INDEX idx_onboarding_sessions_status ON onboarding_sessions(status);
CREATE INDEX idx_activity_log_user_email ON activity_log(user_email);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_geo_analyses_company_id ON geo_analyses(company_id);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);

-- Admin view to see all user interactions
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT 
    ut.email,
    ut.first_seen,
    ut.last_activity,
    os.status as onboarding_status,
    os.steps_completed,
    u.onboarding_completed,
    c.name as company_name,
    c.domain as company_domain,
    ga.overall_score as latest_geo_score,
    COUNT(DISTINCT al.id) as total_actions,
    COUNT(DISTINCT ev.id) as email_validation_attempts
FROM user_tracking ut
LEFT JOIN onboarding_sessions os ON ut.email = os.email
LEFT JOIN users u ON ut.email = u.email
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN geo_analyses ga ON c.id = ga.company_id
LEFT JOIN activity_log al ON ut.email = al.user_email
LEFT JOIN email_validations ev ON ut.email = ev.email
GROUP BY ut.email, ut.first_seen, ut.last_activity, os.status, 
         os.steps_completed, u.onboarding_completed, c.name, c.domain, ga.overall_score
ORDER BY ut.last_activity DESC;

-- Function to track user activity
CREATE OR REPLACE FUNCTION track_user_activity(
    p_email VARCHAR,
    p_action VARCHAR,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    -- Update last activity
    UPDATE user_tracking 
    SET last_activity = CURRENT_TIMESTAMP 
    WHERE email = p_email;
    
    -- Log the activity
    INSERT INTO activity_log (user_email, action_type, action_details, created_at)
    VALUES (p_email, p_action, p_details, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Sample query to see all data
-- SELECT * FROM admin_user_overview;