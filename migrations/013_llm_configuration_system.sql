-- Migration: LLM Configuration System
-- Purpose: Centralize all LLM provider and model configurations
-- Replaces: Scattered .env files and hardcoded model strings
-- Author: System Architect
-- Date: 2025-11-08

-- ========================================
-- TABLE: llm_configurations
-- ========================================

CREATE TABLE IF NOT EXISTS llm_configurations (
    id SERIAL PRIMARY KEY,

    -- Use Case Identification
    use_case VARCHAR(50) NOT NULL,
    use_case_description TEXT,

    -- Provider & Model Configuration
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'perplexity', 'cohere')),
    model VARCHAR(100) NOT NULL,

    -- Priority & Availability
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
    weight DECIMAL(3,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2.0),
    enabled BOOLEAN DEFAULT TRUE,

    -- Model Parameters
    temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2.0),
    max_tokens INTEGER DEFAULT 4000 CHECK (max_tokens > 0),
    timeout_ms INTEGER DEFAULT 30000 CHECK (timeout_ms > 0),
    top_p DECIMAL(3,2) CHECK (top_p >= 0 AND top_p <= 1.0),

    -- Cost Tracking (Optional - for future use)
    cost_per_1k_tokens DECIMAL(10,6),
    estimated_monthly_calls INTEGER,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(100) DEFAULT 'system',
    notes TEXT,

    -- Constraints
    CONSTRAINT unique_use_case_provider UNIQUE(use_case, provider)
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX idx_llm_config_use_case ON llm_configurations(use_case);
CREATE INDEX idx_llm_config_enabled ON llm_configurations(enabled);
CREATE INDEX idx_llm_config_priority ON llm_configurations(use_case, priority);

-- ========================================
-- TRIGGER: Update timestamp on modification
-- ========================================

CREATE OR REPLACE FUNCTION update_llm_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_llm_config_timestamp
    BEFORE UPDATE ON llm_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_config_timestamp();

-- ========================================
-- SEED DATA: Current Production Configuration
-- ========================================

-- Intelligence Engine: Query Generation
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, notes
) VALUES (
    'query_generation',
    'Generate 42 buyer journey queries across 5 phases',
    'openai',
    'gpt-4o',
    1,
    true,
    0.3,
    4000,
    30000,
    'Primary model for query generation. Currently using gpt-4o (override from gpt-5-nano default)'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Intelligence Engine: Response Analysis
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, notes
) VALUES (
    'response_analysis',
    'Analyze individual AI responses for brand visibility',
    'openai',
    'gpt-5-nano',
    1,
    true,
    0.7,
    2000,
    30000,
    'Per-response analysis. Currently hardcoded in job_processor.py:158'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Intelligence Engine: Recommendation Extraction
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, notes
) VALUES (
    'recommendation_extraction',
    'Extract recommendations from batched AI responses',
    'openai',
    'gpt-5-nano',
    1,
    true,
    0.6,
    8000,
    30000,
    'Batch processing: 36 LLM calls (6 categories × 2 batches × 3 types). Currently hardcoded in job_processor.py:164'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Intelligence Engine: Strategic Aggregation
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, notes
) VALUES (
    'strategic_aggregation',
    'Generate personalized strategic recommendations',
    'openai',
    'gpt-5-nano',
    1,
    true,
    0.7,
    6000,
    30000,
    'Strategic intelligence layer: 4 LLM calls per audit. Currently hardcoded in job_processor.py:170'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- API Gateway: Company Enrichment
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, notes
) VALUES (
    'company_enrichment',
    'Enrich company data with AI-generated insights',
    'openai',
    'gpt-5-chat-latest',
    1,
    true,
    0.6,
    2000,
    30000,
    'Company data enrichment. Currently hardcoded in llm-enrichment.service.ts (4 locations: lines 281, 578, 620, 712)'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Multi-Provider Orchestration: Primary (OpenAI)
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, weight, notes
) VALUES (
    'provider_orchestration',
    'Multi-provider fallback system',
    'openai',
    'gpt-4o',
    1,
    true,
    0.7,
    4000,
    30000,
    1.2,
    'Primary provider with highest priority. Currently hardcoded in llm_provider_manager.py:97'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    weight = EXCLUDED.weight,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Multi-Provider Orchestration: Fallback #1 (Anthropic)
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, weight, notes
) VALUES (
    'provider_orchestration',
    'Multi-provider fallback system',
    'anthropic',
    'claude-3-opus-20240229',
    2,
    true,
    0.7,
    4000,
    30000,
    1.2,
    'Secondary provider fallback. Currently hardcoded in llm_provider_manager.py:107'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    weight = EXCLUDED.weight,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Multi-Provider Orchestration: Fallback #2 (Google AI)
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, weight, notes
) VALUES (
    'provider_orchestration',
    'Multi-provider fallback system',
    'google',
    'gemini-2.5-flash',
    3,
    true,
    0.7,
    4000,
    30000,
    1.0,
    'Tertiary provider fallback. Currently hardcoded in llm_provider_manager.py:117'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    weight = EXCLUDED.weight,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- Multi-Provider Orchestration: Fallback #3 (Perplexity)
INSERT INTO llm_configurations (
    use_case, use_case_description, provider, model, priority, enabled,
    temperature, max_tokens, timeout_ms, weight, notes
) VALUES (
    'provider_orchestration',
    'Multi-provider fallback system',
    'perplexity',
    'sonar',
    4,
    true,
    0.7,
    4000,
    30000,
    1.1,
    'Quaternary provider fallback. Currently hardcoded in llm_provider_manager.py:128'
)
ON CONFLICT (use_case, provider) DO UPDATE SET
    model = EXCLUDED.model,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    temperature = EXCLUDED.temperature,
    max_tokens = EXCLUDED.max_tokens,
    timeout_ms = EXCLUDED.timeout_ms,
    weight = EXCLUDED.weight,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- ========================================
-- AUDIT LOG TABLE: Track Configuration Changes
-- ========================================

CREATE TABLE IF NOT EXISTS llm_config_audit_log (
    id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES llm_configurations(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'enabled', 'disabled')),
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    reason TEXT
);

