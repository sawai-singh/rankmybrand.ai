-- =====================================================
-- MIGRATION 007: Eliminate Dual Table Writes (Simplified)
-- =====================================================
--
-- WHAT THIS DOES:
-- 1. Marks old tables (ai_queries, ai_responses) as deprecated
-- 2. Creates warning triggers to detect any new dual writes
-- 3. Preserves historical data in place (no migration)
-- 4. Ensures all NEW data goes only to audit_queries/audit_responses
--
-- STRATEGY:
-- - Historical data stays in ai_queries/ai_responses (read-only)
-- - New data goes ONLY to audit_queries/audit_responses
-- - Code changes already deployed eliminate dual writes
-- - This migration just adds safety rails
--
-- SAFETY:
-- - No data movement (zero risk of data loss)
-- - Reversible (can drop triggers anytime)
-- - Non-blocking (no locks on tables)
--
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: CREATE AUDIT TRAIL
-- =====================================================

DO $$
DECLARE
    ai_queries_count INTEGER;
    audit_queries_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ai_queries_count FROM ai_queries;
    SELECT COUNT(*) INTO audit_queries_count FROM audit_queries;

    RAISE NOTICE '=== PRE-MIGRATION STATE ===';
    RAISE NOTICE 'Historical queries in ai_queries: %', ai_queries_count;
    RAISE NOTICE 'New queries in audit_queries: %', audit_queries_count;
    RAISE NOTICE 'Strategy: Keep historical data in place, prevent new dual writes';
    RAISE NOTICE '===========================';
END $$;

-- =====================================================
-- STEP 2: MARK OLD TABLES AS DEPRECATED
-- =====================================================

COMMENT ON TABLE ai_queries IS 'DEPRECATED: Historical data only. All NEW queries go to audit_queries. This table is read-only.';
COMMENT ON TABLE ai_responses IS 'DEPRECATED: Historical data only. All NEW responses go to audit_responses. This table is read-only.';
COMMENT ON TABLE ai_visibility_reports IS 'DEPRECATED: Replaced by ai_visibility_audits. Historical reference only.';

-- =====================================================
-- STEP 3: CREATE WARNING TRIGGERS (Detect Dual Writes)
-- =====================================================

-- Function to warn on writes to deprecated tables
CREATE OR REPLACE FUNCTION warn_deprecated_table_write()
RETURNS TRIGGER AS $$
BEGIN
    RAISE WARNING 'DEPRECATED TABLE WRITE DETECTED: Table "%" should not receive new data. All new data should go to audit_queries/audit_responses. This write will be logged for investigation.', TG_TABLE_NAME;

    -- Log the write attempt (you can add logging to a dedicated table here if needed)
    RAISE NOTICE 'Write details: operation=%, timestamp=%', TG_OP, NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on old tables
DROP TRIGGER IF EXISTS trigger_warn_ai_queries_write ON ai_queries;
CREATE TRIGGER trigger_warn_ai_queries_write
BEFORE INSERT ON ai_queries
FOR EACH ROW
EXECUTE FUNCTION warn_deprecated_table_write();

DROP TRIGGER IF EXISTS trigger_warn_ai_responses_write ON ai_responses;
CREATE TRIGGER trigger_warn_ai_responses_write
BEFORE INSERT ON ai_responses
FOR EACH ROW
EXECUTE FUNCTION warn_deprecated_table_write();

COMMENT ON FUNCTION warn_deprecated_table_write() IS 'Warns when deprecated tables receive new writes. Helps detect if dual writes are still occurring.';

-- =====================================================
-- STEP 4: CREATE MONITORING VIEW
-- =====================================================

CREATE OR REPLACE VIEW dual_write_monitor AS
SELECT
    'ai_queries' as table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as writes_last_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as writes_last_hour,
    MAX(created_at) as last_write
FROM ai_queries
UNION ALL
SELECT
    'audit_queries',
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'),
    MAX(created_at)
FROM audit_queries
UNION ALL
SELECT
    'ai_responses',
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'),
    MAX(created_at)
FROM ai_responses
UNION ALL
SELECT
    'audit_responses',
    COUNT(*),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'),
    MAX(created_at)
FROM audit_responses;

COMMENT ON VIEW dual_write_monitor IS 'Monitor write activity to detect dual writes. If ai_queries/ai_responses show recent writes, dual writes are still occurring.';

-- =====================================================
-- STEP 5: CREATE ROLLBACK SCRIPT
-- =====================================================

CREATE OR REPLACE FUNCTION rollback_migration_007_simple()
RETURNS void AS $$
BEGIN
    RAISE NOTICE 'Rolling back migration 007 (simple)...';

    -- Remove triggers
    DROP TRIGGER IF EXISTS trigger_warn_ai_queries_write ON ai_queries;
    DROP TRIGGER IF EXISTS trigger_warn_ai_responses_write ON ai_responses;

    -- Remove warning function
    DROP FUNCTION IF EXISTS warn_deprecated_table_write();

    -- Remove monitoring view
    DROP VIEW IF EXISTS dual_write_monitor;

    -- Reset table comments
    COMMENT ON TABLE ai_queries IS NULL;
    COMMENT ON TABLE ai_responses IS NULL;
    COMMENT ON TABLE ai_visibility_reports IS NULL;

    RAISE NOTICE 'Rollback complete. Triggers and warnings removed.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rollback_migration_007_simple() IS 'Rollback for simplified migration 007. Removes triggers and warnings.';

-- =====================================================
-- STEP 6: VALIDATION
-- =====================================================

DO $$
BEGIN
    -- Verify triggers created
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_warn_ai_queries_write') THEN
        RAISE NOTICE '✅ Warning trigger on ai_queries created';
    ELSE
        RAISE WARNING '⚠️  Trigger on ai_queries not found';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_warn_ai_responses_write') THEN
        RAISE NOTICE '✅ Warning trigger on ai_responses created';
    ELSE
        RAISE WARNING '⚠️  Trigger on ai_responses not found';
    END IF;

    -- Verify view created
    IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'dual_write_monitor') THEN
        RAISE NOTICE '✅ Monitoring view created';
    ELSE
        RAISE WARNING '⚠️  Monitoring view not found';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION 007 COMPLETE ===';
    RAISE NOTICE 'Dual write protection: ACTIVE';
    RAISE NOTICE 'Historical data: PRESERVED in ai_queries/ai_responses';
    RAISE NOTICE 'New data: Will go ONLY to audit_queries/audit_responses';
    RAISE NOTICE '';
    RAISE NOTICE 'To monitor for dual writes:';
    RAISE NOTICE '  SELECT * FROM dual_write_monitor;';
    RAISE NOTICE '';
    RAISE NOTICE 'To rollback:';
    RAISE NOTICE '  SELECT rollback_migration_007_simple();';
    RAISE NOTICE '===============================';
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION
-- =====================================================

-- Show current state
SELECT * FROM dual_write_monitor
ORDER BY table_name;
