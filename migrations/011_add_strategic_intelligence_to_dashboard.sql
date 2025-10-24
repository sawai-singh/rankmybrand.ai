-- Migration 011: Add Strategic Intelligence (118-call architecture) to dashboard_data
-- Adds Layer 1-3 outputs to the dashboard for display
-- Date: 2025-10-23

BEGIN;

-- =====================================================
-- 1. Add Layer 1-3 Columns to dashboard_data
-- =====================================================

-- Layer 1: Category-level insights (18 LLM calls)
-- Structure: { category: { extraction_type: [top 3 insights] } }
ALTER TABLE dashboard_data
ADD COLUMN IF NOT EXISTS category_insights JSONB;

-- Layer 2: Strategic priorities (3 LLM calls)
-- Structure: { extraction_type: [priorities ranked 1-5] }
ALTER TABLE dashboard_data
ADD COLUMN IF NOT EXISTS strategic_priorities JSONB;

-- Layer 3: Executive summary (1 LLM call)
-- Structure: Complete executive brief with roadmap, resource allocation, board presentation
ALTER TABLE dashboard_data
ADD COLUMN IF NOT EXISTS executive_summary_v2 JSONB;

-- Phase 2: Buyer journey batch insights summary
-- Structure: { category: { batch_number: { type: insights } } }
ALTER TABLE dashboard_data
ADD COLUMN IF NOT EXISTS buyer_journey_insights JSONB;

-- Metadata: LLM call tracking and performance
-- Structure: { total_calls, phase2_calls, layer1_calls, layer2_calls, layer3_calls, cost, timing }
ALTER TABLE dashboard_data
ADD COLUMN IF NOT EXISTS intelligence_metadata JSONB;

-- =====================================================
-- 2. Create Indexes for Efficient Querying
-- =====================================================

-- Index for category insights (for filtering by category)
CREATE INDEX IF NOT EXISTS idx_dashboard_category_insights
ON dashboard_data USING GIN (category_insights);

-- Index for strategic priorities (for filtering by priority type)
CREATE INDEX IF NOT EXISTS idx_dashboard_strategic_priorities
ON dashboard_data USING GIN (strategic_priorities);

-- Index for executive summary (for quick retrieval)
CREATE INDEX IF NOT EXISTS idx_dashboard_exec_summary_v2
ON dashboard_data USING GIN (executive_summary_v2);

-- =====================================================
-- 3. Add Column Comments for Documentation
-- =====================================================

COMMENT ON COLUMN dashboard_data.category_insights IS
'Layer 1 output: Top 3 personalized insights per type per category (18 LLM calls)';

COMMENT ON COLUMN dashboard_data.strategic_priorities IS
'Layer 2 output: Top 3-5 strategic priorities per type across categories (3 LLM calls)';

COMMENT ON COLUMN dashboard_data.executive_summary_v2 IS
'Layer 3 output: Complete C-suite executive brief with strategic roadmap (1 LLM call)';

COMMENT ON COLUMN dashboard_data.buyer_journey_insights IS
'Phase 2 output: Batch-level insights from buyer journey analysis (96 LLM calls)';

COMMENT ON COLUMN dashboard_data.intelligence_metadata IS
'Performance tracking for 118-call architecture (call counts, costs, timing)';

-- =====================================================
-- 4. Verification Queries
-- =====================================================

-- Verify columns exist
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'dashboard_data'
AND column_name IN (
    'category_insights',
    'strategic_priorities',
    'executive_summary_v2',
    'buyer_journey_insights',
    'intelligence_metadata'
)
ORDER BY column_name;

-- Verify indexes exist
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'dashboard_data'
AND indexname LIKE '%insights%'
OR indexname LIKE '%priorities%'
OR indexname LIKE '%exec_summary_v2%';

COMMIT;

-- Success message
SELECT '✅ Migration 011 complete: Strategic intelligence columns added to dashboard_data' as status;
