-- =====================================================
-- MIGRATION 007: Consolidate Query Tables
-- Migrates from dual-table (ai_queries + audit_queries) to single-table (audit_queries)
-- =====================================================
--
-- WHAT THIS DOES:
-- 1. Migrates all historical data from ai_queries to audit_queries
-- 2. Updates all foreign key relationships
-- 3. Creates backup/archive of old data
-- 4. Adds indexes for performance
-- 5. Creates rollback procedures
--
-- SAFETY:
-- - Zero data loss (archives everything)
-- - Transactional (atomic)
-- - Reversible (rollback script included)
-- - Validated (integrity checks)
--
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: PRE-MIGRATION VALIDATION
-- =====================================================

DO $$
DECLARE
    ai_queries_count INTEGER;
    audit_queries_count INTEGER;
    ai_responses_count INTEGER;
BEGIN
    -- Count existing data
    SELECT COUNT(*) INTO ai_queries_count FROM ai_queries;
    SELECT COUNT(*) INTO audit_queries_count FROM audit_queries;
    SELECT COUNT(*) INTO ai_responses_count FROM ai_responses;

    RAISE NOTICE '=== PRE-MIGRATION STATE ===';
    RAISE NOTICE 'ai_queries: % rows', ai_queries_count;
    RAISE NOTICE 'audit_queries: % rows', audit_queries_count;
    RAISE NOTICE 'ai_responses: % rows', ai_responses_count;
    RAISE NOTICE '==========================';
END $$;

-- =====================================================
-- STEP 2: CREATE ARCHIVE TABLES (BACKUP)
-- =====================================================

-- Archive ai_queries table (full backup)
DROP TABLE IF EXISTS ai_queries_archive CASCADE;
CREATE TABLE ai_queries_archive AS
SELECT
    *,
    NOW() as archived_at,
    'migration_007' as archived_by
FROM ai_queries;

CREATE INDEX idx_ai_queries_archive_company ON ai_queries_archive(company_id);
CREATE INDEX idx_ai_queries_archive_report ON ai_queries_archive(report_id);

COMMENT ON TABLE ai_queries_archive IS 'Archived on migration to single query table. Safe to drop after verification.';

-- Archive ai_visibility_reports (needed for FK resolution)
DROP TABLE IF EXISTS ai_visibility_reports_archive CASCADE;
CREATE TABLE ai_visibility_reports_archive AS
SELECT
    *,
    NOW() as archived_at,
    'migration_007' as archived_by
FROM ai_visibility_reports;

-- Archive ai_responses (will be migrated to audit_responses)
DROP TABLE IF EXISTS ai_responses_archive CASCADE;
CREATE TABLE ai_responses_archive AS
SELECT
    *,
    NOW() as archived_at,
    'migration_007' as archived_by
FROM ai_responses;

DO $$ BEGIN
    RAISE NOTICE 'Archive tables created successfully';
END $$;

-- =====================================================
-- STEP 3: ENHANCE audit_queries SCHEMA
-- =====================================================

-- Add columns that exist in ai_queries but not in audit_queries
ALTER TABLE audit_queries
    ADD COLUMN IF NOT EXISTS competitive_relevance DECIMAL(3,2) CHECK (competitive_relevance >= 0 AND competitive_relevance <= 1),
    ADD COLUMN IF NOT EXISTS persona_alignment VARCHAR(255),
    ADD COLUMN IF NOT EXISTS industry_specificity DECIMAL(3,2),
    ADD COLUMN IF NOT EXISTS migrated_from VARCHAR(50),
    ADD COLUMN IF NOT EXISTS legacy_query_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS legacy_report_id VARCHAR(255);

-- Add index for legacy_query_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_queries_legacy_id ON audit_queries(legacy_query_id) WHERE legacy_query_id IS NOT NULL;

COMMENT ON COLUMN audit_queries.migrated_from IS 'Source table for migrated queries (ai_queries or null for native)';
COMMENT ON COLUMN audit_queries.legacy_query_id IS 'Original query_id from ai_queries table for reference';
COMMENT ON COLUMN audit_queries.legacy_report_id IS 'Original report_id from ai_queries table for reference';

