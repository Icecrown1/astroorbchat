import { nanoid } from 'nanoid';
import { getUserTier, REFERRAL_REWARDS, SUBSCRIPTION_MONTHLY_ORBS } from './energy.js';
import dayjs from 'dayjs';

export function generateReferralCode(): string {
  return nanoid(10);
}

/**
 * Track referral when a new user signs up with a referral code.
 * Only saves the referral link — rewards are given later when the friend PAYS for subscription.
 */
export async function applyReferralBonus(storage: any, userId: string, referralCode: string): Promise<boolean> {
  if (!referralCode) return false;

  const referrer = await storage.getUserByReferralCode(referralCode);
  
  if (!referrer || referrer.id === userId) {
    return false;
  }

  // Only track the referral relationship — no rewards until friend pays
  await storage.updateUser(userId, { referredById: referrer.id });
  
  console.log('[REFERRAL] Tracked referral link:', userId, '→ referrer:', referrer.id);
  return true;
}

/**
 * Apply subscription referral bonus when a referred user PAYS for subscription
 * This is the main referral reward trigger
 */
const REWARD_HOLD_HOURS = 72;        // окно «созревания»: рефанд в эти 72ч снимает награду без клобэка
const MAX_REWARDS_PER_30D = 30;      // антифрод: потолок наград на реферера за 30 дней

/**
 * Друг ОПЛАТИЛ подписку → создаём награду в статусе hold с разблокировкой через 72ч.
 * Начисление произойдёт в processDueReferralRewards. Антифрод: один reward на друга,
 * потолок наград за 30 дней, самореферал отсечён ранее.
 */
export async function handleSubscriptionReferralBonus(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user?.referredById) return;
  const referrer = await storage.getUser(user.referredById);
  if (!referrer || referrer.id === userId) return;

  const existing: any[] = await storage.getReferralRewardsByReferrer(referrer.id);

  // Один subscription-reward на конкретного друга (кроме отозванных)
  if (existing.some((r) => r.referredUserId === userId && r.rewardType === 'subscription' && r.status !== 'revoked')) {
    console.log('[REFERRAL] duplicate subscription reward skipped:', referrer.id, '←', userId);
    return;
  }
  // Потолок за 30 дней
  const monthAgo = dayjs().subtract(30, 'day').toDate();
  const recent = existing.filter((r) => new Date(r.createdAt) > monthAgo && r.status !== 'revoked');
  if (recent.length >= MAX_REWARDS_PER_30D) {
    console.warn('[REFERRAL] 30d reward cap reached, skipped:', referrer.id);
    return;
  }

  const referrerTier = await getUserTier(storage, referrer.id);
  const unlockAt = dayjs().add(REWARD_HOLD_HOURS, 'hour').toDate();

  if (referrerTier === 'free') {
    // Free выбирает: 7 дней Standard или 3 дня Premium — выбор доступен после созревания
    await storage.createReferralReward({
      referrerId: referrer.id,
      referredUserId: userId,
      rewardType: 'subscription',
      energyAmount: 0,
      rewardKind: 'pending_choice',
      status: 'hold',
      unlockAt,
    });
  } else {
    const orbs = referrerTier === 'premium' ? 20 : 10;
    await storage.createReferralReward({
      referrerId: referrer.id,
      referredUserId: userId,
      rewardType: 'subscription',
      energyAmount: orbs,
      rewardKind: 'orbs',
      subscriptionDays: 3,
      status: 'hold',
      unlockAt,
    });
  }
  console.log('[REFERRAL] hold reward created for', referrer.id, 'unlock at', unlockAt.toISOString());
}

/**
 * Дозревание: hold-награды с истёкшим unlockAt начисляются (orbs + продление),
 * pending_choice становится claimable. Вызывается лениво при заходе реферера.
 */
