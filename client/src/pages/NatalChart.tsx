import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuestChartForm } from '@/components/GuestChartForm';
import { ArrowLeft, Users, Trash2 } from 'lucide-react';
import { FeatureVignette } from '@/components/FeatureVignette';
import { useTranslation } from '@/contexts/LocaleContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GuestNatalCharts() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chartToDelete, setChartToDelete] = useState<string | null>(null);

  // Load saved guest charts
  const { data: guestChartsResponse } = useQuery<any>({
    queryKey: ['/api/natal/external'],
  });

  const guestCharts = guestChartsResponse?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (chartId: string) => {
      return await apiRequest('DELETE', `/api/natal/external/${chartId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/natal/external'] });
      toast({
        title: locale === 'ru' ? 'Карта удалена' : 'Chart deleted',
        description: locale === 'ru' 
          ? 'Гостевая карта успешно удалена' 
          : 'Guest chart has been deleted successfully',
      });
      setDeleteDialogOpen(false);
      setChartToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: locale === 'ru' ? 'Ошибка' : 'Error',
        description: error.message || (locale === 'ru' ? 'Не удалось удалить карту' : 'Failed to delete chart'),
        variant: 'destructive',
      });
    },
  });

  const handleDeleteClick = (chartId: string) => {
    setChartToDelete(chartId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (chartToDelete) {
      deleteMutation.mutate(chartToDelete);
    }
  };

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
                  <FeatureVignette kind="guest" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  {locale === 'ru' ? 'Создать гостевую карту' : 'Create Guest Chart'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' 
                    ? 'Введите данные рождения для создания натальной карты. Стоимость: 20 звёзд' 
                    : 'Enter birth data to create a natal chart. Cost: 20 stars'}
                </p>
              </div>
              <GuestChartForm />
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="mt-6">
            {guestCharts.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="flex justify-center mb-4"><FeatureVignette kind="guest" /></div>
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
                      <div className="flex-1">
                        <h3 className="font-semibold">{chart.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(chart.birthdayDate).toLocaleDateString(locale)}
                        </p>
                        {chart.birthPlace && (
                          <p className="text-sm text-muted-foreground">{chart.birthPlace}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/guest-chart/${chart.id}`)}
                          data-testid={`button-view-chart-${chart.id}`}
                        >
                          {locale === 'ru' ? 'Посмотреть' : 'View'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/compatibility?guestId=${chart.id}`)}
                          data-testid={`button-use-chart-${chart.id}`}
                        >
                          {locale === 'ru' ? 'Совместимость' : 'Compatibility'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(chart.id)}
                          data-testid={`button-delete-chart-${chart.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === 'ru' ? 'Удалить гостевую карту?' : 'Delete guest chart?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === 'ru' 
                ? 'Это действие нельзя отменить. Карта будет удалена навсегда.' 
                : 'This action cannot be undone. The chart will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending 
                ? (locale === 'ru' ? 'Удаление...' : 'Deleting...') 
                : (locale === 'ru' ? 'Удалить' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
