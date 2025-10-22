import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Home, Zap, Eye } from 'lucide-react';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PlanetInterpretation {
  title: string;
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
}

interface HouseInfluenceResult {
  title: string;
  life_sphere: string;
  manifestation: string;
  key_themes: string[];
  opportunities: string[];
  challenges: string[];
  practical_work: string[];
}

interface PlanetModalProps {
  planet: string | null;
  onClose: () => void;
  chartType?: 'own' | 'guest';
  chartId?: string;
}

export function PlanetModal({ planet, onClose, chartType = 'own', chartId }: PlanetModalProps) {
  const { locale } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [houseInfluence, setHouseInfluence] = useState<HouseInfluenceResult | null>(null);

  useEffect(() => {
    setIsOpen(!!planet);
    // КРИТИЧНО: Сбрасываем платную интерпретацию при смене планеты
    // Это гарантирует, что для каждой планеты нужна новая покупка
    setHouseInfluence(null);
    // Сбрасываем мутацию чтобы избежать race condition
    houseInfluenceMutation.reset();
  }, [planet]);

  const { data, isLoading, error } = useQuery<PlanetInterpretation>({
    queryKey: ['/api/astrology/planet-interpretation', planet, locale, chartType, chartId],
    queryFn: async () => {
      if (!planet) throw new Error('No planet selected');
      const response = await apiRequest('POST', '/api/astrology/planet-interpretation', {
        planet,
        locale,
        chartType,
        chartId
      });
      return response.data;
    },
    enabled: !!planet,
    retry: 1
  });

  // Проверяем статус купленных интерпретаций влияния домов
  const { data: purchasedStatus } = useQuery<Record<string, Record<string, any>>>({
    queryKey: ['/api/astrology/house-influence-status', chartType, chartId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (chartType) params.append('chartType', chartType);
      if (chartId) params.append('chartId', chartId);
      const response = await fetch(`/api/astrology/house-influence-status?${params}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      const result = await response.json();
      return result.data || {};
    },
    retry: 1
  });

  // Проверяем куплена ли интерпретация для текущей планеты и локали
  const isPurchased = planet && purchasedStatus?.[locale]?.[planet];

  const handleClose = () => {
    setIsOpen(false);
    setHouseInfluence(null); // Сброс при закрытии
    setTimeout(onClose, 200); // Даем время на анимацию закрытия
  };

  // Мутация для получения интерпретации влияния дома
  // Для своей карты: первый раз платно (2 орба), потом бесплатно из кэша
  // Для гостевых карт: всегда платно (2 орба)
  const houseInfluenceMutation = useMutation({
    mutationFn: async (requestedPlanet: string) => {
      const response = await apiRequest('POST', '/api/astrology/house-influence', {
        planet: requestedPlanet,
        locale,
        chartType,
        chartId
      });
      return { data: response.data, requestedPlanet, cached: response.cached };
    },
    onSuccess: (result: { data: HouseInfluenceResult; requestedPlanet: string; cached?: boolean }) => {
      // КРИТИЧНО: Проверяем, что пользователь все еще смотрит ту же планету
      // Иначе race condition покажет старые данные для новой планеты
      if (result.requestedPlanet !== planet) {
        console.log('[House Influence] Race condition prevented: planet changed during request');
        return;
      }
      
      setHouseInfluence(result.data);
      
      // Обновляем кэш статуса и энергию пользователя
      queryClient.invalidateQueries({ queryKey: ['/api/astrology/house-influence-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      
      toast({
        title: locale === 'ru' ? '✨ Интерпретация получена' : '✨ Interpretation received',
        description: locale === 'ru' 
          ? (result.cached ? 'Загружено из сохраненных' : 'Глубокая интерпретация влияния дома загружена')
          : (result.cached ? 'Loaded from saved' : 'Deep house influence interpretation loaded'),
      });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message;
      
      // Проверяем, это ошибка недостатка энергии?
      if (error.response?.status === 402) {
        toast({
          title: locale === 'ru' ? '⚡ Недостаточно орбов' : '⚡ Insufficient orbs',
          description: locale === 'ru' 
            ? `Нужно ${error.response?.data?.required || 2} орбов. Доступно: ${error.response?.data?.available || 0}`
            : `Required: ${error.response?.data?.required || 2} orbs. Available: ${error.response?.data?.available || 0}`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: locale === 'ru' ? 'Ошибка' : 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  });

  const PLANET_SYMBOLS: Record<string, string> = {
    'Sun': '☉',
    'Moon': '☽',
    'Mercury': '☿',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃',
    'Saturn': '♄',
    'Uranus': '♅',
    'Neptune': '♆',
    'North Node': '☊',
    'South Node': '☋',
    'Pluto': '♇'
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {locale === 'ru' 
                ? 'Не удалось загрузить интерпретацию. Попробуйте позже.'
                : 'Failed to load interpretation. Please try again later.'}
            </AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <span className="text-3xl" style={{ color: '#b87333' }}>
                  {planet && PLANET_SYMBOLS[planet]}
                </span>
                <span>{data.title}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Краткое описание */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm leading-relaxed">{data.summary}</p>
                </div>
              </div>

              {/* Сильные стороны */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  {locale === 'ru' ? 'Сильные стороны' : 'Strengths'}
                </h3>
                <ul className="space-y-2">
                  {data.strengths.map((strength, index) => (
                    <li 
                      key={index} 
                      className="flex items-start gap-3 text-sm"
                      data-testid={`strength-${index}`}
                    >
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Риски */}
              {data.risks && data.risks.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    {locale === 'ru' ? 'На что обратить внимание' : 'Watch Out For'}
                  </h3>
                  <ul className="space-y-2">
                    {data.risks.map((risk, index) => (
                      <li 
                        key={index} 
                        className="flex items-start gap-3 text-sm"
                        data-testid={`risk-${index}`}
                      >
                        <span className="text-amber-600 mt-0.5">!</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Советы */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  {locale === 'ru' ? 'Рекомендации' : 'Advice'}
                </h3>
                <ul className="space-y-2">
                  {data.advice.map((item, index) => (
                    <li 
                      key={index} 
                      className="flex items-start gap-3 text-sm"
                      data-testid={`advice-${index}`}
                    >
                      <span className="text-primary mt-0.5">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Платная интерпретация влияния дома */}
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
                {!houseInfluence ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Home className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm mb-1">
                          {locale === 'ru' ? 'Влияние дома на планету' : 'House influence on planet'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {locale === 'ru' 
                            ? 'Глубокая интерпретация того, как дом модифицирует планету'
                            : 'Deep interpretation of how the house modifies the planet'}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => planet && houseInfluenceMutation.mutate(planet)}
                      disabled={houseInfluenceMutation.isPending}
                      variant={isPurchased ? 'secondary' : 'default'}
                      className="flex items-center gap-1.5 flex-shrink-0"
                      data-testid="button-house-influence"
                    >
                      {houseInfluenceMutation.isPending ? (
                        <Loader size="sm" />
                      ) : isPurchased ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-xs">{locale === 'ru' ? 'Просмотр' : 'View'}</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>2</span>
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <Home className="w-5 h-5 text-accent" />
                        {houseInfluence.title}
                      </h3>
                    </div>

                    {/* Сфера жизни */}
                    <div className="p-3 bg-primary/5 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium text-foreground">
                          {locale === 'ru' ? 'Сфера жизни: ' : 'Life sphere: '}
                        </span>
                        <span className="text-muted-foreground">{houseInfluence.life_sphere}</span>
                      </p>
                    </div>

                    {/* Как проявляется */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        {locale === 'ru' ? 'Как проявляется' : 'How it manifests'}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {houseInfluence.manifestation}
                      </p>
                    </div>

                    {/* Ключевые темы */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        {locale === 'ru' ? 'Ключевые темы' : 'Key themes'}
                      </h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {houseInfluence.key_themes.map((theme, index) => (
                          <li 
                            key={index} 
                            className="flex items-start gap-2 text-xs"
                            data-testid={`theme-${index}`}
                          >
                            <span className="text-accent mt-0.5">•</span>
                            <span className="text-muted-foreground">{theme}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Возможности */}
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        {locale === 'ru' ? 'Возможности' : 'Opportunities'}
                      </h4>
                      <ul className="space-y-1.5">
                        {houseInfluence.opportunities.map((opp, index) => (
                          <li 
                            key={index} 
                            className="flex items-start gap-2 text-sm"
                            data-testid={`opportunity-${index}`}
                          >
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span className="text-muted-foreground">{opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Вызовы */}
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        {locale === 'ru' ? 'Вызовы' : 'Challenges'}
                      </h4>
                      <ul className="space-y-1.5">
                        {houseInfluence.challenges.map((challenge, index) => (
                          <li 
                            key={index} 
                            className="flex items-start gap-2 text-sm"
                            data-testid={`challenge-${index}`}
                          >
                            <span className="text-amber-600 mt-0.5">!</span>
                            <span className="text-muted-foreground">{challenge}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Практические шаги */}
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        {locale === 'ru' ? 'Практическая работа' : 'Practical work'}
                      </h4>
                      <ul className="space-y-1.5">
                        {houseInfluence.practical_work.map((work, index) => (
                          <li 
                            key={index} 
                            className="flex items-start gap-2 text-sm"
                            data-testid={`work-${index}`}
                          >
                            <span className="text-primary mt-0.5">→</span>
                            <span className="text-muted-foreground">{work}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
