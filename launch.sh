#!/bin/bash

# RankMyBrand.ai Platform Launcher
# Starts all services in the correct order

set -e

echo "🚀 LAUNCHING RANKMYBRAND.AI PLATFORM"
echo "====================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    echo -e "${YELLOW}⏳ Waiting for $1 to be ready...${NC}"
    sleep $2
    echo -e "${GREEN}✓ $1 is ready${NC}"
}

echo -e "${BLUE}📦 Step 1: Starting Infrastructure Services${NC}"
echo "--------------------------------------------"

# Start PostgreSQL
if check_port 5432; then
    echo -e "${GREEN}✓ PostgreSQL already running on port 5432${NC}"
else
    echo "Starting PostgreSQL..."
    if command -v pg_ctl &> /dev/null; then
        pg_ctl start 2>/dev/null || true
    elif command -v brew &> /dev/null; then
        brew services start postgresql@15 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠ PostgreSQL not found. Please install and start manually.${NC}"
    fi
fi

# Start Redis
if check_port 6379; then
    echo -e "${GREEN}✓ Redis already running on port 6379${NC}"
else
    echo "Starting Redis..."
    if command -v redis-server &> /dev/null; then
        redis-server --daemonize yes
        echo -e "${GREEN}✓ Redis started${NC}"
    elif command -v brew &> /dev/null; then
        brew services start redis 2>/dev/null || true
        echo -e "${GREEN}✓ Redis started${NC}"
    else
        echo -e "${YELLOW}⚠ Redis not found. Please install and start manually.${NC}"
    fi
fi

wait_for_service "Infrastructure" 2

echo ""
echo -e "${BLUE}🤖 Step 2: Starting Backend Services${NC}"
echo "--------------------------------------------"

# Start AI Collector (Module 1)
echo "Starting AI Collector service..."
cd services/ai-collector
if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || true
    npm run dev > ai-collector.log 2>&1 &
    echo $! > ai-collector.pid
    echo -e "${GREEN}✓ AI Collector started (PID: $(cat ai-collector.pid))${NC}"
else
    echo -e "${YELLOW}⚠ AI Collector not found${NC}"
fi
cd ../..

# Start Intelligence Engine (Module 2)
echo "Starting Intelligence Engine..."
cd services/intelligence-engine
if [ -f "requirements.txt" ]; then
    python3 -m venv venv 2>/dev/null || true
    source venv/bin/activate
    pip install -r requirements.txt --quiet 2>/dev/null || true
    python src/main.py > intelligence.log 2>&1 &
    echo $! > intelligence.pid
    echo -e "${GREEN}✓ Intelligence Engine started (PID: $(cat intelligence.pid))${NC}"
    deactivate
else
    echo -e "${YELLOW}⚠ Intelligence Engine not found${NC}"
fi
cd ../..

# Start Action Center (Module 3)
echo "Starting Action Center..."
cd services/action-center
if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || true
    npm run dev > action-center.log 2>&1 &
    echo $! > action-center.pid
    echo -e "${GREEN}✓ Action Center started (PID: $(cat action-center.pid))${NC}"
else
    echo -e "${YELLOW}⚠ Action Center not found${NC}"
fi
cd ../..

wait_for_service "Backend Services" 3

echo ""
echo -e "${BLUE}🎨 Step 3: Starting Frontend Dashboard${NC}"
echo "--------------------------------------------"

# Start WebSocket Server
echo "Starting WebSocket Server..."
cd services/websocket-server
if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || true
    npm run dev > websocket.log 2>&1 &
    echo $! > websocket.pid
    echo -e "${GREEN}✓ WebSocket Server started (PID: $(cat websocket.pid))${NC}"
else
    echo -e "${YELLOW}⚠ WebSocket Server not found${NC}"
fi
cd ../..

wait_for_service "WebSocket Server" 3

# Start Dashboard (Module 4)
cd services/dashboard
if [ -f "package.json" ]; then
    echo "Starting Dashboard..."
    npm install --silent 2>/dev/null || true
    NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws npm run dev > dashboard.log 2>&1 &
    echo $! > dashboard.pid
    echo -e "${GREEN}✓ Dashboard started (PID: $(cat dashboard.pid))${NC}"
    wait_for_service "Dashboard" 5
else
    echo -e "${YELLOW}⚠ Dashboard not found${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}🔍 Step 4: Service Status Check${NC}"
echo "--------------------------------------------"

# Check all services
echo -e "Service Status:"
echo -e "  PostgreSQL:        $(check_port 5432 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${RED}✗ Not running${NC}")"
echo -e "  Redis:             $(check_port 6379 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${RED}✗ Not running${NC}")"
echo -e "  AI Collector:      $(check_port 8001 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Intelligence:      $(check_port 8002 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Action Center:     $(check_port 8082 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Dashboard:         $(check_port 3000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"

echo ""
echo "====================================="
echo -e "${GREEN}🎉 RANKMYBRAND.AI PLATFORM LAUNCHED!${NC}"
echo "====================================="
echo ""
echo -e "${BLUE}📍 Access Points:${NC}"
echo -e "  Dashboard:    ${GREEN}http://localhost:3000${NC}"
echo -e "  AI Collector: http://localhost:8001/health"
echo -e "  Intelligence: http://localhost:8002/health"
echo -e "  Action Center: http://localhost:8082/api/health"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  • Press Ctrl+C to stop all services"
echo -e "  • Check logs in services/*/**.log"
echo -e "  • Use ⌘K in dashboard for quick actions"
echo ""
echo -e "${GREEN}Opening dashboard in browser...${NC}"

# Open dashboard in default browser
sleep 2
if command -v open &> /dev/null; then
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
else
    echo -e "${YELLOW}Please open http://localhost:3000 in your browser${NC}"
fi

# Keep script running and handle shutdown
trap 'echo -e "\n${YELLOW}Shutting down services...${NC}"; ./stop.sh; exit' INT

echo -e "\n${BLUE}Platform is running. Press Ctrl+C to stop all services.${NC}"

# Keep the script running
while true; do
    sleep 1
done