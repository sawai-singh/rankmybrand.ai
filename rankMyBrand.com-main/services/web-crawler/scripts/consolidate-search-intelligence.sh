#!/bin/bash

echo "🔧 Consolidating Search Intelligence into Monolithic Structure"
echo "============================================================="

# Set paths
SOURCE_DIR="/Users/sawai/Desktop/rankmybrand.ai/services/web-crawler/src/search-intelligence"
TARGET_DIR="/Users/sawai/Desktop/rankmybrand.ai/rankMyBrand.com-main/services/web-crawler/src/search-intelligence"

# Check if source exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory not found: $SOURCE_DIR"
    exit 1
fi

# Check if target already exists
if [ -d "$TARGET_DIR" ]; then
    echo "⚠️  Target directory already exists. Backing up..."
    mv "$TARGET_DIR" "${TARGET_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copy all Search Intelligence files
echo "📁 Copying Search Intelligence files..."
cp -r "$SOURCE_DIR" "$TARGET_DIR"

# Fix import paths in the copied files
echo "🔄 Fixing import paths for monolithic structure..."

# Function to fix imports in a file
fix_imports() {
    local file=$1
    echo "  Fixing: $(basename $file)"
    
    # Fix logger imports
    sed -i '' 's|from '\''\.\.\/utils\/logger\.js'\''|from '\''../../utils/logger.js'\''|g' "$file"
    sed -i '' 's|from '\''\.\.\/db\/index\.js'\''|from '\''../../db/index.js'\''|g' "$file"
    sed -i '' 's|from '\''\.\.\/queue\/|from '\''../../queue/|g' "$file"
    
    # Fix relative imports within search-intelligence
    sed -i '' 's|from '\''\.\.\/search-intelligence-service\.js'\''|from '\''../search-intelligence-service.js'\''|g' "$file"
    sed -i '' 's|from '\''\.\.\/types\/|from '\''../types/|g' "$file"
}

# Fix all TypeScript files
find "$TARGET_DIR" -name "*.ts" -type f | while read file; do
    fix_imports "$file"
done

echo ""
echo "✅ Consolidation complete!"
echo ""
echo "📊 Statistics:"
echo "   Files copied: $(find $TARGET_DIR -name "*.ts" -type f | wc -l | xargs)"
echo "   Test files: $(find $TARGET_DIR/__tests__ -name "*.ts" -type f 2>/dev/null | wc -l | xargs)"
echo "   Core components: $(find $TARGET_DIR/core -name "*.ts" -type f | wc -l | xargs)"
echo ""
echo "🎯 Next steps:"
echo "1. Update tsconfig.json paths to use local search-intelligence"
echo "2. Fix any remaining import issues"
echo "3. Run tests to verify functionality"
echo ""
echo "✨ Search Intelligence is now part of the monolith!"