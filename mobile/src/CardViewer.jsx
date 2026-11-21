import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { getTarotCard } from '../../shared/tarot';

const pictures = import.meta.glob('../../client/public/tarot/*.webp', { eager: true, query: '?url', import: 'default' });
const cardPicture = id => pictures[`../../client/public/tarot/${id}.webp`];

export const CardViewerContext = createContext(null);

export function CardButton({ cards, index = 0, children }) {
  const open = useContext(CardViewerContext);
  const { cardId, reversed, label } = cards[index];
  const name = getTarotCard(cardId)?.nameRu ?? 'Карта';
  const src = cardPicture(cardId);
  return <button type="button" className="card-button" disabled={!src} aria-haspopup="dialog"
    aria-label={`Увеличить: ${name}${reversed ? ', перевёрнутая' : ''}${label ? ' · ' + label : ''}`}
    onClick={() => open(cards, index)}>
    <span className={'tarot-face' + (reversed ? ' inverted' : '')}>
      {src && <img src={src} alt="" loading="lazy" />}
      <span className="card-caption" aria-hidden="true">{name}</span>
    </span>
    {children}
  </button>;
}

export function CardViewer({ viewer, onDismiss }) {
  const [index, setIndex] = useState(viewer.index);
  const dialog = useRef(null);
  const closing = useRef(false);
  const item = viewer.cards[index];
  const name = getTarotCard(item.cardId)?.nameRu ?? 'Карта';

  useLayoutEffect(() => {
    const element = dialog.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  function dismiss() {
    if (closing.current) return;
    closing.current = true;
    onDismiss();
  }

  return <dialog ref={dialog} className="card-viewer" aria-labelledby="viewer-title"
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (event.key === 'ArrowRight') setIndex(i => Math.min(viewer.cards.length - 1, i + 1));
    }}>
    <header><span>{item.label}</span><button type="button" onClick={dismiss} aria-label="Закрыть карту" autoFocus>×</button></header>
    <img src={cardPicture(item.cardId)} className={item.reversed ? 'reversed' : undefined} alt={name} />
    <footer aria-live="polite">
      <h2 id="viewer-title">{name}</h2>
      {item.reversed && <p>Перевёрнутая карта</p>}
      {viewer.cards.length > 1 && <div className="viewer-paging">
        <button type="button" aria-label="Предыдущая карта" disabled={index === 0} onClick={() => setIndex(index - 1)}>←</button>
        <span>{index + 1} из {viewer.cards.length}</span>
        <button type="button" aria-label="Следующая карта" disabled={index === viewer.cards.length - 1} onClick={() => setIndex(index + 1)}>→</button>
      </div>}
    </footer>
  </dialog>;
}
