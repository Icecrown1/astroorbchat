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

  const currentEnergy = referrer.energy || 0;
  await storage.updateUser(referrer.id, { energy: currentEnergy + 5 });

  return true;
}

export async function handleSubscriptionReferralBonus(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  
  if (user?.referredById) {
    const referrer = await storage.getUser(user.referredById);
    if (referrer) {
      const currentEnergy = referrer.energy || 0;
      await storage.updateUser(referrer.id, { energy: currentEnergy + 10 });
    }
  }
}
