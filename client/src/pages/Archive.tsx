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
  const [selectedReading, setSelectedReading] = useState<ArchiveReading | null>(null);

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
              <div className="space-y-4">
                {selectedReading.data.days.map((day: any, index: number) => (
                  <Card key={index} data-testid={`archive-day-${index}`}>
                    <CardHeader>
                      <CardTitle className="text-lg" data-testid={`archive-day-title-${index}`}>
                        {day.day_of_week} — {day.date}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div data-testid={`archive-day-money-${index}`}>
                        <strong>💰 Деньги:</strong> {day.money}
                      </div>
                      <div data-testid={`archive-day-work-${index}`}>
                        <strong>💼 Работа:</strong> {day.work}
                      </div>
                      <div data-testid={`archive-day-study-${index}`}>
                        <strong>📚 Учеба:</strong> {day.study}
                      </div>
                      <div data-testid={`archive-day-love-${index}`}>
                        <strong>❤️ Любовь:</strong> {day.love}
                      </div>
                      <div data-testid={`archive-day-health-${index}`}>
                        <strong>🏥 Здоровье:</strong> {day.health}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedReading?.period === 'month' && selectedReading.data?.weeks && (
              <div className="space-y-4">
                {selectedReading.data.weeks.map((week: any, index: number) => (
                  <Card key={index} data-testid={`archive-week-${index}`}>
                    <CardHeader>
                      <CardTitle className="text-lg" data-testid={`archive-week-title-${index}`}>
                        Неделя {index + 1}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div data-testid={`archive-week-money-${index}`}>
                        <strong>💰 Деньги:</strong> {week.money}
                      </div>
                      <div data-testid={`archive-week-work-${index}`}>
                        <strong>💼 Работа:</strong> {week.work}
                      </div>
                      <div data-testid={`archive-week-study-${index}`}>
                        <strong>📚 Учеба:</strong> {week.study}
                      </div>
                      <div data-testid={`archive-week-love-${index}`}>
                        <strong>❤️ Любовь:</strong> {week.love}
                      </div>
                      <div data-testid={`archive-week-health-${index}`}>
                        <strong>🏥 Здоровье:</strong> {week.health}
                      </div>
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
