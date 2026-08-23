import { haptic } from '@/lib/haptics';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowRight, Lock } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { useState, cloneElement, isValidElement } from 'react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  energyCost: number;
  onClick: () => void;
  disabled?: boolean;
  locked?: boolean;  // True when feature requires subscription upgrade
  premiumOnly?: boolean;  // True when feature requires Premium tier specifically
  className?: string;
  art?: React.ReactNode;
  locale?: 'ru' | 'en';
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  energyCost,
  onClick,
  disabled = false,
  locked = false,
  premiumOnly = false,
  className,
  art,
  locale = 'en',
}: FeatureCardProps) {
  const [pressed, setPressed] = useState(false);
  const isBlocked = locked || premiumOnly;
  
  return (
    <Card
      className={cn(
        'relative p-6 transition-all tap-scale',
        isBlocked ? 'cursor-pointer hover-elevate active-elevate-2 opacity-95' : 'cursor-pointer hover-elevate active-elevate-2',
        disabled && !isBlocked && 'opacity-60 cursor-not-allowed',
        className
      )}
      onClick={disabled ? undefined : () => { haptic.impact(isBlocked ? 'medium' : 'light'); onClick(); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {isBlocked && (
        <div className="absolute top-4 left-4">
          <Lock className="w-5 h-5 text-[hsl(41,81%,68%)]" />
        </div>
      )}
      
      <div className="flex items-start gap-4">
        {art ? (
          <div className="shrink-0">{isValidElement(art) ? cloneElement(art as any, { active: pressed }) : art}</div>
        ) : (
        <div className={cn(
          "p-3 rounded-lg",
          "bg-primary/10"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            "text-primary"
          )} />
        </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className={cn(
              "text-lg font-semibold",
              "text-card-foreground"
            )}>
              {title}
            </h3>
            {premiumOnly && (
              <Badge variant="outline" className="shrink-0 border-yellow-500/50 text-yellow-600">
                Premium
              </Badge>
            )}
            {!premiumOnly && energyCost > 0 && (
              <Badge variant={locked ? "outline" : "secondary"} className="shrink-0">
                <OrbIcon className="w-3 h-3 mr-1 text-[hsl(41,81%,68%)]" />
                {energyCost % 1 === 0 ? energyCost : energyCost.toFixed(1)}
              </Badge>
            )}
            {!premiumOnly && energyCost === 0 && (
              <Badge variant="default" className="shrink-0 bg-green-600 no-default-hover-elevate no-default-active-elevate">
                {locale === 'ru' ? 'Бесплатно' : 'Free'}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {description}
          </p>
          
          <div className={cn(
            "flex items-center text-sm font-medium",
            "text-primary"
          )}>
            {premiumOnly
              ? (locale === 'ru' ? 'Только Премиум' : 'Premium only')
              : locked 
                ? (locale === 'ru' ? 'Нужна подписка' : 'Subscription required')
                : (locale === 'ru' ? 'Открыть' : 'Explore')}
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </Card>
  );
}

