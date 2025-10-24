# Async/Sync Database Fix - Session Summary

## Problem Identified
**Root Cause**: Mixing synchronous `psycopg2` database operations with async Python code blocks the asyncio event loop.

**Symptom**: Anker audit (ID: `af9984db-3948-429e-82b6-a689db21d396`) hung at line 430 during `cursor.execute()` with no error - process alive but no progress.

## Solution Implemented
Run ALL synchronous database operations in a thread pool using `asyncio.run_in_executor()` to prevent blocking the async event loop.

## Progress Made ✅

### Functions Fixed and Tested:
1. **`_generate_queries()` - Lines 495-507**
   - ✅ FIXED and TESTED
   - ✅ Successfully retrieved 45 queries from database
   - ✅ Proved the solution works!

2. **`_is_audit_cancelled()` - Lines 216-219**
   - ✅ FIXED (not yet tested)
   - Called multiple times throughout audit processing

### Helper Methods Created:
```python
def _get_db_connection_sync(self):  # Line 152
    """Get database connection from pool (synchronous)"""
    return self.db_pool.getconn()

def _put_db_connection_sync(self, conn):  # Line 156
    """Return database connection to pool (synchronous)"""
    self.db_pool.putconn(conn)

@asynccontextmanager
async def get_db_connection(self):  # Line 165
    """Async context manager for database connections"""
    conn = self.db_pool.getconn()
    try:
        yield conn
    finally:
        self.db_pool.putconn(conn)
```

### Documentation Created:
- `ASYNC_SYNC_FIX_PATTERN.md` - Comprehensive pattern guide with code examples
- `ASYNC_SYNC_FIX_SUMMARY.md` - This file

## Remaining Work 📋

### Critical Path Functions (Priority Order):

#### 1. `_update_audit_status()` - Line ~948
**Usage**: Called at audit start/end and on failure
**Code Pattern**:
```python
def _update_audit_status_sync(self, audit_id: str, status: str, error_message: Optional[str] = None):
    conn = self._get_db_connection_sync()
    try:
        with conn.cursor() as cursor:
            if status == 'processing':
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s, started_at = NOW() WHERE id = %s",
                    (status, audit_id)
                )
            elif status == 'completed':
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s, completed_at = NOW() WHERE id = %s",
                    (status, audit_id)
                )
            elif status == 'failed':
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s, error_message = %s WHERE id = %s",
                    (status, error_message, audit_id)
                )
            else:
                cursor.execute(
                    "UPDATE ai_visibility_audits SET status = %s WHERE id = %s",
                    (status, audit_id)
                )
        conn.commit()
    finally:
        self._put_db_connection_sync(conn)

async def _update_audit_status(self, audit_id: str, status: str, error_message: Optional[str] = None):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, self._update_audit_status_sync, audit_id, status, error_message)
```

#### 2. `_get_company_context()` - Line ~365
**Usage**: Called early to retrieve company data
**Complexity**: Returns complex `QueryContext` object

**Strategy**: Split into two parts:
1. Sync function that retrieves raw data from database
2. Async wrapper that calls sync function and builds `QueryContext`

```python
def _get_company_context_sync(self, company_id: int) -> Optional[dict]:
    """Fetch company from database (synchronous version for thread pool)"""
    conn = self._get_db_connection_sync()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    c.*,
                    array_agg(DISTINCT comp.competitor_name) FILTER (WHERE comp.competitor_name IS NOT NULL) as competitors,
                    array_agg(DISTINCT f.feature_name) FILTER (WHERE f.feature_name IS NOT NULL) as features
                FROM companies c
                LEFT JOIN competitors comp ON comp.company_id = c.id
                LEFT JOIN company_features f ON f.company_id = c.id
                WHERE c.id = %s
                GROUP BY c.id
            """, (company_id,))
            return cursor.fetchone()
    finally:
        self._put_db_connection_sync(conn)

async def _get_company_context(self, company_id: Optional[int]) -> QueryContext:
    """Fetch company context for query generation"""
    if not company_id:
        return QueryContext(company_name="Unknown Company", ...)  # default

    loop = asyncio.get_event_loop()
    company = await loop.run_in_executor(None, self._get_company_context_sync, company_id)

    if not company:
        raise ValueError(f"Company {company_id} not found")

    return QueryContext(
        company_name=company['name'],
        industry=company.get('industry', 'Technology'),
        # ... all field mappings
    )
```