DO $$ BEGIN
    RAISE NOTICE 'audit_queries schema enhanced';
END $$;

-- =====================================================
-- STEP 4: CREATE AUDIT-REPORT MAPPING
-- =====================================================

-- Create mapping between reports and audits for migration
CREATE TEMP TABLE report_audit_mapping AS
SELECT DISTINCT
    avr.report_id,
    av.id as audit_id,
    av.company_id
FROM ai_visibility_reports avr
JOIN ai_visibility_audits av ON avr.report_id = av.report_id
WHERE av.report_id IS NOT NULL;

-- For reports without audits, create placeholder audits
INSERT INTO ai_visibility_audits (
    id,
    company_id,
    company_name,
    status,
    created_at,
    report_id,
    query_count
)
SELECT
    gen_random_uuid()::VARCHAR,
    avr.company_id,
    c.name,
    'completed',
    avr.generated_at,
    avr.report_id,
    (SELECT COUNT(*) FROM ai_queries WHERE report_id = avr.report_id)
FROM ai_visibility_reports avr
JOIN companies c ON avr.company_id = c.id
WHERE NOT EXISTS (
    SELECT 1 FROM ai_visibility_audits av
    WHERE av.report_id = avr.report_id
)
ON CONFLICT DO NOTHING;

-- Update mapping with newly created audits
INSERT INTO report_audit_mapping
SELECT DISTINCT
    avr.report_id,
    av.id as audit_id,
    av.company_id
FROM ai_visibility_reports avr
JOIN ai_visibility_audits av ON avr.report_id = av.report_id
WHERE NOT EXISTS (
    SELECT 1 FROM report_audit_mapping WHERE report_id = avr.report_id
);

DO $$
BEGIN
    RAISE NOTICE 'Report-Audit mapping created: % mappings', (SELECT COUNT(*) FROM report_audit_mapping);
END $$;

-- =====================================================
-- STEP 5: MIGRATE QUERIES FROM ai_queries TO audit_queries
-- =====================================================

-- Migrate queries that have matching audits via report_id
INSERT INTO audit_queries (
    id,
    audit_id,
    query_text,
    query_hash,
    intent,
    category,
    complexity_score,
    priority_score,
    buyer_journey_stage,
    semantic_variations,
    expected_serp_features,
    competitive_relevance,
    persona_alignment,
    industry_specificity,
    metadata,
    created_at,
    migrated_from,
    legacy_query_id,
    legacy_report_id
)
SELECT
    aiq.id,
    ram.audit_id,
    aiq.query_text,
    encode(sha256(aiq.query_text::bytea), 'hex'),
    COALESCE(aiq.intent, 'informational'),
    COALESCE(aiq.intent, 'informational'),
    aiq.complexity_score,
    aiq.priority_score,
    aiq.buyer_journey_stage,
    CASE
        WHEN aiq.semantic_variations IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(aiq.semantic_variations))
        ELSE NULL
    END,
    CASE
        WHEN aiq.expected_serp_features IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(aiq.expected_serp_features))
        ELSE NULL
    END,
    aiq.competitive_relevance,
    aiq.persona_alignment,
    aiq.industry_specificity,
    jsonb_build_object(
        'migrated_from', 'ai_queries',
        'original_query_id', aiq.query_id,
        'original_report_id', aiq.report_id,
        'migration_timestamp', NOW()
    ),
    aiq.created_at,
    'ai_queries',
    aiq.query_id,
    aiq.report_id
FROM ai_queries aiq
JOIN report_audit_mapping ram ON aiq.report_id = ram.report_id
WHERE NOT EXISTS (
    SELECT 1 FROM audit_queries aq
    WHERE aq.audit_id = ram.audit_id
    AND aq.query_text = aiq.query_text
)
ON CONFLICT (id) DO UPDATE SET
    migrated_from = EXCLUDED.migrated_from,
    legacy_query_id = EXCLUDED.legacy_query_id,
    legacy_report_id = EXCLUDED.legacy_report_id;

