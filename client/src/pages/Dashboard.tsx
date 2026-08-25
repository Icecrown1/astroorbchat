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
  Moon,
  Sun,
  Heart,
  MessageCircle,
  CreditCard,
  Users,
  Settings as SettingsIcon,
  Receipt,
  Shield,
  Hexagon, MoonStar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useMemo } from 'react';
import type { User, Subscription } from '@shared/schema';
import { haptic } from '@/lib/haptics';
import { FeatureVignette, type VignetteKind } from '@/components/FeatureVignette';

const VIGNETTES: Record<string, VignetteKind> = {
  '/my-natal-chart': 'natal',
  '/natal-chart': 'guest',
  '/matrix': 'matrix',
  '/solar-today': 'solar',
  '/horoscope': 'horoscope',
  '/compatibility': 'compat',
  '/ask': 'oracle',
};

// Фаза Луны без запросов: синодический цикл от эталонного новолуния
function moonPhaseLine(locale: string): string {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14); // новолуние 06.01.2000
  const days = ((Date.now() - ref) / 86400000) % synodic;
  const ru = ['Новолуние', 'Растущий серп', 'Первая четверть', 'Растущая Луна', 'Полнолуние', 'Убывающая Луна', 'Последняя четверть', 'Старый серп'];
  const en = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const idx = Math.floor(((days + synodic / 16) % synodic) / (synodic / 8));
  const name = (locale === 'ru' ? ru : en)[idx];
  return locale === 'ru' ? ('Сегодня: ' + name.toLowerCase()) : ('Today: ' + name);
}


interface UserMeResponse {
  ok: boolean;
  data: User & {
    subscription?: Subscription | null;
    natalInitialized?: boolean;
    energy: number;
    orbs?: number;
    maxOrbs?: number;
    tier?: 'free' | 'standard' | 'premium';
    orbsResetAt?: string;
  };
}

