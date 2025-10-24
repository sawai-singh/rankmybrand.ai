-- Migration 012: Add Audit Reprocess Log Table
-- Purpose: Track all audit reprocessing attempts to detect infinite loops and provide audit trail
-- Date: 2025-10-24

-- Create audit reprocess log table
CREATE TABLE IF NOT EXISTS audit_reprocess_log (
    id SERIAL PRIMARY KEY,
    audit_id VARCHAR(255) NOT NULL,
    reprocess_attempt INT NOT NULL DEFAULT 0,
    reason VARCHAR(255),
    triggered_by VARCHAR(50),  -- 'stuck_monitor' | 'manual' | 'api'
    status_before VARCHAR(50),
    phase_before VARCHAR(50),
    status_after VARCHAR(50),
    phase_after VARCHAR(50),
    admin_user VARCHAR(255),   -- For manual interventions
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reprocess_audit ON audit_reprocess_log(audit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reprocess_recent ON audit_reprocess_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reprocess_triggered_by ON audit_reprocess_log(triggered_by, created_at DESC);

-- Foreign key constraint (soft - don't cascade delete)
ALTER TABLE audit_reprocess_log
  ADD CONSTRAINT fk_audit_reprocess
  FOREIGN KEY (audit_id)
  REFERENCES ai_visibility_audits(id)
  ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON TABLE audit_reprocess_log IS 'Tracks all audit reprocessing attempts for debugging infinite loops and monitoring system health. Used by admin dashboard loop detection feature.';

COMMENT ON COLUMN audit_reprocess_log.audit_id IS 'ID of the audit being reprocessed';
COMMENT ON COLUMN audit_reprocess_log.reprocess_attempt IS 'Attempt number (1-based). Max 3 attempts enforced by stuck monitor.';
COMMENT ON COLUMN audit_reprocess_log.reason IS 'Why reprocessing was triggered (e.g., "Stuck audit detected", "Manual admin fix")';
COMMENT ON COLUMN audit_reprocess_log.triggered_by IS 'Source: stuck_monitor (automatic), manual (admin dashboard), api (external call)';
COMMENT ON COLUMN audit_reprocess_log.status_before IS 'Audit status before reprocess attempt';
COMMENT ON COLUMN audit_reprocess_log.phase_before IS 'Audit phase before reprocess attempt';
COMMENT ON COLUMN audit_reprocess_log.status_after IS 'Audit status after reprocess attempt (NULL if not yet completed)';
COMMENT ON COLUMN audit_reprocess_log.phase_after IS 'Audit phase after reprocess attempt (NULL if not yet completed)';
COMMENT ON COLUMN audit_reprocess_log.admin_user IS 'Admin username if triggered manually via dashboard';
COMMENT ON COLUMN audit_reprocess_log.notes IS 'Additional notes or context about the reprocess';

-- Example queries for admin dashboard:

-- Get all reprocesses for a specific audit
-- SELECT * FROM audit_reprocess_log WHERE audit_id = '<audit-id>' ORDER BY created_at DESC;

-- Find potential infinite loops (audits reprocessed >3 times in last hour)
-- SELECT audit_id, COUNT(*) as reprocess_count, MAX(created_at) as last_attempt
-- FROM audit_reprocess_log
-- WHERE created_at > NOW() - INTERVAL '1 hour'
-- GROUP BY audit_id
-- HAVING COUNT(*) >= 3;

-- Get reprocess history for last 24 hours
-- SELECT r.*, a.company_name, a.status as current_status
-- FROM audit_reprocess_log r
-- LEFT JOIN ai_visibility_audits a ON r.audit_id = a.id
-- WHERE r.created_at > NOW() - INTERVAL '24 hours'
-- ORDER BY r.created_at DESC;
