import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loader({ className, size = 'md' }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'relative',
          sizeClasses[size]
        )}
        data-testid="loader-spinner"
      >
        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 animate-pulse"></div>
      </div>
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader size="lg" />
        <p className="mt-4 text-muted-foreground">Loading cosmic data...</p>
      </div>
    </div>
  );
}
