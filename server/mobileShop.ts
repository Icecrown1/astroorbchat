import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { users, yookassaPayments, type YookassaPayment } from '@shared/schema';
import { firstMonthPromoRub, subscriptionRub, type PaidTier } from '@shared/subscriptionPrices';
import { requireAuth } from './middleware/auth';
import { db } from './db';
import { DatabaseStorage, storage } from './storage';
import { createPayment, getPayment, type YooKassaPayment } from './lib/yookassa';
import { isFirstMonthOfferEligible } from './lib/firstMonthOffer';
import { activateSubscriptionForUser } from './lib/paymentActivation';

const kind = 'subscription_mobile';
const path = '/api/mobile/shop';
const returnUrl = 'https://astroorbiapp.com/mobile/payment-return';
const sandbox = process.env.ASTROORBI_ANDROID_SANDBOX === '1';
const orderInput = z.object({
  tier: z.enum(['standard', 'premium']),
  amount: z.number().int().positive(),
  email: z.string().trim().email().max(254),
});

function prices(promo: boolean) {
  const price = (tier: PaidTier) => promo ? firstMonthPromoRub(tier) : subscriptionRub(tier, 1);
  return { standard: price('standard'), premium: price('premium') };
}

function hasAccess(sub: Awaited<ReturnType<typeof storage.getSubscription>>) {
  return !!sub && (!!sub.scheduledTier || (['active', 'canceled'].includes(sub.status) && sub.currentPeriodEnd > new Date()));
}

function enabled(tgId: string) {
  if (sandbox && process.env.ANDROID_INTERNAL_PURCHASES_DISABLED === '1') return false;
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY &&
    (sandbox ? process.env.YOOKASSA_TEST_MODE === 'true' : process.env.YOOKASSA_TEST_MODE !== 'true') &&
    process.env.MOBILE_RU_CHECKOUT_TESTERS?.split(',').some(id => id.trim() === tgId));
}

function openOrder(userId: string) {
  return and(eq(yookassaPayments.userId, userId), eq(yookassaPayments.kind, kind),
    inArray(yookassaPayments.status, ['pending', 'needs_review', 'refund_review']));
}

function publicOrder(row: YookassaPayment) {
  return { id: row.id, status: row.status, tier: row.tier, amount: Number(row.amountRUB),
    needsEmail: !row.yookassaPaymentId };
}

export function matchesMobileOrder(row: YookassaPayment, payment: YooKassaPayment) {
  return payment.test === sandbox && !!payment.id &&
    (!row.yookassaPaymentId || row.yookassaPaymentId === payment.id) &&
    payment.metadata?.internalPaymentId === row.id && payment.metadata.userId === row.userId &&
    payment.metadata.kind === kind && payment.metadata.tier === row.tier &&
    payment.amount?.currency === 'RUB' && payment.amount.value === row.amountRUB;
}

export async function settleMobileMonth(id: string, providerId?: string) {
  const row = await storage.getYookassaPaymentByInternalId(id);
  if (!row || row.kind !== kind) throw Error('Unknown mobile order');
  const paymentId = row.yookassaPaymentId || providerId;
  if (!paymentId) throw Error('Awaiting provider ID');
  // Even a signed-in client or a webhook only supplies a locator. Verify with the merchant API.
  const remote = await getPayment(paymentId);
  return settleVerifiedOrder(row, remote);
}

