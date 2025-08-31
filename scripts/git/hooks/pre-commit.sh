#!/bin/bash

# data Pre-commit Hook
# Runs ESLint to check for async/await issues and other problems

echo "=
 Running ESLint checks..."

# Get the root directory of the git repository
GIT_ROOT=$(git rev-parse --show-toplevel)

# Change to the git root directory
cd "$GIT_ROOT" || exit 1

# Get list of staged JavaScript files (exclude node_modules and only include src/)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$' | grep -E '^(src/|bin/|scripts/)' | grep -v node_modules)

if [ -z "$STAGED_FILES" ]; then
  echo " No JavaScript files to lint"
  exit 0
fi

echo "=� Checking files:"
echo "$STAGED_FILES" | sed 's/^/  - /'

# Run ESLint on staged files
npx eslint $STAGED_FILES

ESLINT_EXIT=$?

if [ $ESLINT_EXIT -eq 0 ]; then
  echo " ESLint checks passed!"
else
  echo "L ESLint found issues. Please fix them before committing."
  echo ""
  echo "=� Tip: You can run 'npm run lint:fix' to auto-fix some issues"
  exit 1
fi

# Check specifically for async/await issues
echo ""
echo "=
 Checking for floating promises and async issues..."

# Look for common async/await problems in staged files
for file in $STAGED_FILES; do
  # Check for .then() without catch
  if grep -E '\.then\([^)]*\)[^.]*(;|$)' "$file" > /dev/null 2>&1; then
    echo "�  Warning: $file may have unhandled promises (.then without .catch)"
  fi
  
  # Check for async functions without await
  if grep -E 'async\s+[^{]*\{[^}]*\}' "$file" | grep -v await > /dev/null 2>&1; then
    echo "�  Warning: $file may have async functions without await"
  fi
done

echo "Keeping JSDoc up-to-date..."
git diff --cached --name-only | grep '\\.js$' | xargs -I {} claude -p 'Add/Update JSDoc, summarize what ya did' {}

echo " Pre-commit checks complete!"
exit 0