import { Sparkles } from 'lucide-react';
import { useEnergy } from '@/store/useEnergy';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';

export function EnergyBadge({ className }: { className?: string }) {
  const { energy, resetAt } = useEnergy();
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');

  useEffect(() => {
    if (!resetAt) return;

    const updateTimer = () => {
      const now = dayjs();
      const reset = dayjs(resetAt);
      const diff = reset.diff(now);

      if (diff <= 0) {
        setTimeUntilReset('Resetting...');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [resetAt]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'bg-gradient-to-r from-chart-1 to-chart-2',
        'shadow-lg shadow-primary/20',
        className
      )}
      data-testid="badge-energy"
    >
      <Sparkles className="w-5 h-5 text-white animate-pulse" />
      <div className="flex flex-col">
        <span className="font-mono text-2xl font-bold text-white tabular-nums">
          {energy}
        </span>
        {timeUntilReset && (
          <span className="text-xs text-white/80 font-medium">
            Reset: {timeUntilReset}
          </span>
        )}
      </div>
    </div>
  );
}
