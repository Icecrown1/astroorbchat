// Ре-энгейджмент: ежедневный пуш «карта дня» + разовая win-back-рассылка.
// Тик вызывается интервалом из index.ts; идемпотентность — по last_push_at
// в местном дне пользователя (окно отправки 10:00–11:59 его таймзоны).
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import tzPlugin from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(tzPlugin);

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const DAILY_TEXTS = [
  '🃏 Ваша карта дня уже ждёт.\nОдна карта — тон дня и маленький совет. Бесплатно, как всегда.',
  '🌙 Какая карта выпадет вам сегодня?\nМинута — и у вас подсказка на день.',
  '✨ Утренний ритуал: вытянуть карту дня.\nБесплатно, одно касание.',
];

function isRealTgId(tgId: unknown): boolean {
  return typeof tgId === 'string' && /^\d+$/.test(tgId);
}

async function getBotDeepLink(startapp: string): Promise<string | null> {
  try {
    const { getBotUsername } = await import('./telegramStars');
    const bot = await getBotUsername();
    return bot ? `https://t.me/${bot}?startapp=${startapp}` : null;
  } catch { return null; }
}

async function sendPush(tgId: string, text: string, buttonText: string, link: string | null): Promise<'ok' | 'blocked' | 'error'> {
  try {
    const res = await fetch(`${TG()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(tgId),
        text,
        ...(link ? { reply_markup: { inline_keyboard: [[{ text: buttonText, url: link }]] } } : {}),
      }),
    });
    const data: any = await res.json();
    if (data.ok) return 'ok';
    // 403 = заблокировал бота — выключаем пуши, чтобы не долбиться
    if (data.error_code === 403) return 'blocked';
    console.error('[PUSH] sendMessage failed:', data);
    return 'error';
  } catch (e) {
    console.error('[PUSH] sendMessage error:', e);
    return 'error';
  }
}

/** Ежедневный тик: рассылает карту дня тем, у кого местное время 10:00–11:59 и сегодня ещё не слали */
export async function runDailyPushTick(storage: any): Promise<void> {
  try {
    const users = await storage.getAllUsers();
    const link = await getBotDeepLink('daily');
    let sent = 0;
    for (const u of users) {
      if (!u.pushEnabled || !isRealTgId(u.tgId)) continue;
      const tz = u.timezone || 'Europe/Moscow';
      let local;
      try { local = dayjs().tz(tz); } catch { local = dayjs().tz('Europe/Moscow'); }
      if (local.hour() < 10 || local.hour() >= 12) continue;
      const localToday = local.format('YYYY-MM-DD');
      const lastLocal = u.lastPushAt ? dayjs(u.lastPushAt).tz(tz).format('YYYY-MM-DD') : null;
      if (lastLocal === localToday) continue;

      // резервируем ДО отправки — двойной тик не продублирует сообщение
      await storage.updateUser(u.id, { lastPushAt: new Date() });
      const text = DAILY_TEXTS[dayjs().date() % DAILY_TEXTS.length];
      const result = await sendPush(String(u.tgId), text, '🃏 Вытянуть карту', link);
      if (result === 'blocked') {
        await storage.updateUser(u.id, { pushEnabled: false });
      } else if (result === 'ok') {
        sent++;
      }
      await new Promise((r) => setTimeout(r, 60)); // ~16 msg/s — в лимитах Telegram
    }
    if (sent) console.log(`[PUSH] daily card sent: ${sent}`);
  } catch (e) {
    console.error('[PUSH] tick error:', e);
  }
}

/** Разовая win-back-рассылка по всем живым пользователям (кроме отключивших пуши) */
export async function runWinbackBroadcast(storage: any): Promise<{ sent: number; blocked: number; skipped: number }> {
  const users = await storage.getAllUsers();
  const link = await getBotDeepLink('trial');
  const text =
    '✨ AstroOrbi сильно обновился!\n\n' +
    '🃏 Таро: собственная колода, карта дня бесплатно каждый день\n' +
    '🔯 Матрица судьбы — 22 аркана, теперь и для близких\n' +
    '💞 Совместимость, гороскопы и Оракул\n\n' +
    'Загляните — первая карта уже ждёт.';
  let sent = 0, blocked = 0, skipped = 0;
  for (const u of users) {
    if (!isRealTgId(u.tgId)) { skipped++; continue; }
    if (u.pushEnabled === false) { skipped++; continue; }
    const result = await sendPush(String(u.tgId), text, '✨ Открыть AstroOrbi', link);
    if (result === 'blocked') { blocked++; await storage.updateUser(u.id, { pushEnabled: false }); }
    else if (result === 'ok') sent++;
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(`[PUSH] winback: sent=${sent} blocked=${blocked} skipped=${skipped}`);
  return { sent, blocked, skipped };
}
