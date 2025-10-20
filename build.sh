#!/bin/bash
set -e

echo "🔨 Building Astro Orb for production..."
echo ""

# Step 1: Verify Python environment (but don't fail if pyswisseph is missing during build)
echo "🐍 Checking Python environment..."
python3 --version || { echo "⚠️ Python3 not found"; exit 1; }

# Check pyswisseph but allow build to continue even if missing
# (it will be installed via requirements.txt during deployment)
if python3 -c "import swisseph" 2>/dev/null; then
  echo "✓ pyswisseph available"
else
  echo "⚠️ pyswisseph not found locally (will be installed from requirements.txt during deployment)"
fi
echo ""

# Step 2: Build frontend with Vite
echo "📦 Building frontend..."
vite build
echo ""

# Step 3: Bundle backend with esbuild
echo "⚙️ Bundling backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo ""

# Step 4: Copy Python scripts
echo "🐍 Copying Python scripts..."
mkdir -p dist/server
cp server/natal_chart_api.py dist/server/
cp server/transit_events_api.py dist/server/
echo "✓ Python scripts copied"
echo ""

# Step 5: Copy prompt templates
echo "📝 Copying AI prompt templates..."
mkdir -p dist/server/lib/prompts
cp -r server/lib/prompts/* dist/server/lib/prompts/
echo "✓ Prompts copied"
echo ""

echo "✅ Build complete!"
echo ""
echo "Build artifacts:"
ls -lh dist/ 2>/dev/null | grep -v total || echo "⚠️ dist directory check failed"
echo ""
echo "Python scripts:"
ls -lh dist/server/*.py 2>/dev/null || echo "⚠️ Python scripts check failed"
echo ""
echo "Prompts:"
ls dist/server/lib/prompts/ 2>/dev/null || echo "⚠️ Prompts check failed"
echo ""
echo "🚀 Ready for deployment!"
