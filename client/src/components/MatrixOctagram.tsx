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

  const line = (id1: string, id2: string, stroke: string, zones: MatrixZone[], w = 1.4, dash?: string) => {
    const p1 = byId(id1);
    const p2 = byId(id2);
    return (
      <line
        key={`${id1}-${id2}`}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={stroke}
        strokeWidth={w}
        strokeDasharray={dash}
        opacity={dim(zones) ? 0.12 : 0.55}
        className="matrix-draw"
      />
    );
  };

  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Октаграмма матрицы судьбы" className="w-full max-w-[420px] mx-auto select-none">
      <style>{`
        .matrix-draw { stroke-dasharray: 500; stroke-dashoffset: 500; animation: matrixDraw 1.1s ease-out forwards; }
        @keyframes matrixDraw { to { stroke-dashoffset: 0; } }
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
        const x = C + Math.cos(angle) * (R_DIAMOND + 26) * (i % 2 === 0 ? 1 : 0.98);
        const y = C - Math.sin(angle) * (R_DIAMOND + 26) * (i % 2 === 0 ? 1 : 0.98);
        return (
          <text key={p.age} x={x} y={y} textAnchor="middle" fontSize={9} fill={INKMUTE} opacity={zone === 'all' ? 0.8 : 0.25}>
            {p.age}
          </text>
        );
      })}
    </svg>
  );
}
