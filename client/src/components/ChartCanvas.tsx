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

interface Angle {
  longitude: number;
  sign: string;
  degree_in_sign: number;
}

interface Angles {
  Ascendant: Angle;
  MC: Angle;
  Descendant: Angle;
  IC: Angle;
}

interface Houses {
  system: string;
  cusps: number[]; // 12 house cusps in degrees 0-360
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
  angles?: Angles;
  houses?: Houses;
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
  'Pluto': '♇',
  'North Node': '☊',
  'South Node': '☋'
};

// Цветовая тема карты - AstroOrb Palette
const THEME_COLORS = {
  // Пастельные оттенки для секторов зодиака (по 12 знакам)
  zodiacSectors: [
    '#231318', // Овен — глубокий красный
    '#12211b', // Телец — тёмный мятный
    '#241d12', // Близнецы — тёмный песочный
    '#121c26', // Рак — глубокий синий
    '#262012', // Лев — тёмное золото
    '#17220f', // Дева — тёмная зелень
    '#231e10', // Весы — тёмный беж
    '#0f2226', // Скорпион — глубокая бирюза
    '#241220', // Стрелец — тёмный розовый
    '#1b1430', // Козерог — глубокая лаванда
    '#191831', // Водолей — тёмный лиловый
    '#131b2b'  // Рыбы — глубокое небо
  ],
  zodiacSymbol: '#EFC26B', // fallback; реальный цвет — по стихии      // Solar Gold для символов знаков
  planetSymbol: '#EFC26B',      // Solar Gold для планет
  border: 'rgba(233, 236, 248, 0.16)',
  centerGradientStart: 'rgba(142, 123, 255, 0.35)', // Iris glow центр
  centerGradientEnd: 'rgba(142, 123, 255, 0)' // fade
};

const ASPECT_COLORS: Record<string, string> = {
  conjunction: '#EFC26B', // золото — слияние
  sextile: '#8E7BFF',     // iris — гармония
  trine: '#8E7BFF',       // iris — гармония
  square: '#EFC26B',      // золото — напряжение
  opposition: '#EFC26B',  // золото — напряжение
};

