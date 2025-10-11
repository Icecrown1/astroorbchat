import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Sun } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';

export default function SolarToday() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [solarData, setSolarData] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/solar', { locale });
      return response.data;
    },
    onSuccess: (data) => {
      setSolarData(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.solarToday.generated,
        description: t.solarToday.solarReady,
      });
    },
    onError: (error: any) => {
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
              <p className="text-sm text-primary font-medium">
                {t.solarToday.costOne}
              </p>
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
                  {t.solarToday.generate}
                </>
              )}
            </Button>
          </Card>
        )}

        {solarData && (
          <div className="space-y-6">
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
