import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const ENERGY_COSTS = {
  solar: 2,
  horoscope: 1,
  compatibility: 2,
  ask: 1,
  natal_external: 1,
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

export async function checkAndResetEnergy(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;

  const now = new Date();
  const resetAt = new Date(user.energyResetAt);

  if (now >= resetAt) {
    const subscription = await storage.getSubscription(userId);
    let newEnergy = 10;

    if (subscription?.status === 'active') {
      newEnergy = SUBSCRIPTION_DAILY_ENERGY[subscription.tier as 'standard' | 'pro'] || 10;
    }

    const nextReset = getNextResetTime(user.timezone);
    
    await storage.updateUser(userId, {
      energy: newEnergy,
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

  if (user.energy < cost) {
    return { ok: false, error: 'Insufficient energy' };
  }

  await storage.updateUser(userId, { energy: user.energy - cost });
  await storage.createUsageLog({ userId, feature, cost });

  return { ok: true };
}
