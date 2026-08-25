/**
 * Telegram Stars (XTR): инвойсы и рефанды через Bot API.
 * Правило Telegram: цифровые товары в мини-аппе — только Stars.
 */
const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function createStarsInvoiceLink(params: {
  title: string;
  description: string;
  payload: string; // до 128 байт, вернётся в successful_payment
  stars: number;
}): Promise<string> {
  const res = await fetch(`${API()}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title.slice(0, 32),
      description: params.description.slice(0, 255),
      payload: params.payload,
      currency: 'XTR',
      prices: [{ label: params.title.slice(0, 32), amount: Math.round(params.stars) }],
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`createInvoiceLink failed: ${JSON.stringify(data)}`);
  return data.result as string;
}

export async function answerPreCheckout(preCheckoutQueryId: string, ok = true, error?: string) {
  await fetch(`${API()}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pre_checkout_query_id: preCheckoutQueryId, ok, ...(error ? { error_message: error } : {}) }),
  });
}

export async function refundStarPayment(userId: number, telegramPaymentChargeId: string): Promise<boolean> {
  const res = await fetch(`${API()}/refundStarPayment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, telegram_payment_charge_id: telegramPaymentChargeId }),
  });
  const data = await res.json();
  return !!data.ok;
}

/** Паки орбов за Telegram Stars: серверный прайс (1⭐TG ≈ 1.3 орба, бонус за объём). */
export const STARS_ORB_PACKS: Record<string, { tgStars: number; orbs: number }> = {
  s50: { tgStars: 50, orbs: 65 },
  s100: { tgStars: 100, orbs: 140 },
  s250: { tgStars: 250, orbs: 375 },
};
