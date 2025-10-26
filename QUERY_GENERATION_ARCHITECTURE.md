# Query Generation & Buyer Journey Architecture
**Last Updated:** January 2025
**Status:** ✅ 5-Phase Framework Active - Strategic Optimization Complete

---

## 🎯 5-PHASE BUYER JOURNEY FRAMEWORK

The system uses a **strategically weighted 5-phase framework** optimized for competitive intelligence:

```
Phase            Funnel Stage      Queries  Weight   Status
─────────────────────────────────────────────────────────────
discovery        awareness         6        14%      ✓
research         awareness         8        19%      ✓
evaluation       consideration     10       24%      ✓
comparison       consideration     12       29%      🔥 CRITICAL
purchase         decision          6        14%      ✓
─────────────────────────────────────────────────────────────
TOTAL                             42       100%

Focus: Comparison phase (29%) - where 60-70% of B2B deals are won/lost
```

### Migration Summary
- **Old:** 48 queries (8 per category × 6 categories, equal distribution)
- **New:** 42 queries (strategically weighted across 5 phases)
- **Improvement:** 12.5% fewer queries, 50% more focus on Comparison phase
- **Cost Savings:** 12.7% fewer LLM calls (118 → 103 total)

---

## 🔧 ACTIVE QUERY GENERATOR (Single Source of Truth)

### Intelligence Engine (Python) - PRODUCTION

**Location:** `/services/intelligence-engine/src/core/analysis/query_generator.py`

**Lines 32-42:** 5-Phase enum definition
```python
class BuyerJourneyCategory(Enum):
    """5-Phase Buyer Journey Framework
    Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)
    """
    DISCOVERY = "discovery"              # 6 queries, 14%
    RESEARCH = "research"                # 8 queries, 19%
    EVALUATION = "evaluation"            # 10 queries, 24%
    COMPARISON = "comparison"            # 12 queries, 29% - CRITICAL
    PURCHASE = "purchase"                # 6 queries, 14%
```

**Lines 124-133:** Strategic distribution weights
**Lines 808:** Category-to-stage mapping for 5 phases
**Lines 1100+:** B2B/B2C/B2B2C specific prompts (all updated for 5 phases)
**Output:** 42 queries (strategically weighted: 6-8-10-12-6)

**Purpose:** Analyze visibility in AI model responses (ChatGPT, Claude, Perplexity, Gemini)

---

## 🗂️ ARCHIVED QUERY GENERATORS (Legacy - DO NOT USE)

**Location:** `/_archived/web-crawler-legacy/src/search-intelligence/core/`

1. ❌ `query-generator.ts` - Original SEO query generator
2. ❌ `query-generator-v2.ts` - V2 with enhanced context
3. ❌ `query-generator-enhanced.ts` - Enhanced version

**Why Archived:**
- Never used in production
- Intended for traditional search engine (Google/Bing) visibility via SerpAPI
- Functionality superseded by Intelligence Engine's AI model analysis
- Zero code dependencies found

---

## 📊 FILES THAT USE CATEGORIES (Strategic Intelligence System)

### Type Definitions

**1. API Gateway (TypeScript)**
`/api-gateway/src/types/query-generation.types.ts:7-13`
```typescript
export enum BuyerJourneyPhase {
  DISCOVERY = 'discovery',              // 6 queries, 14%
  RESEARCH = 'research',                // 8 queries, 19%
  EVALUATION = 'evaluation',            // 10 queries, 24%
  COMPARISON = 'comparison',            // 12 queries, 29% - CRITICAL
  PURCHASE = 'purchase'                 // 6 queries, 14%
}
// Legacy QueryCategory enum preserved with deprecation notice
// LEGACY_TO_PHASE_MAP for data migration
```

**2. Frontend (TypeScript)**
`/rankmybrand-frontend/src/types/strategic-intelligence.ts:244-250`
```typescript
export const BUYER_JOURNEY_PHASES = [
  'discovery',        // 6 queries, 14%
  'research',         // 8 queries, 19%
  'evaluation',       // 10 queries, 24%
  'comparison',       // 12 queries, 29% - CRITICAL
  'purchase',         // 6 queries, 14%
] as const;

// PHASE_METADATA with strategic weights, colors, etc.
```

