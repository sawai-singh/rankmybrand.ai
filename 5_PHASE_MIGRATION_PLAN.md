# 5-Phase Migration Plan: Revolutionary Platform Update
**Status:** Ready for Execution
**Impact:** Category-defining competitive advantage
**Timeline:** 2-3 weeks technical + 4-6 weeks go-to-market

---

## 🎯 STRATEGIC RATIONALE

### Why This Matters

**Current State (6 Categories - Equal Distribution):**
```
problem_unaware (8)    → 17% of queries
solution_seeking (8)   → 17% of queries
brand_specific (8)     → 17% of queries
comparison (8)         → 17% of queries ⚠️ UNDERWEIGHTED
purchase_intent (8)    → 17% of queries
use_case (8)           → 17% of queries ❌ POST-PURCHASE NOISE
────────────────────────────────────────
TOTAL: 48 queries (scattered focus)
```

**New State (5 Phases - Strategic Weighting):**
```
Discovery (6)          → 14% of queries (awareness baseline)
Research (8)           → 19% of queries (category positioning)
Evaluation (10)        → 24% of queries (brand perception)
Comparison (12)        → 29% of queries 🎯 MAXIMUM FOCUS
Purchase (6)           → 14% of queries (conversion check)
────────────────────────────────────────
TOTAL: 42 queries (laser-focused)
```

### Key Improvements

**1. Strategic Comparison Focus**
- Old: 8/48 queries (17%) on comparison
- New: 12/42 queries (29%) on comparison
- **Why:** 60-70% of B2B deals won/lost in comparison phase
- **Impact:** 2x deeper competitive intelligence

**2. Cleaner Customer Messaging**
- Old: "problem_unaware", "solution_seeking" (jargon)
- New: "Discovery", "Research", "Evaluation" (intuitive)
- **Why:** Customers immediately understand the journey
- **Impact:** Better product adoption, clearer value prop

**3. Eliminate Post-Purchase Noise**
- Removed: "use_case" (8 queries)
- **Why:** Customer success territory, not marketing budget
- **Impact:** 14% efficiency gain, sharper acquisition focus

**4. MECE Framework (Mutually Exclusive, Collectively Exhaustive)**
- Every query maps to exactly ONE phase
- Every phase covers distinct journey stage
- No overlap, no gaps
- **Why:** Intellectual rigor = defensible category leadership
- **Impact:** Competitors can't easily copy framework

---

## 📋 PHASE DEFINITIONS & QUERY ALLOCATION

### Phase 1: Discovery (6 queries - 14%)
**Replaces:** `problem_unaware`
**User Mindset:** "I have a problem, searching for solutions"
**Query Types:** Problem-focused, educational, symptom-based
**Strategic Value:** Low (awareness), Medium (thought leadership)
**Example Queries:**
- B2B: "why are AI responses inconsistent across platforms"
- B2C: "why do running shoes cause blisters"

### Phase 2: Research (8 queries - 19%)
**Replaces:** `solution_seeking`
**User Mindset:** "I know solutions exist, researching landscape"
**Query Types:** Category-level, "best of", provider comparison
**Strategic Value:** Medium (awareness), High (category leadership)
**Example Queries:**
- B2B: "best enterprise AI platforms 2025"
- B2C: "best running shoes for marathon training"

### Phase 3: Evaluation (10 queries - 24%)
**Replaces:** `brand_specific`
**User Mindset:** "I'm investigating YOUR specific brand"
**Query Types:** Brand name + investigation keywords
**Strategic Value:** High (active consideration), High (brand perception)
**Example Queries:**
- B2B: "{company_name} features and capabilities"
- B2C: "{brand_name} shoe reviews 2025"

### Phase 4: Comparison (12 queries - 29%) 🎯 CRITICAL
**Keeps:** `comparison` (50% increase in queries)
**User Mindset:** "Your brand vs competitor - who's better?"
**Query Types:** Direct comparisons, alternatives, vs queries
**Strategic Value:** HIGHEST (deals won/lost here)
**Example Queries:**
- B2B: "{company_name} vs {competitor} for {use_case}"
- B2C: "{brand_name} vs {competitor} for running"

**Why 12 Queries (29% of budget)?**
- Where 60-70% of B2B buying decisions happen
- Highest competitive intelligence value
- Most actionable insights for customers
- Direct pipeline impact
- This is THE differentiator

### Phase 5: Purchase (6 queries - 14%)
**Keeps:** `purchase_intent`
**User Mindset:** "Ready to buy - how do I proceed?"
**Query Types:** Transactional, "buy", "sign up", "demo"
**Strategic Value:** High (conversion), Medium (brand presence)
**Example Queries:**
- B2B: "buy {product_name} API"
- B2C: "buy {brand_name} online"

### Phase 6: Use Case - REMOVED ❌
**Why Dropping:**
- Post-purchase (customer already bought)
- Different budget owner (CS not marketing)
- Low urgency for brand owners
- Some queries fold into Discovery/Evaluation

---

## 🔧 TECHNICAL IMPLEMENTATION

### **Execution Order (Critical Path)**

