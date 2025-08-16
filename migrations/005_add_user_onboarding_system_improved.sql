-- Migration: 005_add_user_onboarding_system_improved.sql
-- Description: Complete user management and onboarding system tables with improvements
-- Author: RankMyBrand Engineering
-- Date: 2024
-- Version: 2.0

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption functions
CREATE EXTENSION IF NOT EXISTS "citext"; -- For case-insensitive text

-- =====================================================
-- CUSTOM TYPES
-- =====================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'enterprise', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro', 'enterprise', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE analysis_type AS ENUM ('geo', 'crawl', 'search', 'complete', 'quick');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('email', 'in_app', 'push', 'sms');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- USERS TABLE (Improved)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    
    -- Authentication
    email CITEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    work_email CITEXT UNIQUE CHECK (work_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    email_verification_token VARCHAR(255) UNIQUE,
    email_verification_expires TIMESTAMP,
    
    -- Magic Link Auth
    magic_link_token VARCHAR(255) UNIQUE,
    magic_link_expires TIMESTAMP,
    magic_link_attempts INTEGER DEFAULT 0,
    
    -- Two-Factor Auth
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    recovery_codes TEXT[],
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC' NOT NULL,
    locale VARCHAR(10) DEFAULT 'en-US',
    
    -- Company association
    company_id INTEGER,
    department VARCHAR(100),
    job_title VARCHAR(100),
    role user_role DEFAULT 'user' NOT NULL,
    
    -- Subscription
    subscription_tier subscription_tier DEFAULT 'free' NOT NULL,
    subscription_expires TIMESTAMP,
    subscription_seats INTEGER DEFAULT 1,
    trial_ends TIMESTAMP,
    stripe_customer_id VARCHAR(255) UNIQUE,
    
    -- Metadata
    last_login TIMESTAMP,
    last_active TIMESTAMP,
    login_count INTEGER DEFAULT 0 NOT NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Onboarding
    onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
    onboarding_completed_at TIMESTAMP,
    onboarding_step VARCHAR(50),
    onboarding_data JSONB DEFAULT '{}',
    
    -- Settings & Preferences
    settings JSONB DEFAULT '{}' NOT NULL,
    preferences JSONB DEFAULT '{}' NOT NULL,
    feature_flags JSONB DEFAULT '{}',
    
    -- Tracking
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    referrer TEXT,
    signup_ip INET,
    signup_user_agent TEXT,
    
    -- Compliance
    terms_accepted_at TIMESTAMP,
    privacy_accepted_at TIMESTAMP,
    marketing_consent BOOLEAN DEFAULT FALSE,
    data_retention_date DATE,
    
    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Improved indexes
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_company_id ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_magic_link ON users(magic_link_token, magic_link_expires) WHERE magic_link_token IS NOT NULL;
CREATE INDEX idx_users_verification ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX idx_users_last_active ON users(last_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- =====================================================
-- COMPANIES TABLE (Improved)
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    domain CITEXT UNIQUE NOT NULL CHECK (domain ~* '^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$'),
    subdomain VARCHAR(100),
    logo_url TEXT,
    favicon_url TEXT,
    description TEXT,
    tagline VARCHAR(500),
    
    -- Enrichment data
    industry VARCHAR(100),
    sub_industry VARCHAR(100),
    sic_code VARCHAR(10),
    naics_code VARCHAR(10),
    company_size VARCHAR(50),
    employee_count INTEGER CHECK (employee_count >= 0),
    employee_range VARCHAR(50),
    founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM CURRENT_DATE)),
    
    -- Financial
    revenue_range VARCHAR(50),
    funding_total DECIMAL(15,2),
    funding_stage VARCHAR(50),
    public_symbol VARCHAR(10),
    
    -- Location
    headquarters_address TEXT,
    headquarters_city VARCHAR(100),
    headquarters_state VARCHAR(100),
    headquarters_country VARCHAR(100),
    headquarters_postal_code VARCHAR(20),
    headquarters_lat DECIMAL(10,8),
    headquarters_lng DECIMAL(11,8),
    office_locations JSONB DEFAULT '[]',
    
    -- Contact
    main_phone VARCHAR(50),
    main_email VARCHAR(255),
    support_email VARCHAR(255),
    sales_email VARCHAR(255),
    
    -- Social profiles
    linkedin_url TEXT,
    twitter_url TEXT,
    facebook_url TEXT,
    instagram_url TEXT,
    youtube_url TEXT,
    github_url TEXT,
    crunchbase_url TEXT,
    glassdoor_url TEXT,
    
    -- Technology stack
    tech_stack TEXT[],
    tech_categories JSONB DEFAULT '{}',
    
    -- SEO & Content
    meta_title VARCHAR(500),
    meta_description TEXT,
    meta_keywords TEXT[],
    
    -- Enrichment metadata
    enrichment_source VARCHAR(50),
    enrichment_sources JSONB DEFAULT '[]',
    enrichment_data JSONB DEFAULT '{}',
    enrichment_confidence DECIMAL(3,2) CHECK (enrichment_confidence >= 0 AND enrichment_confidence <= 1),
    enrichment_date TIMESTAMP,
    enrichment_status VARCHAR(50) DEFAULT 'pending',
    
    -- Analysis data
    latest_geo_score DECIMAL(5,2) CHECK (latest_geo_score >= 0 AND latest_geo_score <= 100),
    latest_geo_analysis_id INTEGER,
    latest_analysis_date TIMESTAMP,
    analysis_frequency_days INTEGER DEFAULT 30,
    
    -- Company metadata
    tags TEXT[],
    keywords TEXT[],
    categories TEXT[],
    custom_fields JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    
    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Improved indexes
