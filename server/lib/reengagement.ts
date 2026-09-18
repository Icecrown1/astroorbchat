// Ре-энгейджмент: периодический пуш (раз в 3–5 дней, ротация тем) + разовая win-back-рассылка.
// Тик вызывается интервалом из index.ts; идемпотентность — по last_push_at
// в местном дне пользователя (окно отправки 10:00–11:59 его таймзоны).
// Интервал 3/4/5 дней выбирается детерминированно из (userId, lastPushAt) —
// стабилен между тиками, «перекатывается» после каждой отправки.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import tzPlugin from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(tzPlugin);

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Ротация тем пуша: у каждой — свой текст, кнопка и дип-линк (startapp)
const PUSH_CAMPAIGNS: { text: string; button: string; startapp: string }[] = [
  {
    text: '🃏 Ваша карта дня уже ждёт.\nОдна карта — тон дня и маленький совет. Бесплатно, как всегда.',
    button: '🃏 Вытянуть карту',
    startapp: 'daily',
  },
  {
    text: '🌌 Что звёзды приготовили вам сегодня?\nПерсональный гороскоп по вашей натальной карте уже готов.',
    button: '🌌 Читать гороскоп',
    startapp: 'horoscope',
  },
  {
    text: '🔯 22 аркана вашей Матрицы судьбы.\nЗагляните — какая энергия ведёт вас в этот период?',
    button: '🔯 Открыть матрицу',
    startapp: 'matrix',
  },
  {
    text: '💞 Давно не проверяли совместимость?\nСравните карты с близким человеком — где притяжение, а где урок.',
    button: '💞 Проверить пару',
    startapp: 'compat',
  },
  {
    text: '🔮 Один вопрос — один честный ответ Оракула.\nСпросите о том, что сейчас важнее всего.',
    button: '🔮 Спросить Оракула',
    startapp: 'ask',
  },
];

// Простой стабильный хэш для детерминированного «рандома» на пользователя
function seedHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

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

/** Периодический тик: раз в 3–5 дней, окно 10:00–11:59 местного времени, тема — ротацией */
export async function runDailyPushTick(storage: any): Promise<void> {
  try {
    const users = await storage.getAllUsers();
    // дип-линки для всех кампаний — один запрос username бота
    const links = new Map<string, string | null>();
    for (const c of PUSH_CAMPAIGNS) links.set(c.startapp, await getBotDeepLink(c.startapp));
    let sent = 0;
    for (const u of users) {
      if (!u.pushEnabled || !isRealTgId(u.tgId)) continue;
      const tz = u.timezone || 'Europe/Moscow';
      let local;
      try { local = dayjs().tz(tz); } catch { local = dayjs().tz('Europe/Moscow'); }
      if (local.hour() < 10 || local.hour() >= 12) continue;
      const localToday = local.format('YYYY-MM-DD');

      if (u.lastPushAt) {
        const lastLocal = dayjs(u.lastPushAt).tz(tz).format('YYYY-MM-DD');
        const daysSince = dayjs(localToday).diff(dayjs(lastLocal), 'day');
        // интервал 3–5 дней, стабильный между тиками до следующей отправки
        const interval = 3 + (seedHash(`${u.id}:${new Date(u.lastPushAt).toISOString()}`) % 3);
        if (daysSince < interval) continue;
      }
      // lastPushAt == null → новый пользователь, шлём в первое же окно

      // резервируем ДО отправки — двойной тик не продублирует сообщение
      await storage.updateUser(u.id, { lastPushAt: new Date() });
      // тема — детерминированная ротация по пользователю и дню
      const c = PUSH_CAMPAIGNS[seedHash(`${u.id}:${localToday}`) % PUSH_CAMPAIGNS.length];
      const result = await sendPush(String(u.tgId), c.text, c.button, links.get(c.startapp) ?? null);
      if (result === 'blocked') {
        await storage.updateUser(u.id, { pushEnabled: false });
      } else if (result === 'ok') {
        sent++;
      }
      await new Promise((r) => setTimeout(r, 60)); // ~16 msg/s — в лимитах Telegram
    }
    if (sent) console.log(`[PUSH] periodic push sent: ${sent}`);
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
