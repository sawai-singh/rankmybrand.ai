# RankMyBrand.ai - Unified Context Map
*Last Updated: August 5, 2025*

## Executive Summary

RankMyBrand.ai is an enterprise-grade platform for Generative Engine Optimization (GEO), designed to maximize content visibility in AI-powered search engines like ChatGPT, Perplexity, Claude, and Google AI Overview. The platform consists of three main services: a GEO Calculator for analyzing content optimization, a Web Crawler for comprehensive website analysis, and a Search Intelligence Service for analyzing brand visibility and predicting AI appearance likelihood.

## Recent Updates (August 5, 2025)

### Complete Search Intelligence Implementation
- **Phase 1 Completed**: Full implementation of Search Intelligence module within web-crawler service
- **Enhanced Query Generator v2**: Intelligent query generation with AI-focused relevance scoring
  - Generates 10-20 queries across 7 types (Brand, Product, Service, Transactional, Informational, Comparison, Long-tail)
  - 4 intent categories with difficulty and AI relevance scoring
  - Industry-specific templates and NLP-based entity extraction
- **Enhanced SERP Client v2**: Multi-provider support with comprehensive features
  - Provider failover (SerpAPI, ValueSERP, ScaleSERP)
  - Cost management with daily/monthly budgets
  - Intelligent caching with gzip compression
  - Rate limiting with token bucket algorithm
  - Circuit breaker pattern for reliability
- **Enhanced Ranking Analyzer v2**: Comprehensive SERP analysis engine
  - Multi-URL and subdomain position detection
  - SERP feature recognition and ownership tracking
  - Competitor analysis with head-to-head metrics
  - AI visibility prediction with multi-factor scoring
  - Pattern recognition for content gaps
  - Historical snapshot comparison
- **API Integration**: Complete RESTful API with WebSocket support
  - Real-time progress updates via WebSocket
  - Job queue integration with priority handling
  - Response formatting with standardized structure
  - Export functionality (JSON, CSV, PDF)
- **Crawler Integration**: Seamless integration with SmartCrawler
  - Automatic brand and product extraction
  - Competitor detection from crawled content
  - Search Intelligence triggers after crawl completion

### Comprehensive Testing & Monitoring Implementation
- **Testing Suite** (>90% coverage):
  - Unit tests for all core components
  - Integration tests for API workflows
  - Performance tests handling 100+ concurrent analyses
  - Load testing with WebSocket scalability
  - Cost control and budget enforcement tests
- **Prometheus Metrics Collection**:
  - Real-time tracking of searches, costs, and performance
  - Resource usage monitoring (CPU, memory)
  - Business metrics (visibility scores, rankings)
  - Cache efficiency and API success rates
- **Grafana Dashboards**:
  - 10-panel dashboard for comprehensive monitoring
  - Daily spend gauge with budget alerts
  - Real-time performance visualization
  - Query type distribution and trends
- **Production Optimizations**:
  - Query deduplication and prioritization
  - Cache pre-warming for common queries
  - Zero-downtime deployment scripts
  - Auto-scaling configuration (2-10 instances)
  - Circuit breakers for reliability

## Core Concepts

### Generative Engine Optimization (GEO)

GEO is a new optimization paradigm based on Princeton University research that focuses on improving content visibility in AI search results. Key principles:

1. **Statistics Addition**: +40% visibility boost by including relevant data points
2. **Citation Authority**: +35% improvement through credible source references
3. **Quotation Usage**: +27-41% boost with expert quotes
4. **Content Fluency**: +15-30% improvement through AI-optimized readability
5. **Domain Authority**: Trust signals from established domains
6. **Semantic Relevance**: Query-content alignment optimization

### AI Search Ranking Mechanisms

AI search engines use **Retrieval-Augmented Generation (RAG)**:
1. **Retrieval Phase**: Search external knowledge bases for relevant documents
2. **Generation Phase**: Weave retrieved content with AI responses