```
1. Backend Core (Intelligence Engine)
   └─ query_generator.py enum + distribution
   └─ strategic_aggregator.py mappings
   └─ job_processor.py batch logic

2. Type Definitions (Cross-Service)
   └─ API Gateway QueryCategory enum
   └─ Frontend BUYER_JOURNEY_CATEGORIES

3. Frontend Components
   └─ Dashboard visualizations
   └─ Phase detail views
   └─ Timeline components

4. Database Migration
   └─ Phase column updates
   └─ Historical data mapping
   └─ Verify integrity

5. Documentation
   └─ Architecture docs
   └─ Customer-facing content
```

---

### **1. Intelligence Engine Updates**

#### **File: `services/intelligence-engine/src/core/analysis/query_generator.py`**

**A. Update BuyerJourneyCategory Enum (Line 32-39)**

**Current:**
```python
class BuyerJourneyCategory(Enum):
    PROBLEM_UNAWARE = "problem_unaware"
    SOLUTION_SEEKING = "solution_seeking"
    BRAND_SPECIFIC = "brand_specific"
    COMPARISON = "comparison"
    PURCHASE_INTENT = "purchase_intent"
    USE_CASE = "use_case"
```

**New:**
```python
class BuyerJourneyCategory(Enum):
    """
    5-Phase Buyer Journey Framework
    Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)
    Total: 42 queries (down from 48) for focused execution
    """
    DISCOVERY = "discovery"              # Problem awareness (replaces problem_unaware)
    RESEARCH = "research"                # Solution landscape (replaces solution_seeking)
    EVALUATION = "evaluation"            # Brand investigation (replaces brand_specific)
    COMPARISON = "comparison"            # Head-to-head (UNCHANGED - but 50% more queries)
    PURCHASE = "purchase"                # Conversion intent (replaces purchase_intent)
    # USE_CASE removed - post-purchase not acquisition-focused
```

**B. Update Category Distribution (Line 122-130)**

**Current:**
```python
# Equal distribution
self.category_distribution = {
    BuyerJourneyCategory.PROBLEM_UNAWARE: 8,
    BuyerJourneyCategory.SOLUTION_SEEKING: 8,
    BuyerJourneyCategory.BRAND_SPECIFIC: 8,
    BuyerJourneyCategory.COMPARISON: 8,
    BuyerJourneyCategory.PURCHASE_INTENT: 8,
    BuyerJourneyCategory.USE_CASE: 8
}
# Total: 48 queries
```

**New:**
```python
# Strategic weighting - focus on high-value phases
self.category_distribution = {
    BuyerJourneyCategory.DISCOVERY: 6,       # 14% - Problem awareness baseline
    BuyerJourneyCategory.RESEARCH: 8,        # 19% - Category positioning
    BuyerJourneyCategory.EVALUATION: 10,     # 24% - Brand perception (critical)
    BuyerJourneyCategory.COMPARISON: 12,     # 29% - MAXIMUM FOCUS (deals won/lost)
    BuyerJourneyCategory.PURCHASE: 6         # 14% - Conversion funnel check
}
# Total: 42 queries (down from 48, laser-focused)
# Rationale: 29% to Comparison phase where 60-70% of B2B deals are decided
```

**C. Update Query Generation Prompts (Line 170-400+)**

**Pattern to update:**
```python
# OLD REFERENCES:
if category == BuyerJourneyCategory.PROBLEM_UNAWARE:
    # ... prompt ...

# NEW REFERENCES:
if category == BuyerJourneyCategory.DISCOVERY:
    # ... updated prompt with new phase language ...
```

**Discovery Phase Prompt (new):**
```python
elif category == BuyerJourneyCategory.DISCOVERY:
    return f"""
    Generate {num_queries} Discovery phase queries for {context.company_name}.

    DISCOVERY PHASE CHARACTERISTICS:
    - User has a problem but may not know solutions exist
    - Problem-focused, not brand-focused
    - Educational intent: "why", "how to", "best practices"
    - Symptom-based searches

    CONTEXT:
    - Industry: {context.industry}
    - Pain points solved: {', '.join(context.pain_points_solved)}
    - Target audience: {context.target_audiences[0]['role']} at {context.target_audiences[0]['company_size']} companies

    QUERY REQUIREMENTS:
    1. NO brand names (pure problem exploration)
    2. Focus on symptoms and challenges
    3. Educational tone ("why", "how to prevent", "common issues")
    4. Natural language (how real people search)
    5. Diverse perspectives (technical, business, operational)

    {"B2B" if context.business_model == "B2B" else "B2C"} EXAMPLES:
    {"- 'why are AI responses inconsistent across platforms'" if context.business_model == "B2B" else "- 'why do running shoes cause blisters'"}
    {"- 'how to improve enterprise AI reliability'" if context.business_model == "B2B" else "- 'how to prevent shoe odor naturally'"}
    {"- 'common challenges with AI model deployment'" if context.business_model == "B2B" else "- 'common problems with athletic footwear'"}

    Return exactly {num_queries} queries as JSON array.
    """
```

