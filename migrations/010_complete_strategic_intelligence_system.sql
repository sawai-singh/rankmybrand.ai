-- Migration 010: Complete Strategic Intelligence System
-- Adds Layers 1-3 infrastructure for 118-call architecture
-- Date: 2025-10-23

BEGIN;

-- =====================================================
-- 1. Enhanced audit_responses Table
-- =====================================================

-- Add buyer journey and batch tracking
ALTER TABLE audit_responses
ADD COLUMN IF NOT EXISTS query_text TEXT,
ADD COLUMN IF NOT EXISTS buyer_journey_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS batch_id INT,
ADD COLUMN IF NOT EXISTS batch_position INT;

-- Add brand analysis from Call #4
ALTER TABLE audit_responses
ADD COLUMN IF NOT EXISTS mention_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_position_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS context_quality VARCHAR(20);

-- Add features and value props
ALTER TABLE audit_responses
ADD COLUMN IF NOT EXISTS features_mentioned JSONB,
ADD COLUMN IF NOT EXISTS value_props_highlighted JSONB;

-- Add additional metrics
ALTER TABLE audit_responses
ADD COLUMN IF NOT EXISTS competitors_analysis JSONB,
ADD COLUMN IF NOT EXISTS additional_metrics JSONB,
ADD COLUMN IF NOT EXISTS metrics_extracted_at TIMESTAMP;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_responses_category ON audit_responses(buyer_journey_category);
CREATE INDEX IF NOT EXISTS idx_responses_batch ON audit_responses(batch_id);
CREATE INDEX IF NOT EXISTS idx_responses_brand_mentioned ON audit_responses(brand_mentioned);
CREATE INDEX IF NOT EXISTS idx_responses_sentiment ON audit_responses(sentiment);
CREATE INDEX IF NOT EXISTS idx_responses_query ON audit_responses(query_text);

-- =====================================================
-- 2. buyer_journey_batch_insights Table
-- =====================================================

CREATE TABLE IF NOT EXISTS buyer_journey_batch_insights (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    batch_number INT NOT NULL,
    extraction_type VARCHAR(50) NOT NULL,
    insights JSONB NOT NULL,
    response_ids INTEGER[] NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (audit_id) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    CONSTRAINT unique_batch_insight UNIQUE (audit_id, category, batch_number, extraction_type)
);

CREATE INDEX IF NOT EXISTS idx_batch_insights_audit ON buyer_journey_batch_insights(audit_id);
CREATE INDEX IF NOT EXISTS idx_batch_insights_category ON buyer_journey_batch_insights(category);
CREATE INDEX IF NOT EXISTS idx_batch_insights_type ON buyer_journey_batch_insights(extraction_type);

COMMENT ON TABLE buyer_journey_batch_insights IS
'Phase 2 output: Raw insights from 96 LLM calls (4 calls × 24 batches)';

-- =====================================================
-- 3. category_aggregated_insights Table (Layer 1)
-- =====================================================

CREATE TABLE IF NOT EXISTS category_aggregated_insights (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    funnel_stage VARCHAR(50) NOT NULL,
    extraction_type VARCHAR(50) NOT NULL,
    insights JSONB NOT NULL,
    source_batch_ids INTEGER[] NOT NULL,
    company_context JSONB,
    persona_context JSONB,
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (audit_id) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    CONSTRAINT unique_category_insight UNIQUE (audit_id, category, extraction_type)
);

CREATE INDEX IF NOT EXISTS idx_category_insights_audit ON category_aggregated_insights(audit_id);
CREATE INDEX IF NOT EXISTS idx_category_insights_funnel ON category_aggregated_insights(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_category_insights_type ON category_aggregated_insights(extraction_type);
CREATE INDEX IF NOT EXISTS idx_category_insights_category ON category_aggregated_insights(category);

COMMENT ON TABLE category_aggregated_insights IS
'Layer 1 output: 18 LLM calls (6 categories × 3 types) - Top 3 personalized items per type per category';

-- =====================================================
-- 4. strategic_priorities Table (Layer 2)
-- =====================================================

CREATE TABLE IF NOT EXISTS strategic_priorities (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) NOT NULL,
    extraction_type VARCHAR(50) NOT NULL,
    rank INT NOT NULL,
    priority_data JSONB NOT NULL,
    source_categories VARCHAR[] NOT NULL,
    funnel_stages_impacted VARCHAR[] NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (audit_id) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    CONSTRAINT unique_strategic_priority UNIQUE (audit_id, extraction_type, rank)
);

CREATE INDEX IF NOT EXISTS idx_priorities_audit ON strategic_priorities(audit_id);
CREATE INDEX IF NOT EXISTS idx_priorities_rank ON strategic_priorities(rank);
CREATE INDEX IF NOT EXISTS idx_priorities_type ON strategic_priorities(extraction_type);