#### 3. `_execute_queries()` - Line ~509
**Complexity**: HIGH - Database operations inside for loop
**Current Issue**: Lines 572-602 use `async with self.get_db_connection()`

**Strategy**: Extract the database block into a sync function

```python
def _store_query_responses_sync(self, audit_id: str, query_text: str, responses: List[Any]) -> int:
    """Store query responses in database (synchronous version for thread pool)"""
    conn = self._get_db_connection_sync()
    stored_count = 0
    try:
        with conn.cursor() as cursor:
            # Get query ID from database
            cursor.execute(
                "SELECT id FROM audit_queries WHERE audit_id = %s AND query_text = %s",
                (audit_id, query_text)
            )
            query_record = cursor.fetchone()

            if query_record:
                query_id = query_record[0] if isinstance(query_record, tuple) else query_record['id']
                for response in responses:
                    if not response.error:
                        cursor.execute("""
                            INSERT INTO audit_responses
                            (query_id, audit_id, provider, model_version, response_text,
                             response_time_ms, tokens_used, cache_hit)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            query_id, audit_id, response.provider.value,
                            response.model_version, response.response_text,
                            response.response_time_ms, response.tokens_used,
                            response.cache_hit
                        ))
                        stored_count += 1
        conn.commit()
        return stored_count
    finally:
        self._put_db_connection_sync(conn)

# Then in _execute_queries() around line 571-602, replace:
# async with self.get_db_connection() as conn:
#     ...batch_results processing...
# With:
for query_text, responses in batch_results.items():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, self._store_query_responses_sync, audit_id, query_text, responses)
```

#### 4. `_analyze_responses()` - Line ~615
**Complexity**: HIGH - Database read at start, writes in loop
**Current Issue**:
- Line 626: `async with self.get_db_connection()` to read responses
- Line 673: `async with self.get_db_connection()` inside for loop to store analysis

**Strategy**: Two separate sync functions

```python
def _get_responses_to_analyze_sync(self, audit_id: str) -> List[dict]:
    """Get responses needing analysis (synchronous version for thread pool)"""
    conn = self._get_db_connection_sync()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT q.id, q.query_text, r.id as response_id, r.response_text, r.provider
                FROM audit_queries q
                JOIN audit_responses r ON r.query_id = q.id
                WHERE q.audit_id = %s
            """, (audit_id,))
            return cursor.fetchall()
    finally:
        self._put_db_connection_sync(conn)

def _store_analysis_result_sync(self, response_id: str, analysis: Any):
    """Store analysis result (synchronous version for thread pool)"""
    conn = self._get_db_connection_sync()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE audit_responses
                SET
                    brand_mentioned = %s,
                    mention_position = %s,
                    mention_context = %s,
                    sentiment = %s,
                    recommendation_strength = %s,
                    competitors_mentioned = %s,
                    key_features_mentioned = to_jsonb(%s::text[]),
                    featured_snippet_potential = %s,
                    voice_search_optimized = %s,
                    analysis_metadata = %s,
                    geo_score = %s,
                    sov_score = %s,
                    context_completeness_score = %s,
                    recommendations = %s
                WHERE id = %s
            """, (
                analysis.brand_analysis.mentioned,
                analysis.brand_analysis.first_position_percentage,
                analysis.brand_analysis.context_quality.value,
                analysis.brand_analysis.sentiment.value,
                analysis.brand_analysis.recommendation_strength.value,
                json.dumps([
                    {
                        'name': comp.competitor_name,
                        'mentioned': comp.mentioned,
                        'sentiment': comp.sentiment.value
                    }
                    for comp in analysis.competitors_analysis
                ]),
                analysis.brand_analysis.specific_features_mentioned,
                analysis.featured_snippet_potential > 50,
                analysis.voice_search_optimized,
                json.dumps({
                    'processing_time_ms': analysis.processing_time_ms,
                    'analysis_id': analysis.analysis_id
                }),
                analysis.geo_score,
                analysis.sov_score,
                analysis.context_completeness_score,
                json.dumps(analysis.recommendations) if analysis.recommendations else json.dumps([]),
                response_id
            ))
        conn.commit()
    finally:
        self._put_db_connection_sync(conn)

# Update _analyze_responses():
async def _analyze_responses(...):
    # Line 626 - Replace with:
    loop = asyncio.get_event_loop()
    responses_to_analyze = await loop.run_in_executor(None, self._get_responses_to_analyze_sync, audit_id)

    # ... analysis loop ...

    # Line 673 - Inside for loop, replace with:
    await loop.run_in_executor(None, self._store_analysis_result_sync, response_data['response_id'], analysis)
```

