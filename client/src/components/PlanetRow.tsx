import PlanetIcon from "./PlanetIcon";

type PlanetRowProps = {
  name: "Sun"|"Moon"|"Mercury"|"Venus"|"Mars"|"Jupiter"|"Saturn"|"Uranus"|"Neptune"|"Pluto"|"North Node"|"South Node"|"Ascendant"|"Midheaven";
  signLabel: string;
  degreesLabel: string;
  onClick?: () => void;
};

export default function PlanetRow({ name, signLabel, degreesLabel, onClick }: PlanetRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover-elevate active-elevate-2 transition-colors text-left"
      aria-label={`${name} ${signLabel} ${degreesLabel}`}
      data-testid={`planet-row-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <PlanetIcon name={name} size={36} variant="gold" animated className="shrink-0" />
      <div className="flex-1">
        <div className="text-[15px] font-semibold">{name}</div>
        <div className="text-[13px] text-muted-foreground">{signLabel} {degreesLabel}</div>
      </div>
      <div aria-hidden className="text-muted-foreground">▾</div>
    </button>
  );
}
