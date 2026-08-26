import { useMemo, useState } from 'react';
import type { MatrixCore } from '@shared/matrix';

/**
 * Интерактивная октаграмма Матрицы судьбы.
 * Чистый inline-SVG: тап-зоны, фильтры зон, анимация прорисовки (stroke-dashoffset).
 * Цвета: личный ромб — фиолетовый (iris), родовой квадрат — золотой (stellar).
 */

export type MatrixZone = 'all' | 'personal' | 'rod' | 'money' | 'love' | 'karma' | 'purpose';

export interface OctagramNode {
  id: string;
  value: number;
  x: number;
  y: number;
  r: number;
  zones: MatrixZone[];
  label: { ru: string; en: string };
}

const C = 200; // центр viewBox 400×400
const R_DIAMOND = 150; // вершины личного ромба
const R_ROD = 150; // вершины родового квадрата (по диагоналям)
const R_INNER = 86; // промежуточные точки каналов/хвоста

export function buildNodes(core: MatrixCore): OctagramNode[] {
  const rodOffset = R_ROD / Math.SQRT2 as number;
  return [
    // Личный ромб (диагональный квадрат)
    { id: 'a', value: core.a, x: C - R_DIAMOND, y: C, r: 19, zones: ['personal'], label: { ru: 'День — визитная карточка', en: 'Day — calling card' } },
    { id: 'b', value: core.b, x: C, y: C - R_DIAMOND, r: 19, zones: ['personal', 'purpose'], label: { ru: 'Месяц — таланты', en: 'Month — talents' } },
    { id: 'c', value: core.c, x: C + R_DIAMOND, y: C, r: 19, zones: ['personal', 'money'], label: { ru: 'Год — материальная карма', en: 'Year — material karma' } },
    { id: 'd', value: core.d, x: C, y: C + R_DIAMOND, r: 19, zones: ['personal', 'karma'], label: { ru: 'Кармическое основание', en: 'Karmic base' } },
    { id: 'e', value: core.e, x: C, y: C, r: 24, zones: ['personal', 'purpose'], label: { ru: 'Центр — зона комфорта', en: 'Center — comfort zone' } },
    // Родовой квадрат
    { id: 'rodTL', value: core.rodTL, x: C - rodOffset, y: C - rodOffset, r: 15, zones: ['rod'], label: { ru: 'Род: отцовская линия I', en: 'Ancestry: paternal I' } },
    { id: 'rodTR', value: core.rodTR, x: C + rodOffset, y: C - rodOffset, r: 15, zones: ['rod'], label: { ru: 'Род: материнская линия I', en: 'Ancestry: maternal I' } },
    { id: 'rodBR', value: core.rodBR, x: C + rodOffset, y: C + rodOffset, r: 15, zones: ['rod', 'money'], label: { ru: 'Род: отцовская линия II', en: 'Ancestry: paternal II' } },
    { id: 'rodBL', value: core.rodBL, x: C - rodOffset, y: C + rodOffset, r: 15, zones: ['rod', 'love'], label: { ru: 'Род: материнская линия II', en: 'Ancestry: maternal II' } },
    // Каналы и хвост (внутренний пояс)
    { id: 'moneyEntry', value: core.moneyEntry, x: C + R_INNER * 0.72, y: C + R_INNER * 0.72, r: 13, zones: ['money'], label: { ru: 'Вход в деньги', en: 'Money entry' } },
    { id: 'loveEntry', value: core.loveEntry, x: C - R_INNER * 0.72, y: C + R_INNER * 0.72, r: 13, zones: ['love'], label: { ru: 'Вход в отношения', en: 'Love entry' } },
    { id: 'tailR', value: core.tailR, x: C, y: C + R_INNER, r: 12, zones: ['karma'], label: { ru: 'Кармический хвост II', en: 'Karmic tail II' } },
    { id: 'tailS', value: core.tailS, x: C, y: C + R_INNER * 0.55, r: 12, zones: ['karma'], label: { ru: 'Кармический хвост III', en: 'Karmic tail III' } },
    // Небо/Земля на осях
    { id: 'sky', value: core.sky, x: C, y: C - R_INNER * 0.62, r: 12, zones: ['purpose'], label: { ru: 'Линия Неба', en: 'Sky line' } },
    { id: 'earth', value: core.earth, x: C - R_INNER * 0.62, y: C, r: 12, zones: ['purpose', 'money'], label: { ru: 'Линия Земли', en: 'Earth line' } },
  ];
}

