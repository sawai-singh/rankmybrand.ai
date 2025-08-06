# RankMyBrand Web Crawler Service

A high-performance, GEO-optimized web crawler designed to extract the 6 key metrics for Generative Engine Optimization (GEO). Built to handle 10,000 crawls/day with <$0.005 per crawl cost.

## 🚀 Features

- **6 GEO Metrics Extraction**:
  - Citation Score - References and sources
  - Statistics Density - Data points and numbers
  - Quotation Authority - Expert quotes
  - Content Fluency - Readability for AI
  - Domain Authority - Trust signals
  - Semantic Relevance - Keyword alignment

- **Smart Crawling**:
  - Intelligent JavaScript rendering detection
  - Automatic deduplication
  - Robots.txt compliance
  - Sitemap discovery
  - Rate limiting and politeness

- **Real-time Updates**:
  - WebSocket support for live progress
  - Instant recommendations
  - Progressive score updates

- **Production Ready**:
  - Docker containerization
  - Horizontal scalability
  - Prometheus metrics
  - Comprehensive logging

## 📋 Prerequisites

- Node.js 18+ (for development)
- Docker & Docker Compose (for production)
- PostgreSQL 14+
- Redis 6+

## 🛠️ Installation

### Development Setup

1. Clone the repository:
```bash
cd ~/Desktop/rankmybrand.ai/rankMyBrand.com-main/services/web-crawler
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Set up the database:
```bash
# Start PostgreSQL and Redis (if not running)
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate
```

5. Start the development server:
```bash
npm run dev
```

### Production Setup

1. Build and start all services:
```bash
docker-compose up -d
```

2. Check service health:
```bash
curl http://localhost:3002/health
```

3. View API documentation:
```bash
open http://localhost:3002/docs
```

## 🔧 Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3002 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `MAX_PAGES_PER_CRAWL` | Max pages per crawl job | 500 |
| `JS_RENDERING_BUDGET` | % of pages to render with JS | 0.1 |
| `RATE_LIMIT_PER_SECOND` | Requests per second per domain | 5 |

See `.env.example` for all configuration options.

## 📡 API Usage

### Start a Crawl

```bash
curl -X POST http://localhost:3002/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "maxPages": 100,
      "maxDepth": 3,
      "targetKeywords": ["AI", "SEO", "optimization"]
    }
  }'
```

Response:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "estimatedTime": 60,
  "websocketUrl": "wss://api.rankmybrand.ai/ws/crawl/550e8400"
}
```

### Get Crawl Status

```bash
curl http://localhost:3002/api/crawl/{jobId}
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3002/ws/crawl/{jobId}');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Progress:', message);
});
```

### Get Page Analysis

```bash
curl http://localhost:3002/api/crawl/{jobId}/pages
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│   URL Frontier  │────▶│  Smart Crawler  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │     │      Redis      │     │   Playwright    │
│   (Storage)     │     │    (Queues)     │     │  (JS Rendering) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GEO Extractors                            │
│  Citation │ Statistics │ Quotation │ Fluency │ Authority │ Relevance │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 GEO Metrics Explained

### 1. Citation Score (0-100)
- Detects academic citations, references, and sources
- Higher scores for pages with reference sections
- Analyzes citation density and variety

### 2. Statistics Score (0-100)
- Extracts percentages, comparisons, and data points
- Rewards statistics in important locations (headings, bold text)
- Tracks variety of statistical types

### 3. Quotation Score (0-100)
- Identifies expert quotes with attribution
- Assesses authority of quoted sources
- Higher scores for properly attributed quotes

### 4. Fluency Score (0-100)
- Calculates readability (Flesch-Kincaid)
- Analyzes content structure (headings, lists)
- Checks AI-friendly formatting

### 5. Authority Score (0-100)
- Verifies HTTPS, about/contact pages
- Checks for author information and schema markup
- Analyzes external links to authoritative sources

### 6. Relevance Score (0-100)
- Keyword matching with position weighting
- Semantic analysis and topical coverage
- Context alignment with search intent

## 🧪 Testing

Run the test suite:

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📈 Monitoring

### Metrics (Prometheus)
- Available at `http://localhost:9091/metrics`
- Tracks crawl performance, error rates, and resource usage

### Dashboards (Grafana)
- Access at `http://localhost:3003`
- Default credentials: admin/admin
- Pre-configured dashboards for crawler metrics

### Logs
- Structured JSON logging with Winston
- Log files in `./logs/` directory
- Real-time log streaming via Docker

## 🚀 Deployment

### Using Docker

```bash
# Build image
docker build -t rankmybrand/web-crawler .

# Run container
docker run -d \
  -p 3002:3002 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  rankmybrand/web-crawler
```

### Using Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-crawler
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-crawler
  template:
    metadata:
      labels:
        app: web-crawler
    spec:
      containers:
      - name: web-crawler
        image: rankmybrand/web-crawler:latest
        ports:
        - containerPort: 3002
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

## 🔒 Security

- Rate limiting enabled by default
- API key authentication available
- Input validation with Zod schemas
- SQL injection protection
- XSS prevention with Helmet

## 🐛 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check DATABASE_URL is correct
   - Ensure PostgreSQL is running
   - Verify network connectivity

2. **High memory usage**
   - Reduce MAX_BROWSER_CONTEXTS
   - Lower MAX_CONCURRENT_CRAWLS
   - Check for memory leaks

3. **Slow crawling**
   - Increase RATE_LIMIT_PER_SECOND (carefully)
   - Check network latency
   - Monitor CPU usage

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm run dev
```

## 📚 API Documentation

Full API documentation available at:
- Swagger UI: `http://localhost:3002/docs`
- OpenAPI spec: `http://localhost:3002/docs/json`

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is part of RankMyBrand.ai and is proprietary software.

## 🆘 Support

- Email: support@rankmybrand.ai
- Documentation: https://docs.rankmybrand.ai
- Issues: GitHub Issues

---

Built with ❤️ by RankMyBrand.ai Team
