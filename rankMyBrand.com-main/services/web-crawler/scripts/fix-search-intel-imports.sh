#!/bin/bash

echo "🔧 Fixing Search Intelligence Import Paths"
echo "========================================="

TARGET_DIR="/Users/sawai/Desktop/rankmybrand.ai/rankMyBrand.com-main/services/web-crawler/src/search-intelligence"

# Fix imports in core directory
echo "📁 Fixing core imports..."
find "$TARGET_DIR/core" -name "*.ts" -type f | while read file; do
    echo "  Fixing: $(basename $file)"
    
    # Fix Logger imports
    sed -i '' 's|from '\''\.\.\.\/utils\/logger\.js'\''|from '\''../utils/logger.js'\''|g' "$file"
    
    # Fix rate-limiter imports
    sed -i '' 's|from '\''\.\.\.\/utils\/rate-limiter\.js'\''|from '\''../utils/rate-limiter.js'\''|g' "$file"
    
    # Fix cache-manager imports
    sed -i '' 's|from '\''\.\.\.\/utils\/cache-manager\.js'\''|from '\''../utils/cache-manager.js'\''|g' "$file"
    
    # Fix budget-manager imports
    sed -i '' 's|from '\''\.\.\.\/utils\/budget-manager\.js'\''|from '\''../utils/budget-manager.js'\''|g' "$file"
    
    # Fix circuit-breaker imports
    sed -i '' 's|from '\''\.\.\.\/utils\/circuit-breaker\.js'\''|from '\''../utils/circuit-breaker.js'\''|g' "$file"
done

# Fix imports in repository directory
echo "📁 Fixing repository imports..."
find "$TARGET_DIR/repositories" -name "*.ts" -type f | while read file; do
    echo "  Fixing: $(basename $file)"
    
    # Fix db imports
    sed -i '' 's|from '\''\.\.\.\/db\/index\.js'\''|from '\''../../db/index.js'\''|g' "$file"
    
    # Fix Logger imports
    sed -i '' 's|from '\''\.\.\.\/utils\/logger\.js'\''|from '\''../utils/logger.js'\''|g' "$file"
done

echo ""
echo "✅ Import paths fixed!"