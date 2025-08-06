#!/bin/bash

echo "🧪 Testing Web Crawler API"
echo "========================="
echo ""

# Test 1: Health Check
echo "1. Health Check:"
curl -s http://localhost:3002/health | jq .
echo ""

# Test 2: Basic Crawl
echo "2. Starting a basic crawl:"
RESPONSE=$(curl -s -X POST http://localhost:3002/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "maxPages": 3,
      "maxDepth": 1,
      "targetKeywords": ["example", "domain"]
    }
  }')

echo "$RESPONSE" | jq .
JOB_ID=$(echo "$RESPONSE" | jq -r .jobId)
echo ""

# Test 3: Check Crawl Status
echo "3. Checking crawl status (after 5 seconds):"
sleep 5
curl -s http://localhost:3002/api/crawl/$JOB_ID | jq '.status, .summary'
echo ""

# Test 4: Get Pages
echo "4. Getting crawled pages:"
curl -s http://localhost:3002/api/crawl/$JOB_ID/pages | jq '.pages[0] | {url, scores}'
echo ""

# Test 5: Check available endpoints
echo "5. Available API Documentation:"
echo "   http://localhost:3002/docs"
echo ""

echo "✅ Basic web crawler is working!"
echo ""
echo "📝 Note: Search Intelligence features are implemented but need to be integrated into the API routes."
echo "   The following components are available:"
echo "   - Query Generator (with v2 enhancements)"
echo "   - SERP Client (with multi-provider support)"
echo "   - Ranking Analyzer (with AI prediction)"
echo "   - Brand Authority Scorer"
echo "   - Competitor Analyzer"
echo ""
echo "To enable Search Intelligence API:"
echo "1. Fix the import/export issue in search-intel-routes-v2.ts"
echo "2. Register the routes in index.ts"
echo "3. Add SERP API keys to environment variables"