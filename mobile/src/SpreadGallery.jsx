import { getTarotCard, TAROT_SPREADS } from '../../shared/tarot';
import { CardButton } from './CardViewer';

export function SpreadGallery({ cards, spread, labels, descriptions = [], titles = [], keywords = [], cardsOnly = false, children }) {
  if (!cards?.length) return children ?? null;
  const celtic = spread === 'celtic' && cards.length === TAROT_SPREADS.celtic.cards;
  const positions = cards.map(({ cardId, reversed }, i) => {
    const label = labels?.[i] ?? TAROT_SPREADS[spread]?.positions[i]?.[0] ?? `Карта ${i + 1}`;
    return { cardId, reversed, label: celtic ? `${i + 1}. ${label}` : label };
  });
  const layout = celtic ? 'celtic-cross' : cards.length === 1 ? 'one-card' : cards.length === 3 ? 'three-cards' : 'many-cards';

  return <section className="spread-gallery" aria-label="Карты расклада">
    <div className={`card-table ${layout}`} role="group" aria-label={celtic ? 'Схема Кельтского креста' : 'Карты на столе'}>
      {positions.map(({ label }, i) => <CardButton key={i} cards={positions} index={i}>
        <span className="position-label" aria-hidden="true">{celtic ? i + 1 : label}</span>
      </CardButton>)}
    </div>
    {children}
    {!cardsOnly && <div className="card-meanings">{positions.map(({ cardId, reversed, label }, i) => {
      const card = getTarotCard(cardId);
      const key = keywords[i] || (!descriptions[i] && card?.kw[reversed ? 1 : 0]);
      return <article className="card-meaning" key={i}>
        <small>{label}{reversed ? ' · Перевёрнутая карта' : ''}</small>
        <h3>{card?.nameRu ?? 'Карта'}</h3>
        {titles[i] && titles[i] !== card?.nameRu && <p className="card-key">{titles[i]}</p>}
        {key && <p className="card-key">{key}</p>}
        {descriptions[i] && <p>{descriptions[i]}</p>}
      </article>;
    })}</div>}
  </section>;
}
