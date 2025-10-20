#!/bin/sh
set -e

echo "[START] Checking if build is needed..."

# Check if dist exists and has the required files
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ] || [ ! -f "dist/server/natal_chart_api.py" ]; then
  echo "[START] Build required, running build.sh..."
  sh build.sh
else
  echo "[START] Build exists, skipping build step"
fi

echo "[START] Starting application..."
NODE_ENV=production node dist/index.js
