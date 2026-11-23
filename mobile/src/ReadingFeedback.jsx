import { useContext, useState, createContext } from "react";
import { onlineRequest } from "./onlineApi";

export const FeedbackSession = createContext(null);
export function ReadingFeedback({ topic }) {
  const account = useContext(FeedbackSession);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!account?.token || !account.tarotStatus?.readingFeedback) return null;
  async function vote() {
    setBusy(true);
    setError(false);
    try {
      const response = await onlineRequest("/api/reading-feedback", {
        token: account.token,
        data: { topic, score },
      });
      setResult(response);
      if (response.rewarded) await account.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ledger">
      <h3>Насколько разбор похож на твой опыт?</h3>
      {result ? (
        <div role="status">
          <p>
            {result.rewarded
              ? "Спасибо! Ты в числе первых 100 участников. На баланс добавлено 20 ★."
              : "Спасибо за оценку."}
          </p>
          {result.others.length ? (
            <>
              <p>Как оценили этот инструмент другие</p>
              {result.others.map((r) => (
                <p key={r.score}>
                  {r.score} из 5 · голосов {r.votes}
                </p>
              ))}
            </>
          ) : (
            <p>Пока здесь только твоя оценка.</p>
          )}
        </div>
      ) : (
        <>
          <label>
            Твоя оценка{" "}
            <select
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            >
              <option value={0}>Выбрать</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} из 5
                </option>
              ))}
            </select>
          </label>
          <button disabled={!score || busy} onClick={vote}>
            Отправить и посмотреть ответы
          </button>
        </>
      )}
      {error && (
        <p role="alert">Не удалось получить результат. Повтори запрос.</p>
      )}
    </section>
  );
}
