/**
 * Знаки планет по одной дате рождения (без времени и места) — для раскладов админа «для другого человека».
 *
 * Время неизвестно, поэтому знак считается на начало и конец суток по Москве (UTC+3):
 * совпали — знак точный; разошлись — планета в этот день сменила знак («на стыке Рака и Льва»).
 * Чаще всего это касается Луны (знак меняется каждые ~2,5 дня). Асцендент и дома без времени не считаются.
 *
 * Долготы геоцентрические: Солнце — SunPosition, Луна — EclipticGeoMoon, планеты — Ecliptic(GeoVector).
 */
import * as AstronomyNs from 'astronomy-engine';

// astronomy-engine — CommonJS: в ESM-сборке сервера именованные импорты из него не линкуются,
// поэтому берём объект модуля (default в ESM, сам namespace в CJS/tsx)
const A: typeof AstronomyNs = ((AstronomyNs as any).default ?? AstronomyNs) as typeof AstronomyNs;
const { Body, Ecliptic, EclipticGeoMoon, GeoVector, MakeTime, SunPosition } = A;

const SIGNS_RU = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
const SIGNS_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

export type QuickBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

const BODIES: { key: QuickBody; ru: string; en: string; glyph: string }[] = [
  { key: 'sun', ru: 'Солнце', en: 'Sun', glyph: '☉' },
  { key: 'moon', ru: 'Луна', en: 'Moon', glyph: '☽' },
  { key: 'mercury', ru: 'Меркурий', en: 'Mercury', glyph: '☿' },
  { key: 'venus', ru: 'Венера', en: 'Venus', glyph: '♀' },
  { key: 'mars', ru: 'Марс', en: 'Mars', glyph: '♂' },
  { key: 'jupiter', ru: 'Юпитер', en: 'Jupiter', glyph: '♃' },
  { key: 'saturn', ru: 'Сатурн', en: 'Saturn', glyph: '♄' },
];

function lonOf(key: QuickBody, utc: Date): number {
  const t = MakeTime(utc);
  let lon: number;
  if (key === 'sun') lon = SunPosition(t).elon;
  else if (key === 'moon') lon = EclipticGeoMoon(t).lon;
  else {
    const body = { mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn }[key];
    lon = Ecliptic(GeoVector(body, t, true)).elon;
  }
  return ((lon % 360) + 360) % 360;
}

const signIdx = (lon: number) => Math.floor(lon / 30) % 12;

export interface QuickPlacement {
  key: QuickBody;
  /** Индекс знака в начале суток и в конце (совпадают, если смены не было) */
  from: number;
  to: number;
}

/** 'YYYY-MM-DD' → знаки 7 планет (null, если дата некорректна или вне 1900–сегодня) */
export function quickChart(dateISO: string): QuickPlacement[] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const day = new Date(Date.UTC(y, mo - 1, d));
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null; // 30 февраля и т.п.
  const start = new Date(day.getTime() - 3 * 3600_000); // 00:00 МСК
  if (y < 1900 || start.getTime() > Date.now()) return null;
  const end = new Date(start.getTime() + 24 * 3600_000 - 60_000); // 23:59 МСК
  return BODIES.map(({ key }) => ({ key, from: signIdx(lonOf(key, start)), to: signIdx(lonOf(key, end)) }));
}

/** «Солнце — Рыбы, Луна — на стыке Скорпиона и Стрельца, …» */
export function describeQuickChart(chart: QuickPlacement[], locale: 'ru' | 'en'): string {
  const ru = locale === 'ru';
  const names = ru ? SIGNS_RU : SIGNS_EN;
  return chart
    .map((p) => {
      const b = BODIES.find((x) => x.key === p.key)!;
      const sign = p.from === p.to
        ? names[p.from]
        : (ru ? `${names[p.from]} или ${names[p.to]} (в этот день знак сменился, время рождения неизвестно)` : `${names[p.from]} or ${names[p.to]} (changed sign that day; birth time unknown)`);
      return `${ru ? b.ru : b.en} — ${sign}`;
    })
    .join(', ');
}

/** Компактно для интерфейса: { sun: 'Рыбы', moon: 'Скорпион/Стрелец', … } */
export function compactQuickChart(chart: QuickPlacement[], locale: 'ru' | 'en'): Record<QuickBody, string> {
  const names = locale === 'ru' ? SIGNS_RU : SIGNS_EN;
  const out = {} as Record<QuickBody, string>;
  for (const p of chart) out[p.key] = p.from === p.to ? names[p.from] : `${names[p.from]}/${names[p.to]}`;
  return out;
}
