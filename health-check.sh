#!/bin/bash

# RankMyBrand System Health Check Script
# Checks all active services and reports their status

echo "================================================"
echo "    RankMyBrand System Health Check"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if service is running
check_service() {
    local name=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    echo -n "Checking $name (port $port)... "
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        # Port is open, try health endpoint
        response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port$endpoint 2>/dev/null)
        
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✓ HEALTHY${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ RUNNING (health check failed: HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ NOT RUNNING${NC}"
        return 1
    fi
}

# Check database
check_database() {
    echo -n "Checking PostgreSQL (port 5432)... "
    
    if command -v psql &> /dev/null; then
        if PGPASSWORD=${DB_PASSWORD:-""} psql -h localhost -U ${DB_USER:-sawai} -d rankmybrand -c "SELECT 1" &> /dev/null; then
            echo -e "${GREEN}✓ CONNECTED${NC}"
            
            # Check table count
            table_count=$(PGPASSWORD=${DB_PASSWORD:-""} psql -h localhost -U ${DB_USER:-sawai} -d rankmybrand -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | xargs)
            echo "  └─ Tables: $table_count"
            return 0
        else
            echo -e "${RED}✗ CONNECTION FAILED${NC}"
            return 1
        fi
    else
        if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠ RUNNING (psql not installed)${NC}"
        else
            echo -e "${RED}✗ NOT RUNNING${NC}"
        fi
        return 1
    fi
}

# Check Redis
check_redis() {
    echo -n "Checking Redis (port 6379)... "
    
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✓ CONNECTED${NC}"
            
            # Check memory usage
            memory=$(redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
            echo "  └─ Memory: $memory"
            return 0
        else
            echo -e "${RED}✗ CONNECTION FAILED${NC}"
            return 1
        fi
    else
        if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠ RUNNING (redis-cli not installed)${NC}"
        else
            echo -e "${RED}✗ NOT RUNNING${NC}"
        fi
        return 1
    fi
}

# Count running processes
count_node_processes() {
    local count=$(ps aux | grep -E "node|npm|tsx" | grep -v grep | wc -l)
    echo "Node.js processes running: $count"
}

# Count Python processes
count_python_processes() {
    local count=$(ps aux | grep -E "python|uvicorn" | grep -v grep | wc -l)
    echo "Python processes running: $count"
}

# Check disk usage
check_disk_usage() {
    echo -n "Disk usage: "
    df -h . | awk 'NR==2 {print $5 " used (" $4 " available)"}'
}

# Main health check
echo "🔍 Checking Core Infrastructure..."
echo "=================================="
check_database
check_redis
echo ""

echo "🚀 Checking Active Services..."
echo "=================================="
check_service "API Gateway" 4000
check_service "Intelligence Engine" 8002
check_service "Web Crawler" 3002
check_service "Dashboard" 3000 "/"
check_service "Frontend" 3003 "/"
echo ""

echo "📊 System Statistics..."
echo "=================================="
count_node_processes
count_python_processes
check_disk_usage
echo ""

# Check for zombie services (should not be running)
echo "🧟 Checking for Zombie Services..."
echo "=================================="
zombie_found=false

check_zombie() {
    local name=$1
    local port=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}⚠ $name is running on port $port (should be removed)${NC}"
        zombie_found=true
    fi
}

check_zombie "AI Response Monitor" 8001
check_zombie "Foundation Service" 3005
check_zombie "Action Center" 8082

if [ "$zombie_found" = false ]; then
    echo -e "${GREEN}✓ No zombie services found${NC}"
fi

echo ""
echo "================================================"
echo "Health check complete!"
echo "================================================"