Key ranking factors:
- **Content Quality**: Authoritative, structured, list-style articles
- **Authority Signals**: Backlinks, reviews, domain age (10-15 year old domains favored)
- **Technical Factors**: Bing index reliance (ChatGPT), structured data markup

## System Architecture

### Project Structure

```
rankmybrand.ai/
├── services/
│   ├── geo-calculator/               # Core GEO analysis service
│   │   ├── backend/                  # FastAPI backend
│   │   │   ├── app/
│   │   │   │   ├── api/             # API endpoints
│   │   │   │   ├── core/            # Business logic
│   │   │   │   │   ├── calculator.py
│   │   │   │   │   ├── metrics.py
│   │   │   │   │   ├── job_queue.py
│   │   │   │   │   ├── ai_visibility_providers.py
│   │   │   │   │   └── config_manager.py
│   │   │   │   ├── models/          # Data models
│   │   │   │   └── database/        # DB configuration
│   │   │   └── tests/
│   │   ├── frontend/                 # Vanilla JS dashboard
│   │   └── integration/              # Service integrations
│   └── web-crawler/                  # Website crawling service
│       ├── src/
│       │   ├── crawl/               # Crawling engine
│       │   │   ├── smart-crawler.ts
│       │   │   ├── url-frontier.ts
│       │   │   └── deduplicator.ts
│       │   ├── extraction/          # GEO metric extractors
│       │   │   ├── citation-extractor.ts
│       │   │   ├── statistics-extractor.ts
│       │   │   ├── quotation-extractor.ts
│       │   │   ├── fluency-extractor.ts
│       │   │   ├── authority-extractor.ts
│       │   │   └── relevance-extractor.ts
│       │   ├── search-intelligence/ # COMPLETED: Search Intelligence Module
│       │   │   ├── core/           # Core search intelligence logic
│       │   │   │   ├── query-generator.ts         # Original query generator
│       │   │   │   ├── query-generator-v2.ts      # Enhanced with AI scoring
│       │   │   │   ├── query-generator-enhanced.ts # Backward compatible version
│       │   │   │   ├── serp-client.ts             # Basic SERP client
│       │   │   │   ├── serp-client-v2.ts          # Enhanced multi-provider client
│       │   │   │   ├── ranking-analyzer.ts        # Basic ranking analysis
│       │   │   │   ├── ranking-analyzer-v2.ts     # Enhanced with AI prediction
│       │   │   │   ├── brand-authority-scorer.ts  # Authority scoring
│       │   │   │   ├── competitor-analyzer.ts     # Competitor analysis
│       │   │   │   └── ai-visibility-predictor.ts # AI visibility prediction
│       │   │   ├── repositories/   # Database operations
│       │   │   │   ├── analysis-repository.ts
│       │   │   │   ├── ranking-repository.ts
│       │   │   │   └── mention-repository.ts
│       │   │   ├── api/           # REST & WebSocket endpoints
│       │   │   │   ├── search-intel-routes.ts     # Basic routes
│       │   │   │   ├── search-intel-routes-v2.ts  # Enhanced with WebSocket
│       │   │   │   └── response-formatter.ts      # Standardized responses
│       │   │   ├── utils/         # Support utilities
│       │   │   │   ├── cache-manager.ts           # Redis caching
│       │   │   │   ├── serp-cache-manager.ts      # SERP-specific cache
│       │   │   │   ├── budget-manager.ts          # API credit tracking
│       │   │   │   ├── cost-manager.ts            # Cost calculation
│       │   │   │   ├── rate-limiter.ts            # Token bucket limiter
│       │   │   │   └── circuit-breaker.ts         # Failover handling
│       │   │   ├── extractors/    # Content extractors
│       │   │   │   ├── brand-extractor.ts         # Brand detection
│       │   │   │   └── competitor-detector.ts     # Competitor identification
│       │   │   ├── integration/   # Service integrations
│       │   │   │   ├── crawler-integration.ts     # Web crawler hooks
│       │   │   │   └── smart-crawler-integration.ts # Enhanced crawler
│       │   │   ├── queue/         # Job processing
│       │   │   │   └── search-intel-job-processor.ts # Background jobs
│       │   │   ├── optimization/  # Production optimizations
│       │   │   │   ├── query-deduplicator.ts     # Query optimization
│       │   │   │   └── cache-prewarmer.ts        # Cache warming
│       │   │   ├── monitoring/    # Metrics collection
│       │   │   │   └── metrics.ts                # Prometheus metrics
│       │   │   ├── __tests__/     # Comprehensive test suite
│       │   │   │   ├── unit/                     # Unit tests
│       │   │   │   ├── integration/              # Integration tests
│       │   │   │   └── performance/              # Load tests
│       │   │   └── data/          # Static data
│       │   │       ├── ctr-curves.ts              # CTR and AI likelihood data
│       │   │       └── industry-keywords.ts       # Industry templates
│       │   ├── api/                 # REST API
│       │   ├── db/                  # Database layer
│       │   └── utils/               # Utilities
│       ├── monitoring/              # Prometheus/Grafana
│       │   ├── grafana/
│       │   │   └── dashboards/
│       │   │       └── search-intelligence.json   # Grafana dashboard
│       │   └── prometheus/
│       │       └── alerts/
│       │           └── search-intelligence-alerts.yml # Alert rules
│       ├── config/
│       │   └── production.json      # Production configuration
│       ├── scripts/
│       │   └── deploy.sh           # Zero-downtime deployment
│       └── docs/
│           ├── PRODUCTION_RUNBOOK.md # Operations guide
│           └── TESTING_AND_MONITORING.md # Testing guide
└── infrastructure/
    └── docker/                      # Container orchestration
```

