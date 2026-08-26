/**
 * Shared YooKassa payment activation logic.
 * Used by: webhook handler, check-status endpoint, reconciliation cron, admin force-activate.
 * Extracted to avoid code duplication and ensure consistent behaviour.
 */
import dayjs from 'dayjs';
import { sendSupportAlert } from './support';

export type SubscriptionSource = 'yookassa' | 'ton' | 'stars' | 'dodo' | 'dev' | 'admin';

export interface ActivateSubscriptionParams {
  userId: string;
  tier: 'standard' | 'premium' | 'pro';
  /** Длительность: месяцы (по умолчанию 1) ИЛИ дни (Stars — ровно 30) */
  periodMonths?: number;
  periodDays?: number;
  source: SubscriptionSource;
  meta?: {
    autoRenew?: boolean;
    paymentMethodId?: string | null;
    amountRUB?: string | null;
    starsChargeId?: string | null;
    starsExpiresAt?: Date | null;
    /** Продление: считать срок от текущей даты окончания, если она в будущем (по умолчанию true) */
    extend?: boolean;
    /** Явная дата старта периода (запланированная подписка после текущей) */
    startAt?: Date;
  };
}

/**
 * ЕДИНАЯ точка активации/продления подписки для всех провайдеров (ЮKassa, TON, Stars, Dodo, dev/admin).
 * - срок: от max(now, currentPeriodEnd) при extend (продление/повторная оплата), иначе от now;
 * - начисляет месячные орбы тира и сдвигает orbsResetAt на 30 дней;
 * - реферальный бонус — только при первой активации (не при продлении активной подписки).
 */
export async function activateSubscriptionForUser(storage: any, p: ActivateSubscriptionParams) {
  const { SUBSCRIPTION_MONTHLY_ORBS } = await import('./energy');
  const normalizedTier: 'pro' | 'standard' = (p.tier === 'premium' || p.tier === 'pro') ? 'pro' : 'standard';
  const extend = p.meta?.extend !== false;
  const now = new Date();

  const existingSub = await storage.getSubscription(p.userId);
  const wasActive = !!existingSub && existingSub.status === 'active' && new Date(existingSub.currentPeriodEnd) > now;
  const base = p.meta?.startAt ? p.meta.startAt : (extend && wasActive ? new Date(existingSub.currentPeriodEnd) : now);
  const currentPeriodEnd = p.periodDays
    ? dayjs(base).add(p.periodDays, 'day').toDate()
    : dayjs(base).add(p.periodMonths || 1, 'month').toDate();

  const data: any = {
    tier: normalizedTier,
    status: 'active',
    currentPeriodEnd,
    paymentProvider: p.source,
    periodMonths: p.periodMonths || 1,
  };
  if (p.meta?.autoRenew !== undefined) data.autoRenew = p.meta.autoRenew;
  if (p.meta?.paymentMethodId !== undefined) data.paymentMethodId = p.meta.paymentMethodId;
  if (p.meta?.amountRUB !== undefined) data.amountRUB = p.meta.amountRUB;
  if (p.meta?.starsChargeId !== undefined) data.starsChargeId = p.meta.starsChargeId;
  if (p.meta?.starsExpiresAt !== undefined) data.starsExpiresAt = p.meta.starsExpiresAt;

  if (existingSub) {
    await storage.updateSubscription(existingSub.id, data);
  } else {
    await storage.createSubscription({ userId: p.userId, startedAt: now, ...data });
  }

  const orbsKey = normalizedTier === 'pro' ? 'premium' : 'standard';
  const monthlyOrbs = SUBSCRIPTION_MONTHLY_ORBS[orbsKey as keyof typeof SUBSCRIPTION_MONTHLY_ORBS];
  await storage.updateUser(p.userId, {
    subscriptionOrbs: monthlyOrbs.toString(),
    orbsResetAt: dayjs().add(30, 'days').toDate(),
  });

  if (!wasActive) {
    try {
      const { handleSubscriptionReferralBonus } = await import('./referral');
      await handleSubscriptionReferralBonus(storage, p.userId);
    } catch (refErr) {
      console.error('[ACTIVATION] referral bonus failed (non-blocking):', refErr);
    }
  }

  console.log(`[ACTIVATION] ${wasActive ? 'Extended' : 'Activated'} ${normalizedTier} via ${p.source} (user ${p.userId}) until ${currentPeriodEnd.toISOString()}, orbs ${monthlyOrbs}`);
  return { tier: normalizedTier, currentPeriodEnd, renewed: wasActive, monthlyOrbs };
}

