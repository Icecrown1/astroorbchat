import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { drawCards, getTarotCard } from '../../shared/tarot';
import { CardButton } from './CardViewer';
import { plate } from './Editorial';

const duration = 5000;

export function AdPreview({ rewarded, onEarn, onDismiss, rewardName }) {
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
        <p>{done ? 'Награда получена' : `До награды · ${Math.ceil((duration - elapsed) / 1000)} сек.`}</p>
      </>}
      <button type="button" onClick={close}>{rewarded && !done ? 'Закрыть без награды' : 'Продолжить'}</button>
    </footer>
  </dialog>;
}

export function RewardedAdvice({ entry, scope, onWatch }) {
  const storageKey = `astroorbi.advice.v1.${scope}`;
  const [bonus, setBonus] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved?.readingId === entry.id ? getTarotCard(saved.cardId) : null;
    } catch { return null; }
  });

  function grant() {
    const drawn = drawCards(2).find(card => card.cardId !== entry.cards[0].cardId);
    const card = getTarotCard(drawn.cardId);
    setBonus(card);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ readingId: entry.id, cardId: card.id }));
    } catch { /* The reward is still available in this reading. */ }
  }

  if (!bonus) return <button type="button" className="secondary-button" onClick={() => onWatch(grant)}>
    Посмотреть рекламу и открыть карту совета
  </button>;
  return <section className="rewarded-advice">
    <CardButton cards={[{ cardId: bonus.id, label: 'Карта совета' }]} />
    <div><small>Карта совета</small><h3>{bonus.nameRu}</h3><p>{bonus.kw[0]}</p></div>
  </section>;
}
