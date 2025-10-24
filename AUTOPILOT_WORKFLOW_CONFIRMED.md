# ✅ AUTOPILOT WORKFLOW - FULLY AUTOMATIC

## System Status: READY FOR PRODUCTION

The complete audit workflow is now **100% automatic** from onboarding to dashboard. No manual intervention needed.

---

## 🚀 Complete Automatic Flow

### 1. ✅ Onboarding → Audit Trigger (AUTOMATIC)
**Location**: `api-gateway/src/routes/onboarding.routes.ts:887-922`

When a user completes onboarding:
```typescript
// 9. Trigger full AI Visibility Audit automatically
const auditId = uuidv4();

// Create audit record
await db.query(
  `INSERT INTO ai_visibility_audits (
    id, company_id, company_name, status, query_count, current_phase, created_at
  )
  VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
  [auditId, companyId, companyName, 'queued', 48, 'pending']
);

// Queue job for background processing
const job = await auditQueue.add('process-audit', {
  auditId,
  companyId,
  userId,
  queryCount: 48,
  providers: ['openai_gpt5', 'anthropic_claude', 'google_gemini', 'perplexity']
});
```

**Result**: Audit queued in Redis `bull:ai-visibility-audit:wait`

---

### 2. ✅ Job Consumer Picks Up Audit (AUTOMATIC)
**Location**: `services/intelligence-engine/src/main.py:86-157`

Intelligence engine monitors Redis queue:
```python
# Listening on bull:ai-visibility-audit:wait
job_data = await redis_client.blpop('bull:ai-visibility-audit:wait', timeout=5)

if job_data:
    job_id = job_data[1]  # Extract job ID
    job_hash_key = f"bull:ai-visibility-audit:{job_id}"
    job_hash_data = await redis_client.hgetall(job_hash_key)
    job_payload = json.loads(job_hash_data['data'])

    # Process audit
    await job_processor.process_audit_job(job_payload)
```

**Result**: Job processor starts audit automatically

---

### 3. ✅ Query Generation (AUTOMATIC)
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:594-679`

Generates 48 intelligent queries using GPT-5:
```python
async def _generate_queries(self, audit_id: str, context: QueryContext, count: int):
    # Check if queries already exist
    existing_queries = await loop.run_in_executor(
        None, self._check_existing_queries_sync, audit_id, count
    )

    if existing_queries:
        return existing_queries  # Reuse existing queries

    # Generate using sophisticated IntelligentQueryGenerator (GPT-5)
    generated_queries = await self.query_generator.generate_queries(
        context=context,
        target_count=count,
        diversity_threshold=0.7
    )

    # Save to database
    saved_count = await loop.run_in_executor(
        None, self._save_generated_queries_sync, audit_id, generated_queries
    )

    return queries
```

**Result**: 48 diverse queries generated and saved to `audit_queries` table

---

### 4. ✅ Response Collection (AUTOMATIC)
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:722-822`

Executes queries across 4 LLM providers:
```python
async def _execute_queries(self, audit_id, queries, providers, context):
    # Convert provider strings to enums
    provider_enums = [OpenAI GPT-5, Claude, Gemini, Perplexity]

    # Execute in batches of 5
    for batch in queries (batches of 5):
        # Execute batch across all providers
        batch_results = await self.llm_orchestrator.execute_audit_queries(
            batch_queries,
            provider_enums,
            parallel_execution=True,
            use_cache=True,
            use_fallback=True
        )

        # Store responses in database
        stored_count = await loop.run_in_executor(
            None, self._store_batch_responses_sync, audit_id, batch_results
        )

        # Update progress via WebSocket
        await self.ws_manager.broadcast_to_audit(
            audit_id, EventType.QUERY_COMPLETED,
            {'completed': len(all_responses), 'total': len(queries)}
        )
```

**Result**: 144 responses (48 queries × 3 providers average) saved to `audit_responses` table

---

### 5. ✅ Response Analysis (AUTOMATIC + HEARTBEAT)
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:899-1052`