export function ChartCanvas({ planets, aspects, angles, houses, className, onPlanetClick }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetPositionsRef = useRef<PlanetPosition[]>([]);
  const lastDrawKeyRef = useRef<string>('');

  useEffect(() => {
    if (!planets || planets.length === 0) return;
    const drawKey = JSON.stringify([planets, aspects, angles]);
    if (drawKey === lastDrawKeyRef.current) return; // те же данные — не мигаем
    lastDrawKeyRef.current = drawKey;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const outerRadius = size / 2 - 10;
    const innerRadius = outerRadius - 50;
    const planetRadius = innerRadius - 50;
    const houseLinesRadius = innerRadius + 20; // House lines between inner and outer circles

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
    ctx.fillStyle = 'rgba(20, 22, 35, 0.65)';
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
      const ELEMENT_COLORS = ['#F08E7E', '#8FCE9F', '#9DB8F0', '#8E7BFF']; // огонь земля воздух вода
      ctx.fillStyle = ELEMENT_COLORS[i % 4];
      ctx.font = 'bold 22px "Noto Sans Symbols2", "Symbola", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ZODIAC_SYMBOLS[i], labelX, labelY);
      
      ctx.shadowBlur = 0;
    }

    // 5.5. Линии домов (если есть данные)
    if (houses && houses.cusps && houses.cusps.length === 12) {
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)'; // Purple/violet with transparency
      ctx.lineWidth = 1.5;
      
      ctx.strokeStyle = 'rgba(239, 194, 107, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      houses.cusps.forEach((cuspDegree) => {
        const angle = (cuspDegree - 90) * (Math.PI / 180);
        const innerX = center + Math.cos(angle) * (innerRadius + 3);
        const innerY = center + Math.sin(angle) * (innerRadius + 3);
        const outerX = center + Math.cos(angle) * (houseLinesRadius - 4);
        const outerY = center + Math.sin(angle) * (houseLinesRadius - 4);
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
    }

    // 5.6. Маркеры ASC и MC (если есть данные)
    if (angles) {
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Ascendant (ASC)
      if (angles.Ascendant) {
        const ascAngle = (angles.Ascendant.longitude - 90) * (Math.PI / 180);
        const ascX = center + Math.cos(ascAngle) * (houseLinesRadius + 15);
        const ascY = center + Math.sin(ascAngle) * (houseLinesRadius + 15);
        
        // Background for better visibility
        ctx.fillStyle = 'rgba(20, 22, 35, 0.65)';
        const metrics = ctx.measureText('ASC');
        ctx.fillRect(ascX - metrics.width / 2 - 3, ascY - 7, metrics.width + 6, 14);
        
        // Text
        ctx.fillStyle = '#B9AEFF';
        ctx.fillText('ASC', ascX, ascY);
      }
      
      // Midheaven (MC)
      if (angles.MC) {
        const mcAngle = (angles.MC.longitude - 90) * (Math.PI / 180);
        const mcX = center + Math.cos(mcAngle) * (houseLinesRadius + 15);
        const mcY = center + Math.sin(mcAngle) * (houseLinesRadius + 15);
        
        // Background for better visibility
        ctx.fillStyle = 'rgba(20, 22, 35, 0.65)';
        const metrics = ctx.measureText('MC');
        ctx.fillRect(mcX - metrics.width / 2 - 3, mcY - 7, metrics.width + 6, 14);
        
        // Text
        ctx.fillStyle = '#B9AEFF';
        ctx.fillText('MC', mcX, mcY);
      }
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

        ctx.strokeStyle = ASPECT_COLORS[aspect.type] || 'rgba(155,160,181,0.5)';
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
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
            if (minAngleDiff < 19) { // Если ближе 15 градусов
              tooClose = true;
              break;
            }
          }
        }
        if (tooClose) layer++;
      }
      
      const radius = planetRadius - (layer * 34);
      planetPositions.push({ planet, radius, layer });
    });

    // 7.85. Звёздное небо внутри колеса (детерминированный псевдорандом)
    let seed = 42;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let st = 0; st < 90; st++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * innerRadius * 0.97;
      const sx = center + Math.cos(a) * rr;
      const sy = center + Math.sin(a) * rr;
      const size = rnd() < 0.85 ? 0.7 : 1.3;
      ctx.fillStyle = `rgba(${rnd() < 0.3 ? '239,194,107' : '210,214,235'},${0.25 + rnd() * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7.9. Глубина: иris-свечение в сердце и виньетка по краю
    const heart = ctx.createRadialGradient(center, center, 0, center, center, innerRadius);
    heart.addColorStop(0, 'rgba(142,123,255,0.20)');
    heart.addColorStop(0.55, 'rgba(142,123,255,0.06)');
    heart.addColorStop(1, 'rgba(142,123,255,0)');
    ctx.fillStyle = heart;
    ctx.beginPath();
    ctx.arc(center, center, innerRadius, 0, 2 * Math.PI);
    ctx.fill();
    const vign = ctx.createRadialGradient(center, center, outerRadius * 0.82, center, center, outerRadius * 1.02);
    vign.addColorStop(0, 'rgba(5,6,12,0)');
    vign.addColorStop(1, 'rgba(5,6,12,0.55)');
    ctx.fillStyle = vign;
    ctx.beginPath();
    ctx.arc(center, center, outerRadius * 1.02, 0, 2 * Math.PI);
    ctx.fill();

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

      // Узел-«кнопка»: подложка + свечение (Солнце золотое и крупнее, Луна светлая, остальные iris)
      const isSun = planet.name === 'Sun';
      const isMoon = planet.name === 'Moon';
      const nodeR = isSun ? 16 : isMoon ? 15 : 13;
      const glowColor = isSun ? 'rgba(239, 194, 107, 0.85)' : isMoon ? 'rgba(232, 233, 240, 0.7)' : 'rgba(142, 123, 255, 0.75)';
      const strokeColor = isSun ? '#EFC26B' : isMoon ? '#E8E9F0' : '#8E7BFF';

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isSun ? 15 : 10;
      ctx.fillStyle = 'rgba(20, 22, 35, 0.95)';
      ctx.beginPath();
      ctx.arc(x, y, nodeR, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSun ? 2 : 1.5;
      ctx.stroke();

      // Символ планеты
      const planetSymbol = PLANET_SYMBOLS[planet.name] || planet.name.substring(0, 1);
      ctx.fillStyle = strokeColor;
      ctx.font = `700 ${isSun ? 19 : 16}px "Noto Sans Symbols2", "Symbola", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planetSymbol, x, y + 1);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.35;
      ctx.strokeText(planetSymbol, x, y + 1);
    });

  }, [planets, aspects, angles, houses]);

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
    <div className={`gradient-aura-wrap wheel-nebula ${typeof window !== 'undefined' && !sessionStorage.getItem('wheelShown') ? 'wheel-enter wheel-idle' : 'wheel-idle'}`} onAnimationEnd={() => sessionStorage.setItem('wheelShown', '1')} >
      <canvas
      ref={canvasRef}
      width={400}
      height={400}
      onClick={handleClick}
      className={cn('w-full h-auto cursor-pointer', className)}
      data-testid="canvas-natal-chart"
    />
      </div>
  );
}