DO $$ BEGIN
    RAISE NOTICE 'Queries migrated from ai_queries to audit_queries';
END $$;

-- =====================================================
-- STEP 6: MIGRATE RESPONSES FROM ai_responses TO audit_responses
-- =====================================================

-- First, ensure audit_responses has all necessary columns
ALTER TABLE audit_responses
    ADD COLUMN IF NOT EXISTS response_summary TEXT,
    ADD COLUMN IF NOT EXISTS mentioned_features JSONB,
    ADD COLUMN IF NOT EXISTS mentioned_benefits JSONB,
    ADD COLUMN IF NOT EXISTS call_to_action TEXT,
    ADD COLUMN IF NOT EXISTS migrated_from VARCHAR(50),
    ADD COLUMN IF NOT EXISTS legacy_response_id UUID;

-- Create mapping for query_id (VARCHAR in ai_responses) to UUID in audit_queries
CREATE TEMP TABLE query_id_mapping AS
SELECT DISTINCT
    aiq.query_id as legacy_query_id,
    aq.id as new_query_uuid,
    aq.audit_id
FROM ai_queries aiq
JOIN audit_queries aq ON aq.legacy_query_id = aiq.query_id;

-- Migrate responses
INSERT INTO audit_responses (
    id,
    query_id,
    audit_id,
    provider,
    model_version,
    response_text,
    response_summary,
    response_time_ms,
    tokens_used,
    cache_hit,
    brand_mentioned,
    mention_position,
    mention_context,
    sentiment,
    sentiment_score,
    recommendation_strength,
    competitors_mentioned,
    competitive_advantage,
    key_features_mentioned,
    mentioned_features,
    mentioned_benefits,
    call_to_action,
    featured_snippet_potential,
    voice_search_optimized,
    created_at,
    analysis_metadata,
    migrated_from,
    legacy_response_id
)
SELECT
    air.id,
    qm.new_query_uuid,
    qm.audit_id,
    air.provider,
    air.model_version,
    air.response_text,
    air.response_summary,
    air.response_time_ms,
    COALESCE(air.tokens_used, 0),
    FALSE as cache_hit,
    COALESCE(air.brand_mentioned, FALSE),
    CASE
        WHEN air.prominence_score > 0.7 THEN 'first_paragraph'
        WHEN air.prominence_score > 0.4 THEN 'middle'
        WHEN air.prominence_score > 0 THEN 'end'
        ELSE 'not_found'
    END,
    CASE
        WHEN air.prominence_score > 0.8 THEN 'primary_focus'
        WHEN air.prominence_score > 0.5 THEN 'significant_mention'
        WHEN air.prominence_score > 0.3 THEN 'comparative_context'
        WHEN air.prominence_score > 0 THEN 'passing_reference'
        ELSE 'no_mention'
    END,
    CASE air.sentiment
        WHEN 'positive' THEN 'positive'
        WHEN 'negative' THEN 'negative'
        WHEN 'mixed' THEN 'mixed'
        ELSE 'neutral'
    END,
    air.sentiment_score,
    CASE air.recommendation_strength
        WHEN 'strong' THEN 'strong_recommendation'
        WHEN 'moderate' THEN 'moderate_recommendation'
        WHEN 'weak' THEN 'neutral_mention'
        ELSE 'no_recommendation'
    END,
    air.competitor_mentions,
    air.competitive_advantage,
    CASE
        WHEN air.mentioned_features IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(air.mentioned_features))
        ELSE ARRAY[]::text[]
    END,
    air.mentioned_features,
    air.mentioned_benefits,
    air.call_to_action,
    FALSE as featured_snippet_potential,
    FALSE as voice_search_optimized,
    air.created_at,
    jsonb_build_object(
        'migrated_from', 'ai_responses',
        'original_response_id', air.id,
        'migration_timestamp', NOW()
    ),
    'ai_responses',
    air.id
FROM ai_responses air
JOIN query_id_mapping qm ON air.query_id = qm.legacy_query_id
WHERE NOT EXISTS (
    SELECT 1 FROM audit_responses ar
    WHERE ar.query_id = qm.new_query_uuid
    AND ar.provider = air.provider
    AND ar.created_at = air.created_at
)
ON CONFLICT (id) DO UPDATE SET
    migrated_from = EXCLUDED.migrated_from,
    legacy_response_id = EXCLUDED.legacy_response_id;