### Technology Stack

**Backend Technologies:**
- **GEO Calculator**: Python, FastAPI, SQLAlchemy, Sentence Transformers
- **Web Crawler**: TypeScript, Fastify, Playwright, PostgreSQL, Redis
- **Search Intelligence**: TypeScript, integrated with Web Crawler
- **Job Queue**: Configurable (Memory/Database/Redis)
- **AI/ML**: NumPy, Sentence Transformers for semantic analysis

**Frontend Technologies:**
- Vanilla JavaScript for maximum performance
- Chart.js for data visualization
- Responsive design with modern CSS

**Infrastructure:**
- Docker containerization
- Nginx reverse proxy
- PostgreSQL (port 5433) for crawler
- Redis (port 6379) for queue/cache
- Prometheus + Grafana monitoring

## Service Details

### GEO Calculator Service

**Purpose**: Analyze content and provide GEO scores with recommendations

**Key Features:**
- 6 metric analysis (Statistics, Quotations, Fluency, Relevance, Authority, AI Visibility)
- Real-time and batch processing
- AI platform visibility checking (Perplexity, Google AI, ChatGPT, Claude)
- Extensible provider system
- Environment-based configuration (dev/staging/prod)

**API Endpoints:**
- `POST /api/v1/geo/analyze` - Single content analysis
- `POST /api/v1/geo/analyze/batch` - Batch URL analysis
- `GET /api/v1/geo/analyze/batch/{job_id}` - Check batch status
- `GET /api/v1/geo/analysis/{domain}` - Get cached results
- `GET /api/v1/geo/trending` - Trending metrics across analyses

**Performance:**
- Sub-10 second single URL analysis
- Concurrent batch processing
- Intelligent caching system

### Web Crawler Service

**Purpose**: Crawl websites and extract GEO optimization opportunities

**Key Features:**
- Smart JavaScript rendering detection (10% budget)
- Concurrent crawling with worker pool
- Robots.txt compliance with caching
- Content deduplication (SHA256)
- Real-time WebSocket updates
- Domain-based rate limiting (5 req/sec)
- **NEW**: Integrated Search Intelligence analysis

