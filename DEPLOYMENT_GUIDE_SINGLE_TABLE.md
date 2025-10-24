# Deployment Guide: Single Table Architecture Migration

## Overview

This guide provides step-by-step instructions for deploying the single table architecture migration that eliminates dual writes and reduces database operations by 50%.

**Migration**: `007_migrate_to_single_query_table.sql`
**Date**: October 12, 2025
**Impact**: Eliminates dual table writes (96 writes → 48 writes per audit)

---

## Pre-Deployment Checklist

### 1. Environment Preparation

- [ ] All code changes committed to version control
- [ ] Staging environment available for testing
- [ ] Database backup schedule verified
- [ ] Rollback plan reviewed and understood
- [ ] Maintenance window scheduled (recommended: 30-60 minutes)

### 2. Required Access

- [ ] Database admin credentials (PostgreSQL)
- [ ] SSH access to API Gateway server
- [ ] SSH access to Intelligence Engine server
- [ ] Access to application logs
- [ ] Access to monitoring dashboard

### 3. Dependencies Check

```bash
# Verify PostgreSQL version (requires 12+)
psql --version

# Verify all services are running
ps aux | grep node         # API Gateway
ps aux | grep python       # Intelligence Engine
ps aux | grep redis        # Redis queue

# Check database connection
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "SELECT version();"
```

---

## Deployment Steps

### Phase 1: Pre-Migration Backup (Critical)

**Estimated Time**: 5-10 minutes

```bash
# 1. Create full database backup
pg_dump -h localhost -U sawai -d rankmybrand \
  -F custom \
  -f "backup_before_single_table_migration_$(date +%Y%m%d_%H%M%S).dump"

# 2. Verify backup was created
ls -lh backup_before_single_table_migration_*.dump

# 3. Test backup restoration (optional but recommended)
# Create test database
createdb -h localhost -U sawai rankmybrand_test

# Restore to test database
pg_restore -h localhost -U sawai -d rankmybrand_test \
  backup_before_single_table_migration_*.dump

# Verify test database
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand_test \
  -c "SELECT COUNT(*) FROM ai_visibility_audits;"

# Clean up test database
dropdb -h localhost -U sawai rankmybrand_test
```

**Success Criteria**: ✅ Backup file created and verified

---

### Phase 2: Stop Write Operations (Optional)

**Estimated Time**: 2-3 minutes

If you want zero risk of data inconsistency during migration, temporarily stop services:

```bash
# Option A: Stop only Intelligence Engine (safer, allows reads)
cd /path/to/intelligence-engine
ps aux | grep "python.*main.py" | awk '{print $2}' | xargs kill

# Option B: Stop all services (complete shutdown)
# Stop API Gateway
cd /path/to/api-gateway
pm2 stop api-gateway  # or: pkill -f "node.*index"

# Stop Intelligence Engine
cd /path/to/intelligence-engine
pm2 stop intelligence-engine  # or: pkill -f "python.*main.py"

# Verify services stopped
ps aux | grep -E "node|python" | grep -E "api-gateway|intelligence-engine"
```

**Note**: If you skip this phase, the migration will still work, but there's a small risk of duplicate writes during the migration window.

---

### Phase 3: Run Migration Script

**Estimated Time**: 5-15 minutes (depending on data volume)

```bash
# Navigate to project root
cd /Users/sawai/Desktop/rankmybrand.ai

# Run migration with output logging
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand \
  -f migrations/007_migrate_to_single_query_table.sql \
  2>&1 | tee migration_007_output.log

# Check for errors in output
grep -i "error\|failed\|exception" migration_007_output.log

# If no errors, verify migration completed
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand \
  -c "SELECT COUNT(*) as migrated_queries FROM audit_queries WHERE migrated_from = 'ai_queries';"
```

**Expected Output**:
```
NOTICE: Step 1: Pre-migration validation
NOTICE: ✅ Found X existing audits
NOTICE: ✅ Found Y existing queries in ai_queries
...
NOTICE: Step 14: Final validation
NOTICE: ✅ Migration completed successfully
NOTICE: Total queries migrated: Y
```

