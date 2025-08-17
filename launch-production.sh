#!/bin/bash

# ==============================================================================
# RankMyBrand Production Launch Script
# ==============================================================================
# This script launches all services required for RankMyBrand in production mode
# It includes health checks, error handling, and automatic recovery
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/.pids"
REDIS_PORT=6379
POSTGRES_PORT=5432
API_GATEWAY_PORT=4000
FRONTEND_PORT=3003
DASHBOARD_PORT=3000
INTELLIGENCE_PORT=8002
MAX_RETRIES=3
HEALTH_CHECK_DELAY=5

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# ==============================================================================
# Helper Functions
# ==============================================================================

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

check_command() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 is not installed. Please install it first."
        exit 1
    fi
}

check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t > /dev/null 2>&1; then
        warning "Port $port is already in use (required for $service)"
        return 1
    fi
    return 0
}

wait_for_service() {
    local url=$1
    local service=$2
    local max_attempts=30
    local attempt=0
    
    log "Waiting for $service to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
            success "$service is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    error "$service failed to start"
    return 1
}

save_pid() {
    local service=$1
    local pid=$2
    echo "$pid" > "$PID_DIR/$service.pid"
}

get_pid() {
    local service=$1
    if [ -f "$PID_DIR/$service.pid" ]; then
        cat "$PID_DIR/$service.pid"
    fi
}

stop_service() {
    local service=$1
    local pid=$(get_pid "$service")
    
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        log "Stopping $service (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        rm -f "$PID_DIR/$service.pid"
        success "$service stopped"
    fi
}

