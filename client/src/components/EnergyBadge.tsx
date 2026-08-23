import { Lock, Crown } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
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
          icon: OrbIcon,
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
        'inline-flex items-center gap-3 px-5 py-3 rounded-full border border-[hsl(252,60%,40%)] bg-[linear-gradient(135deg,hsl(252,45%,16%),hsl(232,30%,12%))] shadow-[0_0_24px_rgba(142,123,255,0.25)]',
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
