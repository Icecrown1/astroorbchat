// Card numbers follow calendar order, Ace of Hearts (1) to King of Spades (52).
export function calendarNumber(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  )
    return null;
  return 55 - 2 * month - day;
}

export function cardName(card: number) {
  if (card === 0) return "Джокер";
  const ranks = [
    "Туз",
    "Двойка",
    "Тройка",
    "Четвёрка",
    "Пятёрка",
    "Шестёрка",
    "Семёрка",
    "Восьмёрка",
    "Девятка",
    "Десятка",
    "Валет",
    "Дама",
    "Король",
  ];
  return (
    ranks[(card - 1) % 13] +
    " " +
    ["червей", "треф", "бубен", "пик"][Math.floor((card - 1) / 13)]
  );
}

function add(a: number, b: number) {
  return ((a + b - 1) % 52) + 1;
}

export function connection(a: number, b: number) {
  const field = add(a, b);
  const first = add(a, field),
    second = add(b, field);
  const bond = add(first, second);
  const firstBond = add(a, bond),
    secondBond = add(b, bond);
  const conflict = add(firstBond, secondBond);
  const firstConflict = add(a, conflict),
    secondConflict = add(b, conflict);
  return {
    field,
    first,
    second,
    bond,
    firstBond,
    secondBond,
    conflict,
    firstConflict,
    secondConflict,
    root: add(firstConflict, secondConflict),
  };
}

// Richmond's double and single quadrates, ordered from the top of the pack.
function quadrate(deck: number[]) {
  const piles: number[][] = [[], [], [], []];
  for (let i = 0; i < 16; i++)
    piles[i % 4].unshift(...deck.slice(3 * i, 3 * i + 3));
  for (let i = 0; i < 4; i++) piles[i].unshift(deck[48 + i]);
  const stack = piles.reverse().flat();
  const single: number[][] = [[], [], [], []];
  stack.forEach((card, i) => single[i % 4].unshift(card));
  return single.reverse().flat();
}

export const planets = [
  "Меркурий",
  "Венера",
  "Марс",
  "Юпитер",
  "Сатурн",
  "Уран",
  "Нептун",
];
export function yearSpread(card: number, age: number) {
  if (!Number.isInteger(age) || age < 0 || card < 1 || card > 52) return null;
  const board = boardForAge(age);
  const sevenYearBoard = boardForAge(Math.floor(age / 7));
  const perspective =
    sevenYearBoard[(sevenYearBoard.indexOf(card) + (age % 7) + 1) % 52];
  return readBoard(board, card, perspective);
}

function boardForAge(age: number) {
  let board = Array.from({ length: 52 }, (_, i) => i + 1);
  for (let i = 0; i <= age % 90; i++) board = quadrate(board);
  return board;
}
function readBoard(board: number[], card: number, perspective: number) {
  const seat = board.indexOf(card);
  let vertical = seat;
  const periods = planets.map((planet, i) => {
    vertical =
      vertical >= 49
        ? vertical - 5
        : vertical >= 2 && vertical <= 4
          ? vertical + 47
          : (vertical + 42) % 49;
    return {
      planet,
      horizontal: board[(seat + i + 1) % 52],
      vertical: vertical === seat ? null : board[vertical],
    };
  });
  return {
    periods,
    perspective,
    pluto: board[(seat + 8) % 52],
    result: board[(seat + 9) % 52],
  };
}

export function rulingNumber(date: string) {
  const n = calendarNumber(date);
  if (!n) return null;
  const md = Number(date.slice(5).replace("-", ""));
  // Calendar boundaries used by the card system, independent of birth hour.
  const bounds = [
    [120, 5],
    [219, 6],
    [321, 7],
    [421, 3],
    [522, 2],
    [622, 1],
    [723, -1],
    [824, 0],
    [924, 1],
    [1024, 2],
    [1123, 8],
    [1222, 4],
    [1232, 5],
  ];
  const offset = bounds.find(([until]) => md < until)![1];
  const life = quadrate(Array.from({ length: 52 }, (_, i) => i + 1));
  return life[(life.indexOf(n) + offset + 52) % 52];
}

export function birthPositions(card: number) {
  const life = boardForAge(0);
  const seat = life.indexOf(card);
  return {
    firstKarma: seat + 1,
    secondKarma: life[card - 1],
    moon: life[(seat + 51) % 52],
    cosmicLesson: life[(seat + 10) % 52],
    ...readBoard(life, card, card),
  };
}
