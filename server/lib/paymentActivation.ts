/**
 * Shared YooKassa payment activation logic.
 * Used by: webhook handler, check-status endpoint, reconciliation cron, admin force-activate.
 * Extracted to avoid code duplication and ensure consistent behaviour.
 */
import dayjs from 'dayjs';
import { sendSupportAlert } from './support';

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
    const normalizedTier = (dbPayment.tier === 'premium' || dbPayment.tier === 'pro') ? 'pro' : 'standard';
    const periodMonths = ykPayment.metadata?.periodMonths || 1;
    const autoRenew = ykPayment.metadata?.autoRenew === true || ykPayment.metadata?.autoRenew === 'true';
    const paymentMethodId = ykPayment.payment_method?.saved ? ykPayment.payment_method.id : null;

    const startedAt = new Date();
    const currentPeriodEnd = dayjs(startedAt).add(periodMonths, 'month').toDate();

    const existingSub = await storage.getSubscription(dbPayment.userId);
    const subscriptionData = {
      tier: normalizedTier,
      status: 'active' as const,
      currentPeriodEnd,
      autoRenew,
      paymentMethodId,
      paymentProvider: 'yookassa' as const,
      periodMonths,
      amountRUB: dbPayment.amountRUB,
    };

    if (existingSub) {
      await storage.updateSubscription(existingSub.id, subscriptionData);
    } else {
      await storage.createSubscription({ userId: dbPayment.userId, startedAt, ...subscriptionData });
    }

    const orbsKey = normalizedTier === 'pro' ? 'premium' : 'standard';
    const monthlyOrbs = SUBSCRIPTION_MONTHLY_ORBS[orbsKey as keyof typeof SUBSCRIPTION_MONTHLY_ORBS];
    const user = await storage.getUser(dbPayment.userId);
    if (user) {
      await storage.updateUser(dbPayment.userId, {
        subscriptionOrbs: monthlyOrbs.toString(),
        orbsResetAt: dayjs().add(30, 'days').toDate(),
      });
    }

    const { handleSubscriptionReferralBonus } = await import('./referral');
    await handleSubscriptionReferralBonus(storage, dbPayment.userId);
    console.log(`[ACTIVATION] Activated ${normalizedTier} subscription (user ${dbPayment.userId}, period ${periodMonths}mo, orbs ${monthlyOrbs})`);

  } else if (dbPayment.kind === 'subscription_upgrade') {
    const periodMonths = Number(ykPayment.metadata?.periodMonths) || 1;
    const existingSub = await storage.getSubscription(dbPayment.userId);
    if (existingSub) {
      const update: any = { tier: 'pro', status: 'active', paymentProvider: 'yookassa' };
      if (periodMonths > 1) {
        // Апгрейд + продление: N месяцев Premium от текущей даты окончания
        const base = new Date(existingSub.currentPeriodEnd) > new Date() ? new Date(existingSub.currentPeriodEnd) : new Date();
        update.currentPeriodEnd = dayjs(base).add(periodMonths, 'month').toDate();
        update.periodMonths = periodMonths;
        update.amountRUB = dbPayment.amountRUB;
      }
      await storage.updateSubscription(existingSub.id, update);
    }
    const user = await storage.getUser(dbPayment.userId);
    if (user) {
      const currentOrbs = parseFloat(user.subscriptionOrbs || '0');
      const bonusOrbs = SUBSCRIPTION_MONTHLY_ORBS['premium'] - SUBSCRIPTION_MONTHLY_ORBS['standard'];
      await storage.updateUser(dbPayment.userId, {
        subscriptionOrbs: Math.max(0, currentOrbs + bonusOrbs).toString(),
      });
    }
    console.log(`[ACTIVATION] Upgraded to Premium (user ${dbPayment.userId}, +${periodMonths > 1 ? periodMonths + 'mo' : '0'})`);

  } else if (dbPayment.kind === 'subscription_renewal') {
    const periodMonths = Number(ykPayment.metadata?.periodMonths) || 1;
    const existingSub = await storage.getSubscription(dbPayment.userId);
    if (existingSub) {
      const base = new Date(existingSub.currentPeriodEnd) > new Date()
        ? new Date(existingSub.currentPeriodEnd)
        : new Date();
      const newPeriodEnd = dayjs(base).add(periodMonths, 'month').toDate();
      await storage.updateSubscription(existingSub.id, {
        status: 'active',
        currentPeriodEnd: newPeriodEnd,
        paymentProvider: 'yookassa',
        periodMonths,
        amountRUB: dbPayment.amountRUB,
      });
      const orbsKey = existingSub.tier === 'pro' ? 'premium' : 'standard';
      const monthlyOrbs = SUBSCRIPTION_MONTHLY_ORBS[orbsKey as keyof typeof SUBSCRIPTION_MONTHLY_ORBS];
      await storage.updateUser(dbPayment.userId, {
        subscriptionOrbs: monthlyOrbs.toString(),
        orbsResetAt: dayjs().add(30, 'days').toDate(),
      });
      console.log(`[ACTIVATION] Renewed subscription (user ${dbPayment.userId} until ${newPeriodEnd})`);
    }

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