export async function processDueReferralRewards(storage: any, referrerId: string): Promise<number> {
  const rewards: any[] = await storage.getReferralRewardsByReferrer(referrerId);
  const due = rewards.filter((r) => r.status === 'hold' && r.unlockAt && new Date(r.unlockAt) <= new Date());
  let processed = 0;
  for (const r of due) {
    if (r.rewardKind === 'orbs') {
      const referrer = await storage.getUser(referrerId);
      const currentOrbs = parseFloat(referrer?.referralOrbs || '0');
      await storage.updateUser(referrerId, { referralOrbs: (currentOrbs + (r.energyAmount || 0)).toString() });
      if (r.subscriptionDays) {
        const subscription = await storage.getSubscription(referrerId);
        if (subscription?.status === 'active' && subscription.currentPeriodEnd) {
          const newEnd = dayjs(subscription.currentPeriodEnd).add(r.subscriptionDays, 'day').toDate();
          await storage.updateSubscription(subscription.id, { currentPeriodEnd: newEnd });
        }
      }
      await storage.updateReferralReward(r.id, { status: 'granted', grantedAt: new Date() });
      processed++;
    } else if (r.rewardKind === 'pending_choice') {
      await storage.updateReferralReward(r.id, { status: 'claimable' });
      processed++;
    }
  }
  if (processed) console.log('[REFERRAL] processed due rewards:', referrerId, processed);
  return processed;
}

/**
 * Clawback при рефанде подписки друга: hold/claimable — просто отзываем,
 * granted orbs — списываем обратно (не ниже нуля) и снимаем добавленные дни.
 */
export async function revokeReferralRewardsForReferred(storage: any, referredUserId: string): Promise<void> {
  const user = await storage.getUser(referredUserId);
  if (!user?.referredById) return;
  const rewards: any[] = await storage.getReferralRewardsByReferrer(user.referredById);
  const target = rewards
    .filter((r) => r.referredUserId === referredUserId && r.rewardType === 'subscription' && r.status !== 'revoked')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!target) return;

  if (target.status === 'granted' && target.rewardKind === 'orbs') {
    const referrer = await storage.getUser(user.referredById);
    const currentOrbs = parseFloat(referrer?.referralOrbs || '0');
    await storage.updateUser(user.referredById, {
      referralOrbs: Math.max(0, currentOrbs - (target.energyAmount || 0)).toString(),
    });
    if (target.subscriptionDays) {
      const subscription = await storage.getSubscription(user.referredById);
      if (subscription?.currentPeriodEnd) {
        const newEnd = dayjs(subscription.currentPeriodEnd).subtract(target.subscriptionDays, 'day').toDate();
        await storage.updateSubscription(subscription.id, { currentPeriodEnd: newEnd });
      }
    }
  }
  // Уже применённый выбор (claim) отдельно не откатываем — выбор конвертирует kind, ловим только неистраченные
  await storage.updateReferralReward(target.id, { status: 'revoked', revokedAt: new Date() });
  console.log('[REFERRAL] clawback:', referredUserId, '→ reward', target.id, 'was', target.status);
}

/**
 * Free referrer claims a pending choice reward: 'standard' (7 days) or 'premium' (3 days).
 * Applies the subscription to the referrer and converts the pending reward record.
 */
export async function claimReferralChoice(
  storage: any,
  referrerId: string,
  rewardId: string,
  choice: 'standard' | 'premium'
): Promise<{ tier: 'standard' | 'premium'; days: number; currentPeriodEnd: Date }> {
  {
    const reward = await storage.getReferralReward(rewardId);
    if (reward && reward.status === 'hold') {
      throw new Error('reward_not_ready'); // созреет через 72ч после оплаты друга
    }
    if (reward && reward.status === 'revoked') {
      throw new Error('reward_revoked');
    }
  }
  const tierName: 'standard' | 'premium' = choice === 'premium' ? 'premium' : 'standard';
  const days = tierName === 'premium' ? 3 : 7;
  // DB tier uses 'pro' for premium; getUserTier maps it back to 'premium'.
  const dbTier: 'standard' | 'pro' = tierName === 'premium' ? 'pro' : 'standard';

  // Claim + apply subscription + grant orbs in one transaction (atomic, race-safe).
  const result = await storage.claimReferralChoiceAtomic({
    rewardId,
    referrerId,
    rewardKind: tierName === 'premium' ? 'subscription_premium_days' : 'subscription_standard_days',
    subscriptionDays: days,
    days,
    dbTier,
    monthlyOrbs: SUBSCRIPTION_MONTHLY_ORBS[tierName],
  });

  if (!result.claimed) {
    // Determine the precise reason for a helpful error message.
    const reward = await storage.getReferralReward(rewardId);
    if (!reward) throw new Error('Reward not found');
    if (reward.referrerId !== referrerId) throw new Error('Reward does not belong to this user');
    throw new Error('Reward has already been claimed');
  }

  console.log('[REFERRAL] Claimed choice reward:', rewardId, '→', dbTier, days, 'days');

  return { tier: tierName, days, currentPeriodEnd: result.currentPeriodEnd! };
}

