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
export async function handleSubscriptionReferralBonus(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  
  if (user?.referredById) {
    const referrer = await storage.getUser(user.referredById);
    if (referrer) {
      const referrerTier = await getUserTier(storage, referrer.id);
      
      if (referrerTier === 'free') {
        // Free referrer must CHOOSE: 7 days Standard OR 3 days Premium.
        // Create a pending reward; user picks the tier later via /api/referral/claim-choice
        await storage.createReferralReward({
          referrerId: referrer.id,
          referredUserId: userId,
          rewardType: 'subscription',
          energyAmount: 0,
          rewardKind: 'pending_choice',
        });
        console.log('[REFERRAL] Created pending choice reward for free referrer:', referrer.id);
      } else if (referrerTier === 'standard') {
        // Standard: +10 orbs + extend subscription
        const currentOrbs = parseFloat(referrer.referralOrbs || '0');
        await storage.updateUser(referrer.id, { 
          referralOrbs: (currentOrbs + 10).toString() 
        });
        
        // Extend subscription by 3 days
        const subscription = await storage.getSubscription(referrer.id);
        if (subscription?.currentPeriodEnd) {
          const newEnd = dayjs(subscription.currentPeriodEnd).add(3, 'day').toDate();
          await storage.updateSubscription(subscription.id, { currentPeriodEnd: newEnd });
        }
        
        await storage.createReferralReward({
          referrerId: referrer.id,
          referredUserId: userId,
          rewardType: 'subscription',
          energyAmount: 10,
          rewardKind: 'orbs',
        });
      } else if (referrerTier === 'premium') {
        // Premium: +20 orbs + extend subscription
        const currentOrbs = parseFloat(referrer.referralOrbs || '0');
        await storage.updateUser(referrer.id, { 
          referralOrbs: (currentOrbs + 20).toString() 
        });
        
        // Extend subscription by 3 days
        const subscription = await storage.getSubscription(referrer.id);
        if (subscription?.currentPeriodEnd) {
          const newEnd = dayjs(subscription.currentPeriodEnd).add(3, 'day').toDate();
          await storage.updateSubscription(subscription.id, { currentPeriodEnd: newEnd });
        }
        
        await storage.createReferralReward({
          referrerId: referrer.id,
          referredUserId: userId,
          rewardType: 'subscription',
          energyAmount: 20,
          rewardKind: 'orbs',
        });
      }
    }
  }
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

