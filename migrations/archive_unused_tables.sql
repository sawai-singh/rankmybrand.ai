-- Archive unused tables identified in system analysis
-- These tables have no queries in the codebase
-- Run with: psql -U sawai -d rankmybrand -f archive_unused_tables.sql

BEGIN;

-- Create archive schema if not exists
CREATE SCHEMA IF NOT EXISTS archive;

-- Move unused tables to archive schema (preserves data)
ALTER TABLE IF EXISTS search_rankings SET SCHEMA archive;
ALTER TABLE IF EXISTS brand_mentions SET SCHEMA archive;
ALTER TABLE IF EXISTS ai_platform_scores SET SCHEMA archive;
ALTER TABLE IF EXISTS serp_analyses SET SCHEMA archive;
ALTER TABLE IF EXISTS content_gaps SET SCHEMA archive;
ALTER TABLE IF EXISTS analysis_history SET SCHEMA archive;
ALTER TABLE IF EXISTS user_notifications SET SCHEMA archive;
ALTER TABLE IF EXISTS audit_log SET SCHEMA archive;
ALTER TABLE IF EXISTS company_edit_history SET SCHEMA archive;
ALTER TABLE IF EXISTS user_journey_analytics SET SCHEMA archive;
ALTER TABLE IF EXISTS company_enrichment_log SET SCHEMA archive;
ALTER TABLE IF EXISTS report_events SET SCHEMA archive;

COMMIT;

-- To restore a table if needed:
-- ALTER TABLE archive.table_name SET SCHEMA public;

-- To completely remove archived tables:
-- DROP SCHEMA archive CASCADE;