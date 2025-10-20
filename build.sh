#!/bin/bash
set -e

echo "🔨 Building application..."

# Step 1: Build frontend with Vite
echo "📦 Building frontend..."
vite build

# Step 2: Bundle backend with esbuild
echo "⚙️ Bundling backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Step 3: Copy Python scripts
echo "🐍 Copying Python scripts..."
mkdir -p dist/server
cp server/natal_chart_api.py dist/server/
cp server/transit_events_api.py dist/server/

# Step 4: Copy prompt templates
echo "📝 Copying prompt templates..."
mkdir -p dist/server/lib/prompts
cp -r server/lib/prompts/* dist/server/lib/prompts/

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
