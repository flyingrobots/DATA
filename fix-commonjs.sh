#!/bin/bash
# Script to systematically convert CommonJS to ESM

set -e

echo "🔧 Converting CommonJS to ESM..."

# Function to convert a single file
convert_file() {
  local file=$1
  echo "Converting: $file"
  
  # Create backup
  cp "$file" "$file.bak"
  
  # Convert require statements
  # const x = require('y') -> import x from 'y'
  sed -i '' "s/const \([a-zA-Z_][a-zA-Z0-9_]*\) = require(\(.*\))/import \1 from \2/g" "$file"
  
  # const { x, y } = require('z') -> import { x, y } from 'z'
  sed -i '' "s/const { \(.*\) } = require(\(.*\))/import { \1 } from \2/g" "$file"
  
  # Fix relative imports - add .js extension
  sed -i '' "s/from '\(\.\.[^']*\)'/from '\1.js'/g" "$file"
  sed -i '' 's/from "\(\.\.[^"]*\)"/from "\1.js"/g' "$file"
  
  # Fix double .js.js
  sed -i '' "s/\.js\.js'/.js'/g" "$file"
  sed -i '' 's/\.js\.js"/.js"/g' "$file"
  
  # module.exports = x -> export default x
  sed -i '' 's/^module\.exports = \(.*\);$/export default \1;/g' "$file"
  
  # module.exports = { -> export {
  sed -i '' 's/^module\.exports = {$/export {/g' "$file"
  
  # exports.x = y -> export const x = y
  sed -i '' 's/^exports\.\([a-zA-Z_][a-zA-Z0-9_]*\) = \(.*\);$/export const \1 = \2;/g' "$file"
  
  echo "✓ Converted $file"
}

# Convert each file
for file in $(cat /tmp/all-commonjs-files.txt); do
  if [[ "$file" == *"codemods"* ]]; then
    echo "Skipping codemod file: $file"
    continue
  fi
  convert_file "$file"
done

echo "✅ Conversion complete!"
echo ""
echo "🔍 Checking for remaining CommonJS patterns..."
grep -r "require(" . --include="*.js" --exclude-dir=node_modules --exclude-dir=.obsidian --exclude="*.bak" | grep -v "codemods" | wc -l