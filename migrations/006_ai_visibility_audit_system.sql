-- AI Visibility Audit System Schema
-- Enterprise-grade PostgreSQL schema with partitioning, indexing, and performance optimizations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- For composite indexes

-- =====================================================
-- Core Audit Tables
-- =====================================================

-- Main audit table with partitioning by created_at
CREATE TABLE IF NOT EXISTS ai_visibility_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Audit metadata
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Configuration
    query_count INTEGER NOT NULL DEFAULT 50,
    providers TEXT[] NOT NULL DEFAULT ARRAY['openai', 'anthropic', 'google', 'perplexity'],
    
    -- Results summary
    overall_score DECIMAL(5,2),
    brand_mention_rate DECIMAL(5,2),
    competitive_position INTEGER,
    total_competitors INTEGER,
    
    -- Processing metadata
    processing_time_ms INTEGER,
    total_api_calls INTEGER,
    failed_api_calls INTEGER,
    cache_hit_rate DECIMAL(5,2),
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Audit configuration
    config JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for performance
    INDEX idx_audits_company_created (company_id, created_at DESC),
    INDEX idx_audits_status (status) WHERE status IN ('pending', 'processing'),
    INDEX idx_audits_user (user_id),
    INDEX idx_audits_created_at_brin (created_at) USING BRIN
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audits (automated via pg_partman in production)
CREATE TABLE ai_visibility_audits_2025_01 PARTITION OF ai_visibility_audits
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE ai_visibility_audits_2025_02 PARTITION OF ai_visibility_audits
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Add more partitions as needed

-- =====================================================
-- Query Management
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    
    -- Query details
    query_text TEXT NOT NULL,
    query_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(query_text::bytea), 'hex')) STORED,
    
    -- Query classification
    intent VARCHAR(50) NOT NULL CHECK (intent IN (
        'navigational', 'informational', 'transactional', 'commercial',
        'local', 'problem_solving', 'comparative', 'review'
    )),
    category VARCHAR(50),
    complexity_score DECIMAL(3,2) CHECK (complexity_score >= 0 AND complexity_score <= 1),
    priority_score DECIMAL(3,2) CHECK (priority_score >= 0 AND priority_score <= 1),
    
    -- Metadata
    buyer_journey_stage VARCHAR(20) CHECK (buyer_journey_stage IN ('awareness', 'consideration', 'decision', 'retention')),
    semantic_variations TEXT[],
    expected_serp_features TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_queries_audit (audit_id),
    INDEX idx_queries_hash (query_hash),
    INDEX idx_queries_intent (intent),
    INDEX idx_queries_text_gin (query_text gin_trgm_ops)
);

-- =====================================================
-- LLM Responses
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID NOT NULL REFERENCES audit_queries(id) ON DELETE CASCADE,
    
    -- Provider information
    provider VARCHAR(50) NOT NULL CHECK (provider IN (
        'openai_gpt4', 'openai_gpt5', 'anthropic_claude',
        'google_gemini', 'google_ai_overview', 'perplexity'
    )),
    model_version VARCHAR(100),
    
    -- Response data
    response_text TEXT NOT NULL,
    response_hash VARCHAR(64) GENERATED ALWAYS AS (encode(sha256(substring(response_text for 1000)::bytea), 'hex')) STORED,
    
    -- Performance metrics
    response_time_ms INTEGER,
    tokens_used INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    
    -- Analysis results
    brand_mentioned BOOLEAN NOT NULL DEFAULT FALSE,
    mention_position VARCHAR(20) CHECK (mention_position IN ('first_paragraph', 'middle', 'end', 'not_found')),
    mention_context VARCHAR(30) CHECK (mention_context IN (
        'primary_focus', 'significant_mention', 'comparative_context',
        'listing_inclusion', 'passing_reference', 'no_mention'
    )),
    
    -- Sentiment and recommendation
    sentiment VARCHAR(20) CHECK (sentiment IN (
        'strongly_positive', 'positive', 'neutral', 'mixed', 'negative', 'strongly_negative'
    )),
    recommendation_strength VARCHAR(30) CHECK (recommendation_strength IN (
        'strong_recommendation', 'moderate_recommendation', 'neutral_mention',
        'conditional_recommendation', 'not_recommended', 'no_recommendation'
    )),
    
    -- Competitive analysis
    competitors_mentioned JSONB DEFAULT '[]',  -- Array of {name, mentioned, sentiment, position}
    competitive_advantage BOOLEAN,
    
    -- Deep analysis
    key_features_mentioned TEXT[],
    credibility_indicators TEXT[],
    quoted_snippets TEXT[],
    
    -- SEO factors
    featured_snippet_potential BOOLEAN DEFAULT FALSE,
    voice_search_optimized BOOLEAN DEFAULT FALSE,
    local_relevance BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analysis_metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_responses_query (query_id),
    INDEX idx_responses_provider (provider),
    INDEX idx_responses_brand_mentioned (brand_mentioned) WHERE brand_mentioned = TRUE,
    INDEX idx_responses_cache (response_hash, provider),
    INDEX idx_responses_competitors_gin (competitors_mentioned) USING GIN
);

