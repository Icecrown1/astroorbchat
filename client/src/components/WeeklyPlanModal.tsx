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
import { Calendar, Lock } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useQuery } from '@tanstack/react-query';

interface DayPlan {
  date: string;
  day_of_week: string;
  money: string;
  work: string;
  study: string;
  love: string;
  health: string;
}

interface WeeklyPlanData {
  week_start: string;
  week_end: string;
  days: DayPlan[];
}

interface WeeklyPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeeklyPlanModal({ open, onOpenChange }: WeeklyPlanModalProps) {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [planData, setPlanData] = useState<WeeklyPlanData | null>(null);

  const { data: user } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const hasSubscription = (user as any)?.subscription?.status === 'active' || (user as any)?.subscription?.status === 'canceled';

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/horoscope/weekly-plan', { 
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-weekly-plan">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t.horoscope.weeklyPlan}
          </DialogTitle>
          <DialogDescription>
            {planData 
              ? `${formatDate(planData.week_start)} - ${formatDate(planData.week_end)}`
              : t.horoscope.planningFor
            }
          </DialogDescription>
        </DialogHeader>

        {!planData && (
          <div className="py-8">
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                {t.horoscope.weeklyTitle}
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm font-medium mb-4">
                {hasSubscription ? (
                  <span className="text-chart-3">
                    {locale === 'ru' ? '✨ БЕСПЛАТНО для подписчиков' : '✨ FREE for subscribers'}
                  </span>
                ) : (
                  <span className="text-primary flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {t.horoscope.costOne}
                  </span>
                )}
              </div>

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
              data-testid="button-generate-weekly-plan"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {t.horoscope.generating}
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  {t.horoscope.getWeeklyPlan}
                </>
              )}
            </Button>
          </div>
        )}

        {planData && (
          <div className="space-y-4 py-4">
            {planData.days.map((day, index) => (
              <Card 
                key={day.date} 
                className="p-4" 
                data-testid={`card-day-${index}`}
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="text-center min-w-[60px]">
                    <div className="text-2xl font-bold text-primary">
                      {new Date(day.date).getDate()}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase">
                      {day.day_of_week}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold text-primary">💰 {t.horoscope.money}:</span>
                      <p className="text-muted-foreground mt-1">{day.money}</p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-primary">💼 {t.horoscope.work}:</span>
                      <p className="text-muted-foreground mt-1">{day.work}</p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-primary">📚 {t.horoscope.study}:</span>
                      <p className="text-muted-foreground mt-1">{day.study}</p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-primary">💕 {t.horoscope.love}:</span>
                      <p className="text-muted-foreground mt-1">{day.love}</p>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-primary">🏥 {t.horoscope.health}:</span>
                      <p className="text-muted-foreground mt-1">{day.health}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

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
