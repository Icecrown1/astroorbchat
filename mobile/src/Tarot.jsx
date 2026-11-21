import { useEffect, useState } from 'react';
import { drawCards, getTarotCard, TAROT_SPREADS } from '../../shared/tarot';
import { SpreadGallery } from './SpreadGallery';
import { plate } from './Editorial';

const storageKey = 'astroorbi.readings.v1';
const threePositions = [
  ['Ситуация', 'Что в этой теме сейчас важнее всего?'],
  ['Слепая зона', 'Что стоит рассмотреть внимательнее?'],
  ['Следующий шаг', 'Какой небольшой шаг ты можешь сделать?'],
];
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function readEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(entries) ? entries.filter(entry =>
      entry && (entry.kind === 'daily' || entry.kind === 'three')
      && typeof entry.id === 'string' && Number.isFinite(Date.parse(entry.createdAt))
      && Array.isArray(entry.cards) && entry.cards.length === TAROT_SPREADS[entry.kind].cards
      && entry.cards.every(card => card && getTarotCard(card.cardId) && typeof card.reversed === 'boolean')
    ) : [];
  } catch {
    return [];
  }
}

export function useReadings() {
  const [entries, setEntries] = useState(readEntries);
  const [storageError, setStorageError] = useState(false);
  const [day, setDay] = useState(todayKey);

  useEffect(() => {
    const refreshDay = () => setDay(todayKey());
    const timer = window.setInterval(refreshDay, 30_000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  }, []);

  const lastSpread = entries.find(entry => entry.kind === 'three');
  const daily = entries.find(entry => entry.day === day);

  function create(kind) {
    const currentDay = todayKey();
    if (kind === 'daily' && entries.some(entry => entry.day === currentDay)) return;
    const entry = {
      id: crypto.randomUUID(),
      kind,
      day: kind === 'daily' ? currentDay : null,
      createdAt: new Date().toISOString(),
      cards: drawCards(TAROT_SPREADS[kind].cards, { allowReversed: kind === 'three' }),
    };

    // Keep today's draw even if more than 30 spreads are generated in one day.
    const recent = [entry, ...entries];
    const next = recent.slice(0, 30);
    const currentDaily = recent.find(item => item.day === currentDay);
    if (currentDaily && !next.includes(currentDaily)) next.push(currentDaily);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    setEntries(next);
    setDay(currentDay);
  }

  return { entries, daily, lastSpread, hasDaily: Boolean(daily), storageError, create };
}

function Reading({ entry }) {
  const positions = entry.kind === 'daily'
    ? [['Тема дня', 'Где сегодня ты замечаешь эту тему?']]
    : threePositions;
  return <SpreadGallery key={entry.id} cards={entry.cards} spread={entry.kind}
    labels={positions.map(([label]) => label)} descriptions={positions.map(([, prompt]) => prompt)}
    keywords={entry.cards.map(({ cardId, reversed }) => getTarotCard(cardId).kw[reversed ? 1 : 0])} />;
}

export function Tarot({ readings, mode, setMode, dailyAd }) {
  const entry = mode === 'daily' ? readings.daily : readings.lastSpread;

  return (
    <section className="tarot-screen">
      <div className="mode-switch" aria-label="Виды раскладов">
        <button type="button" aria-pressed={mode === 'daily'} onClick={() => setMode('daily')}>Карта дня</button>
        <button type="button" aria-pressed={mode === 'three'} onClick={() => setMode('three')}>Три карты</button>
      </div>
      {!entry && (
        <div className="tarot-empty">
          <img src={plate('hand')} alt="" />
          <p>{mode === 'daily' ? 'Твоя карта откроется один раз за день.' : 'Подумай о ситуации. Три карты подскажут вопросы, с которых можно начать.'}</p>
        </div>
      )}
      <div aria-live="polite">{entry && <Reading entry={entry} />}</div>
      {(mode === 'three' || !entry) && (
        <button type="button" onClick={() => readings.create(mode)}>
          {mode === 'daily' ? 'Вытянуть карту дня' : entry ? 'Сделать новый расклад' : 'Вытянуть три карты'}
        </button>
      )}
      {mode === 'daily' && entry && dailyAd}
      {readings.storageError && <p role="alert">Не удалось сохранить расклад на устройстве.</p>}
    </section>
  );
}

export function History({ entries, openTarot }) {
  return (
    <section className="tarot-screen">
      <h2>На этом устройстве</h2>
      {!entries.length && (
        <div className="empty-panel">
          <p>Здесь появятся карты дня и расклады с этого устройства.</p>
          <button type="button" className="secondary-button" onClick={openTarot}>Открыть Таро</button>
        </div>
      )}
      {entries.map(entry => (
        <details key={entry.id}>
          <summary>
            <strong>{entry.kind === 'daily' ? 'Карта дня' : 'Три карты'}</strong>
            <time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time>
          </summary>
          <Reading entry={entry} />
        </details>
      ))}
    </section>
  );
}
