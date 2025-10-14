import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartCanvas } from '@/components/ChartCanvas';
import { PlanetModal } from '@/components/PlanetModal';
import { Loader } from '@/components/Loader';
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

export default function MyNatalChart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);

  // Load user's OWN natal chart from cache
  const { data: chartResponse, isLoading: chartLoading } = useQuery<any>({
    queryKey: [`/api/natal/me?locale=${locale}`],
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
      queryClient.invalidateQueries({ queryKey: [`/api/natal/me?locale=${locale}`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/natal/me?locale=${locale}`] });
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

  // Chart is stored as { id, userId, data: {...}, createdAt }
  // The actual chart data is in chartResponse.data.data
  const rawChartData = chartResponse?.data?.data;
  
  // Transform planets from object to array for display (if not already an array)
  const chartData = rawChartData ? {
    ...rawChartData,
    planets: Array.isArray(rawChartData.planets) 
      ? rawChartData.planets 
      : Object.entries(rawChartData.planets || {}).map(([name, data]: [string, any]) => ({
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
        <Loader size="lg" />
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
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
              {createChartMutation.isPending ? (
                <Loader className="mr-2" size="sm" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2" />
              )}
              {locale === 'ru' ? 'Создать карту бесплатно' : 'Create Chart for Free'}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
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
                onPlanetClick={setSelectedPlanet}
              />
            </div>
          </Card>

          {chartData.interpretation && (
            <Accordion type="single" collapsible defaultValue="interpretation">
              <AccordionItem value="interpretation">
                <AccordionTrigger className="text-lg font-semibold">
                  {t.natalChart.interpretation}
                </AccordionTrigger>
                <AccordionContent>
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: chartData.interpretation.replace(/\n/g, '<br />') 
                    }}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">{t.natalChart.planetaryPositions}</h2>
            <Accordion type="single" collapsible className="w-full">
              {chartData.planets?.map((planet: any, index: number) => (
                <AccordionItem key={index} value={`planet-${index}`}>
                  <AccordionTrigger data-testid={`accordion-planet-${planet.name}`}>
                    <div className="flex items-center gap-3">
                      <PlanetIcon 
                        name={planet.name as any} 
                        size={36} 
                        variant="gold"
                        animated
                        className="shrink-0"
                      />
                      <div className="text-left">
                        <div className="font-medium">{translatePlanet(planet.name, locale)}</div>
                        <div className="text-sm text-muted-foreground">
                          {translateSign(planet.sign, locale)} {planet.degree_in_sign?.toFixed(2)}°
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 text-sm text-muted-foreground">
                      {locale === 'ru' 
                        ? `Нажмите на планету в карте для детальной AI-интерпретации` 
                        : `Click on the planet in the chart for detailed AI interpretation`}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