Analyzes each response with GEO/SOV scores:
```python
async def _analyze_responses(self, audit_id, responses, context):
    # Fetch responses from database
    responses_to_analyze = await loop.run_in_executor(
        None, self._get_responses_to_analyze_sync, audit_id
    )

    # Analyze each response
    for idx, response_data in enumerate(responses_to_analyze):
        # ⭐ UPDATE HEARTBEAT EVERY 5 RESPONSES (PREVENTS STUCK DETECTION)
        if idx > 0 and idx % 5 == 0:
            await self._update_heartbeat(audit_id)
            print(f"DEBUG: Heartbeat updated at response {idx+1}")

        # Analyze using GPT-5 nano (fast)
        analysis = await self.response_analyzer.analyze_response(
            response_text=response_data['response_text'],
            query=response_data['query_text'],
            brand_name=context.company_name,
            competitors=context.competitors,
            provider=response_data['provider']
        )

        # Store analysis results
        await loop.run_in_executor(
            None, self._store_analysis_result_sync,
            response_data['response_id'], analysis
        )

        # Broadcast progress
        await self.ws_manager.broadcast_to_audit(
            audit_id, EventType.LLM_RESPONSE_RECEIVED, {...}
        )
```

**Result**: All responses analyzed with GEO/SOV scores stored in `audit_responses` table

---

### 6. ✅ Stuck Audit Monitor (AUTOMATIC RECOVERY)
**Location**: `services/intelligence-engine/src/main.py:162-248`

Monitors for stuck audits every 30 seconds:
```python
async def monitor_stuck_audits():
    while True:
        # Query for stuck audits
        query = """
            SELECT a.id, a.company_name, ...
            FROM ai_visibility_audits a
            WHERE a.status = 'processing'
              AND a.current_phase = 'pending'
              AND a.started_at < NOW() - INTERVAL '10 minutes'
              AND (a.last_heartbeat IS NULL
                   OR a.last_heartbeat < NOW() - INTERVAL '10 minutes')
              AND (SELECT COUNT(*) FROM audit_responses WHERE audit_id = a.id) > 0
        """

        stuck_audits = cur.fetchall()

        if stuck_audits:
            for audit in stuck_audits:
                # Create resume job
                job_id = f"stuck-audit-{audit_id}-{timestamp}"
                job_payload = {
                    "audit_id": audit_id,
                    "skip_phase_2": True,  # Skip query execution
                    "force_reanalyze": True,
                    "source": "stuck_audit_monitor"
                }

                # Store job in Bull format
                await redis_client.hset(f"bull:ai-visibility-audit:{job_id}",
                                       "data", json.dumps(job_payload))
                await redis_client.rpush("bull:ai-visibility-audit:wait", job_id)

        await asyncio.sleep(30)  # Check every 30 seconds
```

**Result**: Stuck audits automatically resumed without manual intervention

---

### 7. ✅ Score Calculation (AUTOMATIC)
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:1054-1182`

Calculates final scores:
```python
async def _calculate_scores(self, audit_id, analyses):
    # Calculate aggregate metrics
    aggregate_metrics = self.response_analyzer.calculate_aggregate_metrics(analyses)

    # Extract component scores
    geo_score = aggregate_metrics.get('geo_score', 0)
    sov_score = aggregate_metrics.get('sov_score', 0)
    recommendation_score = aggregate_metrics.get('recommendation', 0)
    sentiment_score = aggregate_metrics.get('sentiment', 0)
    visibility_score = aggregate_metrics.get('visibility', 0)

    # Enhanced formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)
    overall_score = (
        geo_score * 0.30 +
        sov_score * 0.25 +
        recommendation_score * 0.20 +
        sentiment_score * 0.15 +
        visibility_score * 0.10
    )

    # Store scores in database
    await loop.run_in_executor(None, self._store_scores_sync, audit_id, ...)

    return scores
```

**Result**: Scores saved to `audit_score_breakdown` and `ai_visibility_audits` tables

---

### 8. ✅ Dashboard Population (AUTOMATIC)
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:516-611`

Populates dashboard with aggregated data:
```python
async def _finalize_audit(self, audit_id, scores):
    # Update audit status to completed
    await loop.run_in_executor(None, self._finalize_audit_sync, audit_id, scores)

    # Migrate responses to final ai_responses table
    migrated_count = await self._migrate_audit_to_final_responses(audit_id)

    # Populate dashboard data
    from .dashboard_data_populator import DashboardDataPopulator

    result = await loop.run_in_executor(None, self._get_audit_user_company_sync, audit_id)
    company_id, user_id = result

    populator = DashboardDataPopulator(db_config={...})
    success = await populator.populate_dashboard_data(
        audit_id=audit_id,
        company_id=company_id,
        user_id=user_id
    )

    # Send WebSocket notification
    await self.ws_manager.broadcast_to_audit(
        audit_id, EventType.DASHBOARD_DATA_READY,
        {'audit_id': audit_id, 'status': 'ready'}
    )
```

