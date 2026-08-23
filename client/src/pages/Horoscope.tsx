import { useState } from 'react';
import { CostLine } from '@/components/CostLine';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader } from '@/components/Loader';
import { HoroscopeThemes } from '@/components/HoroscopeThemes';
import { WeeklyPlanModal } from '@/components/WeeklyPlanModal';
import { MonthlyPlanModal } from '@/components/MonthlyPlanModal';
import { ArrowLeft, MoonStar, Calendar, CalendarRange, Archive as ArchiveIcon } from 'lucide-react';
import { FeatureVignette } from '@/components/FeatureVignette';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';

interface HoroscopeData {
  money: string;
  work: string;
  study: string;
  love: string;
  health: string;
  self_care?: string;
}

export default function Horoscope() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const { decreaseOrbs } = useEnergy();
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');
  const [horoscopeData, setHoroscopeData] = useState<HoroscopeData | null>(null);
  const [weeklyPlanOpen, setWeeklyPlanOpen] = useState(false);
  const [monthlyPlanOpen, setMonthlyPlanOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      // Only for daily horoscope
      const response = await apiRequest('POST', '/api/astrology/horoscope', { 
        period: 'day', 
        locale 
      });
      return response.data;
    },
    onSuccess: (data) => {
      setHoroscopeData(data);
      decreaseOrbs(1);
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

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'day' | 'week' | 'month');
    setHoroscopeData(null);
  };

  const getPeriodTitle = () => {
    switch (activeTab) {
      case 'day':
        return t.horoscope.dailyTitle;
      case 'week':
        return t.horoscope.weeklyTitle;
      case 'month':
        return t.horoscope.monthlyTitle;
      default:
        return t.horoscope.title;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
          <Button
            variant="outline"
            onClick={() => navigate('/archive')}
            data-testid="button-archive"
          >
            <ArchiveIcon className="w-4 h-4 mr-2" />
            {t.horoscope.archive || 'Архив'}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="day" data-testid="tab-day">
              {t.horoscope.daily}
            </TabsTrigger>
            <TabsTrigger value="week" data-testid="tab-week">
              {t.horoscope.weekly}
            </TabsTrigger>
            <TabsTrigger value="month" data-testid="tab-month">
              {t.horoscope.monthly}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {/* For daily horoscope - show generate button */}
            {activeTab === 'day' && !horoscopeData && (
              <Card className="p-8">
                <div className="mb-6">
                  <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
                    <FeatureVignette kind="horoscope" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">{t.horoscope.generateTitle}</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    {getPeriodTitle()}
                  </p>

                  <CostLine>{t.horoscope.costOne}</CostLine>

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
                        <OrbIcon className="w-4 h-4 mr-2" />
                        {t.horoscope.generate}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {/* For weekly/monthly - show plan buttons directly */}
            {activeTab === 'week' && (
              <Card className="p-8">
                <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
                  <FeatureVignette kind="horoscope" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t.horoscope.weeklyTitle}</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {t.horoscope.weeklyDescription || 'Получите подробный план на всю неделю с рекомендациями по каждому дню'}
                </p>
                <CostLine>{t.horoscope.costWeekly}</CostLine>
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={() => setWeeklyPlanOpen(true)}
                  data-testid="button-weekly-plan"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {t.horoscope.getWeeklyPlan}
                </Button>
              </Card>
            )}

            {activeTab === 'month' && (
              <Card className="p-8">
                <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
                  <FeatureVignette kind="horoscope" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t.horoscope.monthlyTitle}</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {t.horoscope.monthlyDescription || 'Получите детальный прогноз на весь месяц с разбивкой по неделям'}
                </p>
                <CostLine>{t.horoscope.costMonthly}</CostLine>
                <Button
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={() => setMonthlyPlanOpen(true)}
                  data-testid="button-monthly-plan"
                >
                  <CalendarRange className="w-4 h-4 mr-2" />
                  {t.horoscope.getMonthlyPlan}
                </Button>
              </Card>
            )}

            {/* Daily horoscope result */}
            {activeTab === 'day' && horoscopeData && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-1">{getPeriodTitle()}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date().toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>

                  <HoroscopeThemes themes={horoscopeData} />
                </Card>

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
          </TabsContent>
        </Tabs>

        <WeeklyPlanModal 
          open={weeklyPlanOpen} 
          onOpenChange={setWeeklyPlanOpen} 
        />
        
        <MonthlyPlanModal 
          open={monthlyPlanOpen} 
          onOpenChange={setMonthlyPlanOpen} 
        />
      </div>
    </div>
  );
}
