# 🎛️ Feature Flags & Functionality Toggles - Complete Guide

## 📍 **Current Status**: Feature Flags Exist But NO UI Controls

### ✅ **What You Have Now**:
1. **Backend Feature Flags** (Environment Variables) - **WORKING**
2. **Manual Audit Controls** - **AVAILABLE** at `http://localhost:3003/admin/audits`
3. **NO UI for Feature Flag Toggles** - **MISSING**

---

## 🎯 **Feature Flags Currently Available**

### 1. **USE_BATCHED_ANALYSIS_ONLY** 🚀
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:80`
**Default**: `true` (Batched-only mode enabled)
**Impact**: **87.5% LLM cost savings** (144 calls eliminated)

**Modes**:
- `true` → Batched-only mode (Phase 1 skipped, uses Phase 2 Call #4)
- `false` → Legacy mode (Phase 1 + Phase 2, 240 total LLM calls)

**How to Change**:
```bash
# Environment variable
export USE_BATCHED_ANALYSIS_ONLY=true

# Or in .env file
USE_BATCHED_ANALYSIS_ONLY=true
```

---

### 2. **ENABLE_PHASE1_DEPRECATION_WARNINGS** ⚠️
**Location**: `services/intelligence-engine/src/core/services/job_processor.py:81`
**Default**: `true`
**Impact**: Shows deprecation warnings when legacy Phase 1 is used

**Modes**:
- `true` → Show warnings in logs
- `false` → Silent mode

**How to Change**:
```bash
export ENABLE_PHASE1_DEPRECATION_WARNINGS=true
```

---

## 🎛️ **Manual Audit Controls** (Available NOW)

### **Location**: `http://localhost:3003/admin/audits`

### **Available Buttons** (per audit):

| Button | Icon | Action | When Shown |
|--------|------|--------|------------|
| **Execute** | ▶️ Play | Trigger LLM query execution | After queries generated, before responses |
| **Stop** | ⏸ Pause | Stop running audit | During processing |
| **Retry** | 🔄 Retry | Retry failed audit | Failed/stopped audits |
| **Skip Phase 2** | ⏭️ FastForward | Analyze existing responses (GPT-5 Nano) | Has responses, not completed |
| **Force Re-analyze** | 🔁 Repeat | Re-analyze from scratch | Has responses |
| **Resume** | ▶️ Play | Finalize with existing scores | Has analyzed data |
| **Populate Dashboard** | ⚡ Zap | Manually trigger dashboard population | Migrated but not populated |
| **Generate Link** | 🔗 Link | Create shareable report link | Completed audits |
| **Delete** | 🗑️ Trash | Permanently delete audit | Always available |

**Bulk Actions**:
- **Delete Failed** - Remove all failed audits

---

## 🎯 **WHERE ARE FEATURE FLAG TOGGLES?**

### **Answer**: They Don't Exist Yet! ❌

**Current Configuration Method**: Environment Variables Only
- No UI toggles
- No runtime changes
- Requires service restart to change

**What You Need**: A **Feature Flags Dashboard** at `/admin/settings`

---

## 🏗️ **RECOMMENDATION: Add Feature Flags UI**

### **Proposed Page**: `http://localhost:3003/admin/settings`

**Features**:
1. ✅ **Visual Toggle Switches** - Click to enable/disable
2. ✅ **Real-time Status** - See current state
3. ✅ **Impact Indicators** - Cost savings, performance impact
4. ✅ **Descriptions** - What each flag does
5. ✅ **Restart Warnings** - When service restart needed
6. ✅ **Audit Log** - Who changed what, when

### **Mock UI**:
```
┌─────────────────────────────────────────────────────────┐
│  ⚙️ Feature Flags & System Configuration                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🚀 Analysis Strategy                                   │
│  ┌───────────────────────────────────────────────────┐ │
│  │  [✓] USE_BATCHED_ANALYSIS_ONLY                    │ │
│  │                                                    │ │
│  │  Skip Phase 1 (144 LLM calls) and use only       │ │
│  │  Phase 2 batched Call #4 for per-response metrics│ │
│  │                                                    │ │
│  │  💰 Cost Savings: 87.5%                          │ │
│  │  📊 LLM Calls: 96 instead of 240                │ │
│  │  ✅ Status: ENABLED (Recommended)                │ │
│  │                                                    │ │
│  │  ⚠️ Requires Service Restart                     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ⚠️ Logging & Monitoring                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │  [✓] ENABLE_PHASE1_DEPRECATION_WARNINGS          │ │
│  │                                                    │ │
│  │  Show warnings when legacy Phase 1 analysis      │ │
│  │  is used instead of batched-only mode            │ │
│  │                                                    │ │
│  │  ✅ Status: ENABLED                               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [  Apply Changes  ]  [  Restart Services  ]          │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 **Current Workaround: Check Logs**

### **To See Which Mode Is Active**:

```bash
# Check intelligence engine logs
tail -f /tmp/intelligence-engine.log | grep -E "BATCHED|LEGACY"
```

**What You'll See**:
```
🚀 BATCHED-ONLY MODE: Skipping Phase 1 individual analysis (144 LLM calls saved)
   ✅ Will use only Phase 2 batched Call #4 for per-response metrics
```

OR (if legacy mode)
```
⚠️  DEPRECATION WARNING: Phase 1 individual analysis is deprecated
   Set USE_BATCHED_ANALYSIS_ONLY=true to save 87.5% LLM costs
```

---

## 🎯 **IMMEDIATE ACTION ITEMS**

### **Option 1**: Manual Configuration (Current)
```bash
# Edit environment file
nano /Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/.env

# Add or update:
USE_BATCHED_ANALYSIS_ONLY=true
ENABLE_PHASE1_DEPRECATION_WARNINGS=true

# Restart service
lsof -ti:8002 | xargs kill -9
cd /Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine
export PYTHONPATH=/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine
nohup python3 src/main.py > /tmp/intelligence-engine.log 2>&1 &
```

### **Option 2**: Add Feature Flags UI (Recommended)
Would you like me to build a professional Feature Flags Dashboard with toggle switches?

**Estimated Time**: 20 minutes
**Features**:
- Real-time toggle switches
- Cost impact calculator
- Auto-restart services option
- Audit log of changes
- Mobile responsive design

---

## 🔧 **Feature Flags vs Manual Controls**

### **Feature Flags** (Environment Variables)
- Control **HOW** the system works
- Affect ALL audits
- Require service restart
- Examples: Analysis strategy, cost optimization

### **Manual Controls** (Admin Dashboard Buttons)
- Control **WHAT** happens to specific audits
- Per-audit actions
- Immediate effect
- Examples: Execute, Stop, Delete specific audits

---

## ✅ **RECOMMENDATION**

**For Production**:
1. ✅ Keep `USE_BATCHED_ANALYSIS_ONLY=true` (default)
2. ✅ Monitor logs for mode confirmations
3. 🎯 **Add Feature Flags UI** for easy management
4. ✅ Use manual controls at `/admin/audits` for per-audit actions

**Cost Savings**: 87.5% with current settings ✅
