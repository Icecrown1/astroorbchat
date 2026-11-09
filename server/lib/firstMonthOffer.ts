/**
 * Акция «первый месяц −50%» — кто имеет право.
 *
 * Право есть, если пользователь НИ РАЗУ не платил за подписку ни одним способом:
 *  - нет активной подписки сейчас (любой — включая реферальную/админскую);
 *  - subscriptions.paymentProvider не из платных (yookassa / ton / stars / dodo);
 *  - нет завершённых подписочных платежей ЮKassa (subscription / renewal / upgrade);
 *  - нет подтверждённых подписочных платежей GRAM (таблица payments).
 * Подписка, выданная админом/dev или реферальной наградой, оплатой не считается.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../db";
import { payments, subscriptions, yookassaPayments } from "@shared/schema";
import {
  FIRST_MONTH_DISCOUNT_PCT,
  SUBSCRIPTION_PRICES_PER_MONTH,
  firstMonthPromoRub,
} from "@shared/subscriptionPrices";

const PAID_PROVIDERS = ["yookassa", "ton", "stars", "dodo"];

export async function isFirstMonthOfferEligible(userId: string): Promise<boolean> {
  const [sub] = await db
    .select({
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      paymentProvider: subscriptions.paymentProvider,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (sub) {
    const active = sub.status === "active" && new Date(sub.currentPeriodEnd) > new Date();
    if (active) return false;
    if (sub.paymentProvider && PAID_PROVIDERS.includes(sub.paymentProvider)) return false;
  }

  const paidCard = await db
    .select({ id: yookassaPayments.id })
    .from(yookassaPayments)
    .where(
      and(
        eq(yookassaPayments.userId, userId),
        like(yookassaPayments.kind, "subscription%"),
        eq(yookassaPayments.status, "completed"),
      ),
    )
    .limit(1);
  if (paidCard.length) return false;

  const paidGram = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.kind, "subscription"),
        inArray(payments.status, ["completed", "confirmed"]),
      ),
    )
    .limit(1);
  if (paidGram.length) return false;

  return true;
}

export function firstMonthOfferPrices() {
  return {
    discountPct: FIRST_MONTH_DISCOUNT_PCT,
    standard: { full: SUBSCRIPTION_PRICES_PER_MONTH.standard[1], promo: firstMonthPromoRub("standard") },
    premium: { full: SUBSCRIPTION_PRICES_PER_MONTH.premium[1], promo: firstMonthPromoRub("premium") },
  };
}
