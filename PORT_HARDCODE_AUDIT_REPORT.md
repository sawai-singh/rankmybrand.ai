# 🔍 PORT HARDCODE AUDIT REPORT

**Date**: 2025-10-24
**Audit Type**: Comprehensive Deep-Dive Analysis
**Scope**: All TypeScript, JavaScript, and Python files across entire codebase
**Standard**: Apple-Grade, World-Class Product Quality

---

## 🎯 EXECUTIVE SUMMARY

**Total Hardcoded Instances Found**: 11
**Critical Issues (Production Code)**: 5 ⚠️
**Medium Issues (Configuration)**: 1 ⚠️
**Low Issues (Test/Documentation)**: 3 ✅
**Acceptable (With Fallbacks)**: All others ✅

**Status**: ⚠️ **5 CRITICAL GAPS IDENTIFIED - IMMEDIATE FIX REQUIRED**

---

## 🚨 CRITICAL ISSUES (Production Code)

These hardcoded ports are in **critical paths** with **NO** environment variable fallbacks:

### 1. Admin Routes - Shareable Link Generation ⚠️ CRITICAL
**File**: `api-gateway/src/routes/admin.routes.ts`
**Line**: 926
**Severity**: **HIGH**

**Current Code**:
```typescript
link: `http://localhost:3003/r/${data.token}`
```

**Issue**:
- Shareable links sent to users are hardcoded to localhost:3003
- Will fail in production (localhost won't work for external users)
- No environment variable used

**Fix Required**:
```typescript
link: `${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3003'}/r/${data.token}`
```

**Impact**: 🔴 **BLOCKER** - Users cannot access shared reports in production

---

### 2. Admin Audits Page - Execute Audit API Call ⚠️ CRITICAL
**File**: `services/dashboard/app/admin/audits/page.tsx`
**Line**: 289
**Severity**: **HIGH**

**Current Code**:
```typescript
const response = await fetch(`http://localhost:8002/api/ai-visibility/execute-audit/${auditId}`, {
  method: "POST",
});
```

**Issue**:
- Direct API call to Intelligence Engine hardcoded to port 8002
- Bypasses API Gateway entirely
- No environment variable fallback

**Fix Required**:
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_INTELLIGENCE_ENGINE || 'http://localhost:8002'}/api/ai-visibility/execute-audit/${auditId}`, {
  method: "POST",
});
```

**Impact**: 🔴 **CRITICAL** - Execute audit feature fails in production

---

### 3. Admin Audits Page - Shareable Link Display ⚠️ CRITICAL
**File**: `services/dashboard/app/admin/audits/page.tsx`
**Line**: 482
**Severity**: **HIGH**

**Current Code**:
```typescript
// UPDATED: Changed from localhost:3000 to localhost:3003
const link = `http://localhost:3003/r/${data.token}`;
```

**Issue**:
- Comment shows this was manually "fixed" but still hardcoded
- No environment variable used
- Same issue as #1 but in frontend display

**Fix Required**:
```typescript
const link = `${process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_URL || 'http://localhost:3003'}/r/${data.token}`;
```

**Impact**: 🔴 **BLOCKER** - Displayed shareable links don't work in production

---

### 4. Token Redirect Page - Dashboard URL ⚠️ CRITICAL
**File**: `services/dashboard/app/r/[token]/page.tsx`
**Line**: 54
**Severity**: **HIGH**

**Current Code**:
```typescript
// Build the redirect URL to rankmybrand-frontend dashboard
const dashboardUrl = `http://localhost:3000/dashboard/ai-visibility?token=${token}&auditId=${result.auditId}`;
```

**Issue**:
- After validating shareable token, redirects to hardcoded localhost:3000
- Users in production will redirect to their own localhost (fails)
- No environment variable fallback

**Fix Required**:
```typescript
const dashboardUrl = `${process.env.NEXT_PUBLIC_DASHBOARD_BASE_URL || 'http://localhost:3000'}/dashboard/ai-visibility?token=${token}&auditId=${result.auditId}`;
```

**Impact**: 🔴 **BLOCKER** - Shareable link flow completely broken in production

---

### 5. Test Redirect Page - Dashboard URL (Lower Priority)
**File**: `rankmybrand-frontend/src/app/test-redirect/page.tsx`
**Line**: 6
**Severity**: **MEDIUM** (Test page only)

**Current Code**:
```typescript
window.location.href = 'http://localhost:3000/dashboard?onboarding=complete';
```

**Issue**:
- Test/demo page with hardcoded URL
- Lower priority but should still be fixed for consistency

**Fix Required**:
```typescript
window.location.href = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?onboarding=complete`;
```

