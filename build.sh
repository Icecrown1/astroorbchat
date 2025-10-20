#!/bin/sh
set -ex

echo "=== BUILD START ==="
date

echo "Step 1/5: Vite build..."
CI=true vite build
echo "✓ Vite done"

echo "Step 2/5: esbuild backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "✓ esbuild done"

echo "Step 3/5: Creating directories..."
mkdir -p dist/server dist/server/lib/prompts
echo "✓ Directories created"

echo "Step 4/5: Copying Python scripts..."
cp server/natal_chart_api.py server/transit_events_api.py dist/server/
echo "✓ Python scripts copied"

echo "Step 5/5: Copying AI prompts..."
cp server/lib/prompts/*.md dist/server/lib/prompts/
echo "✓ AI prompts copied"

echo "=== BUILD COMPLETE ==="
date
exit 0
