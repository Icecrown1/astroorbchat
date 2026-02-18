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
import { CalendarRange, Lock, Calendar } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

interface WeekPlan {
  week_number: number;
  dates: string;
  summary: string;
  key_themes: string[];
  week_start_iso: string;
  week_end_iso: string;
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
  const { decreaseOrbs } = useEnergy();
  const [planData, setPlanData] = useState<MonthlyPlanData | null>(null);
  const [weeklyDetails, setWeeklyDetails] = useState<{ [key: number]: WeeklyPlanData }>({});
  const [loadingWeeks, setLoadingWeeks] = useState<Set<number>>(new Set());

  const { data: user } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const hasSubscription = (user as any)?.subscription?.status === 'active' || (user as any)?.subscription?.status === 'canceled';

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/horoscope/monthly-plan', { 
        locale 
      });
      return response.data;
    },
    onSuccess: (data) => {
      setPlanData(data);
      decreaseOrbs(15);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/astrology/horoscope/archive'] });
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

  const weeklyMutation = useMutation({
    mutationFn: async ({ weekNumber, weekStart, weekEnd }: { weekNumber: number; weekStart: string; weekEnd: string }) => {
      setLoadingWeeks(prev => new Set(prev).add(weekNumber));
      const response = await apiRequest('POST', '/api/astrology/horoscope/weekly-plan', { 
        week_start_iso: weekStart,
        week_end_iso: weekEnd,
        locale 
      });
      return { weekNumber, data: response.data };
    },
    onSuccess: ({ weekNumber, data }) => {
      setWeeklyDetails(prev => ({ ...prev, [weekNumber]: data }));
      setLoadingWeeks(prev => {
        const newSet = new Set(prev);
        newSet.delete(weekNumber);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.horoscope.generated,
        description: locale === 'ru' ? 'Детальный прогноз недели готов' : 'Detailed week forecast ready',
      });
    },
    onError: (error: any, { weekNumber }) => {
      setLoadingWeeks(prev => {
        const newSet = new Set(prev);
        newSet.delete(weekNumber);
        return newSet;
      });
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
    setWeeklyDetails({});
    setLoadingWeeks(new Set());
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDayAbbreviation = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    
    if (locale === 'ru') {
      const ruAbbreviations = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
      return ruAbbreviations[dayOfWeek];
    } else {
      const enAbbreviations = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      return enAbbreviations[dayOfWeek];
    }
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
              {planData.weeks.map((week, index) => {
                const weekDetails = weeklyDetails[week.week_number];
                
                return (
                  <Card 
                    key={week.week_number} 
                    className="p-4" 
                    data-testid={`card-week-${index}`}
                  >
                    <div className="flex items-start gap-4 mb-3">
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
                          <div className="flex flex-wrap gap-2 mt-2 mb-3">
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
                        
                        {!weekDetails && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => weeklyMutation.mutate({ 
                              weekNumber: week.week_number, 
                              weekStart: week.week_start_iso,
                              weekEnd: week.week_end_iso
                            })}
                            disabled={loadingWeeks.has(week.week_number)}
                            className="mt-2"
                            data-testid={`button-calculate-week-${index}`}
                          >
                            {loadingWeeks.has(week.week_number) ? (
                              <>
                                <Loader className="mr-2" size="sm" />
                                {locale === 'ru' ? 'Расчёт...' : 'Calculating...'}
                              </>
                            ) : (
                              <>
                                <Calendar className="w-3 h-3 mr-2" />
                                {locale === 'ru' ? `Рассчитать ${week.week_number} неделю` : `Calculate week ${week.week_number}`}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {weekDetails && (
                      <div className="mt-4 pt-4 border-t">
                        <h5 className="text-sm font-semibold mb-3 text-primary">
                          {locale === 'ru' ? 'Детальный прогноз:' : 'Detailed Forecast:'}
                        </h5>
                        <Accordion type="single" collapsible className="w-full">
                          {weekDetails.days.map((day, dayIndex) => (
                            <AccordionItem 
                              key={day.date} 
                              value={`day-${dayIndex}`}
                              data-testid={`accordion-day-${week.week_number}-${dayIndex}`}
                            >
                              <AccordionTrigger 
                                className="hover:no-underline"
                                data-testid={`accordion-trigger-day-${week.week_number}-${dayIndex}`}
                              >
                                <div className="flex items-center gap-3 w-full pr-4">
                                  <div className="text-center min-w-[50px]">
                                    <div className="text-xl font-bold text-primary">
                                      {new Date(day.date).getDate()}
                                    </div>
                                    <div className="text-xs text-muted-foreground uppercase">
                                      {getDayAbbreviation(day.date)}
                                    </div>
                                  </div>
                                  <div className="text-left flex-1">
                                    <div className="font-medium">{day.day_of_week}</div>
                                    <div className="text-xs text-muted-foreground">{formatDate(day.date)}</div>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="pt-2 space-y-3 pl-16">
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
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}
                  </Card>
                );
              })}
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
