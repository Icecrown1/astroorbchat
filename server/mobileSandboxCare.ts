import type { Express } from 'express';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './middleware/auth';
import * as s from '@shared/schema';

// This module is registered only after androidSandbox has verified the database marker.
export async function registerSandboxCare(app: Express) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS android_reading_feedback (
    id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL, excerpt text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz)`);
  const pages = resolve('mobile/play-internal/public');
  for (const page of ['privacy', 'delete-account']) {
    app.get('/mobile/' + page, (_req, res) => res.set('Referrer-Policy', 'no-referrer')
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
      .sendFile(resolve(pages, page + '.html')));
  }
  app.post('/api/mobile/reading-feedback', requireAuth, async (req, res, next) => {
    const { kind, excerpt } = req.body ?? {};
    if (!['forecast', 'compatibility', 'matrix', 'solar', 'date', 'planet', 'house', 'daily-sign'].includes(kind)
      || typeof excerpt !== 'string' || !excerpt.trim() || excerpt.length > 3000) {
      return res.status(400).json({ ok: false, error: 'invalid_feedback' });
    }
    const userId = (req as typeof req & { userId: string }).userId;
    const id = createHash('sha256').update(JSON.stringify([userId, kind, excerpt])).digest('hex');
    try {
      const accepted = await db.transaction(async tx => {
        await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, userId)).for('update');
        const found = await tx.execute(sql`SELECT 1 FROM android_reading_feedback WHERE id=${id}`);
        if (found.rowCount) return true;
        const recent = await tx.execute(sql`SELECT count(*)::int AS n FROM android_reading_feedback
          WHERE user_id=${userId} AND created_at > now() - interval '1 hour'`);
        if (Number(recent.rows[0].n) >= 20) return false;
        await tx.execute(sql`INSERT INTO android_reading_feedback (id,user_id,kind,excerpt)
          VALUES (${id},${userId},${kind},${excerpt})`);
        return true;
      });
      if (!accepted) return res.status(429).json({ ok: false, error: 'feedback_limit' });
      res.json({ ok: true, data: { received: true } });
    } catch (e) { next(e); }
  });

  app.delete('/api/mobile/account', requireAuth, async (req, res, next) => {
    if (res.locals.authChannel !== 'mobile' || req.body?.confirmation !== 'DELETE') {
      return res.status(400).json({ ok: false, error: 'confirm_deletion' });
    }
    const id = (req as typeof req & { userId: string }).userId;
    try {
      const removed = await db.transaction(async tx => {
        const [owner] = await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, id)).for('update');
        if (!owner) return true;
        const [open] = await tx.select({ id: s.yookassaPayments.id }).from(s.yookassaPayments)
          .where(and(eq(s.yookassaPayments.userId, id), inArray(s.yookassaPayments.status, ['pending','needs_review','refund_review']))).limit(1);
        if (open) return false;
        for (const table of [s.events, s.aiQuestions, s.tarotReadings, s.guestMatrices, s.matrixReadings,
          s.natalReadings, s.natalCharts, s.solarReturns, s.horoscopeReadings, s.compatibilityReadings,
          s.importantDateUnlocks, s.importantDateInterpretations, s.usageLogs, s.mobileLinkCodes,
          s.subscriptions, s.payments, s.yookassaPayments]) {
          await tx.delete(table).where(eq(table.userId, id));
        }
        await tx.delete(s.externalNatals).where(eq(s.externalNatals.ownerId, id));
        await tx.delete(s.referralRewards).where(or(eq(s.referralRewards.referrerId, id), eq(s.referralRewards.referredUserId, id)));
        await tx.update(s.users).set({ referredById: null }).where(eq(s.users.referredById, id));
        await tx.delete(s.users).where(eq(s.users.id, id));
        return true;
      });
      if (!removed) return res.status(409).json({ ok: false, error: 'pending_order_deletion' });
      res.set('Cache-Control','no-store').json({ ok: true, data: { deleted: true } });
    } catch (e) { next(e); }
  });
}
