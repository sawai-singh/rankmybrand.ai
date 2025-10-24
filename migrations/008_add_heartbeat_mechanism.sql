-- Migration 008: Add Heartbeat Mechanism for Audit Processing
-- This migration adds a last_heartbeat column to track audit processing activity
-- and help detect truly stuck audits vs. actively processing audits

-- Add last_heartbeat column to ai_visibility_audits table
ALTER TABLE ai_visibility_audits
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for efficient heartbeat-based queries
CREATE INDEX IF NOT EXISTS idx_audit_heartbeat ON ai_visibility_audits(last_heartbeat)
WHERE status = 'processing';

-- Update existing processing audits to have current timestamp
UPDATE ai_visibility_audits
SET last_heartbeat = CURRENT_TIMESTAMP
WHERE status = 'processing' AND last_heartbeat IS NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN ai_visibility_audits.last_heartbeat IS
'Timestamp of last activity during audit processing. Updated periodically to detect stuck audits. NULL means audit has not started processing yet.';

-- Verification query
SELECT
    'Migration 008 Applied Successfully' as status,
    COUNT(*) as total_audits,
    COUNT(last_heartbeat) as audits_with_heartbeat,
    COUNT(*) FILTER (WHERE status = 'processing' AND last_heartbeat IS NOT NULL) as processing_with_heartbeat
FROM ai_visibility_audits;