**Comparison Phase Prompt (enhanced):**
```python
elif category == BuyerJourneyCategory.COMPARISON:
    return f"""
    Generate {num_queries} Comparison phase queries for {context.company_name}.

    COMPARISON PHASE CHARACTERISTICS (CRITICAL - 29% OF BUDGET):
    - Direct brand vs competitor comparisons
    - Alternative searches ("instead of X")
    - Multi-brand evaluations
    - Feature/pricing comparisons
    - "Which is better" queries

    THIS IS WHERE DEALS ARE WON OR LOST - PRIORITIZE:
    1. Direct head-to-head comparisons (40% of queries)
    2. Alternative/replacement searches (30% of queries)
    3. Multi-competitor comparisons (30% of queries)

    CONTEXT:
    - Your brand: {context.company_name}
    - Main competitors: {', '.join(context.competitors[:3])}
    - Unique value props: {', '.join(context.unique_value_propositions)}

    QUERY DISTRIBUTION:
    - 5 queries: Direct 1v1 comparisons
    - 4 queries: Alternative searches
    - 3 queries: Multi-brand comparisons

    EXAMPLES:
    {"B2B" if context.business_model == "B2B" else "B2C"}:
    - "{context.company_name} vs {context.competitors[0] if context.competitors else 'competitor'}"
    - "alternatives to {context.competitors[0] if context.competitors else 'competitor'} for {context.industry}"
    - "{context.company_name} vs {context.competitors[0]} vs {context.competitors[1] if len(context.competitors) > 1 else 'competitor2'}"

    Return exactly {num_queries} queries as JSON array.
    Focus on realistic comparison scenarios where your brand appears alongside competitors.
    """
```

**Testing Strategy:**
```python
# Add validation
def validate_phase_distribution(self):
    """Ensure strategic weighting is maintained"""
    total = sum(self.category_distribution.values())
    comparison_pct = (self.category_distribution[BuyerJourneyCategory.COMPARISON] / total) * 100

    assert total == 42, f"Expected 42 queries, got {total}"
    assert comparison_pct >= 25, f"Comparison phase should be ≥25%, got {comparison_pct:.1f}%"

    logger.info(f"✓ Phase distribution validated: {total} queries, Comparison: {comparison_pct:.1f}%")
```

---

#### **File: `services/intelligence-engine/src/core/analysis/strategic_aggregator.py`**

**Update CATEGORY_MAPPING (Line 170-210)**

**Current:**
```python
CATEGORY_MAPPING = {
    'problem_unaware': {
        'funnel_stage': 'awareness',
        'priority': 3,
        'business_impact': 'low'
    },
    'solution_seeking': {
        'funnel_stage': 'awareness',
        'priority': 3,
        'business_impact': 'medium'
    },
    'brand_specific': {
        'funnel_stage': 'consideration',
        'priority': 2,
        'business_impact': 'high'
    },
    'comparison': {
        'funnel_stage': 'consideration',
        'priority': 1,
        'business_impact': 'critical'
    },
    'purchase_intent': {
        'funnel_stage': 'decision',
        'priority': 2,
        'business_impact': 'high'
    },
    'use_case': {
        'funnel_stage': 'retention',
        'priority': 4,
        'business_impact': 'low'
    }
}
```

**New:**
```python
CATEGORY_MAPPING = {
    'discovery': {
        'funnel_stage': 'awareness',
        'priority': 3,
        'business_impact': 'low',
        'query_allocation': 6,
        'strategic_weight': 0.14,
        'description': 'Problem awareness - top of funnel',
        'customer_action': 'Educational content, thought leadership'
    },
    'research': {
        'funnel_stage': 'awareness',
        'priority': 3,
        'business_impact': 'medium',
        'query_allocation': 8,
        'strategic_weight': 0.19,
        'description': 'Solution landscape - category positioning',
        'customer_action': 'Category authority, comparison roundups'
    },
    'evaluation': {
        'funnel_stage': 'consideration',
        'priority': 2,
        'business_impact': 'high',
        'query_allocation': 10,
        'strategic_weight': 0.24,
        'description': 'Brand investigation - active consideration',
        'customer_action': 'Strong brand presence, reviews, testimonials'
    },
    'comparison': {
        'funnel_stage': 'consideration',
        'priority': 1,
        'business_impact': 'critical',
        'query_allocation': 12,
        'strategic_weight': 0.29,  # HIGHEST
        'description': 'Head-to-head - deals won/lost here',
        'customer_action': 'Competitive differentiation, battle cards, comparison pages'
    },
    'purchase': {
        'funnel_stage': 'decision',
        'priority': 2,
        'business_impact': 'high',
        'query_allocation': 6,
        'strategic_weight': 0.14,
        'description': 'Conversion intent - bottom of funnel',
        'customer_action': 'Clear pricing, easy signup, free trials'
    }
    # use_case removed - not acquisition-focused
}

# Add backward compatibility mapping for database migration
LEGACY_CATEGORY_MAPPING = {
    'problem_unaware': 'discovery',
    'solution_seeking': 'research',
    'brand_specific': 'evaluation',
    'comparison': 'comparison',  # unchanged
    'purchase_intent': 'purchase',
    'use_case': None  # deprecated - queries redistributed
}
```

