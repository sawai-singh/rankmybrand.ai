# GEO & SOV Calculator Integration Plan

## Executive Summary
Currently, GEO and SOV calculators exist but are **completely isolated** from the main AI visibility audit workflow. This plan integrates them properly to calculate meaningful metrics from the ~192 LLM responses.

## Current Problem
```
Current Flow (BROKEN):
Query Generator → LLM Orchestrator → Response Analyzer → Scores
                                                           ↓
                                                    (GEO & SOV unused!)

Isolated:
/api/v1/geo/analyze → GEO Calculator (separate endpoint, not integrated)
SOV Calculator → Initialized but NEVER called
```

## Proposed Solution
```
Integrated Flow (FIXED):
Query Generator → LLM Orchestrator → Response Analyzer → Enhanced Scores
                                            ↓                    ↓
                                    [Per Response]        [Aggregated]
                                    - GEO Score           - Overall GEO
                                    - SOV Score           - Overall SOV
                                    - Visibility          - Visibility
                                    - Sentiment           - Sentiment
```

## Implementation Plan

### Phase 1: Data Structure Updates

#### 1.1 Update ResponseAnalysis Dataclass
```python
@dataclass
class ResponseAnalysis:
    # Existing fields...
    analysis_id: str
    query: str
    response_text: str
    provider: str
    brand_analysis: BrandAnalysis
    competitors_analysis: List[CompetitorAnalysis]
    
    # NEW FIELDS
    geo_score: float  # 0-100 GEO score for this response
    sov_score: float  # 0-100 Share of Voice for this response
    
    # Existing fields...
    featured_snippet_potential: float
    voice_search_optimized: bool
    seo_factors: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
```

#### 1.2 Database Schema Updates
```sql
-- Add to audit_responses table
ALTER TABLE audit_responses ADD COLUMN geo_score FLOAT;
ALTER TABLE audit_responses ADD COLUMN sov_score FLOAT;

-- Add to audit_scores table  
ALTER TABLE audit_scores ADD COLUMN overall_geo_score FLOAT;
ALTER TABLE audit_scores ADD COLUMN overall_sov_score FLOAT;
```

### Phase 2: Calculator Integration

#### 2.1 GEO Score Calculation Per Response
The GEO calculator needs:
- **Citation frequency**: How often the brand is mentioned
- **Sentiment score**: Positive/neutral/negative sentiment
- **Relevance score**: How relevant the response is to the query
- **Authority score**: Provider credibility (OpenAI=high, etc.)
- **Position score**: Where brand appears in response

```python
async def _calculate_response_geo_score(
    self,
    analysis: ResponseAnalysis,
    query: str,
    brand_name: str
) -> float:
    """Calculate GEO score for a single response"""
    
    # Prepare GEO inputs from analysis
    geo_data = {
        'citation_frequency': analysis.brand_analysis.mention_count,
        'sentiment_score': self._sentiment_to_score(
            analysis.brand_analysis.sentiment
        ),
        'relevance_score': self._calculate_relevance(
            analysis.response_text, 
            query
        ),
        'authority_score': self._provider_authority(
            analysis.provider
        ),
        'position_score': 100 - analysis.brand_analysis.first_position_percentage
    }
    
    # Calculate GEO score
    result = self.geo_calculator.calculate(
        domain=brand_name,
        llm_responses=[geo_data]
    )
    
    return result['overall_score']
```

#### 2.2 SOV Score Calculation Per Response
The SOV calculator needs:
- **Brand mentions**: Count and sentiment
- **Competitor mentions**: Count for each competitor
- **Total mentions**: All brand/competitor mentions

```python
async def _calculate_response_sov_score(
    self,
    analysis: ResponseAnalysis,
    brand_name: str
) -> float:
    """Calculate Share of Voice for a single response"""
    
    # Count mentions
    brand_mentions = analysis.brand_analysis.mention_count
    
    competitor_mentions = sum(
        comp.mention_count 
        for comp in analysis.competitors_analysis
    )
    
    total_mentions = brand_mentions + competitor_mentions
    
    if total_mentions == 0:
        return 0.0
    
    # Calculate SOV percentage
    sov = (brand_mentions / total_mentions) * 100
    
    # Weight by sentiment
    if analysis.brand_analysis.sentiment == Sentiment.POSITIVE:
        sov *= 1.2  # Boost for positive sentiment
    elif analysis.brand_analysis.sentiment == Sentiment.NEGATIVE:
        sov *= 0.8  # Reduce for negative sentiment
    
    return min(sov, 100.0)  # Cap at 100%
```

### Phase 3: Integration Points

#### 3.1 Update analyze_response Method
```python
async def analyze_response(
    self,
    response_text: str,
    query: str,
    brand_name: str,
    competitors: Optional[List[str]] = None,
    provider: str = "unknown",
    # ... other params
) -> ResponseAnalysis:
    
    # Existing analysis logic...
    analysis = await self._full_analysis(...)
    
    # NEW: Calculate GEO score
    analysis.geo_score = await self._calculate_response_geo_score(
        analysis, query, brand_name
    )
    
    # NEW: Calculate SOV score
    analysis.sov_score = await self._calculate_response_sov_score(
        analysis, brand_name
    )
    
    return analysis
```

