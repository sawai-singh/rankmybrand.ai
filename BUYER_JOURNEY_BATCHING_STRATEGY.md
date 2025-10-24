# Buyer-Journey Batching Strategy - Hybrid Per-Response + Batched Analysis

**Date:** 2025-10-22
**Goal:** Reduce unnecessary LLM API calls while maintaining quality and per-response data

---

## 🎯 Core Principle

> "Only use LLM when absolutely necessary. Use fast string matching and math for everything else."

---

## 📊 Current Analysis Breakdown (What's LLM vs Non-LLM?)

### Per-Response Analysis (Current FULL Mode)

```python
analyze_response() {
    # 1. Brand/Competitor/Sentiment Analysis
    _full_analysis()  # ← 1 LLM CALL

    # 2. GEO Score Calculation
    _calculate_response_geo_score()  # ← NO LLM (math + website fetch)

    # 3. SOV Score Calculation
    _calculate_response_sov_score()  # ← NO LLM (pure math)

    # 4. Context Completeness
    _calculate_context_completeness_score()  # ← NO LLM (pure math)

    # 5. Recommendations Extraction (FULL mode only)
    if mode == FULL:
        extract_recommendations_async()  # ← 1 LLM CALL
        extract_competitive_gaps()  # ← 1 LLM CALL
        extract_content_opportunities()  # ← 1 LLM CALL
}
```

**Total per response in FULL mode:** 4 LLM calls
**Total for 192 responses:** 192 × 4 = **768 LLM calls** 🔴

---

## ✅ Proposed Strategy: Hybrid Analysis

### Phase 1: Per-Response NON-LLM Analysis (Keep)
```
For each response (192 total):
  ✅ Brand mention detection (string matching) - NO LLM
  ✅ Competitor mention detection (string matching) - NO LLM
  ✅ Sentiment analysis (keyword matching) - NO LLM
  ✅ GEO score (math + website fetch) - NO LLM
  ✅ SOV score (pure math) - NO LLM
  ✅ Context completeness (math) - NO LLM

  Store in audit_responses table:
  - brand_mentioned (boolean)
  - mention_position (integer)
  - sentiment (string)
  - geo_score (float)
  - sov_score (float)
  - context_completeness_score (float)
  - competitors_mentioned (jsonb)
```

**Result:** Complete per-response data WITHOUT any LLM calls! ✨

---

### Phase 2: Buyer-Journey Batching (LLM-Based Insights)

#### Step 1: Group by Buyer Journey Category
```sql
SELECT
  ar.id, ar.response_text, ar.provider,
  aq.query_text, aq.query_category
FROM audit_responses ar
JOIN audit_queries aq ON ar.query_id = aq.id
WHERE ar.audit_id = ?
ORDER BY aq.query_category
```

**Result:**
```
problem_unaware: 32 responses
solution_seeking: 32 responses
brand_specific: 32 responses
comparison: 32 responses
purchase_intent: 32 responses
use_case: 32 responses
```

#### Step 2: Batch Analysis (4 batches per category)
```
For EACH category (6 total):
  - Split 32 responses into 4 batches
  - Each batch = 8 responses

  Batch 1 (responses 1-8):
    └─ Analyze together in single LLM context
  Batch 2 (responses 9-16):
    └─ Analyze together in single LLM context
  Batch 3 (responses 17-24):
    └─ Analyze together in single LLM context
  Batch 4 (responses 25-32):
    └─ Analyze together in single LLM context
```

#### Step 3: Extract Insights Per Batch (3 LLM calls)
```
For each batch (8 responses combined):
  1. Extract recommendations → 1 LLM call
  2. Extract competitive gaps → 1 LLM call
  3. Extract content opportunities → 1 LLM call
```

**Batch Prompt Example:**
```
You are analyzing 8 AI responses for the COMPARISON buyer journey stage.

Responses:
1. [Query: "Wrangler vs Levi's jeans"] [Provider: OpenAI] [Response: ...]
2. [Query: "Best denim brands comparison"] [Provider: Claude] [Response: ...]
... (8 total)

Extract:
1. Strategic recommendations for COMPARISON stage
2. Competitive gaps where competitors excel
3. Content opportunities to dominate COMPARISON queries

Return JSON with structured insights.
```

---

## 🧮 LLM Call Calculation

### New Architecture
```
Phase 1 (Per-Response): 192 responses × 0 LLM calls = 0 calls ✅

Phase 2 (Batched Insights):
  6 categories × 4 batches = 24 total batches
  24 batches × 3 extractions = 72 LLM calls

TOTAL: 72 LLM calls (vs 768 currently)
REDUCTION: 90.6% 🚀
```

---

## 💾 Data Storage Strategy

### 1. audit_responses Table (Per-Response Data)
**Current columns - NO CHANGES:**
```sql
CREATE TABLE audit_responses (
  id UUID PRIMARY KEY,
  audit_id UUID,
  query_id UUID,
  provider TEXT,
  response_text TEXT,

  -- Per-response analysis (NON-LLM)
  brand_mentioned BOOLEAN,
  mention_position INTEGER,
  sentiment TEXT,
  geo_score NUMERIC(5,2),
  sov_score NUMERIC(5,2),
  context_completeness_score NUMERIC(5,2),
  competitors_mentioned JSONB,

  -- Metadata
  response_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP
);
```

