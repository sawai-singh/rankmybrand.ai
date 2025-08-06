#!/bin/bash

echo "🔍 Search Intelligence Files Available:"
echo "====================================="
echo ""

# Find all Search Intelligence files
echo "📁 Core Components:"
ls -la /Users/sawai/Desktop/rankmybrand.ai/services/web-crawler/src/search-intelligence/core/ | grep -E "\.ts$" | awk '{print "   ✓", $9}'

echo ""
echo "📁 API Routes:"
ls -la /Users/sawai/Desktop/rankmybrand.ai/services/web-crawler/src/search-intelligence/api/ | grep -E "\.ts$" | awk '{print "   ✓", $9}'

echo ""
echo "📁 Utils:"
ls -la /Users/sawai/Desktop/rankmybrand.ai/services/web-crawler/src/search-intelligence/utils/ | grep -E "\.ts$" | awk '{print "   ✓", $9}'

echo ""
echo "📁 Test Files:"
find /Users/sawai/Desktop/rankmybrand.ai/services/web-crawler/src/search-intelligence/__tests__ -name "*.ts" -type f | xargs -I {} basename {} | sort | uniq | head -10 | awk '{print "   ✓", $0}'

echo ""
echo "📊 Total Search Intelligence Files:"
find /Users/sawai/Desktop/rankmybrand.ai/services/web-crawler/src/search-intelligence -name "*.ts" -type f | wc -l | awk '{print "   "$1" TypeScript files"}'

echo ""
echo "✨ These files implement:"
echo "   • Query Generation (v1 and v2)"
echo "   • SERP Client with multi-provider support"
echo "   • Ranking Analysis with AI prediction"
echo "   • Brand Authority Scoring"
echo "   • Competitor Analysis"
echo "   • WebSocket real-time updates"
echo "   • Comprehensive testing suite"
echo "   • Production monitoring"