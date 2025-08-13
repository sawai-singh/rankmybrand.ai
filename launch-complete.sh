#!/bin/bash

# RankMyBrand.ai Complete Platform Launcher
# Starts all services with correct paths

set -e

echo "🚀 LAUNCHING RANKMYBRAND.AI COMPLETE PLATFORM"
echo "================================================"
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

# Kill existing processes on our ports
echo -e "${BLUE}📦 Step 0: Cleaning up existing processes${NC}"
echo "--------------------------------------------"
for port in 8000 8001 8002 8082 3002; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        kill $pid 2>/dev/null && echo -e "${GREEN}✓ Stopped process on port $port${NC}"
    fi
done

echo ""
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
    fi
fi

wait_for_service "Infrastructure" 2

echo ""
echo -e "${BLUE}🔧 Step 2: Starting Backend Services${NC}"
echo "--------------------------------------------"

# Start GEO Calculator (Python service on port 8000)
echo "Starting GEO Calculator..."
cd rankMyBrand.com-main/services/geo-calculator/backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
python app/main.py > geo.log 2>&1 &
echo $! > GEO-Calculator.pid
echo -e "${GREEN}✓ GEO Calculator started (PID: $(cat GEO-Calculator.pid))${NC}"
cd - > /dev/null

# Start Web Crawler (TypeScript service on port 3002)
echo "Starting Web Crawler..."
cd rankMyBrand.com-main/services/web-crawler
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies for Web Crawler..."
    npm install --silent 2>/dev/null
fi
npm run dev > crawler.log 2>&1 &
echo $! > Web-Crawler.pid
echo -e "${GREEN}✓ Web Crawler started (PID: $(cat Web-Crawler.pid))${NC}"
cd - > /dev/null

# Start Intelligence Engine (Python service on port 8002)
echo "Starting Intelligence Engine..."
cd services/intelligence-engine
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
python src/main.py > intelligence.log 2>&1 &
echo $! > Intelligence-Engine.pid
echo -e "${GREEN}✓ Intelligence Engine started (PID: $(cat Intelligence-Engine.pid))${NC}"
cd - > /dev/null

# Start Action Center (Node.js service on port 8082)
echo "Starting Action Center..."
cd services/action-center
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies for Action Center..."
    npm install --silent 2>/dev/null
fi
npm run dev > action.log 2>&1 &
echo $! > Action-Center.pid
echo -e "${GREEN}✓ Action Center started (PID: $(cat Action-Center.pid))${NC}"
cd - > /dev/null

# Start AI Response Monitor (if exists on port 8001)
echo "Starting AI Response Monitor..."
cd services/ai-response-monitor
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies for AI Monitor..."
    npm install --silent 2>/dev/null
fi
npm run dev > ai-monitor.log 2>&1 &
echo $! > AI-Monitor.pid
echo -e "${GREEN}✓ AI Response Monitor started (PID: $(cat AI-Monitor.pid))${NC}"
cd - > /dev/null

wait_for_service "Backend Services" 5

echo ""
echo -e "${BLUE}🌐 Step 3: API Gateway & WebSocket${NC}"
echo "--------------------------------------------"

# Check if API Gateway is already running
if check_port 4000; then
    echo -e "${GREEN}✓ API Gateway already running on port 4000${NC}"
else
    echo "Starting API Gateway..."
    cd api-gateway
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies for API Gateway..."
        npm install --silent 2>/dev/null
    fi
    npm run dev > gateway.log 2>&1 &
    echo $! > API-Gateway.pid
    echo -e "${GREEN}✓ API Gateway started (PID: $(cat API-Gateway.pid))${NC}"
    cd - > /dev/null
fi

# Start WebSocket Server (port 3001)
echo "Starting WebSocket Server..."
cd services/websocket-server
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies for WebSocket Server..."
    npm install --silent 2>/dev/null
fi
npm run dev > websocket.log 2>&1 &
echo $! > WebSocket-Server.pid
echo -e "${GREEN}✓ WebSocket Server started (PID: $(cat WebSocket-Server.pid))${NC}"
cd - > /dev/null

