import { useState } from "react";
import {
  calendarNumber,
  cardName,
  connection,
  yearSpread,
  rulingNumber,
  birthPositions,
} from "../../shared/campCards";
import { suitQuestions, histories } from "../../shared/readingThemes";

const tabs = ["Карты любви", "Прогноз на год", "Отношения", "Прогноз на день"];
const dateLabel = (date) =>
  date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
const situation = [
  "Прими во внимание тон разговора. Что поможет человеку рядом почувствовать, что его услышали?",
  "Запиши два объяснения ситуации и проверь, какие факты говорят в пользу каждого.",
  "Сравни, сколько сил требуют варианты и какой результат для тебя ценен.",
  "Выбери один конкретный шаг, который можно довести до конца.",
];

const rankIdeas = [
  "Начало. Опиши первый шаг так, чтобы его можно было сделать за десять минут.",
  "Пара. Что каждый готов вложить в общее дело?",
  "Выбор. Придумай третий вариант там, где пока видишь только два.",
  "Опора. Какая небольшая привычка уже помогает держать ритм?",
  "Перемена. Попробуй изменить одну часть привычного порядка.",
  "Договорённость. Назови условие, с которым действительно согласны обе стороны.",
  "Сомнение. Какое предположение стоило бы перепроверить?",
  "Влияние. Где твоя помощь полезна, а где другому важнее выбрать самому?",
  "Завершение. Какой разговор или дело пора спокойно довести до конца?",
  "Общий результат. Отметь, чей вклад легко упустить из виду.",
  "Проба. Дай себе право на черновик перед окончательным решением.",
  "Забота. Уточни, какая поддержка сейчас действительно нужна.",
  "Ответственность. Какое решение ты готов объяснить другим?",
];
function Position({ title, card }) {
  if (!card) return null;
  return (
    <article>
      <strong>
        {title} · {cardName(card)}
      </strong>
      <p>{rankIdeas[(card - 1) % 13]}</p>
      <small>{situation[Math.floor((card - 1) / 13)]}</small>
    </article>
  );
}

function annualDate(iso, age) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(
    Date.UTC(
      y + age,
      m - 1,
      Math.min(d, new Date(Date.UTC(y + age, m, 0)).getUTCDate()),
    ),
  );
}

function Annual({ date, card }) {
  const [choice, setChoice] = useState("");
  const [layer, setLayer] = useState("birth");
  const today = new Date();
  const localDay = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const difference = today.getFullYear() - Number(date.slice(0, 4));
  const currentAge =
    difference - (localDay < annualDate(date, difference).getTime() ? 1 : 0);
  const age = choice === "" ? currentAge : Number(choice);
  const ruling = rulingNumber(date);
  const result = yearSpread(layer === "birth" ? card : ruling, age);
  const start = annualDate(date, age);
  return (
    <>
      <label>
        Возраст на день рождения{" "}
        <input
          type="number"
          min="0"
          max="150"
          placeholder={String(currentAge)}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        />
      </label>
      <label>
        Основа расклада{" "}
        <select value={layer} onChange={(e) => setLayer(e.target.value)}>
          <option value="birth">Карта рождения</option>
          <option value="ruling">Карта планетного управления</option>
        </select>
      </label>
      {result && age <= 150 && (
        <>
          <p>
            Год начинается {dateLabel(start)}. В каждом периоде первая карта
            задаёт тему, вторая добавляет контекст.
          </p>
          {result.periods.map((p, i) => {
            const begin = new Date(
              start.getTime() + (i === 0 ? 0 : 52 * i + 1) * 86400000,
            );
            const end =
              i === 6
                ? new Date(annualDate(date, age + 1).getTime() - 86400000)
                : new Date(start.getTime() + 52 * (i + 1) * 86400000);
            return (
              <details key={p.planet}>
                <summary>
                  {p.planet} · {dateLabel(begin)} – {dateLabel(end)}
                </summary>
                <Position title="Горизонтальная карта" card={p.horizontal} />
                <Position title="Вертикальная карта" card={p.vertical} />
              </details>
            );
          })}
          <Position title="Плутон · задача года" card={result.pluto} />
          <Position title="Результат года" card={result.result} />
          <Position title="Перспектива года" card={result.perspective} />
        </>
      )}
    </>
  );
}

