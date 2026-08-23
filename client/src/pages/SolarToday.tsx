import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Sun, Info, MapPin, Calendar } from 'lucide-react';
import { FeatureVignette } from '@/components/FeatureVignette';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';

export default function SolarToday() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const { decreaseOrbs } = useEnergy();
  const [solarData, setSolarData] = useState<any>(null);
  const [isCached, setIsCached] = useState(false);
  
  // New state for year and location
  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState(currentYear);
  const [location, setLocation] = useState('');

  // Generate year options (current + 3 future years)
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

  // Get current user to check subscription
  const { data: me } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const hasActiveSubscription = me?.data?.subscription?.status === 'active' || me?.data?.subscription?.status === 'canceled';

  // Check if we have a cached solar for the selected year and location
  const { data: cachedCheck } = useQuery({
    queryKey: ['/api/astrology/solar/check', targetYear, location],
    queryFn: async () => {
      if (!location.trim()) return { cached: false };
      try {
        const response = await apiRequest('POST', '/api/astrology/solar/check', { targetYear, location: location.trim() });
        return response;
      } catch {
        return { cached: false };
      }
    },
    enabled: !!targetYear && !!location.trim(),
  });

  const hasCachedSolar = cachedCheck?.cached || false;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!location.trim()) {
        throw new Error(locale === 'ru' ? 'Укажите город' : 'Please enter a city');
      }
      const response = await apiRequest('POST', '/api/astrology/solar', { 
        locale,
        targetYear,
        location: location.trim(),
      });
      return response;
    },
    onSuccess: (response) => {
      setSolarData(response.data);
      setIsCached(response.cached || false);
      decreaseOrbs(15);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/astrology/solar/check'] });
      
      if (response.cached) {
        toast({
          title: locale === 'ru' ? 'Соляр загружен' : 'Solar Loaded',
          description: locale === 'ru' ? 'Показан сохраненный расчет' : 'Showing cached calculation',
        });
      } else {
        toast({
          title: t.solarToday.generated,
          description: t.solarToday.solarReady,
        });
      }
    },
    onError: (error: any) => {
      // Handle 409 errors (NATAL_NOT_INITIALIZED, NATAL_INCOMPLETE)
      if (error.response?.status === 409) {
        const errorCode = error.response?.data?.error;
        if (errorCode === 'NATAL_NOT_INITIALIZED') {
          toast({
            title: locale === 'ru' ? 'Натальная карта не создана' : 'Natal chart not created',
            description: locale === 'ru' 
              ? 'Сначала создайте натальную карту с точным временем и местом рождения' 
              : 'First create your natal chart with precise birth time and place',
            variant: 'destructive',
          });
          navigate('/natal-chart');
          return;
        }
        if (errorCode === 'NATAL_INCOMPLETE') {
          toast({
            title: locale === 'ru' ? 'Неполные данные' : 'Incomplete data',
            description: locale === 'ru' 
              ? 'Для соляра нужны точное время и место рождения' 
              : 'Solar return requires precise birth time and place',
            variant: 'destructive',
          });
          navigate('/settings');
          return;
        }
      }

      // Handle insufficient energy (402)
      if (error.response?.status === 402) {
        toast({
          title: locale === 'ru' ? 'Недостаточно звёзд' : 'Insufficient stars',
          description: locale === 'ru' ? 'Пополните баланс звёзд' : 'Please top up your stars',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t.solarToday.generationFailed,
        description: error.message || t.compatibility.tryAgain,
        variant: 'destructive',
      });
    },
  });

  // Reset solar data when year changes
  useEffect(() => {
    setSolarData(null);
  }, [targetYear]);

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
            <h1 className="text-2xl font-display font-bold">{t.solarToday.title}</h1>
            <p className="text-muted-foreground">{t.solarToday.subtitle}</p>
          </div>
        </div>

        {!solarData && (
          <Card className="p-8">
            <div className="mb-6 text-center">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-chart-4/20 to-chart-2/20 mb-4">
                <FeatureVignette kind="solar" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t.solarToday.generateTitle}</h2>
              <p className="text-muted-foreground mb-6">
                {t.solarToday.generateDescription}
              </p>
              
              {/* Cost badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {hasActiveSubscription ? (
                  <Badge variant="secondary" className="text-sm">
                    {locale === 'ru' ? '✨ Бесплатно по подписке' : '✨ Free with subscription'}
                  </Badge>
                ) : hasCachedSolar ? (
                  <Badge variant="secondary" className="text-sm">
                    {locale === 'ru' ? '✨ Бесплатно (сохранено)' : '✨ Free (cached)'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-sm">
                    {locale === 'ru' ? '💫 15 звёзд' : '💫 15 stars'}
                  </Badge>
                )}
              </div>

              {/* Hint about caching */}
              {!hasCachedSolar && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-left mb-6">
                  <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {locale === 'ru' 
                      ? 'Новый расчет соляра стоит 15 звёзд. Повторный просмотр этого же года — бесплатно.' 
                      : 'New solar return calculation costs 15 stars. Viewing the same year again is free.'}
                  </p>
                </div>
              )}
            </div>

            {/* Form inputs */}
            <div className="space-y-4 mb-6">
              {/* Year selector */}
              <div className="space-y-2">
                <Label htmlFor="year" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t.solarToday.selectYear}
                </Label>
                <Select 
                  value={targetYear.toString()} 
                  onValueChange={(value) => setTargetYear(parseInt(value))}
                >
                  <SelectTrigger id="year" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === currentYear ? (locale === 'ru' ? '(текущий)' : '(current)') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location input */}
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t.solarToday.location}
                </Label>
                <Input
                  id="location"
                  type="text"
                  placeholder={t.solarToday.locationPlaceholder}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-location"
                />
                <p className="text-xs text-muted-foreground">
                  {locale === 'ru' 
                    ? 'Укажите город, где вы планируете быть в день рождения. Это влияет на расчёт карты.' 
                    : 'Enter the city where you plan to be on your birthday. This affects chart calculation.'}
                </p>
              </div>
            </div>

            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !location.trim()}
              size="lg"
              className="w-full"
              data-testid="button-generate-solar"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {t.solarToday.calculating}
                </>
              ) : hasCachedSolar ? (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  {t.solarToday.viewCached}
                </>
              ) : hasActiveSubscription ? (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  {locale === 'ru' ? 'Рассчитать (бесплатно)' : 'Calculate (free)'}
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  {locale === 'ru' ? 'Рассчитать (−15 звёзд)' : 'Calculate (−15 stars)'}
                </>
              )}
            </Button>
          </Card>
        )}

        {solarData && (
          <div className="space-y-6">
            {/* Year and location info */}
            <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t.solarToday.forYear} {targetYear}
              </span>
              <span className="text-muted-foreground">•</span>
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{location}</span>
            </div>

            {/* Cached indicator */}
            {isCached && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-sm text-primary">
                  {locale === 'ru' 
                    ? '📅 Сохраненный расчет — звёзды не списаны' 
                    : '📅 Cached calculation — no stars deducted'}
                </p>
              </div>
            )}

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t.solarToday.todaysInfluence}</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {solarData.interpretation}
                </p>
              </div>
            </Card>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSolarData(null)}
              data-testid="button-regenerate"
            >
              {t.solarToday.refresh}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
