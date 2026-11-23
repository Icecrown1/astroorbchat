import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarNumber,
  cardName,
  connection,
  rulingNumber,
  yearSpread,
} from "../shared/campCards";
const birthCard = (date: string) => {
  const card = calendarNumber(date);
  return card === null ? null : cardName(card);
};
import { calcMatrixFromISO } from "../shared/matrix";
import { natalAspects, agePeriods, yearsAround } from "../shared/readingThemes";

test("reference matrix and age transitions, independent of the personal year", () => {
  const core = calcMatrixFromISO("1999-02-11")!;
  assert.deepEqual(
    [core.a, core.b, core.c, core.d, core.e],
    [11, 2, 10, 5, 10],
  );
  const [current, next] = agePeriods(core, "1999-02-11", "2026-11-22");
  assert.equal(current.arcana, 8);
  assert.equal(current.age, 27.5);
  assert.equal(current.start, "2026-08-11");
  assert.equal(next.start, current.until);
  assert.equal(agePeriods(core, "1999-02-11", next.start)[0].age, next.age);
  assert.equal(yearsAround(core, 2026)[1].arcana, 5);
});

test("leap dates and Camp calendar endpoints", () => {
  assert.equal(birthCard("1900-02-29"), null);
  assert.equal(birthCard("2000-02-29"), "Девятка треф");
  assert.equal(birthCard("2000-12-31"), "Джокер");
  assert.equal(birthCard("2000-01-01"), "Король пик");
  assert.equal(birthCard("1956-10-17"), "Пятёрка треф");
});

test("aspect across Aries and six degree orb boundary", () => {
  const aspect = (a: number, b: number) =>
    natalAspects([
      { name: "Sun", position: a },
      { name: "Mercury", position: b },
    ])[0];
  assert.equal(aspect(359, 1).type, "conjunction");
  assert.equal(aspect(350, 80).type, "square");
  assert.equal(aspect(0, 126).type, "trine");
  assert.equal(aspect(0, 127), undefined);
});

// Reference readings from the public Tragos forms, using synthetic dates.
const examples = [
  {
    birthday: "1970-02-11",
    age: 27,
    rows: [
      [21, 47, 13, 1, 39, 17, 35, 38, 23, 15],
      [44, 50, 30, 18, 7, 35],
    ],
    ruling: 48,
  },
  {
    birthday: "1970-01-01",
    age: 24,
    rows: [
      [29, 14, 38, 15, 3, 51, 22, 12, 33, 32],
      [5, 32, 9, 30, 18, 48, 3],
    ],
    ruling: 18,
  },
  {
    birthday: "1970-07-14",
    age: 19,
    rows: [
      [23, 50, 9, 45, 11, 8, 49, 14, 4, 36],
      [12, 32, 29, 44, 38, 49],
    ],
    ruling: 1,
  },
  {
    birthday: "1970-05-22",
    age: 7,
    rows: [
      [2, 43, 10, 16, 8, 47, 26, 9, 38, 21],
      [24, 49, 7, 5, 28, 26],
    ],
    ruling: 34,
  },
  {
    birthday: "1970-01-04",
    age: 32,
    rows: [
      [4, 39, 41, 21, 3, 47, 34, 15, 31, 50],
      [20, 40, 26, 38, 32, 37, 34],
    ],
    ruling: 33,
  },
  {
    birthday: "1970-12-07",
    age: 44,
    rows: [
      [25, 26, 27, 28, 29, 30, 31, 32, 9, 26],
      [17, 10, 3, 50, 45, 38, 31],
    ],
    ruling: 26,
  },
];
test("horizontal, vertical, ruling and long-range cards for six Tragos yearly readings", () => {
  for (const e of examples) {
    const r = yearSpread(calendarNumber(e.birthday)!, e.age)!;
    assert.equal(rulingNumber(e.birthday), e.ruling);
    assert.deepEqual(
      [...r.periods.map((p) => p.horizontal), r.pluto, r.result, r.perspective],
      e.rows[0],
    );
    assert.deepEqual(
      r.periods.map((p) => p.vertical).filter(Boolean),
      e.rows[1],
    );
  }
  assert.equal(yearSpread(0, 20), null);
});
test("day and both directions of the Tragos relationship reading", () => {
  assert.deepEqual(connection(40, 18), {
    field: 6,
    first: 46,
    second: 24,
    bond: 18,
    firstBond: 6,
    secondBond: 36,
    conflict: 42,
    firstConflict: 30,
    secondConflict: 8,
    root: 38,
  });
  assert.equal(connection(18, 40).first, 24);
  assert.equal(connection(52, 50).conflict, 38);
});

test("chakra table matches all 24 cells of the supplied reference", async () => {
  const { chakraTable } = await import("../shared/readingThemes");
  assert.deepEqual(chakraTable(calcMatrixFromISO("1999-02-11")!), [
    [11, 2, 13],
    [5, 14, 19],
    [21, 12, 6],
    [4, 22, 8],
    [10, 10, 20],
    [20, 15, 8],
    [10, 5, 15],
    [9, 8, 17],
  ]);
});
