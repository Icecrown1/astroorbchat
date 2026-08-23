import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
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
import { AlertCircle, TrendingUp, AlertTriangle, Lightbulb, Home, Zap, Eye, Star, Crown } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useEnergy } from '@/store/useEnergy';

interface BriefInterpretation {
  title: string;
  summary: string;
  isShort: boolean;
  requiresSubscription: boolean;
}

interface DetailedInterpretation {
  title: string;
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
  isShort: boolean;
  requiresSubscription: boolean;
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
  const { decreaseOrbs } = useEnergy();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [detailedData, setDetailedData] = useState<DetailedInterpretation | null>(null);
  const [houseInfluence, setHouseInfluence] = useState<HouseInfluenceResult | null>(null);

  useEffect(() => {
    setIsOpen(!!planet);
    setDetailedData(null);
    setHouseInfluence(null);
    houseInfluenceMutation.reset();
    detailedMutation.reset();
  }, [planet]);

  const { data: briefData, isLoading, error } = useQuery<BriefInterpretation>({
    queryKey: ['/api/astrology/planet-interpretation', 'brief', planet, locale, chartType, chartId],
    queryFn: async () => {
      if (!planet) throw new Error('No planet selected');
      const response = await apiRequest('POST', '/api/astrology/planet-interpretation', {
        planet,
        locale,
        chartType,
        chartId,
        mode: 'brief'
      });
      return response.data;
    },
    enabled: !!planet,
    retry: 1
  });

  const statusParams = new URLSearchParams();
  if (chartType) statusParams.append('chartType', chartType);
  if (chartId) statusParams.append('chartId', chartId);

  const { data: purchasedStatus } = useQuery<Record<string, Record<string, any>>>({
    queryKey: [`/api/astrology/house-influence-status?${statusParams.toString()}`],
    enabled: !!planet,
    retry: 1
  });

  const isPurchased = planet && purchasedStatus?.data?.[locale]?.[planet];

  const handleClose = () => {
    setIsOpen(false);
    setDetailedData(null);
    setHouseInfluence(null);
    setTimeout(onClose, 200);
  };

  const handleSubscribe = () => {
    handleClose();
    navigate('/subscribe');
  };

