# Comprehensive Comparison: Two Query Generation Implementations

## Implementation A: REST API Endpoint (`ai_visibility_real.py`)
**Location**: `services/intelligence-engine/src/api/ai_visibility_real.py`
**Lines**: 58-264

## Implementation B: Class-Based (`query_generator.py`)
**Location**: `services/intelligence-engine/src/core/analysis/query_generator.py`
**Lines**: 73-527

---

## DETAILED LINE-BY-LINE ANALYSIS

### 1. **Architecture & Design Pattern**

#### Implementation A (REST API):
```python
@router.post("/generate-queries")
async def generate_queries(request: GenerateQueriesRequest, background_tasks: BackgroundTasks):
```
**Strengths**:
- ✅ Direct HTTP endpoint - easy to call from any service
- ✅ Request/Response model clearly defined with Pydantic
- ✅ Immediate database persistence
- ✅ Automatic job queueing built-in
- ✅ Synchronous OpenAI client (simpler error handling)

**Weaknesses**:
- ❌ Tightly coupled to FastAPI
- ❌ Single-phase generation (no batching)
- ❌ No async optimization
- ❌ Basic error handling

#### Implementation B (Class):
```python
class IntelligentQueryGenerator:
    async def generate_queries(self, context: QueryContext, target_count: int = 50, diversity_threshold: float = 0.7):
```
**Strengths**:
- ✅ Async/await throughout - better performance
- ✅ Multi-phase generation (strategy → batches → enhance → optimize → rank)
- ✅ Highly reusable - can be called from anywhere
- ✅ Sophisticated caching and optimization
- ✅ Rich data structures (GeneratedQuery, QueryContext)
- ✅ Intent-based distribution algorithm

**Weaknesses**:
- ❌ No direct database integration
- ❌ No HTTP endpoint
- ❌ More complex to use
- ❌ Requires building QueryContext

---

### 2. **Query Categories & Intent Mapping**

#### Implementation A:
```python
1. PROBLEM_UNAWARE (8 queries): Users experiencing problems but don't know solutions exist
2. SOLUTION_SEEKING (8 queries): Users actively looking for solutions
3. BRAND_SPECIFIC (8 queries): Users specifically searching for brand
4. COMPARISON (8 queries): Users comparing solutions
5. PURCHASE_INTENT (8 queries): Users ready to buy
6. USE_CASE (8 queries): Users looking for specific applications
```
**Analysis**:
- ✅ **Simple & Clear**: 6 categories, 8 queries each = 48 total
- ✅ **Buyer Journey Focused**: Maps to customer awareness stages
- ✅ **Easy to Understand**: Clear category names
- ❌ **Fixed Distribution**: No weighting or prioritization
- ❌ **Missing Local Intent**: No geographic queries

#### Implementation B:
```python
class QueryIntent(Enum):
    NAVIGATIONAL = "navigational"
    INFORMATIONAL = "informational"  
    TRANSACTIONAL = "transactional"
    COMMERCIAL_INVESTIGATION = "commercial"
    LOCAL = "local"
    PROBLEM_SOLVING = "problem_solving"
    COMPARATIVE = "comparative"
    REVIEW_SEEKING = "review"
    
self.intent_weights = {
    QueryIntent.COMMERCIAL_INVESTIGATION: 0.25,  # 25%
    QueryIntent.COMPARATIVE: 0.20,               # 20%
    QueryIntent.INFORMATIONAL: 0.15,             # 15%
    QueryIntent.PROBLEM_SOLVING: 0.15,           # 15%
    QueryIntent.TRANSACTIONAL: 0.10,             # 10%
    QueryIntent.REVIEW_SEEKING: 0.10,            # 10%
    QueryIntent.NAVIGATIONAL: 0.03,              # 3%
    QueryIntent.LOCAL: 0.02                      # 2%
}
```
**Analysis**:
- ✅ **Google-Based Taxonomy**: Follows search quality guidelines
- ✅ **Weighted Distribution**: Prioritizes high-value intents
- ✅ **Includes Local**: Geographic queries included
- ✅ **8 Intent Types**: More comprehensive coverage
- ❌ **More Complex**: Requires understanding search theory
- ❌ **No Explicit Buyer Journey**: Doesn't map to awareness/consideration/decision

