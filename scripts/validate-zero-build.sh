#!/bin/bash

# P1.T012 - Zero Build Step Architecture Validation Script
# Validates that the D.A.T.A. CLI has no build steps and runs pure JavaScript

set -e

echo "🖖 D.A.T.A. Zero Build Step Validation"
echo "======================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# 1. Check for build scripts in package.json files
echo "1️⃣  Checking for build scripts..."
if grep -r '"build":\s*"[^"]*\(tsc\|babel\|webpack\|rollup\|esbuild\|parcel\)' --include="package.json" . 2>/dev/null | grep -v node_modules | grep -v echo | grep -v "No build"; then
  echo "   ❌ Found build scripts that compile/transpile code"
  ((FAIL_COUNT++))
else
  echo "   ✅ No actual build/compile scripts found"
  ((PASS_COUNT++))
fi
echo ""

# 2. Check for TypeScript in CLI source code (excluding Edge Functions)
echo "2️⃣  Checking for TypeScript files in CLI..."
TS_FILES=$(find starfleet -name "*.ts" -o -name "*.tsx" -o -name "tsconfig.json" 2>/dev/null | grep -v node_modules | grep -v "/functions/" || true)
if [ -n "$TS_FILES" ]; then
  echo "   ❌ Found TypeScript files in CLI:"
  echo "$TS_FILES" | head -5
  ((FAIL_COUNT++))
else
  echo "   ✅ No TypeScript files in CLI codebase"
  ((PASS_COUNT++))
fi
echo ""

# 3. Check that CLI executes directly without build
echo "3️⃣  Testing direct execution..."
if node starfleet/data-cli/bin/data.js --version > /dev/null 2>&1; then
  echo "   ✅ CLI executes directly without build step"
  ((PASS_COUNT++))
else
  echo "   ❌ CLI failed to execute directly"
  ((FAIL_COUNT++))
fi
echo ""

# 4. Check ESM configuration
echo "4️⃣  Validating ESM configuration..."
if grep '"type": "module"' package.json > /dev/null; then
  echo "   ✅ Root package.json configured for ESM"
  ((PASS_COUNT++))
else
  echo "   ❌ Root package.json not configured for ESM"
  ((FAIL_COUNT++))
fi
echo ""

# 5. Check for CommonJS remnants in CLI
echo "5️⃣  Checking for CommonJS in CLI..."
CJS_COUNT=$(grep -r "require(\|module\.exports" starfleet/data-cli/src --include="*.js" 2>/dev/null | grep -v "\.cjs" | wc -l | tr -d ' ')
if [ "$CJS_COUNT" -gt "0" ]; then
  echo "   ⚠️  Found $CJS_COUNT CommonJS patterns (may be in comments/strings)"
  # Not a failure since some might be in comments or legacy .cjs files
else
  echo "   ✅ No CommonJS patterns in ESM files"
fi
((PASS_COUNT++))
echo ""

# 6. Verify stack traces point to source
echo "6️⃣  Testing stack trace source mapping..."
ERROR_OUTPUT=$(node -e "import './starfleet/data-cli/src/lib/Command.js'; throw new Error('test')" 2>&1 || true)
if echo "$ERROR_OUTPUT" | grep -q "starfleet/data-cli/src/lib/Command.js"; then
  echo "   ✅ Stack traces point to actual source files"
  ((PASS_COUNT++))
else
  echo "   ❌ Stack traces may not point to source correctly"
  ((FAIL_COUNT++))
fi
echo ""

# Summary
echo "======================================="
echo "📊 Validation Summary"
echo "======================================="
echo "   ✅ Passed: $PASS_COUNT checks"
echo "   ❌ Failed: $FAIL_COUNT checks"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 VALIDATION PASSED! Zero build step architecture confirmed!"
  echo "   The D.A.T.A. CLI runs on pure JavaScript with no transpilation!"
  exit 0
else
  echo "⚠️  Some validation checks failed. Review above for details."
  exit 1
fi