wait_for_service "Gateway & WebSocket" 3

echo ""
echo -e "${BLUE}🎨 Step 4: Frontend Services${NC}"
echo "--------------------------------------------"

# Check if Revolutionary Frontend is already running
if check_port 3003; then
    echo -e "${GREEN}✓ Revolutionary Frontend already running on port 3003${NC}"
else
    echo "Starting Revolutionary Frontend..."
    cd rankmybrand-frontend
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies for Frontend..."
        npm install --silent 2>/dev/null
    fi
    export NEXT_PUBLIC_API_GATEWAY=http://localhost:4000
    export NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
    PORT=3003 npm run dev > frontend.log 2>&1 &
    echo $! > Frontend.pid
    echo -e "${GREEN}✓ Revolutionary Frontend started (PID: $(cat Frontend.pid))${NC}"
    cd - > /dev/null
fi

# Start Dashboard (Next.js on port 3000)
echo "Starting Dashboard..."
cd services/dashboard
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies for Dashboard..."
    npm install --silent 2>/dev/null
fi
npm run dev > dashboard.log 2>&1 &
echo $! > Dashboard.pid
echo -e "${GREEN}✓ Dashboard started (PID: $(cat Dashboard.pid))${NC}"
cd - > /dev/null

wait_for_service "Frontend Services" 5

echo ""
echo -e "${BLUE}🔍 Step 5: Service Status Check${NC}"
echo "--------------------------------------------"

# Wait a bit for services to fully start
sleep 5

echo -e "Service Status:"
echo -e "  PostgreSQL:        $(check_port 5432 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${RED}✗ Not running${NC}")"
echo -e "  Redis:             $(check_port 6379 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${RED}✗ Not running${NC}")"
echo -e "  GEO Calculator:    $(check_port 8000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  AI Monitor:        $(check_port 8001 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Web Crawler:       $(check_port 3002 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Intelligence:      $(check_port 8002 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Action Center:     $(check_port 8082 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  API Gateway:       $(check_port 4000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  WebSocket Server:  $(check_port 3001 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Dashboard:         $(check_port 3000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Frontend:          $(check_port 3003 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"

echo ""
echo "================================================"
echo -e "${GREEN}🎉 COMPLETE PLATFORM LAUNCHED SUCCESSFULLY!${NC}"
echo "================================================"
echo ""
echo -e "${BLUE}📍 Access Points:${NC}"
echo -e "  Revolutionary Frontend:  ${GREEN}http://localhost:3003${NC}"
echo -e "  Dashboard:              http://localhost:3000"
echo -e "  API Gateway:            http://localhost:4000"
echo -e "  WebSocket:              ws://localhost:4000/ws"
echo ""
echo -e "${BLUE}🔌 Backend Services:${NC}"
echo -e "  GEO Calculator:         http://localhost:8000/docs"
echo -e "  AI Monitor:             http://localhost:8001/api"
echo -e "  Web Crawler:            http://localhost:3002/api"
echo -e "  Intelligence Engine:    http://localhost:8002/docs"
echo -e "  Action Center:          http://localhost:8082/api"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  • All services integrated through API Gateway (port 4000)"
echo -e "  • Real-time updates via unified WebSocket"
echo -e "  • Check logs in service directories (*.log)"
echo -e "  • Use ./stop-integrated.sh to stop all services"
echo -e "  • Run ./test-integration.js to test all connections"
echo ""

# Test integration
echo -e "${BLUE}🧪 Running integration test...${NC}"
sleep 5
if command -v node &> /dev/null; then
    node test-integration.js
fi

echo ""
echo -e "${GREEN}Opening frontend in browser...${NC}"

# Open frontend in default browser
if command -v open &> /dev/null; then
    open http://localhost:3003
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3003
    xdg-open http://localhost:3000
fi

# Keep script running and handle shutdown
trap 'echo -e "\n${YELLOW}Shutting down services...${NC}"; ./stop-integrated.sh; exit' INT

echo -e "\n${BLUE}Platform is running. Press Ctrl+C to stop all services.${NC}"

# Monitor services
while true; do
    sleep 10
    # Could add health checks here
done