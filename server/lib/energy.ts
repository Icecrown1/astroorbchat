import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const ENERGY_COSTS = {
  solar: 11,
  horoscope: 2,
  compatibility: 2,
  ask: 1,
  natal_external: 2,
  important_date_detail: 1,
  compatibility_professional: 4,  // Профессиональная синастрия
  weekly_plan: 1,  // План на неделю
  monthly_plan: 1,  // План на месяц
} as const;

export const SUBSCRIPTION_DAILY_ENERGY = {
  standard: 100,
  pro: 250,
} as const;

export function getNextResetTime(userTimezone: string): Date {
  const now = dayjs().tz(userTimezone);
  const tomorrow = now.add(1, 'day').startOf('day');
  return tomorrow.toDate();
}

// CRITICAL: Check and update subscription expiry status
// Call this BEFORE checking subscription benefits anywhere
export async function checkSubscriptionExpiry(storage: any, userId: string): Promise<any> {
  const subscription = await storage.getSubscription(userId);
  
  if (!subscription || !subscription.currentPeriodEnd) {
    return subscription;
  }
  
  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  
  // If period ended and not already expired, mark as expired
  if (now > periodEnd && subscription.status !== 'expired') {
    console.log('[SUBSCRIPTION] Marking as expired for user:', userId);
    await storage.updateSubscription(subscription.id, { status: 'expired' });
    return { ...subscription, status: 'expired' };
  }
  
  return subscription;
}

export async function checkAndResetEnergy(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;

  const now = new Date();
  const resetAt = new Date(user.energyResetAt);

  if (now >= resetAt) {
    let subscription = await storage.getSubscription(userId);
    
    // CRITICAL: Check if subscription expired and update status
    if (subscription && subscription.currentPeriodEnd) {
      const periodEnd = new Date(subscription.currentPeriodEnd);
      
      // If period ended, mark as expired (works for both active and canceled)
      if (now > periodEnd && subscription.status !== 'expired') {
        console.log('[SUBSCRIPTION] Subscription expired for user:', userId);
        await storage.updateSubscription(subscription.id, { status: 'expired' });
        subscription = { ...subscription, status: 'expired' };
      }
    }
    
    let newFreeEnergy = 10;

    // Both 'active' and 'canceled' get benefits until period ends
    if (subscription?.status === 'active' || subscription?.status === 'canceled') {
      newFreeEnergy = SUBSCRIPTION_DAILY_ENERGY[subscription.tier as 'standard' | 'pro'] || 10;
    }

    const nextReset = getNextResetTime(user.timezone);
    
    // Reset only free energy, keep purchased energy intact
    await storage.updateUser(userId, {
      freeEnergy: newFreeEnergy,
      energyResetAt: nextReset,
    });
  }
}

export async function deductEnergy(
  storage: any,
  userId: string,
  feature: keyof typeof ENERGY_COSTS
): Promise<{ ok: boolean; error?: string }> {
  await checkAndResetEnergy(storage, userId);

  const user = await storage.getUser(userId);
  if (!user) {
    return { ok: false, error: 'User not found' };
  }

  const cost = ENERGY_COSTS[feature];
  const totalEnergy = user.freeEnergy + user.purchasedEnergy;

  if (totalEnergy < cost) {
    return { ok: false, error: 'Insufficient energy' };
  }

  // Deduct from free energy first, then from purchased energy
  let newFreeEnergy = user.freeEnergy;
  let newPurchasedEnergy = user.purchasedEnergy;

  if (user.freeEnergy >= cost) {
    // Enough free energy to cover the cost
    newFreeEnergy = user.freeEnergy - cost;
  } else {
    // Use all free energy and remaining from purchased
    const remainingCost = cost - user.freeEnergy;
    newFreeEnergy = 0;
    newPurchasedEnergy = user.purchasedEnergy - remainingCost;
  }

  await storage.updateUser(userId, { 
    freeEnergy: newFreeEnergy,
    purchasedEnergy: newPurchasedEnergy 
  });
  await storage.createUsageLog({ userId, feature, cost });

  return { ok: true };
}
