import { nanoid } from 'nanoid';
import { getUserTier, REFERRAL_REWARDS, SUBSCRIPTION_MONTHLY_ORBS } from './energy.js';
import dayjs from 'dayjs';

export function generateReferralCode(): string {
  return nanoid(10);
}

/**
 * Apply referral bonus when a new user signs up with a referral code
 * 
 * New tier-based rewards:
 * - Free referrer: Gets 7 days of Standard subscription
 * - Free referred: Gets 3 days of Premium subscription
 * - Standard referrer: Gets 15 orbs
 * - Standard referred: Gets 5 orbs
 * - Premium referrer: Gets 5 extra days of Premium
 * - Premium referred: Gets 5 extra days of Premium
 */
export async function applyReferralBonus(storage: any, userId: string, referralCode: string): Promise<boolean> {
  if (!referralCode) return false;

  const referrer = await storage.getUserByReferralCode(referralCode);
  
  if (!referrer || referrer.id === userId) {
    return false;
  }

  await storage.updateUser(userId, { referredById: referrer.id });

  // Get tiers for both users
  const referrerTier = await getUserTier(storage, referrer.id);
  const referredUser = await storage.getUser(userId);
  const referredTier = await getUserTier(storage, userId);
  
  // Determine rewards based on referrer's tier
  const rewardConfig = REFERRAL_REWARDS[referrerTier];
  
  // Apply reward to referrer
  await applyReward(storage, referrer.id, rewardConfig.referrer, 'signup_referrer', userId);
  
  // Apply reward to referred user
  await applyReward(storage, userId, rewardConfig.referred, 'signup_referred', referrer.id);

  return true;
}

/**
 * Apply subscription referral bonus when a referred user subscribes
 */
export async function handleSubscriptionReferralBonus(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  
  if (user?.referredById) {
    const referrer = await storage.getUser(user.referredById);
    if (referrer) {
      const referrerTier = await getUserTier(storage, referrer.id);
      
      // Standard subscribers get orbs, Premium gets extra days
      if (referrerTier === 'standard') {
        const currentOrbs = referrer.subscriptionOrbs || 0;
        await storage.updateUser(referrer.id, { 
          subscriptionOrbs: currentOrbs + 15 
        });
        
        await storage.createReferralReward({
          referrerId: referrer.id,
          referredUserId: userId,
          rewardType: 'subscription',
          energyAmount: 15,
          rewardKind: 'orbs',
        });
      } else if (referrerTier === 'premium') {
        // Add 5 days to Premium subscription
        const currentEnd = referrer.subscriptionEnd ? new Date(referrer.subscriptionEnd) : new Date();
        const newEnd = dayjs(currentEnd).add(5, 'day').toDate();
        await storage.updateUser(referrer.id, { subscriptionEnd: newEnd });
        
        await storage.createReferralReward({
          referrerId: referrer.id,
          referredUserId: userId,
          rewardType: 'subscription',
          energyAmount: 0,
          rewardKind: 'subscription_days',
          subscriptionDays: 5,
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
    
    // If upgrading to Standard, give them 250 orbs if they don't have any
    if (tierName === 'standard' && !user.subscriptionOrbs) {
      updates.subscriptionOrbs = SUBSCRIPTION_MONTHLY_ORBS;
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