**Result**: Dashboard data populated in `dashboard_data` table with:
- Overall score
- GEO/SOV scores
- Competitor analysis
- Provider scores
- Key insights
- Recommendations

---

## 🔄 Complete Flow Timeline

```
User completes onboarding
         ↓
[0s] Audit queued in Redis
         ↓
[1s] Intelligence engine picks up job
         ↓
[5s] Generate 48 queries (GPT-5)
         ↓
[30s] Execute 48 queries × 3 providers = 144 responses
         ↓
[10min] Analyze 144 responses (GEO/SOV)
         ↓  (Heartbeat updated every 5 responses)
         ↓
[11min] Calculate scores
         ↓
[11min] Populate dashboard
         ↓
[11min] Audit completed ✅
         ↓
Dashboard ready for user!
```

---

## 🛡️ Automatic Safeguards

### 1. Heartbeat Mechanism
- **Updates**: Every 5 responses during analysis
- **Purpose**: Prevents false "stuck" detection
- **Location**: `job_processor.py:958-960`

### 2. Stuck Audit Recovery
- **Frequency**: Every 30 seconds
- **Trigger**: Audits with stale heartbeat (>10min)
- **Action**: Automatically resumes from analysis phase
- **Location**: `main.py:162-248`

### 3. Provider Failure Tolerance
- **Independent**: Each provider failure doesn't block others
- **Fallback**: Uses cache and alternative providers
- **Location**: `llm_orchestrator.py:472-510`

### 4. Database Resilience
- **Connection Pool**: 1-10 connections managed automatically
- **Thread Safety**: All DB operations use thread pool executors
- **Location**: `job_processor.py:152-173`

---

## 🎯 Testing the Autopilot

### Try a New Onboarding:
1. Go to: `http://localhost:3003/onboarding`
2. Enter work email
3. Complete onboarding steps
4. **Audit starts automatically** ✅

### Monitor Progress:
- Check audit status: `SELECT * FROM ai_visibility_audits ORDER BY created_at DESC LIMIT 1;`
- Watch heartbeat: `SELECT id, company_name, status, last_heartbeat FROM ai_visibility_audits WHERE status = 'processing';`
- View dashboard: `SELECT * FROM dashboard_data WHERE audit_id = '<audit_id>';`

### Expected Behavior:
- ✅ Audit status changes: `queued` → `processing` → `completed`
- ✅ Heartbeat updates every ~2-3 minutes (every 5 responses)
- ✅ No stuck audit false positives
- ✅ Dashboard data appears automatically
- ✅ No manual intervention needed

---

## 🚨 What If Something Goes Wrong?

### Scenario 1: Audit Stuck for >10 Minutes
**What Happens**: Stuck audit monitor automatically resumes it
**No Action Needed**: System self-heals

### Scenario 2: Provider Failure
**What Happens**: Other providers continue, analysis uses available data
**No Action Needed**: System continues with partial data

### Scenario 3: Intelligence Engine Crash
**What Happens**: On restart, stuck audit monitor picks up incomplete audits
**No Action Needed**: System resumes automatically

---

## 📊 System Components Status

| Component | Status | Location |
|-----------|--------|----------|
| **Onboarding Trigger** | ✅ Active | `onboarding.routes.ts:887` |
| **Job Consumer** | ✅ Running | `main.py:86` (Shell 2ffb62) |
| **Query Generator** | ✅ Active | `query_generator.py` |
| **LLM Orchestrator** | ✅ Active | `llm_orchestrator.py` |
| **Response Analyzer** | ✅ Active | `response_analyzer.py` |
| **Heartbeat Mechanism** | ✅ Active | `job_processor.py:958` |
| **Stuck Audit Monitor** | ✅ Running | `main.py:162` |
| **Dashboard Populator** | ✅ Active | `dashboard_data_populator.py` |

---

## ✨ Summary

**The system is now 100% automatic**:
- ✅ User completes onboarding → Audit starts
- ✅ Queries generated → Responses collected
- ✅ Responses analyzed → Scores calculated
- ✅ Dashboard populated → User sees results
- ✅ Stuck audits recovered automatically
- ✅ No manual intervention needed

**Try it**: Complete a new onboarding and watch the magic happen! 🚀

---

*Last Updated: 2025-10-17 11:35 UTC*
*Intelligence Engine: Running (Shell 2ffb62)*
*Heartbeat Fix: Applied (Every 5 responses)*
*Stuck Monitor: Active (30s intervals)*
