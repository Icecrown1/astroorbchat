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

/** Цены star-подписок (⭐ за 30 дней). Эквивалент 199/399 ₽ по ~1.06 ₽/⭐, округлено вверх. */
export const STARS_SUB_PRICES: Record<'standard' | 'premium', number> = { standard: 200, premium: 400 };
/** Telegram принимает только ровно 30 дней для подписок в Stars */
export const STARS_SUB_PERIOD_SECONDS = 2592000;

/**
 * Инвойс на подписку за Stars: Telegram сам списывает каждые 30 дней и шлёт successful_payment
 * с is_recurring=true, subscription_expiration_date. payload = {t:'sub', u, tier}
 */
export async function createStarsSubscriptionLink(params: {
  tier: 'standard' | 'premium';
  userId: string;
}): Promise<string> {
  const stars = STARS_SUB_PRICES[params.tier];
  const title = params.tier === 'premium' ? 'Astro Orb Premium' : 'Astro Orb Standard';
  const description = params.tier === 'premium'
    ? 'Подписка Premium на 30 дней: 550 звёзд в месяц, все функции включая Соляр. Продлевается автоматически.'
    : 'Подписка Standard на 30 дней: 250 звёзд в месяц, все функции кроме Соляра. Продлевается автоматически.';
  const payload = JSON.stringify({ t: 'sub', u: params.userId, tier: params.tier });
  const res = await fetch(`${API()}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title.slice(0, 32),
      description: description.slice(0, 255),
      payload,
      currency: 'XTR',
      prices: [{ label: title.slice(0, 32), amount: stars }],
      subscription_period: STARS_SUB_PERIOD_SECONDS,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`createInvoiceLink(subscription) failed: ${JSON.stringify(data)}`);
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

/** Паки орбов: единый прайс в shared/orbPacks.ts (Stars/карта/TON). Реэкспорт для совместимости. */
import { ORB_PACKS } from '@shared/orbPacks';
export const STARS_ORB_PACKS: Record<string, { tgStars: number; orbs: number }> = Object.fromEntries(
  ORB_PACKS.map((p) => [p.id, { tgStars: p.stars, orbs: p.orbs }])
);

let cachedBotUsername: string | null = process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_BOT_USERNAME || null;

/** Username бота (без @) — из Secrets, либо один раз через getMe. */
export async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername.replace('@', '');
  try {
    const res = await fetch(`${API()}/getMe`);
    const data = await res.json();
    if (data?.ok && data.result?.username) {
      cachedBotUsername = data.result.username;
      return cachedBotUsername;
    }
  } catch (e) {
    console.error('[TG] getMe failed:', e);
  }
  return null;
}

/**
 * Ссылка возврата после внешней оплаты (ЮKassa): открывает мини-апп ПРЯМО в Telegram
 * со стартовым параметром pay_<id> — клиент по нему уходит на экран результата платежа.
 * Фолбэк — обычный URL приложения (если бот недоступен).
 */
export async function buildMiniAppReturnUrl(baseUrl: string, paymentId: string): Promise<string> {
  const username = await getBotUsername();
  if (username) return `https://t.me/${username}?startapp=pay_${paymentId}`;
  return `${baseUrl}/payment-success?paymentId=${paymentId}`;
}