/** Standard → Premium: тир сразу, +300 бонусных орбов; при periodMonths>1 — ещё N мес Premium от даты окончания */
export async function applySubscriptionUpgrade(storage: any, userId: string, periodMonths: number, source: SubscriptionSource, meta?: { amountRUB?: string | null; starsChargeId?: string | null }) {
  const { SUBSCRIPTION_MONTHLY_ORBS } = await import('./energy');
  const existingSub = await storage.getSubscription(userId);
  if (!existingSub) throw new Error(`applySubscriptionUpgrade: no subscription for ${userId}`);
  const update: any = { tier: 'pro', status: 'active', paymentProvider: source };
  if (meta?.starsChargeId) update.starsChargeId = meta.starsChargeId;
  if (periodMonths > 1) {
    const base = new Date(existingSub.currentPeriodEnd) > new Date() ? new Date(existingSub.currentPeriodEnd) : new Date();
    update.currentPeriodEnd = dayjs(base).add(periodMonths, 'month').toDate();
    update.periodMonths = periodMonths;
    if (meta?.amountRUB !== undefined) update.amountRUB = meta.amountRUB;
  }
  await storage.updateSubscription(existingSub.id, update);
  const user = await storage.getUser(userId);
  if (user) {
    const currentOrbs = parseFloat(user.subscriptionOrbs || '0');
    const bonusOrbs = SUBSCRIPTION_MONTHLY_ORBS['premium'] - SUBSCRIPTION_MONTHLY_ORBS['standard'];
    await storage.updateUser(userId, { subscriptionOrbs: Math.max(0, currentOrbs + bonusOrbs).toString() });
  }
  console.log(`[ACTIVATION] Upgraded to Premium via ${source} (user ${userId}, +${periodMonths > 1 ? periodMonths + 'mo' : '0'})`);
  return { currentPeriodEnd: update.currentPeriodEnd || existingSub.currentPeriodEnd };
}

/** Продление того же тира на N месяцев от max(now, currentPeriodEnd); месячные орбы обновляются */
export async function applySubscriptionRenewal(storage: any, userId: string, periodMonths: number, source: SubscriptionSource, meta?: { amountRUB?: string | null; starsChargeId?: string | null }) {
  const { SUBSCRIPTION_MONTHLY_ORBS } = await import('./energy');
  const existingSub = await storage.getSubscription(userId);
  if (!existingSub) throw new Error(`applySubscriptionRenewal: no subscription for ${userId}`);
  const base = new Date(existingSub.currentPeriodEnd) > new Date() ? new Date(existingSub.currentPeriodEnd) : new Date();
  const newPeriodEnd = dayjs(base).add(periodMonths, 'month').toDate();
  const update: any = { status: 'active', currentPeriodEnd: newPeriodEnd, paymentProvider: source, periodMonths };
  if (meta?.amountRUB !== undefined) update.amountRUB = meta.amountRUB;
  if (meta?.starsChargeId) update.starsChargeId = meta.starsChargeId;
  await storage.updateSubscription(existingSub.id, update);
  const orbsKey = existingSub.tier === 'pro' ? 'premium' : 'standard';
  const monthlyOrbs = SUBSCRIPTION_MONTHLY_ORBS[orbsKey as keyof typeof SUBSCRIPTION_MONTHLY_ORBS];
  await storage.updateUser(userId, { subscriptionOrbs: monthlyOrbs.toString(), orbsResetAt: dayjs().add(30, 'days').toDate() });
  console.log(`[ACTIVATION] Renewed via ${source} (user ${userId} until ${newPeriodEnd.toISOString()})`);
  return { currentPeriodEnd: newPeriodEnd };
}

