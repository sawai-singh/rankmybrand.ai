# CLAUDE.md - AI Assistant Context for Web Crawler Service

This file provides essential context for AI assistants (like Claude) to understand and work effectively with the RankMyBrand Web Crawler service.

## Project Overview

The RankMyBrand Web Crawler is an enterprise-grade service designed to crawl websites and analyze their content for Generative Engine Optimization (GEO). It evaluates how well web content will perform in AI-powered search engines like ChatGPT, Perplexity, Claude, and Google AI Overview.

## Architecture

### Core Components

1. **API Server (Fastify)**
   - Location: `/services/web-crawler/src/`
   - Main entry: `src/index.ts`
   - API routes: `src/api/crawl-routes.ts`
   - Port: 3002

2. **Smart Crawler Engine**
   - Location: `src/crawl/smart-crawler.ts`
   - Uses Playwright for JavaScript rendering
   - Worker-based concurrent crawling
   - Respects robots.txt and rate limits

3. **GEO Extractors**
   - Citation Extractor: `src/extraction/citation-extractor.ts`
   - Statistics Extractor: `src/extraction/statistics-extractor.ts`
   - Quotation Extractor: `src/extraction/quotation-extractor.ts`
   - Fluency Extractor: `src/extraction/fluency-extractor.ts`
   - Authority Extractor: `src/extraction/authority-extractor.ts`
   - Relevance Extractor: `src/extraction/relevance-extractor.ts`

4. **Search Intelligence Module** (PHASE 1 COMPLETE)
   - Location: `src/search-intelligence/`
   - **Enhanced Query Generator v2**: Intelligent search query generation with AI relevance scoring
     - Files: `query-generator.ts`, `query-generator-v2.ts`, `query-generator-enhanced.ts`
     - 7 query types: Brand, Product, Service, Transactional, Informational, Comparison, Long-tail
     - 4 intent categories: Commercial, Informational, Navigational, Transactional
     - AI relevance (1-10) and difficulty (1-10) scoring
     - Industry-specific templates (Technology, E-commerce, Healthcare, Finance)
     - NLP-based entity extraction for smart query building
     - Backward compatible with original interface
   - **Enhanced SERP Client v2**: Enterprise-grade multi-provider API client
     - Files: `serp-client.ts`, `serp-client-v2.ts`
     - Providers: SerpAPI, ValueSERP, ScaleSERP with automatic failover
     - Cost management: Daily ($10) and monthly ($300) budgets
     - Caching: Redis with gzip compression (60-80% size reduction)
     - Rate limiting: Token bucket (5/sec, burst 10)
     - Circuit breaker: Provider isolation with exponential backoff
   - **Enhanced Ranking Analyzer v2**: Comprehensive SERP analysis
     - Files: `ranking-analyzer.ts`, `ranking-analyzer-v2.ts`
     - Multi-URL and subdomain position detection
     - SERP feature recognition and ownership tracking
     - Competitor analysis with head-to-head metrics
     - AI visibility prediction using multi-factor algorithm
     - Pattern recognition for content gaps
     - Historical snapshot comparison
   - Brand Authority Scorer: Authority calculation from mentions
   - Competitor Analyzer: Competitive landscape analysis
   - AI Visibility Predictor: Multi-factor AI appearance prediction

5. **Infrastructure**
   - PostgreSQL: Database for crawl jobs and results (port 5433)
   - Redis: URL frontier and deduplication cache (port 6379)
   - Docker: Container orchestration

### Key Systems

1. **URL Frontier** (`src/crawl/url-frontier.ts`)
   - Redis-based priority queue
   - Domain-based crawl delays
   - Robots.txt compliance
   - Depth and subdomain control

2. **Deduplicator** (`src/crawl/deduplicator.ts`)
   - Content fingerprinting
   - URL normalization
   - Update detection
   - Redis-backed cache

3. **Redis Wrapper** (`src/utils/redis-wrapper.ts`)
   - Compatibility layer for ioredis v5
   - Ensures consistent Redis API
   - Handles sorted set operations

4. **Database Schema**
   - `crawl_jobs`: Track crawl sessions
   - `crawled_pages`: Store page results and GEO scores
   - `crawl_errors`: Log crawl failures
   - `geo_recommendations`: Store improvement suggestions
   - `search_analyses`: Search intelligence sessions (NEW)
   - `search_rankings`: SERP rankings per query (NEW)
   - `brand_mentions`: Authority mention tracking (NEW)
   - `competitor_analyses`: Competitor metrics (NEW)

## Development Workflow

### Running Locally

