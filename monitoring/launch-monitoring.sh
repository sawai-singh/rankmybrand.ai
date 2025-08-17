#!/bin/bash

# ==============================================================================
# RankMyBrand Monitoring Stack Launcher
# ==============================================================================
# Launches Prometheus and Grafana for monitoring RankMyBrand services
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}        RankMyBrand Monitoring Stack Launcher${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    error "Docker daemon is not running. Please start Docker."
    exit 1
fi

# Navigate to monitoring directory
cd "$SCRIPT_DIR"

# Create necessary directories
log "Creating directories..."
mkdir -p grafana/dashboards grafana/provisioning/dashboards grafana/provisioning/datasources alerts

# Check if required files exist
log "Checking configuration files..."
REQUIRED_FILES=(
    "prometheus.yml"
    "docker-compose.monitoring.yml"
    "grafana/provisioning/datasources/prometheus.yml"
    "grafana/provisioning/dashboards/dashboard.yml"
    "grafana/dashboards/rankmybrand-overview.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        warning "Missing: $file"
    else
        success "Found: $file"
    fi
done

# Stop any existing monitoring containers
log "Stopping existing monitoring containers..."
docker-compose -f docker-compose.monitoring.yml down 2>/dev/null || true

# Pull latest images
log "Pulling latest Docker images..."
docker-compose -f docker-compose.monitoring.yml pull

# Start monitoring stack
log "Starting monitoring stack..."
if docker-compose -f docker-compose.monitoring.yml up -d; then
    success "Monitoring stack started"
else
    error "Failed to start monitoring stack"
    exit 1
fi

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 10

# Check service health
echo
echo -e "${PURPLE}Service Status:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Prometheus
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/-/healthy | grep -q "200"; then
    echo -e "Prometheus       ${GREEN}● Running${NC} (http://localhost:9090)"
else
    echo -e "Prometheus       ${YELLOW}● Starting${NC} (http://localhost:9090)"
fi

# Check Grafana
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3006/api/health | grep -q "200"; then
    echo -e "Grafana          ${GREEN}● Running${NC} (http://localhost:3006)"
else
    echo -e "Grafana          ${YELLOW}● Starting${NC} (http://localhost:3006)"
fi

# Check AlertManager
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9093/-/healthy | grep -q "200"; then
    echo -e "AlertManager     ${GREEN}● Running${NC} (http://localhost:9093)"
else
    echo -e "AlertManager     ${YELLOW}● Starting${NC} (http://localhost:9093)"
fi

# Check Node Exporter
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9100/metrics | grep -q "200"; then
    echo -e "Node Exporter    ${GREEN}● Running${NC} (http://localhost:9100)"
else
    echo -e "Node Exporter    ${YELLOW}● Starting${NC} (http://localhost:9100)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Display access information
echo
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        Monitoring Stack is Running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  Grafana:      ${PURPLE}http://localhost:3006${NC}"
echo -e "                Username: admin"
echo -e "                Password: rankmybrand123"
echo
echo -e "  Prometheus:   ${PURPLE}http://localhost:9090${NC}"
echo -e "  AlertManager: ${PURPLE}http://localhost:9093${NC}"
echo
echo -e "${BLUE}Available Dashboards:${NC}"
echo -e "  • RankMyBrand Overview"
echo -e "  • System Metrics"
echo -e "  • API Performance"
echo
echo -e "${BLUE}Metrics Endpoints:${NC}"
echo -e "  API Gateway:  ${PURPLE}http://localhost:4000/metrics${NC}"
echo -e "  Node Metrics: ${PURPLE}http://localhost:9100/metrics${NC}"
echo
echo -e "${YELLOW}Commands:${NC}"
echo -e "  View logs:    docker-compose -f docker-compose.monitoring.yml logs -f"
echo -e "  Stop stack:   docker-compose -f docker-compose.monitoring.yml down"
echo -e "  Restart:      docker-compose -f docker-compose.monitoring.yml restart"
echo
echo -e "${YELLOW}Press Ctrl+C to keep monitoring stack running in background${NC}"