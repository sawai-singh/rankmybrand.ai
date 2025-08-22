#!/bin/bash

# Production Readiness Test Script
# Tests all critical components for production deployment

echo "🚀 RankMyBrand.ai Production Readiness Test"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
WARNINGS=0

# Test function
test_component() {
    local name=$1
    local command=$2
    local expected=$3
    
    echo -n "Testing $name... "
    
    result=$(eval $command 2>&1)
    
    if [[ $result == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((FAILED++))
        return 1
    fi
}

# Warning function
check_warning() {
    local name=$1
    local command=$2
    
    echo -n "Checking $name... "
    
    if eval $command > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ WARNING${NC}"
        ((WARNINGS++))
    fi
}

echo "1. INFRASTRUCTURE CHECKS"
echo "------------------------"

# PostgreSQL
test_component "PostgreSQL Connection" \
    "psql -h localhost -U sawai -d rankmybrand -c 'SELECT 1;' 2>&1 | grep -c '1 row'" \
    "1"

# Redis
test_component "Redis Connection" \
    "redis-cli ping" \
    "PONG"

# Check Redis authentication
check_warning "Redis Authentication" \
    "redis-cli AUTH yourpassword 2>&1 | grep -v 'ERR'"

echo ""
echo "2. SERVICE HEALTH CHECKS"
echo "------------------------"

# API Gateway
test_component "API Gateway (4000)" \
    "curl -s http://localhost:4000/health | jq -r .status" \
    "healthy"

# WebSocket Server
check_warning "WebSocket Server (8001)" \
    "lsof -i :8001 | grep LISTEN"

# Intelligence Engine
check_warning "Intelligence Engine (8002)" \
    "curl -s http://localhost:8002/health | grep -c ok"

# Dashboard
check_warning "Dashboard (3000)" \
    "curl -s http://localhost:3000 | grep -c 'RankMyBrand'"

echo ""
echo "3. DATABASE SCHEMA CHECKS"
echo "-------------------------"

# Check critical tables
test_component "Companies Table" \
    "psql -h localhost -U sawai -d rankmybrand -c '\dt companies' 2>&1 | grep -c companies" \
    "1"

test_component "AI Visibility Reports" \
    "psql -h localhost -U sawai -d rankmybrand -c '\dt ai_visibility_reports' 2>&1 | grep -c ai_visibility_reports" \
    "1"

test_component "Score Breakdown Table" \
    "psql -h localhost -U sawai -d rankmybrand -c '\dt score_breakdown' 2>&1 | grep -c score_breakdown" \
    "1"

test_component "Materialized Views" \
    "psql -h localhost -U sawai -d rankmybrand -c '\dm dashboard_metrics_cache' 2>&1 | grep -c dashboard_metrics_cache" \
    "1"

echo ""
echo "4. API ENDPOINT TESTS"
echo "---------------------"

# Test key endpoints
test_component "Onboarding Endpoint" \
    "curl -s -X POST http://localhost:4000/api/onboarding/validate-email -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\"}' | grep -c 'valid'" \
    "1"

check_warning "Metrics Endpoint" \
    "curl -s http://localhost:4000/api/metrics/current?email=test@example.com | jq -r .visibility"

check_warning "Cache Stats Endpoint" \
    "curl -s http://localhost:4000/api/cache/stats | jq -r .overallHitRate"

check_warning "Webhook Test Endpoint" \
    "curl -s -X POST http://localhost:4000/api/webhooks/test -H 'Content-Type: application/json' -d '{\"url\":\"http://localhost:9999\"}'"

echo ""
echo "5. PERFORMANCE CHECKS"
echo "---------------------"

# Check response times
echo -n "API Response Time... "
response_time=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:4000/health)
if (( $(echo "$response_time < 0.5" | bc -l) )); then
    echo -e "${GREEN}✓ ${response_time}s${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ ${response_time}s (>500ms)${NC}"
    ((WARNINGS++))
fi

# Check cache performance
echo -n "Cache Hit Rate... "
cache_stats=$(curl -s http://localhost:4000/api/cache/stats 2>/dev/null)
if [ ! -z "$cache_stats" ]; then
    hit_rate=$(echo $cache_stats | jq -r .overallHitRate | sed 's/%//')
    if [ ! -z "$hit_rate" ] && [ "$hit_rate" != "null" ]; then
        echo -e "${GREEN}✓ ${hit_rate}%${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ No data${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠ Cache service not responding${NC}"
    ((WARNINGS++))
fi

echo ""
echo "6. SECURITY CHECKS"
echo "------------------"

# Check for exposed secrets
echo -n "Checking for exposed secrets... "
if grep -r "sk-[a-zA-Z0-9]{20,}" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=venv --exclude-dir=archived-services . 2>/dev/null | grep -v "process.env"; then
    echo -e "${RED}✗ Found exposed API keys${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}✓ No exposed secrets${NC}"
    ((PASSED++))
fi

# Check CORS configuration
check_warning "CORS Configuration" \
    "grep 'CORS_ORIGIN' api-gateway/.env"

echo ""
echo "7. MONITORING CHECKS"
echo "--------------------"

# Prometheus
check_warning "Prometheus (9090)" \
    "curl -s http://localhost:9090/-/healthy"

# Grafana
check_warning "Grafana (3001)" \
    "curl -s http://localhost:3001/api/health"

echo ""
echo "8. DATA INTEGRITY CHECKS"
echo "------------------------"

# Check for GEO/SOV scores
echo -n "GEO/SOV Score Data... "
score_count=$(psql -h localhost -U sawai -d rankmybrand -t -c "SELECT COUNT(*) FROM ai_visibility_reports WHERE geo_score IS NOT NULL;" 2>/dev/null | tr -d ' ')
if [ "$score_count" -gt "0" ]; then
    echo -e "${GREEN}✓ $score_count records${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No score data${NC}"
    ((WARNINGS++))
fi

# Check webhook configurations
echo -n "Webhook Configurations... "
webhook_count=$(psql -h localhost -U sawai -d rankmybrand -t -c "SELECT COUNT(*) FROM webhook_configs WHERE active = true;" 2>/dev/null | tr -d ' ')
if [ ! -z "$webhook_count" ] && [ "$webhook_count" != "" ]; then
    echo -e "${GREEN}✓ $webhook_count active${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No webhooks configured${NC}"
    ((WARNINGS++))
fi

echo ""
echo "9. BACKUP & RECOVERY"
echo "--------------------"

# Check if backup exists
echo -n "Database Backup... "
if ls *backup*.sql 2>/dev/null | head -1 > /dev/null; then
    echo -e "${GREEN}✓ Backup found${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No backup found${NC}"
    ((WARNINGS++))
fi

echo ""
echo "=========================================="
echo "PRODUCTION READINESS SUMMARY"
echo "=========================================="
echo ""
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo ""

# Determine overall status
if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 PRODUCTION READY!${NC}"
        echo "All checks passed. System is ready for production deployment."
        exit 0
    else
        echo -e "${YELLOW}⚠️  PRODUCTION READY WITH WARNINGS${NC}"
        echo "System can be deployed but review warnings first."
        exit 0
    fi
else
    echo -e "${RED}❌ NOT PRODUCTION READY${NC}"
    echo "Critical failures detected. Fix issues before deployment."
    exit 1
fi