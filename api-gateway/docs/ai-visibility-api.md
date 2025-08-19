# AI Visibility API Documentation

## Overview

The AI Visibility API provides enterprise-grade analysis of brand presence across multiple AI platforms including ChatGPT, Claude, Gemini, and Perplexity. This system generates intelligent queries, executes them across LLMs, analyzes responses, and provides comprehensive visibility metrics.

**Base URL**: `https://api.rankmybrand.ai/api/ai-visibility`

**Version**: 1.0.0

## Authentication

All API endpoints require authentication using Bearer tokens:

```http
Authorization: Bearer <your-api-token>
```

## Rate Limiting

- **Standard tier**: 60 requests per minute
- **Enterprise tier**: 300 requests per minute
- **Cost limit**: $100 per day across all LLM providers

## Endpoints

### 1. Create Audit

Initiates a new AI visibility audit for a company.

**POST** `/api/ai-visibility/audit`

#### Request Body

```json
{
  "company_name": "TechCorp",
  "industry": "Software Development",
  "description": "Leading CI/CD automation platform for DevOps teams",
  "competitors": ["Jenkins", "CircleCI", "GitLab"],
  "target_audiences": [
    {
      "name": "DevOps Engineers",
      "size": "500K"
    }
  ],
  "unique_value_propositions": [
    "Fastest deployment times",
    "99.99% uptime guarantee"
  ],
  "products_services": [
    "CI/CD Platform",
    "Container Registry",
    "Monitoring Dashboard"
  ],
  "session_id": "session_123",
  "user_email": "admin@techcorp.com"
}
```

#### Response

```json
{
  "audit_id": "audit_20240118_143022_session_123",
  "status": "pending",
  "message": "Audit created successfully and queued for processing",
  "estimated_completion": "2024-01-18T14:35:22Z",
  "websocket_channel": "audit:audit_20240118_143022_session_123"
}
```

#### Status Codes

- `200 OK` - Audit created successfully
- `400 Bad Request` - Invalid request parameters
- `429 Too Many Requests` - Rate limit exceeded
- `503 Service Unavailable` - Daily cost limit exceeded

---

### 2. Get Audit Status

Retrieves the current status and results of an audit.

**GET** `/api/ai-visibility/audit/{audit_id}`

#### Response

```json
{
  "audit_id": "audit_20240118_143022_session_123",
  "company_name": "TechCorp",
  "status": "completed",
  "created_at": "2024-01-18T14:30:22Z",
  "completed_at": "2024-01-18T14:34:58Z",
  "results": {
    "visibility_score": 82.5,
    "brand_mentions": 45,
    "total_queries": 50,
    "total_responses": 200,
    "platforms_analyzed": {
      "openai": 50,
      "anthropic": 50,
      "google": 50,
      "perplexity": 50
    },
    "competitive_analysis": {
      "TechCorp": {
        "mentions": 45,
        "sentiment_score": 0.78,
        "position": 2,
        "share_of_voice": 28.5
      },
      "Jenkins": {
        "mentions": 62,
        "sentiment_score": 0.65,
        "position": 1,
        "share_of_voice": 39.2
      },
      "CircleCI": {
        "mentions": 38,
        "sentiment_score": 0.72,
        "position": 3,
        "share_of_voice": 24.1
      },
      "GitLab": {
        "mentions": 13,
        "sentiment_score": 0.69,
        "position": 4,
        "share_of_voice": 8.2
      }
    },
    "recommendations": [
      "Increase content about DevOps best practices to improve visibility",
      "Add more case studies and customer testimonials",
      "Optimize for 'CI/CD automation' and 'deployment pipeline' keywords",
      "Create comparison content highlighting advantages over Jenkins"
    ],
    "metrics_breakdown": {
      "brand_awareness": 78,
      "product_mentions": 82,
      "feature_coverage": 85,
      "sentiment_positivity": 88,
      "recommendation_strength": 75
    }
  }
}
```

---

### 3. Get Metrics

Retrieves current AI visibility metrics and statistics.

