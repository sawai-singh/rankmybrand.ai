#!/bin/bash

echo "🔧 Comprehensive Search Intelligence Import Fix"
echo "=============================================="

TARGET_DIR="/Users/sawai/Desktop/rankmybrand.ai/rankMyBrand.com-main/services/web-crawler/src/search-intelligence"

# Fix all import paths to use relative imports within search-intelligence
find "$TARGET_DIR" -name "*.ts" -type f | while read file; do
    # Skip test files for now
    if [[ "$file" == *"test"* ]]; then
        continue
    fi
    
    echo "Fixing: $(basename $file)"
    
    # Fix Logger imports - should use local utils
    sed -i '' 's|from '\''\.\.\/\.\.\/utils\/logger\.js'\''|from '\''../utils/logger.js'\''|g' "$file"
    sed -i '' 's|from '\''\.\.\/utils\/logger\.js'\''|from '\''./utils/logger.js'\''|g' "$file"
    
    # Fix rate-limiter imports
    sed -i '' 's|from '\''\.\.\/\.\.\/utils\/rate-limiter\.js'\''|from '\''../utils/rate-limiter.js'\''|g' "$file"
    
    # Fix cache-manager imports
    sed -i '' 's|from '\''\.\.\/\.\.\/utils\/cache-manager\.js'\''|from '\''../utils/cache-manager.js'\''|g' "$file"
    
    # Fix all other utils imports
    sed -i '' 's|from '\''\.\.\/\.\.\/utils\/\([^'\'']*\)\.js'\''|from '\''../utils/\1.js'\''|g' "$file"
    
    # Fix db imports
    sed -i '' 's|from '\''\.\.\/\.\.\/db\/|from '\''../../db/|g' "$file"
    sed -i '' 's|from '\''\.\.\/db\/|from '\''../db/|g' "$file"
    
    # Fix queue imports
    sed -i '' 's|from '\''\.\.\/\.\.\/queue\/|from '\''../../queue/|g' "$file"
done

echo ""
echo "✅ All imports fixed!"