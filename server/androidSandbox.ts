import express from 'express';
import pg from 'pg';
import { randomBytes } from 'node:crypto';

async function main() {
  const origin = new URL(process.env.ANDROID_SANDBOX_ORIGIN ?? '');
  const databaseUrl = process.env.ANDROID_SANDBOX_DATABASE_URL;
  const databaseMarker = process.env.ANDROID_SANDBOX_DATABASE_MARKER;
  const testerIds = (process.env.MOBILE_RU_CHECKOUT_TESTERS ?? '').split(',').map(id => id.trim());
  const testerId = testerIds[0];
  const key = process.env.YOOKASSA_SECRET_KEY;

  if (origin.protocol !== 'https:' || origin.origin !== origin.href.slice(0, -1) ||
      ['astroorbiapp.com', 'astro-orb-chat.replit.app', 'astroorbi.com'].includes(origin.hostname) ||
      !databaseUrl || !databaseMarker || databaseMarker.length < 32 ||
      !testerIds.every(id => /^[1-9][0-9]{5,15}$/.test(id)) ||
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
  const { storage, DatabaseStorage } = await import('./storage');
  const { mobileLinkCodes, users } = await import('@shared/schema');
  const { eq, sql } = await import('drizzle-orm');
  const { digestMobileCode, registerMobileLogin } = await import('./mobileLogin');

  if (process.argv.includes('--sandbox-ops')) {
    const { sandboxOperation } = await import('./mobileSandboxOps');
    console.log(JSON.stringify(await sandboxOperation(process.argv.slice(process.argv.indexOf('--sandbox-ops') + 1))));
    await pool.end();
  } else if (process.argv.includes('--issue-code')) {
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
    // Shared handlers write inputs and AI output to console. This standalone
    // process instead emits only HTTP method/status for server failures.
    for (const level of ['log','info','warn','error','debug'] as const) console[level] = () => {};
    const { registerMobileShop, settleMobileMonth } = await import('./mobileShop');
    const { requireAuth } = await import('./middleware/auth');
    const { getUserOrbs, getUserTier } = await import('./lib/energy');
    const app = express();
    app.use((req, res, next) => {
      res.on('finish', () => {
        if (res.statusCode >= 500) process.stderr.write(`Android sandbox ${req.method} ${res.statusCode}\n`);
      });
      next();
    });
    app.use(express.json({ limit: '32kb' }));
    const { registerSandboxCare } = await import('./mobileSandboxCare');
    await registerSandboxCare(app);
    app.get('/', (_req, res) => res.type('text').send('AstroOrbi Android sandbox'));
    const aiKey = process.env.ANDROID_INTERNAL_OPENAI_KEY;
    // Only the dedicated sandbox credential may send requests. Without it, the
    // SDK's optional calls during local calculations can only reach loopback.
    process.env.OPENAI_API_KEY = aiKey || 'disabled';
    process.env.OPENAI_BASE_URL = aiKey ? 'https://api.openai.com/v1' : 'http://127.0.0.1:1/v1';
    const { registerMobileInternalRoutes } = await import('./mobileInternalRoutes');
    await registerMobileInternalRoutes(app, Boolean(aiKey));
    app.get('/api/health', (_req, res) => res.json({ ok: true, environment: 'android-sandbox', mobileApi: 'internal-v1', ai: Boolean(aiKey) }));
    app.post('/api/mobile/auth/code', (_req, res) => res.sendStatus(404));
    const { registerMobileReview } = await import('./mobileReview');
    await registerMobileReview(app);
    registerMobileLogin(app);
    registerMobileShop(app);

    app.get('/api/user/me', requireAuth, async (req, res, next) => {
      try {
        const user = (req as typeof req & { user: typeof users.$inferSelect }).user;
        const data = await db.transaction(async tx => {
          await tx.select({id:users.id}).from(users).where(eq(users.id,user.id)).for('update');
          const store = new DatabaseStorage(tx);
          const subscription = await store.getSubscription(user.id);
          if (subscription?.paymentProvider === 'yookassa' && !subscription.autoRenew && !subscription.scheduledTier
              && subscription.currentPeriodEnd <= new Date()) {
            await store.updateUser(user.id, { subscriptionOrbs:'0' });
          }
          const orbs = await getUserOrbs(store, user.id);
          const tier = await getUserTier(store, user.id);
          return { ...await store.getUser(user.id), orbs:orbs.total, maxOrbs:orbs.maxOrbs, tier, billingTier:tier,
            subscription:await store.getSubscription(user.id), natalInitialized:Boolean(await store.getNatalChart(user.id)) };
        });
        res.json({ ok: true, data });
      } catch (error) {
        next(error);
      }
    });

    // The notification only identifies the order. Settlement re-fetches it from the test merchant.
    app.post('/webhooks/yookassa', async (req, res) => {
      const { event, object } = req.body ?? {};
      if (event === 'refund.succeeded') {
        if (typeof object?.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(object.id)) return res.sendStatus(400);
        try {
          const { recordSandboxRefund } = await import('./mobileShop');
          await recordSandboxRefund(object.id);
          return res.sendStatus(200);
        } catch { return res.sendStatus(503); }
      }
      if (!['payment.succeeded', 'payment.canceled'].includes(event) ||
          object?.test !== true || object?.metadata?.kind !== 'subscription_mobile' ||
          typeof object.id !== 'string' || typeof object.metadata.internalPaymentId !== 'string') {
        return res.sendStatus(400);
      }
      try {
        await settleMobileMonth(object.metadata.internalPaymentId, object.id);
        console.info('[Android sandbox] YooKassa notification verified', event, object.id);
        res.sendStatus(200);
      } catch {
        res.sendStatus(503);
      }
    });
    app.use(((error, _req, res, _next) => {
      const status = error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : 500;
      res.status(status).json({ ok:false, error:'sandbox_request_failed' });
    }) as express.ErrorRequestHandler);
    app.listen(Number(process.env.PORT ?? 5000), '0.0.0.0');
  }
}

void main().catch(() => {
  process.stderr.write('Android sandbox startup failed. Check sandbox configuration and database identity.\n');
  process.exit(1);
});
