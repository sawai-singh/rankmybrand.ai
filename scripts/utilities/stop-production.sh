#!/bin/bash

# ==============================================================================
# RankMyBrand Production Stop Script
# ==============================================================================
# Stops all RankMyBrand services gracefully
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${RED}        Stopping RankMyBrand Production Services${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
echo

# Stop application services
SERVICES=("frontend" "dashboard" "api-gateway" "intelligence-engine")

for service in "${SERVICES[@]}"; do
    if [ -f "$PID_DIR/$service.pid" ]; then
        PID=$(cat "$PID_DIR/$service.pid")
        if kill -0 "$PID" 2>/dev/null; then
            log "Stopping $service (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
            rm -f "$PID_DIR/$service.pid"
            success "$service stopped"
        else
            warning "$service not running (stale PID file)"
            rm -f "$PID_DIR/$service.pid"
        fi
    else
        warning "$service PID file not found"
    fi
done

# Stop Redis if it was started by us
if pgrep -x "redis-server" > /dev/null; then
    log "Stopping Redis..."
    redis-cli -p 6379 shutdown > /dev/null 2>&1 || true
    success "Redis stopped"
fi

# Note about PostgreSQL (usually managed separately)
echo
warning "PostgreSQL is not stopped (usually managed separately)"
echo "To stop PostgreSQL manually: pg_ctl stop -D /usr/local/var/postgres"

echo
success "All RankMyBrand services stopped"