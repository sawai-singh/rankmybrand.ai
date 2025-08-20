#!/bin/bash

# ========================================================
# RankMyBrand.ai - Production Deployment Script
# ========================================================
# This script prepares and deploys the application for production
# ========================================================

set -e  # Exit on error

echo "🚀 RankMyBrand.ai Production Deployment Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production file not found!${NC}"
    echo "Creating from template..."
    
    if [ -f .env.production.complete ]; then
        cp .env.production.complete .env.production
        echo -e "${YELLOW}⚠️  Please edit .env.production with your actual values${NC}"
        echo "Especially update:"
        echo "  - Database passwords"
        echo "  - JWT secrets"
        echo "  - API keys"
        echo "  - Domain URLs"
        exit 1
    else
        echo -e "${RED}❌ No production template found!${NC}"
        exit 1
    fi
fi

# Source environment variables
export $(cat .env.production | grep -v '^#' | xargs)

echo "📋 Pre-deployment Checklist:"
echo "=============================="

# Check critical environment variables
check_env() {
    if [ -z "${!1}" ] || [[ "${!1}" == *"CHANGE_THIS"* ]] || [[ "${!1}" == *"YOUR_"* ]]; then
        echo -e "${RED}❌ $1 is not properly configured${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is configured${NC}"
        return 0
    fi
}

# Check critical configs
ERRORS=0
check_env "DB_PASSWORD" || ((ERRORS++))
check_env "REDIS_PASSWORD" || ((ERRORS++))
check_env "JWT_SECRET" || ((ERRORS++))
check_env "OPENAI_API_KEY" || ((ERRORS++))
check_env "PERPLEXITY_API_KEY" || ((ERRORS++))

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Please configure all required environment variables in .env.production${NC}"
    exit 1
fi

echo ""
echo "🔨 Building Services..."
echo "======================="

# Build all Docker images
docker-compose -f docker-compose.production.yml build --parallel

echo ""
echo "🗄️  Setting up Database..."
echo "========================"

# Start only the database first
docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U ${DB_USER} > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.production.yml exec -T postgres psql -U ${DB_USER} -d ${DB_NAME} < database/schema.sql || true

echo ""
echo "🚀 Starting All Services..."
echo "=========================="

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "🏥 Health Check Results:"
echo "========================"

# Check service health
check_service() {
    SERVICE=$1
    PORT=$2
    URL="http://localhost:${PORT}/health"
    
    if curl -f -s "${URL}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${SERVICE} is healthy (port ${PORT})${NC}"
    else
        echo -e "${RED}❌ ${SERVICE} is not responding (port ${PORT})${NC}"
    fi
}

check_service "API Gateway" 4000
check_service "Intelligence Engine" 8002
check_service "Web Crawler" 3002
check_service "WebSocket Server" 3001
check_service "Dashboard" 3000
check_service "Frontend" 3003
check_service "Action Center" 8082

echo ""
echo "📊 Service Status:"
echo "=================="
docker-compose -f docker-compose.production.yml ps

echo ""
echo "📝 Service Logs:"
echo "================"
echo "View logs with: docker-compose -f docker-compose.production.yml logs -f [service-name]"
echo "Services: postgres, redis, api-gateway, intelligence-engine, web-crawler, websocket-server, dashboard, frontend, action-center"

echo ""
echo "🌐 Access Points:"
echo "================="
echo "Dashboard: http://localhost:3000"
echo "Frontend: http://localhost:3003"
echo "API Gateway: http://localhost:4000"
echo "Grafana: http://localhost:3030 (admin/${GRAFANA_PASSWORD})"
echo "Prometheus: http://localhost:9090"

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Next Steps:"
echo "1. Test the dashboard at http://localhost:3003"
echo "2. Check service logs for any errors"
echo "3. Configure your domain and SSL certificates"
echo "4. Set up backup and monitoring"
echo ""
echo "To stop all services: docker-compose -f docker-compose.production.yml down"
echo "To view logs: docker-compose -f docker-compose.production.yml logs -f"