**API Endpoints:**
- `POST /api/crawl` - Start crawl job
- `GET /api/crawl/{jobId}` - Get job status
- `GET /api/crawl/{jobId}/pages` - Get page results
- `POST /api/crawl/{jobId}/stop` - Stop active crawl
- `GET /api/crawls/recent` - Recent crawl jobs
- `GET /api/domains/stats` - Domain statistics
- **NEW**: `GET /api/crawl/{jobId}/search-intel` - Get search intelligence results

**Performance:**
- 10,000 crawls/day capacity
- <$0.005 per crawl cost
- ~500 pages in 60 seconds

### Search Intelligence Service (NEW)

**Purpose**: Analyze brand visibility in search results and predict AI appearance

**Key Features:**
- **Enhanced Query Generation** (10-20 queries with AI relevance scoring)
  - 7 query types: Brand, Product, Service, Transactional, Informational, Comparison, Long-tail
  - 4 intent categories: Commercial, Informational, Navigational, Transactional
  - AI relevance scoring (1-10) and difficulty estimation (1-10)
  - Industry-specific templates (Technology, E-commerce, Healthcare, Finance)
  - NLP-based entity extraction for intelligent query creation
- Multi-provider SERP API support with failover
- Brand authority scoring based on mentions
- Automated competitor detection and analysis
- AI visibility prediction using weighted factors
- Real-time progress via WebSocket
- Redis caching with compression
- Budget management and API credit tracking

**API Endpoints:**
- `POST /api/search-intelligence/analyze` - Start new analysis
- `GET /api/search-intelligence/{analysisId}` - Get status/progress
- `GET /api/search-intelligence/{analysisId}/rankings` - Detailed rankings
- `GET /api/search-intelligence/{analysisId}/competitors` - Competitor analysis
- `POST /api/search-intelligence/{analysisId}/export` - Export results
- `GET /api/crawl/{jobId}/search-intelligence` - Crawl integration
- `WS /ws/search-intel/{analysisId}` - WebSocket for real-time updates

**Database Schema:**
- `search_analyses` - Main analysis records
- `search_rankings` - Query rankings and SERP features
- `brand_mentions` - Brand mention tracking with authority
- `competitor_analyses` - Competitor performance metrics

**Performance:**
- Handle 100 concurrent analyses
- 24-hour cache for SERP results
- Process 20 queries in <30 seconds (with caching)
- Memory usage <500MB per analysis
- P95 latency <5s, cache hit rate >60%

**Testing & Monitoring:**
- **Unit Tests**: >90% coverage for core components
- **Load Testing**: Handles 100 concurrent requests, 500 WebSocket connections
- **Metrics**: Prometheus with 30+ custom metrics
- **Dashboards**: 10-panel Grafana dashboard
- **Alerts**: Budget warnings (80%, 95%), API failures, performance degradation
- **Production**: Zero-downtime deployment, auto-scaling (2-10 instances)

## GEO Metrics Implementation

### 1. Statistics Density
- **Ideal**: 1 statistic per 150 words
- **Types**: Percentages, numbers, currency, multipliers
- **Scoring**: Exponential decay from ideal density

### 2. Quotation Authority
- **Components**: Attribution quality, source credibility
- **Ideal**: 2-3 quotes per 1000 words
- **Bonus**: Academic/government sources

### 3. Content Fluency
- **Factors**: Sentence variety, transition words, readability
- **Target**: Grade 8-10 reading level
- **Structure**: Clear headings, short paragraphs

### 4. Semantic Relevance
- **Method**: Sentence transformer embeddings
- **Calculation**: Cosine similarity with target queries
- **Weight**: Keyword position importance

### 5. Domain Authority
- **Signals**: TLD type (.edu/.gov bonus), domain age
- **Structure**: Clean URLs, proper hierarchy
- **Trust**: HTTPS, professional appearance

