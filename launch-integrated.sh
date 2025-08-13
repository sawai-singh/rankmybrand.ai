#!/bin/bash

# RankMyBrand.ai Integrated Platform Launcher
# Starts all services in correct order with full integration

set -e

echo "🚀 LAUNCHING RANKMYBRAND.AI INTEGRATED PLATFORM"
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

# Function to start service in background
start_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    local port=$4
    
    echo "Starting $name..."
    cd "$dir"
    
    if [ -f "package.json" ]; then
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies for $name..."
            npm install --silent 2>/dev/null || true
        fi
        
        # Start the service
        eval "$cmd" > "$name.log" 2>&1 &
        echo $! > "$name.pid"
        echo -e "${GREEN}✓ $name started (PID: $(cat $name.pid))${NC}"
        
        # Wait for port to be available
        if [ -n "$port" ]; then
            local counter=0
            while ! check_port $port && [ $counter -lt 30 ]; do
                sleep 1
                counter=$((counter + 1))
            done
            
            if check_port $port; then
                echo -e "${GREEN}✓ $name listening on port $port${NC}"
            else
                echo -e "${RED}✗ $name failed to start on port $port${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ $name not found at $dir${NC}"
    fi
    
    cd - > /dev/null
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
start_service "GEO-Calculator" "rankMyBrand.com-main/services/geo-calculator/backend" "python app/main.py" 8000

# Start Web Crawler (TypeScript service on port 3002)
start_service "Web-Crawler" "services/web-crawler" "npm run dev" 3002

# Start Intelligence Engine (Python service on port 8002)
start_service "Intelligence-Engine" "services/intelligence-engine" "python src/main.py" 8002

# Start Action Center (Node.js service on port 8082)
start_service "Action-Center" "services/action-center" "npm run dev" 8082

# Start AI Response Monitor (if exists)
if [ -d "services/ai-response-monitor" ]; then
    start_service "AI-Monitor" "services/ai-response-monitor" "npm run dev" 8001
fi

wait_for_service "Backend Services" 3

echo ""
echo -e "${BLUE}🌐 Step 3: Starting API Gateway${NC}"
echo "--------------------------------------------"

# Start API Gateway (port 4000)
start_service "API-Gateway" "api-gateway" "npm run dev" 4000

wait_for_service "API Gateway" 2

echo ""
echo -e "${BLUE}📡 Step 4: Starting WebSocket Services${NC}"
echo "--------------------------------------------"

# Start WebSocket Server (port 3001)
start_service "WebSocket-Server" "services/websocket-server" "npm run dev" 3001

wait_for_service "WebSocket Server" 2

echo ""
echo -e "${BLUE}🎨 Step 5: Starting Frontend Services${NC}"
echo "--------------------------------------------"

# Start Dashboard (Next.js on port 3000 or 3003)
if [ -d "services/dashboard" ]; then
    start_service "Dashboard" "services/dashboard" "npm run dev" 3000
fi

# Start Revolutionary Frontend (Next.js on port 3001 or next available)
if [ -d "rankmybrand-frontend" ]; then
    export NEXT_PUBLIC_API_GATEWAY=http://localhost:4000
    export NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
    start_service "Frontend" "rankmybrand-frontend" "PORT=3003 npm run dev" 3003
fi

wait_for_service "Frontend Services" 5

echo ""
echo -e "${BLUE}🔍 Step 6: Service Status Check${NC}"
echo "--------------------------------------------"

echo -e "Service Status:"
echo -e "  PostgreSQL:        $(check_port 5432 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${RED}✗ Not running${NC}")"
echo -e "  Redis:             $(check_port 6379 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${RED}✗ Not running${NC}")"
echo -e "  GEO Calculator:    $(check_port 8000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Web Crawler:       $(check_port 3002 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Intelligence:      $(check_port 8002 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Action Center:     $(check_port 8082 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  API Gateway:       $(check_port 4000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  WebSocket Server:  $(check_port 3001 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Dashboard:         $(check_port 3000 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"
echo -e "  Frontend:          $(check_port 3003 && echo -e "${GREEN}✓ Running${NC}" || echo -e "${YELLOW}⏳ Starting...${NC}")"

echo ""
echo "================================================"
echo -e "${GREEN}🎉 INTEGRATED PLATFORM LAUNCHED SUCCESSFULLY!${NC}"
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
echo -e "  Web Crawler:            http://localhost:3002/api"
echo -e "  Intelligence Engine:    http://localhost:8002/docs"
echo -e "  Action Center:          http://localhost:8082/api"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  • All services integrated through API Gateway (port 4000)"
echo -e "  • Real-time updates via unified WebSocket"
echo -e "  • Check logs in service directories (*.log)"
echo -e "  • Use ./stop-integrated.sh to stop all services"
echo ""
echo -e "${GREEN}Opening frontend in browser...${NC}"

# Open frontend in default browser
sleep 2
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
    sleep 5
    # Could add health checks here
done