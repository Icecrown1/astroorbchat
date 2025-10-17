import { nanoid } from 'nanoid';

export function generateReferralCode(): string {
  return nanoid(10);
}

export async function applyReferralBonus(storage: any, userId: string, referralCode: string): Promise<boolean> {
  if (!referralCode) return false;

  const referrer = await storage.getUserByReferralCode(referralCode);
  
  if (!referrer || referrer.id === userId) {
    return false;
  }

  await storage.updateUser(userId, { referredById: referrer.id });

  const currentPurchasedEnergy = referrer.purchasedEnergy || 0;
  await storage.updateUser(referrer.id, { purchasedEnergy: currentPurchasedEnergy + 5 });

  // Create referral reward record
  await storage.createReferralReward({
    referrerId: referrer.id,
    referredUserId: userId,
    rewardType: 'signup',
    energyAmount: 5,
  });

  return true;
}

export async function handleSubscriptionReferralBonus(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  
  if (user?.referredById) {
    const referrer = await storage.getUser(user.referredById);
    if (referrer) {
      const currentPurchasedEnergy = referrer.purchasedEnergy || 0;
      await storage.updateUser(referrer.id, { purchasedEnergy: currentPurchasedEnergy + 10 });

      // Create referral reward record
      await storage.createReferralReward({
        referrerId: referrer.id,
        referredUserId: userId,
        rewardType: 'subscription',
        energyAmount: 10,
      });
    }
  }
}
