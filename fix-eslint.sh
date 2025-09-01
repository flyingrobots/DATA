#!/bin/bash

# Fix ESLint errors systematically

echo "🔧 Fixing ESLint errors..."

# Fix unused variables by prefixing with underscore
echo "📝 Fixing unused variables..."
find ./starfleet ./src ./test -name "*.js" -type f | while read file; do
  # Fix unused error variables
  sed -i '' 's/catch (error)/catch (_error)/g' "$file"
  sed -i '' 's/\.catch(error/\.catch(_error/g' "$file"
  
  # Fix unused function parameters
  sed -i '' 's/function([^)]*\boptions\b/function(_options/g' "$file"
  sed -i '' 's/(\([^)]*\), reject)/(\1, _reject)/g' "$file"
done

# Remove redundant await on return
echo "📝 Removing redundant await on return..."
find ./starfleet ./src ./test -name "*.js" -type f | while read file; do
  sed -i '' 's/return await /return /g' "$file"
done

# Fix async functions with no await by removing async
echo "📝 Fixing async functions with no await..."
find ./starfleet ./src ./test -name "*.js" -type f | while read file; do
  # This is more complex, so we'll just flag them for now
  grep -n "Async.*has no 'await'" "$file" 2>/dev/null && echo "  ⚠️ $file has async functions without await"
done

echo "✅ Basic fixes complete!"
echo "🔍 Running ESLint again..."
pnpm eslint src starfleet test 2>&1 | tail -5