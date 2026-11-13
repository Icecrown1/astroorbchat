/**
 * Конкурс среди пригласивших: месяц Premium одному случайному участнику.
 * Участник — любой, кто пригласил по своей реферальной ссылке хотя бы одного человека,
 * прошедшего регистрацию (указал место рождения). Админы не участвуют.
 * Новый конкурс = новый id и дата (результат хранится по id в payment_event_log).
 */
export const REFERRAL_CONTEST = {
  id: 'ref_premium_2026_11',
  /** Итоги: 30 ноября 2026, 21:00 МСК */
  endsAt: '2026-11-30T18:00:00.000Z',
  prizeDays: 30,
} as const;

export interface ReferralContestStatus {
  id: string;
  endsAt: string;
  prizeDays: number;
  /** Конкурс идёт: дата не наступила и победитель не выбран */
  active: boolean;
  drawn: boolean;
  /** Сколько приглашённых засчитано пользователю */
  invited: number;
  participating: boolean;
  participants: number;
  winnerName: string | null;
  isWinner: boolean;
}

const RU_MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** «30 ноября в 21:00 МСК» / «November 30 at 21:00 Moscow time» */
export function contestEndLabel(endsAtIso: string, locale: 'ru' | 'en' | string = 'ru'): string {
  const msk = new Date(new Date(endsAtIso).getTime() + 3 * 3600_000); // МСК = UTC+3 без перехода на летнее время
  const d = msk.getUTCDate();
  const m = msk.getUTCMonth();
  const hh = String(msk.getUTCHours()).padStart(2, '0');
  const mm = String(msk.getUTCMinutes()).padStart(2, '0');
  return locale === 'ru' ? `${d} ${RU_MONTHS_GEN[m]} в ${hh}:${mm} МСК` : `${EN_MONTHS[m]} ${d} at ${hh}:${mm} Moscow time`;
}
