import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Gift, X } from 'lucide-react';
import { useTranslation } from '@/contexts/LocaleContext';
import { haptic } from '@/lib/haptics';

/**
 * Плавающая кнопка-уведомление «Первый месяц −50%» на главном экране.
 * Видна только тем, у кого есть право на акцию (решает сервер: /api/offers/first-month).
 * Крестик прячет кнопку на сутки; тап ведёт на /subscribe?offer=first_month (выбран месячный период).
 */

export interface FirstMonthOfferData {
  eligible: boolean;
  discountPct?: number;
  standard?: { full: number; promo: number };
  premium?: { full: number; promo: number };
}

export function useFirstMonthOffer(enabled = true) {
  const { data } = useQuery<{ ok: boolean; data: FirstMonthOfferData }>({
    queryKey: ['/api/offers/first-month'],
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return data?.data?.eligible ? data.data : null;
}

const HIDE_KEY = 'astro_offer_first_month_hidden_until';

function hiddenNow(): boolean {
  try {
    return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

export function FirstMonthOfferButton({ enabled }: { enabled: boolean }) {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const [, navigate] = useLocation();
  const offer = useFirstMonthOffer(enabled);
  const [show, setShow] = useState(false);

  // «Вылезает» через секунду после открытия главного — не перекрывает первую отрисовку
  useEffect(() => {
    if (!offer || hiddenNow()) return;
    const t = setTimeout(() => {
      setShow(true);
      haptic.notify('success');
    }, 1000);
    return () => clearTimeout(t);
  }, [!!offer]);

  if (!offer || !show) return null;

  const pct = offer.discountPct ?? 50;
  const std = offer.standard;

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch { /* noop */ }
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="offer-pop pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/40 bg-card/95 p-3 pr-2 backdrop-blur-md">
        <button
          type="button"
          className="flex flex-1 items-center gap-3 text-left tap-scale"
          onClick={() => {
            haptic.impact('medium');
            navigate('/subscribe?offer=first_month');
          }}
          data-testid="button-offer-first-month"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--solar-gold))]/15">
            <Gift className="offer-gift h-6 w-6 text-[hsl(var(--solar-gold))]" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="offer-ping absolute inline-flex h-full w-full rounded-full bg-primary" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-card bg-primary" />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-bold leading-tight">
              {ru ? `Первый месяц −${pct}%` : `First month ${pct}% off`}
            </span>
            {std && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {ru ? (
                  <>Standard за <span className="font-semibold text-[hsl(var(--solar-gold))]">{std.promo} ⭐</span> вместо <span className="line-through">{std.full} ⭐</span></>
                ) : (
                  <>Standard for <span className="font-semibold text-[hsl(var(--solar-gold))]">{std.promo} ⭐</span> instead of <span className="line-through">{std.full} ⭐</span></>
                )}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={hide}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={ru ? 'Скрыть' : 'Hide'}
          data-testid="button-offer-first-month-hide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
