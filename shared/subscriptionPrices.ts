/**
 * Цены подписок — ОДИН источник правды для сервера и клиента.
 * ₽ в месяц по периоду; Stars = ceil(₽) (курс ~1 ⭐ ≈ 1 ₽, как у месячных 200/400 ⭐).
 */
export type PaidTier = 'standard' | 'premium';
export type PeriodMonths = 1 | 6 | 12;

export const SUBSCRIPTION_PRICES_PER_MONTH: Record<PaidTier, Record<PeriodMonths, number>> = {
  standard: { 1: 199, 6: 159, 12: 99 },
  premium:  { 1: 399, 6: 359, 12: 179 },
};

/** Месячная star-подписка (recurring, ровно 30 дней) */
export const STARS_SUB_PRICES: Record<PaidTier, number> = { standard: 200, premium: 400 };

export const PERIOD_LABEL_RU: Record<PeriodMonths, string> = { 1: '1 месяц', 6: '6 месяцев', 12: '12 месяцев' };
export const PERIOD_LABEL_EN: Record<PeriodMonths, string> = { 1: '1 month', 6: '6 months', 12: '12 months' };

export function normalizePaidTier(t: string | null | undefined): PaidTier {
  return t === 'premium' || t === 'pro' ? 'premium' : 'standard';
}

export function subscriptionRub(tier: PaidTier, months: PeriodMonths): number {
  return SUBSCRIPTION_PRICES_PER_MONTH[tier][months] * months;
}

/** Доплата за апгрейд Standard → Premium за оставшиеся дни (₽) */
export function upgradeRub(remainingDays: number): number {
  const dailyDelta = (SUBSCRIPTION_PRICES_PER_MONTH.premium[1] - SUBSCRIPTION_PRICES_PER_MONTH.standard[1]) / 30;
  return Math.max(1, Math.ceil(remainingDays * dailyDelta));
}

export function starsForRub(rub: number): number {
  return Math.max(1, Math.ceil(rub));
}

/** Цена подписки в Stars: 1 месяц — 200/400 ⭐ (как у recurring-подписки), 6/12 мес — ceil(₽ за период) */
export function subscriptionStars(tier: PaidTier, months: PeriodMonths): number {
  return months === 1 ? STARS_SUB_PRICES[tier] : starsForRub(subscriptionRub(tier, months));
}

/** Доплата за апгрейд Standard → Premium в Stars (+ N месяцев Premium, если период 6/12) */
export function upgradeStars(remainingDays: number, months: PeriodMonths): number {
  return starsForRub(upgradeRub(remainingDays)) + (months > 1 ? subscriptionStars('premium', months) : 0);
}

/**
 * Акция «первый месяц −50%»: для тех, кто ещё ни разу не платил за подписку.
 * Разовый счёт в Stars на 1 месяц (100/200 ⭐ вместо 200/400 ⭐), без автопродления.
 * Право на скидку решает сервер (server/lib/firstMonthOffer.ts), клиент лишь показывает цены.
 */
export const FIRST_MONTH_DISCOUNT_PCT = 50;
export const FIRST_MONTH_PROMO_CODE = 'first_month_50';

export function firstMonthPromoRub(tier: PaidTier): number {
  return Math.floor((SUBSCRIPTION_PRICES_PER_MONTH[tier][1] * (100 - FIRST_MONTH_DISCOUNT_PCT)) / 100);
}

export function firstMonthPromoStars(tier: PaidTier): number {
  return Math.round((STARS_SUB_PRICES[tier] * (100 - FIRST_MONTH_DISCOUNT_PCT)) / 100);
}