**Update aggregation logic:**
```python
def aggregate_by_phase(self, responses: List[Dict]) -> Dict:
    """
    Layer 1: Aggregate 40 batch insights into 3 insights per phase
    Total: 18 LLM calls (3 per phase × 5 phases, down from 6)
    """
    phase_insights = {}

    for phase in ['discovery', 'research', 'evaluation', 'comparison', 'purchase']:
        phase_responses = [r for r in responses if r.get('phase') == phase]

        if not phase_responses:
            logger.warning(f"No responses for {phase} phase")
            continue

        # Get strategic weight from mapping
        weight = CATEGORY_MAPPING[phase]['strategic_weight']
        priority = CATEGORY_MAPPING[phase]['priority']

        # Aggregate with context
        insights = await self.llm_aggregate(
            responses=phase_responses,
            phase=phase,
            weight=weight,
            priority=priority,
            target_insights=3  # Always 3 per phase for consistency
        )

        phase_insights[phase] = {
            'insights': insights,
            'response_count': len(phase_responses),
            'strategic_weight': weight,
            'priority': priority,
            'business_impact': CATEGORY_MAPPING[phase]['business_impact']
        }

    logger.info(f"✓ Aggregated {len(phase_insights)} phases (down from 6)")
    return phase_insights
```

---

#### **File: `services/intelligence-engine/src/core/services/job_processor.py`**

**Update batch grouping (Line 200-300)**

**Pattern:**
```python
# OLD:
batches_by_category = {
    'problem_unaware': [],
    'solution_seeking': [],
    'brand_specific': [],
    'comparison': [],
    'purchase_intent': [],
    'use_case': []
}

# NEW:
batches_by_phase = {
    'discovery': [],
    'research': [],
    'evaluation': [],
    'comparison': [],
    'purchase': []
}

# Update logging
logger.info(f"Processing {len(batches_by_phase)} phases (5-phase framework)")
logger.info(f"Comparison phase queries: {len(batches_by_phase['comparison'])} (29% of total)")
```

---

### **2. Type Definition Updates**

#### **File: `api-gateway/src/types/query-generation.types.ts`**

**Current:**
```typescript
export enum QueryCategory {
  PROBLEM_UNAWARE = 'problem_unaware',
  SOLUTION_SEEKING = 'solution_seeking',
  BRAND_SPECIFIC = 'brand_specific',
  COMPARISON = 'comparison',
  PURCHASE_INTENT = 'purchase_intent',
  USE_CASE = 'use_case'
}
```

**New:**
```typescript
/**
 * 5-Phase Buyer Journey Framework
 * Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)
 * Total: 42 queries (optimized from 48)
 */
export enum BuyerJourneyPhase {
  DISCOVERY = 'discovery',           // Problem awareness (6 queries, 14%)
  RESEARCH = 'research',             // Solution landscape (8 queries, 19%)
  EVALUATION = 'evaluation',         // Brand investigation (10 queries, 24%)
  COMPARISON = 'comparison',         // Head-to-head (12 queries, 29% - CRITICAL)
  PURCHASE = 'purchase'              // Conversion intent (6 queries, 14%)
}

// Backward compatibility
export enum QueryCategory {
  PROBLEM_UNAWARE = 'problem_unaware',    // @deprecated Use BuyerJourneyPhase.DISCOVERY
  SOLUTION_SEEKING = 'solution_seeking',  // @deprecated Use BuyerJourneyPhase.RESEARCH
  BRAND_SPECIFIC = 'brand_specific',      // @deprecated Use BuyerJourneyPhase.EVALUATION
  COMPARISON = 'comparison',              // Maps to BuyerJourneyPhase.COMPARISON
  PURCHASE_INTENT = 'purchase_intent',    // @deprecated Use BuyerJourneyPhase.PURCHASE
  USE_CASE = 'use_case'                   // @deprecated Removed from framework
}

// Migration helper
export const LEGACY_TO_PHASE_MAP: Record<QueryCategory, BuyerJourneyPhase | null> = {
  [QueryCategory.PROBLEM_UNAWARE]: BuyerJourneyPhase.DISCOVERY,
  [QueryCategory.SOLUTION_SEEKING]: BuyerJourneyPhase.RESEARCH,
  [QueryCategory.BRAND_SPECIFIC]: BuyerJourneyPhase.EVALUATION,
  [QueryCategory.COMPARISON]: BuyerJourneyPhase.COMPARISON,
  [QueryCategory.PURCHASE_INTENT]: BuyerJourneyPhase.PURCHASE,
  [QueryCategory.USE_CASE]: null  // Redistributed to Discovery/Evaluation
};

// Phase metadata for UI
export const PHASE_METADATA = {
  [BuyerJourneyPhase.DISCOVERY]: {
    label: 'Discovery',
    description: 'Problem awareness - top of funnel',
    icon: 'search',
    color: '#3b82f6',
    queryCount: 6,
    strategicWeight: 0.14,
    priority: 3,
    businessImpact: 'low',
    funnelStage: 'awareness'
  },
  [BuyerJourneyPhase.RESEARCH]: {
    label: 'Research',
    description: 'Solution landscape exploration',
    icon: 'book-open',
    color: '#8b5cf6',
    queryCount: 8,
    strategicWeight: 0.19,
    priority: 3,
    businessImpact: 'medium',
    funnelStage: 'awareness'
  },
  [BuyerJourneyPhase.EVALUATION]: {
    label: 'Evaluation',
    description: 'Brand investigation',
    icon: 'clipboard-check',
    color: '#ec4899',
    queryCount: 10,
    strategicWeight: 0.24,
    priority: 2,
    businessImpact: 'high',
    funnelStage: 'consideration'
  },
  [BuyerJourneyPhase.COMPARISON]: {
    label: 'Comparison',
    description: 'Head-to-head - deals won/lost',
    icon: 'scale',
    color: '#ef4444',
    queryCount: 12,
    strategicWeight: 0.29,  // HIGHEST
    priority: 1,
    businessImpact: 'critical',
    funnelStage: 'consideration'
  },
  [BuyerJourneyPhase.PURCHASE]: {
    label: 'Purchase',
    description: 'Conversion intent',
    icon: 'shopping-cart',
    color: '#10b981',
    queryCount: 6,
    strategicWeight: 0.14,
    priority: 2,
    businessImpact: 'high',
    funnelStage: 'decision'
  }
} as const;
```

