/**
 * Migration 012: System Control Center Performance Indexes
 * Adds critical indexes for admin dashboard queries
 * Created: 2025-10-23
 */

-- Index for active audits monitoring (status = 'processing')
CREATE INDEX IF NOT EXISTS idx_audits_status_started
ON ai_visibility_audits(status, started_at DESC)
WHERE status = 'processing';

-- Index for completed audits in last 24h (performance metrics)
CREATE INDEX IF NOT EXISTS idx_audits_completed_at
ON ai_visibility_audits(completed_at DESC)
WHERE status = 'completed' AND completed_at IS NOT NULL;

-- Index for audit by status (general filtering)
CREATE INDEX IF NOT EXISTS idx_audits_status
ON ai_visibility_audits(status)
WHERE status IN ('processing', 'failed', 'completed', 'cancelled');

-- Composite index for recent audits list
CREATE INDEX IF NOT EXISTS idx_audits_created_status
ON ai_visibility_audits(created_at DESC, status);

-- Index for company audits lookup
CREATE INDEX IF NOT EXISTS idx_audits_company_created
ON ai_visibility_audits(company_id, created_at DESC);

-- Analyze tables for query planner
ANALYZE ai_visibility_audits;
ANALYZE audit_queries;
ANALYZE audit_responses;
ANALYZE dashboard_data;

-- Verification queries (should use indexes)
EXPLAIN ANALYZE
SELECT * FROM ai_visibility_audits
WHERE status = 'processing'
ORDER BY started_at DESC;

EXPLAIN ANALYZE
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
FROM ai_visibility_audits
WHERE status = 'completed'
  AND started_at IS NOT NULL
  AND completed_at > NOW() - INTERVAL '24 hours';

-- Success message
SELECT
  'Migration 012 completed successfully!' as message,
  COUNT(*) FILTER (WHERE status = 'processing') as active_audits,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_audits,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_audits
FROM ai_visibility_audits;
