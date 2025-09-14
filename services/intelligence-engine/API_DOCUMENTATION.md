# Intelligence Engine API Documentation

## Base URL
```
Development: http://localhost:8082
Production: https://api.rankmybrand.ai
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <token>
```

---

## Dashboard Endpoints

### 1. Get Company Summary
**Endpoint**: `GET /api/dashboard/summary/{company_id}`

**Description**: Returns summarized dashboard data for a company's latest audit

**Parameters**:
- `company_id` (path, integer): Company ID

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "audit_id": "c157e1b8-ac73-4ee4-b093-2e8d69e52b88",
    "company_name": "Bain & Company",
    "industry": "Management Consulting",
    "company_size": "enterprise",
    "overall_score": 55.11,
    "geo_score": 41.03,
    "sov_score": 40.75,
    "brand_mention_rate": 73.96,
    "brand_sentiment": "positive",
    "top_recommendations": [
      {
        "headline": "Launch Bain AI Index for Private Equity",
        "priority_score": 95,
        "quick_wins": ["Secure 3 anchor PE clients", "Announce project"],
        "expected_impact": {
          "on_revenue": "$20M+ influenced pipeline",
          "on_market_position": "Positions as AI + PE authority"
        }
      }
    ],
    "executive_summary": "Strategic narrative for C-suite...",
    "quick_wins": ["Action 1", "Action 2"],
    "main_competitors": ["McKinsey", "BCG", "Deloitte"]
  }
}
```

---

### 2. Get Detailed Audit Data
**Endpoint**: `GET /api/dashboard/detailed/{audit_id}`

**Description**: Returns complete dashboard data for a specific audit

**Parameters**:
- `audit_id` (path, string): Audit UUID

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "audit_id": "c157e1b8-ac73-4ee4-b093-2e8d69e52b88",
    "company_id": 110,
    "company_name": "Bain & Company",
    "overall_score": 55.11,
    "geo_score": 41.03,
    "sov_score": 40.75,
    "visibility_score": 73.96,
    "sentiment_score": 85.0,
    "brand_mentioned_count": 142,
    "brand_mention_rate": 73.96,
    "brand_sentiment_distribution": {
      "positive": 111,
      "neutral": 76,
      "negative": 0,
      "mixed": 5
    },
    "main_competitors": ["McKinsey", "BCG"],
    "competitor_mentions": {
      "McKinsey": {"count": 45, "sentiment": "neutral"},
      "BCG": {"count": 38, "sentiment": "positive"}
    },
    "provider_scores": {
      "openai_gpt5": {
        "avg_geo_score": 42.5,
        "avg_sov_score": 38.2,
        "brand_mention_rate": 75.0
      }
    },
    "top_recommendations": [...],
    "executive_summary": "...",
    "key_insights": ["Insight 1", "Insight 2"],
    "opportunity_areas": ["Opportunity 1", "Opportunity 2"],
    "created_at": "2025-09-03T10:15:00Z"
  }
}
```

---

### 3. Get Recommendations
**Endpoint**: `GET /api/dashboard/recommendations/{audit_id}`

**Description**: Returns all recommendations for an audit

**Parameters**:
- `audit_id` (path, string): Audit UUID

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "top_recommendations": [
      {
        "headline": "Launch Bain AI Index for Private Equity",
        "executive_pitch": "We can own the conversation around AI in PE...",
        "strategic_rationale": "Bain dominates PE consulting but hasn't...",
        "implementation_approach": "Leverage PE relationships to survey...",
        "priority_score": 95,
        "urgency_driver": "Competitors are dominating AI visibility...",
        "quick_wins": [
          "Secure 3 anchor PE clients",
          "Announce project internally"
        ],
        "expected_impact": {
          "on_brand": "Elevates digital visibility",
          "on_revenue": "$20M+ influenced pipeline",
          "on_market_position": "Positions as AI + PE authority"
        },
        "roi_calculation": "3-5x ROI within 12 months",
        "next_steps": [
          "Monday: Align PE leadership",
          "End of week: Draft framework"
        ]
      }
    ],
    "quick_wins": [
      "Convert case studies to structured data",
      "Launch AI practice microsite",
      "Create weekly AI insights newsletter"
    ],
    "total_recommendations": 10,
    "aggregation_method": "world_class"
  }
}
```

---

### 4. Get Competitive Analysis
**Endpoint**: `GET /api/dashboard/competitive-analysis/{audit_id}`

**Description**: Returns detailed competitive landscape analysis

**Parameters**:
- `audit_id` (path, string): Audit UUID

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "main_competitors": ["McKinsey", "BCG", "Deloitte"],
    "competitor_mentions": {
      "McKinsey": {
        "count": 45,
        "sentiment_breakdown": {
          "positive": 20,
          "neutral": 20,
          "negative": 5
        },
        "contexts": [
          "McKinsey's digital transformation practice",
          "McKinsey Global Institute research"
        ]
      }
    },
    "market_share_estimate": {
      "Bain": 25.5,
      "McKinsey": 35.2,
      "BCG": 28.3,
      "Others": 11.0
    },
    "competitive_gaps": [
      "Limited AI thought leadership",
      "Weak digital presence"
    ],
    "competitive_advantages": [
      "PE expertise",
      "Results-focused approach"
    ]
  }
}
```

