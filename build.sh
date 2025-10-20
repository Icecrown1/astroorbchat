#!/bin/bash
set -e

echo "🔨 Building Astro Orb for production..."
echo ""

# Check Python availability
echo "🐍 Verifying Python environment..."
python3 --version
python3 -c "import swisseph; print('✓ pyswisseph available')" || {
  echo "⚠️ pyswisseph not found - it should be installed from requirements.txt"
  exit 1
}
echo ""

# Step 1: Build frontend with Vite
echo "📦 Building frontend..."
vite build
echo ""

# Step 2: Bundle backend with esbuild
echo "⚙️ Bundling backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo ""

# Step 3: Copy Python scripts
echo "🐍 Copying Python scripts..."
mkdir -p dist/server
cp server/natal_chart_api.py dist/server/
cp server/transit_events_api.py dist/server/
echo "✓ Python scripts copied"
echo ""

# Step 4: Copy prompt templates
echo "📝 Copying AI prompt templates..."
mkdir -p dist/server/lib/prompts
cp -r server/lib/prompts/* dist/server/lib/prompts/
echo "✓ Prompts copied"
echo ""

echo "✅ Build complete!"
echo ""
echo "Build artifacts:"
ls -lh dist/
echo ""
echo "Python scripts:"
ls -lh dist/server/*.py
echo ""
echo "Prompts:"
ls dist/server/lib/prompts/
echo ""
echo "🚀 Ready for deployment!"