#### 3.2 Update Aggregate Metrics Calculation
```python
def calculate_aggregate_metrics(
    self, 
    analyses: List[ResponseAnalysis]
) -> Dict[str, Any]:
    
    # Existing metrics...
    metrics = {
        'brand_mention_rate': ...,
        'positive_sentiment_rate': ...,
    }
    
    # NEW: Aggregate GEO score
    metrics['overall_geo_score'] = sum(
        a.geo_score for a in analyses
    ) / len(analyses)
    
    # NEW: Aggregate SOV score
    metrics['overall_sov_score'] = sum(
        a.sov_score for a in analyses
    ) / len(analyses)
    
    # NEW: Provider-specific GEO scores
    metrics['geo_by_provider'] = self._group_scores_by_provider(
        analyses, 'geo_score'
    )
    
    # NEW: Provider-specific SOV scores  
    metrics['sov_by_provider'] = self._group_scores_by_provider(
        analyses, 'sov_score'
    )
    
    return metrics
```

### Phase 4: Job Processor Updates

#### 4.1 Update _calculate_scores Method
```python
async def _calculate_scores(
    self,
    audit_id: str,
    analyses: List[ResponseAnalysis]
) -> Dict[str, float]:
    
    # Existing scores
    scores = {
        'visibility': ...,
        'sentiment': ...,
        'recommendation': ...
    }
    
    # NEW: Calculate aggregate GEO and SOV
    scores['geo_score'] = sum(a.geo_score for a in analyses) / len(analyses)
    scores['sov_score'] = sum(a.sov_score for a in analyses) / len(analyses)
    
    # NEW: Enhanced overall score including GEO and SOV
    scores['overall_score'] = (
        scores['visibility'] * 0.25 +
        scores['sentiment'] * 0.20 +
        scores['recommendation'] * 0.20 +
        scores['geo_score'] * 0.20 +      # NEW
        scores['sov_score'] * 0.15         # NEW
    )
    
    return scores
```

#### 4.2 Update Database Storage
```python
# In _analyze_responses method
cursor.execute("""
    UPDATE audit_responses
    SET 
        # Existing fields...
        brand_mentioned = %s,
        sentiment = %s,
        
        # NEW fields
        geo_score = %s,
        sov_score = %s,
        
        # ... rest
    WHERE id = %s
""", (
    # ... existing values
    analysis.geo_score,  # NEW
    analysis.sov_score,  # NEW
    # ...
))
```

### Phase 5: WebSocket & UI Updates

#### 5.1 Include Scores in Real-time Updates
```python
await self.ws_manager.broadcast_to_audit(
    audit_id,
    EventType.LLM_RESPONSE_RECEIVED,
    {
        'query': response_data['query_text'],
        'provider': response_data['provider'],
        'brand_mentioned': analysis.brand_analysis.mentioned,
        'sentiment': analysis.brand_analysis.sentiment.value,
        'geo_score': analysis.geo_score,  # NEW
        'sov_score': analysis.sov_score   # NEW
    }
)
```

#### 5.2 Final Audit Results
```python
await self.ws_manager.broadcast_to_audit(
    audit_id,
    EventType.AUDIT_COMPLETED,
    {
        'overall_score': scores['overall_score'],
        'visibility': scores['visibility'],
        'sentiment': scores['sentiment'],
        'geo_score': scores['geo_score'],      # NEW
        'sov_score': scores['sov_score'],      # NEW
        'insights': insights[:3]
    }
)
```

## Benefits

### 1. **Complete Integration**
- GEO and SOV calculators finally used in production
- Every response gets scored, not just isolated API calls

### 2. **Comprehensive Metrics**
- **GEO Score**: How well optimized for AI engines
- **SOV Score**: Brand's share of conversation vs competitors
- **Combined**: Complete picture of AI visibility

### 3. **Actionable Insights**
- Per-provider scores show which AIs favor the brand
- Aggregate scores show overall performance
- Trends over time reveal improvement areas

### 4. **Backward Compatibility**
- Existing `/api/v1/geo/analyze` endpoint continues working
- New integrated scores add value without breaking changes

## Testing Strategy

### Unit Tests
```python
def test_geo_calculation_from_response():
    analysis = ResponseAnalysis(
        brand_analysis=BrandAnalysis(
            mentioned=True,
            mention_count=3,
            sentiment=Sentiment.POSITIVE,
            first_position_percentage=10.0
        )
    )
    
    geo_score = analyzer._calculate_response_geo_score(
        analysis, "test query", "TestBrand"
    )
    
    assert 70 <= geo_score <= 90  # High score for good metrics
```

### Integration Tests
```python
async def test_full_audit_with_geo_sov():
    # Run full audit
    job_processor = AuditJobProcessor(config)
    await job_processor.process_audit_job({
        'auditId': 'test-123',
        'queryCount': 5,
        'providers': ['openai_gpt5', 'anthropic_claude']
    })
    
    # Verify GEO and SOV scores stored
    with db.cursor() as cursor:
        cursor.execute(
            "SELECT geo_score, sov_score FROM audit_responses WHERE audit_id = %s",
            ('test-123',)
        )
        results = cursor.fetchall()
        
        assert all(r['geo_score'] is not None for r in results)
        assert all(0 <= r['sov_score'] <= 100 for r in results)
```

## Timeline

- **Week 1**: Update data structures and database schema
- **Week 2**: Integrate calculators into response analyzer
- **Week 3**: Update job processor and test integration
- **Week 4**: Deploy and monitor metrics

## Success Metrics

1. **All ~192 responses** have GEO and SOV scores
2. **Overall audit scores** include GEO and SOV components
3. **API response time** unchanged (< 100ms overhead)
4. **Meaningful scores**: GEO 40-80 range, SOV reflects actual mention ratios

---

**Status**: Ready for Implementation
**Priority**: HIGH - Critical missing functionality
**Impact**: Transforms isolated calculators into valuable production metrics