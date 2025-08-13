# Action Center Module

AI-powered recommendation engine that generates and executes content optimizations based on GEO metrics.

## Features

- **AI-Powered Recommendations**: Uses GPT-4 and Claude 3 to generate actionable content recommendations
- **Auto-Execution Engine**: Automatically publishes content to WordPress, Webflow, and GitHub
- **Approval Workflows**: Built-in approval system for manual review
- **Rollback Capabilities**: Safe execution with full rollback support
- **Real-time Processing**: Consumes metrics from Intelligence Engine via Redis Streams
- **Multi-Platform Support**: Integrations with major CMS platforms
- **Comprehensive API**: RESTful API for managing recommendations and executions

## Architecture

```
Input Stream (metrics.calculated)
    ↓
Action Processor
    ↓
Recommendation Generator (AI)
    ↓
Approval Workflow
    ↓
Auto-Execution Engine
    ↓
CMS Platforms (WordPress/Webflow/GitHub)
```

## Technology Stack

- **Runtime**: Node.js 20.11 with TypeScript
- **Framework**: Express.js for API
- **Database**: PostgreSQL with TimescaleDB
- **Queue**: BullMQ with Redis
- **AI Models**: OpenAI GPT-4, Anthropic Claude 3
- **Monitoring**: Prometheus metrics

## Installation

### Prerequisites

- Node.js 20.11+
- PostgreSQL 15+
- Redis 7+
- API keys for OpenAI/Anthropic
- CMS credentials (WordPress/Webflow/GitHub)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Build TypeScript:
```bash
npm run build
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the service:
```bash
npm start
```

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f action-center

# Stop services
docker-compose down
```

## API Documentation

### Base URL
```
http://localhost:8082/api
```

### Endpoints

#### Recommendations

- `GET /recommendations` - List all recommendations
- `GET /recommendations/:id` - Get single recommendation
- `POST /recommendations` - Create manual recommendation
- `PATCH /recommendations/:id` - Update recommendation
- `DELETE /recommendations/:id` - Delete recommendation
- `POST /recommendations/:id/execute` - Execute recommendation

#### Approvals

- `GET /approvals/pending` - Get pending approvals
- `POST /approvals/:id/approve` - Approve recommendation
- `POST /approvals/:id/reject` - Reject recommendation
- `GET /approvals/history` - Get approval history

#### Executions

- `GET /executions` - List all executions
- `GET /executions/:id` - Get execution details
- `GET /executions/stats/summary` - Get execution statistics

#### Brands

- `GET /brands` - List all brands
- `GET /brands/:id` - Get brand details
- `POST /brands` - Create brand
- `PATCH /brands/:id` - Update brand
- `DELETE /brands/:id` - Delete brand

#### Health & Metrics

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health status
- `GET /metrics` - Prometheus metrics
- `GET /metrics/json` - JSON metrics

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `API_PORT` | API server port | 8082 |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `ANTHROPIC_API_KEY` | Anthropic API key | Optional |
| `AUTO_EXECUTION_ENABLED` | Enable auto-execution | false |
| `DRAFT_MODE_ONLY` | Publish as drafts only | true |

### CMS Integrations

#### WordPress
```env
WORDPRESS_URL=https://your-site.com
WORDPRESS_USER=admin
WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

#### Webflow
```env
WEBFLOW_API_KEY=your-api-key
WEBFLOW_SITE_ID=your-site-id
```

#### GitHub
```env
GITHUB_TOKEN=ghp_xxxxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

## Recommendation Types

- **content.blog** - Blog post creation
- **content.update** - Content updates
- **content.faq** - FAQ additions
- **technical.seo** - SEO optimizations
- **technical.schema** - Schema markup
- **social.response** - Social media responses

## Processing Flow

1. **Metrics Reception**: Receives GEO metrics from Intelligence Engine
2. **Gap Analysis**: Identifies content gaps and opportunities
3. **AI Generation**: Creates recommendations using AI models
4. **Priority Scoring**: Calculates priority based on impact
5. **Approval Queue**: Routes for human approval if needed
6. **Auto-Execution**: Publishes approved content to CMS
7. **Monitoring**: Tracks success and rollback if needed

## Security

- JWT authentication for API (when enabled)
- Rate limiting on all endpoints
- Input validation and sanitization
- Secure credential storage
- Draft mode by default
- Rollback capabilities

## Monitoring

### Prometheus Metrics

- `action_center_recommendations_generated_total`
- `action_center_executions_total`
- `action_center_processing_duration_seconds`
- `action_center_errors_total`
- `action_center_ai_tokens_used_total`

### Health Checks

- Database connectivity
- Redis connectivity
- Memory usage
- Queue status

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check PostgreSQL is running
   - Verify DATABASE_URL is correct

2. **Redis connection failed**
   - Ensure Redis is running
   - Check REDIS_HOST and REDIS_PORT

3. **AI API errors**
   - Verify API keys are valid
   - Check rate limits

4. **CMS integration failures**
   - Validate credentials
   - Check API endpoints
   - Verify permissions

## Performance

- Processes 50+ recommendations per minute
- Average execution time: <2 seconds
- Concurrent execution: 5 recommendations
- Memory usage: <512MB
- CPU usage: <0.5 cores

## License

Proprietary - RankMyBrand.ai