**No schema changes needed!** ✅

---

### 2. New Table: buyer_journey_insights (Batched Insights)

```sql
CREATE TABLE buyer_journey_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES ai_visibility_audits(id),

  -- Buyer journey context
  buyer_journey_category TEXT NOT NULL, -- 'problem_unaware', 'solution_seeking', etc.
  batch_number INTEGER NOT NULL, -- 1, 2, 3, or 4

  -- Batch metadata
  response_count INTEGER NOT NULL, -- Number of responses in this batch
  response_ids UUID[], -- Array of response IDs in this batch

  -- Batched insights (LLM-extracted)
  recommendations JSONB, -- [{text, priority, impact, timeline, ...}]
  competitive_gaps JSONB, -- [{competitor, gap, strategy, ...}]
  content_opportunities JSONB, -- [{topic, content_type, keywords, ...}]

  -- Processing metadata
  created_at TIMESTAMP DEFAULT NOW(),
  processing_time_ms INTEGER,
  llm_model TEXT DEFAULT 'gpt-5-nano',

  UNIQUE(audit_id, buyer_journey_category, batch_number)
);

CREATE INDEX idx_buyer_journey_insights_audit
  ON buyer_journey_insights(audit_id);

CREATE INDEX idx_buyer_journey_insights_category
  ON buyer_journey_insights(audit_id, buyer_journey_category);
```

**Example data:**
```json
{
  "audit_id": "abc-123",
  "buyer_journey_category": "comparison",
  "batch_number": 1,
  "response_count": 8,
  "response_ids": ["resp-1", "resp-2", ..., "resp-8"],
  "recommendations": [
    {
      "text": "Create head-to-head comparison pages for Wrangler vs top 5 competitors",
      "category": "Content Strategy",
      "priority": 9,
      "impact": "High",
      "buyer_journey_context": "comparison"
    }
  ],
  "competitive_gaps": [...],
  "content_opportunities": [...]
}
```

---

### 3. dashboard_data Table (Aggregated View)

**Add new column:**
```sql
ALTER TABLE dashboard_data
ADD COLUMN buyer_journey_insights JSONB;
```

**Structure:**
```json
{
  "problem_unaware": {
    "total_responses": 32,
    "avg_geo_score": 45.3,
    "avg_sov_score": 38.2,
    "recommendations": [...], // Top 10 across all batches
    "competitive_gaps": [...], // Top 5
    "content_opportunities": [...] // Top 5
  },
  "solution_seeking": {...},
  "brand_specific": {...},
  "comparison": {...},
  "purchase_intent": {...},
  "use_case": {...}
}
```

---

## 🔄 Implementation Flow

### Current Job Processor Flow (TO BE MODIFIED)

```python
# Phase 3: Analyze responses
analyses = await self._analyze_responses(
    audit_id, responses, company_context
)
# Currently: 192 responses × 4 LLM calls = 768 calls
```

### New Job Processor Flow

```python
# Phase 3A: Per-Response NON-LLM Analysis
per_response_data = await self._analyze_responses_fast(
    audit_id, responses, company_context
)
# 192 responses × 0 LLM calls = 0 calls ✅
# Stores: brand_mentioned, geo_score, sov_score per response

# Phase 3B: Group by Buyer Journey
grouped_responses = await self._group_responses_by_buyer_journey(audit_id)
# Result: 6 categories of ~32 responses each

# Phase 3C: Batched LLM Analysis
buyer_journey_insights = await self._extract_buyer_journey_insights(
    grouped_responses, company_context
)
# 6 categories × 4 batches × 3 extractions = 72 LLM calls
# Stores: recommendations, gaps, opportunities per batch

# Phase 3D: Aggregate for Dashboard
await self._store_buyer_journey_insights(audit_id, buyer_journey_insights)
```

---

## 🎨 Dashboard UX Changes

### Per-Response Table (Keep Existing)
```
Response | Provider | Query | Brand? | GEO | SOV | Sentiment
---------|----------|-------|--------|-----|-----|----------
#1       | OpenAI   | ...   | Yes    | 67  | 45  | Positive
#2       | Claude   | ...   | No     | 23  | 12  | Neutral
...
```

**No changes needed!** All per-response data is still available.