**GET** `/api/ai-visibility/metrics`

#### Response

```json
{
  "date": "2024-01-18",
  "total_audits": 145,
  "total_queries": 7250,
  "llm_calls": {
    "openai": 1825,
    "anthropic": 1810,
    "google": 1805,
    "perplexity": 1810
  },
  "cost_usd": 68.45,
  "cache_stats": {
    "hits": 2150,
    "misses": 5100,
    "hit_rate": 29.7
  },
  "average_audit_time_seconds": 278,
  "error_rate": 0.02
}
```

---

### 4. Get Provider Health

Checks the health status of all LLM providers.

**GET** `/api/ai-visibility/providers/health`

#### Response

```json
{
  "openai": {
    "status": "healthy",
    "average_latency_ms": 450,
    "success_rate": 99.2,
    "circuit_state": "closed",
    "last_error": null,
    "requests_today": 1825
  },
  "anthropic": {
    "status": "healthy",
    "average_latency_ms": 380,
    "success_rate": 99.8,
    "circuit_state": "closed",
    "last_error": null,
    "requests_today": 1810
  },
  "google": {
    "status": "degraded",
    "average_latency_ms": 850,
    "success_rate": 95.5,
    "circuit_state": "half-open",
    "last_error": "Rate limit approaching",
    "requests_today": 1805
  },
  "perplexity": {
    "status": "healthy",
    "average_latency_ms": 520,
    "success_rate": 98.9,
    "circuit_state": "closed",
    "last_error": null,
    "requests_today": 1810
  }
}
```

---

### 5. Admin: Reset Daily Limits

Resets daily cost limits (requires admin API key).

**POST** `/api/ai-visibility/admin/reset-limits`

#### Request Headers

```http
X-Admin-API-Key: <admin-api-key>
```

#### Response

```json
{
  "message": "Daily limits reset successfully",
  "date": "2024-01-18"
}
```

---

## WebSocket Events

Connect to real-time updates for audit progress.

### Connection

```javascript
const ws = new WebSocket('wss://api.rankmybrand.ai/ws/ai-visibility/{audit_id}');
```

### Event Types

#### Progress Update

```json
{
  "type": "progress",
  "audit_id": "audit_20240118_143022_session_123",
  "stage": "query_generation",
  "progress": 25,
  "message": "Generating 50 intelligent queries...",
  "timestamp": "2024-01-18T14:31:15Z"
}
```

#### Stage Completion

```json
{
  "type": "stage_complete",
  "audit_id": "audit_20240118_143022_session_123",
  "stage": "llm_execution",
  "results": {
    "queries_executed": 50,
    "responses_collected": 200,
    "providers_used": 4
  },
  "timestamp": "2024-01-18T14:33:45Z"
}
```

#### Audit Complete

```json
{
  "type": "audit_complete",
  "audit_id": "audit_20240118_143022_session_123",
  "visibility_score": 82.5,
  "processing_time_seconds": 278,
  "timestamp": "2024-01-18T14:34:58Z"
}
```

#### Error

```json
{
  "type": "error",
  "audit_id": "audit_20240118_143022_session_123",
  "error": "Provider rate limit exceeded",
  "recoverable": true,
  "retry_after_seconds": 60,
  "timestamp": "2024-01-18T14:32:30Z"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Daily cost limit of $100 exceeded",
    "details": {
      "current_cost": 100.45,
      "limit": 100.00,
      "reset_time": "2024-01-19T00:00:00Z"
    }
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|------------|
| `RATE_LIMIT_EXCEEDED` | Request rate limit exceeded | 429 |
| `COST_LIMIT_EXCEEDED` | Daily cost limit exceeded | 503 |
| `INVALID_REQUEST` | Invalid request parameters | 400 |
| `AUDIT_NOT_FOUND` | Audit ID not found | 404 |
| `PROVIDER_UNAVAILABLE` | LLM provider is unavailable | 503 |
| `UNAUTHORIZED` | Invalid or missing auth token | 401 |
| `INTERNAL_ERROR` | Internal server error | 500 |

---

## Integration Guide

### Python Example

```python
import requests
import asyncio
import websockets
import json

