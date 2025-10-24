-- Migration 009: Add buyer_journey_category to audit_queries
-- This preserves the 6-category buyer journey classification
-- Created: 2025-10-22
-- World-class implementation for buyer-journey batching

BEGIN;

-- Add query_category column to store 6 buyer journey categories
ALTER TABLE audit_queries
ADD COLUMN IF NOT EXISTS query_category VARCHAR(50);

-- Create index for efficient buyer-journey grouping
CREATE INDEX IF NOT EXISTS idx_audit_queries_category
ON audit_queries(audit_id, query_category);

-- Add comment for documentation
COMMENT ON COLUMN audit_queries.query_category IS
'Buyer journey category: problem_unaware, solution_seeking, brand_specific, comparison, purchase_intent, use_case';

COMMENT ON COLUMN audit_queries.buyer_journey_stage IS
'Simplified 3-stage: awareness, consideration, decision (for backward compatibility)';

COMMENT ON COLUMN audit_queries.category IS
'Legacy field: stores buyer_journey_stage value (duplicate for backward compatibility)';

-- Verify the change
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_queries'
        AND column_name = 'query_category'
    ) THEN
        RAISE NOTICE '✅ Migration 009 successful: query_category column added';
    ELSE
        RAISE EXCEPTION '❌ Migration 009 failed: query_category column not created';
    END IF;
END $$;

COMMIT;

-- Display sample data structure
SELECT
    'Migration 009 Complete' as status,
    'audit_queries.query_category' as new_column,
    'Values: problem_unaware | solution_seeking | brand_specific | comparison | purchase_intent | use_case' as possible_values;
