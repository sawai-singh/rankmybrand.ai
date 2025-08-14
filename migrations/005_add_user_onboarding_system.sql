-- Migration: 005_add_user_onboarding_system.sql
-- Description: Complete user management and onboarding system tables
-- Author: RankMyBrand Engineering
-- Date: 2024

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    work_email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255), -- For traditional auth
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    magic_link_token VARCHAR(255),
    magic_link_expires TIMESTAMP,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Company association
    company_id INTEGER,
    role VARCHAR(50) DEFAULT 'user', -- user, admin, enterprise
    
    -- Subscription
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
    subscription_expires TIMESTAMP,
    trial_ends TIMESTAMP,
    
    -- Metadata
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_completed_at TIMESTAMP,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    
    -- Tracking
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    referrer TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_work_email ON users(work_email);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_magic_link ON users(magic_link_token);
CREATE INDEX idx_users_verification ON users(email_verification_token);

-- =====================================================
-- COMPANIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    description TEXT,
    
    -- Enrichment data
    industry VARCHAR(100),
    sub_industry VARCHAR(100),
    company_size VARCHAR(50), -- 1-10, 11-50, 51-200, etc.
    employee_count INTEGER,
    founded_year INTEGER,
    
    -- Location
    headquarters_city VARCHAR(100),
    headquarters_state VARCHAR(100),
    headquarters_country VARCHAR(100),
    headquarters_address TEXT,
    
    -- Social profiles
    linkedin_url TEXT,
    twitter_url TEXT,
    facebook_url TEXT,
    instagram_url TEXT,
    youtube_url TEXT,
    
    -- Technology stack
    tech_stack TEXT[],
    
    -- Enrichment metadata
    enrichment_source VARCHAR(50), -- clearbit, hunter, apollo, manual, crawler
    enrichment_data JSONB, -- Raw enrichment response
    enrichment_confidence DECIMAL(3,2), -- 0.00 to 1.00
    enrichment_date TIMESTAMP,
    
    -- Analysis data
    latest_geo_score DECIMAL(5,2),
    latest_geo_analysis_id INTEGER,
    latest_analysis_date TIMESTAMP,
    
    -- Company metadata
    tags TEXT[],
    keywords TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_industry ON companies(industry);

-- =====================================================
-- ONBOARDING_SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session data
    email VARCHAR(255) NOT NULL,
    current_step VARCHAR(50) DEFAULT 'email', -- email, company, description, competitors, complete
    
    -- Progress tracking
    email_validated BOOLEAN DEFAULT FALSE,
    email_validated_at TIMESTAMP,
    
    company_enriched BOOLEAN DEFAULT FALSE,
    company_enriched_at TIMESTAMP,
    company_data JSONB,
    
    description_generated BOOLEAN DEFAULT FALSE,
    description_generated_at TIMESTAMP,
    description_text TEXT,
    
    competitors_selected BOOLEAN DEFAULT FALSE,
    competitors_selected_at TIMESTAMP,
    
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    
    -- Tracking
    time_spent_seconds INTEGER DEFAULT 0,
    abandonment_reason VARCHAR(255),
    
    -- Analysis jobs
    geo_analysis_job_id VARCHAR(255),
    crawl_job_id VARCHAR(255),
    search_analysis_job_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX idx_onboarding_session_id ON onboarding_sessions(session_id);
CREATE INDEX idx_onboarding_user_id ON onboarding_sessions(user_id);
CREATE INDEX idx_onboarding_email ON onboarding_sessions(email);
CREATE INDEX idx_onboarding_expires ON onboarding_sessions(expires_at);