-- =====================================================
-- Scoring and Analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    
    -- Metric identification
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) CHECK (metric_category IN (
        'visibility', 'sentiment', 'competitive', 'seo', 'engagement', 'quality'
    )),
    
    -- Score data
    score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) DEFAULT 100,
    
    -- Comparison data
    percentile_rank DECIMAL(5,2),  -- Compared to other brands in same industry
    trend_direction VARCHAR(10) CHECK (trend_direction IN ('up', 'down', 'stable')),
    trend_percentage DECIMAL(5,2),
    
    -- Details and breakdown
    details JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_scores_audit (audit_id),
    INDEX idx_scores_metric (metric_name),
    UNIQUE (audit_id, metric_name)
);

-- =====================================================
-- Materialized Views for Performance
-- =====================================================

-- Brand visibility trends
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_brand_visibility_trends AS
SELECT 
    a.company_id,
    DATE_TRUNC('day', a.created_at) as audit_date,
    AVG(a.overall_score) as avg_score,
    AVG(a.brand_mention_rate) as avg_mention_rate,
    COUNT(*) as audit_count,
    AVG(a.processing_time_ms) as avg_processing_time
FROM ai_visibility_audits a
WHERE a.status = 'completed'
GROUP BY a.company_id, DATE_TRUNC('day', a.created_at)
WITH DATA;

CREATE UNIQUE INDEX idx_mv_visibility_trends ON mv_brand_visibility_trends (company_id, audit_date);

-- Provider performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_provider_performance AS
SELECT 
    r.provider,
    DATE_TRUNC('hour', r.created_at) as hour,
    AVG(r.response_time_ms) as avg_response_time,
    SUM(CASE WHEN r.cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as cache_hit_rate,
    COUNT(*) as total_requests,
    AVG(r.tokens_used) as avg_tokens
FROM audit_responses r
GROUP BY r.provider, DATE_TRUNC('hour', r.created_at)
WITH DATA;

CREATE UNIQUE INDEX idx_mv_provider_perf ON mv_provider_performance (provider, hour);

-- Competitive landscape view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_competitive_landscape AS
SELECT 
    a.company_id,
    a.id as audit_id,
    jsonb_array_elements(r.competitors_mentioned) ->> 'name' as competitor_name,
    COUNT(*) as mention_count,
    AVG(CASE 
        WHEN (jsonb_array_elements(r.competitors_mentioned) ->> 'sentiment') = 'positive' THEN 1
        WHEN (jsonb_array_elements(r.competitors_mentioned) ->> 'sentiment') = 'negative' THEN -1
        ELSE 0 
    END) as sentiment_score
FROM ai_visibility_audits a
JOIN audit_queries q ON q.audit_id = a.id
JOIN audit_responses r ON r.query_id = q.id
WHERE a.status = 'completed'
GROUP BY a.company_id, a.id, competitor_name
WITH DATA;

CREATE INDEX idx_mv_competitive ON mv_competitive_landscape (company_id, audit_id);

-- =====================================================
-- Audit History and Comparison
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Audits being compared
    baseline_audit_id UUID NOT NULL REFERENCES ai_visibility_audits(id),
    comparison_audit_id UUID NOT NULL REFERENCES ai_visibility_audits(id),
    
    -- Change metrics
    score_change DECIMAL(5,2),
    mention_rate_change DECIMAL(5,2),
    competitive_position_change INTEGER,
    
    -- Detailed changes
    improvements JSONB DEFAULT '[]',
    regressions JSONB DEFAULT '[]',
    new_opportunities JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_comparisons_company (company_id),
    UNIQUE (baseline_audit_id, comparison_audit_id)
);

