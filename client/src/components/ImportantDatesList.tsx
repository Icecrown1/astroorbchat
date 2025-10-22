import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Moon, Sparkles, ArrowRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImportantDates, ImportantEvent } from '@/lib/importantDatesApi';
import { useTranslation } from '@/contexts/LocaleContext';
import { translatePlanet, translateSign } from '@/lib/astroTranslations';
import { Loader } from './Loader';

export function ImportantDatesList() {
  const { locale } = useTranslation();

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
            ? 'Важных дат не найдено в ближайшие 2 месяца' 
            : 'No important dates found in the next 2 months'}
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

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'new_moon':
        return <Moon className="w-4 h-4 text-primary" />;
      case 'full_moon':
        return <Moon className="w-4 h-4 text-primary fill-current" />;
      case 'planet_transit':
        return <ArrowRight className="w-4 h-4 text-primary" />;
      default:
        return <Calendar className="w-4 h-4 text-primary" />;
    }
  };

  const getEventTitle = (event: ImportantEvent) => {
    if (event.type === 'new_moon') {
      return locale === 'ru' 
        ? `Новолуние в ${translateSign(event.sign, locale)}`
        : `New Moon in ${translateSign(event.sign, locale)}`;
    }
    if (event.type === 'full_moon') {
      return locale === 'ru'
        ? `Полнолуние в ${translateSign(event.sign, locale)}`
        : `Full Moon in ${translateSign(event.sign, locale)}`;
    }
    if (event.type === 'planet_transit' && event.planet) {
      const planet = translatePlanet(event.planet, locale);
      const toSign = event.to_sign ? translateSign(event.to_sign, locale) : '';
      return locale === 'ru'
        ? `${planet} входит в ${toSign}`
        : `${planet} enters ${toSign}`;
    }
    return '';
  };

  const getEventDescription = (event: ImportantEvent) => {
    const house = event.house_for_sun_sign;
    
    if (event.type === 'new_moon' || event.type === 'full_moon') {
      const phaseType = event.type === 'new_moon' 
        ? (locale === 'ru' ? 'Новолуние' : 'New Moon')
        : (locale === 'ru' ? 'Полнолуние' : 'Full Moon');
      
      if (house) {
        return locale === 'ru'
          ? `${phaseType} в ${house}-м доме — время обновления в этой сфере жизни`
          : `${phaseType} in ${house}${getOrdinalSuffix(house)} house — time for renewal in this life area`;
      }
      
      return locale === 'ru'
        ? `${phaseType} — важный момент для новых начинаний`
        : `${phaseType} — significant moment for new beginnings`;
    }
    
    if (event.type === 'planet_transit' && event.planet) {
      const planet = translatePlanet(event.planet, locale);
      const toSign = event.to_sign ? translateSign(event.to_sign, locale) : '';
      
      if (house) {
        return locale === 'ru'
          ? `${planet} переходит в ${toSign} (${house}-й дом) — новая энергия в этой области`
          : `${planet} transits into ${toSign} (${house}${getOrdinalSuffix(house)} house) — new energy in this area`;
      }
      
      return locale === 'ru'
        ? `${planet} входит в ${toSign} — смена энергии`
        : `${planet} enters ${toSign} — energy shift`;
    }
    
    return '';
  };

  const getOrdinalSuffix = (num: number) => {
    if (num === 1) return 'st';
    if (num === 2) return 'nd';
    if (num === 3) return 'rd';
    return 'th';
  };

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const eventDate = new Date(event.date);
        const day = eventDate.getDate();
        const month = eventDate.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short' });
        const isHighImportance = event.importance === 'high';
        
        return (
          <Card
            key={`${event.type}-${event.date}-${index}`}
            className={cn(
              'relative p-4 transition-all',
              isHighImportance && 'border-primary border-2'
            )}
            data-testid={`card-important-date-${index}`}
          >
            {isHighImportance && (
              <div className="absolute top-2 right-2">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Date Block */}
              <div className="flex flex-col items-center shrink-0 w-16">
                <div className={cn(
                  'text-3xl font-bold leading-none',
                  isHighImportance ? 'text-primary' : 'text-foreground'
                )}>
                  {day}
                </div>
                <div className="text-xs text-muted-foreground uppercase mt-1">
                  {month}
                </div>
                <div className="mt-2">
                  {getEventIcon(event.type)}
                </div>
              </div>

              {/* Event Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-card-foreground">
                    {getEventTitle(event)}
                  </h4>
                  {event.house_for_sun_sign && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {event.house_for_sun_sign}-{locale === 'ru' ? 'й дом' : 'H'}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {getEventDescription(event)}
                </p>

                {isHighImportance && event.importance_reason && (
                  <div className="mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <p className="text-xs text-primary font-medium">
                      {event.importance_reason === 'in_sun_sign' && (locale === 'ru' 
                        ? 'В вашем солнечном знаке' 
                        : 'In your Sun sign')}
                      {event.importance_reason === 'in_ascendant' && (locale === 'ru'
                        ? 'В вашем асценденте'
                        : 'In your Ascendant')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