export interface ActivationResult {
  activated: boolean;
  alreadyDone: boolean;
  message: string;
}

/**
 * Activate a succeeded YooKassa payment: credit energy or create/update subscription.
 * Idempotent — returns { alreadyDone: true } if the payment is already completed.
 */
export async function activateSucceededYookassaPayment(
  dbPayment: {
    id: string;
    userId: string;
    kind: string;
    tier: string | null;
    energyAmount: number | null;
    status: string;
    amountRUB: string | null;
  },
  ykPayment: {
    metadata?: Record<string, any>;
    payment_method?: { id: string; saved: boolean } | null;
  },
  storage: any
): Promise<ActivationResult> {
  if (dbPayment.status === 'completed') {
    return { activated: false, alreadyDone: true, message: 'Already completed' };
  }

  const { SUBSCRIPTION_MONTHLY_ORBS } = await import('./energy');

  if (dbPayment.kind === 'energy_pack' && dbPayment.energyAmount) {
    const { creditPurchasedOrbs } = await import('./energy');
    await creditPurchasedOrbs(storage, dbPayment.userId, dbPayment.energyAmount, 'yookassa');

  } else if (dbPayment.kind === 'subscription' && dbPayment.tier) {
    const periodMonths = Number(ykPayment.metadata?.periodMonths) || 1;
    const autoRenew = ykPayment.metadata?.autoRenew === true || ykPayment.metadata?.autoRenew === 'true';
    const paymentMethodId = ykPayment.payment_method?.saved ? ykPayment.payment_method.id : null;
    if (ykPayment.metadata?.scheduleAfterCurrent === 'true' || ykPayment.metadata?.scheduleAfterCurrent === true) {
      // Оплаченный даунгрейд: стартует после окончания текущей (см. applyScheduledSubscription в energy.ts)
      const existingSub = await storage.getSubscription(dbPayment.userId);
      if (existingSub && existingSub.status === 'active' && new Date(existingSub.currentPeriodEnd) > new Date()) {
        await storage.updateSubscription(existingSub.id, {
          scheduledTier: (dbPayment.tier === 'premium' || dbPayment.tier === 'pro') ? 'pro' : 'standard',
          scheduledPeriodMonths: periodMonths,
          scheduledAmountRUB: dbPayment.amountRUB,
          autoRenew: false,
        });
        console.log(`[ACTIVATION] Scheduled ${dbPayment.tier} x${periodMonths}mo after ${existingSub.currentPeriodEnd} (user ${dbPayment.userId})`);
        await storage.updateYookassaPayment(dbPayment.id, { status: 'completed', completedAt: new Date() });
        return { activated: true, alreadyDone: false, message: 'Scheduled after current period' };
      }
      // Текущая уже закончилась — активируем сразу
    }
    // Новая покупка: срок от сегодня (ЮKassa subscription — не продление; продление идёт через subscription_renewal)
    await activateSubscriptionForUser(storage, {
      userId: dbPayment.userId,
      tier: dbPayment.tier as any,
      periodMonths,
      source: 'yookassa',
      meta: { autoRenew, paymentMethodId, amountRUB: dbPayment.amountRUB, extend: false },
    });

  } else if (dbPayment.kind === 'subscription_upgrade') {
    const periodMonths = Number(ykPayment.metadata?.periodMonths) || 1;
    await applySubscriptionUpgrade(storage, dbPayment.userId, periodMonths, 'yookassa', { amountRUB: dbPayment.amountRUB });

  } else if (dbPayment.kind === 'subscription_renewal') {
    const periodMonths = Number(ykPayment.metadata?.periodMonths) || 1;
    await applySubscriptionRenewal(storage, dbPayment.userId, periodMonths, 'yookassa', { amountRUB: dbPayment.amountRUB });

  } else {
    console.warn(`[ACTIVATION] Unknown payment kind: ${dbPayment.kind} (payment ${dbPayment.id})`);
    return { activated: false, alreadyDone: false, message: `Unknown kind: ${dbPayment.kind}` };
  }

  await storage.updateYookassaPayment(dbPayment.id, { status: 'completed', completedAt: new Date() });
  return { activated: true, alreadyDone: false, message: 'Activated successfully' };
}