**Impact**: 🟡 **LOW** - Test page only, not production-critical

---

## ⚠️ MEDIUM ISSUES (Configuration)

### 6. Intelligence Engine - CORS Origins ⚠️ MEDIUM
**File**: `services/intelligence-engine/src/main.py`
**Line**: 331
**Severity**: **MEDIUM**

**Current Code**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3004"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Issue**:
- CORS configuration hardcoded for 5 localhost ports
- Won't work in production with real domain names
- No environment variable configuration

**Fix Required**:
```python
import os

# Parse CORS origins from environment (comma-separated)
cors_origins_str = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3003')
cors_origins = [origin.strip() for origin in cors_origins_str.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Environment Variable**:
```bash
# Development
CORS_ORIGINS=http://localhost:3000,http://localhost:3003

# Production
CORS_ORIGINS=https://app.rankmybrand.ai,https://admin.rankmybrand.ai
```

**Impact**: 🟡 **MEDIUM** - Will cause CORS errors in production

---

## ✅ NON-CRITICAL ISSUES (Documentation/Scripts)

### 7. Generate Test Token Script (Documentation Only)
**File**: `services/intelligence-engine/scripts/generate_test_token.py`
**Lines**: 31, 38
**Severity**: **LOW**

**Status**: ✅ **ACCEPTABLE** - Example documentation only, not production code

---

### 8. Populate Dashboard Script (Output Only)
**File**: `services/intelligence-engine/src/scripts/populate_dashboard_for_audit.py`
**Line**: 140
**Severity**: **LOW**

**Status**: ✅ **ACCEPTABLE** - Script output for developer convenience

---

### 9. Onboarding Competitors (Commented Out Test Code)
**File**: `rankmybrand-frontend/src/app/onboarding/competitors/page.tsx`
**Line**: 266
**Severity**: **LOW**

**Status**: ✅ **ACCEPTABLE** - Commented out, not active code

---

## ✅ ACCEPTABLE HARDCODES (With Environment Variable Fallbacks)

All other hardcoded instances found are **ACCEPTABLE** because they:
1. Use environment variables as PRIMARY source
2. Only fall back to localhost for local development
3. Follow pattern: `process.env.VARIABLE || 'http://localhost:PORT'`

### Examples of Correct Usage:

```typescript
// ✅ GOOD - Environment variable with fallback
const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';

// ✅ GOOD - Used in dynamic URLs
const dashboardUrl = `${process.env.DASHBOARD_BASE_URL || 'http://localhost:3000'}/dashboard/${dashboardId}`;

// ✅ GOOD - Service configuration
const SERVICES = {
  geo: process.env.GEO_SERVICE || 'http://localhost:8002',
  intelligence: process.env.INTELLIGENCE_SERVICE || 'http://localhost:8002',
};
```

**Files with Acceptable Usage** (Partial List):
- `api-gateway/src/config/index.ts` ✅
- `api-gateway/src/routes/user-dashboard.routes.ts` ✅
- `api-gateway/src/routes/onboarding.routes.ts` ✅
- `api-gateway/src/routes/health.routes.ts` ✅
- `rankmybrand-frontend/src/lib/api/index.ts` ✅
- `services/dashboard/lib/api-client.ts` ✅
- `services/dashboard/app/admin/control/page.tsx` ✅
- All other frontend API calls ✅

---

## 📊 AUDIT STATISTICS

| Category | Count | Status |
|----------|-------|--------|
| **Total Hardcoded Instances** | 11 | - |
| **Critical (No Fallback)** | 5 | ⚠️ FIX REQUIRED |
| **Medium (Config Issue)** | 1 | ⚠️ FIX REQUIRED |
| **Low (Docs/Test)** | 3 | ✅ Acceptable |
| **With Fallbacks** | 50+ | ✅ Correct Pattern |

---

## 🎯 REQUIRED FIXES SUMMARY

### Files to Modify (6 files):

1. ⚠️ `api-gateway/src/routes/admin.routes.ts` (Line 926)
2. ⚠️ `services/intelligence-engine/src/main.py` (Line 331)
3. ⚠️ `services/dashboard/app/admin/audits/page.tsx` (Lines 289, 482)
4. ⚠️ `services/dashboard/app/r/[token]/page.tsx` (Line 54)
5. 🟡 `rankmybrand-frontend/src/app/test-redirect/page.tsx` (Line 6)

### Environment Variables Needed:

#### Root .env (Add if missing):
```bash
# Already exists - verify
ADMIN_DASHBOARD_URL=http://localhost:3003
DASHBOARD_BASE_URL=http://localhost:3000

