# Architecture Decision Records (ADRs)

## Overview
This document records all major architectural decisions for the RankMyBrand.ai platform. Each decision includes context, the decision made, and the trade-offs accepted.

---

## ADR-001: Redis Streams over Apache Kafka
**Date**: December 2024  
**Status**: Accepted

### Context
We need a reliable message queue system for event-driven architecture. Options considered:
- Apache Kafka: Industry standard, highly scalable
- RabbitMQ: Popular, feature-rich
- Redis Streams: Lightweight, already in our stack

### Decision
Use **Redis Streams** with BullMQ for job processing.

### Rationale
- **Cost**: $0 (using existing Redis) vs $500+/month for managed Kafka
- **Simplicity**: Single technology for cache, queues, and streams
- **Performance**: 50K messages/sec is sufficient for our scale
- **Operations**: No additional infrastructure to manage

### Trade-offs
- **Accepted**: Less throughput than Kafka at massive scale
- **Accepted**: Fewer ecosystem tools
- **Mitigated**: Can migrate to Kafka when we exceed 10K users

---

## ADR-002: Docker Swarm over Kubernetes
**Date**: December 2024  
**Status**: Accepted

### Context
Need container orchestration for microservices. Options:
- Kubernetes: Industry standard, complex
- Docker Swarm: Simpler, built into Docker
- Docker Compose: Too basic for production

### Decision
Use **Docker Swarm** for container orchestration.

### Rationale
- **Simplicity**: 10x simpler than Kubernetes
- **Built-in**: No additional installation
- **Sufficient**: Handles up to 100 nodes
- **Learning curve**: Team can be productive immediately

### Trade-offs
- **Accepted**: Smaller ecosystem than K8s
- **Accepted**: Less advanced features
- **Mitigated**: Can migrate to K8s when needed

---

## ADR-003: Caddy over Nginx/Kong
**Date**: December 2024  
**Status**: Accepted

### Context
Need API gateway with HTTPS, rate limiting, and routing. Options:
- Nginx: Powerful but complex configuration
- Kong: Feature-rich but expensive
- Caddy: Modern, automatic HTTPS

### Decision
Use **Caddy 2.7.6** as our API gateway.

### Rationale
- **Automatic HTTPS**: Let's Encrypt certificates handled automatically
- **Simple config**: 10 lines vs 100 for Nginx
- **Single binary**: No dependencies
- **Modern**: Built-in JSON config, API

### Trade-offs
- **Accepted**: Fewer plugins than Kong
- **Accepted**: Less battle-tested than Nginx
- **Mitigated**: Covers all our current needs

---

## ADR-004: PostgreSQL with TimescaleDB over Multiple Databases
**Date**: December 2024  
**Status**: Accepted

### Context
Need reliable data storage with time-series capability. Options:
- PostgreSQL + InfluxDB: Separate databases
- PostgreSQL + TimescaleDB: Single database
- MongoDB: NoSQL option

### Decision
Use **PostgreSQL 16.1 with TimescaleDB extension**.

### Rationale
- **Single database**: Simpler operations
- **Time-series**: Built-in with hypertables
- **Proven**: PostgreSQL reliability
- **Cost**: One database to backup/maintain

### Trade-offs
- **Accepted**: Single point of failure
- **Mitigated**: Regular backups, can add read replicas

---

## ADR-005: Self-hosted Monitoring over Paid Services
**Date**: December 2024  
**Status**: Accepted

### Context
Need comprehensive monitoring. Options:
- DataDog: $70+/month
- New Relic: $100+/month
- Grafana Stack: Self-hosted, free

### Decision
Use **Prometheus + Grafana + Loki** (self-hosted).

### Rationale
- **Cost**: $0 vs $70-100+/month
- **Control**: Own our data
- **Sufficient**: Covers all monitoring needs
- **Learning**: Industry-standard tools

### Trade-offs
- **Accepted**: Must maintain ourselves
- **Accepted**: No support team
- **Mitigated**: Well-documented, huge community

---

## ADR-006: Monorepo Structure
**Date**: December 2024  
**Status**: Accepted

### Context
How to organize code for multiple services. Options:
- Monorepo: All services in one repository
- Polyrepo: Separate repository per service
- Hybrid: Core in monorepo, plugins separate

### Decision
Use **Monorepo** structure.

### Rationale
- **Simplicity**: Single repo to clone/manage
- **Atomic commits**: Cross-service changes in one commit
- **Shared code**: Easy to share utilities
- **Tooling**: Single CI/CD pipeline

### Trade-offs
- **Accepted**: Larger repository size
- **Accepted**: Need good folder structure
- **Mitigated**: Use sparse checkouts if needed

---

## ADR-007: Node.js + TypeScript for Primary Backend
**Date**: December 2024  
**Status**: Accepted

### Context
Primary backend language choice. Options:
- Python: Good for AI/ML
- Go: High performance
- Node.js + TypeScript: Full-stack JavaScript

### Decision
Use **Node.js 20.11.0 with TypeScript** for most services.

### Rationale
- **Team expertise**: JavaScript everywhere
- **Ecosystem**: Massive npm repository
- **Type safety**: TypeScript prevents bugs
- **Performance**: Good enough with V8

### Trade-offs
- **Accepted**: Not as fast as Go
- **Accepted**: Not as good for ML as Python
- **Mitigated**: Use Python for ML-specific services

---

## ADR-008: BullMQ for Job Processing
**Date**: December 2024  
**Status**: Accepted

