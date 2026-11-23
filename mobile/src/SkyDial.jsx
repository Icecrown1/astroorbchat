import { useId } from 'react';
import { translatePlanet } from '../../client/src/lib/astroTranslations';
import { plate } from './Editorial';

const signs = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
export const planetGlyph = { Sun:'☉', Moon:'☽', Mercury:'☿', Venus:'♀', Mars:'♂', Jupiter:'♃', Saturn:'♄', Uranus:'♅', Neptune:'♆', Pluto:'♇', 'North Node':'☊', 'South Node':'☋' };

function point(degrees, radius) {
  const a = (degrees - 90) * Math.PI / 180;
  return { x: 180 + Math.cos(a) * radius, y: 180 + Math.sin(a) * radius };
}

function ray(start, end, angle, props) {
  const a = point(angle, start), b = point(angle, end);
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...props} />;
}

function sector(start, end, inner, outer) {
  const a = point(start, outer), b = point(end, outer), c = point(end, inner), d = point(start, inner);
  const large = ((end - start + 360) % 360) > 180 ? 1 : 0;
  return `M${a.x},${a.y} A${outer},${outer} 0 ${large} 1 ${b.x},${b.y} L${c.x},${c.y} A${inner},${inner} 0 ${large} 0 ${d.x},${d.y} Z`;
}

// Reserve independent angular slots for labels. The ticks and connecting lines stay at the true longitude.
function placeLabels(planets) {
  const sorted = [...planets].sort((a, b) => a.position - b.position);
  let start = 0, gap = -1;
  sorted.forEach((planet, i) => {
    const next = (i + 1) % sorted.length;
    const distance = (sorted[next].position - planet.position + 360) % 360;
    if (distance > gap) { gap = distance; start = next; }
  });
  const ordered = [...sorted.slice(start), ...sorted.slice(0, start)];
  const spacing = Math.min(18, 340 / ordered.length);
  const blocks = [];
  ordered.forEach((planet, i) => {
    const longitude = planet.position + (i >= sorted.length - start ? 360 : 0);
    blocks.push({ total: longitude - i * spacing, count: 1 });
    while (blocks.length > 1) {
      const right = blocks.at(-1), left = blocks.at(-2);
      if (left.total / left.count <= right.total / right.count) break;
      left.total += right.total; left.count += right.count; blocks.pop();
    }
  });
  const offsets = blocks.flatMap(({ total, count }) => Array(count).fill(total / count));
  return ordered.map((planet, i) => ({ ...planet, labelAngle: offsets[i] + i * spacing }));
}

export function SkyDial({ planets, aspects, cusps, angles, selected, house, onSelect }) {
  const clip = useId();
  const current = planets.find(p => p.name === selected);
  const selectedSign = current ? Math.floor((current.position % 360 + 360) % 360 / 30) : -1;
  const byName = new Map(planets.map(p => [p.name, p]));
  return <svg className="sky-dial" viewBox="0 0 360 360" aria-label="Натальное колесо. Выбери планету" role="group">
    <defs><clipPath id={clip}><circle cx="180" cy="180" r="32" /></clipPath></defs>
    <circle cx="180" cy="180" r="166" fill="#faebd3" stroke="#514231" />
    {signs.map((glyph, i) => {
      const active = house == null && i === selectedSign;
      return <g key={glyph}>
        <path d={sector(i*30,(i+1)*30,129,157)} fill={active ? '#ae2816' : 'none'} stroke="#937452" strokeWidth=".8" />
        <text {...point(i*30+15,143)} fill={active ? '#fff3dd' : '#30261e'} fontSize="21">{glyph}{'\uFE0E'}</text>
      </g>;
    })}
    {Array.from({length:72},(_,i) => ray(i%6 === 0 ? 157 : 161,165,i*5,{key:i,stroke:'#70583e',strokeWidth:.8}))}
    {cusps && cusps.map((start,i) => {
      const end = cusps[(i+1)%12];
      return <g key={i}><path d={sector(start,end,110,129)} fill={house === i+1 ? '#b52b17' : 'none'} stroke="#af9170" strokeWidth=".65" />
        <text {...point(start+((end-start+360)%360)/2,119.5)} fill={house === i+1 ? '#fff5e4' : '#463629'} fontSize="11">{i+1}</text></g>;
    })}
    <image href={plate('sun')} x="132" y="132" width="96" height="96" clipPath={`url(#${clip})`} className="dial-sun" />
    {Array.isArray(aspects) && aspects.map((aspect,i) => {
      const a=byName.get(aspect.planet1), b=byName.get(aspect.planet2);
      if (!a || !b) return null;
      const p=point(a.position,66), q=point(b.position,66);
      const active=a.name===selected || b.name===selected;
      return <g key={i}><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={active ? '#aa361d' : '#89765e'}
        strokeWidth={active ? 1.2 : .7} opacity={active ? .8 : .52} strokeDasharray={['square','opposition'].includes(aspect.type) ? '3 2' : undefined} />
        {active && <text x={p.x*.68+q.x*.32} y={p.y*.68+q.y*.32} fontSize="10" stroke="#fff3dd" strokeWidth="2.5" paintOrder="stroke" fill="#592b12">{aspect.glyph}</text>}</g>;
    })}

    {Object.entries({ASC:angles?.Ascendant,MC:angles?.MC}).map(([key,item]) => Number.isFinite(item?.longitude) &&
      <text key={key} {...point(item.longitude,173)} className="dial-angle">{key}</text>)}
    {placeLabels(planets).map(planet => {
      const p=point(planet.labelAngle,88), tick=point(planet.position,109);
      const active=selected === planet.name && house == null;
      return <g key={planet.name} className="dial-planet" role="button" tabIndex="0" aria-pressed={active}
        aria-label={translatePlanet(planet.name,'ru')} onClick={() => onSelect(planet.name)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(planet.name); } }}>
        <line x1={p.x} y1={p.y} x2={tick.x} y2={tick.y} stroke="#765e41" strokeWidth=".9" />
        <circle cx={tick.x} cy={tick.y} r="1.8" fill="#765e41" />
        <circle cx={p.x} cy={p.y} r="13" fill={active ? '#af2717' : '#fff4df'} stroke={active ? '#9d1c0f' : '#83684d'} />
        <text {...p} fontSize="18" fill={active ? '#fff' : '#382619'}>{planetGlyph[planet.name] || planet.name[0]}{'\uFE0E'}</text>
        <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
      </g>;
    })}
  </svg>;
}
