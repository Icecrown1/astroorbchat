/** Line-art виньетки карточек фич: тонкий штрих + фирменные акценты (вместо иконок в квадратах). */
const IRIS = 'hsl(252 100% 74%)';
const GOLD = 'hsl(41 81% 68%)';

export type VignetteKind = 'natal' | 'guest' | 'matrix' | 'solar' | 'horoscope' | 'compat' | 'oracle';

const KIND_ANIM: Record<VignetteKind, string> = {
  natal: 'vg-spin-slow',
  guest: 'vg-pulse',
  matrix: 'vg-turn45',
  solar: 'vg-spin',
  horoscope: 'vg-swing',
  compat: 'vg-beat',
  oracle: 'vg-wobble',
};

export function FeatureVignette({ kind, active = false }: { kind: VignetteKind; active?: boolean }) {
  const common = { fill: 'none', strokeWidth: 1.4, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 48 48" className={`w-12 h-12 shrink-0 vg ${active ? KIND_ANIM[kind] : ''}`} aria-hidden="true">
      {kind === 'natal' && (<g {...common}>
        <circle cx="24" cy="24" r="17" stroke={IRIS} />
        <circle cx="24" cy="24" r="10.5" stroke={IRIS} opacity="0.5" />
        <path d="M24 7v6M24 35v6M7 24h6M35 24h6" stroke={GOLD} opacity="0.8" />
        <circle cx="30" cy="17" r="2.4" stroke={GOLD} />
        <circle cx="17" cy="28" r="2" stroke={IRIS} />
        <path d="M30 17L17 28" stroke={IRIS} opacity="0.6" />
      </g>)}
      {kind === 'guest' && (<g {...common}>
        <circle cx="19" cy="24" r="12" stroke={IRIS} />
        <circle cx="30" cy="24" r="12" stroke={GOLD} opacity="0.85" />
        <circle cx="19" cy="24" r="1.6" fill={IRIS} stroke="none" />
        <circle cx="30" cy="24" r="1.6" fill={GOLD} stroke="none" />
      </g>)}
      {kind === 'matrix' && (<g {...common}>
        <rect x="12" y="12" width="24" height="24" stroke={GOLD} opacity="0.85" />
        <rect x="12" y="12" width="24" height="24" stroke={IRIS} transform="rotate(45 24 24)" />
        <circle cx="24" cy="24" r="3.4" stroke={IRIS} />
      </g>)}
      {kind === 'solar' && (<g {...common}>
        <circle cx="24" cy="24" r="8.5" stroke={GOLD} />
        <circle cx="24" cy="24" r="2" fill={GOLD} stroke="none" />
        <path d="M24 8v5M24 35v5M8 24h5M35 24h5M12.7 12.7l3.5 3.5M31.8 31.8l3.5 3.5M35.3 12.7l-3.5 3.5M16.2 31.8l-3.5 3.5" stroke={GOLD} opacity="0.85" />
      </g>)}
      {kind === 'horoscope' && (<g {...common}>
        <path d="M30 9a15 15 0 1 0 9 27A17 17 0 0 1 30 9z" stroke={IRIS} />
        <path d="M14 15l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill={GOLD} stroke="none" />
      </g>)}
      {kind === 'compat' && (<g {...common}>
        <path d="M19 32c-5-4-9-7.4-9-11.6C10 17 12.6 15 15.4 15c1.9 0 3.1.9 3.6 2 .5-1.1 1.7-2 3.6-2 2.8 0 5.4 2 5.4 5.4 0 4.2-4 7.6-9 11.6z" stroke={IRIS} />
        <path d="M32 30c-3.4-2.7-6-5-6-7.8 0-2.3 1.7-3.6 3.6-3.6 1.2 0 2 .6 2.4 1.3.4-.7 1.2-1.3 2.4-1.3 1.9 0 3.6 1.3 3.6 3.6 0 2.8-2.6 5.1-6 7.8z" stroke={GOLD} opacity="0.85" />
      </g>)}
      {kind === 'oracle' && (<g {...common}>
        <path d="M10 14h24a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H22l-7 6v-6h-5a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z" stroke={IRIS} />
        <path d="M24 18l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill={GOLD} stroke="none" />
      </g>)}
    </svg>
  );
}
