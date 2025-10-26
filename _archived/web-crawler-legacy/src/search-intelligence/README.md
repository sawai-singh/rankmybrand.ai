# Search Intelligence Module

A comprehensive TypeScript module for analyzing brand visibility in search results and predicting likelihood of appearing in AI-generated responses.

## Overview

The Search Intelligence module is designed to:
- Generate 10-20 intelligent search queries based on brand/product analysis
- Check rankings in Google search results (top 20)
- Analyze brand mentions across the web with authority scoring
- Compare performance against competitors
- Predict AI visibility based on search rankings and authority metrics

## Architecture

### Core Components

1. **SearchIntelligenceService** - Main orchestration service
2. **QueryGenerator** - Generates intelligent search queries
3. **SerpClient** - Handles SERP API calls with rate limiting
4. **RankingAnalyzer** - Analyzes search rankings
5. **BrandAuthorityScorer** - Scores brand mentions and authority
6. **CompetitorAnalyzer** - Analyzes competitive landscape
7. **AIVisibilityPredictor** - Predicts AI search visibility

### Database Schema

The module adds four new tables to the existing PostgreSQL database:
- `search_analyses` - Main analysis records
- `search_rankings` - Individual query rankings
- `brand_mentions` - Brand mention tracking
- `competitor_analyses` - Competitor performance data

## Installation & Setup

### Prerequisites

- PostgreSQL (port 5433)
- Redis (port 6379)
- Node.js 18+
- TypeScript 5+

### Environment Variables

```bash
# API Provider Keys
SERPAPI_KEY=your_serpapi_key
VALUESERP_KEY=your_valueserp_key
SCALESERP_KEY=your_scaleserp_key

# API Limits
SERPAPI_DAILY_LIMIT=1000
SERPAPI_MONTHLY_LIMIT=30000

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5433/webcrawler
```

### Database Migration

Run the migration to create the necessary tables:

```bash
psql -U your_user -d webcrawler -f src/db/migrations/004_add_search_intelligence.sql
```

## Usage

### Basic Analysis

```typescript
import { SearchIntelligenceService } from './search-intelligence';

const service = new SearchIntelligenceService();

// Start an analysis
const analysis = await service.analyzeSearchIntelligence(
  'YourBrand',
  'yourbrand.com',
  {
    maxQueries: 20,
    includeCompetitors: true,
    industry: 'Technology',
    productKeywords: ['product1', 'product2'],
    competitors: ['competitor1.com', 'competitor2.com']
  }
);

// Monitor progress
service.on('analysis:progress', (event) => {
  console.log(`Progress: ${event.progress}% - ${event.currentQuery}`);
});

// Get results
const results = await service.getAnalysisResults(analysis.id);
console.log(`AI Visibility Score: ${results.aiPrediction.predictedScore}`);
```

### Integration with Web Crawler

```typescript
// In crawl job options
const crawlJob = await crawler.startCrawl({
  url: 'https://example.com',
  includeSearchIntel: true,
  searchIntelOptions: {
    maxQueries: 15,
    includeCompetitors: true
  }
});
```

### API Endpoints

```bash
# Start new analysis
POST /api/search-intel/analyze
{
  "brand": "YourBrand",
  "domain": "yourbrand.com",
  "options": {
    "maxQueries": 20,
    "industry": "Technology"
  }
}

# Get analysis status
GET /api/search-intel/analyze/{analysisId}

# Get full results
GET /api/search-intel/analyze/{analysisId}/results

# Cancel analysis
POST /api/search-intel/analyze/{analysisId}/cancel

# Get analyses by domain
GET /api/search-intel/domain?domain=yourbrand.com&limit=10

# Get statistics
GET /api/search-intel/stats
```

### WebSocket Support

Connect to real-time updates:

```javascript
const ws = new WebSocket(`ws://localhost:3002/ws/search-intel/${analysisId}`);