export default function Dashboard() {
  const [, navigate] = useLocation();

  // Дип-линк с сайта: start=web_matrix_* открывает матрицу сразу
  useEffect(() => {
    try {
      const sp = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param
        || new URLSearchParams(window.location.search).get('tgWebAppStartParam');
      if (sp && String(sp).startsWith('web_matrix') && !sessionStorage.getItem('astro_matrix_deeplink_done')) {
        sessionStorage.setItem('astro_matrix_deeplink_done', '1');
        navigate('/matrix');
      }
    } catch { /* noop */ }
  }, []);
  const { user } = useAuth();
  const { orbs, tier, setOrbs, setMaxOrbs, setTier, setResetAt, setEnergy } = useEnergy();
  const { t, locale } = useTranslation();

  // Orb costs from ORB_COSTS config
  // oracle: 0.5, daily: 1, planet/house: 2, dates: 3, weekly: 5, monthly: 15, solar: 15 (Premium only), guest_chart/compatibility: 20
  const FEATURES = [
    {
      icon: Moon,
      title: locale === 'ru' ? 'Моя натальная карта' : 'My Natal Chart',
      description: locale === 'ru' ? 'Ваш космический отпечаток' : 'Your cosmic blueprint',
      energyCost: 0,
      path: '/my-natal-chart',
      premiumOnly: false,
    },
    {
      icon: Users,
      title: locale === 'ru' ? 'Гостевые карты' : 'Guest Charts',
      description: locale === 'ru' ? 'Карты для друзей и партнёров' : 'Charts for friends and partners',
      energyCost: 20,
      path: '/natal-chart',
      premiumOnly: false,
    },
    {
      icon: Hexagon,
      title: locale === 'ru' ? 'Матрица судьбы' : 'Matrix of Destiny',
      description: locale === 'ru' ? '22 аркана по дате рождения' : '22 arcana from your birth date',
      energyCost: 0,
      path: '/matrix',
      premiumOnly: false,
    },
    {
      icon: Sun,
      title: t.dashboard.solarReturn,
      description: t.dashboard.solarReturnDesc,
      energyCost: 15,
      path: '/solar-today',
      premiumOnly: true, // Solar return is Premium-only
    },
    {
      icon: MoonStar,
      title: t.dashboard.horoscope,
      description: t.dashboard.horoscopeDesc,
      energyCost: 1,
      path: '/horoscope',
      premiumOnly: false,
    },
    {
      icon: Heart,
      title: t.dashboard.compatibility,
      description: t.dashboard.compatibilityDesc,
      energyCost: 20,
      path: '/compatibility',
      premiumOnly: false,
    },
    {
      icon: MessageCircle,
      title: t.dashboard.askOracle,
      description: t.dashboard.askOracleDesc,
      energyCost: 0.5,
      path: '/ask',
      premiumOnly: false,
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
      // Set new orbs system
      if (data.data.orbs !== undefined) {
        setOrbs(data.data.orbs);
      }
      if (data.data.maxOrbs !== undefined) {
        setMaxOrbs(data.data.maxOrbs);
      }
      if (data.data.tier) {
        setTier(data.data.tier);
      }
      if (data.data.orbsResetAt) {
        setResetAt(new Date(data.data.orbsResetAt));
      }
      // Legacy compatibility
      setEnergy(data.data.energy);
    }
  }, [data, setEnergy, setOrbs, setMaxOrbs, setTier, setResetAt]);

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
              {moonPhaseLine(locale)}
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
          <button
            className="mx-auto block tap-scale"
            onClick={() => { haptic.impact('light'); navigate('/buy-energy'); }}
            aria-label="Пополнить звёзды"
            data-testid="button-balance-topup"
          >
            <EnergyBadge />
          </button>
        </div>

        {/* Low Orbs Alert - only for Standard tier */}
        {tier === 'standard' && orbs < 10 && (
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
          {FEATURES.map((feature, fIdx) => {
            // Free users: only natal chart is accessible
            const isLockedForFree = tier === 'free' && feature.path !== '/my-natal-chart' && feature.path !== '/matrix';
            // Standard users: solar return is Premium-only
            const isPremiumLocked = feature.premiumOnly && tier !== 'premium';
            // Not enough orbs (for Standard and Premium)
            const notEnoughOrbs = tier !== 'free' && !isPremiumLocked && feature.energyCost > 0 && orbs < feature.energyCost;
            // Disabled if natal chart not initialized or not enough orbs
            const isDisabled = !data?.data?.natalInitialized || notEnoughOrbs;
            
            return (
              <FeatureCard
                key={feature.path}
                art={VIGNETTES[feature.path] ? <FeatureVignette kind={VIGNETTES[feature.path]} /> : undefined}
                className={`anim-fade-up anim-d${Math.min(fIdx + 1, 6)}`}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                energyCost={feature.path === '/solar-today' && tier === 'premium' ? 0 : feature.energyCost}
                onClick={() => navigate(isLockedForFree || (feature.premiumOnly && tier !== 'premium') ? '/subscribe' : feature.path)}
                disabled={isDisabled}
                locked={isLockedForFree}
                premiumOnly={isPremiumLocked}
                locale={locale}
              />
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mt-8">
          <Button
            variant="ghost"
            className="h-auto flex-col gap-1.5 py-3 rounded-xl border border-border bg-card text-xs"
            onClick={() => navigate('/subscribe')}
            data-testid="button-subscribe"
          >
            <CreditCard className="w-4 h-4" />
            {locale === 'ru' ? 'Подписка' : 'Subscribe'}
          </Button>
          <Button
            variant="ghost"
            className="relative h-auto flex-col gap-1.5 py-3 rounded-xl border border-border bg-card text-xs"
            onClick={() => navigate('/referral')}
            data-testid="button-referral"
          >
            <Users className="w-4 h-4" />
            {locale === 'ru' ? 'Рефералы' : 'Referrals'}
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
            variant="ghost"
            className="h-auto flex-col gap-1.5 py-3 rounded-xl border border-border bg-card text-xs"
            onClick={() => navigate('/payment-history')}
            data-testid="button-payment-history"
          >
            <Receipt className="w-4 h-4" />
            {locale === 'ru' ? 'Платежи' : 'Payments'}
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