**Success Criteria**:
- ✅ No ERROR messages in output
- ✅ Migration log shows "completed successfully"
- ✅ Migrated query count matches expected value

---

### Phase 4: Deploy Code Changes

**Estimated Time**: 5-10 minutes

```bash
# 1. Pull latest code (with all TypeScript and Python changes)
git pull origin main

# 2. Install dependencies (if needed)
cd api-gateway && npm install
cd ../services/intelligence-engine && pip install -r requirements.txt

# 3. Build TypeScript (verify compilation)
cd ../../api-gateway
npm run build  # or: npx tsc

# 4. Restart services with new code
# API Gateway
pm2 restart api-gateway
# OR: node dist/index.js &

# Intelligence Engine
cd ../services/intelligence-engine
pm2 restart intelligence-engine
# OR: python src/main.py &

# 5. Verify services started
pm2 status
# OR:
ps aux | grep -E "node.*index|python.*main"

# 6. Check logs for startup errors
pm2 logs api-gateway --lines 50
pm2 logs intelligence-engine --lines 50
```

**Success Criteria**:
- ✅ TypeScript compilation successful
- ✅ Services started without errors
- ✅ No ERROR or CRITICAL messages in startup logs

---

### Phase 5: Run Verification Script

**Estimated Time**: 2-3 minutes

```bash
# Run comprehensive verification
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand \
  -f migrations/verify_single_table_migration.sql \
  2>&1 | tee verification_output.log

# Review verification results
cat verification_output.log
```

**Expected Results**:
```
========================================
VERIFICATION SUMMARY
========================================

✅ audit_queries table exists
✅ No orphaned queries found
✅ No orphaned responses found
✅ No recent writes to old ai_queries table
✅ Foreign key relationships intact

Overall Status: ✅ SYSTEM HEALTHY - Single table architecture verified

✅ READY FOR PRODUCTION
```

**Success Criteria**:
- ✅ All verification checks pass
- ✅ No orphaned records
- ✅ No recent writes to old ai_queries table
- ✅ Foreign key integrity confirmed

---

### Phase 6: Functional Testing

**Estimated Time**: 10-15 minutes

#### Test 1: Company Onboarding Flow
```bash
# Start fresh onboarding via API or frontend
# 1. Create company
# 2. Enter competitors
# 3. Trigger audit generation

# Verify queries created in audit_queries only
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  av.company_name,
  COUNT(aq.id) as query_count,
  MAX(aq.created_at) as last_query_created
FROM ai_visibility_audits av
LEFT JOIN audit_queries aq ON aq.audit_id = av.id
WHERE av.created_at > NOW() - INTERVAL '1 hour'
GROUP BY av.company_name
ORDER BY av.created_at DESC;
"
```

**Expected**: New audit should have ~48 queries created in `audit_queries` table

#### Test 2: Verify No Dual Writes
```bash
# Check that ai_queries table is NOT receiving new records
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  COUNT(*) as recent_ai_queries_count,
  MAX(created_at) as last_created
FROM ai_queries
WHERE created_at > NOW() - INTERVAL '1 hour';
"
```

**Expected**: `recent_ai_queries_count = 0` (no new writes to old table)

#### Test 3: Dashboard Data Population
```bash
# Verify dashboard data is populated correctly
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  company_name,
  overall_score,
  total_queries,
  total_responses,
  created_at
FROM dashboard_data
ORDER BY created_at DESC
LIMIT 5;
"
```

**Expected**: Dashboard data shows correct metrics from audit_queries

#### Test 4: Admin Dashboard
```bash
# Test admin dashboard endpoint
curl -X GET http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  | jq '.companies[] | {name, query_count, journey_status}'
```

**Expected**: Companies displayed with accurate query counts