async function settleVerifiedOrder(row: YookassaPayment, remote: YooKassaPayment) {
  if (!matchesMobileOrder(row, remote)) throw Error('Provider order mismatch');
  const { id } = row;
  const paymentId = remote.id;
  return db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, row.userId)).for('update');
    const [locked] = await tx.select().from(yookassaPayments).where(eq(yookassaPayments.id, id)).for('update');
    if (!locked || !matchesMobileOrder(locked, remote)) throw Error('Provider ID changed');
    if (locked.status === 'completed') return { activated: false, alreadyDone: true, message: 'Already completed' };
    if (['needs_review','refund_review'].includes(locked.status)) return { activated: false, alreadyDone: false, message: 'Awaiting support review' };
    if (remote.status !== 'succeeded' || !remote.paid) {
      if (remote.status === 'canceled' && locked.status === 'pending') {
        await tx.update(yookassaPayments).set({ status: 'canceled' }).where(eq(yookassaPayments.id, id));
      }
      return { activated: false, alreadyDone: false, message: 'Not paid' };
    }
    const store = new DatabaseStorage(tx);
    // If a second channel activated a plan during checkout, preserve it for support to resolve.
    if (hasAccess(await store.getSubscription(row.userId))) {
      await tx.update(yookassaPayments).set({ status: 'needs_review', yookassaPaymentId: paymentId }).where(eq(yookassaPayments.id, id));
      return { activated: false, alreadyDone: false, message: 'Conflicting active subscription' };
    }
    await activateSubscriptionForUser(store, {
      userId: row.userId, tier: row.tier as PaidTier, periodMonths: 1, source: 'yookassa',
      meta: { autoRenew: false, paymentMethodId: null, amountRUB: row.amountRUB, skipReferralBonus: sandbox },
    });
    await tx.update(yookassaPayments).set({ status: 'completed', completedAt: new Date(),
      yookassaPaymentId: paymentId }).where(eq(yookassaPayments.id, id));
    return { activated: true, alreadyDone: false, message: 'Activated' };
  });
}

class ShopError extends Error {
  constructor(readonly status: number, code: string) { super(code); }
}

// A reversal requires the owner's policy on spent stars. Quarantine the order
// without touching balances or a newer entitlement, even on webhook replay.
export async function recordSandboxRefund(refundId: string) {
  if (!sandbox) throw Error('Sandbox only');
  const { readSandboxRefund } = await import('./lib/yookassa');
  const refund = await readSandboxRefund(refundId);
  if (refund?.id !== refundId || refund.status !== 'succeeded' || typeof refund.payment_id !== 'string' ||
      refund.amount?.currency !== 'RUB' || !/^\d+\.\d{2}$/.test(refund.amount.value) || Number(refund.amount.value) <= 0)
    throw Error('Unconfirmed refund');
  const payment = await getPayment(refund.payment_id);
  const id = payment.metadata?.internalPaymentId;
  if (typeof id !== 'string' || payment.test !== true || payment.id !== refund.payment_id) throw Error('Unconfirmed payment');
  await db.transaction(async tx => {
    const [row] = await tx.select().from(yookassaPayments).where(eq(yookassaPayments.id, id)).for('update');
    if (!row || row.kind !== kind || !matchesMobileOrder(row, payment) || Number(refund.amount.value) > Number(row.amountRUB))
      throw Error('Refund mismatch');
    await tx.update(yookassaPayments).set({ status:'refund_review', yookassaPaymentId:payment.id }).where(eq(yookassaPayments.id,id));
  });
}

