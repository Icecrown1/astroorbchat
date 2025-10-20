# 🚀 Deployment Guide for Astro Orb

## Prerequisites

### Required Files
- ✅ `requirements.txt` - Python dependencies (pyswisseph)
- ✅ `pyproject.toml` - Python project metadata
- ✅ `build.sh` - Custom build script
- ✅ All AI prompts in `server/lib/prompts/`
- ✅ Python scripts: `natal_chart_api.py`, `transit_events_api.py`

### Required Configuration

#### 1. Update `.replit` file
Change line 10 from:
```toml
build = ["npm", "run", "build"]
```

To:
```toml
build = ["sh", "-c", "./build.sh"]
```

#### 2. Verify Environment Variables
All secrets should be configured in Replit Secrets:
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `JWT_SECRET`
- `SESSION_SECRET`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `TON_WALLET_ADDRESS`
- `TELEGRAM_WEBHOOK_SECRET`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`

## Build Process

The `build.sh` script performs these steps:
1. Verifies Python and pyswisseph installation
2. Builds frontend with Vite
3. Bundles backend with esbuild
4. Copies Python scripts to `dist/server/`
5. Copies AI prompts to `dist/server/lib/prompts/`

## Deployment Steps

1. **Update `.replit`** as described above
2. **Verify requirements.txt** exists with:
   ```
   pyswisseph>=2.10.3.2
   ```
3. **Click "Publish"** in Replit
4. **Monitor deployment** - build should complete successfully
5. **Test production app** at the deployed URL

## Troubleshooting

### No Build Logs
- Verify `.replit` has correct build command
- Check that `build.sh` is executable: `chmod +x build.sh`

### Python Import Errors
- Ensure `requirements.txt` exists
- Verify pyswisseph is listed in requirements.txt

### Missing Files in Production
- Check build.sh copied all necessary files
- Verify dist/ structure includes server/ directory

## Verification Commands

Test build locally:
```bash
./build.sh
```

Check build output:
```bash
find dist -type f | sort
```

Test production server locally:
```bash
NODE_ENV=production PORT=5001 node dist/index.js
```