#### Test 5: Backward Compatibility
```bash
# If you have old report_ids, verify they still work
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  ram.report_id,
  ram.audit_id,
  COUNT(aq.id) as query_count
FROM report_audit_mapping ram
LEFT JOIN audit_queries aq ON aq.audit_id = ram.audit_id
GROUP BY ram.report_id, ram.audit_id
LIMIT 5;
"
```

**Expected**: Old report_ids map correctly to audits via mapping table

---

### Phase 7: Performance Monitoring

**Estimated Time**: Ongoing (24-48 hours)

#### Immediate Checks (first hour)

```bash
# 1. Monitor database write operations
# Should see ~50% reduction in INSERT operations

# 2. Check application logs for errors
tail -f /path/to/api-gateway/logs/app.log | grep -i "error\|exception"
tail -f /path/to/intelligence-engine/logs/app.log | grep -i "error\|exception"

# 3. Monitor database connections
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  COUNT(*) as total_connections,
  COUNT(*) FILTER (WHERE state = 'active') as active,
  COUNT(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'rankmybrand';
"

# 4. Check query performance
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%audit_queries%'
ORDER BY calls DESC
LIMIT 10;
"
```

#### 24-Hour Monitoring

- [ ] No ERROR logs related to query insertion
- [ ] No ERROR logs related to missing tables
- [ ] Dashboard metrics accurate
- [ ] Admin dashboard loading correctly
- [ ] No user-reported issues
- [ ] Database write operations reduced by ~50%

---

## Rollback Procedure

**If critical issues are discovered, use this procedure:**

### Option 1: Automated Rollback (Recommended)

```bash
# Run the rollback function (created by migration script)
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT rollback_migration_007();
"

# Verify rollback
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT
  (SELECT COUNT(*) FROM ai_queries) as ai_queries_count,
  (SELECT COUNT(*) FROM audit_queries WHERE migrated_from IS NULL) as original_audit_queries,
  (SELECT COUNT(*) FROM audit_queries WHERE migrated_from = 'ai_queries') as migrated_queries;
"
```

**Expected after rollback**:
- `ai_queries` table restored from archive
- Migrated entries removed from `audit_queries`
- System back to dual-write state

### Option 2: Full Database Restore

```bash
# Stop all services
pm2 stop all

# Restore from backup
pg_restore -h localhost -U sawai -d rankmybrand --clean \
  backup_before_single_table_migration_*.dump

# Restart services with OLD code
git checkout <previous_commit_hash>
pm2 restart all
```

### Option 3: Partial Rollback (Code Only)

```bash
# Revert code changes only (keeps database migrated)
git revert <commit_hash_of_migration>
npm run build
pm2 restart all
```

**Note**: Only use Option 3 if database migration succeeded but code has issues.

---

## Post-Deployment Cleanup

**WAIT 7 DAYS** after successful deployment before cleanup.

### After 7 Days of Stable Operation:

```bash
# 1. Archive old ai_queries table (optional)
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
-- Rename table instead of dropping (safer)
ALTER TABLE ai_queries RENAME TO ai_queries_archived_$(date +%Y%m%d);
ALTER TABLE ai_responses RENAME TO ai_responses_archived_$(date +%Y%m%d);
"

# 2. Drop archive tables created by migration (if desired)
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
DROP TABLE IF EXISTS ai_queries_archive;
DROP TABLE IF EXISTS ai_responses_archive;
"

# 3. Remove old backup files (after 30 days)
find . -name "backup_before_single_table_migration_*.dump" -mtime +30 -delete
```

---

## Troubleshooting

### Issue: Migration script fails with foreign key error

**Symptom**: Error about foreign key constraint violation

**Solution**:
```bash
# Check for orphaned records before migration
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT COUNT(*) FROM ai_queries aq
LEFT JOIN ai_visibility_audits av ON aq.company_id = av.company_id
WHERE av.id IS NULL;
"

# Clean up orphaned records if found
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
DELETE FROM ai_queries
WHERE company_id NOT IN (SELECT company_id FROM ai_visibility_audits);
"

# Re-run migration
```

