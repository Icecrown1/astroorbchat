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
