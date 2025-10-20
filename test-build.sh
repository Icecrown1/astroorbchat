#!/bin/sh
set -e
echo "Starting build"
CI=true vite build
echo "Vite done"
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
echo "esbuild done"
mkdir -p dist/server dist/server/lib/prompts
echo "Directories created"
cp server/natal_chart_api.py server/transit_events_api.py dist/server/
echo "Python files copied"
cp server/lib/prompts/*.md dist/server/lib/prompts/
echo "Prompts copied"
echo "Build complete"
exit 0
