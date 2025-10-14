import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImportantDates, ImportantEvent } from '@/lib/importantDatesApi';
import { useTranslation } from '@/contexts/LocaleContext';
import { translatePlanet, translateSign } from '@/lib/astroTranslations';
import { ImportantDateModal } from './ImportantDateModal';
import { Loader } from './Loader';

export function ImportantDatesList() {
  const { locale } = useTranslation();
  const [selectedEvent, setSelectedEvent] = useState<ImportantEvent | null>(null);

  const { data: events, isLoading } = useQuery<ImportantEvent[]>({
    queryKey: ['/api/astrology/important-dates'],
    queryFn: getImportantDates,
  });

  if (isLoading) {
    return <Loader />;
  }

  if (!events || events.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          {locale === 'ru' 
            ? 'Важных дат не найдено в ближайшие 3 месяца' 
            : 'No important dates found in the next 3 months'}
        </p>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getEventTypeLabel = (kind: string) => {
    const labels: Record<string, { en: string; ru: string }> = {
      retrograde: { en: 'Retrograde', ru: 'Ретроград' },
      direct: { en: 'Direct', ru: 'Директное движение' },
      ingress: { en: 'Sign Change', ru: 'Смена знака' },
      conjunction: { en: 'Conjunction', ru: 'Соединение' },
      opposition: { en: 'Opposition', ru: 'Оппозиция' },
      trine: { en: 'Trine', ru: 'Трин' },
      square: { en: 'Square', ru: 'Квадрат' },
      sextile: { en: 'Sextile', ru: 'Секстиль' },
    };
    return labels[kind]?.[locale] || kind;
  };

  return (
    <>
      <div className="space-y-3">
        {events.map((event) => (
          <Card
            key={event.key}
            className={cn(
              'relative p-4 cursor-pointer transition-all',
              'hover-elevate active-elevate-2',
              !event.unlocked && 'opacity-80'
            )}
            onClick={() => setSelectedEvent(event)}
            data-testid={`card-important-date-${event.key}`}
          >
            {!event.unlocked && (
              <div className="absolute top-3 right-3">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className={cn(
                'p-2 rounded-lg shrink-0',
                event.kind === 'retrograde' ? 'bg-destructive/10' : 'bg-primary/10'
              )}>
                {event.kind === 'retrograde' || event.kind === 'direct' ? (
                  <TrendingUp className={cn(
                    'w-5 h-5',
                    event.kind === 'retrograde' ? 'text-destructive rotate-180' : 'text-primary'
                  )} />
                ) : (
                  <Calendar className="w-5 h-5 text-primary" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <h4 className="font-semibold text-card-foreground mb-1">
                      {translatePlanet(event.planet, locale)} {getEventTypeLabel(event.kind)}
                      {event.sign && ` ${locale === 'ru' ? 'в' : 'in'} ${translateSign(event.sign, locale)}`}
                    </h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(event.date)}
                    </p>
                  </div>
                  {!event.unlocked && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      1 {locale === 'ru' ? 'орб' : 'orb'}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mt-2">
                  {event.brief}
                </p>

                {event.natalTarget && (
                  <p className="text-xs text-primary mt-2">
                    {locale === 'ru' ? 'Влияет на' : 'Affects'}: {translatePlanet(event.natalTarget.planet, locale)}
                    {event.natalTarget.aspect && ` (${getEventTypeLabel(event.natalTarget.aspect)})`}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedEvent && (
        <ImportantDateModal
          event={selectedEvent}
          open={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}
