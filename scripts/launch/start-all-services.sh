#!/bin/bash

# ========================================================
# RankMyBrand.ai - Start All Services
# ========================================================
# CORRECT PORT MAPPING:
# - PostgreSQL: 5432
# - Redis: 6379
# - Dashboard: 3000 (with /admin route)
# - Frontend: 3001 (main app)
# - Web Crawler: 3002
# - WebSocket: 3001 (shares with frontend)
# - API Gateway: 4000
# - Intelligence Engine: 8002
# - Action Center: 8082
# ========================================================

set -e

echo "🚀 Starting RankMyBrand.ai Services..."
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Port $1: Already running${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Port $1: Not running${NC}"
        return 1
    fi
}

# Function to start service in background
start_service() {
    SERVICE_NAME=$1
    SERVICE_DIR=$2
    START_CMD=$3
    PORT=$4
    
    echo -n "Starting $SERVICE_NAME on port $PORT... "
    
    if check_port $PORT > /dev/null 2>&1; then
        echo -e "${GREEN}Already running${NC}"
    else
        cd "$SERVICE_DIR"
        nohup $START_CMD > /tmp/${SERVICE_NAME}.log 2>&1 &
        echo $! > /tmp/${SERVICE_NAME}.pid
        sleep 3
        
        if check_port $PORT > /dev/null 2>&1; then
            echo -e "${GREEN}Started!${NC}"
        else
            echo -e "${RED}Failed to start${NC}"
            echo "Check logs at /tmp/${SERVICE_NAME}.log"
        fi
    fi
}

echo ""
echo "1️⃣  Checking Prerequisites"
echo "=========================="

# Check PostgreSQL
echo -n "PostgreSQL (5432)... "
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
    echo "Start with: pg_ctl -D /usr/local/var/postgres start"
fi

# Check Redis
echo -n "Redis (6379)... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
    echo "Start with: redis-server"
fi

echo ""
echo "2️⃣  Starting Core Services"
echo "=========================="

# API Gateway - Port 4000
start_service "api-gateway" "/Users/sawai/Desktop/rankmybrand.ai/api-gateway" "npm run dev" 4000

# Intelligence Engine - Port 8002
echo -n "Starting Intelligence Engine on port 8002... "
if check_port 8002 > /dev/null 2>&1; then
    echo -e "${GREEN}Already running${NC}"
else
    cd /Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine
    nohup python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload > /tmp/intelligence-engine.log 2>&1 &
    echo $! > /tmp/intelligence-engine.pid
    sleep 3
    if check_port 8002 > /dev/null 2>&1; then
        echo -e "${GREEN}Started!${NC}"
    else
        echo -e "${RED}Failed to start${NC}"
    fi
fi

# Web Crawler - Port 3002
start_service "web-crawler" "/Users/sawai/Desktop/rankmybrand.ai/services/web-crawler" "npm run dev" 3002

# WebSocket Server - Port 3001 (if separate from frontend)
# Note: May conflict with frontend if both use 3001
# start_service "websocket" "/Users/sawai/Desktop/rankmybrand.ai/services/websocket-server" "npm run dev" 3001

# Action Center - Port 8082
start_service "action-center" "/Users/sawai/Desktop/rankmybrand.ai/services/action-center" "npm run dev" 8082

echo ""
echo "3️⃣  Starting Frontend Services"
echo "=============================="

# Dashboard - Port 3000
start_service "dashboard" "/Users/sawai/Desktop/rankmybrand.ai/services/dashboard" "npm run dev" 3000

# Main Frontend - Port 3001
echo -n "Starting Frontend on port 3001... "
if check_port 3001 > /dev/null 2>&1; then
    echo -e "${GREEN}Already running${NC}"
else
    cd /Users/sawai/Desktop/rankmybrand.ai/rankmybrand-frontend
    PORT=3001 nohup npm run dev > /tmp/frontend.log 2>&1 &
    echo $! > /tmp/frontend.pid
    sleep 5
    if check_port 3001 > /dev/null 2>&1; then
        echo -e "${GREEN}Started!${NC}"
    else
        echo -e "${RED}Failed to start${NC}"
    fi
fi

echo ""
echo "4️⃣  Service Status Check"
echo "======================="

check_port 5432 && echo "PostgreSQL: http://localhost:5432"
check_port 6379 && echo "Redis: redis://localhost:6379"
check_port 4000 && echo "API Gateway: http://localhost:4000"
check_port 8002 && echo "Intelligence Engine: http://localhost:8002"
check_port 3002 && echo "Web Crawler: http://localhost:3002"
check_port 8082 && echo "Action Center: http://localhost:8082"
check_port 3000 && echo "Dashboard: http://localhost:3000 (Admin: http://localhost:3000/admin)"
check_port 3001 && echo "Frontend: http://localhost:3001"

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Access points:"
echo "  - Main App: http://localhost:3001"
echo "  - Dashboard: http://localhost:3000"
echo "  - Admin Panel: http://localhost:3000/admin"
echo "  - API Gateway: http://localhost:4000"
echo ""
echo "View logs:"
echo "  tail -f /tmp/*.log"
echo ""
echo "Stop all services:"
echo "  ./stop-all-services.sh"