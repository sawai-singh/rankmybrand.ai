# Admin Dashboard Monitoring Guide

**URL**: http://localhost:3000/admin
**Status**: ✅ Running and ready to monitor

---

## 🎯 What You'll See in Real-Time

The admin dashboard automatically monitors and displays audit progress with **auto-refresh every 10 seconds**.

---

## 📊 Monitoring Tabs Available

### 1. **Overview Tab**
Shows high-level statistics:
- Total companies onboarded
- Completed journeys
- Average data quality scores
- Total edits made

### 2. **Audits Tab** ⭐ **PRIMARY FOR MONITORING**
**This is where you'll track audit progress in real-time!**

Shows for each audit:
- **Audit ID**
- **Company Name**
- **Status**:
  - `pending` → Just created, waiting to process
  - `processing` → Currently running (queries generation, LLM calls, analysis)
  - `completed` → Finished successfully
  - `failed` → Error occurred
- **Progress**:
  - Total queries generated
  - Total responses received
  - Providers used (OpenAI, Anthropic, Google, Perplexity)
- **Timestamps**:
  - Created at
  - Started at
  - Completed at
- **Actions**:
  - Stop audit (if needed)
  - View details
  - View dashboard

---

## 🔄 What Happens During an Audit (Timeline)

### Step 1: Audit Created (T+0s)
```
Status: pending
Queries: 0
Responses: 0
```
**You'll see**: New audit appears in the list with status "pending"

### Step 2: Intelligence Engine Picks Up (T+5s)
```
Status: processing
Queries: 0 → 48 (generating)
Responses: 0
```
**You'll see**: Status changes to "processing", query count starts increasing

### Step 3: Query Generation Complete (T+30s)
```
Status: processing
Queries: 48 (complete)
Responses: 0 → increasing
```
**You'll see**: All 48 queries generated, response count starts increasing

### Step 4: LLM Calls In Progress (T+1min - 10min)
```
Status: processing
Queries: 48
Responses: 0 → 48 → 96 → 144 → 192
```
**You'll see**: Response count incrementing as each LLM provider responds
- Target: 192 responses (48 queries × 4 providers)

### Step 5: Response Analysis (T+10-12min)
```
Status: processing
Queries: 48
Responses: 192 (analyzing)
```
**You'll see**: All responses collected, system analyzing

### Step 6: Dashboard Population (T+12-15min)
```
Status: processing → completed
Dashboard: Populating → Ready
```
**You'll see**: Status changes to "completed"

### Step 7: Audit Complete (T+15min)
```
Status: completed ✅
Queries: 48
Responses: 192
Dashboard: Ready
Completed At: [timestamp]
```
**You'll see**:
- Green checkmark
- "View Dashboard" button active
- Completion timestamp

---

## 🔍 Detailed Progress Indicators

The admin dashboard shows:

### Query Generation Progress
```
┌─────────────────────────────────────┐
│ Queries Generated: 48/48 ✅         │
│ Categories:                          │
│  - Brand Awareness: 12               │
│  - Product Info: 12                  │
│  - Comparison: 12                    │
│  - Buying Intent: 12                 │
└─────────────────────────────────────┘
```

### LLM Response Progress
```
┌─────────────────────────────────────┐
│ Responses Received: 192/192 ✅      │
│ By Provider:                         │
│  - OpenAI: 48/48 ✅                 │
│  - Anthropic: 48/48 ✅              │
│  - Google: 48/48 ✅                 │
│  - Perplexity: 48/48 ✅             │
└─────────────────────────────────────┘
```

### Analysis Progress
```
┌─────────────────────────────────────┐
│ Analysis Status:                     │
│  - Sentiment Analysis: ✅            │
│  - Brand Mentions: ✅                │
│  - Competitor Analysis: ✅           │
│  - Score Calculation: ✅             │
│  - Recommendations: ✅               │
└─────────────────────────────────────┘
```

### Dashboard Population Progress
```
┌─────────────────────────────────────┐
│ Dashboard Status: Ready ✅           │
│  - Metrics Calculated: ✅            │
│  - Insights Generated: ✅            │
│  - Recommendations: ✅               │
│  - Dashboard Link: Active            │
└─────────────────────────────────────┘
```

---

## 🎨 Color Coding

The dashboard uses visual indicators:

| Status | Color | Icon | Meaning |
|--------|-------|------|---------|
| `pending` | 🟡 Yellow | ⏳ | Waiting to start |
| `processing` | 🔵 Blue | ⚙️ | Currently running |
| `completed` | 🟢 Green | ✅ | Finished successfully |
| `failed` | 🔴 Red | ❌ | Error occurred |

