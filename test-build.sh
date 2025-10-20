#!/bin/bash
set -e

echo "=== Testing Build Process ==="

# Test 1: Check build.sh exists and is executable
if [ -x "build.sh" ]; then
  echo "✓ build.sh is executable"
else
  echo "✗ build.sh is not executable"
  chmod +x build.sh
  echo "  → Fixed: made build.sh executable"
fi

# Test 2: Check requirements.txt exists
if [ -f "requirements.txt" ]; then
  echo "✓ requirements.txt exists"
  cat requirements.txt
else
  echo "✗ requirements.txt missing"
fi

# Test 3: Check pyproject.toml
if [ -f "pyproject.toml" ]; then
  echo "✓ pyproject.toml exists"
else
  echo "✗ pyproject.toml missing"
fi

# Test 4: Verify Python can import swisseph
echo ""
echo "Testing Python import..."
python3 -c "import swisseph; print('✓ swisseph imports successfully')" || echo "✗ swisseph import failed"

echo ""
echo "=== Build Test Complete ==="
