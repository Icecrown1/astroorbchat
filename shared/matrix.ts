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
/** Аркан личного года: день + месяц + сумма цифр интересующего года, приведённые к 1..22.
 *  core.a = приведённый день, core.b = приведённый месяц — считается из ядра. */
export function arcanaOfYear(core: MatrixCore, targetYear: number): number {
  const yearSum = String(targetYear).split('').reduce((s, d) => s + Number(d), 0);
  return reduce22(core.a + core.b + reduce22(yearSum));
}

export const MATRIX_SECTIONS = [
  "comfort", // центр E — бесплатный крючок
  "persona", // точка A — бесплатный крючок
  "karmic_tail",
  "money",
  "love",
  "purpose",
  "rod",
  "year", // аркан личного года — отдельная цена 3⭐
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
    case "year":
      return [arcanaOfYear(core, new Date().getFullYear())];
  }
}

/* ===================== Роли позиций (подписи в разборах) ===================== */

type L = { ru: string; en: string };

/** Подписи позиций для арканов секции — в том же порядке, что sectionArcana(). */
export const SECTION_ROLES: Record<MatrixSectionId, L[]> = {
  comfort: [{ ru: "Центр матрицы — зона комфорта", en: "Matrix center — comfort zone" }],
  persona: [{ ru: "Визитная карточка — день рождения", en: "Calling card — day of birth" }],
  karmic_tail: [
    { ru: "Первое число хвоста — что тянется из прошлого", en: "First tail number — what carries over from the past" },
    { ru: "Второе число — как это проявляется сейчас", en: "Second number — how it shows up now" },
    { ru: "Третье число — главный урок", en: "Third number — the main lesson" },
  ],
  money: [
    { ru: "Точка входа в деньги", en: "Money entry point" },
    { ru: "Материальная задача (год рождения)", en: "Material task (birth year)" },
    { ru: "Денежный угол родового квадрата", en: "Money corner of the ancestral square" },
  ],
  love: [
    { ru: "Точка входа в отношения", en: "Relationship entry point" },
    { ru: "Угол отношений в родовом квадрате", en: "Relationship corner of the ancestral square" },
    { ru: "Основание хвоста — прошлый опыт в отношениях", en: "Tail base — past experience in relationships" },
  ],
  purpose: [
    { ru: "Личное предназначение (примерно до 40 лет)", en: "Personal purpose (roughly up to 40)" },
    { ru: "Социальное предназначение (40–60 лет)", en: "Social purpose (40–60)" },
    { ru: "Духовное предназначение (после 60)", en: "Spiritual purpose (60+)" },
    { ru: "Планетарное предназначение", en: "Planetary purpose" },
  ],
  rod: [
    { ru: "Отцовская линия рода — духовная программа", en: "Paternal line — spiritual program" },
    { ru: "Материнская линия рода — духовная программа", en: "Maternal line — spiritual program" },
    { ru: "Отцовская линия рода — материальная программа", en: "Paternal line — material program" },
    { ru: "Материнская линия рода — материальная программа", en: "Maternal line — material program" },
  ],
  year: [{ ru: "Аркан личного года", en: "Personal year arcana" }],
};

/* ===================== Совместимость: матрица пары ===================== */

/**
 * Матрица пары (канон из ТЗ, п. 1.10): одноимённые позиции двух матриц
 * складываются и приводятся к 1–22. Центр пары = reduce(центр₁ + центр₂).
 */
export function calcPairMatrix(p: MatrixCore, q: MatrixCore): MatrixCore {
  const s = (x: number, y: number) => reduce22(x + y);
  return {
    a: s(p.a, q.a), b: s(p.b, q.b), c: s(p.c, q.c), d: s(p.d, q.d), e: s(p.e, q.e),
    rodTL: s(p.rodTL, q.rodTL), rodTR: s(p.rodTR, q.rodTR), rodBR: s(p.rodBR, q.rodBR), rodBL: s(p.rodBL, q.rodBL),
    sky: s(p.sky, q.sky), earth: s(p.earth, q.earth),
    personalPurpose: s(p.personalPurpose, q.personalPurpose),
    maleLine: s(p.maleLine, q.maleLine),
    femaleLine: s(p.femaleLine, q.femaleLine),
    socialPurpose: s(p.socialPurpose, q.socialPurpose),
    spiritualPurpose: s(p.spiritualPurpose, q.spiritualPurpose),
    planetaryPurpose: s(p.planetaryPurpose, q.planetaryPurpose),
    moneyEntry: s(p.moneyEntry, q.moneyEntry),
    loveEntry: s(p.loveEntry, q.loveEntry),
    tailG: s(p.tailG, q.tailG), tailR: s(p.tailR, q.tailR), tailS: s(p.tailS, q.tailS),
    ageDecades: p.ageDecades.map((x, i) => ({ age: x.age, arcana: s(x.arcana, q.ageDecades[i].arcana) })),
  };
}

