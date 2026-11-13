/**
 * Конкурс среди пригласивших друзей (см. shared/referralContest.ts).
 *
 * - участники считаются запросом по users.referred_by_id (приглашённый прошёл регистрацию: birth_place задан);
 * - анонс и итоги — пуши через бота (ре-энгейджмент), повторный анонс защищён журналом;
 * - розыгрыш строго один раз: запись `<id>:draw` в payment_event_log (UNIQUE provider+event_id);
 * - приз — Premium на prizeDays через общую активацию (source 'admin', без реферального бонуса рефереру победителя);
 * - фоновый тик сам проводит розыгрыш после endsAt; админ может провести раньше (force).
 */
import { randomInt } from 'crypto';
import { pool } from '../db';
import { REFERRAL_CONTEST, contestEndLabel, type ReferralContestStatus } from '@shared/referralContest';

const PROVIDER = 'contest';
const drawKey = () => `${REFERRAL_CONTEST.id}:draw`;
const announceKey = () => `${REFERRAL_CONTEST.id}:announce`;

export interface ContestParticipant {
  id: string;
  name: string;
  username: string | null;
  tgId: string;
  invited: number;
}

export interface ContestDrawResult {
  winnerId: string;
  winnerName: string;
  participants: number;
  drawnAt: string;
  forced?: boolean;
}

/** «Анна Смирнова» → «Анна С.» — публично показываем только так */
export function publicName(name: string | null | undefined): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Участник';
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}

export async function listParticipants(): Promise<ContestParticipant[]> {
  const { rows } = await pool.query(
    `select r.id, r.name, r.username, r.tg_id as "tgId", count(*)::int as invited
       from users u
       join users r on r.id = u.referred_by_id
      where u.birth_place is not null and r.is_admin = false
      group by r.id, r.name, r.username, r.tg_id
      order by invited desc, r.name`,
  );
  return rows as ContestParticipant[];
}

