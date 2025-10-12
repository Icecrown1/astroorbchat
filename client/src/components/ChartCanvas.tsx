import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Planet {
  name: string;
  position: number; // degrees 0-360
  sign: string;
}

interface Aspect {
  planet1: string;
  planet2: string;
  type: string; // conjunction, sextile, square, trine, opposition
  angle: number;
}

interface PlanetPosition {
  name: string;
  x: number;
  y: number;
  sign: string;
}

interface ChartCanvasProps {
  planets: Planet[];
  aspects: Aspect[];
  className?: string;
  onPlanetClick?: (planetName: string) => void;
}

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// Используем текстовые символы без вариационных селекторов для правильного цвета
const ZODIAC_SYMBOLS = ['♈︎', '♉︎', '♊︎', '♋︎', '♌︎', '♍︎', '♎︎', '♏︎', '♐︎', '♑︎', '♒︎', '♓︎'];

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
  'Pluto': '♇'
};

// Цветовая тема карты
const THEME_COLORS = {
  // Пастельные оттенки для секторов зодиака (по 12 знакам)
  zodiacSectors: [
    '#f2d7d7', // Овен - светло-красный
    '#d8f0e1', // Телец - мятный
    '#f5e0c9', // Близнецы - песочный
    '#d0e6f5', // Рак - голубой
    '#f5ead3', // Лев - золотистый
    '#e7f4d5', // Дева - светло-зеленый
    '#f6e7c7', // Весы - бежевый
    '#d9f0f3', // Скорпион - бирюзовый
    '#f2d2e0', // Стрелец - розовый
    '#dcd3f2', // Козерог - лавандовый
    '#e2e0f0', // Водолей - серо-лиловый
    '#dfeaf2'  // Рыбы - небесный
  ],
  zodiacSymbol: '#b87333',      // Бронзовый для символов знаков
  planetSymbol: '#9333ea',      // Фиолетовый для планет
  border: 'rgba(0, 0, 0, 0.25)',
  centerGradientStart: '#f5e0b0',
  centerGradientEnd: 'rgba(245, 224, 176, 0)'
};

const ASPECT_COLORS: Record<string, string> = {
  conjunction: '#9333ea', // primary
  sextile: '#06b6d4', // cyan
  square: '#ef4444', // red
  trine: '#10b981', // green
  opposition: '#f59e0b', // amber
};

