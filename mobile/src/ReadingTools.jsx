import { useState } from "react";
import { arcanaMetaByN } from "../../shared/matrixArcanaMeta";
import { calcMatrixFromISO } from "../../shared/matrix";
import {
  agePeriods,
  ageMarkers,
  yearsAround,
  chakraTable,
  chakras,
  histories,
  tarotQuestions,
} from "../../shared/readingThemes";
import { drawCards } from "../../shared/tarot";
import { SpreadGallery } from "./SpreadGallery";
import { StarConfirmation } from "./StarConfirmation";

function LifeStory({ match, story }) {
  return (
    match && (
      <details>
        <summary>История · {story.name}</summary>
        <p>{match}</p>
        <p>{story.text}</p>
        <a href={story.source} target="_blank" rel="noreferrer">
          Биография NASA
        </a>
      </details>
    )
  );
}

export function MatrixYears({ core, date }) {
  const current = new Date().getFullYear();
  const [year, setYear] = useState(current);
  const [decade, setDecade] = useState(() =>
    Math.min(
      70,
      Math.max(
        0,
        10 * Math.floor((current - Number(date?.slice(0, 4) || current)) / 10),
      ),
    ),
  );
  const calendar = new Date();
  const today = [
    calendar.getFullYear(),
    String(calendar.getMonth() + 1).padStart(2, "0"),
    String(calendar.getDate()).padStart(2, "0"),
  ].join("-");
  const periods = agePeriods(core, date || "", today);
  const story = histories.find((person) => {
    const example = calcMatrixFromISO(person.date);
    return (
      example.e === core.e && example.personalPurpose === core.personalPurpose
    );
  });
  return (
    <section className="ledger">
      <h3>Аркан личного года</h3>
      <label>
        Календарный год{" "}
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 41 }, (_, i) => current - 20 + i).map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      {yearsAround(core, year).map((row) => (
        <p key={row.year}>
          {row.year} · {row.arcana} · {arcanaMetaByN(row.arcana).ru}
        </p>
      ))}
      <small>
        Складываем арканы дня и месяца рождения с арканом выбранного года. Сумму
        выше 22 приводим сложением цифр.
      </small>
      {periods.length > 0 && <h3>Возрастной период</h3>}
      {periods.map((p, i) => (
        <p key={p.start}>
          {i === 0 ? "Сейчас" : "Следом"} · {arcanaMetaByN(p.arcana).ru} (
          {p.arcana}) · с {p.start.split("-").reverse().join(".")} до{" "}
          {p.until.split("-").reverse().join(".")}
        </p>
      ))}
      <small>
        Версия шкалы AstroOrbi 1.0. Каждый шаг равен 15 календарным месяцам от
        рождения. В дату перехода начинается следующий период.
      </small>
      <details>
        <summary>Арканы на возрастном круге</summary>
        <label>
          Десятилетие{" "}
          <select
            value={decade}
            onChange={(e) => setDecade(Number(e.target.value))}
          >
            {core.ageDecades.map((d) => (
              <option key={d.age} value={d.age}>
                {d.age}–{d.age + 10} лет
              </option>
            ))}
          </select>
        </label>
        {ageMarkers(core)
          .filter((v) => v.age >= decade && v.age <= decade + 10)
          .map((v) => (
            <p key={v.age}>
              {v.age.toLocaleString("ru")} лет · {arcanaMetaByN(v.arcana).ru} (
              {v.arcana})
            </p>
          ))}
        <small>
          Опорные возрасты школы AstroOrbi. Аркан середины получаем сложением
          двух соседних опор.
        </small>
      </details>
      <details>
        <summary>Линии и предназначения</summary>
        <p>
          Небо {core.sky} и Земля {core.earth} дают личное предназначение{" "}
          {core.personalPurpose}. Мужская линия {core.maleLine} и женская{" "}
          {core.femaleLine} дают социальное предназначение {core.socialPurpose}.
        </p>
        <p>
          Что легче даётся тебе наедине, а чему ты учишься среди людей? Вспомни
          по одному случаю за последний месяц.
        </p>
      </details>
      <details>
        <summary>Таблица чакр</summary>
        <p>Символические позиции матрицы по дате рождения.</p>
        <table className="chakra-table">
          <thead>
            <tr>
              {["Чакра", "Физика", "Энергия", "Эмоции"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chakraTable(core).map((values, i) => (
              <tr key={i}>
                <th>{chakras[i]}</th>
                {values.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p>
        Мужской род · {core.rodTL} → {core.rodBR} → {core.maleLine}. Женский род
        · {core.rodTR} → {core.rodBL} → {core.femaleLine}.
      </p>
      <p>
        Духовное предназначение · {core.spiritualPurpose} ·{" "}
        {arcanaMetaByN(core.spiritualPurpose).ru}. Оно объединяет личную и
        социальную позиции.
      </p>
      <LifeStory
        story={story}
        match={
          story &&
          "В ваших матрицах совпадают две позиции — центр и личное предназначение."
        }
      />
    </section>
  );
}

export function QuestionHelp({ onChoose }) {
  return (
    <details>
      <summary>Помочь с вопросом</summary>
      {tarotQuestions.map((q) => (
        <button
          className="secondary-button"
          type="button"
          key={q}
          onClick={() => onChoose(q)}
        >
          {q}
        </button>
      ))}
    </details>
  );
}

export function FriendsTarot({ account, openAccount }) {
  const [cards, setCards] = useState([]);
  const [question, setQuestion] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [tableId, setTableId] = useState(null);
  const [result, setResult] = useState(null);
  const cost = account.tarotStatus?.costs?.three;
  function deal() {
    setCards(drawCards(3, { allowReversed: true }));
    setResult(null);
    setTableId(crypto.randomUUID());
    setConfirm(false);
  }
  async function read() {
    setConfirm(false);
    const reply = await account.draw({
      spread: "three",
      question,
      tableCards: cards,
      tableId,
      readingFor: "guest",
    });
    if (reply) setResult(reply);
  }
  return (
    <section className="ledger">
      <h2>Расклад для другого</h2>
      <p>
        Передай телефон тому, кто задаёт вопрос. Можно просто вытянуть три карты
        и разобрать их вместе.
      </p>
      <QuestionHelp onChoose={setQuestion} />
      <label>
        Вопрос на столе
        <textarea
          maxLength={300}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </label>
      <button disabled={account.busy} onClick={deal}>
        {cards.length ? "Разложить заново" : "Вытянуть три карты бесплатно"}
      </button>
      {cards.length > 0 && (
        <>
          <SpreadGallery cards={cards} spread="three" cardsOnly />
          {result ? (
            <article>
              <h3>Разбор для гостя</h3>
              <p>{result.interpretation?.intro}</p>
              {result.interpretation?.cards?.map((c, i) => (
                <p key={i}>{c.text}</p>
              ))}
              <p>{result.interpretation?.synthesis}</p>
              <p>{result.interpretation?.advice}</p>
            </article>
          ) : account.token &&
            account.tarotStatus?.guestTable &&
            Number.isInteger(cost) ? (
            <>
              {confirm ? (
                <StarConfirmation
                  balance={account.profile?.orbs}
                  title="Разбор этих трёх карт"
                  cost={cost}
                  busy={account.busy}
                  onConfirm={read}
                  onCancel={() => setConfirm(false)}
                />
              ) : (
                <button
                  disabled={!question.trim() || account.busy}
                  onClick={() => setConfirm(true)}
                >
                  Разобрать эти карты · {cost} ★
                </button>
              )}
              {account.error && <p role="alert">{account.error}</p>}
            </>
          ) : (
            !account.token && (
              <button onClick={openAccount}>Войти в профиль</button>
            )
          )}
        </>
      )}
    </section>
  );
}
