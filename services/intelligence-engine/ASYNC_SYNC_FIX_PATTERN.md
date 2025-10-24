# Async/Sync Database Operations Fix Pattern

## Problem
Mixing synchronous `psycopg2` database operations with async Python code blocks the event loop, causing the application to hang.

## Solution
Run all synchronous database operations in a thread pool using `asyncio.run_in_executor()`.

## Pattern Template

### Step 1: Create Synchronous Version
```python
def _function_name_sync(self, param1, param2) -> ReturnType:
    """Function description (synchronous version for thread pool)"""
    # Get database connection from pool (synchronous)
    conn = self._get_db_connection_sync()

    try:
        with conn.cursor() as cursor:
            # Perform all database operations here
            cursor.execute("SELECT...", (param1,))
            result = cursor.fetchall()

            # Process results
            processed = do_something(result)

        conn.commit()  # If needed

        return processed

    finally:
        self._put_db_connection_sync(conn)
```

### Step 2: Create Async Wrapper
```python
async def _function_name(self, param1, param2) -> ReturnType:
    """Async wrapper that runs sync database operations in thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, self._function_name_sync, param1, param2)
```

## Fixed Functions ✅

### 1. `_generate_queries()` - job_processor.py:311
- **Status**: ✅ Fixed and tested
- **Result**: Successfully retrieved 45 queries from database

### 2. `_is_audit_cancelled()` - job_processor.py:216
- **Status**: ✅ Fixed
- **Next test**: Will be called after query generation completes

## Functions Needing Fixes

### Critical Path (Execute in Order)

#### 3. `_update_audit_status()` - Line ~782
Called at start and end of audit processing
```python
def _update_audit_status_sync(self, audit_id: str, status: str, error_message: Optional[str] = None):
    """Update audit status in database (synchronous version for thread pool)"""
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
    """Async wrapper that runs sync database operations in thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, self._update_audit_status_sync, audit_id, status, error_message)
```

#### 4. `_get_company_context()` - Line ~181
Called early to retrieve company information
```python
def _get_company_context_sync(self, company_id: Optional[int]) -> Optional[dict]:
    """Fetch company from database (synchronous version for thread pool)"""
    if not company_id:
        return None

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
        # Return default context
        return QueryContext(
            company_name="Unknown Company",
            industry="Technology",
            # ... (all default fields)
        )

    # Run database query in thread pool
    loop = asyncio.get_event_loop()
    company = await loop.run_in_executor(None, self._get_company_context_sync, company_id)

    if not company:
        raise ValueError(f"Company {company_id} not found")

    # Build QueryContext from result
    return QueryContext(
        company_name=company['name'],
        industry=company.get('industry', 'Technology'),
        # ... (all mappings)
    )
```

#### 5. `_execute_queries()` - Line ~325
**Complex**: Has database operations inside a for loop

**Approach**: Extract the database operation block into a sync function

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
                            query_id,
                            audit_id,
                            response.provider.value,
                            response.model_version,
                            response.response_text,
                            response.response_time_ms,
                            response.tokens_used,
                            response.cache_hit
                        ))
                        stored_count += 1

        conn.commit()
        return stored_count
    finally:
        self._put_db_connection_sync(conn)

# Then in _execute_queries(), replace the async with block:
for query_text, responses in batch_results.items():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, self._store_query_responses_sync, audit_id, query_text, responses)
```

#### 6. `_analyze_responses()` - Line ~431
**Complex**: Database read at start, then database writes in loop

**Approach A**: Split into two sync functions
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
                    # ... all fields
                WHERE id = %s
            """, (
                analysis.brand_analysis.mentioned,
                analysis.brand_analysis.first_position_percentage,
                # ... all values
                response_id
            ))

        conn.commit()
    finally:
        self._put_db_connection_sync(conn)
```

**Approach B**: Batch all database writes
```python
def _store_all_analyses_sync(self, analyses_data: List[tuple]):
    """Store all analyses at once (synchronous version for thread pool)"""
    conn = self._get_db_connection_sync()

    try:
        with conn.cursor() as cursor:
            for response_id, analysis_fields in analyses_data:
                cursor.execute("""
                    UPDATE audit_responses SET ...
                    WHERE id = %s
                """, (*analysis_fields, response_id))

        conn.commit()
    finally:
        self._put_db_connection_sync(conn)
```

#### 7. `_calculate_scores()` - Line ~557
Similar pattern - extract database operations

#### 8. `_generate_insights()` - Line ~669
Database writes for storing insights

#### 9. `_migrate_audit_to_final_responses()` - Line ~854
Large INSERT SELECT with transaction

#### 10. `_finalize_audit()` - Line ~943
Multiple database operations, including nested calls

## Testing Strategy

### Phase 1: Core Functions (CURRENT)
1. ✅ Fix `_generate_queries()` - DONE, TESTED
2. ✅ Fix `_is_audit_cancelled()` - DONE
3. ⏳ Fix `_update_audit_status()` - IN PROGRESS
4. ⏳ Fix `_get_company_context()` - IN PROGRESS

**Test**: Restart service, re-queue audit, verify it progresses past audit cancellation check

### Phase 2: Query Execution
5. Fix `_execute_queries()` database operations
6. Test: Verify responses are stored in `audit_responses` table

### Phase 3: Analysis
7. Fix `_analyze_responses()` database operations
8. Test: Verify analysis results are stored

### Phase 4: Finalization
9. Fix `_calculate_scores()`, `_generate_insights()`, `_finalize_audit()`
10. Test: Verify audit completes successfully

## Quick Reference

### Helper Methods Available
```python
def _get_db_connection_sync(self):
    """Get database connection from pool (synchronous)"""
    return self.db_pool.getconn()

def _put_db_connection_sync(self, conn):
    """Return database connection to pool (synchronous)"""
    self.db_pool.putconn(conn)

async def _execute_in_thread(self, func, *args, **kwargs):
    """Execute synchronous function in thread pool to avoid blocking async loop"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))
```

### Quick Pattern
1. Identify function with `async with self.get_db_connection()`
2. Create `_function_name_sync()` version
3. Move all DB operations to sync version
4. Replace async version with thread pool wrapper
5. Test thoroughly

## Progress Tracking

- **Functions Fixed**: 2/10
- **Functions Remaining**: 8
- **Current Status**: Query generation working, stuck at cancellation check
- **Next Milestone**: Get audit to execute queries and store responses