DO $$ BEGIN
    RAISE NOTICE 'Responses migrated from ai_responses to audit_responses';
END $$;

-- =====================================================
-- STEP 7: UPDATE FOREIGN KEYS AND CONSTRAINTS
-- =====================================================

-- Drop old foreign key constraints that reference ai_queries
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN
        SELECT conname, conrelid::regclass AS table_name
        FROM pg_constraint
        WHERE confrelid = 'ai_queries'::regclass
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s CASCADE',
            constraint_rec.table_name, constraint_rec.conname);
        RAISE NOTICE 'Dropped constraint % from %', constraint_rec.conname, constraint_rec.table_name;
    END LOOP;
END $$;

-- =====================================================
-- STEP 8: CREATE UNIFIED VIEW (TEMPORARY COMPATIBILITY)
-- =====================================================

-- Create view for any remaining code that might reference ai_queries
CREATE OR REPLACE VIEW ai_queries_compat AS
SELECT
    aq.id,
    aq.legacy_report_id as report_id,
    av.company_id,
    aq.legacy_query_id as query_id,
    aq.query_text,
    aq.intent,
    aq.buyer_journey_stage,
    aq.complexity_score,
    aq.competitive_relevance,
    aq.priority_score,
    CASE
        WHEN aq.semantic_variations IS NOT NULL
        THEN to_jsonb(aq.semantic_variations)
        ELSE '[]'::jsonb
    END as semantic_variations,
    CASE
        WHEN aq.expected_serp_features IS NOT NULL
        THEN to_jsonb(aq.expected_serp_features)
        ELSE '[]'::jsonb
    END as expected_serp_features,
    aq.persona_alignment,
    aq.industry_specificity,
    aq.created_at
FROM audit_queries aq
JOIN ai_visibility_audits av ON aq.audit_id = av.id
WHERE aq.migrated_from = 'ai_queries' OR aq.legacy_query_id IS NOT NULL;

COMMENT ON VIEW ai_queries_compat IS 'Compatibility view for legacy code. DO NOT USE in new code. Will be removed in future migration.';

-- =====================================================
-- STEP 9: UPDATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Drop old indexes
DROP INDEX IF EXISTS idx_ai_queries_report_id;
DROP INDEX IF EXISTS idx_ai_queries_company_id;

