import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { Trash2, Eye, Heart, Users, Briefcase, Home } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { CompatibilityRating } from '@/components/CompatibilityRating';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import 'dayjs/locale/ru.js';

dayjs.extend(relativeTime);

interface CompatibilityReading {
  id: string;
  partnerName: string;
  partnerGender: string;
  partnerDate: string;
  relationshipType: 'romantic' | 'friendship' | 'work' | 'family';
  analysis: string;
  compatibilityRating: string | null;
  isProfessional: boolean;
  createdAt: string;
  professionalInterpretation?: any;
  houseOverlays?: any;
}

interface CompatibilityArchiveProps {
  onViewReading: (reading: CompatibilityReading) => void;
}

export function CompatibilityArchive({ onViewReading }: CompatibilityArchiveProps) {
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  dayjs.locale(locale);

  const { data: readings, isLoading } = useQuery<{ ok: boolean; data: CompatibilityReading[] }>({
    queryKey: ['/api/compatibility/history'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/compatibility/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compatibility/history'] });
      toast({
        title: locale === 'ru' ? "Анализ удален" : "Analysis deleted",
        description: locale === 'ru' ? "Анализ совместимости успешно удален" : "Compatibility analysis deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: locale === 'ru' ? "Ошибка удаления" : "Deletion failed",
        description: error.message || (locale === 'ru' ? "Попробуйте снова" : "Try again"),
        variant: 'destructive',
      });
    },
  });

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'romantic':
        return <Heart className="w-4 h-4" />;
      case 'friendship':
        return <Users className="w-4 h-4" />;
      case 'work':
        return <Briefcase className="w-4 h-4" />;
      case 'family':
        return <Home className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRelationshipLabel = (type: string) => {
    const labels: Record<string, { ru: string; en: string }> = {
      romantic: { ru: 'Романтические', en: 'Romantic' },
      friendship: { ru: 'Дружба', en: 'Friendship' },
      work: { ru: 'Рабочие', en: 'Work' },
      family: { ru: 'Семья', en: 'Family' },
    };
    return labels[type]?.[locale] || type;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  if (!readings?.data || readings.data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">
          {locale === 'ru' ? 'Нет сохраненных анализов' : 'No saved analyses'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {locale === 'ru' 
            ? 'Ваши анализы совместимости будут храниться здесь в течение 2 недель'
            : 'Your compatibility analyses will be stored here for 2 weeks'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-4">
        {locale === 'ru' 
          ? `Сохранено анализов: ${readings.data.length} • Автоудаление через 2 недели`
          : `Saved analyses: ${readings.data.length} • Auto-delete after 2 weeks`}
      </p>

      {readings.data.map((reading) => (
        <Card key={reading.id} className="p-6" data-testid={`compatibility-archive-${reading.id}`}>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold" data-testid={`text-partner-name-${reading.id}`}>
                {reading.partnerName}
              </h3>
              {reading.isProfessional && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  PRO
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                {getRelationshipIcon(reading.relationshipType)}
                <span>{getRelationshipLabel(reading.relationshipType)}</span>
              </div>
              <span>•</span>
              <span>{dayjs(reading.partnerDate).format('DD.MM.YYYY')}</span>
              <span>•</span>
              <span>{dayjs(reading.createdAt).fromNow()}</span>
            </div>

            {reading.compatibilityRating && (
              <div className="mb-3">
                <CompatibilityRating 
                  rating={parseFloat(reading.compatibilityRating)} 
                  relationshipType={reading.relationshipType}
                  locale={locale}
                  compact={true}
                />
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {reading.analysis.slice(0, 150)}...
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewReading(reading)}
              className="flex-1"
              data-testid={`button-view-${reading.id}`}
            >
              <Eye className="w-4 h-4 mr-2" />
              {locale === 'ru' ? 'Посмотреть' : 'View'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate(reading.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${reading.id}`}
            >
              {deleteMutation.isPending ? (
                <Loader size="sm" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
