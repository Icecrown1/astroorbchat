import { getTarotCard, TAROT_SPREADS } from '../../shared/tarot';
import { CardButton } from './CardViewer';

export function SpreadGallery({ cards, spread, labels, descriptions = [], titles = [], keywords = [], children }) {
  if (!cards?.length) return children ?? null;
  const positions = cards.map(({ cardId, reversed }, i) => ({
    cardId, reversed, label: labels?.[i] ?? TAROT_SPREADS[spread]?.positions[i]?.[0] ?? `Карта ${i + 1}`,
  }));

  return <section className="spread-gallery" aria-label="Карты расклада">
    <div className={`card-table ${cards.length === 1 ? 'one-card' : cards.length === 3 ? 'three-cards' : 'many-cards'}`}>
      {positions.map(({ label }, i) => <CardButton key={i} cards={positions} index={i}>
        <span className="position-label">{label}</span>
      </CardButton>)}
    </div>
    {children}
    <div className="card-meanings">{positions.map(({ cardId, reversed, label }, i) => {
      const card = getTarotCard(cardId);
      const key = keywords[i] || (!descriptions[i] && card?.kw[reversed ? 1 : 0]);
      return <article className="card-meaning" key={i}>
        <small>{label}{reversed ? ' · Перевёрнутая карта' : ''}</small>
        <h3>{card?.nameRu ?? 'Карта'}</h3>
        {titles[i] && titles[i] !== card?.nameRu && <p className="card-key">{titles[i]}</p>}
        {key && <p className="card-key">{key}</p>}
        {descriptions[i] && <p>{descriptions[i]}</p>}
      </article>;
    })}</div>
  </section>;
}