#### 5. `_calculate_scores()` - Line ~741
**Current Issue**: Line 778 uses `async with self.get_db_connection()`

#### 6. `_generate_insights()` - Line ~851
**Current Issue**: Line 936 uses `async with self.get_db_connection()`

#### 7. `_migrate_audit_to_final_responses()` - Line ~1037
**Current Issue**: Line 1050 uses `async with self.get_db_connection()`

#### 8. `_finalize_audit()` - Line ~1127
**Current Issue**: Multiple database operations including nested calls at lines 1133 and 1165

#### 9. `_handle_job_failure()` - Line ~1214
**Calls**: `_update_audit_status()` which will be fixed in step 1

## Testing Strategy

### Phase 1: Core Functions ⏳
1. ✅ Fix `_generate_queries()` - DONE, TESTED, WORKING
2. ✅ Fix `_is_audit_cancelled()` - DONE, NEEDS TEST
3. ⏳ Fix `_update_audit_status()` - IN PROGRESS
4. ⏳ Fix `_get_company_context()` - IN PROGRESS

**Test**: Restart service, re-queue audit, verify it progresses past cancellation check

### Phase 2: Query Execution
5. Fix `_execute_queries()` database operations

**Test**: Verify responses are stored in `audit_responses` table (check COUNT > 0)

### Phase 3: Analysis
6. Fix `_analyze_responses()` database operations

**Test**: Verify analysis results stored (check `brand_mentioned`, `sentiment` fields populated)

### Phase 4: Finalization
7-9. Fix `_calculate_scores()`, `_generate_insights()`, `_finalize_audit()`

**Test**: Verify audit status changes to 'completed', scores calculated, insights generated

## Quick Fix Script

If you want to apply all fixes at once, here's the systematic approach:

1. Search for all occurrences of `async with self.get_db_connection()`
2. For each occurrence:
   - Extract the entire database operation block
   - Create a `_function_name_sync()` version
   - Replace async version with thread pool call
3. Restart service
4. Test end-to-end

## Current Status

- **Functions Fixed**: 2/10 (20%)
- **Test Results**: 1/2 tested, 1/2 working perfectly
- **Current Blocker**: Audit stuck after query generation (likely at `_is_audit_cancelled()` or `_execute_queries()`)
- **Next Milestone**: Get audit to execute queries and store responses in database

## Files Modified

- `/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/src/core/services/job_processor.py`
  - Added helper methods (lines 152-172)
  - Fixed `_generate_queries()` (lines 430-507)
  - Fixed `_is_audit_cancelled()` (lines 186-219)

## Documentation Files Created

- `ASYNC_SYNC_FIX_PATTERN.md` - Detailed pattern guide
- `ASYNC_SYNC_FIX_SUMMARY.md` - This summary

## Recommendations

### Option A: Complete All Fixes Now (Recommended)
Systematically fix all 10 functions using the pattern. Estimated time: 30-45 minutes.

### Option B: Fix Critical Path Only
Fix functions 1-4 to get audit past initial stages, then fix 5-9 as errors occur. Faster initial test but more iterations.

### Option C: Automated Script
Write a Python script to automatically identify and fix all `async with self.get_db_connection()` occurrences. Risky but fast.

## Key Learnings

1. **Async event loop blocking** is silent - no errors, just hangs
2. **Thread pool execution** is the correct solution for sync DB operations in async code
3. **Progressive debugging** with print statements was essential to identify the exact hanging point
4. **The pattern works** - proven by successful `_generate_queries()` fix

## Next Steps

1. Apply fixes to remaining functions (use `ASYNC_SYNC_FIX_PATTERN.md` as guide)
2. Restart Intelligence Engine
3. Re-queue Anker audit
4. Monitor logs to track progress through each phase
5. Verify data in database at each milestone

Good luck! The pattern is proven to work - now it's just systematic application. 🚀
