import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LocaleContext';
import { DollarSign, Briefcase, GraduationCap, Heart, Activity, Moon } from 'lucide-react';

interface ThemeContent {
  money: string;
  work: string;
  study: string;
  love: string;
  health: string;
}

interface HoroscopeThemesProps {
  morning?: ThemeContent;
  day?: ThemeContent;
  evening?: ThemeContent & { self_care?: string };
}

const themeIcons = {
  money: DollarSign,
  work: Briefcase,
  study: GraduationCap,
  love: Heart,
  health: Activity,
};

const themeColors = {
  money: 'text-chart-1',
  work: 'text-chart-2',
  study: 'text-chart-3',
  love: 'text-chart-4',
  health: 'text-chart-5',
};

export function HoroscopeThemes({ morning, day, evening }: HoroscopeThemesProps) {
  const { t } = useTranslation();

  const renderThemes = (themes: ThemeContent, period: 'morning' | 'day' | 'evening') => {
    const isEvening = period === 'evening';
    const eveningData = isEvening ? (themes as ThemeContent & { self_care?: string }) : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-border" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t.horoscope[period]}
          </h3>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-3">
          {Object.entries(themes).filter(([key]) => key !== 'self_care').map(([key, value]) => {
            const Icon = themeIcons[key as keyof typeof themeIcons];
            const color = themeColors[key as keyof typeof themeColors];
            
            if (!Icon || !value) return null;

            return (
              <Card key={key} className="p-4 hover-elevate" data-testid={`card-theme-${key}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium mb-1">
                      {t.horoscope[key as keyof typeof t.horoscope] as string}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {value}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}

          {isEvening && eveningData?.self_care && (
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-chart-2/10 border-primary/20" data-testid="card-self-care">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                  <Moon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium mb-1 text-primary">
                    {t.horoscope.selfCare}
                  </h4>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {eveningData.self_care}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {morning && renderThemes(morning, 'morning')}
      {day && renderThemes(day, 'day')}
      {evening && renderThemes(evening, 'evening')}
    </div>
  );
}