---

### Backend Analysis & Aggregation

**3. Strategic Aggregator**
`/services/intelligence-engine/src/core/analysis/strategic_aggregator.py`
- Lines 175-211: PHASE_MAPPING with strategic weights
- Lines 325+: Layer 1 - Per-phase aggregation (15 LLM calls, down from 18)
- Aggregates insights → 3 personalized insights per phase (5 phases × 3 types = 15 calls)

**4. Recommendation Extractor**
`/services/intelligence-engine/src/core/analysis/recommendation_extractor.py`
- Extracts recommendations per category from response batches

**5. Job Processor**
`/services/intelligence-engine/src/core/services/job_processor.py`
- Processes audit jobs and assigns phases to queries
- Batches queries by phase (~21 batches across 5 phases = 84 batch calls)

**6. Dashboard Data Populator**
`/services/intelligence-engine/src/core/services/dashboard_data_populator.py`
- Populates dashboard with phase-based insights

---

### Frontend Components (Display/Visualization)

**7. Buyer Journey Insights View**
`/rankmybrand-frontend/src/components/dashboard/strategic/BuyerJourneyInsightsView.tsx`
- Displays insights grouped by buyer journey phase (5 phases)
- Shows batch-level analysis per phase
- "CRITICAL" badge on Comparison phase
- Updated to show 84 LLM calls (down from 96)

**8. Category Insights Grid**
`/rankmybrand-frontend/src/components/dashboard/strategic/CategoryInsightsGrid.tsx`
- Grid view of all 5 phases with insights
- Strategic weight display (14%-29%) per phase
- Orange highlight for Comparison phase (CRITICAL)
- Shows recommendations/gaps/opportunities per phase
- Updated footer: 15 LLM calls (down from 18)

---

### API Routes

**9. Intelligence Engine Routes**
`/services/intelligence-engine/src/api/ai_visibility_routes.py`
- Endpoints for querying by category

**10. Real-time Data**
`/services/intelligence-engine/src/api/ai_visibility_real.py`
- Real-time category-based data

**11. User Dashboard Routes**
`/api-gateway/src/routes/user-dashboard.routes.ts`
- Dashboard API that serves category insights

**12. Enhanced Query Routes**
`/api-gateway/src/routes/enhanced-query.routes.ts`
- Enhanced query generation with category metadata

**13. Real Data Service**
`/api-gateway/src/services/real-data.service.ts`
- Real data service using categories

**14. Prompt Builder Service**
`/api-gateway/src/services/prompt-builder.service.ts`
- Builds prompts for category-specific analysis

---

### Database & Migrations

**15. Buyer Journey Category Migration (Legacy)**
`/migrations/009_add_buyer_journey_category.sql`
- Adds buyer_journey_category column to queries table (deprecated)

**16. Strategic Intelligence System**
`/migrations/010_complete_strategic_intelligence_system.sql`
- Strategic intelligence schema with category support (migrated to phases)

**17. Dashboard Integration**
`/migrations/011_add_strategic_intelligence_to_dashboard.sql`
- Dashboard integration with categories (migrated to phases)

**18. 5-Phase Framework Migration** ✨ NEW
`/migrations/012_migrate_to_5_phase_framework.sql`
- Migrates 6 categories → 5 phases
- Creates buyer_journey_phase_config table
- Legacy mapping table for backward compatibility
- Phase analytics views
- Complete rollback script included

**19. Query Metadata**
`/api-gateway/migrations/add_query_metadata.sql`
- Query metadata with phase field (updated)

---

### Documentation Files

**20. Batching Strategy**
`/BUYER_JOURNEY_BATCHING_STRATEGY.md`
- Strategy for batching queries by category (updated for phases)

**21. Implementation Complete**
`/BUYER_JOURNEY_BATCHING_IMPLEMENTATION_COMPLETE.md`
- Implementation details of category batching (updated for phases)

**22. 103 Call Architecture** ✨ UPDATED
`/118_CALL_ARCHITECTURE_COMPLETE.md`
- 103 LLM call architecture (84 phase-based + 15 Layer 1 + 3 Layer 2 + 1 Layer 3)
- Down from 118 calls (12.7% cost savings)