  const detailedMutation = useMutation({
    mutationFn: async (requestedPlanet: string) => {
      const response = await apiRequest('POST', '/api/astrology/planet-interpretation', {
        planet: requestedPlanet,
        locale,
        chartType,
        chartId,
        mode: 'detailed'
      });
      return { data: response.data as DetailedInterpretation, requestedPlanet };
    },
    onSuccess: (result) => {
      if (result.requestedPlanet !== planet) return;
      setDetailedData(result.data);
      decreaseOrbs(2);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: locale === 'ru' ? 'Подробная трактовка получена' : 'Detailed interpretation received',
        description: locale === 'ru' ? '2 звезды списаны' : '2 stars deducted',
      });
    },
    onError: (error: any) => {
      if (error.response?.status === 402) {
        const isSubscriptionRequired = error.response?.data?.requiresSubscription;
        toast({
          title: locale === 'ru' ? 'Недостаточно звёзд' : 'Insufficient stars',
          description: isSubscriptionRequired
            ? (locale === 'ru' ? 'Необходима подписка' : 'Subscription required')
            : (locale === 'ru'
              ? `Нужно ${error.response?.data?.required || 2} звёзд. Доступно: ${error.response?.data?.available || 0}`
              : `Required: ${error.response?.data?.required || 2} stars. Available: ${error.response?.data?.available || 0}`),
          variant: 'destructive'
        });
      } else {
        toast({
          title: locale === 'ru' ? 'Ошибка' : 'Error',
          description: error.response?.data?.error || error.message,
          variant: 'destructive'
        });
      }
    }
  });

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
      if (result.requestedPlanet !== planet) return;
      setHouseInfluence(result.data);
      if (!result.cached) {
        decreaseOrbs(2);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/astrology/house-influence-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: locale === 'ru' ? 'Интерпретация получена' : 'Interpretation received',
        description: locale === 'ru'
          ? (result.cached ? 'Загружено из сохраненных' : 'Глубокая интерпретация влияния дома загружена')
          : (result.cached ? 'Loaded from saved' : 'Deep house influence interpretation loaded'),
      });
    },
    onError: (error: any) => {
      if (error.response?.status === 402) {
        toast({
          title: locale === 'ru' ? 'Недостаточно звёзд' : 'Insufficient stars',
          description: locale === 'ru'
            ? `Нужно ${error.response?.data?.required || 2} звёзд. Доступно: ${error.response?.data?.available || 0}`
            : `Required: ${error.response?.data?.required || 2} stars. Available: ${error.response?.data?.available || 0}`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: locale === 'ru' ? 'Ошибка' : 'Error',
          description: error.response?.data?.error || error.message,
          variant: 'destructive'
        });
      }
    }
  });

  const PLANET_SYMBOLS: Record<string, string> = {
    'Sun': '\u2609',
    'Moon': '\u263D',
    'Mercury': '\u263F',
    'Venus': '\u2640',
    'Mars': '\u2642',
    'Jupiter': '\u2643',
    'Saturn': '\u2644',
    'Uranus': '\u2645',
    'Neptune': '\u2646',
    'North Node': '\u260A',
    'South Node': '\u260B',
    'Pluto': '\u2647'
  };

  // Free-tier users see subscribe CTA instead of star-cost buttons
  const isFree = briefData?.requiresSubscription === true;

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
                ? 'Не удалось загрузить информацию о планете. Попробуйте позже.'
                : 'Failed to load planet info. Please try again later.'}
            </AlertDescription>
          </Alert>
        )}

        {briefData && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <span className="text-3xl" style={{ color: '#b87333' }}>
                  {planet && PLANET_SYMBOLS[planet]}
                </span>
                <span>{briefData.title}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Brief summary — free for everyone */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <OrbIcon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm leading-relaxed">{briefData.summary}</p>
                </div>
              </div>

              {/* Detailed interpretation row */}
              {!detailedData && (
                <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Star className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm mb-1">
                          {locale === 'ru' ? 'Подробная трактовка' : 'Detailed interpretation'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {locale === 'ru'
                            ? 'Сильные стороны, на что обратить внимание и рекомендации'
                            : 'Strengths, watch-outs, and personalized advice'}
                        </p>
                      </div>
                    </div>
                    {isFree ? (
                      <Button
                        size="sm"
                        onClick={handleSubscribe}
                        className="flex items-center gap-1.5 flex-shrink-0"
                        data-testid="button-subscribe-detailed"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>{locale === 'ru' ? 'Подписка' : 'Subscribe'}</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => planet && detailedMutation.mutate(planet)}
                        disabled={detailedMutation.isPending}
                        className="flex items-center gap-1.5 flex-shrink-0"
                        data-testid="button-detailed-interpretation"
                      >
                        {detailedMutation.isPending ? (
                          <Loader size="sm" />
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>{locale === 'ru' ? '2 звезды' : '2 stars'}</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {detailedData && (
                <>
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      {locale === 'ru' ? 'Сильные стороны' : 'Strengths'}
                    </h3>
                    <ul className="space-y-2">
                      {detailedData.strengths.map((strength, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-sm"
                          data-testid={`strength-${index}`}
                        >
                          <span className="text-green-600 mt-0.5">{'\u2713'}</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {detailedData.risks && detailedData.risks.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        {locale === 'ru' ? 'На что обратить внимание' : 'Watch Out For'}
                      </h3>
                      <ul className="space-y-2">
                        {detailedData.risks.map((risk, index) => (
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

                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      {locale === 'ru' ? 'Рекомендации' : 'Advice'}
                    </h3>
                    <ul className="space-y-2">
                      {detailedData.advice.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-sm"
                          data-testid={`advice-${index}`}
                        >
                          <span className="text-primary mt-0.5">{'\u2192'}</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* House influence row */}
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
                    {isFree ? (
                      <Button
                        size="sm"
                        onClick={handleSubscribe}
                        className="flex items-center gap-1.5 flex-shrink-0"
                        data-testid="button-subscribe-house"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>{locale === 'ru' ? 'Подписка' : 'Subscribe'}</span>
                      </Button>
                    ) : (
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
                            <span>{locale === 'ru' ? '2 звезды' : '2 stars'}</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <Home className="w-5 h-5 text-accent" />
                        {houseInfluence.title}
                      </h3>
                    </div>

                    <div className="p-3 bg-primary/5 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium text-foreground">
                          {locale === 'ru' ? 'Сфера жизни: ' : 'Life sphere: '}
                        </span>
                        <span className="text-muted-foreground">{houseInfluence.life_sphere}</span>
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        {locale === 'ru' ? 'Как проявляется' : 'How it manifests'}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {houseInfluence.manifestation}
                      </p>
                    </div>

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
                            <span className="text-accent mt-0.5">{'\u2022'}</span>
                            <span className="text-muted-foreground">{theme}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

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
                            <span className="text-green-600 mt-0.5">{'\u2713'}</span>
                            <span className="text-muted-foreground">{opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

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
                            <span className="text-primary mt-0.5">{'\u2192'}</span>
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