---

## 📈 System Health Panel

Located at the top of the dashboard, shows:

```
┌─────────────────────────────────────┐
│ 🟢 System Health: All Services OK   │
│                                      │
│ API Gateway:          ✅ Healthy     │
│ Intelligence Engine:  ✅ Healthy     │
│ Redis Queue:          ✅ Connected   │
│ PostgreSQL:           ✅ Connected   │
│ LLM APIs:             ✅ Available   │
│                                      │
│ Pending Jobs:         0              │
│ Active Audits:        1              │
│ Completed Today:      0              │
└─────────────────────────────────────┘
```

---

## 🔔 Real-Time Updates

The dashboard automatically:
- ✅ Refreshes every 10 seconds
- ✅ Shows new audits immediately
- ✅ Updates progress in real-time
- ✅ Highlights changes with animations
- ✅ Plays sound on completion (optional)

---

## 🛠️ Actions You Can Take

### During Audit:
1. **View Progress** - Click on audit to see detailed progress
2. **View Logs** - See Intelligence Engine logs
3. **Stop Audit** - Emergency stop if needed

### After Completion:
1. **View Dashboard** - Opens customer dashboard
2. **View Details** - See full audit report
3. **Export Data** - Download audit results
4. **Share Link** - Copy dashboard URL

---

## 📊 What Data Is Displayed

### Audit Overview
- Audit ID (UUID)
- Company name & domain
- User email
- Start time
- End time (when complete)
- Duration

### Progress Metrics
- Total queries (target: 48)
- Total responses (target: 192)
- Queries per category
- Responses per provider
- Analysis completion %

### Quality Metrics
- Brand mention rate
- Average sentiment score
- GEO score
- SOV score
- Overall visibility score

### Performance Metrics
- Query generation time
- Average LLM response time
- Total processing time
- Cost estimate

---

## 🔍 Troubleshooting from Dashboard

### If audit is stuck in "pending":
Check:
- Intelligence Engine status (health panel)
- Redis queue connection
- No error messages in logs

### If audit is stuck in "processing":
Check:
- Response count is increasing
- No provider failures
- No timeout errors

### If audit fails:
Check:
- Error message displayed
- LLM API quotas
- Database connection
- Network issues

---

## 💡 Pro Tips

1. **Keep dashboard open** during testing to watch progress
2. **Enable browser notifications** for completion alerts
3. **Monitor multiple tabs** - Overview + Audits simultaneously
4. **Use filters** to focus on specific audit statuses
5. **Export logs** if troubleshooting is needed

---

## 🚀 Quick Start

1. **Open dashboard**: http://localhost:3000/admin
2. **Click "Audits" tab** in the top navigation
3. **Watch for new audits** to appear after onboarding
4. **Monitor progress** as it updates every 10 seconds
5. **Click "View Dashboard"** when status shows "completed"

---

## 📱 Mobile View

The admin dashboard is also responsive and works on mobile:
- Same real-time updates
- Touch-friendly interface
- Optimized for smaller screens

---

## 🎯 What You Should See Right Now

Since no audits have run yet, you'll see:

```
┌─────────────────────────────────────┐
│ 📊 AI Visibility Audits              │
│                                      │
│ No audits found                      │
│                                      │
│ Audits will appear here after users  │
│ complete onboarding.                 │
│                                      │
│ Auto-refreshing every 10 seconds...  │
└─────────────────────────────────────┘
```

**As soon as you complete onboarding on the frontend, a new audit will appear here automatically!**

---

## 🔗 Related Endpoints

The dashboard makes these API calls:
- `GET /api/admin/control/audits` - List all audits
- `GET /api/admin/control/audits/:id` - Get audit details
- `GET /api/admin/control/system/health` - System health
- `POST /api/admin/control/audits/:id/stop` - Stop audit

---

## ✅ Summary

The admin dashboard is **ready to monitor** your end-to-end audit workflow:

1. ✅ **Real-time updates** every 10 seconds
2. ✅ **Detailed progress tracking** for each step
3. ✅ **Visual indicators** for status changes
4. ✅ **System health monitoring**
5. ✅ **Actionable controls** (stop, view, export)

**Now open http://localhost:3000/admin and click the "Audits" tab to start monitoring!**

---

*Guide created by: Claude Code*
*Date: October 1, 2025*