export const PAIR_ZONES = ["essence", "love", "money", "tail", "purpose"] as const;
export type PairZoneId = (typeof PAIR_ZONES)[number];

export const PAIR_ZONE_META: Record<PairZoneId, { title: L; roles: L[] }> = {
  essence: {
    title: { ru: "Суть союза", en: "The core of your bond" },
    roles: [
      { ru: "Центр пары — на чём держится союз", en: "Couple center — what holds the bond together" },
      { ru: "Как вас видят окружающие", en: "How others see you as a couple" },
      { ru: "Что вас притягивает друг к другу", en: "What draws you to each other" },
    ],
  },
  love: {
    title: { ru: "Отношения и быт", en: "Love and everyday life" },
    roles: [
      { ru: "Точка входа в отношения пары", en: "The couple's relationship entry point" },
      { ru: "Угол отношений — общие сценарии в чувствах и быту", en: "Relationship corner — shared patterns in feelings and home life" },
    ],
  },
  money: {
    title: { ru: "Деньги пары", en: "Money as a couple" },
    roles: [
      { ru: "Точка входа в деньги пары", en: "The couple's money entry point" },
      { ru: "Материальная задача пары", en: "The couple's material task" },
      { ru: "Денежный угол — как вы тратите и копите вместе", en: "Money corner — how you spend and save together" },
    ],
  },
  tail: {
    title: { ru: "Кармический хвост пары", en: "The couple's karmic tail" },
    roles: [
      { ru: "Что каждый принёс из прошлого опыта", en: "What each of you brings from the past" },
      { ru: "Как это проявляется в вашей паре", en: "How it shows up in your relationship" },
      { ru: "Общий урок союза", en: "The shared lesson of the bond" },
    ],
  },
  purpose: {
    title: { ru: "Задача пары", en: "Your purpose as a couple" },
    roles: [
      { ru: "Задача пары друг для друга", en: "What you're here to give each other" },
      { ru: "Задача пары для семьи и окружения", en: "What you're here to give family and others" },
    ],
  },
};

export function pairZoneArcana(pair: MatrixCore, zone: PairZoneId): number[] {
  switch (zone) {
    case "essence":
      return [pair.e, pair.a, pair.b];
    case "love":
      return [pair.loveEntry, pair.rodBL];
    case "money":
      return [pair.moneyEntry, pair.c, pair.rodBR];
    case "tail":
      return [pair.tailG, pair.tailR, pair.tailS];
    case "purpose":
      return [pair.personalPurpose, pair.socialPurpose];
  }
}

/* ===================== Формат сохранённых разборов (v2) ===================== */

export interface ReadingItemV2 {
  arcana: number;
  role: string;
  plus: string;
  minus: string;
}
export interface SectionReadingV2 {
  v: 2;
  kind: "section";
  summary: string;
  items: ReadingItemV2[];
  steps: string[];
}
export interface PairZoneReadingV2 {
  id: PairZoneId;
  title: string;
  arcana: number[];
  roles: string[];
  plus: string;
  minus: string;
}
export interface PairReadingV2 {
  v: 2;
  kind: "pair";
  partnerName: string;
  partnerBirthDate: string;
  summary: string;
  zones: PairZoneReadingV2[];
  steps: string[];
}

/** Разбор сохранённого текста: v2-JSON или старый простой текст (null). */
export function parseReadingV2(content: string | null | undefined): SectionReadingV2 | PairReadingV2 | null {
  if (!content || content[0] !== "{") return null;
  try {
    const j = JSON.parse(content);
    if (j && j.v === 2 && (j.kind === "section" || j.kind === "pair")) return j;
  } catch {
    /* старый формат */
  }
  return null;
}