**🔥 WINNER**: **Hybrid Approach Needed** - Use Implementation A's buyer-journey categories but map them to Implementation B's intent taxonomy with weights.

---

### 3. **Prompt Engineering**

#### Implementation A:
```python
prompt = f"""
You are an AI visibility expert. Generate exactly 48 search queries...

Requirements:
- Make queries realistic and natural
- Include long-tail keywords
- Vary query length (2-8 words)
- Include questions, statements, and keyword combinations
- Be specific to the {industry} industry
- Consider voice search patterns
- Include "near me" and local variations where relevant

Return as JSON array with exactly 48 objects, each containing:
{
    "query": "the search query",
    "category": "category_name",
    "intent": "informational|navigational|commercial|transactional",
    "priority": 1-10
}
"""
```
**Analysis**:
- ✅ **Comprehensive Requirements**: Voice search, local, long-tail
- ✅ **Clear JSON Structure**: Simple output format
- ✅ **Single-shot Generation**: All 48 queries in one call
- ✅ **Priority Scoring**: 1-10 scale included
- ❌ **No Context Depth**: Limited company information used
- ❌ **No Examples**: Doesn't show query examples

#### Implementation B:
```python
# Multi-phase approach:
# Phase 1: Strategy Generation
strategy_prompt = """
As an expert in search behavior and AI visibility analysis, create a comprehensive
query generation strategy...

Generate a JSON strategy including:
1. Key search themes users would explore
2. Intent distribution (what % of each intent type)
3. Competitive angles to explore
4. Industry-specific terminology to include
5. Long-tail query patterns
6. Question-based queries
7. Comparison patterns
8. Problem/solution query pairs
9. Feature-specific queries
10. Use case scenarios
"""

# Phase 2: Per-Intent Generation (parallel batches)
intent_prompts = {
    QueryIntent.COMMERCIAL_INVESTIGATION: f"""
    Generate {count} commercial investigation queries...
    Include queries about pricing, features, comparisons, and evaluation criteria.
    Consider competitors: {competitors}
    """,
    # ... separate prompts for each intent
}
```
**Analysis**:
- ✅ **Strategic Planning**: Creates generation strategy first
- ✅ **Intent-Specific Prompts**: Tailored prompts per intent type
- ✅ **Parallel Generation**: Batches run concurrently
- ✅ **Deep Context**: Uses full QueryContext
- ✅ **Competitor-Aware**: Explicitly includes competitor mentions
- ❌ **Multiple API Calls**: More expensive (8+ calls vs 1)
- ❌ **Complex Orchestration**: Harder to debug

**🔥 WINNER**: **Implementation B** - Multi-phase approach is more sophisticated, but we can optimize API call count.

---

### 4. **Data Structures & Metadata**

#### Implementation A:
```python
{
    "query": "the search query",
    "category": "category_name",
    "intent": "informational|navigational|commercial|transactional",
    "priority": 1-10
}
```
**Analysis**:
- ✅ **Simple**: Easy to understand and use
- ✅ **Flat Structure**: Direct database mapping
- ❌ **Limited Metadata**: Missing semantic variations, SERP features, etc.
- ❌ **No Complexity Scoring**: Can't distinguish simple vs sophisticated queries