-- =====================================================
-- COMPETITORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS competitors (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Competitor info
    competitor_name VARCHAR(255) NOT NULL,
    competitor_domain VARCHAR(255) NOT NULL,
    competitor_company_id INTEGER REFERENCES companies(id), -- If they're also a customer
    
    -- Discovery metadata
    discovery_source VARCHAR(50), -- serp, manual, industry_db, ai_inference
    discovery_reason TEXT,
    similarity_score DECIMAL(3,2), -- 0.00 to 1.00
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Tracking
    is_active BOOLEAN DEFAULT TRUE,
    added_by_user_id INTEGER REFERENCES users(id),
    
    -- Analysis
    latest_geo_score DECIMAL(5,2),
    latest_analysis_date TIMESTAMP,
    score_difference DECIMAL(5,2), -- Our score minus theirs
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(company_id, competitor_domain)
);

-- Indexes
CREATE INDEX idx_competitors_company ON competitors(company_id);
CREATE INDEX idx_competitors_domain ON competitors(competitor_domain);
CREATE INDEX idx_competitors_active ON competitors(is_active);

-- =====================================================
-- USER_SESSIONS TABLE (for JWT/Auth)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50), -- desktop, mobile, tablet
    browser VARCHAR(50),
    os VARCHAR(50),
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_refresh ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_active ON user_sessions(is_active, expires_at);

-- =====================================================
-- ANALYSIS_HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS analysis_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    
    -- Analysis type
    analysis_type VARCHAR(50) NOT NULL, -- geo, crawl, search, complete
    
    -- Results
    geo_score DECIMAL(5,2),
    share_of_voice DECIMAL(5,2),
    sentiment_positive DECIMAL(5,2),
    sentiment_neutral DECIMAL(5,2),
    sentiment_negative DECIMAL(5,2),
    
    -- Platform scores
    chatgpt_score DECIMAL(5,2),
    claude_score DECIMAL(5,2),
    perplexity_score DECIMAL(5,2),
    gemini_score DECIMAL(5,2),
    bing_score DECIMAL(5,2),
    
    -- Raw data
    raw_data JSONB,
    insights TEXT[],
    recommendations TEXT[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_analysis_company ON analysis_history(company_id);
CREATE INDEX idx_analysis_user ON analysis_history(user_id);
CREATE INDEX idx_analysis_type ON analysis_history(analysis_type);
CREATE INDEX idx_analysis_date ON analysis_history(created_at);

-- =====================================================
-- USER_NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL, -- email, in_app, push
    category VARCHAR(50) NOT NULL, -- onboarding, analysis, competitor, alert
    
    subject VARCHAR(255),
    message TEXT,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notifications_unread ON user_notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON user_notifications(type, category);

-- =====================================================
-- AUDIT_LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    
    old_value JSONB,
    new_value JSONB,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at BEFORE UPDATE ON competitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA (for testing)
-- =====================================================

-- Insert demo user (password: demo123)
INSERT INTO users (email, work_email, first_name, last_name, role, email_verified)
VALUES ('demo@rankmybrand.ai', 'demo@company.com', 'Demo', 'User', 'user', true)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- PERMISSIONS (if using row-level security)
-- =====================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- Policies (users can only see their own data)
CREATE POLICY users_policy ON users
    FOR ALL USING (id = current_setting('app.user_id')::INTEGER);

CREATE POLICY companies_policy ON companies
    FOR ALL USING (
        id IN (SELECT company_id FROM users WHERE id = current_setting('app.user_id')::INTEGER)
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE users IS 'Core user accounts table for authentication and profile management';
COMMENT ON TABLE companies IS 'Company profiles with enrichment data';
COMMENT ON TABLE onboarding_sessions IS 'Tracks user progress through onboarding flow';
COMMENT ON TABLE competitors IS 'Company competitors for tracking and analysis';
COMMENT ON TABLE analysis_history IS 'Historical analysis results for trending';
COMMENT ON TABLE user_sessions IS 'Active user sessions for authentication';
COMMENT ON TABLE user_notifications IS 'User notification queue and history';
COMMENT ON TABLE audit_log IS 'Audit trail for compliance and debugging';