#!/bin/bash

# ========================================================
# RankMyBrand.ai - Stop All Services
# ========================================================

echo "🛑 Stopping RankMyBrand.ai Services..."
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to stop service
stop_service() {
    SERVICE_NAME=$1
    PORT=$2
    
    echo -n "Stopping $SERVICE_NAME (port $PORT)... "
    
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -ti:$PORT | xargs kill -9 2>/dev/null
        echo -e "${GREEN}Stopped${NC}"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    # Clean up PID file
    if [ -f /tmp/${SERVICE_NAME}.pid ]; then
        rm /tmp/${SERVICE_NAME}.pid
    fi
}

# Stop all services
stop_service "frontend" 3001
stop_service "dashboard" 3000
# web-crawler archived - no longer needed
stop_service "api-gateway" 4000
stop_service "intelligence-engine" 8002
stop_service "action-center" 8082
stop_service "websocket" 3001

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"