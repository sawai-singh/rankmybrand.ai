# Search Intelligence API Documentation

## Overview

The Search Intelligence API provides comprehensive analysis of a brand's visibility in search results and predicts likelihood of appearing in AI-generated responses. It integrates seamlessly with the web crawler service to provide automated search intelligence after crawl jobs.

## Base URL

```
https://api.rankmybrand.ai/v1
```

## Authentication

All API requests require authentication using an API key in the header:

```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limits

- **Standard Plan**: 100 requests per day
- **Professional Plan**: 500 requests per day
- **Enterprise Plan**: Unlimited requests

## Endpoints

### 1. Start Analysis

**POST** `/api/search-intelligence/analyze`

Start a new search intelligence analysis.

#### Request Body

```json
{
  "brand": "YourBrand",
  "domain": "yourbrand.com",
  "crawlJobId": "crawl_123456789", // Optional
  "options": {
    "maxQueries": 20,
    "includeCompetitors": true,
    "competitors": ["competitor1.com", "competitor2.com"],
    "searchDepth": 20,
    "includeLocalSearch": false,
    "targetLocations": ["United States"],
    "industry": "Technology",
    "productKeywords": ["product1", "product2"],
    "skipCache": false,
    "apiProvider": "serpapi",
    "priority": "normal"
  }
}
```

#### Response

```json
{
  "analysisId": "si_1234567890abcdef",
  "status": "pending",
  "progress": {
    "totalQueries": 20,
    "completedQueries": 0,
    "currentQuery": null
  },
  "costs": {
    "queriesUsed": 0,
    "costIncurred": 0,
    "remainingBudget": 10
  },
  "websocketUrl": "/ws/search-intel/si_1234567890abcdef",
  "estimatedCompletionTime": "2024-01-15T10:35:00Z"
}
```

### 2. Get Analysis Status & Results

**GET** `/api/search-intelligence/:analysisId`

Get the current status and results of an analysis.

#### Response

```json
{
  "analysisId": "si_1234567890abcdef",
  "status": "completed",
  "progress": {
    "totalQueries": 20,
    "completedQueries": 20,
    "currentQuery": null
  },
  "results": {
    "visibilityScore": 75,
    "rankings": [
      {
        "query": "best CRM software",
        "position": 3,
        "url": "https://yourbrand.com/features",
        "queryType": "comparison",
        "serpFeatures": {
          "hasFeaturedSnippet": true,
          "hasKnowledgePanel": false,
          "hasPeopleAlsoAsk": true,
          "hasLocalPack": false,
          "hasShoppingResults": false
        },
        "visibility": {
          "score": 90,
          "estimatedTraffic": 282,
          "clickThroughRate": 0.1011
        }
      }
    ],
    "competitors": [
      {
        "domain": "competitor1.com",
        "averagePosition": 5.2,
        "visibilityScore": 68,
        "queryOverlap": 85,
        "strengthAgainstUs": [
          "Strong average ranking position",
          "Ranking for brand-related queries"
        ],
        "weaknessAgainstUs": [
          "Limited query coverage"
        ]
      }
    ],
    "brandAuthority": {
      "overallScore": 72,
      "tier": "high",
      "totalMentions": 156,
      "sentimentBreakdown": {
        "positive": 68,
        "neutral": 28,
        "negative": 4
      },
      "topSources": [
        {
          "domain": "techcrunch.com",
          "authority": 95,
          "mentionCount": 12
        }
      ]
    },
    "recommendations": [
      {
        "type": "content",
        "priority": "high",
        "title": "Create content for missing queries",
        "description": "You're not ranking for 5 important queries. Creating targeted content could significantly improve visibility.",
        "estimatedImpact": 8,
        "relatedQueries": ["query1", "query2", "query3"]
      }
    ],
    "aiVisibilityPrediction": {
      "score": 78,
      "likelihood": "high",
      "factors": [
        "Strong search visibility in top positions",
        "High likelihood of being cited by AI",
        "3 featured snippets increase AI visibility"
      ]
    }
  },
  "costs": {
    "queriesUsed": 20,
    "costIncurred": 0.20,
    "remainingBudget": 9.80
  }
}
```

### 3. Get Detailed Rankings

**GET** `/api/search-intelligence/:analysisId/rankings`

Get detailed ranking information for all queries.

#### Response

```json
{
  "analysisId": "si_1234567890abcdef",
  "domain": "yourbrand.com",
  "rankings": [
    {
      "query": "best CRM software",
      "position": 3,
      "url": "https://yourbrand.com/features",
      "queryType": "comparison",
      "serpFeatures": {
        "hasFeaturedSnippet": true,
        "hasKnowledgePanel": false,
        "hasPeopleAlsoAsk": true,
        "hasLocalPack": false,
        "hasShoppingResults": false
      },
      "competitorPositions": {
        "competitor1.com": 1,
        "competitor2.com": 5
      },
      "visibility": {
        "score": 90,
        "estimatedTraffic": 282,
        "clickThroughRate": 0.1011
      }
    }
  ],
  "summary": {
    "totalQueries": 20,
    "rankedQueries": 18,
    "averagePosition": 6.5,
    "top3Count": 8,
    "top10Count": 15
  }
}
```

### 4. Get Competitor Analysis

**GET** `/api/search-intelligence/:analysisId/competitors`

Get detailed competitor analysis.

#### Response

```json
{
  "analysisId": "si_1234567890abcdef",
  "domain": "yourbrand.com",
  "competitors": [
    {
      "domain": "competitor1.com",
      "averagePosition": 5.2,
      "visibilityScore": 68,
      "queryOverlap": 85,
      "queriesRanking": 17,
      "winsAgainstUs": 8,
      "lossesToUs": 9,
      "commonQueries": 15
    }
  ],
  "comparison": {
    "averageVisibility": 75,
    "competitorAverages": {
      "competitor1.com": 68,
      "competitor2.com": 62
    },
    "strengthsVsCompetitors": [
      "Better rankings for brand queries",
      "More featured snippets owned"
    ],
    "weaknessesVsCompetitors": [
      "Lower average position for comparison queries"
    ]
  }
}
```

### 5. Export Analysis

**POST** `/api/search-intelligence/:analysisId/export`

Export analysis results in various formats.

#### Request Body

```json
{
  "format": "pdf",
  "sections": ["summary", "rankings", "competitors", "recommendations"]
}
```

#### Response

Binary file download with appropriate headers.

### 6. Get Crawl Job Search Intelligence

**GET** `/api/crawl/:jobId/search-intelligence`

Get search intelligence results associated with a crawl job.

#### Response

Same as Get Analysis Status & Results endpoint.

## WebSocket Events

Connect to the WebSocket endpoint to receive real-time updates:

```javascript
const ws = new WebSocket('wss://api.rankmybrand.ai/ws/search-intel/si_1234567890abcdef');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log(event);
});
```

### Event Types

#### Progress Event
```json
{
  "type": "progress",
  "data": {
    "analysisId": "si_1234567890abcdef",
    "progress": 50,
    "totalQueries": 20,
    "completedQueries": 10,
    "currentQuery": "best CRM software",
    "costs": {
      "queriesUsed": 10,
      "costIncurred": 0.10,
      "remainingBudget": 9.90
    }
  }
}
```

#### Query Complete Event
```json
{
  "type": "query:complete",
  "data": {
    "analysisId": "si_1234567890abcdef",
    "query": "best CRM software",
    "position": 3,
    "cost": 0.01
  }
}
```

#### Cost Warning Event
```json
{
  "type": "cost:warning",
  "data": {
    "analysisId": "si_1234567890abcdef",
    "warning": "80% of daily budget used",
    "budgetUsed": 8.00,
    "budgetRemaining": 2.00
  }
}
```

#### Complete Event
```json
{
  "type": "complete",
  "data": {
    "analysisId": "si_1234567890abcdef",
    "status": "completed",
    "totalQueries": 20,
    "totalCost": 0.20
  }
}
```

#### Error Event
```json
{
  "type": "error",
  "data": {
    "analysisId": "si_1234567890abcdef",
    "error": "Budget limit exceeded",
    "code": "BUDGET_EXCEEDED"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_DOMAIN` | The provided domain is invalid |
| `BUDGET_EXCEEDED` | Daily or monthly budget limit reached |
| `RATE_LIMITED` | Too many requests |
| `ANALYSIS_NOT_FOUND` | The requested analysis ID doesn't exist |
| `PROVIDER_ERROR` | SERP API provider error |
| `ANALYSIS_FAILED` | Analysis failed to complete |
| `UNAUTHORIZED` | Invalid or missing API key |

## Integration with Crawl Jobs

When starting a crawl job, include search intelligence options:

```json
{
  "url": "https://yourbrand.com",
  "includeSearchIntel": true,
  "searchIntelOptions": {
    "maxQueries": 15,
    "includeCompetitors": true,
    "industry": "Technology"
  }
}
```

The search intelligence analysis will automatically start after the crawl completes, using extracted brand and product information.

## Best Practices

1. **Caching**: Results are cached for 24 hours. Use `skipCache: true` only when necessary.

2. **Query Limits**: Start with 10-20 queries for initial analysis, increase if needed.

3. **Competitors**: Provide 3-5 main competitors for best results.

4. **Industry Context**: Always specify industry for better query generation.

5. **WebSocket Connection**: Use WebSocket for real-time updates instead of polling.

6. **Budget Management**: Monitor the `costs` object to track spending.

7. **Error Handling**: Implement exponential backoff for retries.

## Code Examples

### Node.js Example

```javascript
const axios = require('axios');
const WebSocket = require('ws');

// Start analysis
async function startAnalysis() {
  const response = await axios.post(
    'https://api.rankmybrand.ai/v1/api/search-intelligence/analyze',
    {
      brand: 'YourBrand',
      domain: 'yourbrand.com',
      options: {
        maxQueries: 20,
        includeCompetitors: true,
        industry: 'Technology'
      }
    },
    {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      }
    }
  );

  const { analysisId, websocketUrl } = response.data;
  
  // Connect to WebSocket for updates
  const ws = new WebSocket(`wss://api.rankmybrand.ai${websocketUrl}`);
  
  ws.on('message', (data) => {
    const event = JSON.parse(data);
    
    switch(event.type) {
      case 'progress':
        console.log(`Progress: ${event.data.progress}%`);
        break;
      case 'complete':
        console.log('Analysis complete!');
        getResults(analysisId);
        ws.close();
        break;
      case 'error':
        console.error('Analysis error:', event.data.error);
        ws.close();
        break;
    }
  });
}

// Get results
async function getResults(analysisId) {
  const response = await axios.get(
    `https://api.rankmybrand.ai/v1/api/search-intelligence/${analysisId}`,
    {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
      }
    }
  );
  
  console.log('Visibility Score:', response.data.results.visibilityScore);
  console.log('AI Prediction:', response.data.results.aiVisibilityPrediction);
}
```

### Python Example

```python
import requests
import websocket
import json

# Start analysis
def start_analysis():
    response = requests.post(
        'https://api.rankmybrand.ai/v1/api/search-intelligence/analyze',
        json={
            'brand': 'YourBrand',
            'domain': 'yourbrand.com',
            'options': {
                'maxQueries': 20,
                'includeCompetitors': True,
                'industry': 'Technology'
            }
        },
        headers={
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
        }
    )
    
    data = response.json()
    analysis_id = data['analysisId']
    websocket_url = data['websocketUrl']
    
    # Connect to WebSocket
    ws = websocket.WebSocketApp(
        f'wss://api.rankmybrand.ai{websocket_url}',
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    ws.run_forever()

def on_message(ws, message):
    event = json.loads(message)
    
    if event['type'] == 'progress':
        print(f"Progress: {event['data']['progress']}%")
    elif event['type'] == 'complete':
        print('Analysis complete!')
        ws.close()
```

## Changelog

### v2.0.0 (Current)
- Added WebSocket support for real-time updates
- Enhanced response formatting
- Added job queue integration
- Improved error handling
- Added export functionality

### v1.0.0
- Initial release
- Basic analysis endpoints
- Crawler integration