import { createRecurringPayment } from './yookassa';
import { sendSupportAlert } from './support';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';

export interface RenewalResult {
  success: boolean;
  subscriptionId: string;
  userId: string;
  message: string;
  paymentId?: string;
  error?: string;
}

export interface NotificationResult {
  userId: string;
  telegramId: string;
  daysUntilExpiry: number;
  notificationType: 'warning' | 'expired';
  sent: boolean;
}

const NOTIFICATION_DAYS = [7, 3, 1]; // Days before expiry to send notifications

/**
 * Process auto-renewal for a single subscription with saved payment method
 */
export async function processAutoRenewal(
  subscription: {
    id: string;
    userId: string;
    tier: string;
    autoRenew: boolean;
    paymentMethodId: string | null;
    periodMonths: number;
    amountRUB: string | null;
  },
  storage: any
): Promise<RenewalResult> {
  const { id, userId, tier, paymentMethodId, periodMonths, amountRUB } = subscription;

  if (!paymentMethodId) {
    return {
      success: false,
      subscriptionId: id,
      userId,
      message: 'No saved payment method',
    };
  }

  if (!amountRUB) {
    return {
      success: false,
      subscriptionId: id,
      userId,
      message: 'No renewal amount set',
    };
  }

  try {
    console.log('[RENEWAL] Processing auto-renewal for subscription:', id);

    const idempotencyKey = nanoid(32);
    const description = `Astro Orb ${tier === 'pro' ? 'Pro' : 'Standard'} - Автопродление ${periodMonths} мес.`;

    const payment = await createRecurringPayment({
      amount: amountRUB,
      description,
      paymentMethodId,
      metadata: {
        userId,
        subscriptionId: id,
        tier,
        periodMonths,
        type: 'subscription_renewal',
      },
      idempotencyKey,
    });

    if (payment.status === 'succeeded' && payment.paid) {
      // Calculate new period end
      const newPeriodEnd = dayjs().add(periodMonths, 'month').toDate();
      
      // Update subscription
      await storage.updateSubscription(id, {
        status: 'active',
        currentPeriodEnd: newPeriodEnd,
        updatedAt: new Date(),
      });

      console.log('[RENEWAL] Auto-renewal succeeded for subscription:', id);

      return {
        success: true,
        subscriptionId: id,
        userId,
        message: `Auto-renewal successful, new period ends ${dayjs(newPeriodEnd).format('DD.MM.YYYY')}`,
        paymentId: payment.id,
      };
    } else {
      // Payment failed or pending
      console.log('[RENEWAL] Auto-renewal payment not succeeded:', payment.status);
      
      // Disable auto-renewal on failure
      await storage.updateSubscription(id, {
        autoRenew: false,
        paymentMethodId: null,
      });

      await sendSupportAlert(
        'Auto-renewal payment failed',
        `userId: ${userId}\nsubscriptionId: ${id}\ntier: ${tier}\nYooKassa payment ID: ${payment.id}\nstatus: ${payment.status}`
      );

      return {
        success: false,
        subscriptionId: id,
        userId,
        message: `Payment ${payment.status}`,
        paymentId: payment.id,
        error: `Payment status: ${payment.status}`,
      };
    }
  } catch (error: any) {
    console.error('[RENEWAL] Auto-renewal error for subscription:', id, error.message);
    
    // Disable auto-renewal on error
    await storage.updateSubscription(id, {
      autoRenew: false,
    });

    await sendSupportAlert(
      'Auto-renewal processing error',
      `userId: ${userId}\nsubscriptionId: ${id}\ntier: ${tier}\nerror: ${error.message}`
    );

    return {
      success: false,
      subscriptionId: id,
      userId,
      message: 'Payment processing failed',
      error: error.message,
    };
  }
}

/**
 * Get subscriptions that need renewal processing
 * Returns subscriptions expiring within the next hour that have auto-renewal enabled
 */
export async function getSubscriptionsForRenewal(storage: any): Promise<any[]> {
  const now = new Date();
  const oneHourFromNow = dayjs().add(1, 'hour').toDate();
  
  // Get all active subscriptions
  const allSubscriptions = await storage.getAllSubscriptions();
  
  // Filter: expiring soon, auto-renew enabled, has payment method
  return allSubscriptions.filter((sub: any) => {
    if (sub.status !== 'active') return false;
    if (!sub.autoRenew) return false;
    if (!sub.paymentMethodId) return false;
    
    const periodEnd = new Date(sub.currentPeriodEnd);
    return periodEnd <= oneHourFromNow && periodEnd > now;
  });
}

/**
 * Get subscriptions that need expiration notifications
 */
export async function getSubscriptionsForNotification(storage: any): Promise<any[]> {
  const now = dayjs();
  
  const allSubscriptions = await storage.getAllSubscriptions();
  
  return allSubscriptions.filter((sub: any) => {
    if (sub.status !== 'active' && sub.status !== 'canceled') return false;
    
    const periodEnd = dayjs(sub.currentPeriodEnd);
    const daysUntilExpiry = periodEnd.diff(now, 'day');
    
    // Check if we should notify (7, 3, or 1 day before)
    if (!NOTIFICATION_DAYS.includes(daysUntilExpiry)) return false;
    
    // Check if we already sent this notification today
    if (sub.lastRenewalNotification) {
      const lastNotification = dayjs(sub.lastRenewalNotification);
      if (lastNotification.isSame(now, 'day')) return false;
    }
    
    return true;
  });
}

/**
 * Generate notification message for subscription expiry
 */
export function getExpiryNotificationMessage(
  daysUntilExpiry: number,
  tier: string,
  hasAutoRenew: boolean,
  locale: 'ru' | 'en' = 'ru'
): { title: string; message: string } {
  const tierName = tier === 'pro' ? 'Pro' : 'Standard';
  
  if (locale === 'ru') {
    if (daysUntilExpiry === 0) {
      return {
        title: 'Подписка истекла',
        message: hasAutoRenew 
          ? `Ваша подписка ${tierName} истекла. Автопродление не удалось - пожалуйста, обновите способ оплаты.`
          : `Ваша подписка ${tierName} истекла. Продлите её, чтобы продолжить пользоваться всеми возможностями.`,
      };
    }
    
    const daysWord = daysUntilExpiry === 1 ? 'день' : (daysUntilExpiry < 5 ? 'дня' : 'дней');
    
    return {
      title: `Подписка заканчивается через ${daysUntilExpiry} ${daysWord}`,
      message: hasAutoRenew
        ? `Ваша подписка ${tierName} будет автоматически продлена.`
        : `Ваша подписка ${tierName} скоро закончится. Не забудьте продлить, чтобы сохранить все преимущества!`,
    };
  }
  
  // English
  if (daysUntilExpiry === 0) {
    return {
      title: 'Subscription expired',
      message: hasAutoRenew
        ? `Your ${tierName} subscription has expired. Auto-renewal failed - please update your payment method.`
        : `Your ${tierName} subscription has expired. Renew it to continue enjoying all features.`,
    };
  }
  
  const daysWord = daysUntilExpiry === 1 ? 'day' : 'days';
  
  return {
    title: `Subscription expires in ${daysUntilExpiry} ${daysWord}`,
    message: hasAutoRenew
      ? `Your ${tierName} subscription will be automatically renewed.`
      : `Your ${tierName} subscription is ending soon. Don't forget to renew to keep all benefits!`,
  };
}

/**
 * Calculate days until subscription expires
 */
export function getDaysUntilExpiry(currentPeriodEnd: Date): number {
  return dayjs(currentPeriodEnd).diff(dayjs(), 'day');
}
