# Enhanced SERP Client v2

A robust, production-ready SERP (Search Engine Results Page) API client with comprehensive cost management, intelligent caching, rate limiting, and multi-provider support.

## Features

### 🚀 Multi-Provider Support
- **Provider Abstraction**: Easy switching between SERP API providers
- **Priority-Based Selection**: Automatic failover to backup providers
- **Circuit Breaker**: Prevents cascading failures
- **Provider Health Monitoring**: Real-time availability tracking

### 💰 Cost Management
- **Budget Enforcement**: Daily and monthly budget limits
- **Real-Time Tracking**: Per-query cost tracking
- **Budget Alerts**: Warning and critical threshold notifications
- **Usage Analytics**: Detailed cost breakdowns by provider
- **Projected Spending**: Monthly spend projections

### 🗄️ Intelligent Caching
- **Redis-Based Cache**: Fast, distributed caching
- **Compression**: Automatic gzip compression (60-80% savings)
- **TTL Management**: Configurable cache expiration (24-72 hours)
- **Cache Warming**: Pre-populate with common queries
- **Hit Rate Tracking**: Monitor cache effectiveness

### ⚡ Rate Limiting
- **Token Bucket Algorithm**: Smooth request distribution
- **Priority Queue**: Higher priority for important queries
- **Burst Support**: Handle traffic spikes gracefully
- **Concurrent Limits**: Control parallel requests
- **Exponential Backoff**: Smart retry logic

### 🛡️ Error Handling
- **Circuit Breaker Pattern**: Isolate failing providers
- **Automatic Retries**: With configurable backoff
- **Fallback Strategies**: Cache fallback on errors
- **Detailed Logging**: Comprehensive error context
- **Graceful Degradation**: Continue with reduced functionality

## Installation

```bash
npm install ioredis axios zlib
```

## Configuration

```typescript
const config: SerpClientConfig = {
  providers: [
    {
      name: SerpApiProvider.SERPAPI,
      apiKey: 'your-api-key',
      baseUrl: 'https://serpapi.com',
      priority: 1,
      enabled: true,
      costPerQuery: 0.01,
      rateLimit: 10
    }
  ],
  cache: {
    enabled: true,
    ttl: 86400, // 24 hours
    namespace: 'serp:cache',
    compress: true,
    warmupQueries: ['common query 1', 'common query 2']
  },
  rateLimiting: {
    requestsPerSecond: 5,
    burstLimit: 10,
    concurrentRequests: 3,
    backoffStrategy: 'exponential',
    maxRetries: 3
  },
  costManagement: {
    dailyBudget: 10,
    monthlyBudget: 300,
    defaultCostPerQuery: 0.01,
    budgetAlerts: {
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      alertCallback: (alert) => console.warn(alert)
    },
    trackingEnabled: true
  },
  errorHandling: {
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    fallbackToCacheOnError: true,
    detailedLogging: false
  }
};
```

## Usage

### Basic Search
```typescript
import { Redis } from 'ioredis';
import { EnhancedSerpClient } from './serp-client-v2';

const redis = new Redis();
const client = new EnhancedSerpClient(redis, config);

// Simple search
const results = await client.search('best CRM software');
console.log(`Found ${results.totalResults} results`);
console.log(`Cost: $${results.cost}`);

// Search with options
const mobileResults = await client.search('smartphone reviews', {
  location: 'United States',
  language: 'en',
  device: 'mobile',
  num: 20,
  provider: SerpApiProvider.SERPAPI
});
```

### Batch Search
```typescript
const queries = ['query1', 'query2', 'query3'];

const batchResults = await client.batchSearch(queries, {
  concurrency: 2,
  progressCallback: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total}`);
  },
  stopOnBudgetExceeded: true
});

console.log(`Success: ${batchResults.summary.successful}`);
console.log(`Failed: ${batchResults.summary.failed}`);
console.log(`Total Cost: $${batchResults.summary.totalCost}`);
```

### Usage Statistics
```typescript
const stats = await client.getUsageStats();

// Cost statistics
console.log(`Daily spend: $${stats.cost.daily.spent}/${stats.cost.daily.budget}`);
console.log(`Monthly spend: $${stats.cost.monthly.spent}/${stats.cost.monthly.budget}`);

// Cache performance
console.log(`Cache hit rate: ${stats.cache.hitRate}%`);

// Provider health
stats.providers.forEach(p => {
  console.log(`${p.provider}: ${p.availability === 1 ? 'Healthy' : 'Down'}`);
});
```

## Provider Implementation

### Currently Supported
- **Mock Provider**: For testing and development
- **SerpAPI**: Full implementation with all features

### Adding New Providers
1. Add provider to `SerpApiProvider` enum
2. Implement search method in `serp-client-v2.ts`
3. Add provider configuration
4. Map response format to standard `SearchResults`

Example:
```typescript
private async searchWithNewProvider(
  query: string,
  options: SearchOptions
): Promise<SearchResults> {
  const client = this.httpClients.get(SerpApiProvider.NEW_PROVIDER)!;
  const response = await client.get('/search', { params: {...} });
  
  // Parse and return standardized results
  return {
    query,
    results: parseResults(response.data),
    features: parseFeatures(response.data),
    totalResults: response.data.total,
    // ... other fields
  };
}
```

## Cost Management

### Budget Configuration
```typescript
costManagement: {
  dailyBudget: 10,    // $10/day
  monthlyBudget: 300, // $300/month
  budgetAlerts: {
    warningThreshold: 0.8,  // Alert at 80%
    criticalThreshold: 0.95 // Alert at 95%
  }
}
```

### Cost Tracking
- Automatic daily/monthly reset
- Per-provider cost tracking
- Historical data retention (7 days)
- Real-time budget enforcement

### Budget Alerts
```typescript
alertCallback: (alert: BudgetAlert) => {
  if (alert.type === 'critical') {
    // Send notification
    notificationService.send({
      message: `Critical: ${alert.period} budget at ${alert.percentage}%`,
      urgency: 'high'
    });
  }
}
```

## Caching Strategy

### Cache Key Structure
```
serp:cache:2024-01-15:query:location:language:device:num:start
```

### Compression
- Automatic gzip compression
- 60-80% size reduction
- Transparent decompression

### Cache Warming
```typescript
// Warm up cache with common queries
await client.warmupCache();