### 6. AI Visibility
- **Providers**: Perplexity API, Mock (testing)
- **Fallback**: Estimation based on other metrics
- **Future**: ChatGPT, Claude, Gemini APIs

### 7. Search Intelligence Metrics (NEW)
- **Visibility Score**: 0-100 based on rankings and coverage
- **Authority Score**: Very Low to Very High based on mentions
- **AI Prediction**: 0-100 score with confidence level
- **Competitive Position**: Leader/Challenger/Follower/Niche

## Configuration Management

### Environment Configuration

**Development:**
- Mock AI providers
- In-memory job queue
- Debug logging
- No rate limits

**Staging:**
- Real AI providers (limited)
- Database job queue
- Moderate rate limits
- Performance monitoring

**Production:**
- All AI providers
- Redis job queue
- Strict rate limits
- Full monitoring suite

### Key Environment Variables

```bash
# Core
APP_ENV=development|staging|production
DATABASE_URL=postgresql://user:pass@localhost/geodb
REDIS_URL=redis://localhost:6379

# AI Providers
PERPLEXITY_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx

# SERP Providers (NEW)
SERPAPI_KEY=xxx
VALUESERP_KEY=xxx
SCALESERP_KEY=xxx

# Crawler Specific
MAX_PAGES_PER_CRAWL=500
JS_RENDERING_BUDGET=0.1
RATE_LIMIT_PER_SECOND=5

# Search Intelligence (NEW)
SERPAPI_DAILY_LIMIT=1000
SERPAPI_MONTHLY_LIMIT=30000
```

## Database Schema

### GEO Calculator Tables
- `geo_analyses` - Analysis results and scores
- `batch_jobs` - Batch processing jobs
- `ai_visibility_results` - Platform visibility data

### Web Crawler Tables
- `crawl_jobs` - Crawl session tracking
- `crawled_pages` - Page results and GEO scores
- `crawl_errors` - Error logging
- `geo_recommendations` - Improvement suggestions

### Search Intelligence Tables (NEW)
- `search_analyses` - Search analysis sessions
- `search_rankings` - SERP rankings per query
- `brand_mentions` - Authority mention tracking
- `competitor_analyses` - Competitor metrics

## Integration Points

### Service Integration
```typescript
// Web Crawler → GEO Calculator
import { GEOAnalysisService } from './integration/geo-analysis-service';

const geoService = new GEOAnalysisService();
const result = await geoService.analyzeWebsite({
  url: 'https://example.com',
  keywords: ['AI', 'optimization'],
  pages: 100
});

// Web Crawler → Search Intelligence (NEW)
import { CrawlerSearchIntelIntegration } from './search-intelligence/integration/crawler-integration';

const searchIntel = new CrawlerSearchIntelIntegration();
await searchIntel.processCrawlJob(crawlJobId, domain, pages, options);
```

