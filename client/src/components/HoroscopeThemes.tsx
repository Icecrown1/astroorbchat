import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LocaleContext';
import { DollarSign, Briefcase, GraduationCap, Heart, Activity, Moon } from 'lucide-react';

interface HoroscopeThemesProps {
  themes: {
    money: string;
    work: string;
    study: string;
    love: string;
    health: string;
    self_care?: string;
  };
}

const themeIcons = {
  money: DollarSign,
  work: Briefcase,
  study: GraduationCap,
  love: Heart,
  health: Activity,
  self_care: Moon,
};

const themeColors = {
  money: 'text-chart-1',
  work: 'text-chart-2',
  study: 'text-chart-3',
  love: 'text-chart-4',
  health: 'text-chart-5',
  self_care: 'text-primary',
};

const themeTranslationKeys: Record<string, string> = {
  money: 'money',
  work: 'work',
  study: 'study',
  love: 'love',
  health: 'health',
  self_care: 'selfCare',
};

export function HoroscopeThemes({ themes }: HoroscopeThemesProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3">
      {Object.entries(themes).map(([key, value]) => {
        const Icon = themeIcons[key as keyof typeof themeIcons];
        const color = themeColors[key as keyof typeof themeColors];
        
        if (!Icon || !value) return null;

        const isSelfCare = key === 'self_care';

        return (
          <Card 
            key={key} 
            className={isSelfCare 
              ? "p-4 bg-gradient-to-br from-primary/10 to-chart-2/10 border-primary/20 hover-elevate" 
              : "p-4 hover-elevate"
            }
            data-testid={`card-theme-${key}`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${isSelfCare ? 'bg-primary/20 text-primary' : `bg-muted ${color}`}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium mb-1 ${isSelfCare ? 'text-primary' : ''}`}>
                  {t.horoscope[themeTranslationKeys[key] as keyof typeof t.horoscope] as string}
                </h4>
                <p className={`text-sm leading-relaxed ${isSelfCare ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                  {value}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
