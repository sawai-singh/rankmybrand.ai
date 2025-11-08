# AI Model Centralization Map
**Complete Inventory of LLM Usage Across RankMyBrand.ai**

Generated: 2025-10-30
Purpose: Centralize model selection into a single UI for all components

---

## Executive Summary

The system currently uses **4 different LLM providers** (OpenAI, Anthropic, Google AI, Perplexity) across **13 core files** with models hardcoded or configured through scattered environment variables. This document provides a comprehensive map for centralizing model selection.

### Current State
- **Total LLM-using files**: 13 files
- **Providers**: OpenAI (primary), Anthropic, Google AI, Perplexity
- **Models in use**: gpt-5-nano, gpt-5-chat-latest, gpt-4o, claude-3-opus, gemini-2.5-flash, sonar
- **Configuration**: Scattered across 3 services with 6+ environment files

### Target State
- Centralized model selection UI
- Single source of truth for model configuration
- Dynamic model switching without code changes
- Per-use-case model optimization

---

## Part 1: Intelligence Engine (Python Service)

### Service Overview
- **Port**: 8002
- **Language**: Python
- **Primary Purpose**: Core AI analysis and recommendation generation
- **LLM Calls**: ~118 calls per audit (5-phase buyer journey framework)

### Configuration Files

#### 1.1 Main Config File
**File**: `services/intelligence-engine/src/config.py` (Line 98)
```python
openai_model: str = Field(default="gpt-5-nano", env="OPENAI_MODEL")
```

**Environment Variables** (from `services/intelligence-engine/.env`):
```bash
# Line 48-52
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o          # Currently gpt-4o (was gpt-5-nano)
OPENAI_TIMEOUT=30
OPENAI_MAX_CALLS_PER_MINUTE=60
OPENAI_MAX_CALLS_PER_CUSTOMER=10

# Line 57-61
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_AI_API_KEY=AIzaSy...
PERPLEXITY_API_KEY=pplx-...
COHERE_API_KEY=
```

### LLM-Using Files

#### 1.2 Query Generator
**File**: `services/intelligence-engine/src/core/analysis/query_generator.py`

**Lines**: 103-109
```python
def __init__(self, openai_api_key: str, model: str = "gpt-5-nano"):
    """Initialize with GPT-5 or fallback to GPT-4"""
    self.client = AsyncOpenAI(api_key=openai_api_key, base_url="...")
    self.model = model
```

**LLM Calls**: Lines 600, 887, 1372, 1460, 1510
- Generates 42 queries across 5 buyer journey phases
- Model: Passed from `job_processor.py` (line 143-145)

**Environment**: Uses `settings.openai_model` from config.py

---

#### 1.3 Response Analyzer
**File**: `services/intelligence-engine/src/core/analysis/response_analyzer.py`

**Lines**: 116-131
```python
def __init__(
    self,
    openai_api_key: str,
    model: str = "gpt-5-nano",
    mode: AnalysisMode = AnalysisMode.FULL
):
    self.model = model
    self.mode = mode
```

**LLM Calls**: Line 295
- Analyzes individual AI responses for brand visibility
- Model: Passed from `job_processor.py` (line 156-160)

**Environment**: Uses `gpt-5-nano` hardcoded or from initialization

---

#### 1.4 Recommendation Extractor
**File**: `services/intelligence-engine/src/core/analysis/recommendation_extractor.py`

**Lines**: 80-92, 558-569
```python
# IntelligentRecommendationExtractor
def __init__(self, openai_api_key: Optional[str] = None, model: str = "gpt-5-nano"):
    api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
    self.client = AsyncOpenAI(api_key=api_key)
    self.model = model

# WorldClassRecommendationAggregator
def __init__(self, openai_api_key: Optional[str] = None, model: str = "gpt-5-nano"):
    api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
    self.client = AsyncOpenAI(api_key=api_key)
    self.model = model
```

