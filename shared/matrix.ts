/**
 * Матрица судьбы — детерминированное расчётное ядро.
 *
 * Канон: классическая схема Ладини/Прибыловой (см. docs в ТЗ фичи).
 * Марсельский порядок арканов: 8 = Справедливость, 11 = Сила.
 * GPT НИКОГДА не считает числа — только этот модуль.
 *
 * Валидировано юнит-тестами на трёх контрольных векторах:
 *   24.03.1981, 15.07.1990, 01.06.1926 (Монро).
 *
 * Файл в shared/ — используется и клиентом (мгновенная отрисовка
 * октаграммы), и сервером (генерация AI-разборов).
 */

/** Единственное правило свёртки всей системы: числа > 22 сводим суммой цифр. */
export function reduce22(n: number): number {
  while (n > 22) {
    n = String(n)
      .split("")
      .reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

/** Спорные между школами формулы вынесены в канон-конфиг (для страницы методологии). */
export const MATRIX_CANON = {
  school: "ladini-classic",
  moneyEntry: "reduce(E + rodBottomRight)", // точка входа в деньги
  loveEntry: "reduce(E + rodBottomLeft)", // точка входа в отношения
  karmicTail: "G=D; R=reduce(G+E); S=reduce(G+R)",
  maleLine: "reduce(rodTopLeft + rodBottomRight)",
  femaleLine: "reduce(rodTopRight + rodBottomLeft)",
} as const;

export interface MatrixCore {
  /** Личный (диагональный) квадрат-ромб */
  a: number; // день — «визитная карточка»
  b: number; // месяц — таланты
  c: number; // год — материальная карма
  d: number; // кармическое основание (низ)
  e: number; // центр — зона комфорта / ядро

  /** Родовой (прямой) квадрат */
  rodTL: number; // верх-лево
  rodTR: number; // верх-право
  rodBR: number; // низ-право
  rodBL: number; // низ-лево

  /** Линии */
  sky: number; // Небо: духовное (B+D)
  earth: number; // Земля: материальное (A+C)

  /** Предназначения */
  personalPurpose: number; // до 40 лет
  maleLine: number;
  femaleLine: number;
  socialPurpose: number; // 40–60
  spiritualPurpose: number; // 60+
  planetaryPurpose: number; // высшая миссия

  /** Каналы */
  moneyEntry: number; // точка входа в деньги
  loveEntry: number; // точка входа в отношения

  /** Кармический хвост (триплет G-R-S, при рождении «в минусе») */
  tailG: number;
  tailR: number;
  tailS: number;

  /** Возрастной контур: 8 вершин октаграммы по десятилетиям 0–70 */
  ageDecades: { age: number; arcana: number }[];
}

export interface MatrixInput {
  day: number; // 1..31
  month: number; // 1..12
  year: number; // четырёхзначный
}

const digitSum = (n: number) =>
  String(n)
    .split("")
    .reduce((s, d) => s + Number(d), 0);

export function calcMatrix({ day, month, year }: MatrixInput): MatrixCore {
  const a = reduce22(day);
  const b = reduce22(month);
  const c = reduce22(digitSum(year));
  const d = reduce22(a + b + c);
  const e = reduce22(a + b + c + d);

  const rodTL = reduce22(a + b);
  const rodTR = reduce22(b + c);
  const rodBR = reduce22(c + d);
  const rodBL = reduce22(d + a);

  const sky = reduce22(b + d);
  const earth = reduce22(a + c);

  const personalPurpose = reduce22(sky + earth);
  const maleLine = reduce22(rodTL + rodBR);
  const femaleLine = reduce22(rodTR + rodBL);
  const socialPurpose = reduce22(maleLine + femaleLine);
  const spiritualPurpose = reduce22(personalPurpose + socialPurpose);
  const planetaryPurpose = reduce22(socialPurpose + spiritualPurpose);

  const moneyEntry = reduce22(e + rodBR);
  const loveEntry = reduce22(e + rodBL);

  const tailG = d;
  const tailR = reduce22(tailG + e);
  const tailS = reduce22(tailG + tailR);

  // Контур времени: A=0, далее по часовой через вершины октаграммы, шаг 10 лет
  const ageDecades = [
    { age: 0, arcana: a },
    { age: 10, arcana: rodTL },
    { age: 20, arcana: b },
    { age: 30, arcana: rodTR },
    { age: 40, arcana: c },
    { age: 50, arcana: rodBR },
    { age: 60, arcana: d },
    { age: 70, arcana: rodBL },
  ];

  return {
    a, b, c, d, e,
    rodTL, rodTR, rodBR, rodBL,
    sky, earth,
    personalPurpose, maleLine, femaleLine,
    socialPurpose, spiritualPurpose, planetaryPurpose,
    moneyEntry, loveEntry,
    tailG, tailR, tailS,
    ageDecades,
  };
}

/** Разбор строки YYYY-MM-DD (формат хранения birthDate в БД). */
export function calcMatrixFromISO(iso: string): MatrixCore | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = +m[1];
  const month = +m[2];
  const day = +m[3];
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return calcMatrix({ day, month, year });
}

/** Идентификаторы платных/бесплатных секций разбора. */
export const MATRIX_SECTIONS = [
  "comfort", // центр E — бесплатный крючок
  "persona", // точка A — бесплатный крючок
  "karmic_tail",
  "money",
  "love",
  "purpose",
  "rod",
] as const;
export type MatrixSectionId = (typeof MATRIX_SECTIONS)[number];

export const FREE_MATRIX_SECTIONS: MatrixSectionId[] = ["comfort", "persona"];

/** Арканы, участвующие в секции, — для сбора знаний в промпт. */
export function sectionArcana(core: MatrixCore, section: MatrixSectionId): number[] {
  switch (section) {
    case "comfort":
      return [core.e];
    case "persona":
      return [core.a];
    case "karmic_tail":
      return [core.tailG, core.tailR, core.tailS];
    case "money":
      return [core.moneyEntry, core.c, core.rodBR];
    case "love":
      return [core.loveEntry, core.rodBL, core.tailG];
    case "purpose":
      return [core.personalPurpose, core.socialPurpose, core.spiritualPurpose, core.planetaryPurpose];
    case "rod":
      return [core.rodTL, core.rodTR, core.rodBR, core.rodBL];
  }
}
