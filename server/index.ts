import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // SECURITY: Verify critical environment variables at startup
  const REQUIRED_SECRETS = ['SESSION_SECRET', 'JWT_SECRET', 'DATABASE_URL', 'TELEGRAM_BOT_TOKEN'];
  for (const secret of REQUIRED_SECRETS) {
    if (!process.env[secret]) {
      console.error(`[STARTUP] FATAL ERROR: Required environment variable ${secret} is not set`);
      process.exit(1);
    }
  }
  console.log('[STARTUP] ✓ All required secrets configured');

  // SUPPORT_CHAT_ID is optional but important — warn if missing so misconfiguration is caught early
  if (!process.env.SUPPORT_CHAT_ID) {
    console.warn('[STARTUP] WARNING: SUPPORT_CHAT_ID is not set — support alerts will be dropped to console instead of sent via Telegram');
  }

  const server = await registerRoutes(app);

  // Run payment reconciliation every 2 hours to catch any missed webhook activations
  const RECONCILE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const runReconciliation = async () => {
    try {
      const port = parseInt(process.env.PORT || '5000', 10);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) headers['x-cron-secret'] = cronSecret;

      const res = await fetch(`http://localhost:${port}/api/cron/reconcile-payments`, {
        method: 'POST',
        headers,
      });
      const data = await res.json() as any;
      console.log('[RECONCILE] Scheduled run result:', JSON.stringify(data.results));
    } catch (err: any) {
      console.error('[RECONCILE] Scheduled run failed:', err?.message);
    }
  };

  // Initial run after 5 minutes (give server time to fully start)
  setTimeout(runReconciliation, 5 * 60 * 1000);
  // Repeat every 2 hours
  setInterval(runReconciliation, RECONCILE_INTERVAL_MS);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const appEnv = app.get("env");
  console.log('app.get("env"):', appEnv);
  console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
  
  if (appEnv === "development") {
    console.log('Setting up Vite in development mode');
    await setupVite(app, server);
  } else {
    console.log('Serving static files in production mode');
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