```bash
# Prerequisites
# - Docker Desktop running
# - Node.js 18+ installed
# - PostgreSQL on port 5433 (via Docker)
# - Redis on port 6379

# Setup
cd services/web-crawler
./setup.sh

# Development
npm run dev

# The server will be available at http://localhost:3002
# API docs at http://localhost:3002/docs
```

### Running with Docker

```bash
cd services/web-crawler
docker-compose up -d
```

### Testing

```bash
# Run tests
npm test

# Check TypeScript
npx tsc --noEmit

# Lint
npm run lint
```

## API Endpoints

### Main Endpoints

1. **POST /api/crawl**
   ```json
   {
     "url": "https://example.com",
     "options": {
       "maxPages": 100,
       "maxDepth": 3,
       "targetKeywords": ["AI", "search"],
       "includeSubdomains": false
     }
   }
   ```
   Returns: Job ID and WebSocket URL for real-time updates

2. **GET /api/crawl/{jobId}**
   - Get crawl job status and results
   - Includes GEO scores and recommendations

3. **GET /api/crawl/{jobId}/pages**
   - Get individual page results
   - Supports pagination

4. **POST /api/crawl/{jobId}/stop**
   - Stop an active crawl job

5. **GET /api/crawls/recent**
   - Get recent crawl jobs

6. **GET /api/domains/stats**
   - Get domain-level statistics

### Search Intelligence Endpoints (COMPLETE)

7. **POST /api/search-intelligence/analyze**
   ```json
   {
     "brand": "BrandName",
     "domain": "example.com",
     "options": {
       "maxQueries": 20,
       "includeCompetitors": true,
       "industry": "Technology",
       "priority": "high"
     }
   }
   ```
   Returns: Analysis ID, WebSocket URL, and initial progress

8. **GET /api/search-intelligence/{analysisId}**
   - Get analysis status, progress, and results
   - Returns formatted response with visibility scores, rankings, AI prediction

9. **GET /api/search-intelligence/{analysisId}/rankings**
   - Get detailed ranking information for all queries
   - Includes position, URL, SERP features, competitor positions

10. **GET /api/search-intelligence/{analysisId}/competitors**
    - Get comprehensive competitor analysis
    - Includes overlap metrics, strengths, weaknesses

11. **POST /api/search-intelligence/{analysisId}/export**
    ```json
    {
      "format": "json|csv|pdf",
      "sections": ["summary", "rankings", "competitors", "recommendations"]
    }
    ```
    - Export analysis results in various formats

12. **GET /api/crawl/{jobId}/search-intelligence**
    - Get search intelligence results for a crawl job
    - Automatically retrieves latest analysis

13. **WebSocket /ws/search-intel/{analysisId}**
    - Real-time progress updates
    - Events: progress, query:complete, cost:warning, complete, error

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

Optional:
- `PORT`: Server port (default: 3002)
- `MAX_PAGES_PER_CRAWL`: Maximum pages to crawl (default: 500)
- `JS_RENDERING_BUDGET`: Percentage of pages to render with JS (default: 0.1)
- `RATE_LIMIT_PER_SECOND`: Requests per second per domain (default: 5)

Search Intelligence (NEW):
- `SERPAPI_KEY`: SerpAPI key for search results
- `VALUESERP_KEY`: ValueSERP API key
- `SCALESERP_KEY`: ScaleSERP API key
- `SERPAPI_DAILY_LIMIT`: Daily API credit limit
- `SERPAPI_MONTHLY_LIMIT`: Monthly API credit limit

## Common Tasks

### Adding a New GEO Metric

1. Create extractor in `src/extraction/`
2. Implement `extract()` and `calculateScore()` methods
3. Add to SmartCrawler's `analyzeContent()` method
4. Update database schema if needed
5. Add to composite score calculation

### Debugging Crawl Issues

1. Check server logs: `tail -f server.log`
2. Check Redis: `redis-cli` then `KEYS frontier:*`
3. Check database: `psql` then check `crawl_jobs` table
4. Enable debug logging: Set `LOG_LEVEL=debug`

### Handling Redis Compatibility

The codebase uses a Redis wrapper (`src/utils/redis-wrapper.ts`) to handle ioredis v5 compatibility. All Redis operations should go through this wrapper.

### Adding Search Intelligence to Crawls

1. Enable in crawl options: `includeSearchIntel: true`
2. Provide search options: `searchIntelOptions: { maxQueries: 20 }`
3. Monitor via WebSocket for progress
4. Retrieve results via `/api/crawl/{jobId}/search-intel`

## Code Patterns

### TypeScript Patterns
```typescript
// Use type imports
import type { CrawlConfig } from '../types/index.js';

// Use .js extensions in imports (ES modules)
import { logger } from '../utils/logger.js';

// Type Redis clients properly
import { Redis } from 'ioredis';
```