# Add new CORS config for Intelligence Engine
CORS_ORIGINS=http://localhost:3000,http://localhost:3003
```

#### services/dashboard/.env.local (Add):
```bash
NEXT_PUBLIC_ADMIN_DASHBOARD_URL=http://localhost:3003
NEXT_PUBLIC_DASHBOARD_BASE_URL=http://localhost:3000
NEXT_PUBLIC_INTELLIGENCE_ENGINE=http://localhost:8002
```

#### rankmybrand-frontend/.env.local (Verify exists):
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_GATEWAY=http://localhost:4000
```

---

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Backend Fixes (Priority 1)
1. Fix `admin.routes.ts` shareable link generation
2. Fix `intelligence-engine/main.py` CORS configuration
3. Restart API Gateway
4. Restart Intelligence Engine

### Phase 2: Admin Dashboard Fixes (Priority 1)
1. Fix `services/dashboard/app/admin/audits/page.tsx` (2 locations)
2. Fix `services/dashboard/app/r/[token]/page.tsx`
3. Add environment variables to `services/dashboard/.env.local`
4. Restart Admin Dashboard service

### Phase 3: Frontend Fix (Priority 2)
1. Fix `rankmybrand-frontend/src/app/test-redirect/page.tsx`
2. Restart Frontend service (if needed)

### Phase 4: Testing & Verification
1. Test shareable link generation (backend)
2. Test shareable link display (admin dashboard)
3. Test token redirect flow (full end-to-end)
4. Test execute audit feature
5. Verify CORS works for all origins
6. Test in production-like environment

---

## 🔒 PRODUCTION READINESS

### Before Deployment:

- [ ] All 6 files fixed with environment variables
- [ ] Environment variables configured for production
- [ ] CORS origins updated with production domains
- [ ] Shareable link flow tested end-to-end
- [ ] Execute audit tested from admin dashboard
- [ ] No hardcoded localhost URLs remain in critical paths

### Production Environment Variables:

```bash
# Production values
ADMIN_DASHBOARD_URL=https://admin.rankmybrand.ai
DASHBOARD_BASE_URL=https://app.rankmybrand.ai
CORS_ORIGINS=https://app.rankmybrand.ai,https://admin.rankmybrand.ai
INTELLIGENCE_SERVICE=http://intelligence-engine:8002
NEXT_PUBLIC_ADMIN_DASHBOARD_URL=https://admin.rankmybrand.ai
NEXT_PUBLIC_DASHBOARD_BASE_URL=https://app.rankmybrand.ai
NEXT_PUBLIC_INTELLIGENCE_ENGINE=http://intelligence-engine:8002
```

---

## ✅ CONCLUSION

**Claim: "No hardcoded ports in critical paths"**
**Status**: ❌ **INCORRECT**

**Actual Finding**: 5 critical hardcoded ports found in production-critical paths with NO environment variable fallbacks.

**Impact**:
- 🔴 Shareable link feature completely broken in production
- 🔴 Execute audit feature broken in production
- 🔴 Token redirect flow broken in production
- 🟡 CORS will fail with production domains

**Action Required**:
- Immediate fix of all 6 identified files
- Add missing environment variables
- Comprehensive testing before production deployment

**Recommendation**:
- Implement automated linting rule to prevent hardcoded URLs
- Add CI/CD check for `localhost` strings in production code
- Create centralized config module for all service URLs

---

**Report Generated**: 2025-10-24
**Auditor**: Claude Code (System Architect)
**Standard**: Apple-Grade Quality Assurance
**Status**: ⚠️ **ACTION REQUIRED**
