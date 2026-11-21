const plates = import.meta.glob('./art/plates/*.webp', { eager: true, import: 'default' });

export function plate(name) {
  return plates[`./art/plates/${name}.webp`];
}

export function Frontispiece({ title, art, scene = false, children }) {
  return <div className={`frontispiece ${scene ? 'scene' : 'vignette'} art-${art}`}>
    <img className="front-art" src={plate(art)} alt="" />
    <div className="front-title"><h1>{title}</h1><i aria-hidden="true" />{children}</div>
  </div>;
}

export function IndexRow({ title, description, art, onClick, disabled }) {
  return <button type="button" className="index-row" onClick={onClick} disabled={disabled}>
    <span className="index-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
    <img src={plate(art)} alt="" loading="lazy" /><span className="index-arrow" aria-hidden="true">→</span>
  </button>;
}

export function NavIcon({ name }) {
  const paths = {
    home: <path d="M3.5 10.5 12 3l8.5 7.5v9a1 1 0 0 1-1 1H15v-6h-6v6H4.5a1 1 0 0 1-1-1z" />,
    tools: <>{[[3.5,3.5],[13.5,3.5],[3.5,13.5],[13.5,13.5]].map(([x,y]) => <rect key={x+','+y} x={x} y={y} width="7" height="7" rx="1.7" />)}</>,
    account: <><circle cx="12" cy="7.5" r="4" /><path d="M3.5 20.5v-1c0-3.8 3.4-6.2 8.5-6.2s8.5 2.4 8.5 6.2v1z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round">{paths[name]}</svg>;
}
