import {
  arcanaOfYear,
  calcMatrixFromISO,
  reduce22,
  type MatrixCore,
} from "./matrix";

export const tarotQuestions = [
  "Что мне стоит учесть перед этим решением?",
  "Как начать разговор, который я давно откладываю?",
  "Что в этой ситуации зависит от меня?",
];

export function ageMarkers(core: MatrixCore) {
  const decades = [...core.ageDecades, { age: 80, arcana: core.a }];
  const markers = [];
  for (let i = 0; i < decades.length - 1; i++) {
    const left = decades[i],
      right = decades[i + 1];
    const mid = reduce22(left.arcana + right.arcana);
    markers.push(
      left,
      { age: left.age + 2.5, arcana: reduce22(left.arcana + mid) },
      { age: left.age + 5, arcana: mid },
      { age: left.age + 7.5, arcana: reduce22(mid + right.arcana) },
    );
  }
  const anchors = [...markers, decades[8]];
  return anchors.flatMap((point, i) => {
    const next = anchors[i + 1];
    return next
      ? [
          point,
          {
            age: point.age + 1.25,
            arcana: reduce22(point.arcana + next.arcana),
          },
        ]
      : [point];
  });
}

export function yearsAround(core: MatrixCore, year: number) {
  return [year - 1, year, year + 1].map((y) => ({
    year: y,
    arcana: arcanaOfYear(core, y),
  }));
}

export const suitQuestions: Record<string, string> = {
  червей:
    "Когда за последнюю неделю тебе было легко рассказать другому человеку, что ты чувствуешь?",
  треф: "Какую привычную идею можно проверить небольшим опытом?",
  бубен:
    "На что ты охотно тратишь своё время, даже когда никто этого не замечает?",
  пик: "Какое умение стало твоей опорой благодаря ежедневной практике?",
};
export const jemison = {
  date: "1956-10-17",
  text: "Мэй Джемисон родилась 17 октября 1956 года. До подготовки в NASA она работала врачом. В 1992 году стала специалистом миссии на шаттле Endeavour. Какой навык из прежней роли пригодился тебе в совершенно новом деле?",
  source:
    "https://starchild.gsfc.nasa.gov/docs/StarChild/whos_who_level2/jemison.html",
};

export const aspectKinds = [
  {
    type: "conjunction",
    angle: 0,
    glyph: "☌",
    ru: "Соединение",
    text: "Две темы звучат вместе. Вспомни случай, когда было трудно отделить одну от другой.",
  },
  {
    type: "sextile",
    angle: 60,
    glyph: "⚹",
    ru: "Секстиль",
    text: "Темы могут поддержать друг друга, когда ты проявляешь инициативу.",
  },
  {
    type: "square",
    angle: 90,
    glyph: "□",
    ru: "Квадрат",
    text: "Две задачи могут требовать разных решений. Как дать место обеим?",
  },
  {
    type: "trine",
    angle: 120,
    glyph: "△",
    ru: "Тригон",
    text: "Сочетание связывают с привычным умением. Когда оно давалось тебе особенно легко?",
  },
  {
    type: "opposition",
    angle: 180,
    glyph: "☍",
    ru: "Оппозиция",
    text: "Два полюса одной ситуации. Что меняется, если посмотреть с другой стороны?",
  },
];

export function natalAspects(planets: { name: string; position: number }[]) {
  const result = [];
  for (let i = 0; i < planets.length; i++) {
    const a = planets[i];
    for (const b of planets.slice(i + 1)) {
      const diff = Math.abs(a.position - b.position) % 360;
      const distance = Math.min(diff, 360 - diff);
      const aspect = aspectKinds.find((k) => Math.abs(distance - k.angle) <= 6);
      if (aspect)
        result.push({
          ...aspect,
          planet1: a.name,
          planet2: b.name,
          orb: Math.abs(distance - aspect.angle),
        });
    }
  }
  return result;
}

export function agePeriods(core: MatrixCore, birthday: string, today: string) {
  if (!calcMatrixFromISO(birthday) || !/^\d{4}-\d{2}-\d{2}$/.test(today))
    return [];
  const [y, m, d] = birthday.split("-").map(Number);
  function boundary(age: number) {
    const first = new Date(Date.UTC(y, m - 1 + Math.round(age * 12), 1));
    const lastDay = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    first.setUTCDate(Math.min(d, lastDay));
    return first.toISOString().slice(0, 10);
  }
  const points = ageMarkers(core);
  const periods = points
    .slice(0, -1)
    .map((p, i) => ({
      ...p,
      start: boundary(p.age),
      until: boundary(points[i + 1].age),
    }));
  const index = periods.findIndex((p) => p.start <= today && today < p.until);
  return index < 0 ? [] : periods.slice(index, index + 2);
}

export function chakraTable({ a, b, c, d, e }: MatrixCore) {
  const left = reduce22(a + e),
    top = reduce22(b + e);
  const points = [
    [a, b],
    [reduce22(a + left), reduce22(b + top)],
    [left, top],
    [reduce22(left + e), reduce22(top + e)],
    [e, e],
    [reduce22(c + e), reduce22(d + e)],
    [c, d],
  ];
  const rows = points.map(([x, y]) => [x, y, reduce22(x + y)]);
  const totals = [0, 1, 2].map((i) =>
    reduce22(rows.reduce((sum, row) => sum + row[i], 0)),
  );
  return [...rows, totals];
}
export const chakras = [
  "Сахасрара",
  "Аджна",
  "Вишудха",
  "Анахата",
  "Манипура",
  "Свадхистана",
  "Муладхара",
  "Итого",
];

export const histories = [
  { ...jemison, name: "Мэй Джемисон" },
  {
    name: "Кэтрин Джонсон",
    date: "1918-08-26",
    source: "https://science.nasa.gov/people/katherine-johnson/",
    text: "Перед орбитальным полётом 1962 года Джон Гленн попросил Кэтрин Джонсон перепроверить расчёты компьютера. Когда ко второму мнению прислушались в твоей жизни?",
  },
];