---

### 5. Get Provider Analysis
**Endpoint**: `GET /api/dashboard/provider-analysis/{audit_id}`

**Description**: Returns performance analysis by LLM provider

**Parameters**:
- `audit_id` (path, string): Audit UUID

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "provider_scores": {
      "openai_gpt5": {
        "total_responses": 48,
        "avg_geo_score": 42.5,
        "avg_sov_score": 38.2,
        "avg_response_time": 1250,
        "brand_mention_rate": 75.0,
        "sentiment_breakdown": {
          "positive": 30,
          "neutral": 15,
          "negative": 3
        }
      },
      "anthropic_claude": {
        "total_responses": 48,
        "avg_geo_score": 40.1,
        "avg_sov_score": 41.5,
        "avg_response_time": 980,
        "brand_mention_rate": 72.9
      }
    },
    "best_provider": "openai_gpt5",
    "worst_provider": "perplexity",
    "provider_insights": [
      "GPT-5 provides most comprehensive responses",
      "Claude has fastest response times",
      "Perplexity lacks brand context"
    ]
  }
}
```

---

### 6. Get Company History
**Endpoint**: `GET /api/dashboard/history/{company_id}`

**Description**: Returns historical audit data for trend analysis

**Parameters**:
- `company_id` (path, integer): Company ID
- `limit` (query, integer, optional): Number of audits to return (default: 10)

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "audits": [
      {
        "audit_id": "c157e1b8-ac73-4ee4-b093-2e8d69e52b88",
        "created_at": "2025-09-03T10:15:00Z",
        "overall_score": 55.11,
        "geo_score": 41.03,
        "sov_score": 40.75,
        "brand_mention_rate": 73.96
      },
      {
        "audit_id": "previous-audit-id",
        "created_at": "2025-08-15T10:15:00Z",
        "overall_score": 52.30,
        "geo_score": 38.50,
        "sov_score": 39.20,
        "brand_mention_rate": 70.15
      }
    ],
    "trends": {
      "overall_score_change": +2.81,
      "geo_score_change": +2.53,
      "sov_score_change": +1.55,
      "brand_mention_change": +3.81
    },
    "improvement_areas": [
      "GEO score improving steadily",
      "Brand mentions increasing"
    ]
  }
}
```

---

### 7. Get Strategic Insights
**Endpoint**: `GET /api/dashboard/insights/{audit_id}`

**Description**: Returns AI-generated strategic insights

**Parameters**:
- `audit_id` (path, string): Audit UUID

**Response Example**:
```json
{
  "status": "success",
  "data": {
    "key_insights": [
      "Strong presence in PE-related queries but weak in general AI topics",
      "Competitors dominate thought leadership space",
      "High brand sentiment but low share of voice"
    ],
    "opportunity_areas": [
      "AI practice development",
      "Digital content optimization",
      "Thought leadership amplification"
    ],
    "risk_areas": [
      "Falling behind in AI visibility",
      "Limited digital presence",
      "Competitor advancement"
    ],
    "strategic_priorities": [
      {
        "priority": "Establish AI thought leadership",
        "timeframe": "Q1 2025",
        "expected_impact": "High"
      }
    ],
    "market_dynamics": "The consulting industry is rapidly shifting...",
    "recommended_focus": "Private equity + AI intersection"
  }
}
```

---

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

## Error Response Format
```json
{
  "status": "error",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

## Rate Limiting
- 100 requests per minute per API key
- 1000 requests per hour per API key

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8082/ws');
ws.send(JSON.stringify({
  type: 'join',
  audit_id: 'c157e1b8-ac73-4ee4-b093-2e8d69e52b88'
}));
```

### Event Types
- `analysis.started` - Analysis begins
- `response.analyzed` - Individual response analyzed
- `score.calculated` - Scores calculated
- `recommendation.extracted` - Recommendations extracted
- `dashboard.data_ready` - Dashboard data ready
- `analysis.completed` - Full analysis complete

---

## Frontend Integration Example

```javascript
// Fetch dashboard data
async function fetchDashboard(auditId) {
  const response = await fetch(
    `http://localhost:8082/api/dashboard/detailed/${auditId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data;
}

// Usage
const dashboardData = await fetchDashboard('c157e1b8-ac73-4ee4-b093-2e8d69e52b88');
console.log(`Overall Score: ${dashboardData.overall_score}`);
console.log(`Top Recommendation: ${dashboardData.top_recommendations[0].headline}`);
```

---

## Notes for Frontend Team

1. **CORS**: Already configured for localhost:3000 and production domains
2. **Large Responses**: Recommendation endpoints can return large payloads, implement pagination if needed
3. **Real-time Updates**: Use WebSocket for live progress during analysis
4. **Caching**: Consider caching dashboard data for 5 minutes to reduce API calls
5. **Error Handling**: Always check `status` field before accessing `data`
6. **Score Ranges**: All scores are 0-100, higher is better
7. **Timestamps**: All timestamps are in UTC ISO 8601 format

---

**Version**: 1.0.0  
**Last Updated**: 2025-09-03  
**Contact**: Intelligence Engine Team