import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Sun, Info } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';

export default function SolarToday() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [solarData, setSolarData] = useState<any>(null);
  const [isCached, setIsCached] = useState(false);

  // Get current user to check subscription
  const { data: me } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const hasActiveSubscription = me?.subscription?.status === 'active' || me?.subscription?.status === 'canceled';

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/solar', { locale });
      return response;
    },
    onSuccess: (response) => {
      setSolarData(response.data);
      setIsCached(response.cached || false);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      
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
          title: locale === 'ru' ? 'Недостаточно орбов' : 'Insufficient orbs',
          description: locale === 'ru' ? 'Пополните баланс орбов' : 'Please top up your orbs',
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
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-chart-4/20 to-chart-2/20 mb-4">
                <Sun className="w-12 h-12 text-chart-4" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t.solarToday.generateTitle}</h2>
              <p className="text-muted-foreground mb-4">
                {t.solarToday.generateDescription}
              </p>
              
              {/* Cost badge */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {hasActiveSubscription ? (
                  <Badge variant="secondary" className="text-sm">
                    {locale === 'ru' ? '✨ Бесплатно по подписке' : '✨ Free with subscription'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-sm">
                    {locale === 'ru' ? '💫 15 орбов' : '💫 15 orbs'}
                  </Badge>
                )}
              </div>

              {/* Hint about caching */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-left mb-4">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {locale === 'ru' 
                    ? 'Новый расчет соляра стоит 15 орбов. Повторный просмотр этого же года — бесплатно.' 
                    : 'New solar return calculation costs 15 orbs. Viewing the same year again is free.'}
                </p>
              </div>
            </div>

            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              size="lg"
              data-testid="button-generate-solar"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {t.solarToday.calculating}
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  {hasActiveSubscription 
                    ? (locale === 'ru' ? 'Рассчитать (бесплатно)' : 'Calculate (free)')
                    : (locale === 'ru' ? 'Рассчитать (−15 орбов)' : 'Calculate (−15 orbs)')}
                </>
              )}
            </Button>
          </Card>
        )}

        {solarData && (
          <div className="space-y-6">
            {/* Cached indicator */}
            {isCached && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-sm text-primary">
                  {locale === 'ru' 
                    ? '📅 Сохраненный расчет — орбы не списаны' 
                    : '📅 Cached calculation — no orbs deducted'}
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

            {solarData.insights && solarData.insights.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">{t.solarToday.keyInsights}</h2>
                <div className="space-y-3">
                  {solarData.insights.map((insight: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10"
                    >
                      <Sun className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">{insight}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

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
