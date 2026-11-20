import { useLocation } from 'wouter';
import { Gift, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/contexts/LocaleContext';
import { haptic } from '@/lib/haptics';

/**
 * Пробный доступ по акции («50 звёзд всем»): что попробовать и до какого числа.
 * Показывается только тем, у кого нет оплаченного Premium и действует trial_access_until.
 */
export function TrialBanner({ trialUntil, orbs, billingTier }: { trialUntil?: string | null; orbs: number; billingTier?: string }) {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const [, navigate] = useLocation();
  if (!trialUntil || billingTier === 'premium' || new Date(trialUntil) <= new Date()) return null;

  const until = new Date(trialUntil).toLocaleDateString(ru ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' });
  const items = [
    { path: '/compatibility', ru: 'Совместимость', en: 'Compatibility', cost: 20 },
    { path: '/horoscope', ru: 'Гороскоп на месяц', en: 'Monthly horoscope', cost: 15 },
    { path: '/solar-today', ru: 'Соляр', en: 'Solar return', cost: 15 },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-[hsl(var(--solar-gold))]/35 bg-[hsl(var(--solar-gold))]/[0.07] p-4" data-testid="banner-trial">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--solar-gold))]/15">
          <Gift className="h-6 w-6 text-[hsl(var(--solar-gold))]" />
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold leading-tight">
            {ru ? `Пробный доступ до ${until}` : `Trial access until ${until}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ru
              ? `На балансе ${orbs} звёзд — открыты все функции, включая Premium. Попробуйте:`
              : `You have ${orbs} stars — every feature is open, Premium included. Try:`}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((it) => (
          <button
            key={it.path}
            type="button"
            className="flex min-h-[44px] items-center justify-between rounded-xl border border-border bg-card/60 px-3 text-left text-sm tap-scale"
            onClick={() => { haptic.impact('light'); navigate(it.path); }}
            data-testid={`trial-try-${it.path.slice(1)}`}
          >
            <span>{ru ? it.ru : it.en}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {it.cost} {ru ? 'звёзд' : 'stars'}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