#### Implementation B:
```python
@dataclass
class GeneratedQuery:
    query_text: str
    intent: QueryIntent
    complexity_score: float  # 0-1
    competitive_relevance: float  # 0-1
    buyer_journey_stage: str  # awareness, consideration, decision
    expected_serp_features: List[str]  # featured snippet, local pack
    semantic_variations: List[str]
    priority_score: float  # 0-1
    persona_alignment: Optional[str]
    industry_specificity: float  # 0-1
    query_id: str
```
**Analysis**:
- ✅ **Rich Metadata**: 10+ attributes per query
- ✅ **Semantic Variations**: Alternative phrasings included
- ✅ **SERP Features**: Predicts search result types
- ✅ **Multi-dimensional Scoring**: Complexity, relevance, priority
- ❌ **Complex**: Requires understanding all fields
- ❌ **Database Mapping**: Needs flattening for storage

**🔥 WINNER**: **Implementation B** - Rich metadata enables advanced analysis.

---

### 5. **Diversity & Deduplication**

#### Implementation A:
```python
# Uses regex to extract JSON from response
json_match = re.search(r'\[.*\]', queries_text, re.DOTALL)
# No explicit diversity checking
```
**Analysis**:
- ❌ **No Diversity Control**: Relies on LLM to avoid duplicates
- ❌ **No Deduplication**: Could have similar queries
- ✅ **Simple**: No extra processing needed

#### Implementation B:
```python
def _optimize_query_diversity(self, queries: List[GeneratedQuery], diversity_threshold: float):
    """Ensure query diversity using semantic similarity"""
    optimized = []
    seen_patterns = set()
    
    for query in queries:
        pattern = self._get_query_pattern(query.query_text)
        if pattern not in seen_patterns:
            optimized.append(query)
            seen_patterns.add(pattern)
    return optimized
```
**Analysis**:
- ✅ **Pattern-Based Deduplication**: Removes similar queries
- ✅ **Configurable Threshold**: diversity_threshold parameter
- ✅ **Semantic Variations Tracking**: Avoids near-duplicates
- ❌ **Simple Pattern Matching**: Could use sentence embeddings

**🔥 WINNER**: **Implementation B** - Active diversity management.

---

### 6. **Priority Scoring & Ranking**

#### Implementation A:
```python
"priority": 1-10  # User provides or LLM generates
```
**Analysis**:
- ✅ **Simple**: Single priority value
- ❌ **No Algorithm**: Relies on LLM judgment
- ❌ **Not Normalized**: 1-10 scale inconsistent

#### Implementation B:
```python
def _score_and_rank_queries(self, queries, context):
    """Score and rank queries by priority"""
    
    # Multi-factor scoring
    intent_score = self.intent_weights.get(query.intent, 0.1)
    competitive_score = query.competitive_relevance * 0.3
    complexity_score = (0.5 - abs(query.complexity_score - 0.6)) * 2
    industry_score = query.industry_specificity * 0.2
    
    # Buyer journey weighting
    journey_weights = {
        'awareness': 0.2,
        'consideration': 0.4,
        'decision': 0.3,
        'retention': 0.1
    }
    journey_score = journey_weights.get(query.buyer_journey_stage, 0.2)
    
    # Calculate final priority
    query.priority_score = (
        intent_score * 0.35 +
        competitive_score * 0.25 +
        complexity_score * 0.15 +
        industry_score * 0.15 +
        journey_score * 0.10
    )
```
**Analysis**:
- ✅ **Multi-Factor Algorithm**: 5 factors considered
- ✅ **Weighted Formula**: Intent (35%), Competitive (25%), etc.
- ✅ **Buyer Journey Integration**: Prioritizes consideration/decision
- ✅ **Prefers Medium Complexity**: Not too simple, not too complex
- ✅ **Normalized 0-1**: Consistent scoring

**🔥 ABSOLUTE WINNER**: **Implementation B** - Sophisticated scoring algorithm.

---

### 7. **Database Integration**

