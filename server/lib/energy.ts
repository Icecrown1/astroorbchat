import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// New pricing system based on subscription tiers
// Free users: only natal chart with short descriptions
// Standard: 250 orbs/month, all features except solar return
// Premium: 550 orbs/month, all features including solar return

export const ORB_COSTS = {
  // Low priority (1 orb)
  horoscope_daily: 1,
  
  // Very low (0.5 orb)
  oracle: 0.5,
  
  // Low+ priority (2-3 orbs)
  planet_interpretation: 2,  // Detailed planet interpretation in natal chart
  house_influence: 2,        // House influence interpretation
  important_date: 3,         // Important date interpretation
  
  // Medium priority (5 orbs)
  horoscope_weekly: 5,
  
  // High priority (15-20 orbs)
  horoscope_monthly: 15,
  solar_return: 15,          // Solar return - Premium only
  natal_external: 20,        // Guest natal chart
  compatibility: 20,         // Compatibility analysis
} as const;

// Features that require Premium tier (not available in Standard)
export const PREMIUM_ONLY_FEATURES: Array<keyof typeof ORB_COSTS> = ['solar_return'];

// Legacy costs mapping for backward compatibility
export const ENERGY_COSTS = {
  solar: 15,
  horoscope: 1,
  compatibility: 20,
  ask: 0.5,
  natal_external: 20,
  important_date_detail: 3,
  important_date: 3,
  compatibility_professional: 20,
  weekly_plan: 5,
  monthly_plan: 15,
  house_influence: 2,
  planet_interpretation: 2,
} as const;

// Monthly orbs per subscription tier
export const SUBSCRIPTION_MONTHLY_ORBS = {
  standard: 250,
  premium: 550,
} as const;

// Subscription pricing in RUB
export const SUBSCRIPTION_PRICES = {
  standard: {
    monthly: 199,
    semiannual: 159, // per month when paid for 6 months
    annual: 99,      // per month when paid for 12 months
  },
  premium: {
    monthly: 399,
    semiannual: 359, // per month when paid for 6 months
    annual: 179,     // per month when paid for 12 months
  },
} as const;

// Referral rewards based on subscription tier
// Rewards are given when the REFERRED user PAYS for a subscription
export const REFERRAL_REWARDS = {
  // Free users: referrer gets 7 days Standard + 3 days Premium
  free: {
    referrer: { type: 'subscription_standard_days', days: 7 },
    referred: { type: 'subscription_premium_days', days: 3 },
  },
  // Standard subscribers: +10 orbs per invite + subscription extension when friend pays
  standard: {
    referrer: { type: 'orbs', amount: 10 },
    referred: { type: 'orbs', amount: 0 },
  },
  // Premium subscribers: +20 orbs per invite + subscription extension when friend pays
  premium: {
    referrer: { type: 'orbs', amount: 20 },
    referred: { type: 'orbs', amount: 0 },
  },
} as const;

// Legacy daily energy config (deprecated)
export const SUBSCRIPTION_DAILY_ENERGY = {
  standard: 100,
  pro: 250,
} as const;

export function getNextOrbsResetTime(userTimezone: string): Date {
  const now = dayjs().tz(userTimezone);
  // Reset on the 1st of next month
  const nextMonth = now.add(1, 'month').startOf('month');
  return nextMonth.toDate();
}

export function getNextResetTime(userTimezone: string): Date {
  const now = dayjs().tz(userTimezone);
  const tomorrow = now.add(1, 'day').startOf('day');
  return tomorrow.toDate();
}

// Check subscription status
export async function checkSubscriptionExpiry(storage: any, userId: string): Promise<any> {
  const subscription = await storage.getSubscription(userId);
  
  if (!subscription || !subscription.currentPeriodEnd) {
    return subscription;
  }
  
  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  
  if (now > periodEnd && subscription.status !== 'expired') {
    console.log('[SUBSCRIPTION] Marking as expired for user:', userId);
    await storage.updateSubscription(subscription.id, { status: 'expired' });
    return { ...subscription, status: 'expired' };
  }
  
  return subscription;
}

// Get user's subscription tier: 'free', 'standard', 'premium'
export async function getUserTier(storage: any, userId: string): Promise<'free' | 'standard' | 'premium'> {
  const subscription = await checkSubscriptionExpiry(storage, userId);
  
  if (!subscription || subscription.status === 'expired') {
    return 'free';
  }
  
  if (subscription.status === 'active' || subscription.status === 'canceled') {
    if (subscription.tier === 'pro' || subscription.tier === 'premium') {
      return 'premium';
    }
    return 'standard';
  }
  
  return 'free';
}

// Check if feature is available for user
export async function canAccessFeature(
  storage: any,
  userId: string,
  feature: keyof typeof ORB_COSTS
): Promise<{ allowed: boolean; requiresSubscription: boolean; requiresPremium: boolean; cost: number; tier: 'free' | 'standard' | 'premium' }> {
  const tier = await getUserTier(storage, userId);
  const cost = ORB_COSTS[feature];
  const isPremiumOnly = PREMIUM_ONLY_FEATURES.includes(feature);
  
  // Free users can only access natal chart (without detailed interpretations)
  if (tier === 'free') {
    return { allowed: false, requiresSubscription: true, requiresPremium: false, cost, tier };
  }
  
  // Standard users: check if feature is Premium-only (e.g. solar return)
  if (tier === 'standard') {
    if (isPremiumOnly) {
      return { allowed: false, requiresSubscription: false, requiresPremium: true, cost, tier };
    }
    
    // Standard users pay with orbs
    const user = await storage.getUser(userId);
    if (!user) {
      return { allowed: false, requiresSubscription: true, requiresPremium: false, cost, tier };
    }
    
    const totalOrbs = parseFloat(user.subscriptionOrbs || '0') + parseFloat(user.referralOrbs || '0');
    
    return { 
      allowed: totalOrbs >= cost, 
      requiresSubscription: false, 
      requiresPremium: false,
      cost, 
      tier 
    };
  }
  
  // Premium: all features available, pay with orbs (550/month)
  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, requiresSubscription: true, requiresPremium: false, cost, tier };
  }
  
  const totalOrbs = parseFloat(user.subscriptionOrbs || '0') + parseFloat(user.referralOrbs || '0');
  
  return { 
    allowed: totalOrbs >= cost, 
    requiresSubscription: false, 
    requiresPremium: false,
    cost, 
    tier 
  };
}

