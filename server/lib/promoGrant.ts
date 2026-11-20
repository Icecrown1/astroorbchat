/**
 * Акция «попробуй платное»: всем по N звёзд + пробный доступ ко всем функциям на D дней.
 *
 * - Акция = запись в payment_event_log (provider 'promo', event_id = id акции, payload {amount, days, startedAt, endsAt}).
 *   Одновременно активна одна акция; повторный запуск той же — невозможен (UNIQUE).
 * - Старт: одним UPDATE начисляет всем, у кого этой акции ещё не было, и рассылает пуш.
 * - Пока акция идёт, новые пользователи получают то же самое при первом открытии приложения (maybeGrantPromo из /api/user/me).
 * - Звёзды идут в referral_orbs: этот баланс тратится наравне с подписочным и не обнуляется ежемесячным пополнением.
 * - Пробный доступ — users.trial_access_until: getFeatureTier считает таких пользователей Premium для функций.
 * - Через сутки после начисления фоновый тик просит отзыв (runFeedbackAskTick).
 */
import { pool } from '../db';

const PROVIDER = 'promo';

export interface PromoCampaign {
  id: string;
  amount: number;
  days: number;
  startedAt: string;
  endsAt: string;
}

let cache: { at: number; value: PromoCampaign | null } | null = null;

export async function getActivePromo(force = false): Promise<PromoCampaign | null> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.value;
  const { rows } = await pool.query(
    `select event_id, payload from payment_event_log
      where provider = $1 and (payload->>'endsAt')::timestamptz > now()
      order by created_at desc limit 1`,
    [PROVIDER],
  );
  const value = rows[0] ? ({ id: rows[0].event_id, ...rows[0].payload } as PromoCampaign) : null;
  cache = { at: Date.now(), value };
  return value;
}

export async function listPromos(): Promise<Array<PromoCampaign & { granted: number; feedbackAsked: number }>> {
  const { rows } = await pool.query(
    `select l.event_id as id, l.payload,
            (select count(*)::int from users u where u.promo_campaign = l.event_id) as granted,
            (select count(*)::int from users u where u.promo_campaign = l.event_id and u.feedback_asked_at is not null) as "feedbackAsked"
       from payment_event_log l where l.provider = $1 order by l.created_at desc limit 10`,
    [PROVIDER],
  );
  return rows.map((r: any) => ({ id: r.id, ...r.payload, granted: r.granted, feedbackAsked: r.feedbackAsked }));
}

// Колонки — timestamp без зоны, приложение пишет в них UTC: считаем «сейчас» явно в UTC,
// чтобы не зависеть от часового пояса сессии базы
const NOW_UTC = `(now() at time zone 'utc')`;

const GRANT_SQL = `
  update users set
    referral_orbs = referral_orbs + $2,
    trial_access_until = greatest(coalesce(trial_access_until, ${NOW_UTC}), ${NOW_UTC} + make_interval(days => $3)),
    promo_campaign = $1,
    promo_granted_at = ${NOW_UTC},
    feedback_asked_at = null
  where promo_campaign is distinct from $1`;

function endDateRu(iso: string): string {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const msk = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return `${msk.getUTCDate()} ${months[msk.getUTCMonth()]}`;
}