-- =====================================================
-- Background Job Queue (if not using BullMQ)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_job_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    
    -- Job metadata
    job_type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Job data
    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Worker information
    worker_id VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_job_queue_status (status, priority DESC, scheduled_at) WHERE status IN ('pending', 'processing'),
    INDEX idx_job_queue_audit (audit_id)
);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update materialized views
CREATE OR REPLACE FUNCTION refresh_audit_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_brand_visibility_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_provider_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_competitive_landscape;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update audit status
CREATE OR REPLACE FUNCTION update_audit_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update audit completion status when all queries are processed
    IF NEW.status = 'completed' THEN
        UPDATE ai_visibility_audits
        SET status = 'completed',
            completed_at = NOW()
        WHERE id = NEW.audit_id
        AND NOT EXISTS (
            SELECT 1 FROM audit_job_queue
            WHERE audit_id = NEW.audit_id
            AND status IN ('pending', 'processing')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_audit_status
AFTER UPDATE ON audit_job_queue
FOR EACH ROW
EXECUTE FUNCTION update_audit_status();

-- Function to calculate audit scores
CREATE OR REPLACE FUNCTION calculate_audit_scores(p_audit_id UUID)
RETURNS void AS $$
DECLARE
    v_brand_mentions INTEGER;
    v_total_responses INTEGER;
    v_positive_sentiment INTEGER;
    v_recommendations INTEGER;
BEGIN
    -- Calculate basic metrics
    SELECT 
        COUNT(*) FILTER (WHERE brand_mentioned = TRUE),
        COUNT(*),
        COUNT(*) FILTER (WHERE sentiment IN ('positive', 'strongly_positive')),
        COUNT(*) FILTER (WHERE recommendation_strength IN ('strong_recommendation', 'moderate_recommendation'))
    INTO v_brand_mentions, v_total_responses, v_positive_sentiment, v_recommendations
    FROM audit_responses r
    JOIN audit_queries q ON q.id = r.query_id
    WHERE q.audit_id = p_audit_id;
    
    -- Update audit summary
    UPDATE ai_visibility_audits
    SET 
        brand_mention_rate = (v_brand_mentions::DECIMAL / NULLIF(v_total_responses, 0)) * 100,
        overall_score = (
            (v_brand_mentions::DECIMAL / NULLIF(v_total_responses, 0)) * 40 +
            (v_positive_sentiment::DECIMAL / NULLIF(v_brand_mentions, 0)) * 30 +
            (v_recommendations::DECIMAL / NULLIF(v_total_responses, 0)) * 30
        )
    WHERE id = p_audit_id;
    
    -- Insert detailed scores
    INSERT INTO audit_scores (audit_id, metric_name, metric_category, score, details)
    VALUES 
        (p_audit_id, 'brand_visibility', 'visibility', (v_brand_mentions::DECIMAL / NULLIF(v_total_responses, 0)) * 100, 
         jsonb_build_object('mentions', v_brand_mentions, 'total', v_total_responses)),
        (p_audit_id, 'sentiment_score', 'sentiment', (v_positive_sentiment::DECIMAL / NULLIF(v_brand_mentions, 0)) * 100,
         jsonb_build_object('positive', v_positive_sentiment, 'total_mentions', v_brand_mentions)),
        (p_audit_id, 'recommendation_score', 'engagement', (v_recommendations::DECIMAL / NULLIF(v_total_responses, 0)) * 100,
         jsonb_build_object('recommendations', v_recommendations, 'total', v_total_responses))
    ON CONFLICT (audit_id, metric_name) 
    DO UPDATE SET 
        score = EXCLUDED.score,
        details = EXCLUDED.details;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Indexes for Query Performance
-- =====================================================

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_responses_analysis ON audit_responses (brand_mentioned, sentiment, recommendation_strength);
CREATE INDEX IF NOT EXISTS idx_queries_priority ON audit_queries (priority_score DESC) WHERE priority_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audits_recent ON ai_visibility_audits (created_at DESC) WHERE status = 'completed';

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_responses_text_search ON audit_responses USING GIN (to_tsvector('english', response_text));

-- =====================================================
-- Row Level Security (if needed)
-- =====================================================

-- Enable RLS
ALTER TABLE ai_visibility_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_scores ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth system)
CREATE POLICY audit_company_access ON ai_visibility_audits
    FOR ALL
    USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = current_setting('app.user_id')::UUID
    ));

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE ai_visibility_audits IS 'Main table for AI visibility audit sessions with partitioning for scale';
COMMENT ON TABLE audit_queries IS 'Stores generated queries for each audit with intent classification';
COMMENT ON TABLE audit_responses IS 'LLM responses with detailed analysis results';
COMMENT ON TABLE audit_scores IS 'Calculated metrics and scores for each audit';
COMMENT ON COLUMN audit_responses.response_hash IS 'Hash of first 1000 chars for cache lookup';
COMMENT ON COLUMN audit_queries.query_hash IS 'SHA256 hash for deduplication and caching';
-- =====================================================
-- Data Retention and Archival Policies (90-day retention)
-- =====================================================

