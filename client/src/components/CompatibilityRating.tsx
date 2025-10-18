import { Heart, Users, Briefcase, Home } from 'lucide-react';

interface CompatibilityRatingProps {
  rating: number;
  relationshipType?: 'romantic' | 'friendship' | 'work' | 'family';
  locale?: string;
}

export function CompatibilityRating({ rating, relationshipType = 'romantic', locale = 'en' }: CompatibilityRatingProps) {
  // Determine color based on rating
  const getColorClasses = (rating: number) => {
    if (rating <= 3.0) {
      // Red - low compatibility
      return {
        bg: 'bg-red-50 dark:bg-red-950/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-400',
        progressBg: 'bg-red-700 dark:bg-red-400',
        glow: 'shadow-red-500/20',
      };
    } else if (rating <= 5.0) {
      // Orange/Yellow - below average
      return {
        bg: 'bg-orange-50 dark:bg-orange-950/20',
        border: 'border-orange-200 dark:border-orange-800',
        text: 'text-orange-700 dark:text-orange-400',
        progressBg: 'bg-orange-600 dark:bg-orange-400',
        glow: 'shadow-orange-500/20',
      };
    } else if (rating <= 7.0) {
      // Light green - good
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        border: 'border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-400',
        progressBg: 'bg-emerald-600 dark:bg-emerald-400',
        glow: 'shadow-emerald-500/20',
      };
    } else {
      // Full green - excellent
      return {
        bg: 'bg-green-50 dark:bg-green-950/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-700 dark:text-green-400',
        progressBg: 'bg-green-600 dark:bg-green-400',
        glow: 'shadow-green-500/20',
      };
    }
  };

  const getRatingLabel = (rating: number) => {
    if (locale === 'ru') {
      if (rating <= 3.0) return 'Низкая совместимость';
      if (rating <= 5.0) return 'Ниже среднего';
      if (rating <= 7.0) return 'Хорошая совместимость';
      if (rating <= 9.0) return 'Высокая совместимость';
      return 'Исключительная связь';
    } else {
      if (rating <= 3.0) return 'Low Compatibility';
      if (rating <= 5.0) return 'Below Average';
      if (rating <= 7.0) return 'Good Compatibility';
      if (rating <= 9.0) return 'High Compatibility';
      return 'Exceptional Match';
    }
  };

  const getRelationshipIcon = () => {
    switch (relationshipType) {
      case 'romantic':
        return <Heart className="w-5 h-5" />;
      case 'friendship':
        return <Users className="w-5 h-5" />;
      case 'work':
        return <Briefcase className="w-5 h-5" />;
      case 'family':
        return <Home className="w-5 h-5" />;
      default:
        return <Heart className="w-5 h-5" />;
    }
  };

  const colors = getColorClasses(rating);

  return (
    <div 
      className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-6 shadow-lg ${colors.glow}`}
      data-testid="compatibility-rating-display"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={colors.text}>
            {getRelationshipIcon()}
          </div>
          <h3 className="font-semibold text-sm text-muted-foreground">
            {locale === 'ru' ? 'Рейтинг совместимости' : 'Compatibility Rating'}
          </h3>
        </div>
        <div className={`text-6xl font-bold ${colors.text} tabular-nums`} data-testid="rating-value">
          {rating.toFixed(2)}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className={`text-sm font-medium ${colors.text}`} data-testid="rating-label">
          {getRatingLabel(rating)}
        </div>
        <div className="text-xs text-muted-foreground">
          / 10.00
        </div>
      </div>

      {/* Visual progress bar */}
      <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors.progressBg} transition-all duration-500`}
          style={{ width: `${(rating / 10) * 100}%` }}
          data-testid="rating-progress"
        />
      </div>
    </div>
  );
}
