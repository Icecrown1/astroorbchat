import { buildNodes } from '../../client/src/components/MatrixOctagram';

// Birth is at the left vertex. Each eighth of the circle spans ten years.
const ages = Array.from({ length: 80 }, (_, age) => {
  const angle = Math.PI + age * Math.PI / 40;
  const radius = age % 2 === 0 ? 186 : 178;
  return { age, x: 200 + radius * Math.cos(angle), y: 200 + radius * Math.sin(angle) };
});

const paths = [
  ['a','b','c','d','a'], ['rodTL','rodTR','rodBR','rodBL','rodTL'],
  ['a','c'], ['b','d'], ['rodBL','loveEntry','e','moneyEntry','rodBR'],
];

export function MatrixPlate({ core, selected, onSelect }) {
  const nodes = buildNodes(core);
  const byId = Object.fromEntries(nodes.map(node => [node.id,node]));
  return <svg viewBox="0 0 400 400" role="group" aria-label="Арканы матрицы" className="matrix-plate">
    <g fill="none" stroke="#a88c68">
      <circle cx="200" cy="200" r="164" /><circle cx="200" cy="200" r="158" strokeDasharray="1 4" />
      <circle cx="200" cy="200" r="112" strokeDasharray="2 5" /><circle cx="200" cy="200" r="39" strokeDasharray="1 3" />
      {Array.from({length:80},(_,i) => <path key={i} transform={`rotate(${i*4.5} 200 200)`} d={i%10 ? 'M200 36v3' : 'M200 33v7'} />)}
    </g>
    {paths.map((ids,i) => <polyline key={i} points={ids.map(id => `${byId[id].x},${byId[id].y}`).join(' ')}
      fill="none" stroke={i === 0 || i === 4 ? '#a33220' : '#716046'} strokeWidth={i<2 ? 1.7 : 1.2} strokeDasharray={i===2 || i===3 ? '4 3' : undefined} />)}
    <g aria-label="Возраст в годах">
      {ages.map(({ age, x, y }) => <text key={age} x={x} y={y}
        className={'age-tick' + (age % 10 === 0 ? ' decade' : age % 5 === 0 ? ' midway' : '')}>{age}</text>)}
    </g>
    {nodes.map(n => {
      const active=selected===n.id;
      return <g key={n.id} className="matrix-point" role="button" tabIndex="0" aria-pressed={active}
        aria-label={`${n.label.ru}, аркан ${n.value}`} onClick={() => onSelect(n)}
        onKeyDown={e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onSelect(n); } }}>
        {(active || n.id==='e') && <circle cx={n.x} cy={n.y} r={n.r+3} fill="none" stroke="#ab351d" strokeWidth=".9" />}
        <circle cx={n.x} cy={n.y} r={n.r} fill={active ? '#b02715' : '#fbecd4'} stroke={active ? '#8a1a10' : '#776048'} strokeWidth="1.2" />
        <text x={n.x} y={n.y} fill={active ? '#fff4dd' : '#251d16'} fontSize={n.r > 15 ? 22 : 16}>{n.value}</text>
        <circle cx={n.x} cy={n.y} r={n.r+4} fill="transparent" />
      </g>;
    })}
  </svg>;
}
