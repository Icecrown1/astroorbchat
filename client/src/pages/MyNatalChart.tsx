import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartCanvas } from '@/components/ChartCanvas';
import { PlanetModal } from '@/components/PlanetModal';
import { Loader, FullPageLoader } from '@/components/Loader';
import PlanetIcon from '@/components/PlanetIcon';
import { ImportantDatesList } from '@/components/ImportantDatesList';
import { ArrowLeft, Sparkles, RefreshCw, Calendar } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { translatePlanet, translateSign } from '@/lib/astroTranslations';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Уникальные описания для каждой планеты
function getPlanetDescription(planetName: string, sign: string, locale: 'ru' | 'en'): string {
  const planetNameLower = planetName.toLowerCase();
  
  const descriptions: Record<string, { ru: string; en: string }> = {
    sun: {
      ru: 'Солнце определяет вашу суть и жизненную силу. Это ваше истинное "Я" и путь самовыражения. Узнайте больше о том, как раскрыть свой внутренний потенциал.',
      en: 'The Sun defines your essence and life force. This is your true self and path of self-expression. Discover how to unlock your inner potential.'
    },
    moon: {
      ru: 'Луна показывает ваш эмоциональный мир и внутренние потребности. Она раскрывает, что приносит вам комфорт и безопасность. Погрузитесь в глубины своих чувств.',
      en: 'The Moon reveals your emotional world and inner needs. It shows what brings you comfort and security. Dive deep into your feelings.'
    },
    mercury: {
      ru: 'Меркурий управляет вашим мышлением и общением. Это ваш способ понимать мир и выражать идеи. Откройте секреты своего интеллекта.',
      en: 'Mercury governs your thinking and communication. This is how you understand the world and express ideas. Unlock the secrets of your intellect.'
    },
    venus: {
      ru: 'Венера отвечает за любовь, красоту и ценности. Она показывает, что вы цените в отношениях и как выражаете привязанность. Раскройте свои романтические особенности.',
      en: 'Venus rules love, beauty, and values. It shows what you cherish in relationships and how you express affection. Reveal your romantic nature.'
    },
    mars: {
      ru: 'Марс символизирует вашу энергию, страсть и способ действовать. Это ваш внутренний воин и источник мотивации. Узнайте, как направить свою силу.',
      en: 'Mars symbolizes your energy, passion, and way of taking action. This is your inner warrior and source of motivation. Learn how to channel your power.'
    },
    jupiter: {
      ru: 'Юпитер приносит удачу, рост и расширение горизонтов. Это планета возможностей и оптимизма. Откройте пути к процветанию и мудрости.',
      en: 'Jupiter brings luck, growth, and expanding horizons. This is the planet of opportunities and optimism. Open paths to prosperity and wisdom.'
    },
    saturn: {
      ru: 'Сатурн учит дисциплине, ответственности и достижению целей. Это строгий учитель, но щедрый на награды. Познайте уроки жизненной мудрости.',
      en: 'Saturn teaches discipline, responsibility, and achieving goals. A strict teacher but generous with rewards. Learn the lessons of life wisdom.'
    },
    uranus: {
      ru: 'Уран несёт революцию, инновации и свободу. Это ваша уникальность и жажда перемен. Исследуйте свой нестандартный путь.',
      en: 'Uranus brings revolution, innovation, and freedom. This is your uniqueness and thirst for change. Explore your unconventional path.'
    },
    neptune: {
      ru: 'Нептун открывает мир мечты, интуиции и духовности. Это планета воображения и тонких энергий. Погрузитесь в мистические глубины.',
      en: 'Neptune opens the world of dreams, intuition, and spirituality. The planet of imagination and subtle energies. Dive into mystical depths.'
    },
    pluto: {
      ru: 'Плутон трансформирует и обновляет через глубокие изменения. Это сила возрождения и личной власти. Откройте свою скрытую мощь.',
      en: 'Pluto transforms and renews through deep changes. The power of rebirth and personal power. Discover your hidden strength.'
    },
    north_node: {
      ru: 'Северный Узел указывает направление вашего роста и эволюции души. Это ваше предназначение и путь развития. Узнайте куда вам стоит двигаться.',
      en: 'North Node points to your growth direction and soul evolution. Your destiny and path of development. Discover where you should be heading.'
    },
    south_node: {
      ru: 'Южный Узел показывает ваш прошлый опыт и врождённые таланты. Это то, что вы уже освоили. Поймите свои природные способности.',
      en: 'South Node reveals your past experience and innate talents. What you have already mastered. Understand your natural abilities.'
    },
    chiron: {
      ru: 'Хирон указывает на ваши глубокие раны и дар исцеления. Через боль приходит мудрость помогать другим. Откройте путь к целительству.',
      en: 'Chiron points to your deep wounds and gift of healing. Through pain comes wisdom to help others. Open the path to healing.'
    },
    ascendant: {
      ru: 'Асцендент показывает вашу маску и первое впечатление на людей. Это то, как мир видит вас при знакомстве. Раскройте свой внешний образ.',
      en: 'Ascendant shows your mask and first impression on people. How the world sees you at first meeting. Reveal your outer image.'
    },
    mc: {
      ru: 'MC (Середина Неба) указывает на карьеру и публичный образ. Это ваши амбиции и жизненные достижения. Постройте путь к успеху.',
      en: 'MC (Midheaven) points to career and public image. Your ambitions and life achievements. Build your path to success.'
    }
  };

  const planetDesc = descriptions[planetNameLower] || {
    ru: 'Это положение показывает важную часть вашей личности и характера. Оно влияет на то, как вы проявляете себя в мире и взаимодействуете с окружающими. Нажмите кнопку ниже, чтобы узнать подробную персональную трактовку с учётом всех аспектов.',
    en: 'This placement reveals an important part of your personality and character. It influences how you express yourself in the world and interact with others. Click the button below to discover a detailed personal interpretation with all aspects considered.'
  };

  return planetDesc[locale];
}