---

#### **File: `rankmybrand-frontend/src/types/strategic-intelligence.ts`**

**Current (Line 242-249):**
```typescript
export const BUYER_JOURNEY_CATEGORIES = [
  'problem_unaware',
  'solution_seeking',
  'brand_specific',
  'comparison',
  'purchase_intent',
  'use_case',
] as const;
```

**New:**
```typescript
/**
 * 5-Phase Buyer Journey Framework
 * Strategically weighted for maximum competitive intelligence
 */
export const BUYER_JOURNEY_PHASES = [
  'discovery',      // 6 queries (14%) - Problem awareness
  'research',       // 8 queries (19%) - Solution landscape
  'evaluation',     // 10 queries (24%) - Brand investigation
  'comparison',     // 12 queries (29%) - CRITICAL - deals won/lost
  'purchase',       // 6 queries (14%) - Conversion intent
] as const;

export type BuyerJourneyPhase = typeof BUYER_JOURNEY_PHASES[number];

// Phase display configuration
export const PHASE_CONFIG: Record<BuyerJourneyPhase, {
  label: string;
  description: string;
  icon: string;
  color: string;
  queryCount: number;
  strategicWeight: number;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  customerAction: string;
}> = {
  discovery: {
    label: 'Discovery',
    description: 'Prospects becoming aware of their problem',
    icon: 'search',
    color: 'blue',
    queryCount: 6,
    strategicWeight: 0.14,
    businessImpact: 'low',
    customerAction: 'Create educational content and thought leadership'
  },
  research: {
    label: 'Research',
    description: 'Prospects exploring solution categories',
    icon: 'book-open',
    color: 'purple',
    queryCount: 8,
    strategicWeight: 0.19,
    businessImpact: 'medium',
    customerAction: 'Build category authority and appear in "best of" lists'
  },
  evaluation: {
    label: 'Evaluation',
    description: 'Prospects investigating your specific brand',
    icon: 'clipboard-check',
    color: 'pink',
    queryCount: 10,
    strategicWeight: 0.24,
    businessImpact: 'high',
    customerAction: 'Ensure strong brand presence, reviews, and testimonials'
  },
  comparison: {
    label: 'Comparison',
    description: 'Prospects comparing you vs competitors - CRITICAL',
    icon: 'scale',
    color: 'red',
    queryCount: 12,
    strategicWeight: 0.29,
    businessImpact: 'critical',
    customerAction: 'Build competitive differentiation and comparison pages'
  },
  purchase: {
    label: 'Purchase',
    description: 'Prospects ready to convert',
    icon: 'shopping-cart',
    color: 'green',
    queryCount: 6,
    strategicWeight: 0.14,
    businessImpact: 'high',
    customerAction: 'Optimize pricing clarity and signup flow'
  }
};

// Backward compatibility (for migration period)
export const LEGACY_CATEGORIES = [
  'problem_unaware',
  'solution_seeking',
  'brand_specific',
  'comparison',
  'purchase_intent',
  'use_case',
] as const;

export const LEGACY_TO_PHASE_MAP = {
  problem_unaware: 'discovery',
  solution_seeking: 'research',
  brand_specific: 'evaluation',
  comparison: 'comparison',
  purchase_intent: 'purchase',
  use_case: null  // Deprecated
} as const;
```

---

### **3. Database Migration**

**File: `migrations/012_migrate_to_5_phase_framework.sql`**

