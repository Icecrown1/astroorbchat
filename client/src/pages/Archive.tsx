import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar, Eye, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "@/contexts/LocaleContext";

interface ArchiveReading {
  id: string;
  period: 'week' | 'month';
  startDate: string;
  endDate: string;
  data: any;
  createdAt: string;
}

export default function Archive() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { locale } = useTranslation();
  const [selectedReading, setSelectedReading] = useState<ArchiveReading | null>(null);

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

  const { data: archive, isLoading } = useQuery<{ ok: boolean; data: ArchiveReading[] }>({
    queryKey: ['/api/astrology/horoscope/archive'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/astrology/horoscope/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/astrology/horoscope/archive'] });
      toast({
        title: "План удален",
        description: "План успешно удален из архива",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить план",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4" data-testid="archive-loading">
        <p className="text-center text-muted-foreground">Загрузка архива...</p>
      </div>
    );
  }

  const readings = archive?.data || [];

  return (
    <div className="container max-w-4xl mx-auto p-4" data-testid="archive-page">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/horoscope')}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="archive-title">Архив планов</h1>
          <p className="text-muted-foreground" data-testid="archive-description">
            Ваши сохраненные недельные и месячные планы
          </p>
        </div>
      </div>

      {readings.length === 0 ? (
        <Card data-testid="archive-empty">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              У вас пока нет сохраненных планов
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {readings.map((reading) => (
            <Card key={reading.id} data-testid={`archive-item-${reading.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle data-testid={`archive-item-title-${reading.id}`}>
                        {reading.period === 'week' ? 'Недельный план' : 'Месячный план'}
                      </CardTitle>
                      <Badge variant="secondary" data-testid={`archive-item-badge-${reading.id}`}>
                        {reading.period === 'week' ? 'Неделя' : 'Месяц'}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2" data-testid={`archive-item-date-${reading.id}`}>
                      <Calendar className="w-4 h-4" />
                      {reading.startDate} — {reading.endDate}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedReading(reading)}
                      data-testid={`button-view-${reading.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteMutation.mutate(reading.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${reading.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!selectedReading} onOpenChange={() => setSelectedReading(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="archive-view-dialog">
          <DialogHeader>
            <DialogTitle data-testid="archive-view-dialog-title">
              {selectedReading?.period === 'week' ? 'Недельный план' : 'Месячный план'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground" data-testid="archive-view-dialog-date">
              {selectedReading?.startDate} — {selectedReading?.endDate}
            </p>
          </DialogHeader>
          
          <div className="space-y-4" data-testid="archive-view-dialog-content">
            {selectedReading?.period === 'week' && selectedReading.data?.days && (
              <Accordion type="single" collapsible className="w-full">
                {selectedReading.data.days.map((day: any, index: number) => (
                  <AccordionItem 
                    key={day.date} 
                    value={`day-${index}`}
                    data-testid={`archive-accordion-day-${index}`}
                  >
                    <AccordionTrigger 
                      className="hover:no-underline"
                      data-testid={`archive-accordion-trigger-day-${index}`}
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
                          <div className="text-xs text-muted-foreground">
                            {new Date(day.date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 space-y-3 pl-16">
                        <div className="text-sm">
                          <span className="font-semibold text-primary">💰 Деньги:</span>
                          <p className="text-muted-foreground mt-1">{day.money}</p>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-primary">💼 Работа:</span>
                          <p className="text-muted-foreground mt-1">{day.work}</p>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-primary">📚 Учеба:</span>
                          <p className="text-muted-foreground mt-1">{day.study}</p>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-primary">💕 Любовь:</span>
                          <p className="text-muted-foreground mt-1">{day.love}</p>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-primary">🏥 Здоровье:</span>
                          <p className="text-muted-foreground mt-1">{day.health}</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {selectedReading?.period === 'month' && selectedReading.data && (
              <div className="space-y-6">
                {selectedReading.data.overview && (
                  <div className="p-4 bg-muted/50 rounded-lg" data-testid="archive-month-overview">
                    <h3 className="font-semibold mb-2 text-primary">Обзор месяца</h3>
                    <p className="text-sm text-muted-foreground">{selectedReading.data.overview}</p>
                  </div>
                )}

                {selectedReading.data.weeks && selectedReading.data.weeks.map((week: any, index: number) => (
                  <Card key={index} className="overflow-hidden" data-testid={`archive-week-${index}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2" data-testid={`archive-week-title-${index}`}>
                            <span className="text-primary">{week.week_number}</span>
                            <span className="text-muted-foreground font-normal">НЕДЕЛЯ</span>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{week.dates}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground">{week.summary}</p>
                      </div>
                      
                      {week.key_themes && week.key_themes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {week.key_themes.map((theme: string, themeIndex: number) => (
                            <Badge 
                              key={themeIndex} 
                              variant="secondary" 
                              className="text-xs"
                              data-testid={`archive-week-theme-${index}-${themeIndex}`}
                            >
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
