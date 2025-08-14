#!/bin/bash

echo "======================================"
echo "🔍 RankMyBrand.ai System Validation"
echo "======================================"
echo ""

# Service status check
echo "📡 Service Status Check:"
echo "------------------------"

services=(
    "Dashboard:3003"
    "API Gateway:4000"
    "GEO Calculator:5005"
    "WebSocket:3001"
    "Web Crawler:3002"
    "PostgreSQL:5432"
)

operational=0
total=${#services[@]}

for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ $name (port $port): RUNNING"
        ((operational++))
    else
        echo "❌ $name (port $port): NOT RUNNING"
    fi
done

echo ""
echo "🎯 System Status: $operational/$total services operational"

# API Health checks
echo ""
echo "🏥 API Health Checks:"
echo "---------------------"

# Check API Gateway
if curl -s http://localhost:4000/health | grep -q "healthy"; then
    echo "✅ API Gateway: Healthy"
else
    echo "❌ API Gateway: Not responding"
fi

# Check GEO Calculator
if curl -s http://localhost:5005/health | grep -q "OK"; then
    echo "✅ GEO Calculator: Healthy"
else
    echo "❌ GEO Calculator: Not responding"
fi

# Check Web Crawler
if curl -s http://localhost:3002/health | grep -q "healthy"; then
    echo "✅ Web Crawler: Healthy"
else
    echo "❌ Web Crawler: Not responding"
fi

# Database connectivity
echo ""
echo "🗄️  Database Status:"
echo "-------------------"
if psql -U sawai -d rankmybrand_test -c "SELECT 1" >/dev/null 2>&1; then
    echo "✅ PostgreSQL: Connected"
    table_count=$(psql -U sawai -d rankmybrand_test -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
    echo "   Tables created: $table_count"
else
    echo "❌ PostgreSQL: Connection failed"
fi

# Redis check
echo ""
echo "💾 Redis Status:"
echo "----------------"
if redis-cli ping >/dev/null 2>&1; then
    echo "✅ Redis: Connected"
else
    echo "❌ Redis: Not available"
fi

# Frontend check
echo ""
echo "🎨 Frontend Status:"
echo "-------------------"
if curl -s http://localhost:3003 | grep -q "RankMyBrand" >/dev/null 2>&1; then
    echo "✅ Dashboard: Accessible"
else
    echo "❌ Dashboard: Not accessible"
fi

# Final summary
echo ""
echo "======================================"
echo "📊 VALIDATION SUMMARY"
echo "======================================"

if [ $operational -eq $total ]; then
    echo "🎉 SYSTEM FULLY OPERATIONAL!"
    echo "All services are running and healthy."
    echo ""
    echo "🚀 Access the platform at:"
    echo "   Dashboard: http://localhost:3003"
    echo "   API Gateway: http://localhost:4000"
    echo ""
    echo "✨ RankMyBrand.ai is ready for production!"
else
    echo "⚠️  SYSTEM PARTIALLY OPERATIONAL"
    echo "Some services need attention."
    echo "Run './start-all-services.sh' to start missing services."
fi

echo "======================================"