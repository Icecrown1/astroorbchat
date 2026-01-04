import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/store/useAuth';
import { useEnergy } from '@/store/useEnergy';
import { useTranslation } from '@/contexts/LocaleContext';
import {
  Moon,
  Sun,
  Heart,
  MessageCircle,
  Users,
  Star,
  Home,
  ShoppingBag,
  User,
  ChevronRight,
} from 'lucide-react';
import { useEffect } from 'react';
import type { User as UserType, Subscription } from '@shared/schema';
import wideCardBg from '@assets/Image_1767537750216.jpg';
import moonIcon from '@assets/Image_(1)_1767538920082.jpg';

interface UserMeResponse {
  ok: boolean;
  data: UserType & {
    subscription?: Subscription | null;
    natalInitialized?: boolean;
    energy: number;
  };
}

export default function Dashboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { energy, setEnergy, setResetAt } = useEnergy();
  const { locale } = useTranslation();

  const { data, isLoading } = useQuery<UserMeResponse>({
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

  const userName = user?.name || 'Name';

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <p className="text-rose-800/70 text-sm font-medium" data-testid="text-logo">
            AstroApp
          </p>
          
          {/* Energy Badge - gradient pink-orange */}
          <button
            onClick={() => navigate('/buy-energy')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-orange-300 text-white font-semibold shadow-lg"
            data-testid="button-energy-badge"
          >
            <Star className="w-4 h-4 fill-white" />
            <span>{energy}</span>
          </button>
        </div>

        {/* Welcome */}
        <h1 className="text-3xl font-bold text-rose-900 mb-6" data-testid="text-welcome">
          {locale === 'ru' ? 'Добро пожаловать,' : 'Welcome,'}<br />
          {userName}!
        </h1>

        {/* Feature Cards */}
        <div className="space-y-3">
          {/* Natal Chart - Full width */}
          <FeatureCardWide
            icon={<img src={moonIcon} alt="" className="w-10 h-10 object-contain" />}
            title={locale === 'ru' ? 'Натальная карта' : 'Natal Chart'}
            description={locale === 'ru' ? 'Узнайте свою судьбу по звездам.' : 'Discover your destiny in the stars.'}
            cost={2}
            onClick={() => navigate('/my-natal-chart')}
            backgroundImage={wideCardBg}
          />

          {/* Relationships - Full width */}
          <FeatureCardWide
            icon={<Users className="w-8 h-8 text-rose-400" />}
            title={locale === 'ru' ? 'Отношения' : 'Relationships'}
            description={locale === 'ru' ? 'Анализ ваших связей и партнёрств.' : 'Analysis of your connections.'}
            cost={4}
            onClick={() => navigate('/compatibility')}
            backgroundImage={wideCardBg}
          />

          {/* Two columns: Horoscope & Solar Return */}
          <div className="grid grid-cols-2 gap-3">
            <FeatureCardSmall
              icon={<Star className="w-6 h-6 text-amber-400" />}
              title={locale === 'ru' ? 'Гороскоп' : 'Horoscope'}
              description={locale === 'ru' ? 'Ежедневные и еженедельные прогнозы.' : 'Daily and weekly forecasts.'}
              cost={7}
              onClick={() => navigate('/horoscope')}
            />
            <FeatureCardSmall
              icon={<Sun className="w-6 h-6 text-yellow-400" />}
              title={locale === 'ru' ? 'Солнечный возврат' : 'Solar Return'}
              description={locale === 'ru' ? 'Прогноз на ваш личный год.' : 'Your personal year forecast.'}
              cost={1}
              onClick={() => navigate('/solar-today')}
            />
          </div>

          {/* Two columns: Compatibility & Oracle */}
          <div className="grid grid-cols-2 gap-3">
            <FeatureCardSmall
              icon={<Heart className="w-6 h-6 text-amber-400" />}
              title={locale === 'ru' ? 'Совместимость' : 'Compatibility'}
              description={locale === 'ru' ? 'Узнайте, кто вам подходит.' : 'Find your perfect match.'}
              cost={3}
              onClick={() => navigate('/compatibility')}
            />
            <FeatureCardSmall
              icon={<MessageCircle className="w-6 h-6 text-amber-400" />}
              title={locale === 'ru' ? 'Оракул' : 'Oracle'}
              description={locale === 'ru' ? 'Получите ответ на свой вопрос.' : 'Get answers to your questions.'}
              cost={5}
              onClick={() => navigate('/ask')}
            />
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-rose-200/50 px-6 py-3">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <NavButton
            icon={<Home className="w-6 h-6" />}
            active={location === '/dashboard' || location === '/'}
            onClick={() => navigate('/dashboard')}
            testId="nav-home"
          />
          <NavButton
            icon={<Star className="w-6 h-6" />}
            active={location === '/archive'}
            onClick={() => navigate('/archive')}
            testId="nav-archive"
          />
          <NavButton
            icon={<ShoppingBag className="w-6 h-6" />}
            active={location === '/subscribe'}
            onClick={() => navigate('/subscribe')}
            testId="nav-shop"
          />
          <NavButton
            icon={<User className="w-6 h-6" />}
            active={location === '/settings'}
            onClick={() => navigate('/settings')}
            testId="nav-profile"
          />
        </div>
      </nav>
    </div>
  );
}

interface FeatureCardWideProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cost: number;
  onClick: () => void;
  backgroundImage?: string;
}

function FeatureCardWide({ icon, title, description, cost, onClick, backgroundImage }: FeatureCardWideProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-white/50 hover-elevate transition-all text-left overflow-hidden"
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {
        backgroundColor: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(4px)',
      }}
      data-testid={`card-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-rose-900">{title}</h3>
        <p className="text-sm text-rose-700/70">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-800 text-sm font-medium">
          {cost}
        </span>
      </div>
      <ChevronRight className="w-5 h-5 text-rose-400 flex-shrink-0" />
    </button>
  );
}

interface FeatureCardSmallProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cost: number;
  onClick: () => void;
}

function FeatureCardSmall({ icon, title, description, cost, onClick }: FeatureCardSmallProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/70 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-start shadow-sm border border-white/50 hover-elevate transition-all text-left"
      data-testid={`card-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <span className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-800 text-xs font-medium">
          {cost}
        </span>
      </div>
      <h3 className="font-semibold text-rose-900 mb-1">{title}</h3>
      <p className="text-xs text-rose-700/70 mb-2">{description}</p>
      <span className="text-amber-500 text-sm font-medium flex items-center gap-1">
        Открыть <ChevronRight className="w-4 h-4" />
      </span>
    </button>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  testId: string;
}

function NavButton({ icon, active, onClick, testId }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-xl transition-colors ${
        active ? 'text-rose-600' : 'text-rose-400 hover:text-rose-500'
      }`}
      data-testid={testId}
    >
      {icon}
    </button>
  );
}
