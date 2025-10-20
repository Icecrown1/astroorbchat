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
  // Add health check endpoint FIRST - before any other setup
  // This ensures Replit can check if the app is alive immediately
  app.get('/health', (_req, res) => {
    console.log('[Health] Health check requested');
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  console.log('[STARTUP] Starting application initialization...');

  // SECURITY: Verify critical environment variables at startup
  const REQUIRED_SECRETS = ['SESSION_SECRET', 'JWT_SECRET', 'DATABASE_URL', 'TELEGRAM_BOT_TOKEN'];
  const missingSecrets = REQUIRED_SECRETS.filter(secret => !process.env[secret]);
  
  if (missingSecrets.length > 0) {
    console.error(`[STARTUP] FATAL ERROR: Missing required environment variables: ${missingSecrets.join(', ')}`);
    console.error('[STARTUP] Please configure these secrets in the Replit Secrets panel');
    process.exit(1);
  }
  console.log('[STARTUP] ✓ All required secrets configured');

  console.log('[STARTUP] Registering routes...');
  const server = await registerRoutes(app);
  console.log('[STARTUP] ✓ Routes registered successfully');

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
  
  console.log(`[STARTUP] Starting server on port ${port} (host: 0.0.0.0)...`);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`[STARTUP] ✅ SERVER READY - listening on port ${port}`);
    console.log(`[STARTUP] Health check available at: /health`);
    log(`serving on port ${port}`);
  });
})();