```sql
-- =====================================================
-- Migration: 6-Category to 5-Phase Framework
-- Date: 2025-01-XX
-- Impact: Renames phases, redistributes use_case queries
-- Backward compatible: Yes (via legacy mapping)
-- =====================================================

BEGIN;

-- Step 1: Add new phase column (temporary)
ALTER TABLE audit_queries
ADD COLUMN buyer_journey_phase VARCHAR(50);

-- Step 2: Migrate existing data
UPDATE audit_queries
SET buyer_journey_phase = CASE buyer_journey_category
    WHEN 'problem_unaware' THEN 'discovery'
    WHEN 'solution_seeking' THEN 'research'
    WHEN 'brand_specific' THEN 'evaluation'
    WHEN 'comparison' THEN 'comparison'
    WHEN 'purchase_intent' THEN 'purchase'
    WHEN 'use_case' THEN 'discovery'  -- Redistribute to discovery
    ELSE NULL
END;

-- Step 3: Verify migration
DO $$
DECLARE
    unmapped_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmapped_count
    FROM audit_queries
    WHERE buyer_journey_category IS NOT NULL
    AND buyer_journey_phase IS NULL;

    IF unmapped_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % queries not mapped', unmapped_count;
    END IF;

    RAISE NOTICE 'Migration verified: All queries mapped successfully';
END $$;

-- Step 4: Update dashboard_data JSONB columns
UPDATE dashboard_data
SET category_insights = jsonb_object_agg(
    CASE key
        WHEN 'problem_unaware' THEN 'discovery'
        WHEN 'solution_seeking' THEN 'research'
        WHEN 'brand_specific' THEN 'evaluation'
        WHEN 'comparison' THEN 'comparison'
        WHEN 'purchase_intent' THEN 'purchase'
        WHEN 'use_case' THEN 'discovery'
        ELSE key
    END,
    value
)
FROM jsonb_each(category_insights)
WHERE category_insights IS NOT NULL;

UPDATE dashboard_data
SET buyer_journey_insights = jsonb_object_agg(
    CASE key
        WHEN 'problem_unaware' THEN 'discovery'
        WHEN 'solution_seeking' THEN 'research'
        WHEN 'brand_specific' THEN 'evaluation'
        WHEN 'comparison' THEN 'comparison'
        WHEN 'purchase_intent' THEN 'purchase'
        WHEN 'use_case' THEN 'discovery'
        ELSE key
    END,
    value
)
FROM jsonb_each(buyer_journey_insights)
WHERE buyer_journey_insights IS NOT NULL;

-- Step 5: Rename column (after verifying data)
ALTER TABLE audit_queries
DROP COLUMN buyer_journey_category;

ALTER TABLE audit_queries
RENAME COLUMN buyer_journey_phase TO buyer_journey_category;

-- Step 6: Update constraints
ALTER TABLE audit_queries
ADD CONSTRAINT check_buyer_journey_phase
CHECK (buyer_journey_category IN ('discovery', 'research', 'evaluation', 'comparison', 'purchase'));

-- Step 7: Create legacy mapping view (for backward compatibility)
CREATE OR REPLACE VIEW legacy_category_mapping AS
SELECT
    id,
    CASE buyer_journey_category
        WHEN 'discovery' THEN 'problem_unaware'
        WHEN 'research' THEN 'solution_seeking'
        WHEN 'evaluation' THEN 'brand_specific'
        WHEN 'comparison' THEN 'comparison'
        WHEN 'purchase' THEN 'purchase_intent'
    END as legacy_category,
    buyer_journey_category as new_phase
FROM audit_queries;

-- Step 8: Add metadata table for phase configuration
CREATE TABLE IF NOT EXISTS buyer_journey_phase_config (
    phase VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    query_allocation INTEGER NOT NULL,
    strategic_weight DECIMAL(3,2) NOT NULL,
    priority INTEGER NOT NULL,
    business_impact VARCHAR(20) NOT NULL,
    funnel_stage VARCHAR(50) NOT NULL,
    customer_action TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 9: Insert phase configuration
INSERT INTO buyer_journey_phase_config
(phase, label, description, query_allocation, strategic_weight, priority, business_impact, funnel_stage, customer_action)
VALUES
('discovery', 'Discovery', 'Problem awareness - top of funnel', 6, 0.14, 3, 'low', 'awareness',
 'Create educational content and thought leadership'),

('research', 'Research', 'Solution landscape exploration', 8, 0.19, 3, 'medium', 'awareness',
 'Build category authority and appear in "best of" lists'),

('evaluation', 'Evaluation', 'Brand investigation - active consideration', 10, 0.24, 2, 'high', 'consideration',
 'Ensure strong brand presence, reviews, and testimonials'),

('comparison', 'Comparison', 'Head-to-head - deals won/lost here', 12, 0.29, 1, 'critical', 'consideration',
 'Build competitive differentiation and comparison pages'),

('purchase', 'Purchase', 'Conversion intent - bottom of funnel', 6, 0.14, 2, 'high', 'decision',
 'Optimize pricing clarity and signup flow')
ON CONFLICT (phase) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    query_allocation = EXCLUDED.query_allocation,
    strategic_weight = EXCLUDED.strategic_weight,
    priority = EXCLUDED.priority,
    business_impact = EXCLUDED.business_impact,
    funnel_stage = EXCLUDED.funnel_stage,
    customer_action = EXCLUDED.customer_action,
    updated_at = NOW();

-- Step 10: Verify final state
DO $$
DECLARE
    phase_count INTEGER;
    total_queries INTEGER;
    comparison_queries INTEGER;
BEGIN
    -- Verify 5 phases exist
    SELECT COUNT(DISTINCT buyer_journey_category) INTO phase_count FROM audit_queries;
    IF phase_count != 5 THEN
        RAISE WARNING 'Expected 5 phases, found %', phase_count;
    END IF;

    -- Verify total query allocation
    SELECT SUM(query_allocation) INTO total_queries FROM buyer_journey_phase_config;
    IF total_queries != 42 THEN
        RAISE WARNING 'Expected 42 total queries, found %', total_queries;
    END IF;

    -- Verify comparison phase has highest allocation
    SELECT query_allocation INTO comparison_queries
    FROM buyer_journey_phase_config WHERE phase = 'comparison';
    IF comparison_queries != 12 THEN
        RAISE WARNING 'Expected 12 comparison queries, found %', comparison_queries;
    END IF;

    RAISE NOTICE '✓ Migration complete: 5 phases, 42 queries, comparison phase prioritized';
END $$;

COMMIT;

-- Rollback script (in case of issues)
-- BEGIN;
-- ALTER TABLE audit_queries RENAME COLUMN buyer_journey_category TO buyer_journey_phase;
-- ALTER TABLE audit_queries ADD COLUMN buyer_journey_category VARCHAR(50);
-- UPDATE audit_queries SET buyer_journey_category =
--   CASE buyer_journey_phase
--     WHEN 'discovery' THEN 'problem_unaware'
--     WHEN 'research' THEN 'solution_seeking'
--     WHEN 'evaluation' THEN 'brand_specific'
--     WHEN 'comparison' THEN 'comparison'
--     WHEN 'purchase' THEN 'purchase_intent'
--   END;
-- ALTER TABLE audit_queries DROP COLUMN buyer_journey_phase;
-- DROP TABLE buyer_journey_phase_config;
-- DROP VIEW legacy_category_mapping;
-- COMMIT;
```

