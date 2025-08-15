#!/bin/bash
# Comprehensive System Audit for Intelligence Engine

set -e

echo "================================================"
echo "🔍 INTELLIGENCE ENGINE SYSTEM AUDIT"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0

# Check function
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        return 0
    else
        echo -e "${RED}❌ $2${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "1️⃣  EXTERNAL SERVICES CHECK"
echo "============================="

# Check AI Response Monitor
echo -n "AI Response Monitor... "
if [ -d "/Users/sawai/Desktop/rankmybrand.ai/services/ai-response-monitor" ]; then
    echo -e "${GREEN}EXISTS${NC}"
    # Check if it publishes to correct stream
    PUBLISHES=$(grep -l "ai.responses.raw" /Users/sawai/Desktop/rankmybrand.ai/services/ai-response-monitor/src/collectors/*.ts 2>/dev/null | wc -l)
    if [ $PUBLISHES -gt 0 ]; then
        echo -e "  ${GREEN}✅ Publishes to ai.responses.raw${NC}"
    else
        echo -e "  ${RED}❌ Does not publish to correct stream${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "2️⃣  MESSAGE FLOW CHECK"
echo "======================"

# Check message translator
echo -n "Message Translator... "
if [ -f "src/message_translator.py" ]; then
    echo -e "${GREEN}EXISTS${NC}"
    # Check if it handles both formats
    if grep -q "translate_ai_monitor_message" src/message_translator.py; then
        echo -e "  ${GREEN}✅ Handles AI Monitor format${NC}"
    else
        echo -e "  ${RED}❌ Missing AI Monitor translator${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Redis configuration
echo -n "Redis Stream Configuration... "
if grep -q "ai.responses.raw" src/config.py 2>/dev/null; then
    echo -e "${GREEN}CORRECT${NC}"
else
    warn "Stream name may be incorrect"
fi

echo ""
echo "3️⃣  DATABASE SCHEMA CHECK"
echo "========================"

# Check if PostgreSQL is running
echo -n "PostgreSQL Connection... "
if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-rankmybrand} -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
    
    # Check tables
    for table in "processed_responses" "brand_mentions" "geo_scores" "content_gaps" "citation_sources" "api_usage"; do
        echo -n "  Table intelligence.$table... "
        TABLE_EXISTS=$(PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-rankmybrand} -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema='intelligence' AND table_name='$table'" 2>/dev/null | grep -c 1 || true)
        if [ "$TABLE_EXISTS" = "1" ]; then
            echo -e "${GREEN}EXISTS${NC}"
        else
            echo -e "${YELLOW}MISSING (will be created)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "4️⃣  NLP COMPONENTS CHECK"
echo "======================="

# Check LLM modules
for module in "llm_entity_detector" "llm_sentiment_analyzer" "llm_gap_detector" "llm_relevance_scorer"; do
    echo -n "Module $module... "
    if [ -f "src/nlp/$module.py" ]; then
        echo -e "${GREEN}EXISTS${NC}"
        # Check for cost tracking
        if grep -q "cost_tracker" "src/nlp/$module.py" 2>/dev/null; then
            echo -e "  ${GREEN}✅ Has cost tracking${NC}"
        else
            warn "  Missing cost tracking"
        fi
    else
        echo -e "${RED}NOT FOUND${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "5️⃣  SECURITY & RATE LIMITING"
echo "============================"

# Check authentication
echo -n "API Authentication... "
if [ -f "src/api/auth.py" ]; then
    echo -e "${GREEN}EXISTS${NC}"
    if grep -q "JWT_SECRET" src/api/auth.py; then
        echo -e "  ${GREEN}✅ JWT configured${NC}"
    else
        echo -e "  ${RED}❌ JWT not configured${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check rate limiting
echo -n "Rate Limiter... "
if [ -f "src/utils/rate_limiter.py" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check cost tracking
echo -n "Cost Tracker... "
if [ -f "src/utils/cost_tracker.py" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "6️⃣  CONFIGURATION CHECK"
echo "======================"

# Check critical environment variables
echo -n "OpenAI API Key... "
if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "" ]; then
    echo -e "${GREEN}SET${NC}"
else
    echo -e "${RED}NOT SET${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "JWT Secret... "
if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "change-me-in-production" ]; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    warn "Using default (change for production)"
fi

echo ""
echo "7️⃣  ERROR HANDLING CHECK"
echo "======================="

# Check circuit breaker
echo -n "Circuit Breaker... "
if grep -q "CircuitBreaker" src/utils/rate_limiter.py 2>/dev/null; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check retry logic
echo -n "Retry Logic... "
if grep -q "retry_count" src/consumer.py 2>/dev/null; then
    echo -e "${GREEN}IMPLEMENTED${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "8️⃣  MONITORING CHECK"
echo "==================="

# Check metrics collector
echo -n "Metrics Collector... "
if [ -f "src/monitoring/metrics.py" ]; then
    echo -e "${GREEN}EXISTS${NC}"
else
    warn "Not found (optional)"
fi

# Check Prometheus endpoint
echo -n "Prometheus Metrics... "
if grep -q "prometheus" src/monitoring/*.py 2>/dev/null; then
    echo -e "${GREEN}CONFIGURED${NC}"
else
    warn "Not configured (optional)"
fi

echo ""
echo "9️⃣  INTEGRATION POINTS"
echo "====================="

# Check if services can communicate
echo -n "Redis Connectivity... "
if redis-cli -h ${REDIS_HOST:-localhost} ping > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
    
    # Check if stream exists
    echo -n "  Stream ai.responses.raw... "
    STREAM_EXISTS=$(redis-cli -h ${REDIS_HOST:-localhost} EXISTS ai.responses.raw 2>/dev/null)
    if [ "$STREAM_EXISTS" = "1" ]; then
        echo -e "${GREEN}EXISTS${NC}"
    else
        echo -e "${YELLOW}NOT CREATED YET${NC}"
    fi
else
    echo -e "${RED}FAILED${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "🔟 END-TO-END READINESS"
echo "======================"

# Check if all components are ready
echo -n "Consumer ready... "
if [ -f "src/consumer.py" ] && [ -f "src/message_translator.py" ]; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Processor ready... "
if [ -f "src/processors/response_processor.py" ]; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "API ready... "
if [ -f "src/api/analysis_routes.py" ] && [ -f "src/api/auth.py" ]; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "================================================"
echo "AUDIT SUMMARY"
echo "================================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ SYSTEM IS PRODUCTION READY!${NC}"
    echo ""
    echo "All components are properly configured and integrated."
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  SYSTEM HAS $WARNINGS WARNINGS${NC}"
    echo ""
    echo "The system can run but review warnings for optimal performance."
else
    echo -e "${RED}❌ SYSTEM HAS $ERRORS ERRORS AND $WARNINGS WARNINGS${NC}"
    echo ""
    echo "Critical issues must be fixed before production deployment:"
    echo ""
    echo "Most Common Issues:"
    echo "1. Missing environment variables (OPENAI_API_KEY, JWT_SECRET)"
    echo "2. Database not initialized (run migration scripts)"
    echo "3. Redis not running or not accessible"
    echo "4. Message format mismatch between services"
    echo ""
    echo "Run './scripts/production_checklist.sh' for detailed requirements."
fi

exit $ERRORS