cleanup() {
    log "Shutting down services..."
    
    # Stop all services
    stop_service "frontend"
    stop_service "dashboard"
    stop_service "api-gateway"
    stop_service "intelligence-engine"
    
    # Stop background services
    if [ "$REDIS_STARTED" = "true" ]; then
        redis-cli -p $REDIS_PORT shutdown > /dev/null 2>&1 || true
        success "Redis stopped"
    fi
    
    if [ "$POSTGRES_STARTED" = "true" ]; then
        pg_ctl stop -D /usr/local/var/postgres > /dev/null 2>&1 || true
        success "PostgreSQL stopped"
    fi
    
    log "Cleanup complete"
    exit 0
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}        RankMyBrand Production Launcher v2.0${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo

log "Running pre-flight checks..."

# Check required commands
check_command "node"
check_command "npm"
check_command "python3"
check_command "redis-cli"
check_command "psql"
check_command "curl"
check_command "lsof"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js version 18 or higher is required (found: $(node -v))"
    exit 1
fi
success "Node.js version: $(node -v)"

# Check Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
if [[ $(echo "$PYTHON_VERSION < 3.9" | bc) -eq 1 ]]; then
    error "Python 3.9 or higher is required (found: $PYTHON_VERSION)"
    exit 1
fi
success "Python version: $PYTHON_VERSION"

# Check ports
log "Checking port availability..."
check_port $API_GATEWAY_PORT "API Gateway" || exit 1
check_port $FRONTEND_PORT "Frontend" || exit 1
check_port $DASHBOARD_PORT "Dashboard" || exit 1
check_port $INTELLIGENCE_PORT "Intelligence Engine" || exit 1

# ==============================================================================
# Start Infrastructure Services
# ==============================================================================

echo
log "Starting infrastructure services..."

# Start Redis if not running
if ! redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
    log "Starting Redis..."
    redis-server --port $REDIS_PORT --daemonize yes > "$LOG_DIR/redis.log" 2>&1
    REDIS_STARTED=true
    sleep 2
    if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
        success "Redis started on port $REDIS_PORT"
    else
        error "Failed to start Redis"
        exit 1
    fi
else
    success "Redis already running on port $REDIS_PORT"
fi

# Start PostgreSQL if not running
if ! psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
    log "Starting PostgreSQL..."
    pg_ctl start -D /usr/local/var/postgres -l "$LOG_DIR/postgres.log" > /dev/null 2>&1
    POSTGRES_STARTED=true
    sleep 3
    if psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
        success "PostgreSQL started"
    else
        error "Failed to start PostgreSQL"
        exit 1
    fi
else
    success "PostgreSQL already running"
fi

# Initialize database if needed
log "Checking database..."
if ! psql -U postgres -d rankmybrand -c "SELECT 1 FROM users LIMIT 1" > /dev/null 2>&1; then
    log "Initializing database..."
    psql -U postgres -c "CREATE DATABASE rankmybrand" > /dev/null 2>&1 || true
    if [ -f "$PROJECT_ROOT/database/schema.sql" ]; then
        psql -U postgres -d rankmybrand -f "$PROJECT_ROOT/database/schema.sql" > /dev/null 2>&1
        success "Database initialized"
    else
        warning "Database schema file not found"
    fi
else
    success "Database ready"
fi

# ==============================================================================
# Build Services
# ==============================================================================

echo
log "Building services..."

# Build API Gateway
if [ -d "$PROJECT_ROOT/api-gateway" ]; then
    log "Building API Gateway..."
    cd "$PROJECT_ROOT/api-gateway"
    npm install --production > /dev/null 2>&1
    npm run build > /dev/null 2>&1 || true
    success "API Gateway built"
fi

# Build Frontend
if [ -d "$PROJECT_ROOT/rankmybrand-frontend" ]; then
    log "Building Frontend..."
    cd "$PROJECT_ROOT/rankmybrand-frontend"
    npm install --production > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    success "Frontend built"
fi

# Build Dashboard
if [ -d "$PROJECT_ROOT/services/dashboard" ]; then
    log "Building Dashboard..."
    cd "$PROJECT_ROOT/services/dashboard"
    npm install --production > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    success "Dashboard built"
fi

# Setup Intelligence Engine
if [ -d "$PROJECT_ROOT/services/intelligence-engine" ]; then
    log "Setting up Intelligence Engine..."
    cd "$PROJECT_ROOT/services/intelligence-engine"
    if [ -f "requirements.txt" ]; then
        pip3 install -q -r requirements.txt > /dev/null 2>&1
    fi
    success "Intelligence Engine ready"
fi

# ==============================================================================
# Start Application Services
# ==============================================================================

echo
log "Starting application services..."

# Start API Gateway
if [ -d "$PROJECT_ROOT/api-gateway" ]; then
    log "Starting API Gateway..."
    cd "$PROJECT_ROOT/api-gateway"
    NODE_ENV=production PORT=$API_GATEWAY_PORT npm start > "$LOG_DIR/api-gateway.log" 2>&1 &
    save_pid "api-gateway" $!
    sleep 3
    
    if wait_for_service "http://localhost:$API_GATEWAY_PORT/health" "API Gateway"; then
        success "API Gateway running on port $API_GATEWAY_PORT"
    else
        error "Failed to start API Gateway"
        exit 1
    fi
fi

# Start Intelligence Engine
if [ -d "$PROJECT_ROOT/services/intelligence-engine" ]; then
    log "Starting Intelligence Engine..."
    cd "$PROJECT_ROOT/services/intelligence-engine"
    PYTHONPATH="$PROJECT_ROOT/services/intelligence-engine" \
    PORT=$INTELLIGENCE_PORT \
    python3 src/main.py > "$LOG_DIR/intelligence-engine.log" 2>&1 &
    save_pid "intelligence-engine" $!
    sleep 3
    
    if wait_for_service "http://localhost:$INTELLIGENCE_PORT/health" "Intelligence Engine"; then
        success "Intelligence Engine running on port $INTELLIGENCE_PORT"
    else
        warning "Intelligence Engine may take longer to start"
    fi
fi

# Start Frontend
if [ -d "$PROJECT_ROOT/rankmybrand-frontend" ]; then
    log "Starting Frontend..."
    cd "$PROJECT_ROOT/rankmybrand-frontend"
    PORT=$FRONTEND_PORT npm start > "$LOG_DIR/frontend.log" 2>&1 &
    save_pid "frontend" $!
    sleep 5
    
    if wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"; then
        success "Frontend running on port $FRONTEND_PORT"
    else
        error "Failed to start Frontend"
        exit 1
    fi
fi

# Start Dashboard
if [ -d "$PROJECT_ROOT/services/dashboard" ]; then
    log "Starting Dashboard..."
    cd "$PROJECT_ROOT/services/dashboard"
    PORT=$DASHBOARD_PORT npm start > "$LOG_DIR/dashboard.log" 2>&1 &
    save_pid "dashboard" $!
    sleep 5
    
    if wait_for_service "http://localhost:$DASHBOARD_PORT" "Dashboard"; then
        success "Dashboard running on port $DASHBOARD_PORT"
    else
        warning "Dashboard may take longer to start"
    fi
fi

# ==============================================================================
# Health Check
# ==============================================================================

echo
log "Running final health checks..."
sleep $HEALTH_CHECK_DELAY

SERVICES_HEALTHY=true

# Check each service
echo
echo -e "${PURPLE}Service Status:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Redis
if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo -e "Redis            ${GREEN}● Running${NC} (port $REDIS_PORT)"
else
    echo -e "Redis            ${RED}○ Not Running${NC}"
    SERVICES_HEALTHY=false
fi

# PostgreSQL
if psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "PostgreSQL       ${GREEN}● Running${NC} (port $POSTGRES_PORT)"
else
    echo -e "PostgreSQL       ${RED}○ Not Running${NC}"
    SERVICES_HEALTHY=false
fi

# API Gateway
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_GATEWAY_PORT/health" | grep -q "200"; then
    echo -e "API Gateway      ${GREEN}● Running${NC} (port $API_GATEWAY_PORT)"
else
    echo -e "API Gateway      ${RED}○ Not Running${NC}"
    SERVICES_HEALTHY=false
fi

# Intelligence Engine
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$INTELLIGENCE_PORT/health" | grep -q "200"; then
    echo -e "Intelligence     ${GREEN}● Running${NC} (port $INTELLIGENCE_PORT)"
else
    echo -e "Intelligence     ${YELLOW}● Starting${NC} (port $INTELLIGENCE_PORT)"
fi

# Frontend
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" | grep -q "200\|404"; then
    echo -e "Frontend         ${GREEN}● Running${NC} (port $FRONTEND_PORT)"
else
    echo -e "Frontend         ${RED}○ Not Running${NC}"
    SERVICES_HEALTHY=false
fi

# Dashboard
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DASHBOARD_PORT" | grep -q "200\|404"; then
    echo -e "Dashboard        ${GREEN}● Running${NC} (port $DASHBOARD_PORT)"
else
    echo -e "Dashboard        ${YELLOW}● Starting${NC} (port $DASHBOARD_PORT)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ==============================================================================
# Launch Summary
# ==============================================================================

echo
if [ "$SERVICES_HEALTHY" = true ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}        🚀 RankMyBrand is running in production mode!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${BLUE}Access the application:${NC}"
    echo -e "  Frontend:     ${PURPLE}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Dashboard:    ${PURPLE}http://localhost:$DASHBOARD_PORT${NC}"
    echo -e "  API Gateway:  ${PURPLE}http://localhost:$API_GATEWAY_PORT${NC}"
    echo
    echo -e "${BLUE}Logs are available in:${NC} $LOG_DIR"
    echo -e "${BLUE}Process IDs saved in:${NC} $PID_DIR"
    echo
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    
    # Keep script running
    while true; do
        sleep 60
        
        # Basic health monitoring
        if ! curl -s -o /dev/null "http://localhost:$API_GATEWAY_PORT/health"; then
            warning "API Gateway health check failed, attempting restart..."
            stop_service "api-gateway"
            cd "$PROJECT_ROOT/api-gateway"
            NODE_ENV=production PORT=$API_GATEWAY_PORT npm start > "$LOG_DIR/api-gateway.log" 2>&1 &
            save_pid "api-gateway" $!
        fi
    done
else
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}        Some services failed to start${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${YELLOW}Check the logs for more information:${NC}"
    echo "  tail -f $LOG_DIR/*.log"
    echo
    echo -e "${YELLOW}Cleaning up and exiting...${NC}"
    exit 1
fi