/** Запуск акции: начисление всем + пуш (пуш уходит в фоне, ответ админке — сразу) */
export async function startPromo(storage: any, opts: { amount?: number; days?: number; push?: boolean } = {}) {
  const amount = Math.min(500, Math.max(1, Math.round(Number(opts.amount) || 50)));
  const days = Math.min(30, Math.max(1, Math.round(Number(opts.days) || 7)));

  const active = await getActivePromo(true);
  if (active) return { ok: false as const, error: 'already_active', campaign: active };

  const now = new Date();
  const id = `promo_${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  const campaign: PromoCampaign = {
    id,
    amount,
    days,
    startedAt: now.toISOString(),
    endsAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
  };
  await pool.query(
    `insert into payment_event_log (provider, event_id, event_type, payload) values ($1, $2, 'start', $3)`,
    [PROVIDER, id, JSON.stringify({ amount, days, startedAt: campaign.startedAt, endsAt: campaign.endsAt })],
  );
  cache = { at: Date.now(), value: campaign };

  const r = await pool.query(GRANT_SQL, [id, amount, days]);
  const granted = r.rowCount ?? 0;
  console.log(`[PROMO] ${id}: +${amount} stars, trial ${days}d → ${granted} users`);

  if (opts.push !== false) {
    void pushPromoGranted(storage, campaign).catch((e) => console.error('[PROMO] push failed:', e));
  }
  return { ok: true as const, campaign, granted };
}

/** Новый пользователь во время акции — начислить при первом открытии (атомарно, один раз) */
export async function maybeGrantPromo(userId: string): Promise<boolean> {
  try {
    const promo = await getActivePromo();
    if (!promo) return false;
    const r = await pool.query(`${GRANT_SQL} and id = $4`, [promo.id, promo.amount, promo.days, userId]);
    if (r.rowCount) console.log(`[PROMO] ${promo.id}: granted on open to ${userId}`);
    return !!r.rowCount;
  } catch (e) {
    console.error('[PROMO] lazy grant failed (non-blocking):', e);
    return false;
  }
}

async function pushPromoGranted(storage: any, c: PromoCampaign) {
  const { sendPush, isRealTgId, getBotDeepLink } = await import('./reengagement');
  const link = await getBotDeepLink('gift');
  const text =
    `🎁 Мы начислили вам ${c.amount} звёзд!\n\n` +
    'Попробуйте то, что раньше было только в подписке: совместимость с партнёром, гороскоп на месяц и соляр — звёзд хватит на всё три.\n\n' +
    `Пробный доступ ко всем функциям открыт до ${endDateRu(c.endsAt)}.`;
  const { rows } = await pool.query(
    `select id, tg_id from users where promo_campaign = $1 and push_enabled = true`,
    [c.id],
  );
  let sent = 0, blocked = 0;
  for (const u of rows) {
    if (!isRealTgId(u.tg_id)) continue;
    const res = await sendPush(String(u.tg_id), text, '✨ Потратить звёзды', link);
    if (res === 'ok') sent++;
    if (res === 'blocked') { blocked++; await storage.updateUser(u.id, { pushEnabled: false }); }
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(`[PROMO] ${c.id}: push sent=${sent} blocked=${blocked}`);
}

/** Через сутки после начисления — пуш с просьбой об отзыве (один раз на акцию) */
export async function runFeedbackAskTick(storage: any): Promise<void> {
  try {
    const { rows } = await pool.query(
      `update users set feedback_asked_at = ${NOW_UTC}
        where id in (
          select id from users
           where promo_granted_at is not null
             and promo_granted_at <= ${NOW_UTC} - interval '24 hours'
             and promo_granted_at > ${NOW_UTC} - interval '7 days'
             and feedback_asked_at is null
             and push_enabled = true
           limit 200)
        returning id, tg_id`,
    );
    if (!rows.length) return;
    const { sendPush, isRealTgId, getBotDeepLink } = await import('./reengagement');
    const link = await getBotDeepLink('feedback');
    const text =
      'Как вам AstroOrbi? 💬\n\n' +
      'Вы попробовали платные функции — расскажите честно, что понравилось, а чего не хватило. ' +
      'Это 30 секунд, можно анонимно. Каждый отзыв мы читаем сами и по ним решаем, что делать дальше.';
    let sent = 0;
    for (const u of rows) {
      if (!isRealTgId(u.tg_id)) continue;
      const res = await sendPush(String(u.tg_id), text, '💬 Оставить отзыв', link);
      if (res === 'ok') sent++;
      if (res === 'blocked') await storage.updateUser(u.id, { pushEnabled: false });
      await new Promise((r) => setTimeout(r, 60));
    }
    console.log(`[PROMO] feedback ask: ${rows.length} marked, ${sent} sent`);
  } catch (e) {
    console.error('[PROMO] feedback tick error:', e);
  }
}
