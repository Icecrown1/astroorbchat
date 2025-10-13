import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuestChartForm } from '@/components/GuestChartForm';
import { ArrowLeft, Users } from 'lucide-react';
import { useTranslation } from '@/contexts/LocaleContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function GuestNatalCharts() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();

  // Load saved guest charts
  const { data: guestChartsResponse } = useQuery<any>({
    queryKey: ['/api/natal/external'],
  });

  const guestCharts = guestChartsResponse?.data || [];

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
            <h1 className="text-2xl font-display font-bold">
              {locale === 'ru' ? 'Гостевые натальные карты' : 'Guest Natal Charts'}
            </h1>
            <p className="text-muted-foreground">
              {locale === 'ru' 
                ? 'Создавайте карты для друзей и партнёров' 
                : 'Create charts for friends and partners'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" data-testid="tab-create">
              {locale === 'ru' ? 'Создать карту' : 'Create Chart'}
            </TabsTrigger>
            <TabsTrigger value="saved" data-testid="tab-saved">
              {locale === 'ru' ? 'Сохранённые' : 'Saved'} ({guestCharts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <Card className="p-6">
              <div className="mb-6">
                <div className="inline-flex p-3 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  {locale === 'ru' ? 'Создать гостевую карту' : 'Create Guest Chart'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' 
                    ? 'Введите данные рождения для создания натальной карты. Стоимость: 1 орб' 
                    : 'Enter birth data to create a natal chart. Cost: 1 orb'}
                </p>
              </div>
              <GuestChartForm />
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="mt-6">
            {guestCharts.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {locale === 'ru' 
                    ? 'У вас пока нет сохранённых гостевых карт' 
                    : 'You have no saved guest charts yet'}
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {guestCharts.map((chart: any) => (
                  <Card key={chart.id} className="p-4 hover-elevate" data-testid={`guest-chart-${chart.id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{chart.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(chart.birthdayDate).toLocaleDateString(locale)}
                        </p>
                        {chart.birthPlace && (
                          <p className="text-sm text-muted-foreground">{chart.birthPlace}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/compatibility?guestId=${chart.id}`)}
                        data-testid={`button-use-chart-${chart.id}`}
                      >
                        {locale === 'ru' ? 'Использовать' : 'Use'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