**23. 5-Phase Migration Status** ✨ NEW
`/5_PHASE_MIGRATION_IMPLEMENTATION_STATUS.md`
- Complete implementation tracking
- Before/after comparison tables
- Strategic benefits analysis
- Testing checklist
- Deployment plan

**24. Query Generation Merge**
`/QUERY_GENERATION_MERGE_COMPLETE.md`
- Query generation merge with categories (historical)

**25. Query Generation Comparison**
`/QUERY_GENERATION_COMPARISON.md`
- Comparison of query generation approaches (historical)

---

## 🎯 ARCHITECTURE FLOW

```
Query Generation (query_generator.py) - 42 queries across 5 phases
    ↓
Batch Processing (job_processor.py) - ~84 batch calls
    ↓
Strategic Aggregation (strategic_aggregator.py) - 18 LLM calls total:
    • Layer 1: 15 calls (5 phases × 3 types)
    • Layer 2: 3 calls (strategic priorities)
    • Layer 3: 1 call (executive summary) - shown separately
    ↓
Dashboard Display (CategoryInsightsGrid.tsx, BuyerJourneyInsightsView.tsx)
```

**Total LLM Calls:** 103 (down from 118, 12.7% cost savings)

---

## 📈 SYSTEM METRICS

**Core Architecture:**
- ✅ 1 active query generator: `query_generator.py` (Intelligence Engine)
- ✅ **5 buyer journey phases:** Strategically weighted framework
- ✅ **84 LLM batches:** Optimized phase-based batching
- ✅ 3-layer aggregation: Phase insights → Strategic priorities → Executive summary

**Phase Coverage:**
- **42 queries generated** (strategically weighted: 6-8-10-12-6)
- **84 batches processed** (~21 batches across 5 phases)
- **15 LLM calls** for Layer 1 aggregation (5 phases × 3 types)
- **29% focus on Comparison phase** (where 60-70% of B2B deals are won/lost)
- Full buyer journey funnel coverage

**Cost Optimization:**
- **12.7% fewer LLM calls:** 118 → 103 total
- **12.5% fewer queries:** 48 → 42 (more focused)
- **50% more Comparison queries:** 8 → 12 (strategic priority)

---

## 🧹 MIGRATION HISTORY

**December 2024 - Web Crawler Archival**
- Moved all SEO-focused query generators to `_archived/web-crawler-legacy/`
- Removed 3 unused TypeScript query generators
- Established single source of truth in Intelligence Engine
- Zero code dependencies on archived generators verified

**January 2025 - 5-Phase Framework Migration** ✨
- Migrated from 6-category to 5-phase strategic framework
- Removed USE_CASE phase (post-purchase, not acquisition-focused)
- Implemented strategic weighting (Comparison: 29%, others: 14-24%)
- Updated all backend Python code (query_generator.py, strategic_aggregator.py)
- Updated all frontend TypeScript types and components
- Created comprehensive database migration with rollback
- Achieved 12.7% LLM call reduction (118 → 103)
- 50% increase in Comparison phase queries (8 → 12)

---

## 🔮 FUTURE CONSIDERATIONS

**Potential Optimizations:**
- Monitor Comparison phase performance (now 29% of queries)
- Consider dynamic phase weighting based on industry/company stage
- A/B test different query distributions for specific verticals
- Explore adaptive phase allocation based on initial audit results

**If Traditional SEO Analysis Needed:**
- ❌ Don't resurrect entire web-crawler service
- ✅ Extract specific query patterns from archived generators
- ✅ Integrate SerpAPI directly into Intelligence Engine
- ✅ Reuse buyer journey phase taxonomy

**Maintenance:**
- Keep phase definitions synchronized across Python/TypeScript
- Update this document when modifying phase weights or adding phases
- Document any architectural changes to query generation flow
- Monitor phase performance metrics via v_phase_analytics view

---

**Total Files Using Phases:** 25 active files (updated from 23)
**Total Archived Files:** 16 files in `_archived/web-crawler-legacy/`
**Architecture Status:** ✅ 5-Phase Framework Active - Optimized & Production-Ready
