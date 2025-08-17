-- Report Queue Table for queued report generation
-- Feature-flagged: Only used when ENABLE_QUEUED_REPORT=true

CREATE TABLE IF NOT EXISTS report_requests (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    company_id INTEGER,
    session_id VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    -- Possible values: 'queued', 'processing', 'ready', 'failed', 'sent'
    
    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    email_sent_at TIMESTAMP,
    eta_minutes INTEGER DEFAULT 60,
    
    -- Report data
    report_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Email tracking
    email_sent BOOLEAN DEFAULT FALSE,
    email_token_hash VARCHAR(255), -- Store hash of the signed token
    token_expires_at TIMESTAMP,
    token_used BOOLEAN DEFAULT FALSE,
    token_used_at TIMESTAMP,
    
    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,
    
    -- Metadata
    metadata JSONB,
    
    -- Indexes for queries
    CONSTRAINT report_requests_status_check CHECK (
        status IN ('queued', 'processing', 'ready', 'failed', 'sent')
    )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_report_requests_status ON report_requests(status);
CREATE INDEX IF NOT EXISTS idx_report_requests_user_id ON report_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_report_requests_email ON report_requests(email);
CREATE INDEX IF NOT EXISTS idx_report_requests_created_at ON report_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_report_requests_token_hash ON report_requests(email_token_hash);
CREATE INDEX IF NOT EXISTS idx_report_requests_idempotency ON report_requests(idempotency_key);

-- Index for finding reports to process
CREATE INDEX IF NOT EXISTS idx_report_requests_processing 
    ON report_requests(status, created_at) 
    WHERE status IN ('queued', 'processing');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS report_requests_updated_at_trigger ON report_requests;
CREATE TRIGGER report_requests_updated_at_trigger
    BEFORE UPDATE ON report_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_report_requests_updated_at();

-- Analytics events table for tracking report journey
CREATE TABLE IF NOT EXISTS report_events (
    id SERIAL PRIMARY KEY,
    report_request_id INTEGER REFERENCES report_requests(id),
    event_type VARCHAR(100) NOT NULL,
    -- Event types: 'queued', 'processing_started', 'completed', 'failed', 
    -- 'email_sent', 'email_opened', 'link_clicked', 'dashboard_loaded'
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_report_events_request_id ON report_events(report_request_id);
CREATE INDEX IF NOT EXISTS idx_report_events_type ON report_events(event_type);
CREATE INDEX IF NOT EXISTS idx_report_events_created_at ON report_events(created_at);