### NEW: Buyer Journey Insights Tab
```
┌─────────────────────────────────────────────────────────┐
│ Buyer Journey Analysis                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Problem Unaware] [Solution Seeking] [Brand Specific]   │
│ [Comparison] [Purchase Intent] [Use Case]               │
│                                                          │
│ ┌─ COMPARISON Stage (32 responses) ──────────────────┐  │
│ │                                                     │  │
│ │ Avg GEO Score: 45.3  Avg SOV Score: 38.2          │  │
│ │                                                     │  │
│ │ 🎯 TOP RECOMMENDATIONS (10)                        │  │
│ │ 1. Create head-to-head comparison pages [Priority 9]│ │
│ │ 2. Add comparison calculator tool [Priority 8]     │  │
│ │ 3. Publish "Wrangler vs X" blog series [Priority 7]│  │
│ │                                                     │  │
│ │ 🔍 COMPETITIVE GAPS (5)                            │  │
│ │ 1. Levi's dominates price comparison queries       │  │
│ │ 2. Lee mentioned more in durability discussions    │  │
│ │                                                     │  │
│ │ 💡 CONTENT OPPORTUNITIES (5)                       │  │
│ │ 1. Interactive denim comparison tool               │  │
│ │ 2. Video: "Wrangler vs Levi's Real World Test"    │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Benefits of This Strategy

### 1. **90.6% LLM Call Reduction**
- Before: 768 LLM calls
- After: 72 LLM calls
- Savings: $0.696 per audit (@ $0.001/call)

### 2. **Per-Response Data Preserved**
- All individual response metrics maintained
- No loss of granular visibility
- Dashboard per-response table unchanged

### 3. **Higher Quality Insights**
- Context-aware recommendations per buyer journey stage
- Batch analysis provides better pattern recognition
- 8 responses analyzed together = richer insights

### 4. **Better Performance**
- Faster analysis (fewer API calls)
- Parallel batch processing
- Reduced network overhead

### 5. **Scalable Architecture**
- Clean separation: fast analysis vs deep insights
- Easy to add more buyer journey categories
- Can adjust batch size per category

---

## 🔧 Implementation Checklist

### Backend Changes

#### 1. Response Analyzer (response_analyzer.py)
- [ ] Create `AnalysisMode.FAST_ONLY` - NO LLM calls
- [ ] Brand detection via string matching
- [ ] Sentiment via keyword matching
- [ ] GEO/SOV calculations (already non-LLM)

#### 2. Job Processor (job_processor.py)
- [ ] Modify `_analyze_responses()` to use `AnalysisMode.FAST_ONLY`
- [ ] Create `_group_responses_by_buyer_journey()`
- [ ] Create `_extract_buyer_journey_insights()` with batching
- [ ] Create `_store_buyer_journey_insights()` for new table

#### 3. Database Migration
- [ ] Create `buyer_journey_insights` table
- [ ] Add `buyer_journey_insights` column to `dashboard_data`
- [ ] Create indexes for performance

#### 4. Dashboard Data Populator (dashboard_data_populator.py)
- [ ] Fetch batched insights from `buyer_journey_insights`
- [ ] Aggregate per category
- [ ] Store in `dashboard_data.buyer_journey_insights`

### Frontend Changes

#### 1. Dashboard Components
- [ ] Create `BuyerJourneyInsights` component
- [ ] Add category tabs
- [ ] Display recommendations/gaps/opportunities
- [ ] Show per-category metrics (avg GEO, avg SOV)

#### 2. Per-Response Table
- [ ] No changes needed (already has all data)

---

## 🎯 Success Criteria

1. ✅ **90%+ LLM call reduction** (768 → 72)
2. ✅ **Per-response data intact** (brand mentions, GEO, SOV)
3. ✅ **Context-aware insights** (tailored to buyer journey stage)
4. ✅ **Dashboard shows both** (per-response + aggregate insights)
5. ✅ **No quality loss** (better insights through batching)

---

## 📊 Comparison: Current vs Proposed

| Metric | Current (FULL) | Proposed (Hybrid) | Change |
|--------|----------------|-------------------|--------|
| LLM Calls per Response | 4 | 0 | -100% |
| Total LLM Calls (192 responses) | 768 | 72 | -90.6% |
| Per-Response Data | ✅ Yes | ✅ Yes | Same |
| Batched Insights | ❌ No | ✅ Yes | NEW |
| Brand Mention Detection | ✅ LLM | ✅ String | Better |
| GEO/SOV Scores | ✅ Math | ✅ Math | Same |
| Recommendations Quality | Individual | Batched + Context | Better |
| Analysis Time | ~25-30 min | ~3-5 min | 83% faster |
| Cost per Audit | $0.768 | $0.072 | 91% cheaper |

---

## 🚀 Next Steps

1. **Approve Strategy** - Confirm this approach makes sense
2. **Create Migration** - New `buyer_journey_insights` table
3. **Modify Response Analyzer** - Add `FAST_ONLY` mode
4. **Update Job Processor** - Implement hybrid flow
5. **Update Dashboard Populator** - Aggregate batched insights
6. **Build Frontend** - New buyer journey insights tab
7. **Test End-to-End** - Run audit and verify all data

---

## ❓ Open Questions

1. **Batch size** - Is 8 responses per batch optimal? (Can adjust 4-16)
2. **Storage** - New table vs JSONB in dashboard_data? (Recommending new table)
3. **Deduplication** - Should AI deduplicate across batches? (Yes, already in aggregator)
4. **Display** - Show all batches or only top aggregated? (Recommend top aggregated)

---

**Ready to implement?** Let me know if this strategy aligns with your vision! 🎯
