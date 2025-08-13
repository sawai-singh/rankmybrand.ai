#!/bin/bash

# RankMyBrand.ai Docker-based Launch Script
# Professional, scalable deployment with full backend integration

set -e

echo "🚀 LAUNCHING RANKMYBRAND.AI WITH DOCKER"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not running. Starting Docker...${NC}"
    open -a Docker
    echo "Waiting for Docker to start..."
    sleep 10
    
    # Wait for Docker to be ready
    counter=0
    while ! docker info &> /dev/null && [ $counter -lt 30 ]; do
        sleep 2
        counter=$((counter + 1))
    done
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker failed to start${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Copy production environment if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Setting up environment configuration...${NC}"
    cp .env.production .env
    echo -e "${GREEN}✓ Environment configured${NC}"
fi

# Build and start services
echo -e "${BLUE}🔨 Building Docker images...${NC}"
echo "This may take a few minutes on first run..."
docker-compose build --parallel

echo ""
echo -e "${BLUE}🚀 Starting all services...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 15

# Check service health
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo "=================="

check_service() {
    local name=$1
    local port=$2
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null | grep -q "200\|204"; then
        echo -e "  ${GREEN}✓${NC} $name (port $port)"
        return 0
    else
        echo -e "  ${YELLOW}⏳${NC} $name (port $port) - starting..."
        return 1
    fi
}

# Check each service
check_service "API Gateway" 4000
check_service "GEO Calculator" 8000
check_service "Intelligence Engine" 8002
check_service "Action Center" 8082
check_service "WebSocket Server" 3001
check_service "Dashboard" 3000
check_service "Frontend" 3003

echo ""
echo "========================================"
echo -e "${GREEN}🎉 PLATFORM LAUNCHED SUCCESSFULLY!${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}📍 Access Points:${NC}"
echo -e "  Main Application:  ${GREEN}http://localhost:3003${NC}"
echo -e "  Dashboard:         http://localhost:3000"
echo -e "  API Gateway:       http://localhost:4000"
echo -e "  Monitoring:        http://localhost:3005 (admin/admin)"
echo ""
echo -e "${BLUE}🔌 Backend Services:${NC}"
echo -e "  All services integrated through API Gateway"
echo -e "  Real-time updates via WebSocket"
echo ""
echo -e "${YELLOW}💡 Management Commands:${NC}"
echo -e "  View logs:     make logs"
echo -e "  Check status:  make status"
echo -e "  Stop services: make down"
echo -e "  Clean up:      make clean"
echo ""

# Test the integration
echo -e "${BLUE}🧪 Testing Frontend-Backend Integration...${NC}"
sleep 5

# Test instant score endpoint
response=$(curl -s -X POST http://localhost:4000/api/analyze/instant \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}' 2>/dev/null || echo "{}")

if echo "$response" | grep -q "score"; then
    echo -e "${GREEN}✓ API Integration working!${NC}"
    
    # Check if it's demo data or real data
    if echo "$response" | grep -q '"isDemo":true'; then
        echo -e "${YELLOW}  Note: Using demo data (backend services still starting)${NC}"
    else
        echo -e "${GREEN}  Using real backend services${NC}"
    fi
else
    echo -e "${YELLOW}⚠ API not ready yet. Services may still be starting.${NC}"
fi

echo ""
echo -e "${GREEN}Opening application in browser...${NC}"

# Open browser
if command -v open &> /dev/null; then
    sleep 2
    open http://localhost:3003
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    sleep 2
    xdg-open http://localhost:3003
    xdg-open http://localhost:3000
fi

echo ""
echo -e "${BLUE}Platform is running! Press Ctrl+C to keep services running in background.${NC}"
echo -e "To stop all services, run: ${YELLOW}make down${NC}"
echo ""

# Show logs
echo -e "${BLUE}Showing recent logs (Press Ctrl+C to exit):${NC}"
docker-compose logs -f --tail=50