import express, { type Express, type RequestHandler } from 'express';
import { registerRoutes } from './routes';
import { requireAuth } from './middleware/auth';
import { recomputeIfProfileChanged } from './lib/natalService';
import { storage } from './storage';
import { db } from './db';
import { aiQuestions, events, tarotReadings } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// Forward exact HTTP methods and paths to the same handlers used by the app.
// The child application is never mounted as a catch-all or opened on a port.
export async function registerMobileInternalRoutes(app: Express, aiEnabled: boolean) {
  const shared = express();
  await registerRoutes(shared);
  const serve: RequestHandler = (req, res, next) => shared(req, res, next);
  app.get('/api/mobile/config', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ ok: true, data: {
      testAds: req.query.build === '7' ? process.env.ANDROID_S7_TEST_ADS !== '0' : process.env.ANDROID_INTERNAL_TEST_ADS === '1',
    } });
  });
  app.post('/api/mobile/content-reports', requireAuth, async (req, res, next) => {
    try {
      const { kind, id } = req.body ?? {};
      if (!['oracle', 'tarot'].includes(kind) || typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) {
        return res.status(400).json({ ok: false, error: 'invalid_reading' });
      }
      const { userId } = req as typeof req & { userId: string };
      const table = kind === 'oracle' ? aiQuestions : tarotReadings;
      const [reading] = await db.select({ id: table.id }).from(table)
        .where(and(eq(table.id, id), eq(table.userId, userId)));
      if (!reading) return res.status(404).json({ ok: false, error: 'unknown_reading' });
      const ref = kind + ':' + id;
      const reportId = createHash('sha256').update('internal-report:' + userId + ':' + ref).digest('hex');
      await db.insert(events).values({ id: reportId, userId, name: 'mobile_content_report', value: ref })
        .onConflictDoNothing({ target: events.id });
      res.json({ ok: true, data: { received: true } });
    } catch (error) { next(error); }
  });
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
    '/api/camp/indices/:first/:second', '/api/cities/search', '/api/tarot/history', '/api/tarot/status', '/api/natal/me',
    '/api/natal/external', '/api/natal/external/:id', '/api/astrology/house-influence-status',
    '/api/astrology/horoscope/history', '/api/astrology/compatibility/history',
    '/api/astrology/ask/history', '/api/astrology/important-dates',
    '/api/matrix/me', '/api/matrix/guests', '/api/matrix/guest/:id', '/api/matrix/pairs',
  ], serve);
  app.post(['/api/reading-feedback','/api/user/update', '/api/natal/init', '/api/astrology/solar/check', '/api/matrix/guest'], serve);
  app.patch('/api/user/push', serve);
  app.delete('/api/natal/external/:id', serve);
  app.get('/api/public/sign-horoscope/:sign', generated);
  app.post([
    '/api/tarot/draw', '/api/natal/external', '/api/astrology/planet-interpretation',
    '/api/astrology/house-influence', '/api/astrology/solar', '/api/astrology/horoscope',
    '/api/astrology/horoscope/weekly-plan', '/api/astrology/horoscope/monthly-plan',
    '/api/astrology/compatibility', '/api/astrology/ask', '/api/astrology/important-dates/interpret',
    '/api/tarot/question-help', '/api/matrix/section', '/api/matrix/pair',
  ], generated);
}