---

### Issue: Application logs show "table not found" errors

**Symptom**: Errors like "relation 'ai_queries' does not exist"

**Diagnosis**: Some code still referencing old table name

**Solution**:
```bash
# Search for remaining references
cd /Users/sawai/Desktop/rankmybrand.ai
grep -r "ai_queries" --include="*.ts" --include="*.py" api-gateway/ services/

# Update any remaining references to use audit_queries with proper JOIN
```

---

### Issue: Dashboard shows incorrect metrics

**Symptom**: Query counts or scores don't match expected values

**Solution**:
```bash
# Regenerate dashboard data
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
-- Clear dashboard data
TRUNCATE dashboard_data;

-- Trigger dashboard population (via API or service)
curl -X POST http://localhost:8001/api/ai-visibility/regenerate-dashboard \
  -H "Content-Type: application/json" \
  -d '{"company_id": "YOUR_COMPANY_ID"}'
"
```

---

### Issue: Rollback needed but rollback function fails

**Symptom**: `rollback_migration_007()` returns error

**Solution**: Use full database restore (see Rollback Option 2 above)

---

## Success Metrics

### Immediate (Day 1)
- ✅ Zero application errors related to query storage
- ✅ All new audits create queries in `audit_queries` only
- ✅ No writes to old `ai_queries` table
- ✅ Dashboard displays correct data
- ✅ Admin dashboard functions normally

### Short-term (Week 1)
- ✅ 50% reduction in database write operations confirmed
- ✅ No performance degradation
- ✅ No user-reported issues
- ✅ All backward compatibility working (report_id lookups)

### Long-term (Month 1)
- ✅ Improved database performance metrics
- ✅ Simplified codebase (single source of truth)
- ✅ Reduced maintenance overhead
- ✅ No legacy table dependencies

---

## Support and Escalation

### Monitoring Commands

```bash
# Real-time error monitoring
tail -f /var/log/postgresql/postgresql-*.log | grep ERROR

# Application health check
curl http://localhost:3000/api/health
curl http://localhost:8001/api/health

# Database connection pool status
PGPASSWORD=postgres psql -h localhost -U sawai -d rankmybrand -c "
SELECT * FROM pg_stat_database WHERE datname = 'rankmybrand';"
```

### Emergency Contacts

- **Database Issues**: Check PostgreSQL logs first
- **Application Errors**: Review pm2 logs
- **Performance Issues**: Monitor with `pg_stat_statements`

---

## Files Modified by This Migration

### Database
- `migrations/007_migrate_to_single_query_table.sql` (NEW)
- `migrations/verify_single_table_migration.sql` (NEW)

### TypeScript (8 files)
1. `api-gateway/src/services/query-generation.service.ts`
2. `api-gateway/src/routes/enhanced-query.routes.ts`
3. `api-gateway/src/routes/query-status.routes.ts`
4. `api-gateway/src/routes/test-queries.routes.ts`
5. `api-gateway/src/routes/admin-ai-visibility.routes.ts`
6. `api-gateway/src/routes/user-dashboard.routes.ts`
7. `api-gateway/src/index.ts`
8. `api-gateway/src/services/real-data.service.ts`

### Python (2 files)
1. `services/intelligence-engine/src/api/ai_visibility_real.py`
2. `services/intelligence-engine/src/core/services/job_processor.py`

---

## Summary

**Total Deployment Time**: 30-60 minutes (excluding monitoring)

**Downtime Required**: 0 minutes (can run with services online)

**Risk Level**: LOW (full backup + rollback function available)

**Performance Impact**: +50% improvement (reduced writes)

**Backward Compatibility**: ✅ Maintained via `report_audit_mapping`

---

**Deployment Status**: ⏳ Ready for Staging

**Next Step**: Execute Phase 1 (Backup) on staging environment

---

**Prepared by**: Claude Code
**Date**: October 12, 2025
**Version**: 1.0