### Context
Need reliable background job processing. Options:
- Celery: Python-based
- Sidekiq: Ruby-based
- BullMQ: Node.js-based

### Decision
Use **BullMQ** for job queues.

### Rationale
- **Integration**: Works with Redis
- **Features**: Priorities, retries, rate limiting
- **Dashboard**: Built-in UI for monitoring
- **Language**: Same as our backend (Node.js)

### Trade-offs
- **Accepted**: Less mature than Celery
- **Mitigated**: Very active development, good community

---

## ADR-009: ChromaDB for Vector Storage
**Date**: December 2024  
**Status**: Accepted

### Context
Need vector database for semantic search. Options:
- Pinecone: Managed, expensive
- Weaviate: Self-hosted, complex
- ChromaDB: Self-hosted, simple

### Decision
Use **ChromaDB** for vector storage.

### Rationale
- **Cost**: Free self-hosted
- **Simplicity**: Easy to set up
- **Performance**: Good enough for our scale
- **Python/JS**: Has both clients

### Trade-offs
- **Accepted**: Less features than Pinecone
- **Accepted**: Newer, less proven
- **Mitigated**: Can migrate if needed

---

## ADR-010: Event-Driven Architecture
**Date**: December 2024  
**Status**: Accepted

### Context
Communication pattern between services. Options:
- Synchronous REST: Simple but coupling
- Event-driven: Async, loose coupling
- GraphQL: Flexible but complex

### Decision
Use **Event-driven architecture** with Redis Streams.

### Rationale
- **Decoupling**: Services independent
- **Scalability**: Async processing
- **Resilience**: Services can fail independently
- **Real-time**: Enables live updates

### Trade-offs
- **Accepted**: More complex than REST
- **Accepted**: Eventual consistency
- **Mitigated**: Use REST where sync needed

---

## ADR-011: JWT for Authentication
**Date**: December 2024  
**Status**: Accepted

### Context
Authentication method for APIs. Options:
- Sessions: Server-side state
- JWT: Stateless tokens
- OAuth: Third-party

### Decision
Use **JWT tokens** for authentication.

### Rationale
- **Stateless**: No session storage
- **Standard**: Industry standard
- **Scalable**: Works across services
- **Simple**: Easy to implement

### Trade-offs
- **Accepted**: Can't revoke immediately
- **Mitigated**: Short expiry times

---

## ADR-012: Cost-Optimized Infrastructure
**Date**: December 2024  
**Status**: Accepted

### Context
Infrastructure hosting approach. Options:
- AWS/GCP: Managed but expensive
- VPS: Simple, cheap
- Hybrid: VPS + selective cloud

### Decision
Start with **single VPS**, use cloud services selectively.

### Rationale
- **Cost**: $20-40/month vs $500+
- **Simplicity**: Everything in one place
- **Control**: Full access
- **Migration path**: Can move to cloud later

### Trade-offs
- **Accepted**: Single point of failure
- **Accepted**: Manual scaling
- **Mitigated**: Good backups, can scale when needed

---

## ADR-013: No Mocking Policy
**Date**: December 2024  
**Status**: Accepted

### Context
Development approach for integrations. Options:
- Mock external services
- Use real services always
- Hybrid approach

### Decision
**No mocking** - use real services from day 1.

### Rationale
- **Reality**: Find issues early
- **Trust**: Real data = real confidence
- **Integration**: Ensures everything works
- **Production-ready**: No surprises in production

### Trade-offs
- **Accepted**: Slower initial development
- **Accepted**: Need real accounts/APIs
- **Mitigated**: Better quality, fewer bugs

---

## ADR-014: Lean MVP Approach
**Date**: December 2024  
**Status**: Accepted

### Context
How to approach feature development. Options:
- Full features upfront
- Iterative MVP approach
- Feature flags

### Decision
Build **complete but lean** features.

### Rationale
- **Working software**: Everything works from day 1
- **No technical debt**: No "we'll fix it later"
- **Cost-conscious**: Only essential features
- **Quality**: Production-ready always

### Trade-offs
- **Accepted**: Fewer features initially
- **Mitigated**: Can add features based on user feedback

---

## ADR-015: Browser Automation Strategy
**Date**: December 2024  
**Status**: Proposed

### Context
How to scrape AI platforms. Options:
- Playwright: Modern, all browsers
- Puppeteer: Chrome-focused
- Selenium: Older, more complex

### Decision
Use **Playwright** for browser automation.

### Rationale
- **Modern**: Best current option
- **Multi-browser**: Chrome, Firefox, Safari
- **Features**: Built-in wait strategies
- **Maintenance**: Microsoft backing

### Trade-offs
- **Accepted**: Larger size than Puppeteer
- **Mitigated**: Features worth the size

---

## Future Decisions to Make

1. **Scaling Strategy**: When to move from VPS to cloud
2. **Multi-tenancy**: How to isolate customer data
3. **Billing System**: Stripe vs Paddle vs LemonSqueezy
4. **AI Model Hosting**: Self-hosted vs API calls
5. **Backup Strategy**: Frequency and storage location

---

## Decision Template

```markdown
## ADR-XXX: [Decision Title]
**Date**: [Date]  
**Status**: [Proposed|Accepted|Deprecated|Superseded]

### Context
[What is the issue that we're seeing that is motivating this decision?]

### Decision
[What is the change that we're proposing and/or doing?]

### Rationale
[Why this decision? List key reasons.]

### Trade-offs
[What are we giving up? What are we gaining?]
```

---

## Review Schedule
- Review quarterly
- Update when major decisions made
- Deprecate outdated decisions
- Document lessons learned