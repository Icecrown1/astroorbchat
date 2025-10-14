import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lock, Sparkles, Calendar, CheckCircle, XCircle, Lightbulb, Clock } from 'lucide-react';
import { ImportantEvent, ImportantDateInterpretation, getImportantDateDetail, unlockImportantDate } from '@/lib/importantDatesApi';
import { useTranslation } from '@/contexts/LocaleContext';
import { translatePlanet, translateSign } from '@/lib/astroTranslations';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Loader } from './Loader';

interface ImportantDateModalProps {
  event: ImportantEvent;
  open: boolean;
  onClose: () => void;
}

export function ImportantDateModal({ event, open, onClose }: ImportantDateModalProps) {
  const { locale } = useTranslation();
  const { toast } = useToast();
  const [interpretation, setInterpretation] = useState<ImportantDateInterpretation | null>(null);

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
      'retrograde-start': { en: 'Retrograde Start', ru: 'Начало ретрограда' },
      'retrograde-end': { en: 'Direct Motion', ru: 'Директное движение' },
      ingress: { en: 'Sign Change', ru: 'Смена знака' },
      'major-transit': { en: 'Major Transit', ru: 'Важный транзит' },
      conjunction: { en: 'Conjunction', ru: 'Соединение' },
      opposition: { en: 'Opposition', ru: 'Оппозиция' },
      trine: { en: 'Trine', ru: 'Трин' },
      square: { en: 'Square', ru: 'Квадрат' },
      sextile: { en: 'Sextile', ru: 'Секстиль' },
    };
    return labels[kind]?.[locale] || kind;
  };

  const getLocalizedBrief = (event: ImportantEvent) => {
    const planet = translatePlanet(event.planet, locale);
    const sign = event.sign ? translateSign(event.sign, locale) : '';

    if (event.kind === 'retrograde-start') {
      return locale === 'ru' 
        ? `${planet} в ${sign} начинает ретроградное движение — пересмотрите планы в соответствующей сфере`
        : `${planet} in ${sign} begins retrograde motion — review plans in this area`;
    }
    if (event.kind === 'retrograde-end') {
      return locale === 'ru'
        ? `${planet} в ${sign} возвращается к директному движению — путь вперёд открыт`
        : `${planet} in ${sign} returns to direct motion — the way forward is clear`;
    }
    if (event.kind === 'ingress') {
      return locale === 'ru'
        ? `${planet} входит в ${sign} — новая энергия в этой области жизни`
        : `${planet} enters ${sign} — new energy in this life area`;
    }
    if (event.kind === 'major-transit' && event.natalTarget) {
      const natalPlanet = translatePlanet(event.natalTarget.planet, locale);
      const aspect = event.natalTarget.aspect ? getEventTypeLabel(event.natalTarget.aspect) : '';
      return locale === 'ru'
        ? `Транзитный ${planet} формирует ${aspect} к натальному ${natalPlanet} — важное влияние`
        : `Transiting ${planet} forms ${aspect} to natal ${natalPlanet} — significant influence`;
    }
    return event.brief;
  };

  // Unlock and get details mutation
  const unlockMutation = useMutation({
    mutationFn: async () => {
      await unlockImportantDate(event.key);
      const data = await getImportantDateDetail(event.key, locale);
      return data;
    },
    onSuccess: (data) => {
      setInterpretation(data);
      queryClient.invalidateQueries({ queryKey: ['/api/astrology/important-dates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: locale === 'ru' ? 'Дата разблокирована!' : 'Date unlocked!',
        description: locale === 'ru' ? 'Интерпретация загружена' : 'Interpretation loaded',
      });
    },
    onError: (error: any) => {
      toast({
        title: locale === 'ru' ? 'Ошибка' : 'Error',
        description: error.message || (locale === 'ru' ? 'Не удалось разблокировать дату' : 'Failed to unlock date'),
        variant: 'destructive',
      });
    },
  });

  // Get details for already unlocked event
  const loadDetailsMutation = useMutation({
    mutationFn: async () => {
      return await getImportantDateDetail(event.key, locale);
    },
    onSuccess: (data) => {
      setInterpretation(data);
    },
    onError: (error: any) => {
      toast({
        title: locale === 'ru' ? 'Ошибка' : 'Error',
        description: error.message || (locale === 'ru' ? 'Не удалось загрузить интерпретацию' : 'Failed to load interpretation'),
        variant: 'destructive',
      });
    },
  });

  const handleUnlock = () => {
    if (event.unlocked) {
      loadDetailsMutation.mutate();
    } else {
      unlockMutation.mutate();
    }
  };

  const isLoading = unlockMutation.isPending || loadDetailsMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-important-date">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {translatePlanet(event.planet, locale)} {getEventTypeLabel(event.kind)}
            {event.sign && ` ${locale === 'ru' ? 'в' : 'in'} ${translateSign(event.sign, locale)}`}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            {formatDate(event.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground">{getLocalizedBrief(event)}</p>

          {event.natalTarget && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">
                <span className="font-medium">{locale === 'ru' ? 'Влияние на:' : 'Impact on:'}</span>{' '}
                {translatePlanet(event.natalTarget.planet, locale)}
                {event.natalTarget.aspect && ` (${getEventTypeLabel(event.natalTarget.aspect)})`}
              </p>
            </div>
          )}

          <Separator />

          {!interpretation ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                {!event.unlocked && (
                  <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                )}
                <p className="text-muted-foreground mb-4">
                  {event.unlocked
                    ? (locale === 'ru' ? 'Загрузить полную интерпретацию' : 'Load full interpretation')
                    : (locale === 'ru' ? 'Разблокируйте для полной интерпретации' : 'Unlock for full interpretation')}
                </p>
                <Button
                  onClick={handleUnlock}
                  disabled={isLoading}
                  data-testid="button-unlock-date"
                >
                  {isLoading ? (
                    <Loader size="sm" />
                  ) : (
                    <>
                      {!event.unlocked && <Lock className="w-4 h-4 mr-2" />}
                      {event.unlocked 
                        ? (locale === 'ru' ? 'Загрузить' : 'Load')
                        : (locale === 'ru' ? 'Разблокировать (1 орб)' : 'Unlock (1 orb)')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Window */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">{locale === 'ru' ? 'Период влияния' : 'Influence Window'}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{interpretation.window}</p>
              </div>

              {/* What It Means */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">{locale === 'ru' ? 'Что это значит' : 'What It Means'}</h3>
                </div>
                <ul className="space-y-2">
                  {interpretation.whatItMeans.map((point, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Do's */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold">{locale === 'ru' ? 'Рекомендуется' : 'Do This'}</h3>
                </div>
                <ul className="space-y-2">
                  {interpretation.do.map((point, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Don'ts */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <h3 className="font-semibold">{locale === 'ru' ? 'Избегайте' : 'Avoid This'}</h3>
                </div>
                <ul className="space-y-2">
                  {interpretation.dont.map((point, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              {interpretation.risks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⚠️</span>
                    <h3 className="font-semibold">{locale === 'ru' ? 'Потенциальные сложности' : 'Potential Challenges'}</h3>
                  </div>
                  <ul className="space-y-2">
                    {interpretation.risks.map((point, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Timing Tips */}
              {interpretation.timingTips.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{locale === 'ru' ? 'Советы по таймингу' : 'Timing Tips'}</h3>
                  </div>
                  <ul className="space-y-2">
                    {interpretation.timingTips.map((point, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