ws.on('message', (data) => {
  const event = JSON.parse(data);
  switch(event.type) {
    case 'progress':
      console.log(`Progress: ${event.data.progress}%`);
      break;
    case 'complete':
      console.log('Analysis complete!', event.data.result);
      break;
    case 'error':
      console.error('Analysis error:', event.data.error);
      break;
  }
});
```

## Query Generation

The QueryGenerator creates intelligent queries across 7 types:

1. **Brand Queries** - Direct brand searches
2. **Product Queries** - Product-specific searches
3. **Service Queries** - Service-related searches
4. **Comparison Queries** - Versus competitors
5. **Informational Queries** - How-to and guides
6. **Transactional Queries** - Purchase intent
7. **Local Queries** - Location-based searches

Example generated queries:
- "YourBrand reviews"
- "YourBrand vs Competitor"
- "best product YourBrand"
- "how does YourBrand work"
- "YourBrand pricing"

## Metrics & Scoring

### Visibility Score (0-100)
- Based on average position and coverage
- Weighted by query type importance
- Includes SERP feature bonuses

### Authority Score
- **Very High**: Major publications, .edu, .gov
- **High**: Industry publications, respected blogs
- **Medium**: General reputable sites
- **Low**: Lesser-known sites
- **Very Low**: Minimal authority signals

### AI Visibility Prediction
Factors considered:
- Search visibility (25%)
- Authority score (30%)
- Content relevance (20%)
- Competitive position (15%)
- Technical factors (10%)

## Performance & Scaling

### Rate Limiting
- Per-provider rate limits enforced
- Automatic fallback to alternate providers
- Circuit breaker pattern for failed providers

### Caching
- 24-hour cache for SERP results
- Redis-based with compression
- Cache warming for common queries

### Budget Management
- Daily and monthly credit tracking
- Cost estimation per analysis
- Automatic provider selection based on cost

### Performance Targets
- Single URL analysis: <10 seconds
- Batch processing: Concurrent execution
- Memory usage: <500MB per analysis
- Cache hit rate: >60% for common queries

## Error Handling

The module implements comprehensive error handling:

1. **Graceful Degradation** - Falls back to cached data
2. **Provider Failover** - Automatic switch to backup providers
3. **Analysis Recovery** - Resumes from last checkpoint
4. **Budget Protection** - Stops when limits reached

## Testing

Run the test suite:

```bash
# Unit tests
npm test src/search-intelligence/__tests__/search-intelligence.test.ts

# Integration tests
npm test src/search-intelligence/__tests__/integration.test.ts

# Coverage report
npm run test:coverage
```

Current coverage: >80%

## Monitoring

The module exposes metrics for monitoring:

- Analysis completion rate
- Average processing time
- API credit usage
- Cache hit/miss ratio
- Error rates by type

Access metrics at: `GET /api/search-intel/metrics`

## Best Practices

1. **Query Limits** - Keep maxQueries ≤20 for optimal performance
2. **Caching** - Enable caching for repeated analyses
3. **Competitors** - Limit to 5 main competitors
4. **Industry Context** - Always provide industry for better queries
5. **Budget Alerts** - Set up alerts for 80% credit usage

## Troubleshooting

### Common Issues

1. **"Budget limit reached"**
   - Check daily/monthly limits
   - Use mock provider for testing
   - Implement caching

2. **"Analysis taking too long"**
   - Reduce maxQueries
   - Check API provider status
   - Enable skipCache if needed

3. **"No competitors detected"**
   - Provide manual competitor list
   - Check industry setting
   - Analyze more pages

## Future Enhancements

- [ ] ChatGPT visibility API integration
- [ ] Claude visibility API integration  
- [ ] Google Gemini support
- [ ] Bing search support
- [ ] Historical tracking
- [ ] Automated reporting
- [ ] ML-based query optimization

## Contributing

1. Follow TypeScript strict mode
2. Add tests for new features
3. Update documentation
4. Run linter before committing

## License

Part of RankMyBrand.ai platform - see main LICENSE file.