### Error Handling
```typescript
try {
  // Operation
} catch (error) {
  logger.error('Context-specific message', error);
  // Handle gracefully, don't crash
}
```

### Database Queries
```typescript
// Use parameterized queries
const result = await query(
  'SELECT * FROM crawl_jobs WHERE id = $1',
  [jobId]
);
```

### Using Enhanced Query Generator
```typescript
import { QueryGenerator } from './search-intelligence/core/query-generator-v2.js';

// Basic usage
const generator = new QueryGenerator();
const queries = await generator.generateQueries({
  brand: 'YourBrand',
  domain: 'yourbrand.com',
  industry: 'technology',
  products: ['Product A', 'Product B']
});

// Advanced usage with configuration
const config = {
  minQueries: 15,
  maxQueries: 25,
  includeCompetitors: true,
  includeLocation: true,
  targetAudience: ['developers', 'startups']
};
const queries = await generator.generateQueriesWithConfig(context, config);

// Analyze query portfolio
const analysis = generator.analyzeQueryPortfolio(queries);
```

## Recent Updates (August 2025) - Phase 1 Complete

1. **Search Intelligence Module - Full Implementation**
   - **Enhanced Query Generator v2**:
     - 10-20 intelligent queries across 7 types with AI relevance scoring
     - Industry-specific templates and NLP-based entity extraction
     - Conversational long-tail queries optimized for AI search
     - Backward compatible with original interface
   
   - **Enhanced SERP Client v2**:
     - Multi-provider support (SerpAPI, ValueSERP, ScaleSERP) with failover
     - Cost management with daily/monthly budget enforcement
     - Intelligent caching with gzip compression (60-80% reduction)
     - Token bucket rate limiting with priority queue
     - Circuit breaker pattern for provider isolation
   
   - **Enhanced Ranking Analyzer v2**:
     - Multi-URL and subdomain position detection
     - SERP feature recognition (snippets, knowledge panels, PAA)
     - Competitor tracking with head-to-head analysis
     - AI visibility prediction using multi-factor algorithm
     - Pattern recognition for content gaps and opportunities
     - Historical snapshot comparison for trends
   
   - **Complete API Integration**:
     - RESTful endpoints for all operations
     - WebSocket support for real-time progress
     - Job queue integration with priority handling
     - Standardized response formatting
     - Export functionality (JSON, CSV, PDF)
   
   - **Crawler Integration**:
     - Automatic brand/product extraction during crawl
     - Competitor detection from content
     - Search Intelligence triggers after crawl

2. **Comprehensive Testing & Monitoring**
   - **Testing Suite (>90% coverage)**:
     - Unit tests for QueryGenerator, SerpClient, RankingAnalyzer
     - Integration tests for API endpoints and workflows
     - Performance tests handling 100+ concurrent analyses
     - Load testing with 500 WebSocket connections
     - Budget enforcement and cost control tests
   
   - **Prometheus Metrics Collection**:
     - 30+ custom metrics for searches, costs, and performance
     - Real-time resource monitoring (CPU, memory)
     - Business metrics (visibility scores, rankings, cache rates)
     - Provider availability and circuit breaker status
   
   - **Grafana Dashboard**:
     - 10-panel dashboard with real-time visualizations
     - Daily spend gauge with budget alerts
     - Cache hit rate and API performance metrics
     - Query type distribution and trends
   
   - **Production Optimizations**:
     - Query deduplication and intelligent prioritization
     - Cache pre-warming for common queries
     - Zero-downtime deployment with health checks
     - Auto-scaling configuration (2-10 instances)
     - Production runbook and troubleshooting guide

3. **Database Enhancements**
   - Added 4 new tables: search_analyses, search_rankings, brand_mentions, competitor_analyses
   - Migration: `004_add_search_intelligence.sql`
   - Optimized indexes for performance

4. **Fixed Redis Compatibility**
   - Created RedisWrapper class for ioredis v5
   - Fixed zrevrange → zrange migration issues
   - All Redis operations now use consistent API

5. **TypeScript Improvements**
   - Added missing type definitions (@types/ws)
   - Fixed Fastify route registration
   - Improved type safety throughout

6. **Performance Optimizations**
   - Worker-based concurrent crawling
   - Smart JS rendering budget
   - Efficient URL deduplication
   - Query optimization with deduplication
   - Cache strategy with pre-warming

## Performance Metrics

- Average crawl speed: ~2-10 seconds per page
- Concurrent workers: 5 (configurable)
- Memory usage: ~200-500MB depending on crawl size
- Database connection pool: 2-10 connections
- Search Intelligence:
  - Query generation: <100ms
  - P95 latency: <5s
  - Cache hit rate: >60%
  - Concurrent analyses: 100+
  - WebSocket connections: 500+

