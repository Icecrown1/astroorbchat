import { rewardsEnabled } from './playInternal';
import { useEffect, useState } from 'react';
import { drawCards, getTarotCard, TAROT_SPREADS } from '../../shared/tarot';
import { ClarifyingCard } from './AdPreview';
import { SpreadGallery } from './SpreadGallery';
import { plate } from './Editorial';

const storageKey = 'astroorbi.readings.v1';
const localSpreads = { daily:'Карта дня', yesno:'Да / Нет', three:'Три карты', celtic:'Кельтский крест' };
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function readEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(entries) ? entries.filter(entry =>
      entry && Object.hasOwn(localSpreads, entry.kind)
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


  const daily = entries.find(entry => entry.day === day);

  function create(kind) {
    const currentDay = todayKey();
    if (kind === 'daily' && entries.some(entry => entry.day === currentDay)) return;
    const entry = {
      id: crypto.randomUUID(),
      kind,
      day: kind === 'daily' ? currentDay : null,
      createdAt: new Date().toISOString(),
      cards: drawCards(TAROT_SPREADS[kind].cards, { allowReversed: kind !== 'daily' }),
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

  return { entries, daily, hasDaily: Boolean(daily), storageError, create };
}

function Reading({ entry }) {
  return <SpreadGallery key={entry.id} cards={entry.cards} spread={entry.kind} cardsOnly />;
}

export function Tarot({ readings, mode, setMode, onReadingComplete }) {
  const entry = mode === 'daily' ? readings.daily : readings.entries.find(item=>item.kind===mode);

  return (
    <section className="tarot-screen">
      <label>Выбери расклад<select value={mode} onChange={e=>setMode(e.target.value)}>{Object.entries(localSpreads).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
      {!entry && (
        <div className="tarot-empty">
          <img src={plate('hand')} alt="" />
          <p>{mode === 'daily' ? 'Твоя карта откроется один раз за день.' : 'Можно открыть карты и прочитать расклад самостоятельно.'}</p>
        </div>
      )}
      <div aria-live="polite">{entry && <Reading entry={entry} />}</div>

      {(mode !== 'daily' || !entry) && (
        <button type="button" onClick={() => { readings.create(mode); onReadingComplete(); }}>
          {mode === 'daily' ? 'Вытянуть карту дня' : entry ? 'Сделать новый расклад' : 'Вытянуть карты бесплатно'}
        </button>
      )}
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
            <strong>{localSpreads[entry.kind]}</strong>
            <time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time>
          </summary>
          <Reading entry={entry} />
          {rewardsEnabled && entry.kind === 'three' && <ClarifyingCard entry={entry} source="offline" earnedOnly />}
        </details>
      ))}
    </section>
  );
}
