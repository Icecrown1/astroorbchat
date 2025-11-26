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

  // Пригласивший получает 10 сфер
  const referrerCurrentEnergy = referrer.purchasedEnergy || 0;
  await storage.updateUser(referrer.id, { purchasedEnergy: referrerCurrentEnergy + 10 });

  // Создаём запись о награде пригласившему
  await storage.createReferralReward({
    referrerId: referrer.id,
    referredUserId: userId,
    rewardType: 'signup',
    energyAmount: 10,
  });

  // Приглашённый получает 5 сфер
  const user = await storage.getUser(userId);
  const userCurrentEnergy = user?.purchasedEnergy || 0;
  await storage.updateUser(userId, { purchasedEnergy: userCurrentEnergy + 5 });

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