/**
 * Reconcile a single pending YooKassa payment against the YooKassa API.
 * Activates it if succeeded, sends a support alert if it's been pending too long.
 */
export async function reconcileYookassaPayment(
  dbPayment: {
    id: string;
    userId: string;
    kind: string;
    tier: string | null;
    energyAmount: number | null;
    status: string;
    amountRUB: string | null;
    yookassaPaymentId: string | null;
    createdAt: Date;
  },
  storage: any
): Promise<{ action: 'activated' | 'alreadyDone' | 'notSucceeded' | 'noYkId' | 'error'; message: string }> {
  if (!dbPayment.yookassaPaymentId) {
    return { action: 'noYkId', message: 'No YooKassa payment ID yet' };
  }

  try {
    const { getPayment } = await import('./yookassa');
    const ykPayment = await getPayment(dbPayment.yookassaPaymentId);

    if (ykPayment.status === 'succeeded' && ykPayment.paid) {
      const result = await activateSucceededYookassaPayment(dbPayment, ykPayment, storage);
      if (result.alreadyDone) {
        return { action: 'alreadyDone', message: result.message };
      }

      // Alert support only when payment has been succeeded for >30 minutes without activation
      const minutesLate = Math.round((Date.now() - new Date(dbPayment.createdAt).getTime()) / 60000);
      if (minutesLate >= 30) {
        await sendSupportAlert(
          'Платёж восстановлен автоматически (>30 мин задержки)',
          `Платёж был успешен на стороне ЮKassa, но не активирован вовремя.\n` +
          `Восстановлено через: ${minutesLate} мин\n` +
          `userId: ${dbPayment.userId}\n` +
          `kind: ${dbPayment.kind}${dbPayment.tier ? ` (${dbPayment.tier})` : ''}\n` +
          `amountRUB: ${dbPayment.amountRUB}\n` +
          `yookassaPaymentId: ${dbPayment.yookassaPaymentId}`
        );
      }

      return { action: 'activated', message: `Activated after ${minutesLate}min delay` };
    }

    // Terminal failure states — mark as failed in our DB so they stop showing as "processing"
    const terminalFailedStatuses = ['canceled', 'expired'];
    if (terminalFailedStatuses.includes(ykPayment.status)) {
      await storage.updateYookassaPayment(dbPayment.id, { status: 'failed' });
      console.log(`[RECONCILE] Marked payment ${dbPayment.id} as failed (YK status: ${ykPayment.status})`);
      return { action: 'notSucceeded', message: `Marked failed — YK status: ${ykPayment.status}` };
    }

    // Still pending on YooKassa side (waiting_for_capture, etc.)
    return { action: 'notSucceeded', message: `YK status: ${ykPayment.status}` };
  } catch (err: any) {
    const errMsg: string = err?.message || '';
    // 404 / payment not found in YooKassa — happens for very old payments; mark as failed
    if (err?.status === 404 || errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
      try {
        await storage.updateYookassaPayment(dbPayment.id, { status: 'failed' });
        console.log(`[RECONCILE] Marked payment ${dbPayment.id} as failed (YK 404 — payment not found)`);
      } catch (updateErr: any) {
        console.error(`[RECONCILE] Could not mark payment ${dbPayment.id} as failed:`, updateErr?.message);
      }
      return { action: 'error', message: `YK 404 — marked failed` };
    }
    console.error(`[RECONCILE] Error checking payment ${dbPayment.id}:`, errMsg);
    return { action: 'error', message: errMsg };
  }
}