class AIVisibilityClient:
    def __init__(self, api_key, base_url="https://api.rankmybrand.ai"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def create_audit(self, company_data):
        """Create a new AI visibility audit"""
        response = requests.post(
            f"{self.base_url}/api/ai-visibility/audit",
            headers=self.headers,
            json=company_data
        )
        response.raise_for_status()
        return response.json()
    
    def get_audit_status(self, audit_id):
        """Get audit status and results"""
        response = requests.get(
            f"{self.base_url}/api/ai-visibility/audit/{audit_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    async def monitor_audit(self, audit_id):
        """Monitor audit progress via WebSocket"""
        uri = f"wss://api.rankmybrand.ai/ws/ai-visibility/{audit_id}"
        
        async with websockets.connect(uri) as websocket:
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                
                print(f"[{data['type']}] {data.get('message', '')}")
                
                if data['type'] == 'audit_complete':
                    print(f"Audit completed! Score: {data['visibility_score']}")
                    break
                elif data['type'] == 'error':
                    print(f"Error: {data['error']}")
                    if not data.get('recoverable'):
                        break

# Usage example
client = AIVisibilityClient("your-api-key")

# Create audit
audit_data = {
    "company_name": "TechCorp",
    "industry": "Software Development",
    "description": "Leading CI/CD platform",
    "competitors": ["Jenkins", "CircleCI"]
}

result = client.create_audit(audit_data)
audit_id = result['audit_id']

# Monitor progress
asyncio.run(client.monitor_audit(audit_id))

# Get final results
final_results = client.get_audit_status(audit_id)
print(f"Final visibility score: {final_results['results']['visibility_score']}")
```

### JavaScript/TypeScript Example

```typescript
interface AuditRequest {
  company_name: string;
  industry: string;
  description: string;
  competitors: string[];
  target_audiences?: Array<{name: string; size: string}>;
  unique_value_propositions?: string[];
  products_services?: string[];
}

class AIVisibilityClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.rankmybrand.ai') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async createAudit(data: AuditRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/ai-visibility/audit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  async monitorAudit(auditId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://api.rankmybrand.ai/ws/ai-visibility/${auditId}`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(`[${data.type}] ${data.message || ''}`);

        if (data.type === 'audit_complete') {
          console.log(`Audit completed! Score: ${data.visibility_score}`);
          ws.close();
          resolve();
        } else if (data.type === 'error' && !data.recoverable) {
          ws.close();
          reject(new Error(data.error));
        }
      };

      ws.onerror = (error) => {
        reject(error);
      };
    });
  }
}

// Usage
const client = new AIVisibilityClient('your-api-key');

async function runAudit() {
  const auditData: AuditRequest = {
    company_name: 'TechCorp',
    industry: 'Software Development',
    description: 'Leading CI/CD platform',
    competitors: ['Jenkins', 'CircleCI']
  };

  try {
    const result = await client.createAudit(auditData);
    console.log(`Audit created: ${result.audit_id}`);
    
    await client.monitorAudit(result.audit_id);
    
    console.log('Audit completed successfully!');
  } catch (error) {
    console.error('Audit failed:', error);
  }
}

runAudit();
```

---

## Best Practices

1. **Rate Limiting**: Implement exponential backoff when encountering rate limits
2. **Cost Management**: Monitor the daily cost via metrics endpoint before creating audits
3. **Caching**: Results are cached for 1 hour; avoid duplicate audits within this timeframe
4. **WebSocket Handling**: Implement reconnection logic for WebSocket disconnections
5. **Error Recovery**: Use the `recoverable` flag in error events to determine retry strategy
6. **Batch Processing**: Group multiple company audits to optimize API usage

---

## Support

For API support, please contact:
- Email: api-support@rankmybrand.ai
- Documentation: https://docs.rankmybrand.ai
- Status Page: https://status.rankmybrand.ai