export default function MyNatalChart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);

  // Load user's OWN natal chart from cache with locale-specific interpretations
  const { data: chartResponse, isLoading: chartLoading } = useQuery<any>({
    queryKey: ['/api/natal/me', locale], // Include locale for proper caching of interpretations
    staleTime: 1000 * 60 * 60, // 1 hour - reduce recalculations while keeping data fresh
    queryFn: async () => {
      // Get auth token from localStorage
      const authData = localStorage.getItem('astro-orb-auth');
      const headers: Record<string, string> = {};
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed.state?.token) {
            headers.Authorization = `Bearer ${parsed.state.token}`;
          }
        } catch (e) {
          console.error('Failed to parse auth data:', e);
        }
      }

      const response = await fetch(`/api/natal/me?locale=${locale}`, {
        headers,
        credentials: 'include',
      });
      
      if (response.status === 409) {
        // Natal chart not initialized yet
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch chart');
      }
      
      return response.json();
    },
  });

  // Create natal chart (first time)
  const createChartMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/natal/init', { locale });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/natal/me'] }); // Invalidate all locales
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: locale === 'ru' ? 'Карта создана!' : 'Chart created!',
        description: locale === 'ru' ? 'Ваша натальная карта успешно создана' : 'Your natal chart has been created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: t.natalChart.generationFailed,
        description: error.message || t.compatibility.tryAgain,
        variant: 'destructive',
      });
    },
  });

  // Recalculate chart (force recomputation)
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/natal/recalculate', { locale });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/natal/me'] }); // Invalidate all locales
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: locale === 'ru' ? 'Карта пересчитана' : 'Chart recalculated',
        description: locale === 'ru' ? 'Ваша натальная карта обновлена с учётом последних данных профиля' : 'Your natal chart has been updated with latest profile data',
      });
    },
    onError: (error: any) => {
      toast({
        title: t.natalChart.generationFailed,
        description: error.message || t.compatibility.tryAgain,
        variant: 'destructive',
      });
    },
  });

  // Chart is stored as { id, userId, data: {...}, professionalInterpretation: {...}, createdAt }
  // Full chart object including professionalInterpretation
  const rawChartData = chartResponse?.data;
  
  // Transform planets from object to array for display (if not already an array)
  const chartData = rawChartData?.data ? {
    ...rawChartData.data,
    planets: Array.isArray(rawChartData.data.planets) 
      ? rawChartData.data.planets 
      : Object.entries(rawChartData.data.planets || {}).map(([name, data]: [string, any]) => ({
          name,
          sign: data.sign,
          position: data.longitude,
          longitude: data.longitude,
          latitude: data.latitude,
          degree_in_sign: data.degree_in_sign,
        })),
  } : null;

  if (chartLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader size="lg" withPhrases />
      </div>
    );
  }

  if (!chartData) {
    // Show full-page loader when creating chart
    if (createChartMutation.isPending) {
      return <FullPageLoader />;
    }

    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        {/* Full Palette Gradient Background - AstroOrb */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-palette opacity-20" />
        </div>
        
        <div className="container max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">
                {locale === 'ru' ? 'Моя натальная карта' : 'My Natal Chart'}
              </h1>
            </div>
          </div>
          <Card className="p-8 text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-semibold mb-2">
              {locale === 'ru' ? 'Создайте свою натальную карту' : 'Create Your Natal Chart'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {locale === 'ru' 
                ? 'Получите бесплатную персонализированную астрологическую интерпретацию на основе точных данных вашего рождения.' 
                : 'Get a free personalized astrological interpretation based on your precise birth data.'}
            </p>
            <Button
              onClick={() => createChartMutation.mutate()}
              disabled={createChartMutation.isPending}
              size="lg"
              data-testid="button-create-chart"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {locale === 'ru' ? 'Создать карту бесплатно' : 'Create Chart for Free'}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      {/* Aura Background Effect - AstroOrb */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-gradient-aura opacity-35" />
      </div>
      
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">
                {locale === 'ru' ? 'Моя натальная карта' : 'My Natal Chart'}
              </h1>
              <p className="text-muted-foreground">
                {locale === 'ru' ? 'Ваш личный космический отпечаток' : 'Your personal cosmic blueprint'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            data-testid="button-recalculate"
          >
            {recalculateMutation.isPending ? (
              <Loader className="mr-2" size="sm" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {locale === 'ru' ? 'Пересчитать' : 'Recalculate'}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">{t.natalChart.chartVisualization}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {locale === 'ru' 
                ? 'Нажмите на планету для подробной интерпретации' 
                : 'Click on a planet for detailed interpretation'}
            </p>
            <div className="bg-gradient-to-br from-primary/5 to-chart-2/5 rounded-lg p-4">
              <ChartCanvas
                planets={chartData.planets}
                aspects={chartData.aspects || []}
                angles={chartData.angles}
                houses={chartData.houses}
                onPlanetClick={setSelectedPlanet}
              />
            </div>
          </Card>

          {rawChartData?.professionalInterpretation?.[locale] && typeof rawChartData.professionalInterpretation[locale] === 'string' && (
            <Accordion type="single" collapsible defaultValue="interpretation">
              <AccordionItem value="interpretation">
                <AccordionTrigger className="text-lg font-semibold">
                  {t.natalChart.interpretation}
                </AccordionTrigger>
                <AccordionContent>
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: rawChartData.professionalInterpretation[locale].replace(/\n/g, '<br />') 
                    }}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}


          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">{t.natalChart.planetaryPositions}</h2>
            <div className="space-y-3">
              {chartData.planets?.map((planet: any, index: number) => (
                <div 
                  key={index} 
                  className="border rounded-lg overflow-hidden hover-elevate transition-all"
                >
                  <button
                    onClick={() => setExpandedPlanet(expandedPlanet === planet.name ? null : planet.name)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                    data-testid={`button-planet-${planet.name}`}
                  >
                    <PlanetIcon 
                      name={planet.name as any} 
                      size={36} 
                      variant="gold"
                      animated
                      className="shrink-0"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{translatePlanet(planet.name, locale)}</div>
                      <div className="text-sm text-muted-foreground">
                        {translateSign(planet.sign, locale)} {planet.degree_in_sign?.toFixed(2)}°
                      </div>
                    </div>
                  </button>
                  
                  {expandedPlanet === planet.name && (
                    <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                        {getPlanetDescription(planet.name, planet.sign, locale)}
                      </p>
                      <Button
                        onClick={() => setSelectedPlanet(planet.name)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid={`button-detailed-${planet.name}`}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {locale === 'ru' ? 'Подробная трактовка' : 'Detailed Interpretation'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {locale === 'ru' ? 'Важные даты' : 'Important Dates'}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {locale === 'ru' 
                ? 'Персональные астрологические события на ближайшие 3 месяца на основе транзитов к вашей натальной карте' 
                : 'Personalized astrological events for the next 3 months based on transits to your natal chart'}
            </p>
            <ImportantDatesList />
          </Card>
        </div>
      </div>

      {selectedPlanet && (
        <PlanetModal
          planet={selectedPlanet}
          onClose={() => setSelectedPlanet(null)}
        />
      )}
    </div>
  );
}