---

### **4. Frontend Component Updates**

#### **Timeline Visualization Component**

**File: `rankmybrand-frontend/src/components/dashboard/strategic/JourneyTimeline.tsx` (NEW)**

```typescript
'use client';

import { BUYER_JOURNEY_PHASES, PHASE_CONFIG } from '@/types/strategic-intelligence';
import { ChevronRight, AlertTriangle } from 'lucide-react';

interface JourneyTimelineProps {
  scores: Record<string, number>;
  onPhaseClick?: (phase: string) => void;
}

export function JourneyTimeline({ scores, onPhaseClick }: JourneyTimelineProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Strong';
    if (score >= 50) return 'Okay';
    return 'CRITICAL';
  };

  const criticalPhase = Object.entries(scores).find(([_, score]) => score < 50);

  return (
    <div className="w-full bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-sm border border-neutral-200 dark:border-neutral-800">
      <h2 className="text-xl font-semibold mb-6">Your AI Visibility: Journey View</h2>

      {/* Timeline */}
      <div className="flex items-center justify-between mb-6">
        {BUYER_JOURNEY_PHASES.map((phase, index) => {
          const config = PHASE_CONFIG[phase];
          const score = scores[phase] || 0;
          const isCritical = score < 50;

          return (
            <div key={phase} className="flex items-center flex-1">
              {/* Phase Card */}
              <button
                onClick={() => onPhaseClick?.(phase)}
                className={`
                  flex-1 p-4 rounded-lg border-2 transition-all
                  ${isCritical
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 pulse'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                  }
                `}
              >
                {/* Score Bar */}
                <div className="mb-2">
                  <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getScoreColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {/* Phase Info */}
                <div className="text-left">
                  <div className="font-semibold text-sm mb-1">{config.label}</div>
                  <div className="text-2xl font-bold mb-1">{score}%</div>
                  <div className={`text-xs font-medium ${
                    isCritical ? 'text-red-600' : score >= 70 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {getScoreLabel(score)}
                  </div>
                </div>

                {/* Critical indicator */}
                {isCritical && (
                  <div className="mt-2 flex items-center gap-1 text-red-600 text-xs font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    FIX THIS FIRST
                  </div>
                )}
              </button>

              {/* Arrow */}
              {index < BUYER_JOURNEY_PHASES.length - 1 && (
                <ChevronRight className="mx-2 text-neutral-400 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Critical alert */}
      {criticalPhase && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900 dark:text-red-100 mb-1">
                Critical Gap: {PHASE_CONFIG[criticalPhase[0] as keyof typeof PHASE_CONFIG].label} Phase ({criticalPhase[1]}%)
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                {PHASE_CONFIG[criticalPhase[0] as keyof typeof PHASE_CONFIG].description}
              </div>
              <button
                onClick={() => onPhaseClick?.(criticalPhase[0])}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
              >
                View recommendations →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 📅 EXECUTION TIMELINE

### **Week 1: Backend Core (Intelligence Engine)**
**Days 1-2:** Query generator updates
- [ ] Update BuyerJourneyCategory enum
- [ ] Update category_distribution (6-8-10-12-6)
- [ ] Update all prompts (Discovery, Research, Evaluation, Comparison, Purchase)
- [ ] Add validation tests
- [ ] Test query generation across 5 B2B/B2C industries

**Days 3-4:** Analysis pipeline updates
- [ ] Update strategic_aggregator.py CATEGORY_MAPPING
- [ ] Update job_processor.py batch logic
- [ ] Update recommendation_extractor.py
- [ ] Test 118-call architecture with 5 phases
- [ ] Verify aggregation quality

**Day 5:** Testing & validation
- [ ] Run full audit with 5-phase framework
- [ ] Verify query quality across all phases
- [ ] Check comparison phase gets 12 queries (29%)
- [ ] Validate insights quality

---

### **Week 2: Type Definitions & Frontend**
**Days 1-2:** Type definitions
- [ ] Update API Gateway QueryCategory enum
- [ ] Add BuyerJourneyPhase enum with metadata
- [ ] Update frontend BUYER_JOURNEY_PHASES constant
- [ ] Add PHASE_CONFIG with display data
- [ ] Create migration helpers

**Days 3-5:** Frontend components
- [ ] Create JourneyTimeline component (hero visualization)
- [ ] Update CategoryInsightsGrid for 5 phases
- [ ] Update BuyerJourneyInsightsView
- [ ] Update all phase detail views
- [ ] Add comparison phase highlighting

---

### **Week 3: Database & Documentation**
**Days 1-2:** Database migration
- [ ] Write migration script (012_migrate_to_5_phase_framework.sql)
- [ ] Test migration on staging database
- [ ] Verify data integrity
- [ ] Run production migration
- [ ] Verify all historical data migrated

**Days 3-5:** Documentation & launch prep
- [ ] Update QUERY_GENERATION_ARCHITECTURE.md
- [ ] Update customer-facing documentation
- [ ] Create migration communication for existing customers
- [ ] Prepare launch messaging
- [ ] Final testing across all systems

---

## ✅ VALIDATION CHECKLIST

### **Technical Validation**
- [ ] Query generator produces 42 queries (6+8+10+12+6)
- [ ] Comparison phase gets exactly 12 queries (29%)
- [ ] All prompts updated to new phase names
- [ ] Strategic aggregator uses 5-phase mapping
- [ ] Job processor batches by 5 phases
- [ ] Frontend displays 5-phase timeline
- [ ] Database migration complete and verified
- [ ] No broken references to old category names
- [ ] Backward compatibility working (legacy API routes)

### **Quality Validation**
- [ ] Comparison queries are high-quality head-to-head comparisons
- [ ] Discovery queries are problem-focused (not brand-focused)
- [ ] Evaluation queries are brand-specific
- [ ] Research queries cover category landscape
- [ ] Purchase queries have clear transactional intent
- [ ] No query overlaps between phases (MECE maintained)
- [ ] Insights quality unchanged or improved
- [ ] Recommendation actionability maintained

### **Business Validation**
- [ ] Customer messaging clearer with new phase names
- [ ] Dashboard more intuitive to navigate
- [ ] Critical phase (Comparison) highlighted effectively
- [ ] Action items mapped to correct phases
- [ ] Competitive intelligence deeper in Comparison phase
- [ ] Phase explanations clear for non-technical users

---

## 🚀 GO-TO-MARKET READINESS

### **Customer Communication**
```
Subject: Product Update: Enhanced 5-Phase AI Visibility Framework

Hi [Customer],

We've significantly enhanced our AI visibility intelligence with a new 5-phase framework:

✅ DISCOVERY → Research emerging problems
✅ RESEARCH → Explore solution landscape
✅ EVALUATION → Investigate your brand
✅ COMPARISON → Head-to-head vs competitors (ENHANCED - 50% more coverage)
✅ PURCHASE → Conversion intent

What's Changed:
• 29% of queries now focused on Comparison phase (where deals are won/lost)
• Clearer phase names (Discovery vs "problem_unaware")
• More focused execution (42 strategic queries vs 48 scattered)
• Deeper competitive intelligence

Your dashboard has been automatically upgraded. Log in to see your updated 5-phase journey view.

Questions? Reply to this email or book a walkthrough: [calendar link]

Best,
Sawai
```

### **Sales Collateral Updates**
- [ ] Update demo script to showcase 5-phase framework
- [ ] Create comparison highlighting in sales presentation
- [ ] Update pricing deck with 5-phase positioning
- [ ] Refresh case studies with new terminology
- [ ] Update website copy to reflect 5 phases

### **Marketing Assets**
- [ ] Blog post: "Why We Rebuilt Our Framework Around the Comparison Phase"
- [ ] LinkedIn series: Deep dive into each phase
- [ ] Video walkthrough: New 5-phase dashboard
- [ ] Industry report: "Where B2B Deals Are Won: The Comparison Phase Study"

---

## 🎯 SUCCESS METRICS

### **Technical Success**
- Migration completes without data loss
- All existing audits re-mapped to 5 phases
- Query generation quality maintained or improved
- System performance unchanged or better
- Zero customer-facing errors

### **Product Success**
- Dashboard more intuitive (measure: time to insight)
- Critical phase identification clearer (measure: user comprehension)
- Action items more focused (measure: completion rate)
- Comparison phase insights more valuable (measure: customer feedback)

### **Business Success**
- Existing customers understand and embrace change
- New customers find framework more intuitive
- Sales cycle shortens (clearer value prop)
- Win rate improves (better competitive positioning)
- NPS maintains or improves

---

## 📊 RISK MITIGATION

**Risk:** Customers confused by phase name changes
**Mitigation:** Clear communication, backward compatibility views, migration guide

**Risk:** Historical data comparison breaks
**Mitigation:** Legacy mapping view, maintain both schemas during transition

**Risk:** Query quality degrades during migration
**Mitigation:** Extensive testing, gradual rollout, A/B comparison with old queries

**Risk:** Frontend bugs from component updates
**Mitigation:** Comprehensive testing, staged deployment, quick rollback plan

---

## 🏁 LAUNCH CRITERIA

**All systems green when:**
- ✅ All technical validation checks pass
- ✅ Customer communication prepared and scheduled
- ✅ Sales team trained on new framework
- ✅ Documentation updated across all channels
- ✅ Rollback plan tested and ready
- ✅ Support team briefed on changes
- ✅ Analytics tracking updated for 5 phases

**Ready to execute? Let's transform AI visibility intelligence.** 🚀