COMMENT ON TABLE strategic_priorities IS
'Layer 2 output: 3 LLM calls (3 types) - Top 3-5 strategic priorities per type across all categories';

-- =====================================================
-- 5. executive_summaries Table (Layer 3)
-- =====================================================

CREATE TABLE IF NOT EXISTS executive_summaries (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) NOT NULL,
    company_id INT NOT NULL,
    persona VARCHAR(100) NOT NULL,
    summary_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (audit_id) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT unique_executive_summary UNIQUE (audit_id)
);

CREATE INDEX IF NOT EXISTS idx_exec_summary_audit ON executive_summaries(audit_id);
CREATE INDEX IF NOT EXISTS idx_exec_summary_company ON executive_summaries(company_id);
CREATE INDEX IF NOT EXISTS idx_exec_summary_persona ON executive_summaries(persona);

COMMENT ON TABLE executive_summaries IS
'Layer 3 output: 1 LLM call - C-suite executive brief with strategic roadmap';

-- =====================================================
-- 6. Enhanced companies Table (Personalization)
-- =====================================================

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS growth_stage VARCHAR(50),
ADD COLUMN IF NOT EXISTS annual_revenue_range VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_persona VARCHAR(100),
ADD COLUMN IF NOT EXISTS innovation_focus VARCHAR(50),
ADD COLUMN IF NOT EXISTS business_model VARCHAR(50),
ADD COLUMN IF NOT EXISTS target_market JSONB,
ADD COLUMN IF NOT EXISTS strategic_goals JSONB,
ADD COLUMN IF NOT EXISTS employee_count INT;

-- Set default company_size based on existing data
UPDATE companies
SET company_size = CASE
    WHEN employee_count IS NULL THEN 'smb'
    WHEN employee_count < 50 THEN 'startup'
    WHEN employee_count < 200 THEN 'smb'
    WHEN employee_count < 1000 THEN 'midmarket'
    ELSE 'enterprise'
END
WHERE company_size IS NULL;

-- Set default growth_stage
UPDATE companies
SET growth_stage = COALESCE(growth_stage, 'growth')
WHERE growth_stage IS NULL;

-- Set default persona based on company size
UPDATE companies
SET primary_persona = CASE
    WHEN company_size = 'startup' THEN 'Founder/CEO'
    WHEN company_size = 'smb' THEN 'Marketing Director'
    WHEN company_size = 'midmarket' THEN 'CMO'
    WHEN company_size = 'enterprise' THEN 'VP of Marketing'
    ELSE 'Marketing Director'
END
WHERE primary_persona IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(company_size);
CREATE INDEX IF NOT EXISTS idx_companies_persona ON companies(primary_persona);
CREATE INDEX IF NOT EXISTS idx_companies_stage ON companies(growth_stage);

-- =====================================================
-- 7. Processing Metadata Table
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_processing_metadata (
    audit_id VARCHAR(255) PRIMARY KEY,
    total_llm_calls INT DEFAULT 0,
    phase2_calls INT DEFAULT 0,
    layer1_calls INT DEFAULT 0,
    layer2_calls INT DEFAULT 0,
    layer3_calls INT DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    processing_time_seconds INT DEFAULT 0,
    phase2_time_seconds INT DEFAULT 0,
    layer1_time_seconds INT DEFAULT 0,
    layer2_time_seconds INT DEFAULT 0,
    layer3_time_seconds INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (audit_id) REFERENCES ai_visibility_audits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processing_meta_audit ON audit_processing_metadata(audit_id);

COMMENT ON TABLE audit_processing_metadata IS
'Tracks LLM call counts, costs, and timing for each audit phase';

COMMIT;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Verify all tables exist
SELECT
    'buyer_journey_batch_insights' as table_name,
    COUNT(*) as row_count
FROM buyer_journey_batch_insights
UNION ALL
SELECT 'category_aggregated_insights', COUNT(*) FROM category_aggregated_insights
UNION ALL
SELECT 'strategic_priorities', COUNT(*) FROM strategic_priorities
UNION ALL
SELECT 'executive_summaries', COUNT(*) FROM executive_summaries
UNION ALL
SELECT 'audit_processing_metadata', COUNT(*) FROM audit_processing_metadata;

-- Verify columns added to existing tables
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'audit_responses'
AND column_name IN (
    'buyer_journey_category',
    'batch_id',
    'features_mentioned',
    'metrics_extracted_at'
)
ORDER BY column_name;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN (
    'company_size',
    'growth_stage',
    'primary_persona',
    'employee_count'
)
ORDER BY column_name;