**LLM Calls**:
- Lines 206-221: Extract recommendations (Call #1)
- Lines 386-391: Extract competitive gaps (Call #2)
- Lines 439-444: Extract content opportunities (Call #3)
- Lines 489-494: Generate executive summary (Call #4)
- Lines 817-831: Per-batch insights (batched calls)

**Usage**:
- Buyer-journey batching: 36 LLM calls (6 categories × 2 batches × 3 types)
- Per-response metrics: Variable calls

**Environment**: Uses `gpt-5-nano` from initialization in `job_processor.py` (line 163-166)

---

#### 1.5 Strategic Aggregator
**File**: `services/intelligence-engine/src/core/analysis/strategic_aggregator.py`

**Lines**: 152-160
```python
def __init__(
    self,
    openai_api_key: str,
    db_config: Dict[str, Any],
    model: str = "gpt-5-nano"
):
    self.client = AsyncOpenAI(api_key=openai_api_key)
    self.model = model
```

**LLM Calls** (118-call architecture):
- Line 494-498: Determine persona context (Call #1)
- Line 584-589: Analyze unique situation (Call #2)
- Line 694-699: Generate personalized recommendations (Call #3)
- Line 807-812: Create executive package (Call #4)

**Usage**: Strategic intelligence layer - 4 LLM calls per audit

**Environment**: Uses `gpt-5-nano` from initialization in `job_processor.py` (line 169-172)

---

#### 1.6 World-Class Recommendation Aggregator
**File**: `services/intelligence-engine/src/core/analysis/world_class_recommendation_aggregator.py`

**Lines**: 152-160
```python
def __init__(
    self,
    openai_api_key: str,
    db_config: Dict[str, Any],
    model: str = "gpt-5-nano"
):
    self.client = AsyncOpenAI(api_key=openai_api_key)
    self.model = model
```

**LLM Calls**: Similar to strategic_aggregator.py (different implementation)
- 4 calls for hyper-personalized recommendations
- Uses company context for personalization

**Environment**: Uses `gpt-5-nano` from initialization

---

#### 1.7 LLM Analysis Suite
**File**: `services/intelligence-engine/src/core/analysis/llm_analysis_suite.py`

**Status**: Found in grep results (uses OpenAI)
**Purpose**: Additional analysis capabilities
**Environment**: Likely uses `openai_api_key` from config

---

#### 1.8 LLM Orchestrator
**File**: `services/intelligence-engine/src/core/analysis/llm_orchestrator.py`

**Purpose**: Coordinates multiple LLM providers
**Providers**: OpenAI, Anthropic, Google AI, Perplexity

**Status**: Multi-provider orchestration layer
**Environment**: Uses all API keys from config

---

#### 1.9 LLM Provider Manager
**File**: `services/intelligence-engine/src/core/llm_provider_manager.py`

**Lines**: 97-131
```python
# OpenAI Configuration
LLMProvider.OPENAI: ProviderConfig(
    api_key=self.openai_api_key,
    model="gpt-4o",  # Using GPT-4o
    priority=1,
    weight=1.2
)

# Anthropic Configuration
LLMProvider.ANTHROPIC: ProviderConfig(
    api_key=self.anthropic_api_key,
    model="claude-3-opus-20240229",
    priority=2,
    weight=1.2
)

# Google AI Configuration
LLMProvider.GOOGLE: ProviderConfig(
    api_key=self.google_api_key,
    model="gemini-2.5-flash",  # Gemini 2.5 Flash
    priority=3,
    weight=1.0
)

# Perplexity Configuration
LLMProvider.PERPLEXITY: ProviderConfig(
    api_key=self.perplexity_api_key,
    model="sonar",  # Using sonar as default model
    priority=4,
    weight=1.1
)
```

**Purpose**: Manages all LLM providers with fallback logic
**Models**: HARDCODED in code (Lines 97, 107, 117, 128)
**Priority**: Multi-provider with weighted selection

---

#### 1.10 Job Processor (Orchestrator)
**File**: `services/intelligence-engine/src/core/services/job_processor.py`

**Lines**: 141-172
```python
# Initialize service components with correct models
self.query_generator = IntelligentQueryGenerator(
    self.config.openai_api_key,
    model=settings.openai_model  # Uses gpt-5-nano from config
)

self.llm_orchestrator = LLMOrchestrator(
    openai_api_key=self.config.openai_api_key,
    anthropic_api_key=self.config.anthropic_api_key,
    google_api_key=self.config.google_ai_api_key,
    perplexity_api_key=self.config.perplexity_api_key
)

self.response_analyzer = UnifiedResponseAnalyzer(
    self.config.openai_api_key,
    model="gpt-5-nano",  # HARDCODED
    mode=AnalysisMode.FULL
)

self.recommendation_aggregator = WorldClassRecommendationAggregator(
    self.config.openai_api_key,
    model="gpt-5-nano"  # HARDCODED
)

self.strategic_aggregator = StrategicIntelligenceAggregator(
    self.config.openai_api_key,
    model="gpt-5-nano"  # HARDCODED
)
```

**Purpose**: Main orchestrator that initializes all LLM services
**Issue**: Mix of config-based and hardcoded models

**Environment**:
- `settings.openai_model` from config.py (Line 143)
- Hardcoded `gpt-5-nano` in lines 158, 164, 170

---

#### 1.11 Health Monitoring
**File**: `services/intelligence-engine/src/monitoring/health.py`

**Purpose**: Health checks for LLM providers
**Status**: Uses OpenAI for health verification
**Environment**: Uses `openai_api_key` from config

---

## Part 2: API Gateway (Node.js Service)

### Service Overview
- **Port**: 4000
- **Language**: TypeScript/Node.js
- **Primary Purpose**: Request routing and company enrichment
- **LLM Calls**: Company data enrichment (~4 calls per company)

### Configuration Files

#### 2.1 API Gateway Config
**File**: `api-gateway/.env`
```bash
# Line 43-44
OPENAI_API_KEY=sk-proj-...
# No OPENAI_MODEL configured - uses hardcoded values
```

### LLM-Using Files

#### 2.2 LLM Enrichment Service
**File**: `api-gateway/src/services/llm-enrichment.service.ts`

**Lines**: 6, 24-28, 281, 578, 620, 712
```typescript
import OpenAI from 'openai';

// Lazy initialization
private getOpenAI(): OpenAI {
  if (!this.openai) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return this.openai;
}

// LLM Calls with HARDCODED models:
// Line 281: model: 'gpt-5-chat-latest'  (Company enrichment)
// Line 578: model: 'gpt-5-chat-latest'  (Description generation)
// Line 620: model: 'gpt-5-chat-latest'  (Competitor finding)
// Line 712: model: 'gpt-5-chat-latest'  (Tech stack analysis)
```

**Purpose**: Enrich company data using GPT-5
**Models**: HARDCODED as `gpt-5-chat-latest` (4 occurrences)
**Environment**: Only API key from `.env`, no model configuration

---

## Part 3: Frontend Services

### Dashboard Service
- **Port**: 3003
- **No direct LLM usage** - calls API Gateway and Intelligence Engine

### Main Frontend
- **Port**: 3000
- **No direct LLM usage** - calls API Gateway

---

## Part 4: Model Usage Summary

### Current Models in Production

| Provider | Model | Where Used | Hardcoded/Config | Count |
|----------|-------|------------|------------------|-------|
| OpenAI | `gpt-5-nano` | Intelligence Engine (default) | Config + Hardcoded | 6 files |
| OpenAI | `gpt-4o` | Intelligence Engine (env override) | Config (.env) | 1 config |
| OpenAI | `gpt-5-chat-latest` | API Gateway | Hardcoded | 4 locations |
| OpenAI | `gpt-4o` | LLM Provider Manager | Hardcoded | 1 location |
| Anthropic | `claude-3-opus-20240229` | LLM Provider Manager | Hardcoded | 1 location |
| Google AI | `gemini-2.5-flash` | LLM Provider Manager | Hardcoded | 1 location |
| Perplexity | `sonar` | LLM Provider Manager | Hardcoded | 1 location |

### Configuration Pattern Analysis

**Pattern 1: Environment Variable (Best)**
```python
# config.py
openai_model: str = Field(default="gpt-5-nano", env="OPENAI_MODEL")

# .env
OPENAI_MODEL=gpt-4o
```
**Used in**: 1 file (config.py)
**Pros**: Centralized, easy to change
**Cons**: Only works for Intelligence Engine

**Pattern 2: Initialization Parameter**
```python
def __init__(self, openai_api_key: str, model: str = "gpt-5-nano"):
    self.model = model
```
**Used in**: 6 files
**Pros**: Flexible, can be overridden
**Cons**: Caller must know correct model

**Pattern 3: Hardcoded in Initialization (Worst)**
```python
self.response_analyzer = UnifiedResponseAnalyzer(
    self.config.openai_api_key,
    model="gpt-5-nano",  # HARDCODED
    mode=AnalysisMode.FULL
)
```
**Used in**: 4 locations in job_processor.py
**Pros**: None
**Cons**: Requires code change to modify

**Pattern 4: Hardcoded in Call Site (Worst)**
```typescript
model: 'gpt-5-chat-latest'  // HARDCODED
```
**Used in**: 4 locations in llm-enrichment.service.ts
**Pros**: None
**Cons**: Requires code change to modify

---

## Part 5: Environment File Inventory

### Intelligence Engine
1. **Primary**: `services/intelligence-engine/.env` (Lines 48-61)
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-4o` ✅ (configurable)
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_AI_API_KEY`
   - `PERPLEXITY_API_KEY`
   - `COHERE_API_KEY`

2. **Backup**: `services/intelligence-engine/.env.prod.backup`
3. **Consolidated**: `services/intelligence-engine/.env.consolidated`

### API Gateway
1. **Primary**: `api-gateway/.env` (Line 43-44)
   - `OPENAI_API_KEY`
   - ❌ No model configuration

2. **Backup**: `api-gateway/.env.prod.backup`

### Root Level
1. **Primary**: `.env` (shared configuration)
2. **Production**: `.env.production`
3. **Example**: `.env.example`

---

## Part 6: Centralization Strategy

### Recommended Architecture

```
┌─────────────────────────────────────────┐
│   Admin UI (Centralized Model Config)  │
│   - Model selection per use case       │
│   - Provider selection                  │
│   - Fallback configuration             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   Database Table: llm_configurations    │
│   - use_case (query_gen, analysis, etc)│
│   - provider (openai, anthropic, etc)   │
│   - model (gpt-4o, claude-3, etc)       │
│   - priority, weight, enabled           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   Config Service (API Endpoint)         │
│   GET /api/admin/llm-config             │
│   POST /api/admin/llm-config/:use_case  │
└─────────────────┬───────────────────────┘
                  │
          ┌───────┴───────┐
          ▼               ▼
┌──────────────┐  ┌──────────────┐
│ Intelligence │  │ API Gateway  │
│   Engine     │  │              │
│ - Read config│  │ - Read config│
│   on startup │  │   on request │
└──────────────┘  └──────────────┘
```

### Database Schema

```sql
CREATE TABLE llm_configurations (
    id SERIAL PRIMARY KEY,
    use_case VARCHAR(50) NOT NULL,  -- 'query_generation', 'response_analysis', etc
    provider VARCHAR(20) NOT NULL,   -- 'openai', 'anthropic', 'google', 'perplexity'
    model VARCHAR(50) NOT NULL,      -- 'gpt-4o', 'claude-3-opus', etc
    priority INTEGER DEFAULT 1,      -- 1 = highest priority
    weight DECIMAL(3,2) DEFAULT 1.0, -- Load balancing weight
    enabled BOOLEAN DEFAULT TRUE,
    max_tokens INTEGER,
    temperature DECIMAL(3,2),
    timeout_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(use_case, provider)
);
```

### Use Case Mapping

| Use Case ID | Description | Current Model | Files Affected |
|-------------|-------------|---------------|----------------|
| `query_generation` | Generate 42 buyer journey queries | gpt-5-nano | query_generator.py |
| `response_analysis` | Analyze AI responses per-response | gpt-5-nano | response_analyzer.py |
| `recommendation_extraction` | Extract recommendations per batch | gpt-5-nano | recommendation_extractor.py |
| `strategic_aggregation` | Generate personalized recommendations | gpt-5-nano | strategic_aggregator.py |
| `company_enrichment` | Enrich company data | gpt-5-chat-latest | llm-enrichment.service.ts |
| `provider_orchestration` | Multi-provider fallback | Multiple | llm_provider_manager.py |

---

## Part 7: Implementation Checklist

### Phase 1: Infrastructure (Database & API)
- [ ] Create `llm_configurations` table
- [ ] Seed default configurations
- [ ] Create API endpoints for CRUD operations
- [ ] Add authentication/authorization

### Phase 2: Intelligence Engine Integration
- [ ] Update `config.py` to read from database
- [ ] Modify `job_processor.py` to use dynamic models
- [ ] Update all `__init__` methods to accept config
- [ ] Remove hardcoded model strings (6 locations)
- [ ] Add fallback to env vars for backward compatibility

### Phase 3: API Gateway Integration
- [ ] Add config service client
- [ ] Update `llm-enrichment.service.ts` (4 locations)
- [ ] Replace hardcoded `gpt-5-chat-latest` with config
- [ ] Add caching for config lookups

### Phase 4: Admin UI
- [ ] Create model configuration page
- [ ] Add dropdown for model selection per use case
- [ ] Add enable/disable toggles
- [ ] Add priority and weight configuration
- [ ] Add validation and testing tools

### Phase 5: Monitoring & Analytics
- [ ] Track model usage per use case
- [ ] Monitor costs per model
- [ ] Alert on failures
- [ ] A/B testing framework

---

## Part 8: Files Requiring Changes

### Critical Changes (Hardcoded Models)

| Priority | File | Lines | Change Required |
|----------|------|-------|-----------------|
| 🔴 HIGH | `job_processor.py` | 158, 164, 170 | Replace `gpt-5-nano` with config |
| 🔴 HIGH | `llm-enrichment.service.ts` | 281, 578, 620, 712 | Replace `gpt-5-chat-latest` with config |
| 🔴 HIGH | `llm_provider_manager.py` | 97, 107, 117, 128 | Replace hardcoded models with config |
| 🟡 MEDIUM | `recommendation_extractor.py` | 80, 558 | Add config parameter |
| 🟡 MEDIUM | `strategic_aggregator.py` | 152 | Add config parameter |
| 🟡 MEDIUM | `response_analyzer.py` | 116 | Add config parameter |
| 🟡 MEDIUM | `query_generator.py` | 103 | Already uses parameter ✅ |
| 🟢 LOW | `config.py` | 98 | Already configurable ✅ |

### Total Changes Required
- **Python Files**: 7 files, ~15 locations
- **TypeScript Files**: 1 file, 4 locations
- **New Files**: Database migration, API endpoints, Admin UI

---

## Part 9: Backward Compatibility Plan

### Option 1: Environment Variable Fallback
```python
model = get_config('query_generation', 'model') or os.getenv('OPENAI_MODEL') or 'gpt-5-nano'
```

### Option 2: Feature Flag
```python
if settings.use_centralized_model_config:
    model = get_model_from_database('query_generation')
else:
    model = settings.openai_model
```

### Option 3: Gradual Migration
1. Phase 1: Add config service, but keep env vars as default
2. Phase 2: Migrate Intelligence Engine to use config service
3. Phase 3: Migrate API Gateway
4. Phase 4: Deprecate env vars

---

## Conclusion

This comprehensive map identifies **13 files** using LLM APIs with **19+ hardcoded model references** that need centralization. The recommended approach uses a database-backed configuration service with an admin UI, allowing dynamic model switching without code deployments.

**Estimated Effort**: 2-3 weeks
- Week 1: Infrastructure (database + API)
- Week 2: Service integration (Intelligence Engine + API Gateway)
- Week 3: Admin UI + testing + monitoring

**Benefits**:
- ✅ Zero-downtime model switching
- ✅ Per-use-case model optimization
- ✅ Cost optimization through model selection
- ✅ A/B testing capability
- ✅ Multi-provider fallback management
- ✅ Centralized cost tracking

---

**Next Steps**: Review this document and approve the centralization architecture before beginning implementation.
