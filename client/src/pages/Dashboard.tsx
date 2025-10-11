import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { EnergyBadge } from '@/components/EnergyBadge';
import { FeatureCard } from '@/components/FeatureCard';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/store/useAuth';
import { useEnergy } from '@/store/useEnergy';
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

const FEATURES = [
  {
    icon: Moon,
    title: 'Natal Chart',
    description: 'Explore your complete birth chart with planetary positions and aspects',
    energyCost: 2,
    path: '/natal-chart',
  },
  {
    icon: Sun,
    title: 'Solar Return',
    description: 'Your personalized solar chart for today',
    energyCost: 1,
    path: '/solar-today',
  },
  {
    icon: Sparkles,
    title: 'Horoscope',
    description: 'Daily, weekly, or monthly cosmic forecast',
    energyCost: 1,
    path: '/horoscope',
  },
  {
    icon: Heart,
    title: 'Compatibility',
    description: 'Analyze relationship dynamics with another person',
    energyCost: 2,
    path: '/compatibility',
  },
  {
    icon: MessageCircle,
    title: 'Ask AI',
    description: 'Get personalized astrological insights for any question',
    energyCost: 1,
    path: '/ask',
  },
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { energy, setEnergy, setResetAt } = useEnergy();

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
              Welcome, {user?.name || 'Cosmic Traveler'}
            </h1>
            <p className="text-muted-foreground">
              Your cosmic journey awaits
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
            Buy Energy
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/subscribe')}
            data-testid="button-subscribe"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Subscribe
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/referral')}
            data-testid="button-referral"
          >
            <Users className="w-4 h-4 mr-2" />
            Referrals
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/payment-history')}
            data-testid="button-payment-history"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Payments
          </Button>
        </div>
      </div>
    </div>
  );
}
