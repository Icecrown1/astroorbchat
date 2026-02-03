import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { EnergyBadge } from '@/components/EnergyBadge';
import { LowEnergyAlert } from '@/components/LowEnergyAlert';
import { FeatureCard } from '@/components/FeatureCard';
import { Loader } from '@/components/Loader';
import { Coachmark } from '@/components/Coachmark';
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
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useMemo } from 'react';
import type { User, Subscription } from '@shared/schema';

interface UserMeResponse {
  ok: boolean;
  data: User & {
    subscription?: Subscription | null;
    natalInitialized?: boolean;
    energy: number;
  };
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { energy, setEnergy, setResetAt } = useEnergy();
  const { t, locale } = useTranslation();

  const FEATURES = [
    {
      icon: Moon,
      title: locale === 'ru' ? 'Моя натальная карта' : 'My Natal Chart',
      description: locale === 'ru' ? 'Ваш космический отпечаток' : 'Your cosmic blueprint',
      energyCost: 0,
      path: '/my-natal-chart',
    },
    {
      icon: Users,
      title: locale === 'ru' ? 'Гостевые карты' : 'Guest Charts',
      description: locale === 'ru' ? 'Карты для друзей и партнёров' : 'Charts for friends and partners',
      energyCost: 2,
      path: '/natal-chart',
    },
    {
      icon: Sun,
      title: t.dashboard.solarReturn,
      description: t.dashboard.solarReturnDesc,
      energyCost: 15,
      path: '/solar-today',
    },
    {
      icon: Sparkles,
      title: t.dashboard.horoscope,
      description: t.dashboard.horoscopeDesc,
      energyCost: 2,
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

  const { data, isLoading } = useQuery<UserMeResponse>({
    queryKey: ['/api/user/me'],
  });

  const { data: referralData } = useQuery<{
    ok: boolean;
    data: {
      referrals: Array<{ createdAt: Date }>;
    };
  }>({
    queryKey: ['/api/referral/code'],
  });

  const hasNewReferrals = useMemo(() => {
    if (!referralData?.ok || !referralData.data.referrals.length) return false;
    
    const lastViewed = localStorage.getItem('lastViewedReferrals');
    if (!lastViewed) return referralData.data.referrals.length > 0;
    
    const lastViewedTime = new Date(lastViewed).getTime();
    return referralData.data.referrals.some(
      r => new Date(r.createdAt).getTime() > lastViewedTime
    );
  }, [referralData]);

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
      {/* Full Palette Gradient Background - AstroOrb */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-palette opacity-20" />
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

        {/* Low Energy Alert */}
        {energy < 10 && (
          <div className="mb-6">
            <LowEnergyAlert />
          </div>
        )}

        {/* Onboarding Coachmark */}
        <Coachmark
          visible={!data?.data?.natalInitialized}
          title={locale === 'ru' ? "Начните своё путешествие" : "Start Your Journey"}
          description={locale === 'ru' 
            ? "Создайте свою натальную карту бесплатно! Это займёт всего минуту и откроет доступ ко всем возможностям Astro Orb."
            : "Create your natal chart for free! It takes just a minute and unlocks all Astro Orb features."}
          buttonText={locale === 'ru' ? "Создать карту" : "Create Chart"}
          onAction={() => navigate('/my-natal-chart')}
          icon={<Moon className="w-6 h-6" />}
        />

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
              disabled={!data?.data?.natalInitialized || energy < feature.energyCost}
              locale={locale}
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
            className="w-full relative"
            onClick={() => navigate('/referral')}
            data-testid="button-referral"
          >
            <Users className="w-4 h-4 mr-2" />
            {t.nav.referral}
            {hasNewReferrals && (
              <Badge 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                data-testid="badge-new-referrals"
              >
                !
              </Badge>
            )}
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
          {user?.isAdmin && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/admin')}
              data-testid="button-admin"
            >
              <Shield className="w-4 h-4 mr-2" />
              {locale === 'ru' ? 'Админ панель' : 'Admin Panel'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
