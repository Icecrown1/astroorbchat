import express from 'express';
import pg from 'pg';
import { randomBytes } from 'node:crypto';

const origin = new URL(process.env.ANDROID_SANDBOX_ORIGIN ?? '');
const databaseUrl = process.env.ANDROID_SANDBOX_DATABASE_URL;
const databaseMarker = process.env.ANDROID_SANDBOX_DATABASE_MARKER;
const testerId = process.env.MOBILE_RU_CHECKOUT_TESTERS;
const key = process.env.YOOKASSA_SECRET_KEY;

if (origin.protocol !== 'https:' || origin.origin !== origin.href.slice(0, -1) ||
    ['astroorbiapp.com', 'astro-orb-chat.replit.app', 'astroorbi.com'].includes(origin.hostname) ||
    !databaseUrl || !databaseMarker || databaseMarker.length < 32 ||
    !testerId || !/^[1-9][0-9]{5,15}$/.test(testerId) ||
    (process.env.JWT_SECRET?.length ?? 0) < 32 ||
    process.env.TELEGRAM_BOT_TOKEN || process.env.LEGACY_PAYMENTS === '1' ||
    process.env.YOOKASSA_TEST_MODE !== 'true' || (key && !key.startsWith('test_')) ||
    Boolean(key) !== Boolean(process.env.YOOKASSA_SHOP_ID)) {
  throw new Error('Invalid Android sandbox configuration');
}

const verification = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
try {
  await verification.connect();
  const result = await verification.query(
    'select 1 from public.android_sandbox_identity where marker = $1',
    [databaseMarker],
  );
  if (result.rowCount !== 1) throw new Error('Android sandbox database marker mismatch');
} finally {
  await verification.end();
}

process.env.DATABASE_URL = databaseUrl;
process.env.ASTROORBI_ANDROID_SANDBOX = '1';
const { db, pool } = await import('./db');
const { storage } = await import('./storage');
const { mobileLinkCodes, users } = await import('@shared/schema');
const { sql } = await import('drizzle-orm');
const { digestMobileCode, registerMobileLogin } = await import('./mobileLogin');

if (process.argv.includes('--issue-code')) {
  const [created] = await db.insert(users).values({
    tgId: testerId,
    name: 'AstroOrbi Android Test',
    gender: 'female',
    age: 30,
    birthdayDate: new Date('1996-01-01T12:00:00Z'),
    referralCode: randomBytes(9).toString('hex'),
    pushEnabled: false,
  }).onConflictDoNothing({ target: users.tgId }).returning();
  const user = created ?? await storage.getUserByTgId(testerId);
  if (!user) throw new Error('Tester profile is unavailable');
  const code = randomBytes(16).toString('base64url');
  const values = { digest: digestMobileCode(code), expiresAt: sql`now() + interval '5 minutes'` };
  await db.insert(mobileLinkCodes).values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: mobileLinkCodes.userId, set: values });
  console.log(code);
  await pool.end();
} else {
  const { registerMobileShop, settleMobileMonth } = await import('./mobileShop');
  const { requireAuth } = await import('./middleware/auth');
  const { getUserOrbs, getUserTier } = await import('./lib/energy');
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_req, res) => res.type('text').send('AstroOrbi Android sandbox'));
  app.get('/api/health', (_req, res) => res.json({ ok: true, environment: 'android-sandbox' }));
  registerMobileLogin(app);
  registerMobileShop(app);

  app.get('/api/user/me', requireAuth, async (req, res, next) => {
    try {
      const user = (req as typeof req & { user: typeof users.$inferSelect }).user;
      const [orbs, tier, subscription] = await Promise.all([
        getUserOrbs(storage, user.id),
        getUserTier(storage, user.id),
        storage.getSubscription(user.id),
      ]);
      res.json({ ok: true, data: {
        ...user, orbs: orbs.total, maxOrbs: orbs.maxOrbs, tier, billingTier: tier,
        subscription, natalInitialized: false,
      } });
    } catch (error) {
      next(error);
    }
  });

  // The notification only identifies the order. Settlement re-fetches it from the test merchant.
  app.post('/webhooks/yookassa', async (req, res) => {
    const { event, object } = req.body ?? {};
    if (!['payment.succeeded', 'payment.canceled'].includes(event) ||
        object?.test !== true || object?.metadata?.kind !== 'subscription_mobile' ||
        typeof object.id !== 'string' || typeof object.metadata.internalPaymentId !== 'string') {
      return res.sendStatus(400);
    }
    try {
      await settleMobileMonth(object.metadata.internalPaymentId, object.id);
      res.sendStatus(200);
    } catch {
      res.sendStatus(503);
    }
  });
  app.listen(Number(process.env.PORT ?? 5000), '0.0.0.0');
}
