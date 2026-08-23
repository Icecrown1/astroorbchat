import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Crown } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { useLocation } from 'wouter';
import { useTranslation } from '@/contexts/LocaleContext';

interface LowEnergyAlertProps {
  className?: string;
}

export function LowEnergyAlert({ className }: LowEnergyAlertProps) {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  return (
    <Alert className={className} data-testid="alert-low-energy">
      <OrbIcon className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          {t.energy.lowEnergyMessage}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/buy-energy')}
            data-testid="button-buy-energy"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t.energy.buyEnergy}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setLocation('/subscribe')}
            data-testid="button-subscribe"
          >
            <Crown className="w-4 h-4 mr-2" />
            {t.energy.subscribe}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
