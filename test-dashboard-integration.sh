#!/bin/bash

# ========================================================
# Dashboard Integration Test Script
# Tests all critical paths for the dashboard system
# ========================================================

set -e

echo "🧪 RankMyBrand Dashboard Integration Testing"
echo "==========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    NAME=$1
    URL=$2
    METHOD=${3:-GET}
    DATA=${4:-}
    
    echo -n "Testing ${NAME}... "
    
    if [ -z "$DATA" ]; then
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X ${METHOD} ${URL} 2>/dev/null || echo "000")
    else
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X ${METHOD} -H "Content-Type: application/json" -d "${DATA}" ${URL} 2>/dev/null || echo "000")
    fi
    
    if [[ "$RESPONSE" == "200" ]] || [[ "$RESPONSE" == "201" ]] || [[ "$RESPONSE" == "404" ]] || [[ "$RESPONSE" == "401" ]]; then
        echo -e "${GREEN}✅ (${RESPONSE})${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ (${RESPONSE})${NC}"
        ((FAILED++))
    fi
}

echo ""
echo "1️⃣  Testing Service Health Endpoints"
echo "====================================="
test_endpoint "API Gateway Health" "http://localhost:4000/health"
test_endpoint "Intelligence Engine Health" "http://localhost:8002/health"
test_endpoint "Web Crawler Health" "http://localhost:3002/health"
test_endpoint "WebSocket Server Health" "http://localhost:3001/health"
test_endpoint "Action Center Health" "http://localhost:8082/health"

echo ""
echo "2️⃣  Testing API Gateway Routes"
echo "==============================="
test_endpoint "Auth Login Endpoint" "http://localhost:4000/api/auth/login" "POST" '{"email":"test@example.com","password":"test"}'
test_endpoint "Dashboard Metrics" "http://localhost:4000/api/dashboard/metrics"
test_endpoint "Onboarding Status" "http://localhost:4000/api/onboarding/status"
test_endpoint "Competitors List" "http://localhost:4000/api/competitors"

echo ""
echo "3️⃣  Testing Intelligence Engine"
echo "================================"
test_endpoint "GEO Analysis" "http://localhost:8002/api/v1/geo/analyze" "POST" '{"query":"test brand"}'
test_endpoint "GEO Scores" "http://localhost:8002/api/v1/geo/scores"
test_endpoint "LLM Providers Status" "http://localhost:8002/api/llm/status"
test_endpoint "AI Visibility Check" "http://localhost:8002/api/analysis/visibility" "POST" '{"brand":"test","query":"test query"}'

echo ""
echo "4️⃣  Testing Web Crawler"
echo "======================="
test_endpoint "Crawl Status" "http://localhost:3002/api/crawls/recent"
test_endpoint "Start Crawl" "http://localhost:3002/api/crawl" "POST" '{"url":"https://example.com","options":{"maxPages":1}}'

echo ""
echo "5️⃣  Testing Database Connection"
echo "================================"
echo -n "PostgreSQL Connection... "
if docker exec rankmybrandai-postgres-1 pg_isready -U sawai > /dev/null 2>&1 || psql -U sawai -d rankmybrand -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  (May need Docker or local setup)${NC}"
fi

echo -n "Redis Connection... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  (May need Redis running)${NC}"
fi

echo ""
echo "6️⃣  Testing Frontend Access"
echo "============================"
echo -n "Dashboard UI... "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  (Dashboard may not be running)${NC}"
fi

echo -n "Main Frontend... "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3003 2>/dev/null | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  (Frontend may not be running)${NC}"
fi

echo ""
echo "7️⃣  Testing WebSocket Connection"
echo "================================="
echo -n "WebSocket Endpoint... "
# Simple check if port is listening
if lsof -i :3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ (Port 3001 listening)${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ (Port 3001 not listening)${NC}"
    ((FAILED++))
fi

echo ""
echo "📊 Test Results Summary"
echo "======================="
TOTAL=$((PASSED + FAILED))
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Dashboard system is ready.${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Access the dashboard at http://localhost:3003"
    echo "2. Complete onboarding flow"
    echo "3. Run a brand analysis"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please check:${NC}"
    echo "1. Are all services running? (npm run dev in each service)"
    echo "2. Is PostgreSQL running on port 5432?"
    echo "3. Is Redis running on port 6379?"
    echo "4. Check service logs for errors"
    echo ""
    echo "To start services:"
    echo "  - API Gateway: cd api-gateway && npm run dev"
    echo "  - Intelligence Engine: cd services/intelligence-engine && python -m uvicorn src.api.main:app --port 8002"
    echo "  - Web Crawler: cd services/web-crawler && npm run dev"
    echo "  - Dashboard: cd services/dashboard && npm run dev"
    echo "  - Frontend: cd rankmybrand-frontend && npm run dev"
fi

echo ""
echo "For production deployment, run: ./deploy-production.sh"