// Or manually with specific queries
config.cache.warmupQueries = [
  'industry terms',
  'common searches',
  'brand names'
];
```

### Cache Management
```typescript
// Get cache statistics
const cacheStats = await client.getUsageStats();
console.log(`Hit rate: ${cacheStats.cache.hitRate}%`);

// Manual cache operations
const cacheManager = (client as any).cacheManager;
await cacheManager.delete('specific query');
await cacheManager.clear(); // Clear all
await cacheManager.prune(); // Remove orphaned entries
```

## Rate Limiting

### Configuration
```typescript
rateLimiting: {
  requestsPerSecond: 5,    // Sustained rate
  burstLimit: 10,          // Max tokens
  concurrentRequests: 3,   // Parallel limit
  backoffStrategy: 'exponential',
  maxRetries: 3
}
```

### Priority Queue
```typescript
// High priority search (1-10, lower = higher priority)
await client.search('urgent query', { 
  priority: 1 
});

// Normal priority
await client.search('regular query'); // Default: 5
```

### Queue Management
```typescript
const rateLimiter = (client as any).rateLimiter;

// Get queue info
const info = rateLimiter.getQueueInfo();
console.log(`Queue size: ${info.size}`);

// Wait for completion
await rateLimiter.waitForEmpty();

// Clear queue
rateLimiter.clearQueue();
```

## Error Handling

### Circuit Breaker States
- **Closed**: Normal operation
- **Open**: Failing, rejecting requests
- **Half-Open**: Testing recovery

### Configuration
```typescript
errorHandling: {
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,     // Failures before opening
  circuitBreakerTimeout: 60000,    // 1 minute timeout
  fallbackToCacheOnError: true
}
```

### Error Types
```typescript
try {
  await client.search('query');
} catch (error) {
  if (error.name === 'BudgetExceededError') {
    console.log('Budget limit reached');
  } else if (error.circuitBreakerOpen) {
    console.log('Provider temporarily unavailable');
  } else if (error.retryable) {
    console.log('Temporary error, will retry');
  }
}
```

## Performance Optimization

### Batch Processing
- Process multiple queries efficiently
- Respect rate limits
- Optimize API credit usage

### Caching Best Practices
- Use consistent search options
- Implement cache warming
- Monitor hit rates
- Adjust TTL based on data freshness needs

### Provider Selection
- Order providers by cost/reliability
- Use circuit breakers effectively
- Monitor provider health
- Implement graceful degradation

## Monitoring

### Key Metrics
- **Cost**: Daily/monthly spend, cost per query
- **Cache**: Hit rate, compression ratio, size
- **Providers**: Availability, error rate, response time
- **Rate Limit**: Current rate, throttled requests, queue size

### Health Checks
```typescript
// Overall health
const stats = await client.getUsageStats();
const healthy = stats.providers.every(p => p.availability > 0.9);

// Circuit breaker status
const cbFactory = (client as any).circuitBreakerFactory;
const health = cbFactory.getHealthStatus();
```

## Troubleshooting

### Common Issues

1. **"Budget Exceeded"**
   - Check daily/monthly limits
   - Review cost tracking
   - Consider increasing budget

2. **"Circuit Breaker Open"**
   - Provider experiencing issues
   - Wait for timeout period
   - Check provider status

3. **"Rate Limited"**
   - Too many requests
   - Reduce concurrent requests
   - Check rate limit config

4. **Low Cache Hit Rate**
   - Queries too varied
   - TTL too short
   - Consider cache warming

### Debug Mode
```typescript
errorHandling: {
  detailedLogging: true
}
```

## Best Practices

1. **Cost Control**
   - Set realistic budgets
   - Monitor usage regularly
   - Use caching effectively
   - Choose appropriate providers

2. **Performance**
   - Batch similar queries
   - Use cache warming
   - Optimize search options
   - Monitor queue sizes

3. **Reliability**
   - Configure multiple providers
   - Set appropriate timeouts
   - Enable circuit breakers
   - Implement proper error handling

4. **Security**
   - Store API keys securely
   - Rotate keys regularly
   - Monitor for unusual usage
   - Implement access controls

## Testing

### Unit Tests
```bash
npm test serp-client.test.ts
```

### Integration Tests
```typescript
// Use mock provider for testing
const testConfig = {
  providers: [{
    name: SerpApiProvider.MOCK,
    // ... mock config
  }]
};
```

### Load Testing
```typescript
// Test rate limiting
const promises = Array(100).fill(0).map(
  (_, i) => client.search(`query ${i}`)
);
await Promise.all(promises);
```

## Migration Guide

### From v1 to v2
1. Update configuration structure
2. Replace direct API calls with client methods
3. Update error handling for new error types
4. Implement budget alerts
5. Test with mock provider first

## License

Part of RankMyBrand.ai platform - see main LICENSE file.