CREATE INDEX idx_companies_domain ON companies(domain) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_name_trgm ON companies USING gin(name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_industry ON companies(industry, sub_industry) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_location ON companies(headquarters_country, headquarters_state, headquarters_city) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_score ON companies(latest_geo_score DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_tech_stack ON companies USING gin(tech_stack) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_tags ON companies USING gin(tags) WHERE deleted_at IS NULL;

-- =====================================================
-- ONBOARDING_SESSIONS TABLE (Improved)
-- =====================================================
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session data
    email CITEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Steps tracking
    current_step VARCHAR(50) DEFAULT 'email' NOT NULL,
    completed_steps TEXT[],
    skipped_steps TEXT[],
    
    -- Progress tracking with detailed timestamps
    steps_data JSONB DEFAULT '{}',
    
    -- Company data
    company_data JSONB,
    company_id INTEGER REFERENCES companies(id),
    
    -- Description
    description_text TEXT,
    description_word_count INTEGER,
    
    -- Competitors
    competitors_data JSONB DEFAULT '[]',
    competitors_count INTEGER DEFAULT 0,
    
    -- Completion
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMP,
    completion_source VARCHAR(50), -- organic, assisted, imported
    
    -- Analytics
    time_spent_seconds INTEGER DEFAULT 0,
    interactions_count INTEGER DEFAULT 0,
    abandonment_reason VARCHAR(255),
    abandonment_step VARCHAR(50),
    
    -- Analysis jobs
    job_ids JSONB DEFAULT '{}',
    
    -- Session management
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours') NOT NULL
);

-- Improved indexes
CREATE INDEX idx_onboarding_session_id ON onboarding_sessions(session_id);
CREATE INDEX idx_onboarding_user_id ON onboarding_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_onboarding_email ON onboarding_sessions(email);
CREATE INDEX idx_onboarding_active ON onboarding_sessions(is_active, expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_onboarding_incomplete ON onboarding_sessions(completed, expires_at) WHERE completed = FALSE;

-- =====================================================
-- COMPETITORS TABLE (Improved)
-- =====================================================
CREATE TABLE IF NOT EXISTS competitors (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    
    -- Competitor info
    competitor_name VARCHAR(255) NOT NULL,
    competitor_domain CITEXT NOT NULL,
    competitor_company_id INTEGER REFERENCES companies(id),
    
    -- Discovery metadata
    discovery_source VARCHAR(50),
    discovery_method VARCHAR(100),
    discovery_reason TEXT,
    discovery_keywords TEXT[],
    
    -- Scoring
    similarity_score DECIMAL(3,2) CHECK (similarity_score >= 0 AND similarity_score <= 1),
    relevance_score DECIMAL(3,2) CHECK (relevance_score >= 0 AND relevance_score <= 1),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    competitive_threat_level INTEGER CHECK (competitive_threat_level >= 1 AND competitive_threat_level <= 10),
    
    -- Tracking
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_confirmed BOOLEAN DEFAULT FALSE,
    added_by_user_id INTEGER REFERENCES users(id),
    confirmed_by_user_id INTEGER REFERENCES users(id),
    
    -- Analysis
    latest_geo_score DECIMAL(5,2) CHECK (latest_geo_score >= 0 AND latest_geo_score <= 100),
    latest_analysis_date TIMESTAMP,
    score_difference DECIMAL(5,2),
    trend VARCHAR(20), -- improving, declining, stable
    
    -- Monitoring
    monitor_enabled BOOLEAN DEFAULT TRUE,
    monitor_frequency_days INTEGER DEFAULT 7,
    last_monitored_at TIMESTAMP,
    
    -- Notes
    notes TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT unique_company_competitor UNIQUE(company_id, competitor_domain)
);

-- Improved indexes
CREATE INDEX idx_competitors_company ON competitors(company_id) WHERE is_active = TRUE;
CREATE INDEX idx_competitors_domain ON competitors(competitor_domain);
CREATE INDEX idx_competitors_scores ON competitors(similarity_score DESC, relevance_score DESC) WHERE is_active = TRUE;
CREATE INDEX idx_competitors_monitor ON competitors(monitor_enabled, last_monitored_at) WHERE monitor_enabled = TRUE;

-- =====================================================
-- USER_SESSIONS TABLE (Improved)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Tokens
    access_token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE,
    csrf_token VARCHAR(255),
    
    -- Device info
    ip_address INET,
    ip_location JSONB,
    user_agent TEXT,
    device_type VARCHAR(50),
    device_name VARCHAR(100),
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    os_version VARCHAR(20),
    
    -- Session management
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(100),
    
    -- Security
    security_flags JSONB DEFAULT '{}',
    risk_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days') NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Improved indexes
CREATE INDEX idx_sessions_user ON user_sessions(user_id, is_active);
CREATE INDEX idx_sessions_access_token ON user_sessions(access_token_hash);
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX idx_sessions_active ON user_sessions(is_active, expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_cleanup ON user_sessions(expires_at) WHERE is_active = TRUE;

-- =====================================================
-- ANALYSIS_HISTORY TABLE (Improved)
-- =====================================================
CREATE TABLE IF NOT EXISTS analysis_history (
    id SERIAL PRIMARY KEY,
    analysis_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    
    -- Analysis type
    analysis_type analysis_type NOT NULL,
    analysis_version VARCHAR(20),
    
    -- Overall metrics
    geo_score DECIMAL(5,2) CHECK (geo_score >= 0 AND geo_score <= 100),
    geo_score_change DECIMAL(5,2),
    percentile_rank DECIMAL(5,2),
    
    -- Share of Voice
    share_of_voice DECIMAL(5,2) CHECK (share_of_voice >= 0 AND share_of_voice <= 100),
    share_of_voice_change DECIMAL(5,2),
    
    -- Sentiment
    sentiment_positive DECIMAL(5,2) CHECK (sentiment_positive >= 0 AND sentiment_positive <= 100),
    sentiment_neutral DECIMAL(5,2) CHECK (sentiment_neutral >= 0 AND sentiment_neutral <= 100),
    sentiment_negative DECIMAL(5,2) CHECK (sentiment_negative >= 0 AND sentiment_negative <= 100),
    sentiment_score DECIMAL(5,2),
    
    -- Platform scores
    platform_scores JSONB DEFAULT '{}',
    
    -- Citations & Mentions
    total_citations INTEGER DEFAULT 0,
    total_mentions INTEGER DEFAULT 0,
    authoritative_mentions INTEGER DEFAULT 0,
    
    -- Performance metrics
    analysis_duration_ms INTEGER,
    data_points_analyzed INTEGER,
    confidence_score DECIMAL(3,2),
    
    -- Raw data
    raw_data JSONB,
    metrics JSONB,
    insights JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Improved indexes
CREATE INDEX idx_analysis_company ON analysis_history(company_id, created_at DESC);
CREATE INDEX idx_analysis_user ON analysis_history(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analysis_type ON analysis_history(analysis_type, created_at DESC);
CREATE INDEX idx_analysis_date ON analysis_history(created_at DESC);
CREATE INDEX idx_analysis_score ON analysis_history(geo_score DESC) WHERE geo_score IS NOT NULL;

-- =====================================================
-- Additional improvements and new tables
-- =====================================================

-- API Keys table for service authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '{}',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_webhooks_active ON webhooks(is_active) WHERE is_active = TRUE;

-- =====================================================
-- IMPROVED FUNCTIONS
-- =====================================================

-- Improved update timestamp function with user tracking
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    -- Log who made the change if applicable
    IF TG_TABLE_NAME IN ('users', 'companies') AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = TG_TABLE_NAME 
        AND column_name = 'updated_by'
    ) THEN
        NEW.updated_by = current_setting('app.user_id', true)::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE;
    
    DELETE FROM onboarding_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ language 'plpgsql';

-- Function to calculate company score percentile
CREATE OR REPLACE FUNCTION calculate_score_percentile(score DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    percentile DECIMAL;
BEGIN
    SELECT PERCENT_RANK() OVER (ORDER BY latest_geo_score) * 100
    INTO percentile
    FROM companies
    WHERE latest_geo_score = score
    AND deleted_at IS NULL;
    
    RETURN COALESCE(percentile, 50);
END;
$$ language 'plpgsql';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Create triggers for all tables with updated_at
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at 
                       BEFORE UPDATE ON %s 
                       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- =====================================================
-- VIEWS
-- =====================================================

-- Active users view
CREATE OR REPLACE VIEW active_users AS
SELECT 
    u.*,
    c.name as company_name,
    c.domain as company_domain
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.deleted_at IS NULL
AND u.email_verified = TRUE;

-- Company analytics view
CREATE OR REPLACE VIEW company_analytics AS
SELECT 
    c.*,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT comp.id) as competitor_count,
    COUNT(DISTINCT ah.id) as analysis_count,
    MAX(ah.created_at) as last_analysis_date
FROM companies c
LEFT JOIN users u ON c.id = u.company_id AND u.deleted_at IS NULL
LEFT JOIN competitors comp ON c.id = comp.company_id AND comp.is_active = TRUE
LEFT JOIN analysis_history ah ON c.id = ah.company_id
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Daily stats materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT CASE WHEN created_at::date = DATE(created_at) THEN id END) as new_users,
    COUNT(DISTINCT CASE WHEN last_login::date = DATE(created_at) THEN id END) as active_users,
    COUNT(DISTINCT company_id) as active_companies
FROM users
WHERE deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX ON daily_stats(date);

-- =====================================================
-- POLICIES FOR ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY users_select_policy ON users
    FOR SELECT USING (
        id = current_setting('app.user_id', true)::INTEGER OR
        company_id IN (
            SELECT company_id FROM users 
            WHERE id = current_setting('app.user_id', true)::INTEGER 
            AND role IN ('admin', 'enterprise', 'super_admin')
        )
    );

CREATE POLICY users_update_policy ON users
    FOR UPDATE USING (id = current_setting('app.user_id', true)::INTEGER);

-- Company policies
CREATE POLICY companies_select_policy ON companies
    FOR SELECT USING (
        id IN (
            SELECT company_id FROM users 
            WHERE id = current_setting('app.user_id', true)::INTEGER
        )
    );

-- =====================================================
-- PARTITIONING FOR LARGE TABLES
-- =====================================================

-- Partition analysis_history by month for better performance
CREATE TABLE IF NOT EXISTS analysis_history_y2024m01 PARTITION OF analysis_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS analysis_history_y2024m02 PARTITION OF analysis_history
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed...

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Partial indexes for common queries
CREATE INDEX idx_users_active_verified ON users(id) 
    WHERE deleted_at IS NULL AND email_verified = TRUE;

CREATE INDEX idx_companies_with_score ON companies(id, latest_geo_score) 
    WHERE deleted_at IS NULL AND latest_geo_score IS NOT NULL;

-- BRIN indexes for timestamp columns (better for large tables)
CREATE INDEX idx_analysis_created_brin ON analysis_history USING brin(created_at);
CREATE INDEX idx_audit_created_brin ON audit_log USING brin(created_at);

-- =====================================================
-- MAINTENANCE SCRIPTS
-- =====================================================

-- Schedule these with pg_cron or external scheduler:
-- SELECT clean_expired_sessions();
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;
-- VACUUM ANALYZE;

COMMENT ON SCHEMA public IS 'RankMyBrand.ai main database schema - v2.0';