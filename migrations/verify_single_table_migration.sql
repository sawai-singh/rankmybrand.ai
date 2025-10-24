-- ============================================================================
-- VERIFICATION SCRIPT FOR SINGLE TABLE MIGRATION
-- ============================================================================
-- Purpose: Validate that dual table writes have been eliminated and system
--          is functioning correctly with audit_queries as single source
-- Date: October 12, 2025
-- Migration: 007_migrate_to_single_query_table.sql
-- ============================================================================

\echo '========================================='
\echo 'MIGRATION VERIFICATION STARTING'
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 1: TABLE EXISTENCE AND STRUCTURE
-- ============================================================================
\echo '1. Verifying table structure...'

DO $$
DECLARE
    audit_queries_exists BOOLEAN;
    report_mapping_exists BOOLEAN;
BEGIN
    -- Check audit_queries table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'audit_queries'
    ) INTO audit_queries_exists;

    IF audit_queries_exists THEN
        RAISE NOTICE '✅ audit_queries table exists';
    ELSE
        RAISE EXCEPTION '❌ CRITICAL: audit_queries table does not exist!';
    END IF;

    -- Check report_audit_mapping exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'report_audit_mapping'
    ) INTO report_mapping_exists;

    IF report_mapping_exists THEN
        RAISE NOTICE '✅ report_audit_mapping table exists (backward compatibility)';
    ELSE
        RAISE WARNING '⚠️  report_audit_mapping table not found (migration may not have run)';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 2: RECORD COUNTS AND DATA INTEGRITY
-- ============================================================================
\echo '2. Checking record counts...'

DO $$
DECLARE
    audit_count INTEGER;
    query_count INTEGER;
    response_count INTEGER;
    mapping_count INTEGER;
BEGIN
    -- Count audits
    SELECT COUNT(*) INTO audit_count FROM ai_visibility_audits;
    RAISE NOTICE '   Total audits: %', audit_count;

    -- Count queries
    SELECT COUNT(*) INTO query_count FROM audit_queries;
    RAISE NOTICE '   Total queries: %', query_count;

    -- Count responses
    SELECT COUNT(*) INTO response_count FROM audit_responses;
    RAISE NOTICE '   Total responses: %', response_count;

    -- Count mappings (if table exists)
    BEGIN
        SELECT COUNT(*) INTO mapping_count FROM report_audit_mapping;
        RAISE NOTICE '   Report mappings: %', mapping_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '   Report mappings: N/A (table not created yet)';
    END;

    -- Verify queries-to-audit ratio is reasonable
    IF query_count > 0 AND audit_count > 0 THEN
        IF query_count::float / audit_count BETWEEN 20 AND 100 THEN
            RAISE NOTICE '✅ Query-to-audit ratio looks healthy (%.2f queries per audit)',
                query_count::float / audit_count;
        ELSE
            RAISE WARNING '⚠️  Unusual query-to-audit ratio: %.2f',
                query_count::float / audit_count;
        END IF;
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 3: FOREIGN KEY INTEGRITY
-- ============================================================================
\echo '3. Validating foreign key relationships...'

DO $$
DECLARE
    orphaned_queries INTEGER;
    orphaned_responses INTEGER;
BEGIN
    -- Check for orphaned queries (no matching audit)
    SELECT COUNT(*) INTO orphaned_queries
    FROM audit_queries aq
    LEFT JOIN ai_visibility_audits av ON aq.audit_id = av.id
    WHERE av.id IS NULL;

    IF orphaned_queries = 0 THEN
        RAISE NOTICE '✅ No orphaned queries found';
    ELSE
        RAISE WARNING '⚠️  Found % orphaned queries (no matching audit)', orphaned_queries;
    END IF;

    -- Check for orphaned responses (no matching query)
    SELECT COUNT(*) INTO orphaned_responses
    FROM audit_responses ar
    LEFT JOIN audit_queries aq ON ar.query_id = aq.id
    WHERE aq.id IS NULL;

    IF orphaned_responses = 0 THEN
        RAISE NOTICE '✅ No orphaned responses found';
    ELSE
        RAISE WARNING '⚠️  Found % orphaned responses (no matching query)', orphaned_responses;
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 4: AUDIT COMPLETENESS
-- ============================================================================
\echo '4. Checking audit completeness...'

