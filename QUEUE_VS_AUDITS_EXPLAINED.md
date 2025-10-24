# Queue vs Audits - Understanding the Difference

## 🔍 What Does the Queue Section Show?

The **Queue** section in System Control Center shows **Bull Queue job statistics**, NOT audit records.

### Data Source: **Redis Only** (Single Source)

```typescript
// Reads from Redis Bull queue keys:
const queueName = 'bull:ai-visibility-audit';

waiting    → redis.llen('bull:ai-visibility-audit:wait')      // Jobs waiting to start
active     → redis.llen('bull:ai-visibility-audit:active')    // Jobs currently running
completed  → redis.zcard('bull:ai-visibility-audit:completed') // Recently completed jobs
failed     → redis.zcard('bull:ai-visibility-audit:failed')   // Failed jobs
delayed    → redis.zcard('bull:ai-visibility-audit:delayed')  // Scheduled for later
```

---

## 📝 Queue vs Database Audits

### Queue (Redis) vs Audits (Database) - They're Different!

| Aspect | **Queue** (Redis) | **Database Audits** |
|--------|------------------|---------------------|
| **Purpose** | Temporary work queue | Permanent audit records |
| **Location** | Redis (in-memory) | PostgreSQL (disk) |
| **Lifecycle** | Short-lived (hours) | Permanent (forever) |
| **What it tracks** | Job processing status | Audit execution history |
| **Auto-cleanup** | Yes (old jobs removed) | No (kept forever) |

---

## 🔄 How They Work Together

### Flow:

```
1. User completes onboarding
   ↓
2. Job added to Redis queue → Queue.waiting++
   ↓
3. Job processor picks it up → Queue.active++, Queue.waiting--
   ↓
4. Audit record created in DB → ai_visibility_audits table
   ↓
5. Job finishes → Queue.completed++, Queue.active--
   ↓
6. After 1 hour → Job removed from queue (Queue.completed--)
   BUT audit record stays in database FOREVER
```

---

## 🎯 What Each Number Means

### Queue Section (Redis):

| Metric | What it Means | Example |
|--------|---------------|---------|
| **Waiting** | Jobs queued, not yet started | 3 audits waiting to be processed |
| **Active** | Jobs currently being processed | 2 audits running RIGHT NOW |
| **Completed** | Jobs finished in last hour | 10 audits completed recently |
| **Failed** | Jobs that crashed/errored | 1 audit failed, needs retry |
| **Delayed** | Jobs scheduled for future | 0 (we don't use delayed) |
| **Total** | Sum of all above | 16 total jobs in queue |

### Active Audits Tab (Database):

Shows audits where `status = 'processing'` from `ai_visibility_audits` table.

This is MORE accurate for "what's actually running" because:
- Queue might be empty but audit still running
- Audit updates its status in database as it progresses

---

## 🤔 Why Queue Shows All Zeros

Your current output:
```json
{
  "waiting": 0,
  "active": 0,
  "completed": 0,
  "failed": 0,
  "delayed": 0,
  "total": 0
}
```

**This means**:
- ✅ No jobs waiting to be processed
- ✅ No jobs currently in the queue processor
- ✅ Completed jobs were auto-cleaned (older than 1 hour)
- ✅ Failed jobs were either retried or deleted

**BUT** you still have audits in the database!

Check with:
```sql
SELECT COUNT(*) FROM ai_visibility_audits; -- Shows ALL audits ever
SELECT COUNT(*) FROM ai_visibility_audits WHERE status = 'processing'; -- Shows currently running
```

---

## 🔧 Redis Keys Explained

You saw these in Redis:
```
bull:ai-visibility-audit:stuck-audit-356b0e64-...
bull:ai-visibility-audit:stuck-audit-ea6701ae-...
```

These are **hash keys** for individual jobs. They contain job data but don't count in the queue stats unless they're also in the queue lists.

The actual queues are:
```
bull:ai-visibility-audit:wait      → List (LLEN)
bull:ai-visibility-audit:active    → List (LLEN)
bull:ai-visibility-audit:completed → Sorted Set (ZCARD)
bull:ai-visibility-audit:failed    → Sorted Set (ZCARD)
bull:ai-visibility-audit:delayed   → Sorted Set (ZCARD)
```

---

## 📊 Different Views of the Same System

### 1. **Queue Tab** (System Control Center)
- **Source**: Redis Bull queue
- **Shows**: Job processing state (temporary)
- **Use Case**: "Are jobs backing up in the queue?"

### 2. **Active Audits Tab** (System Control Center)
- **Source**: PostgreSQL `ai_visibility_audits` table
- **Shows**: Audits with `status = 'processing'`
- **Use Case**: "What audits are running right now?"

### 3. **Admin Dashboard** (`/admin`)
- **Source**: PostgreSQL (multiple tables joined)
- **Shows**: All audits, all statuses, full history
- **Use Case**: "Show me everything that's happened"

---

## 🎯 When to Use Each

### Use **Queue Tab** when:
- ❓ "Is the queue backing up?"
- ❓ "Are jobs waiting to be processed?"
- ❓ "How many jobs failed recently?"
- ❓ "Should I retry failed jobs?"

### Use **Active Audits Tab** when:
- ❓ "What's actually running RIGHT NOW?"
- ❓ "How long has this audit been running?"
- ❓ "Which phase is this audit in?"
- ❓ "Should I kill a stuck audit?"

### Use **Admin Dashboard** when:
- ❓ "Show me all audits for this company"
- ❓ "Which audits completed today?"
- ❓ "What failed and why?"
- ❓ "Can I retry or delete this audit?"

---

## 🔍 Visual Comparison

```
┌─────────────────────────────────────────────────┐
│           BULL QUEUE (Redis)                    │
│  Temporary work queue, auto-cleanup             │
├─────────────────────────────────────────────────┤
│  waiting: 0    ← Jobs not yet started           │
│  active: 0     ← Jobs running in processor      │
│  completed: 0  ← Finished (last 1 hour)         │
│  failed: 0     ← Crashed jobs                   │
│  delayed: 0    ← Scheduled for later            │
└─────────────────────────────────────────────────┘
                      ↓
            (Jobs get consumed)
                      ↓
┌─────────────────────────────────────────────────┐
│        DATABASE AUDITS (PostgreSQL)             │
│  Permanent records, never auto-deleted          │
├─────────────────────────────────────────────────┤
│  Total audits: 5                                │
│  ├─ processing: 0                               │
│  ├─ completed: 4                                │
│  └─ failed: 1                                   │
│                                                 │
│  These stay FOREVER (until manually deleted)   │
└─────────────────────────────────────────────────┘
```

---

## 💡 Key Takeaway

**Queue = Temporary job processing state (Redis)**
**Audits = Permanent execution records (Database)**

Queue showing all zeros is **normal and healthy** when:
- No new audits being created
- All jobs finished processing
- Auto-cleanup removed old completed jobs

The database still has the full history!

---

**Location**: `system-control.routes.ts:143-157`
**API**: `GET /api/admin/control/system/queue/stats`
**Source**: Redis Bull queue (`bull:ai-visibility-audit:*`)
