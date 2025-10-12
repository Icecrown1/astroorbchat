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

interface ChartCanvasProps {
  planets: Planet[];
  aspects: Aspect[];
  className?: string;
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

// Цвета стихий
const ELEMENT_COLORS: Record<string, string> = {
  'fire': '#f97316',    // оранжевый - Овен, Лев, Стрелец
  'earth': '#22c55e',   // зеленый - Телец, Дева, Козерог
  'air': '#3b82f6',     // синий - Близнецы, Весы, Водолей
  'water': '#06b6d4'    // голубой - Рак, Скорпион, Рыбы
};

// Маппинг знаков к стихиям
const SIGN_ELEMENTS: Record<string, string> = {
  'Aries': 'fire', 'Leo': 'fire', 'Sagittarius': 'fire',
  'Taurus': 'earth', 'Virgo': 'earth', 'Capricorn': 'earth',
  'Gemini': 'air', 'Libra': 'air', 'Aquarius': 'air',
  'Cancer': 'water', 'Scorpio': 'water', 'Pisces': 'water'
};

const ASPECT_COLORS: Record<string, string> = {
  conjunction: '#9333ea', // primary
  sextile: '#06b6d4', // cyan
  square: '#ef4444', // red
  trine: '#10b981', // green
  opposition: '#f59e0b', // amber
};

export function ChartCanvas({ planets, aspects, className }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get computed CSS colors
    const computedStyle = getComputedStyle(document.documentElement);
    const borderColor = `hsl(${computedStyle.getPropertyValue('--border').trim()})`;
    const mutedForeground = `hsl(${computedStyle.getPropertyValue('--muted-foreground').trim()})`;
    const primaryColor = `hsl(${computedStyle.getPropertyValue('--primary').trim()})`;
    const foregroundColor = `hsl(${computedStyle.getPropertyValue('--foreground').trim()})`;

    const size = canvas.width;
    const center = size / 2;
    const outerRadius = size / 2 - 20;
    const innerRadius = outerRadius - 30;
    const planetRadius = innerRadius - 40;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw zodiac wheel
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, innerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw zodiac divisions
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * (Math.PI / 180);
      const x1 = center + Math.cos(angle) * innerRadius;
      const y1 = center + Math.sin(angle) * innerRadius;
      const x2 = center + Math.cos(angle) * outerRadius;
      const y2 = center + Math.sin(angle) * outerRadius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw zodiac sign labels with element colors
      const labelAngle = ((i * 30 + 15) - 90) * (Math.PI / 180);
      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = center + Math.cos(labelAngle) * labelRadius;
      const labelY = center + Math.sin(labelAngle) * labelRadius;

      const signName = ZODIAC_SIGNS[i];
      const element = SIGN_ELEMENTS[signName];
      const elementColor = ELEMENT_COLORS[element];

      // Рисуем цветной круг за символом
      ctx.fillStyle = elementColor;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(labelX, labelY, 16, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Рисуем символ
      ctx.fillStyle = elementColor;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ZODIAC_SYMBOLS[i], labelX, labelY);
    }

    // Draw aspects
    aspects.forEach((aspect) => {
      const planet1 = planets.find(p => p.name === aspect.planet1);
      const planet2 = planets.find(p => p.name === aspect.planet2);

      if (planet1 && planet2) {
        const angle1 = (planet1.position - 90) * (Math.PI / 180);
        const angle2 = (planet2.position - 90) * (Math.PI / 180);

        const x1 = center + Math.cos(angle1) * planetRadius;
        const y1 = center + Math.sin(angle1) * planetRadius;
        const x2 = center + Math.cos(angle2) * planetRadius;
        const y2 = center + Math.sin(angle2) * planetRadius;

        ctx.strokeStyle = ASPECT_COLORS[aspect.type] || '#666';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Умное размещение планет - если близко друг к другу, размещаем на разных радиусах
    const sortedPlanets = [...planets].sort((a, b) => a.position - b.position);
    const planetPositions: { planet: Planet; radius: number; layer: number }[] = [];
    
    sortedPlanets.forEach((planet, index) => {
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
      
      const radius = planetRadius - (layer * 25);
      planetPositions.push({ planet, radius, layer });
    });

    // Рисуем планеты только как символы
    planetPositions.forEach(({ planet, radius }) => {
      const angle = (planet.position - 90) * (Math.PI / 180);
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;

      // Символ планеты
      const planetSymbol = PLANET_SYMBOLS[planet.name] || planet.name.substring(0, 1);
      ctx.fillStyle = primaryColor;
      ctx.font = 'bold 20px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planetSymbol, x, y);
    });

  }, [planets, aspects]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className={cn('w-full h-auto', className)}
      data-testid="canvas-natal-chart"
    />
  );
}