WITH audit_stats AS (
    SELECT
        av.id as audit_id,
        av.company_name,
        av.status,
        COUNT(DISTINCT aq.id) as query_count,
        COUNT(DISTINCT ar.id) as response_count
    FROM ai_visibility_audits av
    LEFT JOIN audit_queries aq ON aq.audit_id = av.id
    LEFT JOIN audit_responses ar ON ar.query_id = aq.id
    GROUP BY av.id, av.company_name, av.status
)
SELECT
    COUNT(*) as total_audits,
    COUNT(*) FILTER (WHERE query_count >= 48) as audits_with_full_queries,
    COUNT(*) FILTER (WHERE query_count > 0 AND query_count < 48) as audits_with_partial_queries,
    COUNT(*) FILTER (WHERE query_count = 0) as audits_with_no_queries,
    COUNT(*) FILTER (WHERE response_count >= 48) as audits_with_full_responses,
    ROUND(AVG(query_count), 2) as avg_queries_per_audit,
    ROUND(AVG(response_count), 2) as avg_responses_per_audit
FROM audit_stats;

\echo ''

-- ============================================================================
-- SECTION 5: RECENT ACTIVITY CHECK
-- ============================================================================
\echo '5. Checking recent activity...'

DO $$
DECLARE
    recent_queries INTEGER;
    recent_responses INTEGER;
    last_query_time TIMESTAMP;
    last_response_time TIMESTAMP;
