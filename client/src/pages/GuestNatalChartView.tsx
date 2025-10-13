import { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartCanvas } from '@/components/ChartCanvas';
import { PlanetModal } from '@/components/PlanetModal';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function GuestNatalChartView() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/guest-chart/:id');
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);

  const chartId = params?.id;

  // Load guest natal chart
  const { data: chartResponse, isLoading: chartLoading } = useQuery<any>({
    queryKey: [`/api/natal/external/${chartId}`],
    enabled: !!chartId,
  });

  const rawChartData = chartResponse?.data?.data;
  const chartInfo = chartResponse?.data;
  
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

  if (!chartData || !chartInfo) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <div className="container max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {locale === 'ru' ? 'Карта не найдена' : 'Chart not found'}
            </p>
            <Button
              onClick={() => navigate('/natal-chart')}
              className="mt-4"
              data-testid="button-back-to-list"
            >
              {locale === 'ru' ? 'Вернуться к списку' : 'Back to list'}
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
              onClick={() => navigate('/natal-chart')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">
                {chartInfo.name}
              </h1>
              <p className="text-muted-foreground">
                {new Date(chartInfo.birthdayDate).toLocaleDateString(locale)}
                {chartInfo.birthPlace && ` • ${chartInfo.birthPlace}`}
              </p>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/compatibility?guestId=${chartId}`)}
            data-testid="button-use-compatibility"
          >
            <Users className="w-4 h-4 mr-2" />
            {locale === 'ru' ? 'Совместимость' : 'Compatibility'}
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
              {chartData.planets.map((planet: any) => (
                <AccordionItem key={planet.name} value={planet.name}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <span className="font-medium">{planet.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {planet.sign} {planet.degree_in_sign?.toFixed(2)}°
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        {locale === 'ru' ? 'Знак:' : 'Sign:'} {planet.sign}
                      </p>
                      <p className="text-muted-foreground">
                        {locale === 'ru' ? 'Градус в знаке:' : 'Degree in sign:'} {planet.degree_in_sign?.toFixed(2)}°
                      </p>
                      <p className="text-muted-foreground">
                        {locale === 'ru' ? 'Долгота:' : 'Longitude:'} {planet.longitude?.toFixed(2)}°
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          {chartData.houses && chartData.houses.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">{locale === 'ru' ? 'Дома' : 'Houses'}</h2>
              <Accordion type="single" collapsible className="w-full">
                {chartData.houses.map((house: any, index: number) => (
                  <AccordionItem key={index} value={`house-${index}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 w-full">
                        <span className="font-medium">
                          {locale === 'ru' ? `Дом ${index + 1}` : `House ${index + 1}`}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {house.sign} {house.degree?.toFixed(2)}°
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          {locale === 'ru' ? 'Знак:' : 'Sign:'} {house.sign}
                        </p>
                        <p className="text-muted-foreground">
                          {locale === 'ru' ? 'Куспид:' : 'Cusp:'} {house.degree?.toFixed(2)}°
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          )}

          {chartData.aspects && chartData.aspects.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t.natalChart.aspects}</h2>
              <div className="space-y-2">
                {chartData.aspects.map((aspect: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`aspect-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{aspect.planet1}</span>
                      <span className="text-muted-foreground">{aspect.aspect}</span>
                      <span className="font-medium">{aspect.planet2}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {aspect.orb?.toFixed(2)}°
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {selectedPlanet && (
        <PlanetModal
          planet={selectedPlanet}
          onClose={() => setSelectedPlanet(null)}
          chartType="guest"
          chartId={chartId}
        />
      )}
    </div>
  );
}
