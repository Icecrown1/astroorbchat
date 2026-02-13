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
        // Free referrer gets 7 days Standard + 3 days Premium
        await applyReward(storage, referrer.id, 
          { type: 'subscription_standard_days', days: 7 }, 
          'subscription_referrer', userId
        );
        // Also give 3 days Premium on top
        await applyReward(storage, referrer.id, 
          { type: 'subscription_premium_days', days: 3 }, 
          'subscription_referrer_premium', userId
        );
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
 * Apply a specific reward to a user
 */
async function applyReward(
  storage: any, 
  userId: string, 
  reward: { type: string; days?: number; amount?: number },
  rewardType: string,
  relatedUserId: string
): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;
  
  if (reward.type.includes('subscription') && reward.days) {
    // Grant temporary subscription
    const tierName = reward.type.includes('premium') ? 'premium' : 'standard';
    const now = dayjs();
    
    // If user already has subscription, extend it
    let newEnd: Date;
    if (user.subscriptionEnd && dayjs(user.subscriptionEnd).isAfter(now)) {
      newEnd = dayjs(user.subscriptionEnd).add(reward.days, 'day').toDate();
    } else {
      newEnd = now.add(reward.days, 'day').toDate();
    }
    
    // Update subscription
    const updates: any = {
      subscriptionTier: tierName,
      subscriptionEnd: newEnd,
    };
    
    // If upgrading, give them monthly orbs if they don't have any
    if ((tierName === 'standard' || tierName === 'premium') && !user.subscriptionOrbs) {
      updates.subscriptionOrbs = SUBSCRIPTION_MONTHLY_ORBS[tierName as 'standard' | 'premium'];
      updates.orbsResetAt = dayjs().add(1, 'month').startOf('month').toDate();
    }
    
    await storage.updateUser(userId, updates);
    
    await storage.createReferralReward({
      referrerId: userId === relatedUserId ? userId : relatedUserId,
      referredUserId: userId,
      rewardType,
      energyAmount: 0,
      rewardKind: 'subscription_days',
      subscriptionDays: reward.days,
    });
    
  } else if (reward.type === 'orbs' && reward.amount) {
    // Grant orbs (to referralOrbs field for persistence)
    const currentReferralOrbs = user.referralOrbs || 0;
    await storage.updateUser(userId, { 
      referralOrbs: currentReferralOrbs + reward.amount 
    });
    
    await storage.createReferralReward({
      referrerId: userId === relatedUserId ? userId : relatedUserId,
      referredUserId: userId,
      rewardType,
      energyAmount: reward.amount,
      rewardKind: 'orbs',
    });
  }
}
