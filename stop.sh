#!/bin/bash

# RankMyBrand.ai Platform Shutdown Script
# Stops all services gracefully

echo "🛑 STOPPING RANKMYBRAND.AI PLATFORM"
echo "===================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to stop service by PID file
stop_service() {
    if [ -f "$1" ]; then
        PID=$(cat $1)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo -e "${GREEN}✓ Stopped $2 (PID: $PID)${NC}"
        else
            echo -e "${YELLOW}⚠ $2 was not running${NC}"
        fi
        rm $1
    else
        echo -e "${YELLOW}⚠ $2 PID file not found${NC}"
    fi
}

# Stop Dashboard
echo "Stopping Dashboard..."
stop_service "services/dashboard/dashboard.pid" "Dashboard"

# Stop WebSocket Server
echo "Stopping WebSocket Server..."
stop_service "services/websocket-server/websocket.pid" "WebSocket Server"

# Stop Action Center
echo "Stopping Action Center..."
stop_service "services/action-center/action-center.pid" "Action Center"

# Stop Intelligence Engine
echo "Stopping Intelligence Engine..."
stop_service "services/intelligence-engine/intelligence.pid" "Intelligence Engine"

# Stop AI Collector
echo "Stopping AI Collector..."
stop_service "services/ai-collector/ai-collector.pid" "AI Collector"

echo ""
echo -e "${GREEN}All services stopped successfully!${NC}"
echo ""