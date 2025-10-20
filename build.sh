#!/bin/bash
set -e

echo "Building Astro Orb..."

# Build frontend (non-interactive)
echo "Building frontend..."
CI=true vite build

# Bundle backend
echo "Bundling backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Copy Python scripts
echo "Copying Python scripts..."
mkdir -p dist/server
cp server/natal_chart_api.py dist/server/
cp server/transit_events_api.py dist/server/

# Copy AI prompts
echo "Copying AI prompts..."
mkdir -p dist/server/lib/prompts
cp -r server/lib/prompts/* dist/server/lib/prompts/

echo "Build complete!"
