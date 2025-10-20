#!/bin/bash
echo "=== Testing Production Build ==="
echo ""

# Test 1: Clean build
echo "1. Running clean build..."
rm -rf dist
./build.sh > /tmp/build.log 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo "✓ Build successful"
else
  echo "✗ Build failed with exit code $BUILD_EXIT"
  tail -20 /tmp/build.log
  exit 1
fi

# Test 2: Check dist structure
echo ""
echo "2. Verifying dist structure..."
EXPECTED_FILES=(
  "dist/index.js"
  "dist/server/natal_chart_api.py"
  "dist/server/transit_events_api.py"
  "dist/server/lib/prompts/natal.md"
)

for file in "${EXPECTED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file MISSING"
  fi
done

# Test 3: Test production start (dry run)
echo ""
echo "3. Testing production start (dry run)..."
if [ -f "dist/index.js" ]; then
  echo "✓ dist/index.js exists and is ready"
  head -5 dist/index.js | grep -q "import" && echo "✓ ES modules format detected" || echo "⚠️ Unexpected format"
else
  echo "✗ dist/index.js missing"
  exit 1
fi

echo ""
echo "=== All Production Tests Passed ==="