// Reset monthly orbs for Standard/Premium subscribers
export async function checkAndResetOrbs(storage: any, userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;

  const now = new Date();
  const resetAt = new Date(user.orbsResetAt);

  if (now >= resetAt) {
    const tier = await getUserTier(storage, userId);
    
    if (tier === 'standard' || tier === 'premium') {
      const monthlyOrbs = SUBSCRIPTION_MONTHLY_ORBS[tier];
      const nextReset = getNextOrbsResetTime(user.timezone);
      await storage.updateUser(userId, {
        subscriptionOrbs: monthlyOrbs.toString(),
        orbsResetAt: nextReset,
      });
      console.log(`[ORBS] Reset monthly orbs to ${monthlyOrbs} for ${tier} user:`, userId);
    }
  }
}

// Deduct orbs for a feature (both Standard and Premium pay with orbs)
export async function deductOrbs(
  storage: any,
  userId: string,
  feature: keyof typeof ORB_COSTS
): Promise<{ ok: boolean; error?: string }> {
  const tier = await getUserTier(storage, userId);
  
  // Free users cannot use paid features
  if (tier === 'free') {
    return { ok: false, error: 'Subscription required' };
  }
  
  // Check if feature is Premium-only
  if (tier === 'standard' && PREMIUM_ONLY_FEATURES.includes(feature)) {
    return { ok: false, error: 'Premium subscription required' };
  }
  
  // Check and reset orbs if needed
  await checkAndResetOrbs(storage, userId);
  
  const user = await storage.getUser(userId);
  if (!user) {
    return { ok: false, error: 'User not found' };
  }
  
  const cost = ORB_COSTS[feature];
  const subscriptionOrbs = parseFloat(user.subscriptionOrbs || '0');
  const referralOrbs = parseFloat(user.referralOrbs || '0');
  const totalOrbs = subscriptionOrbs + referralOrbs;
  
  console.log('[ORBS] Deducting:', { feature, cost, subscriptionOrbs, referralOrbs, totalOrbs, tier });
  
  if (totalOrbs < cost) {
    return { ok: false, error: 'Insufficient stars' };
  }
  
  // Deduct from subscription orbs first, then referral orbs
  let newSubscriptionOrbs = subscriptionOrbs;
  let newReferralOrbs = referralOrbs;
  
  if (subscriptionOrbs >= cost) {
    newSubscriptionOrbs = subscriptionOrbs - cost;
  } else {
    const remainingCost = cost - subscriptionOrbs;
    newSubscriptionOrbs = 0;
    newReferralOrbs = referralOrbs - remainingCost;
  }
  
  await storage.updateUser(userId, { 
    subscriptionOrbs: newSubscriptionOrbs.toString(),
    referralOrbs: newReferralOrbs.toString(),
  });
  await storage.createUsageLog({ userId, feature, cost });
  
  console.log('[ORBS] Successfully deducted', cost, 'orbs for', feature);
  return { ok: true };
}

// Legacy function - wrapper for backward compatibility
export async function deductEnergy(
  storage: any,
  userId: string,
  feature: keyof typeof ENERGY_COSTS
): Promise<{ ok: boolean; error?: string }> {
  // Map legacy feature names to new orb costs
  const featureMapping: Record<string, keyof typeof ORB_COSTS> = {
    solar: 'solar_return',
    horoscope: 'horoscope_daily',
    compatibility: 'compatibility',
    ask: 'oracle',
    natal_external: 'natal_external',
    important_date_detail: 'important_date',
    important_date: 'important_date',
    compatibility_professional: 'compatibility',
    weekly_plan: 'horoscope_weekly',
    monthly_plan: 'horoscope_monthly',
    house_influence: 'house_influence',
    planet_interpretation: 'planet_interpretation',
  };
  
  const mappedFeature = featureMapping[feature] || 'oracle';
  return deductOrbs(storage, userId, mappedFeature);
}

// Legacy function for daily reset
export async function checkAndResetEnergy(storage: any, userId: string): Promise<void> {
  await checkAndResetOrbs(storage, userId);
}

// Get total available orbs for user
export async function getUserOrbs(storage: any, userId: string): Promise<{ 
  subscriptionOrbs: number; 
  referralOrbs: number; 
  total: number;
  maxOrbs: number;
  tier: 'free' | 'standard' | 'premium';
}> {
  await checkAndResetOrbs(storage, userId);
  
  const user = await storage.getUser(userId);
  const tier = await getUserTier(storage, userId);
  
  if (!user) {
    return { subscriptionOrbs: 0, referralOrbs: 0, total: 0, maxOrbs: 0, tier: 'free' };
  }
  
  const subscriptionOrbs = parseFloat(user.subscriptionOrbs || '0');
  const referralOrbs = parseFloat(user.referralOrbs || '0');
  const maxOrbs = tier === 'free' ? 0 : SUBSCRIPTION_MONTHLY_ORBS[tier];
  
  return {
    subscriptionOrbs,
    referralOrbs,
    total: subscriptionOrbs + referralOrbs,
    maxOrbs,
    tier,
  };
}