### Client SDK
```javascript
// Frontend → Backend
const geo = new RankMyBrandGEO({
  apiUrl: 'https://api.rankmybrand.ai',
  apiKey: 'your-api-key'
});

// Search Intelligence WebSocket (NEW)
const ws = new WebSocket(`ws://api.rankmybrand.ai/ws/search-intel/${analysisId}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`Progress: ${data.progress}%`);
};
```

## Market Positioning

### Competitive Landscape
- **Market Size**: $886M → $7.3B by 2031 (34% CAGR)
- **Competition**: Surfer ($95+/mo), Semrush ($249+/mo), Profound (custom)
- **Our Advantage**: $29/mo with real-time testing + search intelligence

### Target Pricing
- **Free**: 1 domain scan, basic score
- **Starter**: $29/mo - 3 domains, 25 queries, daily monitoring
- **Growth**: $79/mo - 10 domains, 100 queries, API access, search intelligence
- **Enterprise**: Custom - Unlimited domains, dedicated support

### Unique Features
1. **Real-time Testing**: Instant AI response preview
2. **AI Volume Estimator**: Search volume predictions
3. **One-Click Fixes**: Copy-paste optimizations
4. **Search Intelligence**: Brand visibility analysis (NEW)

## Development Guidelines

### Code Standards
- **Python**: Type hints, PEP 8, docstrings
- **TypeScript**: ES modules, .js imports, strict types
- **Error Handling**: Graceful degradation, structured logging
- **Testing**: >80% coverage, integration tests

### Adding New Features

**New AI Provider:**
1. Create provider class inheriting from `AIVisibilityProvider`
2. Implement `check_visibility` method
3. Register in `create_visibility_providers`
4. Add API key to environment

**New GEO Metric:**
1. Add calculator to `metrics.py`
2. Update weights in `config_manager.py`
3. Create extractor in web crawler
4. Update frontend display

**New SERP Provider (NEW):**
1. Add to `SerpApiProvider` enum
2. Implement in `SerpClient`
3. Add rate limits to `BudgetManager`
4. Configure API credentials

## Performance Optimization

### Caching Strategy
- Content hash-based caching
- Redis with appropriate TTLs
- Domain-level result aggregation
- **NEW**: 24-hour SERP result caching

### Scaling Considerations
- Horizontal scaling via Kubernetes
- Database connection pooling
- CDN for static assets
- Rate limiting per API key
- **NEW**: Circuit breakers for API providers

## Monitoring & Observability

### Metrics
- API response times
- GEO score distributions
- Crawler success rates
- AI provider availability
- **NEW**: Search intelligence completion rates
- **NEW**: SERP API credit usage

### Logging
- Structured JSON logging
- Log levels per environment
- Centralized log aggregation

### Alerts
- API endpoint failures
- Crawler job stuck
- AI provider rate limits
- Database connection issues
- **NEW**: SERP API budget warnings

## Security Considerations

### API Security
- API key authentication
- Rate limiting per key
- CORS configuration
- Input validation

### Data Protection
- Environment variable secrets
- Encrypted database connections
- No sensitive content storage
- GDPR compliance ready

## Future Roadmap

### Q3 2025
- ✅ Search Intelligence Service (Phase 1)
- ChatGPT visibility API integration
- Claude visibility API integration
- Historical tracking dashboard

### Q4 2025
- Search Intelligence Service (Phase 2 - Separate microservice)
- Google Gemini support
- Automated weekly reports
- ML-based optimization suggestions

### Q1 2026
- Bing search support
- Content generation assistant
- Competitive intelligence alerts
- Enterprise SSO integration

## Support & Resources

- **Documentation**: Internal CLAUDE.md files
- **API Docs**: `/api/v1/docs` endpoint
- **GitHub**: https://github.com/Harsh-Agarwals/rankMyBrand.com
- **Support**: support@rankmybrand.ai

---

## Quick Reference

### Start Services
```bash
# Development
cd services/geo-calculator/backend && uvicorn app.main:app --reload
cd services/web-crawler && npm run dev

# Production
cd infrastructure/docker && docker-compose up -d
```

### Test Endpoints
```bash
# GEO Analysis
curl -X POST http://localhost:8000/api/v1/geo/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "check_ai_visibility": true}'

# Web Crawl
curl -X POST http://localhost:3002/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "options": {"maxPages": 10}}'

# Search Intelligence (NEW)
curl -X POST http://localhost:3002/api/search-intel/analyze \
  -H "Content-Type: application/json" \
  -d '{"brand": "Example", "domain": "example.com", "options": {"maxQueries": 10}}'
```

### Monitor Health
- GEO Calculator: http://localhost:8000/health
- Web Crawler: http://localhost:3002/health
- Metrics: http://localhost:3002/metrics

---

*This context map provides a comprehensive overview of the RankMyBrand.ai platform including the new Search Intelligence Service. For detailed implementation specifics, refer to the individual service documentation and code files.*