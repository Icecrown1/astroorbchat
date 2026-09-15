import { OrbIcon } from '@/components/OrbIcon';

/** Единая строка стоимости: золотая, со звездой-орбом. */
export function CostLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--solar-gold))]">
      <OrbIcon className="w-3.5 h-3.5" />
      {children}
    </p>
  );
}
