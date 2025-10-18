import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LocaleContext';
import sunIcon from '@assets/солнце_1760785218989.png';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withPhrases?: boolean;
}

const LOADING_PHRASES_RU = [
  "Зажигаем звезды...",
  "Настраиваем солнце...",
  "Выравниваем планеты...",
  "Консультируемся с космосом...",
  "Читаем звездные карты...",
  "Спрашиваем у Луны совета...",
  "Заглядываем в будущее...",
  "Ловим кометы за хвост...",
  "Договариваемся с Меркурием...",
  "Чиним ретроградный Меркурий...",
  "Полируем созвездия...",
  "Собираем космическую пыль...",
  "Калибруем гороскоп...",
  "Загружаем звездную мудрость...",
  "Синхронизируемся с Вселенной...",
  "Расшифровываем космические коды...",
  "Общаемся с планетами...",
  "Считаем метеориты...",
  "Проверяем лунные фазы...",
  "Настраиваем космический Wi-Fi...",
  "Ждем ответа от Венеры...",
  "Будим спящие звезды...",
  "Разгоняем облака на Юпитере...",
  "Чистим кольца Сатурна...",
  "Ищем ответы в туманностях...",
  "Заряжаем магию светил...",
  "Распутываем звездные нити...",
  "Собираем звездную пыль желаний...",
  "Договариваемся с судьбой...",
  "Читаем послания комет...",
  "Настраиваем астральные частоты...",
  "Запускаем космическую магию...",
  "Проверяем астрологические настройки...",
  "Ловим звездопад...",
  "Заглядываем в параллельные миры...",
  "Общаемся с духами планет...",
  "Ищем потерянные созвездия...",
  "Чиним разорванные аспекты...",
  "Измеряем космическую энергию...",
  "Заряжаем кристаллы лунным светом...",
  "Активируем портал знаний...",
  "Собираем астральный пазл...",
  "Расставляем звезды по местам...",
  "Пишем космическую поэму...",
  "Слушаем музыку сфер...",
  "Танцуем с планетами...",
  "Ищем космические подсказки...",
  "Разбираем звездные архивы...",
  "Готовим астрологическое зелье...",
  "Зовем на помощь ангелов-хранителей..."
];

const LOADING_PHRASES_EN = [
  "Lighting up stars...",
  "Tuning the sun...",
  "Aligning planets...",
  "Consulting with the cosmos...",
  "Reading star maps...",
  "Asking the Moon for advice...",
  "Peeking into the future...",
  "Catching comets by their tails...",
  "Negotiating with Mercury...",
  "Fixing retrograde Mercury...",
  "Polishing constellations...",
  "Gathering cosmic dust...",
  "Calibrating your horoscope...",
  "Loading stellar wisdom...",
  "Syncing with the Universe...",
  "Decoding cosmic secrets...",
  "Chatting with planets...",
  "Counting meteorites...",
  "Checking lunar phases...",
  "Setting up cosmic Wi-Fi...",
  "Waiting for Venus to reply...",
  "Waking up sleeping stars...",
  "Clearing clouds on Jupiter...",
  "Cleaning Saturn's rings...",
  "Searching for answers in nebulae...",
  "Charging celestial magic...",
  "Untangling star threads...",
  "Collecting stardust wishes...",
  "Negotiating with destiny...",
  "Reading comet messages...",
  "Tuning astral frequencies...",
  "Launching cosmic magic...",
  "Checking astrological settings...",
  "Catching shooting stars...",
  "Peeking into parallel worlds...",
  "Communicating with planetary spirits...",
  "Finding lost constellations...",
  "Fixing broken aspects...",
  "Measuring cosmic energy...",
  "Charging crystals with moonlight...",
  "Activating knowledge portal...",
  "Assembling astral puzzle...",
  "Putting stars in their places...",
  "Writing a cosmic poem...",
  "Listening to music of the spheres...",
  "Dancing with planets...",
  "Searching for cosmic hints...",
  "Browsing stellar archives...",
  "Brewing astrological potion...",
  "Calling guardian angels for help..."
];

export function Loader({ className, size = 'md', withPhrases = false }: LoaderProps) {
  const { locale } = useTranslation();
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [fadeIn, setFadeIn] = useState(true);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  useEffect(() => {
    if (!withPhrases) return;

    const phrases = locale === 'ru' ? LOADING_PHRASES_RU : LOADING_PHRASES_EN;
    
    // Set initial random phrase
    setCurrentPhrase(phrases[Math.floor(Math.random() * phrases.length)]);

    let timeoutId: NodeJS.Timeout | null = null;
    const interval = setInterval(() => {
      // Fade out
      setFadeIn(false);
      
      // Change phrase after fade out
      timeoutId = setTimeout(() => {
        setCurrentPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
        setFadeIn(true);
      }, 300);
    }, 2500); // Change phrase every 2.5 seconds

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [locale, withPhrases]);

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div
        className={cn(
          'relative',
          sizeClasses[size]
        )}
        data-testid="loader-spinner"
      >
        <img 
          src={sunIcon} 
          alt="Loading" 
          className="w-full h-full animate-spin"
          style={{ animationDuration: '3s' }}
        />
      </div>
      {withPhrases && (
        <p 
          className={cn(
            "text-sm text-muted-foreground transition-opacity duration-300 min-h-[20px] text-center",
            fadeIn ? "opacity-100" : "opacity-0"
          )}
          data-testid="loader-phrase"
        >
          {currentPhrase}
        </p>
      )}
    </div>
  );
}

export function FullPageLoader() {
  const { locale } = useTranslation();
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    const phrases = locale === 'ru' ? LOADING_PHRASES_RU : LOADING_PHRASES_EN;
    
    // Set initial random phrase
    setCurrentPhrase(phrases[Math.floor(Math.random() * phrases.length)]);

    let timeoutId: NodeJS.Timeout | null = null;
    const interval = setInterval(() => {
      // Fade out
      setFadeIn(false);
      
      // Change phrase after fade out
      timeoutId = setTimeout(() => {
        setCurrentPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
        setFadeIn(true);
      }, 300);
    }, 2500); // Change phrase every 2.5 seconds

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [locale]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <Loader size="lg" />
        <p 
          className={cn(
            "mt-4 text-muted-foreground transition-opacity duration-300 min-h-[24px]",
            fadeIn ? "opacity-100" : "opacity-0"
          )}
          data-testid="loader-phrase"
        >
          {currentPhrase}
        </p>
      </div>
    </div>
  );
}
