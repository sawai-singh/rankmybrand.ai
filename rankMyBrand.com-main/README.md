# RankMyBrand GEO Calculator

> Enterprise-grade Generative Engine Optimization (GEO) analysis platform for maximizing content visibility in AI-powered search engines.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg)](https://fastapi.tiangolo.com)

## 🚀 Overview

RankMyBrand GEO Calculator is a sophisticated tool that analyzes and optimizes content for AI-powered search engines. Based on research from Princeton, Georgia Tech, Allen Institute for AI, and IIT Delhi, it provides actionable insights to improve your content's visibility in ChatGPT, Perplexity, Google AI Overview, and other generative AI platforms.

## ✨ Features

### Core Capabilities
- **📊 Comprehensive Metrics**: Six key metrics based on academic research
  - Statistics Density: Data-driven content analysis
  - Quotation Authority: Expert citation scoring
  - Content Fluency: AI readability optimization
  - Semantic Relevance: Query-content alignment
  - Domain Authority: Trust signal evaluation
  - AI Visibility: Real platform presence tracking

- **🤖 Multi-Platform Support**: Track visibility across major AI platforms
  - Perplexity AI (via official API)
  - Google AI Overview
  - ChatGPT (coming soon)
  - Claude (coming soon)
  - Extensible provider system for new platforms

- **⚡ Performance**
  - Sub-10 second analysis for single URLs
  - Batch processing for multiple URLs
  - Intelligent caching system
  - Concurrent processing with rate limiting

- **🏢 Enterprise Features**
  - Job queue system with multiple backends
  - Environment-based configuration
  - Feature flags for gradual rollout
  - Structured logging and monitoring
  - Horizontal scaling support

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **AI/ML**: Sentence Transformers, NumPy
- **Job Queue**: In-memory, Database, Redis (configurable)
- **Frontend**: Vanilla JavaScript, Chart.js
- **Infrastructure**: Docker, Nginx
- **Testing**: Pytest, Coverage

## 📋 Prerequisites

- Python 3.8+
- Docker (optional, for containerized deployment)
- API keys for AI platforms (optional, for visibility tracking)

## 🚀 Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/Harsh-Agarwals/rankMyBrand.com.git
cd rankMyBrand.com-main
```

2. Set up environment:
```bash
cd infrastructure/docker
cp ../../services/geo-calculator/backend/.env.example ../../services/geo-calculator/backend/.env
# Edit .env with your configuration
```

3. Start services:
```bash
docker-compose up -d
```

4. Access the application:
- 🎯 Dashboard: http://localhost:3000
- 📚 API Docs: http://localhost:8000/api/v1/docs
- 🔍 Health Check: http://localhost:8000/health

### Manual Installation

#### Backend Setup
```bash
cd services/geo-calculator/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment
export APP_ENV=development  # or staging, production

# Run the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd services/geo-calculator/frontend
# Using Python's built-in server
python -m http.server 3000

# Or using Node.js
npx serve -p 3000
```

## 📡 API Usage

### Single Content Analysis
```bash
curl -X POST http://localhost:8000/api/v1/geo/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "content": "Your article content here...",
    "brand_terms": ["YourBrand", "Product Name"],
    "target_queries": ["how to use YourBrand", "YourBrand reviews"],
    "check_ai_visibility": true
  }'
```

### Batch Analysis
```bash
# Start batch job
curl -X POST http://localhost:8000/api/v1/geo/analyze/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/page1",
      "https://example.com/page2",
      "https://example.com/page3"
    ],
    "check_ai_visibility": false
  }'

# Check job status
curl http://localhost:8000/api/v1/geo/analyze/batch/{job_id}
```

### Response Format
```json
{
  "geo_score": 75.5,
  "metrics": {
    "statistics": 82.3,
    "quotation": 71.5,
    "fluency": 78.9,
    "relevance": 85.2,
    "authority": 65.0,
    "ai_visibility": 70.0
  },
  "detailed_metrics": {
    "statistics": {
      "score": 82.3,
      "count": 12,
      "density": 2.4,
      "examples": [
        {"value": "85%", "type": "percentage"},
        {"value": "$1.2M", "type": "currency"}
      ]
    }
  },
  "recommendations": [
    {
      "priority": "high",
      "metric": "quotation",
      "action": "Add 2-3 expert quotes from authoritative sources",
      "impact": "Could improve GEO score by 15%"
    }
  ],
  "confidence": "high"
}

