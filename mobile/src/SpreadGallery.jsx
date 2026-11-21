import { useState } from 'react';
import { getTarotCard, TAROT_SPREADS } from '../../shared/tarot';
import { plate } from './Editorial';

const pictures = import.meta.glob('./art/deck/*.webp', { eager: true, import: 'default' });
const numerals = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
const suits = {
  cups: 'M4 3h12v4c0 4-2.5 6-6 6S4 11 4 7z M10 13v4m-4 1h8',
  swords: 'm10 1 2 3-1 9H9L8 4z M6 14h8m-4 0v5',
  wands: 'm5 18 9-15m-3 6 5-2m-7 6-1-4',
  pentacles: 'm10 2 2.1 5.9 6.2.2-5 3.8 1.7 6-5-3.5-5 3.5 1.7-6-5-3.8 6.2-.2z',
};
function SuitMark({ suit }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"><path d={suits[suit]} /></svg>;
}

export function TarotFace({ cardId, reversed = false }) {
  const card = getTarotCard(cardId);
  if (!card) return <span className="unknown-card">Карта</span>;
  let key = card.id;
  if (card.suit !== 'major') {
    if (card.num <= 10) key = card.suit;
    if (card.num === 11) key = 'page';
    if (card.num === 12) key = 'knight';
  }
  const picture = pictures[`./art/deck/${key}.webp`] || plate('hand');
  const pips = card.suit !== 'major' && card.num <= 10;
  return <span className={'tarot-face' + (reversed ? ' inverted' : '')} aria-hidden="true">
    <span className="card-number">{card.num <= 10 || card.suit === 'major' ? numerals[card.num] : <SuitMark suit={card.suit} />}</span>
    <img src={picture} alt="" />
    {pips && <span className="pip-count">{Array.from({length:card.num}, (_, i) => <SuitMark key={i} suit={card.suit} />)}</span>}
    <span className="card-caption">{card.nameRu}</span>
  </span>;
}

export function SpreadGallery({ cards, spread, labels, descriptions = [], titles = [], keywords = [] }) {
  const [picked, setPicked] = useState(0);
  if (!cards?.length) return null;
  const index = Math.min(picked, cards.length - 1);
  const active = cards[index];
  const name = getTarotCard(active.cardId)?.nameRu ?? 'Карта';
  const label = i => labels?.[i] ?? TAROT_SPREADS[spread]?.positions[i]?.[0] ?? `Карта ${i + 1}`;
  const heading = titles[index];
  return <section className="spread-gallery" aria-label="Карты расклада">
    <div className={`card-table ${cards.length === 1 ? 'one-card' : cards.length === 3 ? 'three-cards' : 'many-cards'}`}>
      {cards.map((item, i) => <button key={i} type="button" aria-pressed={i === index}
        aria-label={`${label(i)} · ${getTarotCard(item.cardId)?.nameRu ?? 'Карта'}${item.reversed ? ', перевёрнутая' : ''}`}
        onClick={() => setPicked(i)}>
        <TarotFace cardId={item.cardId} reversed={item.reversed} /><span className="position-label">{label(i)}</span>
      </button>)}
    </div>
    <article className="card-meaning" aria-live="polite">
      <small>{label(index)}{active.reversed ? ' · Перевёрнутая карта' : ''}</small>
      <h3>{name}</h3>
      {heading && heading !== name && <p className="card-key">{heading}</p>}
      {keywords[index] && <p className="card-key">{keywords[index]}</p>}
      {descriptions[index] && <p>{descriptions[index]}</p>}
    </article>
  </section>;
}
