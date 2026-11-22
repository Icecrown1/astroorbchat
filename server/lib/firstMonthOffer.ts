/**
 * Акция «первый месяц −50%» — кто имеет право.
 *
 * Право есть, если пользователь НИ РАЗУ не платил за подписку ни одним способом:
 *  - нет активной подписки сейчас (любой — включая реферальную/админскую);
 *  - subscriptions.paymentProvider не из платных (yookassa / ton / stars / dodo);
 *  - нет завершённых подписочных платежей ЮKassa (subscription / renewal / upgrade);
 *  - нет подтверждённых подписочных платежей GRAM (таблица payments);
 *  - нет оплаченных звёздами подписок (payment_event_log, provider 'stars', payload t=sub/subonce).
 * Подписка, выданная админом/dev или реферальной наградой, оплатой не считается.
 * Цены акции — в Stars: оплата внутри Telegram только звёздами.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "../db";
import { paymentEventLog, payments, subscriptions, yookassaPayments } from "@shared/schema";
import {
  FIRST_MONTH_DISCOUNT_PCT,
  STARS_SUB_PRICES,
  firstMonthPromoStars,
} from "@shared/subscriptionPrices";

const PAID_PROVIDERS = ["yookassa", "ton", "stars", "dodo"];

export async function isFirstMonthOfferEligible(userId: string, connection: Pick<typeof db, 'select'> = db): Promise<boolean> {
  const [sub] = await connection
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

  const paidCard = await connection
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

  const paidGram = await connection
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

  const paidStars = await connection
    .select({ id: paymentEventLog.id })
    .from(paymentEventLog)
    .where(sql`${paymentEventLog.provider} = 'stars'
      and ${paymentEventLog.payload}->'message'->'successful_payment'->>'invoice_payload' like ${'%"u":"' + userId + '"%'}
      and ${paymentEventLog.payload}->'message'->'successful_payment'->>'invoice_payload' like '%"t":"sub%'`)
    .limit(1);
  if (paidStars.length) return false;

  return true;
}

/** Цены акции в Stars: full — обычная месячная цена, promo — первый месяц со скидкой */
export function firstMonthOfferPrices() {
  return {
    discountPct: FIRST_MONTH_DISCOUNT_PCT,
    currency: "XTR" as const,
    standard: { full: STARS_SUB_PRICES.standard, promo: firstMonthPromoStars("standard") },
    premium: { full: STARS_SUB_PRICES.premium, promo: firstMonthPromoStars("premium") },
  };
}