export function CampCards() {
  const now = new Date();
  const [mode, setMode] = useState(tabs[0]);
  const [birth, setBirth] = useState("");
  const [partner, setPartner] = useState("");
  const [day, setDay] = useState(
    [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-"),
  );
  const a = calendarNumber(birth),
    b = calendarNumber(partner),
    d = calendarNumber(day);
  const birthLayout = a > 0 ? birthPositions(a) : null;
  const story = histories.find(
    (person) =>
      a === calendarNumber(person.date) &&
      rulingNumber(birth) === rulingNumber(person.date),
  );
  const pair = a && b ? connection(a, b) : null;
  const forecast = a && d ? connection(a, d) : null;
  return (
    <section className="tarot-screen">
      <h1>Карты Кэмпа</h1>
      <div className="camp-tabs">
        {tabs.map((tab) => (
          <button
            aria-pressed={tab === mode}
            key={tab}
            onClick={() => setMode(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <label>
        Дата рождения{" "}
        <input
          type="date"
          value={birth}
          onChange={(e) => setBirth(e.target.value)}
        />
      </label>
      {a !== null && (
        <div className="ledger">
          <h2>{cardName(a)}</h2>
          {mode === tabs[0] && (
            <>
              <p>
                Твоя карта рождения. {suitQuestions[cardName(a).split(" ")[1]]}
              </p>
              {a > 0 && (
                <Position
                  title="Карта планетного управления"
                  card={rulingNumber(birth)}
                />
              )}
              {birthLayout && (
                <details>
                  <summary>Планетарные и кармические карты</summary>
                  <p>Луна · {cardName(birthLayout.moon)}</p>
                  {birthLayout.periods.map((p) => (
                    <p key={p.planet}>
                      {p.planet} · {cardName(p.horizontal)}
                    </p>
                  ))}
                  {birthLayout.firstKarma === a ? (
                    <p>Карта занимает одно и то же место в обоих раскладах.</p>
                  ) : (
                    <>
                      <Position
                        title="Первая кармическая карта"
                        card={birthLayout.firstKarma}
                      />
                      <Position
                        title="Вторая кармическая карта"
                        card={birthLayout.secondKarma}
                      />
                    </>
                  )}
                </details>
              )}
              {story && (
                <details>
                  <summary>История · {story.name}</summary>
                  <p>Совпали карта рождения и карта управления.</p>
                  <p>{story.text}</p>
                  <a href={story.source} target="_blank" rel="noreferrer">
                    Биография NASA
                  </a>
                </details>
              )}
            </>
          )}
          {mode !== tabs[0] && a === 0 && (
            <p>
              31 декабря соответствует Джокеру. В этой версии методики
              персональный расклад для него не определён.
            </p>
          )}
          {a > 0 && mode === tabs[1] && <Annual date={birth} card={a} />}
          {a > 0 && mode === tabs[2] && (
            <>
              <label>
                Дата рождения второго человека{" "}
                <input
                  type="date"
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                />
              </label>
              {b === 0 && (
                <p>
                  У второго человека Джокер. Для этой пары методика не задаёт
                  расклад.
                </p>
              )}
              {pair && (
                <>
                  <p>Карта партнёра · {cardName(b)}</p>
                  <Position
                    title="Что возникает между вами"
                    card={pair.field}
                  />
                  <Position
                    title="Что встреча приносит тебе"
                    card={pair.first}
                  />
                  <Position
                    title="Что встреча приносит партнёру"
                    card={pair.second}
                  />
                  <Position title="Что удерживает вместе" card={pair.bond} />
                  <p>
                    Для тебя · {cardName(pair.firstBond)}. Для партнёра ·{" "}
                    {cardName(pair.secondBond)}.
                  </p>
                  <Position title="Тема разногласий" card={pair.conflict} />
                  <p>
                    Твоя сторона · {cardName(pair.firstConflict)}. Сторона
                    партнёра · {cardName(pair.secondConflict)}.
                  </p>
                  <Position title="Основа отношений" card={pair.root} />
                </>
              )}
            </>
          )}
          {a > 0 && mode === tabs[3] && (
            <>
              <label>
                Дата прогноза{" "}
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
              {d === 0 && <p>На дату Джокера нет расчётной карты дня.</p>}
              {forecast && (
                <>
                  <p>Карта даты · {cardName(d)}</p>
                  <Position title="Тема дня" card={forecast.field} />
                  <Position title="Урок дня" card={forecast.second} />
                  <Position title="Бонус дня" card={forecast.first} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