```

## 🧠 How It Works

The GEO Calculator implements metrics based on the Princeton research paper "GEO: Generative Engine Optimization" with practical adaptations:

1. **Statistics Density**: Analyzes data usage patterns
   - Ideal: 1 statistic per 150 words
   - Types: percentages, numbers, currency, multipliers

2. **Quotation Authority**: Evaluates expert citations
   - Attributed vs unattributed quotes
   - Authority scoring based on source credentials

3. **Content Fluency**: Optimizes for AI readability
   - Sentence variety and structure
   - Transition word usage
   - Paragraph organization

4. **Relevance Score**: Semantic similarity analysis
   - Uses sentence transformers
   - Keyword overlap calculation
   - Entity matching

5. **Authority Signal**: Domain trust evaluation
   - TLD analysis (.edu, .gov, .org)
   - Domain age and structure

6. **AI Visibility**: Real platform presence
   - API-based checking where available
   - Intelligent estimation fallbacks

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```bash
# Environment
APP_ENV=development  # development, staging, production

# API Keys (optional)
PERPLEXITY_API_KEY=your_perplexity_key
ANTHROPIC_API_KEY=your_anthropic_key

# Database
DATABASE_URL=postgresql://user:pass@localhost/geodb  # Production
# DATABASE_URL=sqlite:///./geo_metrics.db  # Development

# Redis (for production job queue)
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here
API_KEY=your-api-key  # Required in production
```

### Configuration Management

The system uses environment-based configuration:

```python
# Different settings per environment
- Development: Debug mode, mock providers, in-memory queue
- Staging: Real providers, database queue, moderate rate limits  
- Production: All providers, Redis queue, strict rate limits
```

## 🔧 Development

### Project Structure
```
rankMyBrand.com-main/
├── services/
│   └── geo-calculator/
│       ├── backend/
│       │   ├── app/
│       │   │   ├── api/          # API endpoints
│       │   │   ├── core/         # Business logic
│       │   │   ├── models/       # Data models
│       │   │   └── database/     # DB configuration
│       │   ├── tests/            # Test suite
│       │   └── requirements.txt
│       └── frontend/
│           ├── index.html
│           ├── dashboard.js
│           └── styles.css
├── infrastructure/
│   └── docker/
│       ├── docker-compose.yml
│       └── nginx.conf
├── CLAUDE.md                     # AI assistant context
└── README.md                     # This file
```

### Running Tests
```bash
cd services/geo-calculator/backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_metrics.py -v
```

### Code Quality
```bash
# Linting
ruff check .

# Type checking
mypy app/

# Format code
black app/
```

### Adding New Features

#### New AI Provider
1. Create provider class in `ai_visibility_providers.py`
2. Inherit from `AIVisibilityProvider`
3. Implement `check_visibility` method
4. Register in configuration

#### New Metric
1. Add calculator to `metrics.py`
2. Update weights in `config_manager.py`
3. Add to composite score
4. Update frontend display

## 🔌 Integration

### JavaScript SDK
```javascript
import { RankMyBrandGEO } from './rankmybrand-geo-sdk.js';

const geo = new RankMyBrandGEO({
  apiUrl: 'https://api.rankmybrand.ai',
  apiKey: 'your-api-key'
});

const result = await geo.analyze({
  url: 'https://example.com',
  content: 'Your content...',
  brandTerms: ['YourBrand'],
  checkAIVisibility: true
});
```

### Python Client
```python
from rankmybrand import GEOClient

client = GEOClient(api_key='your-api-key')
result = client.analyze(
    url='https://example.com',
    content='Your content...',
    brand_terms=['YourBrand']
)
print(f"GEO Score: {result.geo_score}")
```

### REST API
All endpoints accept JSON and return JSON responses. See API documentation at `/api/v1/docs` when running.

## 🚀 Production Deployment

### Using Kubernetes
```yaml
# Example deployment configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: geo-calculator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: geo-calculator
  template:
    metadata:
      labels:
        app: geo-calculator
    spec:
      containers:
      - name: backend
        image: rankmybrand/geo-calculator:latest
        env:
        - name: APP_ENV
          value: "production"
```

### Performance Optimization
1. **Caching**: Redis with appropriate TTLs
2. **Database**: PostgreSQL with connection pooling
3. **Job Queue**: Redis-based for scalability
4. **CDN**: CloudFront or Cloudflare for assets

### Monitoring
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack or CloudWatch
- **APM**: New Relic or DataDog
- **Uptime**: Pingdom or UptimeRobot

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

This project is based on cutting-edge research:

- **Paper**: ["GEO: Generative Engine Optimization"](https://arxiv.org/abs/2311.09735) (Aggarwal et al., 2024)
- **Institutions**: Princeton University, Georgia Tech, Allen Institute for AI, IIT Delhi

Special thanks to the researchers for their groundbreaking work in understanding how generative AI systems rank and present information.

## 📞 Support

- **Documentation**: [https://docs.rankmybrand.ai](https://docs.rankmybrand.ai)
- **GitHub Issues**: [https://github.com/Harsh-Agarwals/rankMyBrand.com/issues](https://github.com/Harsh-Agarwals/rankMyBrand.com/issues)
- **Email**: support@rankmybrand.ai
- **Discord**: [Join our community](https://discord.gg/rankmybrand)

---

<p align="center">Built with ❤️ by the RankMyBrand Team</p>