CREATE INDEX idx_llm_config_audit_config_id ON llm_config_audit_log(config_id);
CREATE INDEX idx_llm_config_audit_changed_at ON llm_config_audit_log(changed_at DESC);

-- ========================================
-- VIEWS: Convenient Queries
-- ========================================

-- View: Active configurations by use case
CREATE OR REPLACE VIEW active_llm_configs AS
SELECT
    use_case,
    use_case_description,
    provider,
    model,
    priority,
    temperature,
    max_tokens,
    timeout_ms,
    weight,
    notes
FROM llm_configurations
WHERE enabled = true
ORDER BY use_case, priority;

-- View: Configuration summary statistics
CREATE OR REPLACE VIEW llm_config_summary AS
SELECT
    use_case,
    COUNT(*) as provider_count,
    COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
    ARRAY_AGG(provider ORDER BY priority) as providers,
    MIN(priority) FILTER (WHERE enabled = true) as primary_priority
FROM llm_configurations
GROUP BY use_case
ORDER BY use_case;

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function: Get active config for a use case
CREATE OR REPLACE FUNCTION get_llm_config(p_use_case VARCHAR)
RETURNS TABLE (
    provider VARCHAR,
    model VARCHAR,
    temperature DECIMAL,
    max_tokens INTEGER,
    timeout_ms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lc.provider,
        lc.model,
        lc.temperature,
        lc.max_tokens,
        lc.timeout_ms
    FROM llm_configurations lc
    WHERE lc.use_case = p_use_case
      AND lc.enabled = true
    ORDER BY lc.priority
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all fallback configs for a use case
CREATE OR REPLACE FUNCTION get_llm_fallback_configs(p_use_case VARCHAR)
RETURNS TABLE (
    provider VARCHAR,
    model VARCHAR,
    priority INTEGER,
    weight DECIMAL,
    temperature DECIMAL,
    max_tokens INTEGER,
    timeout_ms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lc.provider,
        lc.model,
        lc.priority,
        lc.weight,
        lc.temperature,
        lc.max_tokens,
        lc.timeout_ms
    FROM llm_configurations lc
    WHERE lc.use_case = p_use_case
      AND lc.enabled = true
    ORDER BY lc.priority;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE llm_configurations IS 'Centralized configuration for all LLM providers and models across the system';
COMMENT ON COLUMN llm_configurations.use_case IS 'Unique identifier for the use case (e.g., query_generation, response_analysis)';
COMMENT ON COLUMN llm_configurations.provider IS 'LLM provider: openai, anthropic, google, perplexity, cohere';
COMMENT ON COLUMN llm_configurations.model IS 'Specific model name (e.g., gpt-4o, claude-3-opus, gemini-2.5-flash)';
COMMENT ON COLUMN llm_configurations.priority IS 'Priority for fallback (1 = highest, used first)';
COMMENT ON COLUMN llm_configurations.weight IS 'Load balancing weight (higher = more traffic)';
COMMENT ON COLUMN llm_configurations.enabled IS 'Whether this configuration is active';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify seed data
DO $$
DECLARE
    config_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM llm_configurations;
    RAISE NOTICE 'Inserted % LLM configurations', config_count;

    -- Show summary
    RAISE NOTICE '--- Configuration Summary ---';
    FOR rec IN SELECT * FROM llm_config_summary LOOP
        RAISE NOTICE 'Use Case: %, Providers: %, Enabled: %',
            rec.use_case, rec.provider_count, rec.enabled_count;
    END LOOP;
END $$;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================

-- To rollback this migration:
-- DROP TABLE IF EXISTS llm_config_audit_log CASCADE;
-- DROP TABLE IF EXISTS llm_configurations CASCADE;
-- DROP VIEW IF EXISTS active_llm_configs;
-- DROP VIEW IF EXISTS llm_config_summary;
-- DROP FUNCTION IF EXISTS get_llm_config(VARCHAR);
-- DROP FUNCTION IF EXISTS get_llm_fallback_configs(VARCHAR);
-- DROP FUNCTION IF EXISTS update_llm_config_timestamp();
