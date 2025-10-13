import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader } from '@/components/Loader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Sparkles, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest } from '@/lib/queryClient';

interface PlanetInterpretation {
  title: string;
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
  house_note: string;
}

interface PlanetModalProps {
  planet: string | null;
  onClose: () => void;
  chartType?: 'own' | 'guest';
  chartId?: string;
}

export function PlanetModal({ planet, onClose, chartType = 'own', chartId }: PlanetModalProps) {
  const { locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(!!planet);
  }, [planet]);

  const { data, isLoading, error } = useQuery<PlanetInterpretation>({
    queryKey: ['/api/astrology/planet-interpretation', planet, locale, chartType, chartId],
    queryFn: async () => {
      if (!planet) throw new Error('No planet selected');
      const response = await apiRequest('POST', '/api/astrology/planet-interpretation', {
        planet,
        locale,
        chartType,
        chartId
      });
      return response.data;
    },
    enabled: !!planet,
    retry: 1
  });

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200); // Даем время на анимацию закрытия
  };

  const PLANET_SYMBOLS: Record<string, string> = {
    'Sun': '☉',
    'Moon': '☽',
    'Mercury': '☿',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃',
    'Saturn': '♄',
    'Uranus': '♅',
    'Neptune': '♆',
    'North Node': '☊',
    'South Node': '☋',
    'Pluto': '♇'
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {locale === 'ru' 
                ? 'Не удалось загрузить интерпретацию. Попробуйте позже.'
                : 'Failed to load interpretation. Please try again later.'}
            </AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <span className="text-3xl" style={{ color: '#b87333' }}>
                  {planet && PLANET_SYMBOLS[planet]}
                </span>
                <span>{data.title}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Краткое описание */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm leading-relaxed">{data.summary}</p>
                </div>
              </div>

              {/* Сильные стороны */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  {locale === 'ru' ? 'Сильные стороны' : 'Strengths'}
                </h3>
                <ul className="space-y-2">
                  {data.strengths.map((strength, index) => (
                    <li 
                      key={index} 
                      className="flex items-start gap-3 text-sm"
                      data-testid={`strength-${index}`}
                    >
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Риски */}
              {data.risks && data.risks.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    {locale === 'ru' ? 'На что обратить внимание' : 'Watch Out For'}
                  </h3>
                  <ul className="space-y-2">
                    {data.risks.map((risk, index) => (
                      <li 
                        key={index} 
                        className="flex items-start gap-3 text-sm"
                        data-testid={`risk-${index}`}
                      >
                        <span className="text-amber-600 mt-0.5">!</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Советы */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  {locale === 'ru' ? 'Рекомендации' : 'Advice'}
                </h3>
                <ul className="space-y-2">
                  {data.advice.map((item, index) => (
                    <li 
                      key={index} 
                      className="flex items-start gap-3 text-sm"
                      data-testid={`advice-${index}`}
                    >
                      <span className="text-primary mt-0.5">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Примечание по дому */}
              {data.house_note && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {locale === 'ru' ? 'Влияние дома: ' : 'House influence: '}
                    </span>
                    {data.house_note}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
