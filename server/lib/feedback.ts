/**
 * Отзывы из приложения → в Telegram-чат через нашего бота.
 * Куда: FEEDBACK_CHAT_ID → SUPPORT_CHAT_ID → лично админам (users.is_admin) — отзыв не теряется,
 * даже если чат ещё не настроен. Узнать id чата: добавить бота в группу — он сам пришлёт инструкцию,
 * или написать в группе /chatid.
 * Анонимный отзыв: без имени, ника и Telegram ID — только оценка, текст и тариф.
 */
import { pool } from '../db';

const recent = new Map<string, number[]>(); // userId → времена отправки (антиспам: 5 в сутки)

export function feedbackRateLimited(userId: string): boolean {
  const day = Date.now() - 86_400_000;
  const list = (recent.get(userId) || []).filter((t) => t > day);
  recent.set(userId, list);
  return list.length >= 5;
}

async function tgSend(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!r.ok) console.error('[FEEDBACK] Telegram error:', r.status, await r.text());
    return r.ok;
  } catch (e: any) {
    console.error('[FEEDBACK] send failed:', e?.message);
    return false;
  }
}

export async function deliverFeedback(params: {
  user: any;
  tier: string;
  trial: boolean;
  rating: number | null;
  text: string;
  anonymous: boolean;
  source: string;
}): Promise<boolean> {
  const { user, tier, trial, rating, text, anonymous, source } = params;
  const stars = rating ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)` : 'без оценки';
  const tierLabel = `${tier === 'premium' ? 'Premium' : tier === 'standard' ? 'Standard' : 'Free'}${trial ? ' + пробный доступ' : ''}`;
  const who = anonymous
    ? '🕶 Анонимно'
    : `👤 ${user.name || 'без имени'}${user.username ? ` (@${user.username})` : ''} · tg ${user.tgId}`;
  const msg = [
    `💬 Отзыв · ${stars}`,
    '',
    text || '(без текста)',
    '',
    `${who} · тариф: ${tierLabel}${source ? ` · откуда: ${source}` : ''}`,
  ].join('\n');

  const chat = process.env.FEEDBACK_CHAT_ID || process.env.SUPPORT_CHAT_ID;
  if (chat && (await tgSend(chat, msg))) {
    recent.get(user.id)?.push(Date.now()) ?? recent.set(user.id, [Date.now()]);
    return true;
  }
  // Чат не настроен или недоступен — лично админам
  const { rows } = await pool.query(`select tg_id from users where is_admin = true`);
  let ok = false;
  for (const a of rows) {
    if (/^\d+$/.test(String(a.tg_id))) ok = (await tgSend(a.tg_id, `${msg}\n\n(чат для отзывов не настроен — пришло лично вам)`)) || ok;
  }
  if (ok) recent.get(user.id)?.push(Date.now()) ?? recent.set(user.id, [Date.now()]);
  if (!ok) console.warn('[FEEDBACK] not delivered anywhere:\n' + msg);
  return ok;
}

/** Ответ бота на /chatid и на добавление в группу — чтобы Алекс узнала id чата для FEEDBACK_CHAT_ID */
export async function replyChatId(chat: { id: number; title?: string; type?: string }, addedToGroup = false): Promise<void> {
  const text = addedToGroup
    ? `Привет! ID этого чата: ${chat.id}\n\nЧтобы сюда приходили отзывы из приложения, добавьте в Secrets приложения переменную FEEDBACK_CHAT_ID = ${chat.id} и перезапустите сервер (Stop → Run, затем Republish).`
    : `ID этого чата: ${chat.id}`;
  await tgSend(chat.id, text);
}
