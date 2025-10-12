import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { EnergyBadge } from '@/components/EnergyBadge';
import { FeatureCard } from '@/components/FeatureCard';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/store/useAuth';
import { useEnergy } from '@/store/useEnergy';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest } from '@/lib/queryClient';
import {
  Sparkles,
  Moon,
  Sun,
  Heart,
  MessageCircle,
  ShoppingBag,
  CreditCard,
  Users,
  Settings as SettingsIcon,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';


export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { energy, setEnergy, setResetAt } = useEnergy();
  const { t } = useTranslation();

  const FEATURES = [
    {
      icon: Moon,
      title: t.dashboard.natalChart,
      description: t.dashboard.natalChartDesc,
      energyCost: 2,
      path: '/natal-chart',
    },
    {
      icon: Sun,
      title: t.dashboard.solarReturn,
      description: t.dashboard.solarReturnDesc,
      energyCost: 1,
      path: '/solar-today',
    },
    {
      icon: Sparkles,
      title: t.dashboard.horoscope,
      description: t.dashboard.horoscopeDesc,
      energyCost: 1,
      path: '/horoscope',
    },
    {
      icon: Heart,
      title: t.dashboard.compatibility,
      description: t.dashboard.compatibilityDesc,
      energyCost: 2,
      path: '/compatibility',
    },
    {
      icon: MessageCircle,
      title: t.dashboard.askOracle,
      description: t.dashboard.askOracleDesc,
      energyCost: 1,
      path: '/ask',
    },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['/api/user/me'],
  });

  useEffect(() => {
    if (data?.ok && data.data) {
      setEnergy(data.data.energy);
      setResetAt(new Date(data.data.energyResetAt));
    }
  }, [data, setEnergy, setResetAt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Cosmic Background Effect */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-primary/20 via-chart-2/10 to-transparent blur-3xl opacity-30" />
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
              {user?.name ? t.auth.welcome.replace('{name}', user.name) : t.auth.welcomeDefault}
            </h1>
            <p className="text-muted-foreground">
              {t.dashboard.subtitle}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            data-testid="button-settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Energy Badge */}
        <div className="flex justify-center mb-8">
          <EnergyBadge />
        </div>

        {/* Feature Cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.path}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              energyCost={feature.energyCost}
              onClick={() => navigate(feature.path)}
              disabled={energy < feature.energyCost}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/buy-energy')}
            data-testid="button-buy-energy"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            {t.nav.buyEnergy}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/subscribe')}
            data-testid="button-subscribe"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {t.nav.subscribe}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/referral')}
            data-testid="button-referral"
          >
            <Users className="w-4 h-4 mr-2" />
            {t.nav.referral}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/payment-history')}
            data-testid="button-payment-history"
          >
            <Receipt className="w-4 h-4 mr-2" />
            {t.nav.paymentHistory}
          </Button>
        </div>
      </div>
    </div>
  );
}
