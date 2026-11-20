import { createHash, randomBytes } from 'node:crypto';
import type { Express } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { mobileLinkCodes } from '@shared/schema';
import { db } from './db';
import { generateToken } from './lib/jwt';
import { requireAuth } from './middleware/auth';

const digest = (code: string) => createHash('sha256').update(code).digest('hex');
const codeLifetimeSeconds = 300;

export function registerMobileLogin(app: Express) {
  app.post('/api/mobile/auth/code', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const userId: string = (req as typeof req & { userId: string }).userId;
    const code = randomBytes(16).toString('base64url');
    const values = {
      digest: digest(code),
      expiresAt: sql`now() + ${codeLifetimeSeconds} * interval '1 second'`,
    };
    try {
      await db.insert(mobileLinkCodes).values({ userId, ...values }).onConflictDoUpdate({
        target: mobileLinkCodes.userId,
        set: values,
      });
      return res.json({ ok: true, data: { code, expiresIn: codeLifetimeSeconds } });
    } catch {
      return res.status(503).json({ ok: false, error: 'mobile_login_unavailable' });
    }
  });

  app.post('/api/mobile/auth/exchange', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'invalid_code' });
    }
    try {
      const [match] = await db.delete(mobileLinkCodes)
        .where(and(eq(mobileLinkCodes.digest, digest(code)), sql`${mobileLinkCodes.expiresAt} > now()`))
        .returning({ userId: mobileLinkCodes.userId });
      if (!match) return res.status(400).json({ ok: false, error: 'invalid_code' });
      return res.json({ ok: true, data: { token: generateToken(match.userId, 8 * 60 * 60) } });
    } catch {
      return res.status(503).json({ ok: false, error: 'mobile_login_unavailable' });
    }
  });
}
