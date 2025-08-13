#!/bin/bash

# RankMyBrand.ai Integrated Platform Shutdown Script
# Stops all services gracefully

echo "🛑 STOPPING RANKMYBRAND.AI INTEGRATED PLATFORM"
echo "==============================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to stop service by PID file
stop_service() {
    local pidfile=$1
    local name=$2
    
    if [ -f "$pidfile" ]; then
        PID=$(cat $pidfile)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo -e "${GREEN}✓ Stopped $name (PID: $PID)${NC}"
        else
            echo -e "${YELLOW}⚠ $name was not running${NC}"
        fi
        rm $pidfile
    else
        echo -e "${YELLOW}⚠ $name PID file not found${NC}"
    fi
}

# Stop Frontend Services
echo "Stopping Frontend Services..."
stop_service "rankmybrand-frontend/Frontend.pid" "Revolutionary Frontend"
stop_service "services/dashboard/Dashboard.pid" "Dashboard"

# Stop WebSocket Services
echo "Stopping WebSocket Services..."
stop_service "services/websocket-server/WebSocket-Server.pid" "WebSocket Server"

# Stop API Gateway
echo "Stopping API Gateway..."
stop_service "api-gateway/API-Gateway.pid" "API Gateway"

# Stop Backend Services
echo "Stopping Backend Services..."
stop_service "services/action-center/Action-Center.pid" "Action Center"
stop_service "services/intelligence-engine/Intelligence-Engine.pid" "Intelligence Engine"
stop_service "services/web-crawler/Web-Crawler.pid" "Web Crawler"
stop_service "rankMyBrand.com-main/services/geo-calculator/backend/GEO-Calculator.pid" "GEO Calculator"
stop_service "services/ai-response-monitor/AI-Monitor.pid" "AI Response Monitor"

# Stop any Node.js processes on specific ports
echo "Cleaning up any remaining processes..."
for port in 3000 3001 3002 3003 4000 8000 8001 8002 8082; do
    pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        kill $pid 2>/dev/null && echo -e "${GREEN}✓ Stopped process on port $port${NC}"
    fi
done

echo ""
echo -e "${GREEN}All services stopped successfully!${NC}"
echo ""

# Optional: Stop infrastructure services
read -p "Stop infrastructure services (PostgreSQL, Redis)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping infrastructure services..."
    
    # Stop Redis
    if command -v redis-cli &> /dev/null; then
        redis-cli shutdown 2>/dev/null && echo -e "${GREEN}✓ Redis stopped${NC}"
    fi
    
    # Stop PostgreSQL
    if command -v pg_ctl &> /dev/null; then
        pg_ctl stop 2>/dev/null && echo -e "${GREEN}✓ PostgreSQL stopped${NC}"
    elif command -v brew &> /dev/null; then
        brew services stop postgresql@15 2>/dev/null && echo -e "${GREEN}✓ PostgreSQL stopped${NC}"
    fi
fi

echo ""
echo "==============================================="
echo -e "${GREEN}Platform shutdown complete${NC}"
echo "==============================================="