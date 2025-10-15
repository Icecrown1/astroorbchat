import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/Loader';
import { CalendarRange, Lock } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useQuery } from '@tanstack/react-query';

interface WeekPlan {
  week_number: number;
  dates: string;
  summary: string;
  key_themes: string[];
}

interface MonthlyPlanData {
  month: string;
  overview: string;
  weeks: WeekPlan[];
}

interface MonthlyPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonthlyPlanModal({ open, onOpenChange }: MonthlyPlanModalProps) {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [planData, setPlanData] = useState<MonthlyPlanData | null>(null);

  const { data: user } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const hasSubscription = (user as any)?.subscription?.status === 'active';

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/horoscope/monthly-plan', { 
        locale 
      });
      return response.data;
    },
    onSuccess: (data) => {
      setPlanData(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.horoscope.generated,
        description: t.horoscope.forecastReady,
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('Insufficient energy')) {
        toast({
          title: t.common.error,
          description: t.dashboard.needMoreEnergy,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t.horoscope.generationFailed,
          description: error.message || t.compatibility.tryAgain,
          variant: 'destructive',
        });
      }
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setPlanData(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-monthly-plan">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5" />
            {t.horoscope.monthlyPlan}
          </DialogTitle>
          <DialogDescription>
            {planData 
              ? planData.month
              : t.horoscope.planningFor
            }
          </DialogDescription>
        </DialogHeader>

        {!planData && (
          <div className="py-8">
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                {t.horoscope.monthlyTitle}
              </p>
              
              {!hasSubscription && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium mb-4">
                  <Lock className="w-4 h-4" />
                  {t.horoscope.costOne}
                </div>
              )}

              {hasSubscription && (
                <p className="text-sm text-chart-2 font-medium mb-4">
                  {t.subscribe.freeForSubscribers}
                </p>
              )}
            </div>

            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              size="lg"
              className="w-full"
              data-testid="button-generate-monthly-plan"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {t.horoscope.generating}
                </>
              ) : (
                <>
                  <CalendarRange className="w-4 h-4 mr-2" />
                  {t.horoscope.getMonthlyPlan}
                </>
              )}
            </Button>
          </div>
        )}

        {planData && (
          <div className="space-y-6 py-4">
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-chart-2/10 border-primary/20">
              <h4 className="text-sm font-semibold mb-2 text-primary">
                {locale === 'ru' ? 'Обзор месяца' : 'Monthly Overview'}
              </h4>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {planData.overview}
              </p>
            </Card>

            <div className="space-y-4">
              {planData.weeks.map((week, index) => (
                <Card 
                  key={week.week_number} 
                  className="p-4 hover-elevate" 
                  data-testid={`card-week-${index}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-2xl font-bold text-primary">
                        {week.week_number}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        {locale === 'ru' ? 'Неделя' : 'Week'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-2">{week.dates}</div>
                      <h4 className="text-sm font-semibold mb-2">{week.summary}</h4>
                      {week.key_themes && week.key_themes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {week.key_themes.map((theme, idx) => (
                            <span 
                              key={idx} 
                              className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={handleClose}
              data-testid="button-close"
            >
              {t.common.close}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