## Security Considerations

- Robots.txt compliance enforced
- Rate limiting per domain
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- No storage of sensitive content

## Troubleshooting

### Server won't start
1. Check Docker is running
2. Verify PostgreSQL is on port 5433
3. Verify Redis is on port 6379
4. Check for port conflicts

### Crawls failing immediately
1. Check Playwright browsers: `npx playwright install`
2. Verify Redis connection
3. Check database migrations ran

### High memory usage
1. Reduce MAX_PAGES_PER_CRAWL
2. Lower concurrent workers
3. Increase crawl delays

## Search Intelligence Implementation Details

### File Structure
```
search-intelligence/
├── core/                          # Core components
│   ├── query-generator.ts         # Original implementation
│   ├── query-generator-v2.ts      # Enhanced with AI scoring
│   ├── query-generator-enhanced.ts # Backward compatible wrapper
│   ├── serp-client.ts            # Basic SERP client
│   ├── serp-client-v2.ts         # Enhanced multi-provider
│   ├── ranking-analyzer.ts       # Basic analysis
│   └── ranking-analyzer-v2.ts    # Enhanced with AI prediction
├── api/                          # API layer
│   ├── search-intel-routes.ts    # Basic routes
│   ├── search-intel-routes-v2.ts # Enhanced with WebSocket
│   └── response-formatter.ts     # Standard responses
├── utils/                        # Utilities
│   ├── cache-manager.ts          # Generic caching
│   ├── serp-cache-manager.ts     # SERP-specific cache
│   ├── cost-manager.ts           # Budget tracking
│   └── rate-limiter.ts           # Token bucket
├── integration/                  # Service integration
│   ├── crawler-integration.ts    # Basic integration
│   └── smart-crawler-integration.ts # Enhanced crawler
├── optimization/                 # Production optimizations
│   ├── query-deduplicator.ts    # Query optimization
│   └── cache-prewarmer.ts       # Cache warming
├── monitoring/                   # Metrics collection
│   └── metrics.ts               # Prometheus metrics
├── __tests__/                   # Test suite
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── performance/             # Load tests
└── data/                        # Static data
    └── ctr-curves.ts            # CTR and AI data

monitoring/                      # Service monitoring
├── grafana/
│   └── dashboards/
│       └── search-intelligence.json
└── prometheus/
    └── alerts/
        └── search-intelligence-alerts.yml

### Key Features Implemented

1. **Intelligent Query Generation**
   - AI relevance scoring (1-10) for each query
   - Difficulty estimation based on query type
   - Industry-specific keyword templates
   - NLP-based entity extraction
   - Conversational query variations

2. **Robust SERP API Management**
   - Automatic provider failover
   - Cost tracking per query
   - Smart caching with compression
   - Rate limiting with priority queue
   - Circuit breaker for failures

3. **Comprehensive Ranking Analysis**
   - Exact position detection
   - SERP feature ownership tracking
   - Competitor overlap analysis
   - AI citation likelihood prediction
   - Content gap identification

4. **Real-time Progress Tracking**
   - WebSocket connections
   - Query-level updates
   - Cost warnings
   - Error notifications

## Testing the Crawler

```bash
# Test basic crawl
curl -X POST http://localhost:3002/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/",
    "options": {
      "maxPages": 5,
      "maxDepth": 1
    }
  }'

# Test with search intelligence
curl -X POST http://localhost:3002/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/",
    "options": {
      "maxPages": 10,
      "includeSearchIntel": true,
      "searchIntelOptions": {
        "maxQueries": 10,
        "industry": "Technology"
      }
    }
  }'

# Direct search intelligence analysis
curl -X POST http://localhost:3002/api/search-intelligence/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "Example Brand",
    "domain": "example.com",
    "options": {
      "maxQueries": 20,
      "includeCompetitors": true,
      "industry": "Technology"
    }
  }'

# Check search intelligence status
curl http://localhost:3002/api/search-intelligence/{analysisId}

# Get detailed rankings
curl http://localhost:3002/api/search-intelligence/{analysisId}/rankings

# Export results
curl -X POST http://localhost:3002/api/search-intelligence/{analysisId}/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "sections": ["summary", "rankings", "recommendations"]
  }'
```

## Contact & Support

For questions about the web crawler:
- Review this documentation first
- Check existing code patterns
- Consult the main CLAUDE.md in the project root
- GitHub Issues: https://github.com/Harsh-Agarwals/rankMyBrand.com/issues

---

Last updated: 2025-08-05
Service version: 1.0.0