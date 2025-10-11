import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';

export default function Horoscope() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [horoscopeData, setHoroscopeData] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/horoscope', { period });
      return response.data;
    },
    onSuccess: (data) => {
      setHoroscopeData(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.horoscope.generated,
        description: t.horoscope.forecastReady,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.horoscope.generationFailed,
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
            <h1 className="text-2xl font-display font-bold">{t.horoscope.title}</h1>
            <p className="text-muted-foreground">{t.horoscope.subtitle}</p>
          </div>
        </div>

        {!horoscopeData && (
          <Card className="p-8">
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-4">{t.horoscope.generateTitle}</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">{t.horoscope.timePeriod}</label>
                <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                  <SelectTrigger data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">{t.horoscope.daily}</SelectItem>
                    <SelectItem value="week">{t.horoscope.weekly}</SelectItem>
                    <SelectItem value="month">{t.horoscope.monthly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-primary font-medium mb-6">
                {t.horoscope.costOne}
              </p>

              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                size="lg"
                className="w-full"
                data-testid="button-generate-horoscope"
              >
                {mutation.isPending ? (
                  <>
                    <Loader className="mr-2" size="sm" />
                    {t.horoscope.generating}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t.horoscope.generate}
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {horoscopeData && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">
                  {period === 'day' && t.horoscope.dailyTitle}
                  {period === 'week' && t.horoscope.weeklyTitle}
                  {period === 'month' && t.horoscope.monthlyTitle}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {horoscopeData.period || period}
                </p>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {horoscopeData.forecast}
                </p>
              </div>
            </Card>

            {horoscopeData.highlights && horoscopeData.highlights.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">{t.horoscope.highlights}</h2>
                <div className="space-y-2">
                  {horoscopeData.highlights.map((highlight: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                    >
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm">{highlight}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setHoroscopeData(null)}
              data-testid="button-regenerate"
            >
              {t.horoscope.generateNew}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