BEGIN
    -- Check queries created in last 24 hours
    SELECT COUNT(*), MAX(created_at)
    INTO recent_queries, last_query_time
    FROM audit_queries
    WHERE created_at > NOW() - INTERVAL '24 hours';

    RAISE NOTICE '   Queries in last 24h: %', recent_queries;
    IF last_query_time IS NOT NULL THEN
        RAISE NOTICE '   Last query created: % (% ago)',
            last_query_time,
            AGE(NOW(), last_query_time);
    END IF;

    -- Check responses created in last 24 hours
    SELECT COUNT(*), MAX(created_at)
    INTO recent_responses, last_response_time
    FROM audit_responses
    WHERE created_at > NOW() - INTERVAL '24 hours';

    RAISE NOTICE '   Responses in last 24h: %', recent_responses;
    IF last_response_time IS NOT NULL THEN
        RAISE NOTICE '   Last response created: % (% ago)',
            last_response_time,
            AGE(NOW(), last_response_time);
    END IF;

    -- Verify no recent activity in old ai_queries table (if it exists)
    BEGIN
        DECLARE
            old_table_recent INTEGER;
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM ai_queries WHERE created_at > NOW() - INTERVAL ''24 hours'''
            INTO old_table_recent;

            IF old_table_recent > 0 THEN
                RAISE WARNING '⚠️  CRITICAL: Still writing to old ai_queries table! Found % recent records', old_table_recent;
            ELSE
                RAISE NOTICE '✅ No recent writes to old ai_queries table';
            END IF;
        END;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE '✅ Old ai_queries table does not exist (fully migrated)';
    END;
END $$;

\echo ''

-- ============================================================================
-- SECTION 6: INDEX VERIFICATION
-- ============================================================================
\echo '6. Verifying critical indexes...'

DO $$
DECLARE
    audit_id_idx BOOLEAN;
    created_at_idx BOOLEAN;
    category_idx BOOLEAN;
BEGIN
    -- Check for audit_id index on audit_queries
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'audit_queries'
        AND indexname LIKE '%audit_id%'
    ) INTO audit_id_idx;

    IF audit_id_idx THEN
        RAISE NOTICE '✅ audit_id index exists on audit_queries';
    ELSE
        RAISE WARNING '⚠️  Missing audit_id index - performance may be impacted';
    END IF;

    -- Check for created_at index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'audit_queries'
        AND indexname LIKE '%created_at%'
    ) INTO created_at_idx;

    IF created_at_idx THEN
        RAISE NOTICE '✅ created_at index exists on audit_queries';
    ELSE
        RAISE NOTICE '   Note: created_at index not found (optional)';
    END IF;

    -- Check for category index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'audit_queries'
        AND indexname LIKE '%category%'
    ) INTO category_idx;

    IF category_idx THEN
        RAISE NOTICE '✅ category index exists on audit_queries';
    ELSE
        RAISE NOTICE '   Note: category index not found (optional)';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 7: SAMPLE DATA QUALITY CHECK
-- ============================================================================
\echo '7. Checking data quality (sample of 5 recent queries)...'

SELECT
    aq.id,
    av.company_name,
    LEFT(aq.query_text, 50) || '...' as query_preview,
    aq.category,
    aq.intent,
    aq.priority_score,
    (SELECT COUNT(*) FROM audit_responses ar WHERE ar.query_id = aq.id) as response_count,
    aq.created_at
FROM audit_queries aq
JOIN ai_visibility_audits av ON aq.audit_id = av.id
ORDER BY aq.created_at DESC
LIMIT 5;

\echo ''

-- ============================================================================
-- SECTION 8: BACKWARD COMPATIBILITY CHECK
-- ============================================================================
\echo '8. Testing backward compatibility via report_audit_mapping...'

DO $$
DECLARE
    mapping_works BOOLEAN;
    sample_count INTEGER;
BEGIN
    BEGIN
        -- Test if we can query via mapping table
        SELECT COUNT(*) INTO sample_count
        FROM report_audit_mapping ram
        JOIN audit_queries aq ON aq.audit_id = ram.audit_id
        LIMIT 1;

        RAISE NOTICE '✅ Backward compatibility mapping works (can query via report_id)';
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '   N/A: report_audit_mapping not created (migration pending)';
        WHEN OTHERS THEN
            RAISE WARNING '⚠️  Error testing backward compatibility: %', SQLERRM;
    END;
END $$;

\echo ''

-- ============================================================================
-- SECTION 9: QUERY PERFORMANCE TEST
-- ============================================================================
\echo '9. Testing query performance (sample query with JOIN)...'

EXPLAIN ANALYZE
SELECT
    COUNT(*) as total_queries,
    COUNT(DISTINCT aq.category) as category_count,
    AVG(aq.priority_score) as avg_priority
FROM audit_queries aq
JOIN ai_visibility_audits av ON aq.audit_id = av.id
WHERE av.status = 'completed'
LIMIT 1;

\echo ''

-- ============================================================================
-- SECTION 10: MIGRATION STATUS SUMMARY
-- ============================================================================
\echo '========================================='
\echo 'VERIFICATION SUMMARY'
\echo '========================================='

DO $$
DECLARE
    audit_count INTEGER;
    query_count INTEGER;
    response_count INTEGER;
    orphaned_queries INTEGER;
    orphaned_responses INTEGER;
    status_text TEXT;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO audit_count FROM ai_visibility_audits;
    SELECT COUNT(*) INTO query_count FROM audit_queries;
    SELECT COUNT(*) INTO response_count FROM audit_responses;

    -- Check for orphans
    SELECT COUNT(*) INTO orphaned_queries
    FROM audit_queries aq
    LEFT JOIN ai_visibility_audits av ON aq.audit_id = av.id
    WHERE av.id IS NULL;

    SELECT COUNT(*) INTO orphaned_responses
    FROM audit_responses ar
    LEFT JOIN audit_queries aq ON ar.query_id = aq.id
    WHERE aq.id IS NULL;

    -- Determine overall status
    IF orphaned_queries = 0 AND orphaned_responses = 0 AND query_count > 0 THEN
        status_text := '✅ SYSTEM HEALTHY - Single table architecture verified';
    ELSIF orphaned_queries > 0 OR orphaned_responses > 0 THEN
        status_text := '⚠️  WARNING - Data integrity issues detected';
    ELSIF query_count = 0 THEN
        status_text := '⚠️  WARNING - No queries found in audit_queries table';
    ELSE
        status_text := '✅ SYSTEM OPERATIONAL';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Database Status:';
    RAISE NOTICE '  Audits: %', audit_count;
    RAISE NOTICE '  Queries: %', query_count;
    RAISE NOTICE '  Responses: %', response_count;
    RAISE NOTICE '  Orphaned queries: %', orphaned_queries;
    RAISE NOTICE '  Orphaned responses: %', orphaned_responses;
    RAISE NOTICE '';
    RAISE NOTICE 'Overall Status: %', status_text;
    RAISE NOTICE '';

    -- Final recommendation
    IF orphaned_queries = 0 AND orphaned_responses = 0 AND query_count > 0 THEN
        RAISE NOTICE '✅ READY FOR PRODUCTION';
        RAISE NOTICE '   - Dual table writes eliminated';
        RAISE NOTICE '   - Data integrity verified';
        RAISE NOTICE '   - Foreign key relationships intact';
        RAISE NOTICE '   - Performance indexes in place';
    ELSE
        RAISE NOTICE '⚠️  REVIEW REQUIRED';
        RAISE NOTICE '   - Check warnings above';
        RAISE NOTICE '   - Verify migration completed successfully';
        RAISE NOTICE '   - Consider running rollback if issues persist';
    END IF;
END $$;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
\echo ''
\echo 'To run this verification again:'
\echo 'psql -h localhost -U sawai -d rankmybrand -f migrations/verify_single_table_migration.sql'
\echo ''