-- Archive tables for long-term storage
CREATE TABLE IF NOT EXISTS ai_visibility_audits_archive (LIKE ai_visibility_audits INCLUDING ALL);
CREATE TABLE IF NOT EXISTS audit_queries_archive (LIKE audit_queries INCLUDING ALL);
CREATE TABLE IF NOT EXISTS audit_responses_archive (LIKE audit_responses INCLUDING ALL);
CREATE TABLE IF NOT EXISTS audit_scores_archive (LIKE audit_scores INCLUDING ALL);

-- Function to archive old audit data (90-day retention)
CREATE OR REPLACE FUNCTION archive_old_ai_visibility_data()
RETURNS void AS $$
DECLARE
    retention_date DATE;
    archived_count INT;
BEGIN
    -- Calculate retention date (90 days ago)
    retention_date := CURRENT_DATE - INTERVAL '90 days';
    
    -- Archive audits older than retention period
    INSERT INTO ai_visibility_audits_archive
    SELECT * FROM ai_visibility_audits
    WHERE created_at < retention_date
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RAISE NOTICE 'Archived % audit records', archived_count;
    
    -- Archive related data
    INSERT INTO audit_queries_archive
    SELECT q.* FROM audit_queries q
    INNER JOIN ai_visibility_audits a ON q.audit_id = a.id
    WHERE a.created_at < retention_date
    ON CONFLICT DO NOTHING;
    
    INSERT INTO audit_responses_archive
    SELECT r.* FROM audit_responses r
    INNER JOIN ai_visibility_audits a ON r.audit_id = a.id
    WHERE a.created_at < retention_date
    ON CONFLICT DO NOTHING;
    
    INSERT INTO audit_scores_archive
    SELECT s.* FROM audit_scores s
    INNER JOIN ai_visibility_audits a ON s.audit_id = a.id
    WHERE a.created_at < retention_date
    ON CONFLICT DO NOTHING;
    
    -- Delete archived data from main tables
    DELETE FROM audit_scores
    WHERE audit_id IN (
        SELECT id FROM ai_visibility_audits
        WHERE created_at < retention_date
    );
    
    DELETE FROM audit_responses
    WHERE audit_id IN (
        SELECT id FROM ai_visibility_audits
        WHERE created_at < retention_date
    );
    
    DELETE FROM audit_queries
    WHERE audit_id IN (
        SELECT id FROM ai_visibility_audits
        WHERE created_at < retention_date
    );
    
    DELETE FROM ai_visibility_audits
    WHERE created_at < retention_date;
    
    RAISE NOTICE 'Data retention cleanup completed. Archived % records.', archived_count;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure for manual cleanup with configurable retention
CREATE OR REPLACE PROCEDURE cleanup_ai_visibility_data(
    days_to_retain INT DEFAULT 90,
    dry_run BOOLEAN DEFAULT TRUE
)
LANGUAGE plpgsql
AS $$
DECLARE
    retention_date DATE;
    audit_count INT;
BEGIN
    retention_date := CURRENT_DATE - (days_to_retain || ' days')::INTERVAL;
    
    -- Count records to be archived
    SELECT COUNT(*) INTO audit_count
    FROM ai_visibility_audits
    WHERE created_at < retention_date;
    
    RAISE NOTICE 'Found % audits older than % days', audit_count, days_to_retain;
    
    IF NOT dry_run AND audit_count > 0 THEN
        PERFORM archive_old_ai_visibility_data();
        RAISE NOTICE 'Archival completed successfully';
    ELSIF dry_run THEN
        RAISE NOTICE 'DRY RUN - No data was archived. Run with dry_run = FALSE to execute.';
    ELSE
        RAISE NOTICE 'No data to archive';
    END IF;
END;
$$;

-- Create index for retention queries
CREATE INDEX IF NOT EXISTS idx_ai_visibility_audits_retention 
ON ai_visibility_audits(created_at) 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Note: For automated daily archival, install pg_cron extension and run:
-- SELECT cron.schedule('archive-ai-visibility', '0 2 * * *', 'SELECT archive_old_ai_visibility_data();');

-- Note: For S3 export, use aws_s3 extension or external ETL tool
-- Example: COPY ai_visibility_audits_archive TO 's3://bucket/ai-visibility-archive/audits.csv' WITH (FORMAT CSV);
