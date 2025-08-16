#!/bin/bash

# RankMyBrand.ai Production Deployment Script
# Author: Chief Product Architect
# Date: 2025-08-16

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
ENV_FILE=".env.${ENVIRONMENT}"

echo -e "${GREEN}🚀 RankMyBrand.ai Production Deployment${NC}"
echo -e "${GREEN}===========================================${NC}"

# Function to check command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed. Please install it first.${NC}"
        exit 1
    fi
}

# Function to check service health
check_health() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Checking health of ${service}...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null; then
            echo -e "${GREEN}✅ ${service} is healthy${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ ${service} failed health check${NC}"
    return 1
}

# Pre-flight checks
echo -e "${YELLOW}Running pre-flight checks...${NC}"
check_command docker
check_command docker-compose
check_command curl
check_command jq

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file ${ENV_FILE} not found${NC}"
    echo -e "${YELLOW}Creating from template...${NC}"
    cp .env.example "$ENV_FILE"
    echo -e "${YELLOW}⚠️  Please update ${ENV_FILE} with production values${NC}"
    exit 1
fi

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Validate required environment variables
REQUIRED_VARS=("DB_USER" "DB_PASSWORD" "REDIS_PASSWORD" "OPENAI_API_KEY")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo -e "${RED}❌ Required variable ${var} is not set${NC}"
        exit 1
    fi
done

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p logs

# Stop existing services
echo -e "${YELLOW}Stopping existing services...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" down || true

# Pull latest images
echo -e "${YELLOW}Pulling latest images...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" pull

# Build services
echo -e "${YELLOW}Building services...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" build --parallel

# Start infrastructure services first
echo -e "${YELLOW}Starting infrastructure services...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis

# Wait for infrastructure
sleep 10
check_health "PostgreSQL" "http://localhost:5432" || exit 1
check_health "Redis" "http://localhost:6379" || exit 1

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm api-gateway npm run migrate || true

# Start core services
echo -e "${YELLOW}Starting core services...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d \
    foundation \
    api-gateway \
    intelligence-engine \
    action-center

# Wait for core services
sleep 10

# Start application services
echo -e "${YELLOW}Starting application services...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d \
    websocket-server \
    web-crawler \
    ai-response-monitor \
    dashboard \
    frontend

# Start monitoring services
echo -e "${YELLOW}Starting monitoring services...${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d \
    prometheus \
    grafana

# Health checks
echo -e "${YELLOW}Running health checks...${NC}"
sleep 10

SERVICES=(
    "API Gateway|http://localhost:4000/health"
    "Intelligence Engine|http://localhost:8002/health"
    "Action Center|http://localhost:8082/health"
    "WebSocket Server|http://localhost:3001/health"
    "Web Crawler|http://localhost:3002/health"
    "Dashboard|http://localhost:3000"
    "Frontend|http://localhost:3003"
    "Prometheus|http://localhost:9090"
    "Grafana|http://localhost:3030"
)

ALL_HEALTHY=true
for service_info in "${SERVICES[@]}"; do
    IFS='|' read -r service url <<< "$service_info"
    if ! check_health "$service" "$url"; then
        ALL_HEALTHY=false
    fi
done

# Show service status
echo -e "${YELLOW}Service Status:${NC}"
docker-compose -f "$DOCKER_COMPOSE_FILE" ps

# Show logs location
echo -e "${YELLOW}Logs:${NC}"
echo "View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f [service-name]"

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Access points:"
    echo "  Frontend:     http://localhost:3003"
    echo "  Dashboard:    http://localhost:3000"
    echo "  API Gateway:  http://localhost:4000"
    echo "  WebSocket:    ws://localhost:3001"
    echo "  Prometheus:   http://localhost:9090"
    echo "  Grafana:      http://localhost:3030 (admin/admin)"
    echo ""
    echo "Next steps:"
    echo "  1. Configure your reverse proxy (nginx/traefik)"
    echo "  2. Set up SSL certificates"
    echo "  3. Configure DNS records"
    echo "  4. Set up backup strategy"
    echo "  5. Configure monitoring alerts"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}⚠️  DEPLOYMENT PARTIALLY SUCCESSFUL${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Some services failed health checks."
    echo "Check logs for failing services:"
    echo "  docker-compose -f $DOCKER_COMPOSE_FILE logs [service-name]"
    exit 1
fi