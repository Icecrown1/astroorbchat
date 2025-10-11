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

      // Draw zodiac sign labels
      const labelAngle = ((i * 30 + 15) - 90) * (Math.PI / 180);
      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = center + Math.cos(labelAngle) * labelRadius;
      const labelY = center + Math.sin(labelAngle) * labelRadius;

      ctx.fillStyle = mutedForeground;
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ZODIAC_SIGNS[i].substring(0, 3), labelX, labelY);
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

    // Draw planets
    planets.forEach((planet) => {
      const angle = (planet.position - 90) * (Math.PI / 180);
      const x = center + Math.cos(angle) * planetRadius;
      const y = center + Math.sin(angle) * planetRadius;

      // Planet dot
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Planet glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
      const primaryHsl = computedStyle.getPropertyValue('--primary').trim().split(' ');
      gradient.addColorStop(0, `hsla(${primaryHsl[0]}, ${primaryHsl[1]}, ${primaryHsl[2]}, 0.5)`);
      gradient.addColorStop(1, `hsla(${primaryHsl[0]}, ${primaryHsl[1]}, ${primaryHsl[2]}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fill();

      // Planet label
      const labelX = center + Math.cos(angle) * (planetRadius - 20);
      const labelY = center + Math.sin(angle) * (planetRadius - 20);
      ctx.fillStyle = foregroundColor;
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planet.name.substring(0, 3), labelX, labelY);
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