#### Implementation A:
```python
cursor.execute(
    """INSERT INTO ai_queries 
       (report_id, company_id, query_id, query_text, category, intent, priority, created_at)
       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
)
# Also creates audit record
# Also queues job via Redis
```
**Analysis**:
- ✅ **Complete Integration**: Saves queries, creates audit, queues job
- ✅ **Atomic Operations**: All in one transaction
- ✅ **Job Processor Trigger**: Automatic next step
- ✅ **Report ID Generation**: Creates tracking IDs

#### Implementation B:
```python
# NO DATABASE INTEGRATION
# Returns List[GeneratedQuery] objects
```
**Analysis**:
- ❌ **No Persistence**: Caller must save to database
- ✅ **Separation of Concerns**: Pure query generation
- ✅ **Reusable**: Can be used without database

**🔥 WINNER**: **Implementation A** - Complete end-to-end flow.

---

### 8. **Error Handling & Resilience**

#### Implementation A:
```python
try:
    response = client.chat.completions.create(...)
    queries_json = json.loads(json_match.group())
    # Save to database
    return {"status": "success", ...}
except Exception as e:
    logger.error(f"Error generating queries: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```
**Analysis**:
- ✅ **HTTP Error Responses**: Proper status codes
- ✅ **Logging**: Errors are logged
- ❌ **No Retry Logic**: Fails immediately
- ❌ **No Fallback**: Single failure point

#### Implementation B:
```python
try:
    # Phase 1: Strategy
    strategy = await self._generate_query_strategy(context)
    # Phase 2-5: Generate, enhance, optimize, rank
    ...
except Exception as e:
    logger.error(f"Error generating enhanced queries: {e}")
    # Fallback to standard generation
    return await self.generate_queries(context, ...)
```
**Analysis**:
- ✅ **Fallback Mechanism**: Falls back to simpler generation
- ✅ **Per-Phase Error Handling**: Failures isolated
- ✅ **Async Error Handling**: Proper async exception handling
- ❌ **No HTTP Response**: Caller handles errors

**🔥 WINNER**: **Implementation B** - Better resilience with fallback.

---

## SUMMARY SCORECARD

| Feature | Implementation A (REST) | Implementation B (Class) | Winner |
|---------|-------------------------|--------------------------|--------|
| **Architecture** | Simple HTTP endpoint | Multi-phase async | B |
| **Categories** | 6 buyer-journey categories | 8 Google intent types | Hybrid |
| **Prompt Engineering** | Single comprehensive prompt | Multi-phase strategic | B |
| **Data Structures** | Simple JSON | Rich @dataclass | B |
| **Diversity** | None | Pattern-based dedup | B |
| **Priority Scoring** | Simple 1-10 | Multi-factor algorithm | B |
| **Database Integration** | Complete | None | A |
| **Error Handling** | Basic | Fallback mechanism | B |
| **Performance** | Single API call | Multiple parallel calls | Tie |
| **Ease of Use** | HTTP endpoint | Requires integration | A |
| **Reusability** | Tied to FastAPI | Highly reusable | B |

**OVERALL**: Implementation B has superior query generation logic, but Implementation A has better integration.

---

## MERGE STRATEGY RECOMMENDATION

### Option 1: **Best-of-Both Hybrid** (RECOMMENDED)
1. Keep `IntelligentQueryGenerator` class (Implementation B) as the core engine
2. Add Implementation A's 6 buyer-journey categories to Implementation B
3. Integrate Implementation B into Implementation A's REST endpoint
4. Add database persistence to Implementation B as optional
5. Use Implementation B's scoring but add Implementation A's simplicity

### Option 2: Enhance REST Endpoint Only
- Keep Implementation A
- Add Implementation B's multi-factor scoring
- Add Implementation B's diversity checking
- Keep simple structure

### Option 3: Enhance Class Only
- Keep Implementation B
- Add Implementation A's 6 categories
- Add database integration
- Create new REST endpoint wrapper

**RECOMMENDATION**: **Option 1 (Hybrid)** - Gives us the sophistication of B with the usability of A.
