#!/bin/bash
set -e

# Minimal build script for Replit Autoscale
# No fancy output, just the essential steps

CI=true vite build
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
mkdir -p dist/server dist/server/lib/prompts
cp server/natal_chart_api.py server/transit_events_api.py dist/server/
cp server/lib/prompts/*.md dist/server/lib/prompts/

echo "Build done"
