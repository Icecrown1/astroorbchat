import express, { type Express, type RequestHandler } from 'express';
import { registerRoutes } from './routes';
import { requireAuth } from './middleware/auth';
import { recomputeIfProfileChanged } from './lib/natalService';
import { storage } from './storage';

// Forward exact HTTP methods and paths to the same handlers used by the app.
// The child application is never mounted as a catch-all or opened on a port.
export async function registerMobileInternalRoutes(app: Express, aiEnabled: boolean) {
  const shared = express();
  await registerRoutes(shared);
  const serve: RequestHandler = (req, res, next) => shared(req, res, next);
  const generated: RequestHandler = (req, res, next) => {
    if (aiEnabled) return serve(req, res, next);
    return res.status(503).json({ ok: false, error: 'internal_ai_unavailable' });
  };
  if (!aiEnabled) {
    // The base chart is useful without a generated interpretation.
    app.get('/api/natal/me', requireAuth, async (req, res, next) => {
      try {
        const { userId } = req as typeof req & { userId: string };
        await recomputeIfProfileChanged(userId);
        const chart = await storage.getNatalChart(userId);
        if (!chart) return res.status(409).json({ ok: false, error: 'NATAL_NOT_INITIALIZED' });
        res.json({ ok: true, data: chart });
      } catch (error) { next(error); }
    });
  }
  app.get([
    '/api/cities/search', '/api/tarot/history', '/api/tarot/status', '/api/natal/me',
    '/api/natal/external', '/api/natal/external/:id', '/api/astrology/house-influence-status',
    '/api/astrology/horoscope/history', '/api/astrology/compatibility/history',
    '/api/astrology/ask/history', '/api/astrology/important-dates',
    '/api/matrix/me', '/api/matrix/guests', '/api/matrix/guest/:id', '/api/matrix/pairs',
  ], serve);
  app.post(['/api/user/update', '/api/natal/init', '/api/astrology/solar/check', '/api/matrix/guest'], serve);
  app.patch('/api/user/push', serve);
  app.delete('/api/natal/external/:id', serve);
  app.get('/api/public/sign-horoscope/:sign', generated);
  app.post([
    '/api/tarot/draw', '/api/natal/external', '/api/astrology/planet-interpretation',
    '/api/astrology/house-influence', '/api/astrology/solar', '/api/astrology/horoscope',
    '/api/astrology/horoscope/weekly-plan', '/api/astrology/horoscope/monthly-plan',
    '/api/astrology/compatibility', '/api/astrology/ask', '/api/astrology/important-dates/interpret',
    '/api/matrix/section', '/api/matrix/pair',
  ], generated);
}
