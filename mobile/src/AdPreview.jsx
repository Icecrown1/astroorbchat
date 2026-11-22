import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { drawCards, getTarotCard } from '../../shared/tarot';
import { RewardUnlock } from './RewardUnlock';
import { CardButton } from './CardViewer';
import { plate } from './Editorial';

const duration = 5000;

export function AdPreview({ rewarded, onEarn, onDismiss, rewardName, remaining }) {
  const element = useRef(null);
  const closing = useRef(false);
  const earned = useRef(false);
  const [elapsed, setElapsed] = useState(0);

  useLayoutEffect(() => {
    const dialog = element.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (!rewarded) return;
    let watched = 0;
    let start = null;
    function update() {
      if (closing.current || earned.current || start === null) return;
      const now = performance.now();
      watched = Math.min(duration, watched + now - start);
      start = now;
      setElapsed(watched);
      if (watched >= duration) {
        earned.current = true;
        onEarn();
      }
    }
    function visibility() {
      update();
      start = document.hidden ? null : performance.now();
    }
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(update, 100);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [rewarded, onEarn]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    onDismiss();
  }

  const done = elapsed >= duration;
  return <dialog ref={element} className="ad-preview-screen" aria-labelledby="ad-title"
    onCancel={event => { event.preventDefault(); close(); }}>
    <header><span>Тестовая реклама</span>
      <button type="button" autoFocus onClick={close} aria-label="Закрыть рекламу">×</button></header>
    <div className="ad-scene">
      <img src={plate(rewarded ? 'glass' : 'sun')} alt="" />
      <h2 id="ad-title">{rewarded ? 'Реклама за награду' : 'Межстраничная реклама'}</h2>
      {rewarded && <p>{rewardName}</p>}
    </div>
    <footer>
      {rewarded && <>
        <progress max={duration} value={elapsed} aria-label="Просмотр ролика" />
        <p>{done ? (remaining ? `Просмотр засчитан · осталось ${remaining}` : 'Награда получена') : `До награды · ${Math.ceil((duration - elapsed) / 1000)} сек.`}</p>
      </>}
      <button type="button" onClick={close}>{rewarded && !done ? 'Закрыть без награды' : 'Продолжить'}</button>
    </footer>
  </dialog>;
}

export function ClarifyingCard({ entry, source, earnedOnly = false }) {
  const title = 'Карта пояснения';
  return <RewardUnlock id={`tarot:${source}:${entry.id}`} title={title} earnedOnly={earnedOnly}
    makeReward={() => drawCards(4).find(card => !entry.cards.some(drawn => drawn.cardId === card.cardId)).cardId}>
    {cardId => {
      const card = getTarotCard(cardId);
      if (!card) return null;
      return <section className="rewarded-advice">
        <CardButton cards={[{ cardId, label: title }]} />
        <div><small>{title}</small><h3>{card.nameRu}</h3><p>{card.kw[0]}</p>
          <p>{({ wands: 'Какое действие связывает три карты расклада?', cups: 'Какое чувство объединяет три карты?',
            swords: 'Какую мысль в раскладе стоит перепроверить?', pentacles: 'Какой практический шаг следует из расклада?',
            major: 'Какая общая тема повторяется в трёх картах?' })[card.suit]}</p></div>
      </section>;
    }}
  </RewardUnlock>;
}