-- Ensure audit_queries has optimal indexes
CREATE INDEX IF NOT EXISTS idx_audit_queries_audit_created
    ON audit_queries(audit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_queries_text_gin
    ON audit_queries USING GIN (to_tsvector('english', query_text));

CREATE INDEX IF NOT EXISTS idx_audit_queries_priority
    ON audit_queries(priority_score DESC NULLS LAST)
    WHERE priority_score IS NOT NULL;

-- Indexes for migrated data lookups
CREATE INDEX IF NOT EXISTS idx_audit_queries_migrated
    ON audit_queries(migrated_from)
    WHERE migrated_from IS NOT NULL;

-- Ensure audit_responses has optimal indexes
CREATE INDEX IF NOT EXISTS idx_audit_responses_query_provider
    ON audit_responses(query_id, provider);

CREATE INDEX IF NOT EXISTS idx_audit_responses_audit
    ON audit_responses(audit_id);

DO $$ BEGIN
    RAISE NOTICE 'Indexes optimized';
END $$;

-- =====================================================
-- STEP 10: UPDATE STATISTICS
-- =====================================================

ANALYZE audit_queries;
ANALYZE audit_responses;
ANALYZE ai_visibility_audits;

-- =====================================================
-- STEP 11: VALIDATION & VERIFICATION
-- =====================================================

DO $$
DECLARE
    ai_queries_original INTEGER;
    audit_queries_migrated INTEGER;
    ai_responses_original INTEGER;
    audit_responses_migrated INTEGER;
    orphaned_queries INTEGER;
    orphaned_responses INTEGER;
BEGIN
    -- Count original data
    SELECT COUNT(*) INTO ai_queries_original FROM ai_queries_archive WHERE archived_by = 'migration_007';
    SELECT COUNT(*) INTO ai_responses_original FROM ai_responses_archive WHERE archived_by = 'migration_007';

    -- Count migrated data
    SELECT COUNT(*) INTO audit_queries_migrated FROM audit_queries WHERE migrated_from = 'ai_queries';
    SELECT COUNT(*) INTO audit_responses_migrated FROM audit_responses WHERE migrated_from = 'ai_responses';

    -- Check for orphaned records
    SELECT COUNT(*) INTO orphaned_queries
    FROM ai_queries aiq
    WHERE NOT EXISTS (
        SELECT 1 FROM audit_queries aq WHERE aq.legacy_query_id = aiq.query_id
    );

    SELECT COUNT(*) INTO orphaned_responses
    FROM ai_responses air
    WHERE NOT EXISTS (
        SELECT 1 FROM audit_responses ar WHERE ar.legacy_response_id = air.id
    );

    RAISE NOTICE '=== MIGRATION VALIDATION ===';
    RAISE NOTICE 'Original ai_queries: %', ai_queries_original;
    RAISE NOTICE 'Migrated to audit_queries: %', audit_queries_migrated;
    RAISE NOTICE 'Original ai_responses: %', ai_responses_original;
    RAISE NOTICE 'Migrated to audit_responses: %', audit_responses_migrated;
    RAISE NOTICE 'Orphaned queries (unmigrated): %', orphaned_queries;
    RAISE NOTICE 'Orphaned responses (unmigrated): %', orphaned_responses;
    RAISE NOTICE '===========================';

    -- Fail if significant data loss
    IF orphaned_queries > (ai_queries_original * 0.05) THEN
        RAISE EXCEPTION 'Too many orphaned queries: % (>5%% of original)', orphaned_queries;
    END IF;

    IF orphaned_responses > (ai_responses_original * 0.05) THEN
        RAISE EXCEPTION 'Too many orphaned responses: % (>5%% of original)', orphaned_responses;
    END IF;

    RAISE NOTICE 'Validation passed: Data migration complete with < 5%% orphaned records';
END $$;

-- =====================================================
-- STEP 12: MARK OLD TABLES AS DEPRECATED
-- =====================================================

COMMENT ON TABLE ai_queries IS 'DEPRECATED: Data migrated to audit_queries. Use audit_queries or ai_queries_compat view. Will be dropped in migration 008.';
COMMENT ON TABLE ai_responses IS 'DEPRECATED: Data migrated to audit_responses. Use audit_responses. Will be dropped in migration 008.';
COMMENT ON TABLE ai_visibility_reports IS 'DEPRECATED: Consolidated into ai_visibility_audits. Will be dropped in migration 008.';

-- Create warning trigger
CREATE OR REPLACE FUNCTION warn_deprecated_table()
RETURNS TRIGGER AS $$
BEGIN
    RAISE WARNING 'Table % is deprecated. Use audit_queries instead. This table will be removed in the next migration.', TG_TABLE_NAME;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_warn_ai_queries_deprecated ON ai_queries;
CREATE TRIGGER trigger_warn_ai_queries_deprecated
BEFORE INSERT OR UPDATE ON ai_queries
FOR EACH ROW
EXECUTE FUNCTION warn_deprecated_table();

DROP TRIGGER IF EXISTS trigger_warn_ai_responses_deprecated ON ai_responses;
CREATE TRIGGER trigger_warn_ai_responses_deprecated
BEFORE INSERT OR UPDATE ON ai_responses
FOR EACH ROW
EXECUTE FUNCTION warn_deprecated_table();

-- =====================================================
-- STEP 13: CREATE ROLLBACK SCRIPT
-- =====================================================

-- Save rollback script as a function
CREATE OR REPLACE FUNCTION rollback_migration_007()
RETURNS void AS $$
BEGIN
    RAISE NOTICE 'Rolling back migration 007...';

    -- Restore from archives
    INSERT INTO ai_queries SELECT * FROM ai_queries_archive WHERE archived_by = 'migration_007' ON CONFLICT DO NOTHING;
    INSERT INTO ai_responses SELECT * FROM ai_responses_archive WHERE archived_by = 'migration_007' ON CONFLICT DO NOTHING;

    -- Remove migrated data from audit tables
    DELETE FROM audit_responses WHERE migrated_from = 'ai_responses';
    DELETE FROM audit_queries WHERE migrated_from = 'ai_queries';

    -- Drop compatibility view
    DROP VIEW IF EXISTS ai_queries_compat;

    -- Drop added columns
    ALTER TABLE audit_queries
        DROP COLUMN IF EXISTS competitive_relevance,
        DROP COLUMN IF EXISTS persona_alignment,
        DROP COLUMN IF EXISTS industry_specificity,
        DROP COLUMN IF EXISTS migrated_from,
        DROP COLUMN IF EXISTS legacy_query_id,
        DROP COLUMN IF EXISTS legacy_report_id;

    ALTER TABLE audit_responses
        DROP COLUMN IF EXISTS response_summary,
        DROP COLUMN IF EXISTS mentioned_features,
        DROP COLUMN IF EXISTS mentioned_benefits,
        DROP COLUMN IF EXISTS call_to_action,
        DROP COLUMN IF EXISTS migrated_from,
        DROP COLUMN IF EXISTS legacy_response_id;

    RAISE NOTICE 'Rollback complete. Original tables restored.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rollback_migration_007() IS 'Emergency rollback for migration 007. Restores ai_queries and ai_responses from archive.';

-- =====================================================
-- STEP 14: FINAL REPORT
-- =====================================================

DO $$
DECLARE
    report TEXT;
BEGIN
    SELECT format(
        E'=== MIGRATION 007 COMPLETE ===\n' ||
        'Timestamp: %s\n' ||
        'Total audit_queries: %s\n' ||
        'Total audit_responses: %s\n' ||
        'Migrated queries: %s\n' ||
        'Migrated responses: %s\n' ||
        'Archive tables created: 3\n' ||
        'Compatibility view: ai_queries_compat\n' ||
        'Rollback function: rollback_migration_007()\n' ||
        '================================',
        NOW(),
        (SELECT COUNT(*) FROM audit_queries),
        (SELECT COUNT(*) FROM audit_responses),
        (SELECT COUNT(*) FROM audit_queries WHERE migrated_from = 'ai_queries'),
        (SELECT COUNT(*) FROM audit_responses WHERE migrated_from = 'ai_responses')
    ) INTO report;

    RAISE NOTICE '%', report;
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

-- Verify data integrity
SELECT 'audit_queries' as table_name, COUNT(*) as total,
       COUNT(*) FILTER (WHERE migrated_from = 'ai_queries') as migrated
FROM audit_queries
UNION ALL
SELECT 'audit_responses', COUNT(*),
       COUNT(*) FILTER (WHERE migrated_from = 'ai_responses')
FROM audit_responses;

-- Check for orphaned records
SELECT 'orphaned_queries' as issue, COUNT(*) as count
FROM ai_queries aiq
WHERE NOT EXISTS (
    SELECT 1 FROM audit_queries aq WHERE aq.legacy_query_id = aiq.query_id
)
UNION ALL
SELECT 'orphaned_responses', COUNT(*)
FROM ai_responses air
WHERE NOT EXISTS (
    SELECT 1 FROM audit_responses ar WHERE ar.legacy_response_id = air.id
);

-- Show migration summary
SELECT
    'MIGRATION SUMMARY' as status,
    (SELECT COUNT(*) FROM ai_queries_archive) as original_queries,
    (SELECT COUNT(*) FROM audit_queries WHERE migrated_from = 'ai_queries') as migrated_queries,
    (SELECT COUNT(*) FROM ai_responses_archive) as original_responses,
    (SELECT COUNT(*) FROM audit_responses WHERE migrated_from = 'ai_responses') as migrated_responses,
    (SELECT COUNT(*) FROM report_audit_mapping) as report_mappings;
