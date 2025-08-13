-- RankMyBrand.ai Foundation Database Schema
-- PostgreSQL with TimescaleDB Extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for service isolation
CREATE SCHEMA IF NOT EXISTS foundation;
CREATE SCHEMA IF NOT EXISTS ai_monitor;
CREATE SCHEMA IF NOT EXISTS intelligence;
CREATE SCHEMA IF NOT EXISTS actions;
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS crawler;

-- Set default schema
SET search_path TO foundation, public;

-- ============================================
-- FOUNDATION SCHEMA - Core Infrastructure
-- ============================================

-- Service Registry Table
CREATE TABLE IF NOT EXISTS foundation.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL CHECK (port > 0 AND port < 65536),
    health_endpoint VARCHAR(255) DEFAULT '/health',
    status VARCHAR(20) DEFAULT 'unknown' CHECK (status IN ('healthy', 'unhealthy', 'unknown')),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_status ON foundation.services(status, last_heartbeat DESC);
CREATE INDEX idx_services_name ON foundation.services(name);

-- API Keys Table
CREATE TABLE IF NOT EXISTS foundation.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rate_limit INTEGER DEFAULT 1000,
    permissions JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    last_used TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_active ON foundation.api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_expires ON foundation.api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Events Table (Event Sourcing with TimescaleDB)
CREATE TABLE IF NOT EXISTS foundation.events (
    id UUID DEFAULT uuid_generate_v4(),
    stream_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version INTEGER DEFAULT 1,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    correlation_id UUID,
    causation_id UUID,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);

-- Convert to TimescaleDB hypertable for automatic partitioning
SELECT create_hypertable('foundation.events', 'created_at', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE);

-- Create indexes for event queries
CREATE INDEX idx_events_stream ON foundation.events(stream_id, created_at DESC);
CREATE INDEX idx_events_type ON foundation.events(event_type, created_at DESC);
CREATE INDEX idx_events_correlation ON foundation.events(correlation_id) WHERE correlation_id IS NOT NULL;

-- Configuration Table
CREATE TABLE IF NOT EXISTS foundation.configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(50) DEFAULT 'development',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_name, config_key, environment)
);

CREATE INDEX idx_config_service ON foundation.configuration(service_name, environment) WHERE is_active = true;

-- Audit Log Table
CREATE TABLE IF NOT EXISTS foundation.audit_log (
    id UUID DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);

-- Convert to hypertable
SELECT create_hypertable('foundation.audit_log', 'created_at',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE);

CREATE INDEX idx_audit_user ON foundation.audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON foundation.audit_log(action, created_at DESC);
CREATE INDEX idx_audit_resource ON foundation.audit_log(resource_type, resource_id, created_at DESC);

-- ============================================
-- METRICS SCHEMA - Performance Metrics
-- ============================================

CREATE SCHEMA IF NOT EXISTS metrics;

-- Service Metrics Table (TimescaleDB)
CREATE TABLE IF NOT EXISTS metrics.service_metrics (
    service_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    metric_type VARCHAR(50) DEFAULT 'gauge',
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable with compression
SELECT create_hypertable('metrics.service_metrics', 'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- Enable compression (data older than 7 days)
ALTER TABLE metrics.service_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'service_name, metric_name'
);

SELECT add_compression_policy('metrics.service_metrics', INTERVAL '7 days',
    if_not_exists => TRUE);

CREATE INDEX idx_metrics_service ON metrics.service_metrics(service_name, timestamp DESC);
CREATE INDEX idx_metrics_name ON metrics.service_metrics(metric_name, timestamp DESC);

-- HTTP Request Metrics
CREATE TABLE IF NOT EXISTS metrics.http_requests (
    service_name VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(255) NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    request_size INTEGER,
    response_size INTEGER,
    correlation_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('metrics.http_requests', 'timestamp',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

CREATE INDEX idx_http_service ON metrics.http_requests(service_name, timestamp DESC);
CREATE INDEX idx_http_status ON metrics.http_requests(status_code, timestamp DESC);
CREATE INDEX idx_http_path ON metrics.http_requests(path, timestamp DESC);

-- ============================================
-- USERS SCHEMA - Authentication & Authorization
-- ============================================

CREATE SCHEMA IF NOT EXISTS users;

-- Users Table
CREATE TABLE IF NOT EXISTS users.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users.users(email) WHERE is_active = true;
CREATE INDEX idx_users_username ON users.users(username) WHERE is_active = true;
CREATE INDEX idx_users_verification ON users.users(verification_token) WHERE verification_token IS NOT NULL;

-- Sessions Table
CREATE TABLE IF NOT EXISTS users.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON users.sessions(user_id);
CREATE INDEX idx_sessions_token ON users.sessions(token_hash);
CREATE INDEX idx_sessions_expires ON users.sessions(expires_at);

-- Permissions Table
CREATE TABLE IF NOT EXISTS users.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100),
    action VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Permissions Table
CREATE TABLE IF NOT EXISTS users.role_permissions (
    role VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES users.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role, permission_id)
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON foundation.services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON foundation.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuration_updated_at BEFORE UPDATE ON foundation.configuration
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old events (older than 90 days)
    DELETE FROM foundation.events WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete old audit logs (older than 180 days)
    DELETE FROM foundation.audit_log WHERE created_at < NOW() - INTERVAL '180 days';
    
    -- Delete expired sessions
    DELETE FROM users.sessions WHERE expires_at < NOW();
    
    -- Mark inactive services as unknown
    UPDATE foundation.services 
    SET status = 'unknown' 
    WHERE last_heartbeat < NOW() - INTERVAL '5 minutes' 
    AND status = 'healthy';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default permissions
INSERT INTO users.permissions (name, description, resource, action) VALUES
    ('read:dashboard', 'View dashboard', 'dashboard', 'read'),
    ('write:dashboard', 'Modify dashboard', 'dashboard', 'write'),
    ('read:analytics', 'View analytics', 'analytics', 'read'),
    ('write:analytics', 'Modify analytics', 'analytics', 'write'),
    ('admin:users', 'Manage users', 'users', 'admin'),
    ('admin:system', 'System administration', 'system', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Insert default role permissions
INSERT INTO users.role_permissions (role, permission_id) 
SELECT 'admin', id FROM users.permissions
ON CONFLICT DO NOTHING;

INSERT INTO users.role_permissions (role, permission_id) 
SELECT 'user', id FROM users.permissions WHERE name IN ('read:dashboard', 'read:analytics')
ON CONFLICT DO NOTHING;

-- Create indexes for JSON queries
CREATE INDEX idx_events_data_gin ON foundation.events USING gin(event_data);
CREATE INDEX idx_config_value_gin ON foundation.configuration USING gin(config_value);
CREATE INDEX idx_services_metadata_gin ON foundation.services USING gin(metadata);

-- Grant permissions to application user (adjust as needed)
GRANT ALL PRIVILEGES ON SCHEMA foundation TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA metrics TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA users TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA foundation TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA metrics TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA users TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA foundation TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA metrics TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA users TO postgres;

-- Create a scheduled job to clean up old data (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- Vacuum and analyze for optimization
VACUUM ANALYZE;