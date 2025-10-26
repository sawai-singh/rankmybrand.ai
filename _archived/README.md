# Archived Services

This directory contains services that were part of RankMyBrand but are no longer actively used or maintained.

## Archival Policy

Services are archived when:
- No active code dependencies exist
- Functionality has been replaced by other services
- The service was experimental and never reached production use

## Archived Services

### web-crawler-legacy (Archived: December 2024)

**Original Purpose:** Traditional search engine (Google, Bing) visibility analysis using SerpAPI

**Why Archived:**
- Completely unused in production codebase
- All frontend/backend references were commented out or never called
- Functionality superseded by Intelligence Engine's AI model response analysis
- No active code dependencies found across api-gateway, frontend, or intelligence-engine

**Key Features (Historical):**
- Query generation for SEO analysis
- SERP position tracking
- Brand authority scoring
- Competitor analysis for traditional search

**Replaced By:**
Intelligence Engine (`services/intelligence-engine`) now handles ALL visibility analysis:
- AI model response analysis (ChatGPT, Claude, Perplexity, Gemini)
- Intelligent query generation with buyer journey categories
- GEO (Generative Engine Optimization) scoring
- Share of Voice analysis in AI responses

**Migration Notes:**
- No migration needed - service was never actively used
- Docker-compose entry removed
- Startup/shutdown scripts updated
- Prometheus monitoring removed
- Frontend API client methods removed (dashboard + frontend)

**For Future Reference:**
If traditional SEO search analysis is needed:
- Consider integrating SerpAPI directly into Intelligence Engine
- Reuse query generation patterns from `web-crawler-legacy/src/search-intelligence/core/query-generator.ts`
- Don't resurrect this entire service - extract specific components instead

---

## Restoring Archived Services

If you need to restore an archived service:

1. Review the "Why Archived" section to understand context
2. Evaluate if the functionality is truly needed or if current services can be extended
3. Check for deprecated dependencies and update before restoration
4. Update all references in docker-compose, scripts, and code
5. Document the restoration decision and update this README

---

**Last Updated:** December 2024