async function countInvited(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `select count(*)::int as n from users where referred_by_id = $1 and birth_place is not null`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

async function countParticipants(): Promise<number> {
  const { rows } = await pool.query(
    `select count(distinct u.referred_by_id)::int as n
       from users u join users r on r.id = u.referred_by_id
      where u.birth_place is not null and r.is_admin = false`,
  );
  return rows[0]?.n ?? 0;
}

export async function getDrawResult(): Promise<ContestDrawResult | null> {
  const { rows } = await pool.query(
    `select payload from payment_event_log where provider = $1 and event_id = $2 limit 1`,
    [PROVIDER, drawKey()],
  );
  return (rows[0]?.payload as ContestDrawResult) ?? null;
}

export async function isAnnounced(): Promise<boolean> {
  const { rows } = await pool.query(
    `select 1 from payment_event_log where provider = $1 and event_id = $2 limit 1`,
    [PROVIDER, announceKey()],
  );
  return rows.length > 0;
}

export async function getContestStatus(userId: string, isAdmin = false): Promise<ReferralContestStatus> {
  const [invited, participants, draw] = await Promise.all([countInvited(userId), countParticipants(), getDrawResult()]);
  const ended = Date.now() >= new Date(REFERRAL_CONTEST.endsAt).getTime();
  return {
    id: REFERRAL_CONTEST.id,
    endsAt: REFERRAL_CONTEST.endsAt,
    prizeDays: REFERRAL_CONTEST.prizeDays,
    active: !draw && !ended,
    drawn: !!draw,
    invited,
    participating: invited > 0 && !isAdmin,
    participants,
    winnerName: draw?.winnerName ?? null,
    isWinner: !!draw && draw.winnerId === userId,
  };
}

/** Записать событие один раз. false — такая запись уже есть. */
async function logOnce(eventId: string, eventType: string, payload: unknown): Promise<boolean> {
  try {
    await pool.query(
      `insert into payment_event_log (provider, event_id, event_type, payload) values ($1, $2, $3, $4)`,
      [PROVIDER, eventId, eventType, JSON.stringify(payload)],
    );
    return true;
  } catch (e: any) {
    if (e?.code === '23505') return false; // unique_violation
    throw e;
  }
}

/** Анонс всем пользователям (кроме отключивших уведомления). Повторно — только с force. */
export async function announceContest(storage: any, force = false) {
  const first = await logOnce(announceKey(), 'announce', { at: new Date().toISOString() });
  if (!first && !force) return { alreadySent: true, sent: 0, blocked: 0, skipped: 0 };

  const { sendPush, isRealTgId, getBotDeepLink } = await import('./reengagement');
  const link = await getBotDeepLink('contest');
  const end = contestEndLabel(REFERRAL_CONTEST.endsAt, 'ru');
  const text =
    '🎁 Разыгрываем месяц Premium!\n\n' +
    'Пригласите в AstroOrbi хотя бы одного друга по своей реферальной ссылке — и вы участвуете. ' +
    'Уже приглашали? Вы в игре автоматически.\n\n' +
    `Итоги — ${end}. Победителя выберем случайно и сразу включим Premium на ${REFERRAL_CONTEST.prizeDays} дней.`;

  const users = await storage.getAllUsers();
  let sent = 0, blocked = 0, skipped = 0;
  for (const u of users) {
    if (!isRealTgId(u.tgId) || u.pushEnabled === false) { skipped++; continue; }
    const r = await sendPush(String(u.tgId), text, '🎁 Участвовать', link);
    if (r === 'blocked') { blocked++; await storage.updateUser(u.id, { pushEnabled: false }); }
    else if (r === 'ok') sent++;
    await new Promise((res) => setTimeout(res, 60)); // ~16 msg/s — в лимитах Telegram
  }
  console.log(`[CONTEST] announce: sent=${sent} blocked=${blocked} skipped=${skipped}`);
  return { alreadySent: false, sent, blocked, skipped };
}

/** Розыгрыш: один раз. До даты окончания — только с force (кнопка админа). */
export async function drawWinner(storage: any, force = false): Promise<
  { ok: true; result: ContestDrawResult; already: boolean } | { ok: false; error: 'not_finished' | 'no_participants' }
> {
  const existing = await getDrawResult();
  if (existing) return { ok: true, result: existing, already: true };

  const ended = Date.now() >= new Date(REFERRAL_CONTEST.endsAt).getTime();
  if (!ended && !force) return { ok: false, error: 'not_finished' };

  const participants = await listParticipants();
  if (!participants.length) return { ok: false, error: 'no_participants' };

  const winner = participants[randomInt(participants.length)];
  const result: ContestDrawResult = {
    winnerId: winner.id,
    winnerName: publicName(winner.name),
    participants: participants.length,
    drawnAt: new Date().toISOString(),
    ...(force && !ended ? { forced: true } : {}),
  };
  // Запись — до выдачи приза: параллельный розыгрыш (тик + кнопка) не выдаст второй приз
  if (!(await logOnce(drawKey(), 'draw', result))) {
    return { ok: true, result: (await getDrawResult())!, already: true };
  }

  const { activateSubscriptionForUser } = await import('./paymentActivation');
  await activateSubscriptionForUser(storage, {
    userId: winner.id,
    tier: 'premium',
    periodDays: REFERRAL_CONTEST.prizeDays,
    source: 'admin',
    meta: { extend: true, skipReferralBonus: true },
  });
  console.log(`[CONTEST] winner ${winner.id} (${result.winnerName}) of ${participants.length}${result.forced ? ' — forced' : ''}`);

  // Пуши: победителю и остальным участникам. Ошибки рассылки не отменяют приз.
  try {
    const { sendPush, isRealTgId, getBotDeepLink } = await import('./reengagement');
    const link = await getBotDeepLink('contest');
    if (isRealTgId(winner.tgId)) {
      await sendPush(
        String(winner.tgId),
        `🎉 Поздравляем! Вы выиграли месяц Premium в розыгрыше AstroOrbi.\n\nPremium уже включён на ${REFERRAL_CONTEST.prizeDays} дней — открыты все функции, включая Соляр. Спасибо, что делитесь AstroOrbi с друзьями!`,
        '✨ Открыть AstroOrbi',
        link,
      );
    }
    for (const p of participants) {
      if (p.id === winner.id || !isRealTgId(p.tgId)) continue;
      await sendPush(
        String(p.tgId),
        `🎁 Розыгрыш месяца Premium завершён!\n\nПобедитель — ${result.winnerName}. Спасибо, что участвовали!\n\nПриглашения по-прежнему приносят бонусы: когда друг оформляет подписку, вы получаете звёзды или дни подписки.`,
        '👥 Пригласить друзей',
        link,
      );
      await new Promise((res) => setTimeout(res, 60));
    }
  } catch (e) {
    console.error('[CONTEST] result pushes failed (prize already granted):', e);
  }

  return { ok: true, result, already: false };
}

/** Фоновый тик: после даты окончания проводит розыгрыш сам */
export async function runContestTick(storage: any): Promise<void> {
  try {
    if (Date.now() < new Date(REFERRAL_CONTEST.endsAt).getTime()) return;
    if (await getDrawResult()) return;
    const r = await drawWinner(storage);
    if (!r.ok) console.warn(`[CONTEST] auto draw skipped: ${r.error}`);
  } catch (e) {
    console.error('[CONTEST] tick error:', e);
  }
}