const IRIS = 'hsl(252 85% 72%)';
const GOLD = 'hsl(41 78% 66%)';
const LOVE = 'hsl(330 70% 70%)';
const INKMUTE = 'hsl(230 15% 60%)';

export function MatrixOctagram({
  core,
  zone,
  onNodeTap,
  activeNodeId,
}: {
  core: MatrixCore;
  zone: MatrixZone;
  onNodeTap: (node: OctagramNode) => void;
  activeNodeId?: string | null;
}) {
  const nodes = useMemo(() => buildNodes(core), [core]);
  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  const dim = (zones: MatrixZone[]) => zone !== 'all' && !zones.includes(zone);
  const nodeOpacity = (n: OctagramNode) => (dim(n.zones) ? 0.22 : 1);

  // «Дыхание» линий: каждая линия живёт в своём ритме — длительности взаимно простые,
  // фазы разные, кривая с несколькими неравными пиками → переливается хаотично, но плавно.
  let breathIdx = 0;
  const BREATH_DURATIONS = [7.3, 9.1, 11.7, 8.3, 10.9, 6.7, 12.5, 9.7, 7.9, 11.1, 8.9, 10.3, 7.1, 12.1];
  const breathParams = () => {
    const i = breathIdx++;
    const dur = BREATH_DURATIONS[i % BREATH_DURATIONS.length];
    const delay = -((i * 3.37) % dur); // отрицательная задержка = старт с разных фаз
    const variant = i % 3; // три разных кривых
    return { dur, delay, variant };
  };

  const line = (id1: string, id2: string, stroke: string, zones: MatrixZone[], w = 1.4, dash?: string) => {
    const p1 = byId(id1);
    const p2 = byId(id2);
    const b = breathParams();
    return (
      <g key={`${id1}-${id2}`}>
        {!dim(zones) && (
          <>
            <line
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={stroke} strokeWidth={w + 9} strokeLinecap="round"
              filter="url(#mxGlow)"
              className={`mx-breath mx-breath-${b.variant}`}
              style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
            />
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={w + 4} opacity={0.14} />
          </>
        )}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={stroke}
        strokeWidth={w}
        strokeDasharray={dash}
        opacity={dim(zones) ? 0.12 : 0.8}
        className="matrix-draw"
      />
      </g>
    );
  };

  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Октаграмма матрицы судьбы" className="w-full max-w-[420px] mx-auto select-none">
      <defs>
        <filter id="mxGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      <style>{`
        .matrix-draw { stroke-dasharray: 500; stroke-dashoffset: 500; animation: matrixDraw 1.1s ease-out forwards; }
        @keyframes matrixDraw { to { stroke-dashoffset: 0; } }
        .mx-breath { opacity: 0; animation-name: mxBreath0; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .mx-breath-1 { animation-name: mxBreath1; }
        .mx-breath-2 { animation-name: mxBreath2; }
        @keyframes mxBreath0 { 0%,100% { opacity: .03 } 23% { opacity: .22 } 41% { opacity: .07 } 58% { opacity: .30 } 79% { opacity: .05 } }
        @keyframes mxBreath1 { 0%,100% { opacity: .04 } 17% { opacity: .12 } 36% { opacity: .28 } 52% { opacity: .06 } 71% { opacity: .18 } 88% { opacity: .09 } }
        @keyframes mxBreath2 { 0%,100% { opacity: .02 } 31% { opacity: .26 } 47% { opacity: .10 } 63% { opacity: .16 } 84% { opacity: .32 } }
        @media (prefers-reduced-motion: reduce) { .mx-breath { animation: none !important; opacity: .08; } }
        .matrix-node { cursor: pointer; transition: opacity .25s ease; }
        .matrix-node-active circle:first-of-type { animation: matrixPulse 1.6s ease-in-out infinite; }
        @keyframes matrixPulse { 0%,100% { stroke-width: 2 } 50% { stroke-width: 4 } }
      `}</style>

      {/* Родовой квадрат */}
      {line('rodTL', 'rodTR', GOLD, ['rod'])}
      {line('rodTR', 'rodBR', GOLD, ['rod'])}
      {line('rodBR', 'rodBL', GOLD, ['rod'])}
      {line('rodBL', 'rodTL', GOLD, ['rod'])}
      {/* Личный ромб */}
      {line('a', 'b', IRIS, ['personal'])}
      {line('b', 'c', IRIS, ['personal'])}
      {line('c', 'd', IRIS, ['personal'])}
      {line('d', 'a', IRIS, ['personal'])}
      {/* Оси: Небо (вертикаль) и Земля (горизонталь) */}
      {line('b', 'd', IRIS, ['purpose', 'karma'], 1, '3 4')}
      {line('a', 'c', GOLD, ['purpose', 'money'], 1, '3 4')}
      {/* Каналы */}
      {line('e', 'moneyEntry', GOLD, ['money'], 1.8)}
      {line('moneyEntry', 'rodBR', GOLD, ['money'], 1.8)}
      {line('e', 'loveEntry', LOVE, ['love'], 1.8)}
      {line('loveEntry', 'rodBL', LOVE, ['love'], 1.8)}

      {/* Узлы */}
      {nodes.map((n) => {
        const active = activeNodeId === n.id;
        const strokeColor = n.zones.includes('rod')
          ? GOLD
          : n.zones.includes('love')
            ? LOVE
            : n.id === 'e' || n.zones.includes('personal')
              ? IRIS
              : INKMUTE;
        return (
          <g
            key={n.id}
            className={`matrix-node ${active ? 'matrix-node-active' : ''}`}
            opacity={nodeOpacity(n)}
            onClick={() => onNodeTap(n)}
            role="button"
            aria-label={`${n.label.ru}: аркан ${n.value}`}
          >
            <circle cx={n.x} cy={n.y} r={n.r + 1.5} fill="none" stroke={strokeColor} strokeWidth={active ? 6 : 4.5} opacity={active ? 0.75 : 0.55} filter="url(#mxGlow)" />
            <circle cx={n.x} cy={n.y} r={n.r} fill="hsl(232 20% 10%)" stroke={strokeColor} strokeWidth={active ? 3 : 2} />
            <circle cx={n.x} cy={n.y} r={n.r + 4} fill="transparent" />
            <text
              x={n.x}
              y={n.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={n.r >= 19 ? 15 : 12}
              fontWeight={700}
              fill={strokeColor}
            >
              {n.value}
            </text>
          </g>
        );
      })}

      {/* Возрастные метки контура */}
      {core.ageDecades.map((p, i) => {
        const angle = Math.PI - (i * Math.PI) / 4; // A слева, по часовой
        const x = C + Math.cos(angle) * (R_DIAMOND + 31) * (i % 2 === 0 ? 1 : 0.98);
        const y = C - Math.sin(angle) * (R_DIAMOND + 31) * (i % 2 === 0 ? 1 : 0.98);
        return (
          <text key={p.age} x={x} y={y} textAnchor="middle" fontSize={10} fontWeight={600} fill="hsl(229 14% 74%)" opacity={zone === 'all' ? 0.95 : 0.25}>
            {p.age}
          </text>
        );
      })}
    </svg>
  );
}