export function registerMobileShop(app: Express) {
  app.get('/mobile/payment-return', (_req, res) => {
    res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer')
      .send(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AstroOrbi</title><main style="max-width:30rem;margin:15vh auto;padding:1rem;font:1.2rem system-ui"><h1>AstroOrbi</h1><p>Статус покупки можно проверить в разделе «Звёзды и подписка».</p>${sandbox ? '<p><a href="astroorbi-internal://payment-return">Открыть сборку из Google Play</a></p>' : ''}<p><a href="${sandbox ? 'astroorbi-test' : 'astroorbi'}://payment-return">${sandbox ? 'Открыть тестовый APK' : 'Вернуться в AstroOrbi'}</a></p></main></html>`);
  });
  app.use(path, requireAuth, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (res.locals.authChannel !== 'mobile') return res.status(403).json({ ok: false, error: 'mobile_login_needed' });
    next();
  });
  app.get(path, async (req, res) => {
    try {
      const user = (req as any).user;
      const [last] = await db.select().from(yookassaPayments)
        .where(and(eq(yookassaPayments.kind, kind), eq(yookassaPayments.userId, user.id)))
        .orderBy(desc(yookassaPayments.createdAt)).limit(1);
      const available = enabled(user.tgId);
      const active = hasAccess(await storage.getSubscription(user.id));
      res.json({ ok: true, data: { available, active,
        prices: available && !active ? prices(await isFirstMonthOfferEligible(user.id)) : null,
        order: last ? publicOrder(last) : null } });
    } catch { res.status(503).json({ ok: false, error: 'shop_unavailable' }); }
  });
  app.post(path + '/orders', async (req, res) => {
    try {
      const user = (req as any).user;
      if (!enabled(user.tgId)) throw new ShopError(403, 'shop_unavailable');
      const parsed = orderInput.safeParse(req.body);
      if (!parsed.success) throw new ShopError(400, 'invalid_order');
      const input = parsed.data;
      const row = await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
        const [pending] = await tx.select().from(yookassaPayments).where(openOrder(user.id)).limit(1);
        if (pending) {
          if (pending.status !== 'pending') throw new ShopError(409, 'order_review');
          if (pending.tier !== input.tier || Number(pending.amountRUB) !== input.amount) throw new ShopError(409, 'existing_order');
          return pending;
        }
        const store = new DatabaseStorage(tx);
        if (hasAccess(await store.getSubscription(user.id))) throw new ShopError(409, 'active_subscription');
        const amount = prices(await isFirstMonthOfferEligible(user.id, tx))[input.tier];
        if (input.amount !== amount) throw new ShopError(409, 'price_changed');
        const [created] = await tx.insert(yookassaPayments).values({ userId: user.id, kind,
          tier: input.tier, amountRUB: amount.toFixed(2), idempotencyKey: randomUUID(), status: 'pending' }).returning();
        return created;
      });
      if (!row.yookassaPaymentId && Date.now() - row.createdAt.getTime() >= 23 * 3600_000) throw new ShopError(409, 'order_review');
      const payment = row.yookassaPaymentId ? await getPayment(row.yookassaPaymentId) : await createPayment({
        amount: row.amountRUB, description: 'AstroOrbi ' + (row.tier === 'premium' ? 'Premium' : 'Standard') + ' на 1 месяц',
        returnUrl: sandbox ? new URL('/mobile/payment-return', process.env.ANDROID_SANDBOX_ORIGIN).href : returnUrl,
        customerEmail: input.email, idempotencyKey: row.idempotencyKey, bankCardOnly: true, savePaymentMethod: false,
        metadata: { internalPaymentId: row.id, userId: row.userId, tier: row.tier, kind },
      });
      if (!matchesMobileOrder(row, payment)) throw Error('Provider order mismatch');
      await db.update(yookassaPayments).set({ yookassaPaymentId: payment.id }).where(eq(yookassaPayments.id, row.id));
      res.json({ ok: true, data: { ...publicOrder(row), needsEmail: false,
        checkout: payment.status === 'pending' ? payment.confirmation?.confirmation_url : null } });
    } catch (e) {
      res.status(e instanceof ShopError ? e.status : 503).json({ ok: false, error: e instanceof ShopError ? e.message : 'shop_unavailable' });
    }
  });
  app.get(path + '/orders/:id', async (req, res) => {
    try {
      const row = await storage.getYookassaPaymentByInternalId(req.params.id);
      if (!row || row.kind !== kind || row.userId !== (req as any).userId) {
        return res.status(404).json({ ok: false, error: 'unknown_order' });
      }
      let checkout;
      if (row.status === 'pending' && row.yookassaPaymentId) {
        const payment = await getPayment(row.yookassaPaymentId);
        if (!matchesMobileOrder(row, payment)) throw Error('Provider order mismatch');
        if (payment.status === 'pending') checkout = payment.confirmation?.confirmation_url;
        else if (payment.status === 'succeeded' || payment.status === 'canceled') await settleVerifiedOrder(row, payment);
      }
      const updated = await storage.getYookassaPaymentByInternalId(row.id);
      res.json({ ok: true, data: { ...publicOrder(updated!), checkout: enabled((req as any).user.tgId) ? checkout : undefined } });
    } catch { res.status(503).json({ ok: false, error: 'shop_unavailable' }); }
  });
}
