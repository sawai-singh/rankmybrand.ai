#!/bin/bash
# Production Readiness Checklist for Intelligence Engine

set -e

echo "🚀 Intelligence Engine Production Readiness Check"
echo "================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        return 0
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

FAILURES=0

echo ""
echo "1️⃣  Environment Variables Check"
echo "--------------------------------"

# Check critical environment variables
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" == "" ]; then
    echo -e "${RED}❌ OPENAI_API_KEY not set${NC}"
    FAILURES=$((FAILURES + 1))
else
    if [ ${#OPENAI_API_KEY} -lt 20 ]; then
        echo -e "${RED}❌ OPENAI_API_KEY appears invalid (too short)${NC}"
        FAILURES=$((FAILURES + 1))
    else
        echo -e "${GREEN}✅ OPENAI_API_KEY is set${NC}"
    fi
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" == "change-me-in-production" ]; then
    echo -e "${RED}❌ JWT_SECRET not configured for production${NC}"
    FAILURES=$((FAILURES + 1))
else
    echo -e "${GREEN}✅ JWT_SECRET is configured${NC}"
fi

if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" == "postgres" ]; then
    echo -e "${RED}❌ POSTGRES_PASSWORD using default value${NC}"
    FAILURES=$((FAILURES + 1))
else
    echo -e "${GREEN}✅ POSTGRES_PASSWORD is secure${NC}"
fi

if [ -z "$REDIS_PASSWORD" ]; then
    warn "REDIS_PASSWORD not set (okay for local Redis)"
else
    echo -e "${GREEN}✅ REDIS_PASSWORD is set${NC}"
fi

if [ "$APP_ENV" != "production" ]; then
    warn "APP_ENV is not set to 'production' (currently: ${APP_ENV:-development})"
fi

echo ""
echo "2️⃣  Code Security Check"
echo "----------------------"

# Check for hardcoded UUIDs
echo -n "Checking for hardcoded UUIDs... "
HARDCODED_UUIDS=$(grep -r "00000000-0000-0000-0000-000000000000" src/ 2>/dev/null | wc -l)
if [ $HARDCODED_UUIDS -eq 0 ]; then
    echo -e "${GREEN}✅ No hardcoded UUIDs found${NC}"
else
    echo -e "${RED}❌ Found $HARDCODED_UUIDS hardcoded UUID references${NC}"
    FAILURES=$((FAILURES + 1))
fi

# Check for mock/fake implementations
echo -n "Checking for mock implementations... "
MOCK_COUNT=$(grep -ri "mock\|fake\|dummy\|TODO\|FIXME" src/ --include="*.py" 2>/dev/null | wc -l)
if [ $MOCK_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ No mock implementations found${NC}"
else
    warn "Found $MOCK_COUNT potential mock/TODO references (review manually)"
fi

echo ""
echo "3️⃣  Database Check"
echo "-----------------"

# Check if PostgreSQL is accessible
echo -n "Testing PostgreSQL connection... "
if PGPASSWORD=$POSTGRES_PASSWORD psql -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-rankmybrand} -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is accessible${NC}"
    
    # Check if schema exists
    echo -n "Checking intelligence schema... "
    SCHEMA_EXISTS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-rankmybrand} -t -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'intelligence'" 2>/dev/null | grep -c 1)
    if [ $SCHEMA_EXISTS -eq 1 ]; then
        echo -e "${GREEN}✅ Intelligence schema exists${NC}"
    else
        echo -e "${RED}❌ Intelligence schema not found${NC}"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "4️⃣  Redis Check"
echo "--------------"

# Check if Redis is accessible
echo -n "Testing Redis connection... "
if redis-cli -h ${REDIS_HOST:-localhost} ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is accessible${NC}"
else
    echo -e "${RED}❌ Cannot connect to Redis${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "5️⃣  Python Dependencies Check"
echo "----------------------------"

# Check critical Python packages
echo -n "Checking Python dependencies... "
MISSING_DEPS=0

for package in openai asyncpg redis fastapi pydantic jwt; do
    if ! python -c "import $package" 2>/dev/null; then
        echo -e "${RED}❌ Missing package: $package${NC}"
        MISSING_DEPS=$((MISSING_DEPS + 1))
    fi
done

if [ $MISSING_DEPS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical dependencies installed${NC}"
else
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "6️⃣  File Permissions Check"
echo "-------------------------"

# Check file permissions
echo -n "Checking file permissions... "
WORLD_WRITABLE=$(find src/ -type f -perm -002 2>/dev/null | wc -l)
if [ $WORLD_WRITABLE -eq 0 ]; then
    echo -e "${GREEN}✅ No world-writable files${NC}"
else
    echo -e "${RED}❌ Found $WORLD_WRITABLE world-writable files${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "7️⃣  Service Health Check"
echo "-----------------------"

# Check if service can start
echo -n "Testing service startup... "
if python -c "from src.config import settings; print('Config loaded')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Configuration loads successfully${NC}"
else
    echo -e "${RED}❌ Configuration failed to load${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "8️⃣  API Security Check"
echo "---------------------"

# Check for authentication on routes
echo -n "Checking API authentication... "
AUTH_COUNT=$(grep -r "Depends(get_current_user)" src/api/ 2>/dev/null | wc -l)
if [ $AUTH_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Found $AUTH_COUNT authenticated endpoints${NC}"
else
    echo -e "${RED}❌ No authenticated endpoints found${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "9️⃣  Rate Limiting Check"
echo "----------------------"

# Check for rate limiting
echo -n "Checking rate limiting implementation... "
if [ -f "src/utils/rate_limiter.py" ]; then
    echo -e "${GREEN}✅ Rate limiter module exists${NC}"
else
    echo -e "${RED}❌ Rate limiter module not found${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "🔟 Cost Tracking Check"
echo "---------------------"

# Check for cost tracking
echo -n "Checking cost tracking implementation... "
if [ -f "src/utils/cost_tracker.py" ]; then
    echo -e "${GREEN}✅ Cost tracker module exists${NC}"
else
    echo -e "${RED}❌ Cost tracker module not found${NC}"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "================================================"
echo "Production Readiness Summary"
echo "================================================"

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED - Ready for production!${NC}"
    exit 0
else
    echo -e "${RED}❌ FAILED $FAILURES CHECKS - Not ready for production${NC}"
    echo ""
    echo "Critical fixes needed before launch:"
    echo "1. Set all required environment variables"
    echo "2. Remove any hardcoded UUIDs"
    echo "3. Ensure database schema is created"
    echo "4. Verify all services are accessible"
    echo "5. Configure authentication properly"
    exit 1
fi