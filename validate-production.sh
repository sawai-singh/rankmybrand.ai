#!/bin/bash

# Production Validation Script
# Validates that all production requirements are met

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔍 RankMyBrand.ai Production Validation${NC}"
echo -e "${GREEN}========================================${NC}"

ISSUES=0
WARNINGS=0

# Function to check and report
check() {
    local description=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${description}${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description}${NC}"
        ISSUES=$((ISSUES + 1))
        return 1
    fi
}

# Function to warn
warn() {
    local description=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${description}${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  ${description}${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

echo -e "${YELLOW}Checking Type Safety...${NC}"
# Check for any types in TypeScript files
if grep -r "any" services/*/src --include="*.ts" --exclude-dir=node_modules | grep -v "// @ts-ignore" | grep -v "eslint-disable" > /dev/null; then
    echo -e "${YELLOW}⚠️  Found 'any' types in TypeScript files${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ No 'any' types found${NC}"
fi

echo ""
echo -e "${YELLOW}Checking Mock Data...${NC}"
# Check for mock implementations
if grep -r "mock" services/*/src --include="*.ts" --exclude-dir=node_modules --exclude-dir=__tests__ | grep -v "// Mock" > /dev/null; then
    echo -e "${YELLOW}⚠️  Found potential mock data${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ No mock data found${NC}"
fi

echo ""
echo -e "${YELLOW}Checking Environment Files...${NC}"
check "API Gateway .env.production exists" "test -f services/api-gateway/.env.production"
check "Action Center .env.production exists" "test -f services/action-center/.env.production"
check "Intelligence Engine .env.production exists" "test -f services/intelligence-engine/.env.production"

echo ""
echo -e "${YELLOW}Checking Docker Configuration...${NC}"
check "Docker Compose production file exists" "test -f docker-compose.production.yml"
check "API Gateway Dockerfile exists" "test -f services/api-gateway/Dockerfile"
check "WebSocket Server Dockerfile exists" "test -f services/websocket-server/Dockerfile"
check "Intelligence Engine Dockerfile exists" "test -f services/intelligence-engine/Dockerfile"

echo ""
echo -e "${YELLOW}Checking Monitoring Configuration...${NC}"
check "Prometheus config exists" "test -f monitoring/prometheus.yml"
check "Alert rules exist" "test -f monitoring/alerts.yml"

echo ""
echo -e "${YELLOW}Checking Secrets...${NC}"
# Check for default secrets
if grep -r "change-me" services/*/.env.production 2>/dev/null | grep -v "#"; then
    echo -e "${RED}❌ Found default secrets in production env files${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ No default secrets found${NC}"
fi

echo ""
echo -e "${YELLOW}Checking Service Health...${NC}"
warn "API Gateway responding" "curl -f http://localhost:4000/health"
warn "Frontend responding" "curl -f http://localhost:3003"

echo ""
echo -e "${YELLOW}Checking Dependencies...${NC}"
check "Docker installed" "command -v docker"
check "Docker Compose installed" "command -v docker-compose"
check "Node.js installed" "command -v node"
check "Python installed" "command -v python3"

echo ""
echo -e "${YELLOW}Checking Database...${NC}"
warn "PostgreSQL accessible" "pg_isready -h localhost -p 5432"
warn "Redis accessible" "redis-cli ping"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}VALIDATION SUMMARY${NC}"
echo -e "${GREEN}========================================${NC}"

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo -e "${GREEN}System is ready for production deployment.${NC}"
    exit 0
elif [ $ISSUES -eq 0 ]; then
    echo -e "${YELLOW}✅ No critical issues found${NC}"
    echo -e "${YELLOW}⚠️  ${WARNINGS} warnings to review${NC}"
    echo -e "${YELLOW}System can be deployed with caution.${NC}"
    exit 0
else
    echo -e "${RED}❌ ${ISSUES} critical issues found${NC}"
    echo -e "${YELLOW}⚠️  ${WARNINGS} warnings${NC}"
    echo -e "${RED}Please fix critical issues before deployment.${NC}"
    exit 1
fi