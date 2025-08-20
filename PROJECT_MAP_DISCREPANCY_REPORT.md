# PROJECT MAP DISCREPANCY REPORT
*Generated: August 21, 2025*

## Executive Summary
This report details all discrepancies found between the PROJECT_MAP.md documentation and the actual project structure.

## Major Discrepancies Found

### 1. ❌ MISSING SERVICES
The following services are documented but DO NOT exist in the filesystem:
- **brand-service** - Not found anywhere in the project
- **analytics-service** - Not found anywhere in the project  
- **notification-service** - Not found anywhere in the project
- **frontend/** directory - Does not exist (there's rankmybrand-frontend/ instead)
- **shared/** directory - Does not exist (there's services/shared-types/ instead)

### 2. ⚠️ MIGRATIONS MISMATCH
**Documented migrations:**
- 001_initial_schema.sql ❌ (does not exist)
- 002_ai_queries.sql ❌ (does not exist)

**Actual migrations found:**
- 003_enhanced_company_tracking.sql ✅
- 003_enhanced_company_tracking_fixed.sql ✅
- 004_session_journey_view.sql ✅
- 005_add_user_onboarding_system.sql ✅
- 005_add_user_onboarding_system_improved.sql ✅
- 005_report_queue.sql ✅
- 006_ai_visibility_audit_system.sql ✅
- 007_missing_tables_fixed.sql ✅

### 3. ✅ SERVICES CORRECTLY DOCUMENTED
The following services exist as documented:
- **api-gateway/** (Port 4000) ✅
- **services/dashboard/** (Port 3000) ✅
- **services/intelligence-engine/** (Port 8002) ✅
- **services/web-crawler/** (Port 3002) ✅
- **services/websocket-server/** (Port 3001) ✅
- **services/action-center/** (Port 8082) ✅
- **services/ai-response-monitor/** (Port 8001) ✅

### 4. ⚠️ STRUCTURAL DIFFERENCES

#### API Gateway Routes
**Documented routes that don't exist:**
- brand.routes.ts ❌
- analytics.routes.ts ❌
- notification.routes.ts ❌

**Actual routes found (not documented):**
- admin-ai-visibility.routes.ts ✅
- enhanced-query.routes.ts ✅
- query-status.routes.ts ✅
- report-generation.routes.ts ✅
- test-queries.routes.ts ✅
- user-dashboard.routes.ts ✅

#### Dashboard Structure
The dashboard exists but uses Next.js App Router structure:
- Has app/ directory with admin/, demo/, login/ pages ✅
- Has components/ with UI components ✅
- Missing documented pages/ directory (using app/ instead)

### 5. ✅ CORRECTLY DOCUMENTED ITEMS
- Docker files: docker-compose.yml, docker-compose.production.yml ✅
- Scripts structure: launch/, deployment/, utilities/ ✅
- All launch scripts exist as documented ✅
- All utility scripts exist as documented ✅
- Documentation structure: architecture/, guides/, troubleshooting/ ✅

### 6. 📁 ADDITIONAL ITEMS NOT DOCUMENTED
Found in project but not in PROJECT_MAP.md:
- **services/foundation/** - Microservice foundation framework
- **services/websocket/** - Additional WebSocket service
- **monitoring/** - Complete monitoring setup with Prometheus/Grafana
- **config/** - Configuration management directory
- **database/** - Database schema files
- **logs/** - Application logs directory
- **rankMyBrand.com-main/** - Nested project directory
- **Makefile** - Build automation

### 7. ⚠️ SERVICE DEPENDENCIES
The PROJECT_MAP.md references services that don't exist, which could break:
- API Gateway routes expecting brand-service, analytics-service, notification-service
- Inter-service communication patterns
- Docker Compose orchestration if it references missing services

## Recommendations

### CRITICAL - Must Fix Immediately:
1. **Remove references to non-existent services** from PROJECT_MAP.md:
   - brand-service
   - analytics-service  
   - notification-service

2. **Update migration documentation** to reflect actual migrations (003-007)

3. **Update API Gateway routes documentation** to match actual implementation

### HIGH PRIORITY - Fix Soon:
1. **Document the monitoring setup** (Prometheus, Grafana, Loki)
2. **Add services/foundation** to documentation
3. **Clarify frontend structure** (rankmybrand-frontend vs services/dashboard)

### MEDIUM PRIORITY - Improve Documentation:
1. Add config/ directory documentation
2. Document the Makefile and its targets
3. Update service interconnection diagram to reflect actual architecture

## Verification Commands
To verify the findings:
```bash
# Check for missing services
find . -type d -name "*brand-service*" 
find . -type d -name "*analytics-service*"
find . -type d -name "*notification-service*"

# List actual services
ls -la services/

# Check migrations
ls -la migrations/

# Verify API routes
ls -la api-gateway/src/routes/
```

## Conclusion
The PROJECT_MAP.md appears to be outdated or was created based on a planned architecture that differs from the actual implementation. The most critical issue is the documentation of three major services (brand-service, analytics-service, notification-service) that don't exist, which could mislead developers trying to understand or work with the system.

The actual architecture appears to be more streamlined, with functionality possibly consolidated into the existing services rather than separated into the missing services.