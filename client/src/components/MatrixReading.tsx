import { arcanaMetaByN, arcanaCardId } from '@shared/matrixArcanaMeta';
import { parseReadingV2, type SectionReadingV2, type PairReadingV2 } from '@shared/matrix';

/**
 * Отрисовка разборов Матрицы судьбы.
 * v2 — структурированный JSON: для каждого аркана «В плюсе» / «В минусе» + шаги.
 * Старые разборы (простой текст) показываются как есть.
 */

const labels = (ru: boolean) => ({
  plus: ru ? 'В плюсе' : 'At its best',
  minus: ru ? 'В минусе' : 'At its worst',
  steps: ru ? 'Что сделать в ближайший месяц' : 'What to do this month',
});

const arcanaName = (n: number, ru: boolean) => {
  const m = arcanaMetaByN(n);
  return m ? (ru ? m.ru : m.en) : '';
};

function PlusMinus({ plus, minus, ru }: { plus: string; minus: string; ru: boolean }) {
  const t = labels(ru);
  return (
    <div className="mt-3 space-y-2.5">
      <div className="rounded-xl border-l-2 border-emerald-500/70 bg-emerald-500/[0.06] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">＋ {t.plus}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{plus}</p>
      </div>
      <div className="rounded-xl border-l-2 border-rose-500/70 bg-rose-500/[0.06] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">－ {t.minus}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{minus}</p>
      </div>
    </div>
  );
}

function Steps({ steps, ru }: { steps: string[]; ru: boolean }) {
  if (!steps?.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{labels(ru).steps}</p>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
            <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ArcanaHeader({ n, role, ru, onCardZoom }: { n: number; role?: string; ru: boolean; onCardZoom?: (cardId: string) => void }) {
  const cid = arcanaCardId(n);
  return (
    <div className="flex items-center gap-3">
      {cid ? (
        <button
          type="button"
          className="w-10 shrink-0 overflow-hidden rounded-md border border-[hsl(41,50%,40%)]/50"
          onClick={(e) => { e.stopPropagation(); onCardZoom?.(cid); }}
          aria-label={ru ? 'Увеличить карту' : 'Enlarge the card'}
        >
          <img src={`/tarot/${cid}.webp`} alt="" className="h-auto w-full" loading="lazy" />
        </button>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary font-bold text-primary">{n}</span>
      )}
      <div className="min-w-0">
        <p className="font-display font-semibold leading-tight">{n} · {arcanaName(n, ru)}</p>
        {role && <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>}
      </div>
    </div>
  );
}

function SectionView({ r, ru, onCardZoom }: { r: SectionReadingV2; ru: boolean; onCardZoom?: (cardId: string) => void }) {
  return (
    <div className="mt-3">
      {r.summary && <p className="text-sm font-medium leading-relaxed text-foreground">{r.summary}</p>}
      <div className="mt-2 divide-y divide-border/60">
        {r.items.map((it, i) => (
          <div key={i} className="py-4 first:pt-3 last:pb-1">
            <ArcanaHeader n={it.arcana} role={it.role} ru={ru} onCardZoom={onCardZoom} />
            <PlusMinus plus={it.plus} minus={it.minus} ru={ru} />
          </div>
        ))}
      </div>
      <Steps steps={r.steps} ru={ru} />
    </div>
  );
}

export function PairReadingView({ r, ru, onCardZoom }: { r: PairReadingV2; ru: boolean; onCardZoom?: (cardId: string) => void }) {
  return (
    <div>
      {r.summary && <p className="text-sm font-medium leading-relaxed text-foreground">{r.summary}</p>}
      <div className="mt-2 divide-y divide-border/60">
        {r.zones.map((z) => (
          <div key={z.id} className="py-4 last:pb-1">
            <p className="font-display text-base font-semibold">{z.title}</p>
            <ul className="mt-2 space-y-1.5">
              {z.arcana.map((n, i) => {
                const cid = arcanaCardId(n);
                return (
                  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <button
                      type="button"
                      disabled={!cid}
                      onClick={() => cid && onCardZoom?.(cid)}
                      className="flex h-7 min-w-[28px] items-center justify-center rounded-full border border-primary/60 px-1.5 text-[12px] font-semibold text-primary"
                      aria-label={arcanaName(n, ru)}
                    >
                      {n}
                    </button>
                    <span>
                      <span className="text-foreground/90">{arcanaName(n, ru)}</span>
                      {z.roles[i] ? ` · ${z.roles[i]}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
            <PlusMinus plus={z.plus} minus={z.minus} ru={ru} />
          </div>
        ))}
      </div>
      <Steps steps={r.steps} ru={ru} />
    </div>
  );
}

/** Разбор секции: v2 → структурно, старый формат → простой текст. */
export function MatrixReading({ content, ru, onCardZoom }: { content: string; ru: boolean; onCardZoom?: (cardId: string) => void }) {
  const r = parseReadingV2(content);
  if (r?.kind === 'section') return <SectionView r={r} ru={ru} onCardZoom={onCardZoom} />;
  if (r?.kind === 'pair') return <div className="mt-3"><PairReadingView r={r} ru={ru} onCardZoom={onCardZoom} /></div>;
  return <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{content}</p>;
}

/** Текст для шаринга/копирования (без разметки). */
export function readingToText(content: string, ru: boolean): string {
  const r = parseReadingV2(content);
  if (!r) return content;
  const t = labels(ru);
  const parts: string[] = [];
  if (r.summary) parts.push(r.summary);
  if (r.kind === 'section') {
    for (const it of r.items) {
      parts.push(`✦ ${it.arcana} · ${arcanaName(it.arcana, ru)}${it.role ? ` — ${it.role}` : ''}\n＋ ${t.plus}: ${it.plus}\n－ ${t.minus}: ${it.minus}`);
    }
  } else {
    for (const z of r.zones) {
      parts.push(`✦ ${z.title} (${z.arcana.join('-')})\n＋ ${t.plus}: ${z.plus}\n－ ${t.minus}: ${z.minus}`);
    }
  }
  if (r.steps?.length) parts.push(`${t.steps}:\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  return parts.join('\n\n');
}