export function ChartCanvas({ planets, aspects, className, onPlanetClick }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetPositionsRef = useRef<PlanetPosition[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const outerRadius = size / 2 - 10;
    const innerRadius = outerRadius - 50;
    const planetRadius = innerRadius - 50;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Сбрасываем позиции планет
    planetPositionsRef.current = [];

    // 1. Рисуем центральную заливку
    const centerGradient = ctx.createRadialGradient(center, center, 0, center, center, innerRadius * 0.3);
    centerGradient.addColorStop(0, THEME_COLORS.centerGradientStart);
    centerGradient.addColorStop(1, THEME_COLORS.centerGradientEnd);
    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(center, center, innerRadius * 0.3, 0, 2 * Math.PI);
    ctx.fill();

    // 2. Рисуем заполненные сектора зодиака
    for (let i = 0; i < 12; i++) {
      const startAngle = (i * 30 - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);

      // Заливка сектора
      ctx.fillStyle = THEME_COLORS.zodiacSectors[i];
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, outerRadius, startAngle, endAngle);
      ctx.lineTo(center, center);
      ctx.closePath();
      ctx.fill();

      // Граница сектора
      ctx.strokeStyle = THEME_COLORS.border;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(
        center + Math.cos(startAngle) * outerRadius,
        center + Math.sin(startAngle) * outerRadius
      );
      ctx.stroke();
    }

    // 3. Внешний круг
    ctx.strokeStyle = THEME_COLORS.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // 4. Внутренний круг
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(center, center, innerRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = THEME_COLORS.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5. Символы знаков зодиака (золотые/бронзовые)
    for (let i = 0; i < 12; i++) {
      const labelAngle = ((i * 30 + 15) - 90) * (Math.PI / 180);
      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = center + Math.cos(labelAngle) * labelRadius;
      const labelY = center + Math.sin(labelAngle) * labelRadius;

      // Свечение
      ctx.shadowColor = 'rgba(184, 115, 51, 0.5)';
      ctx.shadowBlur = 6;
      
      // Символ знака
      ctx.fillStyle = THEME_COLORS.zodiacSymbol;
      ctx.font = 'bold 22px "Noto Sans Symbols2", "Symbola", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ZODIAC_SYMBOLS[i], labelX, labelY);
      
      ctx.shadowBlur = 0;
    }

    // 6. Аспекты (линии между планетами)
    aspects.forEach((aspect) => {
      const planet1 = planets.find(p => p.name === aspect.planet1);
      const planet2 = planets.find(p => p.name === aspect.planet2);

      if (planet1 && planet2) {
        const angle1 = (planet1.position - 90) * (Math.PI / 180);
        const angle2 = (planet2.position - 90) * (Math.PI / 180);

        const x1 = center + Math.cos(angle1) * (planetRadius - 10);
        const y1 = center + Math.sin(angle1) * (planetRadius - 10);
        const x2 = center + Math.cos(angle2) * (planetRadius - 10);
        const y2 = center + Math.sin(angle2) * (planetRadius - 10);

        ctx.strokeStyle = ASPECT_COLORS[aspect.type] || '#999';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });

    // 7. Умное размещение планет - если близко друг к другу, размещаем на разных радиусах
    const sortedPlanets = [...planets].sort((a, b) => a.position - b.position);
    const planetPositions: { planet: Planet; radius: number; layer: number }[] = [];
    
    sortedPlanets.forEach((planet) => {
      let layer = 0;
      let tooClose = true;
      
      // Проверяем, не слишком ли близко к уже размещенным планетам
      while (tooClose && layer < 3) {
        tooClose = false;
        for (const placed of planetPositions) {
          if (placed.layer === layer) {
            const angleDiff = Math.abs(planet.position - placed.planet.position);
            const minAngleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
            if (minAngleDiff < 15) { // Если ближе 15 градусов
              tooClose = true;
              break;
            }
          }
        }
        if (tooClose) layer++;
      }
      
      const radius = planetRadius - (layer * 30);
      planetPositions.push({ planet, radius, layer });
    });

    // 8. Рисуем планеты - символы с свечением
    planetPositions.forEach(({ planet, radius }) => {
      const angle = (planet.position - 90) * (Math.PI / 180);
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;

      // Сохраняем координаты для обработчика кликов
      planetPositionsRef.current.push({
        name: planet.name,
        x,
        y,
        sign: planet.sign
      });

      // Свечение планеты
      ctx.shadowColor = 'rgba(147, 51, 234, 0.6)';
      ctx.shadowBlur = 8;

      // Символ планеты
      const planetSymbol = PLANET_SYMBOLS[planet.name] || planet.name.substring(0, 1);
      ctx.fillStyle = THEME_COLORS.planetSymbol;
      ctx.font = '600 20px "Noto Sans Symbols2", "Symbola", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planetSymbol, x, y);
      
      ctx.shadowBlur = 0;
    });

  }, [planets, aspects]);

  // Обработчик кликов по canvas
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPlanetClick || planetPositionsRef.current.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    // Находим ближайшую планету
    const hitRadius = 20; // Радиус попадания в пикселях
    let closestPlanet: PlanetPosition | undefined;
    let minDistance = hitRadius;

    for (const planet of planetPositionsRef.current) {
      const distance = Math.sqrt(
        Math.pow(clickX - planet.x, 2) + Math.pow(clickY - planet.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPlanet = planet;
      }
    }

    if (closestPlanet) {
      onPlanetClick(closestPlanet.name);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      onClick={handleClick}
      className={cn('w-full h-auto cursor-pointer', className)}
      data-testid="canvas-natal-chart"
    />
  );
}
