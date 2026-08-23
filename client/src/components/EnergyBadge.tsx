import { Sparkles, Lock, Crown, Star } from 'lucide-react';
import { useEnergy, SubscriptionTier } from '@/store/useEnergy';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LocaleContext';

interface EnergyBadgeProps {
  className?: string;
}

export function EnergyBadge({ className }: EnergyBadgeProps) {
  const { orbs, maxOrbs, tier, resetAt } = useEnergy();
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  const { locale } = useTranslation();

  useEffect(() => {
    if (!resetAt || tier === 'free') return;

    const updateTimer = () => {
      const now = dayjs();
      const reset = dayjs(resetAt);
      const diff = reset.diff(now);

      if (diff <= 0) {
        setTimeUntilReset(locale === 'ru' ? 'Обновление...' : 'Resetting...');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days > 0) {
        setTimeUntilReset(locale === 'ru' ? `${days}д` : `${days}d`);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeUntilReset(`${hours}h ${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);

    return () => clearInterval(interval);
  }, [resetAt, tier, locale]);

  const getBadgeContent = () => {
    switch (tier) {
      case 'premium':
        return {
          icon: Crown,
          value: orbs.toString(),
          label: locale === 'ru' ? `из ${maxOrbs}` : `of ${maxOrbs}`,
          gradient: 'from-yellow-500 to-amber-600',
          shadowColor: 'shadow-yellow-500/30',
        };
      case 'standard':
        return {
          icon: Star,
          value: orbs.toString(),
          label: locale === 'ru' ? `из ${maxOrbs}` : `of ${maxOrbs}`,
          gradient: 'from-chart-1 to-chart-3',
          shadowColor: 'shadow-primary/20',
        };
      default: // free
        return {
          icon: Lock,
          value: '0',
          label: locale === 'ru' 
            ? 'Оформи подписку или пригласи друга' 
            : 'Subscribe or invite a friend',
          gradient: 'from-muted to-muted-foreground/30',
          shadowColor: 'shadow-none',
          muted: true,
        };
    }
  };

  const content = getBadgeContent();
  const IconComponent = content.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 px-5 py-3 rounded-full',
        `bg-gradient-to-r ${content.gradient}`,
        `shadow-lg ${content.shadowColor}`,
        content.muted && 'opacity-60',
        className
      )}
      data-testid="badge-energy"
    >
      <IconComponent className={cn(
        'w-5 h-5',
        content.muted ? 'text-muted-foreground' : 'text-white',
        tier === 'premium' && 'animate-pulse'
      )} />
      <div className="flex flex-col items-center">
        <span className={cn(
          'font-mono text-2xl font-bold tabular-nums flex items-center gap-1',
          content.muted ? 'text-muted-foreground' : 'text-white'
        )}>
          {content.value}
          {tier !== 'free' && (
            <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true"><path d="M8 0l1.6 4.9L14.9 3 11.4 6.9 16 8l-4.6 1.1 3.5 3.9-5.3-1.9L8 16l-1.6-4.9L1.1 13l3.5-3.9L0 8l4.6-1.1L1.1 3l5.3 1.9L8 0z" fill="currentColor" opacity="0.9"/></svg>
          )}
        </span>
        <span className={cn(
          'text-xs font-medium text-center max-w-[180px]',
          content.muted ? 'text-muted-foreground' : 'text-white/80'
        )}>
          {content.label}
        </span>
        {(tier === 'standard' || tier === 'premium') && timeUntilReset && (
          <span className="text-[10px] text-white/60 font-medium mt-0.5">
            {locale === 'ru' ? 'Сброс:' : 'Reset:'} {timeUntilReset}
          </span>
        )}
      </div>
    </div>
  );
}
