import { calendarNumber } from './campCards';

const representatives = new Map<number, [number, number]>();
for (let month = 1; month <= 12; month++) {
  for (let day = 1; day <= 31; day++) {
    const card = calendarNumber(`2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    if (card && !representatives.has(card)) representatives.set(card, [month, day]);
  }
}

// The public calculator accepts two month/day pairs. Only representative dates
// for the cards leave the device, never a person's birth date, year or account.
export function indexSource(first: number, second: number) {
  const a = representatives.get(first), b = representatives.get(second);
  if (!a || !b) throw new Error('unsupported_card');
  const url = new URL('https://tragos.ru/lovecards');
  url.search = new URLSearchParams({ day1: String(a[1]), month1: String(a[0]), day2: String(b[1]), month2: String(b[0]) }).toString();
  return url.href;
}

export function readIndices(html: string) {
  const scores = Array.from(html.matchAll(/Индекс\s+(привлекательности|напряж[её]нности|совместимости)\s*\*?\s*=\s*([−-]?\d+)\s*<\/b>/gi));
  if (scores.length !== 6 || !scores.every(([_, label, number], i) =>
    label.toLowerCase().replace('ё', 'е') === ['привлекательности', 'напряженности', 'совместимости'][i % 3] && Math.abs(Number(number.replace('−','-'))) <= 10)) throw new Error('score_unavailable');
  const linksFor = (start: number, end: number) => Array.from(html.slice(start, end).matchAll(
    /<b>Карта (Луны|Меркурия|Венеры|Марса|Юпитера|Сатурна|Урана|Нептуна|Плутона) в Основном (духовном|жизненном) Наборе( вашего партн[её]ра)?[.]?<\/b>/gi
  ), match => ({ planet:match[1], spiritual:match[2].toLowerCase()==='духовном', inPartner:Boolean(match[3]) }));
  const firstHeading = html.search(/Как вы относитесь к партн[её]ру/i);
  const frame = (i: number) => ({
    links: linksFor(i ? scores[2].index! : Math.max(0,firstHeading), scores[i].index!),
    attraction: Number(scores[i][2].replace('−','-')), tension: Number(scores[i+1][2].replace('−','-')), compatibility: Number(scores[i+2][2].replace('−','-')),
  });
  return [frame(0), frame(3)];
}
