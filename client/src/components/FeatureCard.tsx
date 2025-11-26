import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowRight, Lock } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  energyCost: number;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  locale?: 'ru' | 'en';
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  energyCost,
  onClick,
  disabled = false,
  className,
  locale = 'en',
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        'relative p-6 cursor-pointer transition-all',
        'hover-elevate active-elevate-2',
        disabled && 'opacity-60 cursor-not-allowed grayscale',
        className
      )}
      onClick={disabled ? undefined : onClick}
      data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {disabled && (
        <div className="absolute top-4 left-4">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-lg font-semibold text-card-foreground">
              {title}
            </h3>
            <Badge variant="secondary" className="shrink-0">
              <Sparkles className="w-3 h-3 mr-1" />
              {energyCost}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {description}
          </p>
          
          <div className="flex items-center text-sm text-primary font-medium">
            {locale === 'ru' ? 'Открыть' : 'Explore'}
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}
