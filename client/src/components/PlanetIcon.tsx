import { useId } from 'react';

type PlanetName =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  | "North Node" | "South Node" | "Ascendant" | "Midheaven";

export type PlanetIconProps = {
  name: PlanetName;
  size?: number;
  variant?: "gold" | "bronze" | "ink";
  title?: string;
  className?: string;
  animated?: boolean;
};

const PALETTE = {
  gold:   { fill: "#cfa24b", stroke: "#8d6a25" },
  bronze: { fill: "#b87436", stroke: "#7a4d22" },
  ink:    { fill: "#444",    stroke: "#222"    },
};

function useColors(variant: PlanetIconProps["variant"]) {
  return PALETTE[variant ?? "gold"];
}

export default function PlanetIcon({
  name,
  size = 32,
  variant = "gold",
  title,
  className,
  animated = true,
}: PlanetIconProps) {
  const { fill, stroke } = useColors(variant);
  const uniqueId = useId();
  
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    role: "img",
    "aria-label": title ?? name,
  } as const;

  const animClass = animated ? "po-anim po-pulse" : "";

  switch (name) {
    case "Sun":
      // ☉ - Circle with dot in center
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Sun"}</title>
          <circle cx="32" cy="32" r="16" fill="none" stroke={fill} strokeWidth="2.5"/>
          <circle cx="32" cy="32" r="4" fill={fill}/>
        </svg>
      );

    case "Moon":
      // ☽ - Crescent
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Moon"}</title>
          <path d="M32 16 A16 16 0 1 0 32 48 A12 12 0 1 1 32 16 Z" 
                fill="none" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Mercury":
      // ☿ - Circle with cross below and horns on top
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Mercury"}</title>
          <circle cx="32" cy="30" r="8" fill="none" stroke={fill} strokeWidth="2.5"/>
          <path d="M24 20 Q32 14 40 20" fill="none" stroke={fill} strokeWidth="2.5"/>
          <line x1="32" y1="38" x2="32" y2="48" stroke={fill} strokeWidth="2.5"/>
          <line x1="28" y1="44" x2="36" y2="44" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Venus":
      // ♀ - Circle with cross below
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Venus"}</title>
          <circle cx="32" cy="24" r="10" fill="none" stroke={fill} strokeWidth="2.5"/>
          <line x1="32" y1="34" x2="32" y2="50" stroke={fill} strokeWidth="2.5"/>
          <line x1="24" y1="42" x2="40" y2="42" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Mars":
      // ♂ - Circle with arrow pointing upper-right
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Mars"}</title>
          <circle cx="28" cy="36" r="10" fill="none" stroke={fill} strokeWidth="2.5"/>
          <line x1="36" y1="28" x2="48" y2="16" stroke={fill} strokeWidth="2.5"/>
          <line x1="48" y1="16" x2="48" y2="22" stroke={fill} strokeWidth="2.5"/>
          <line x1="48" y1="16" x2="42" y2="16" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Jupiter":
      // ♃ - Stylized number 4 or 2|
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Jupiter"}</title>
          <line x1="20" y1="16" x2="20" y2="48" stroke={fill} strokeWidth="2.5"/>
          <path d="M20 28 Q32 20 44 28" fill="none" stroke={fill} strokeWidth="2.5"/>
          <line x1="28" y1="36" x2="36" y2="36" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Saturn":
      // ♄ - Cross with tail (like letter h)
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Saturn"}</title>
          <line x1="32" y1="16" x2="32" y2="40" stroke={fill} strokeWidth="2.5"/>
          <line x1="20" y1="28" x2="44" y2="28" stroke={fill} strokeWidth="2.5"/>
          <path d="M16 48 Q24 38 32 40" fill="none" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Uranus":
      // ♅ - H with circle in center and dot on top
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Uranus"}</title>
          <circle cx="32" cy="36" r="8" fill="none" stroke={fill} strokeWidth="2.5"/>
          <line x1="24" y1="16" x2="24" y2="36" stroke={fill} strokeWidth="2.5"/>
          <line x1="40" y1="16" x2="40" y2="36" stroke={fill} strokeWidth="2.5"/>
          <circle cx="32" cy="16" r="3" fill={fill}/>
        </svg>
      );

    case "Neptune":
      // ♆ - Trident
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Neptune"}</title>
          <line x1="32" y1="18" x2="32" y2="48" stroke={fill} strokeWidth="2.5"/>
          <line x1="20" y1="18" x2="44" y2="18" stroke={fill} strokeWidth="2.5"/>
          <path d="M24 18 Q24 32 20 40" fill="none" stroke={fill} strokeWidth="2.5"/>
          <path d="M40 18 Q40 32 44 40" fill="none" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Pluto":
      // ♇ - PL monogram or circle with P-like symbol
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Pluto"}</title>
          <circle cx="32" cy="22" r="8" fill="none" stroke={fill} strokeWidth="2.5"/>
          <line x1="24" y1="22" x2="24" y2="48" stroke={fill} strokeWidth="2.5"/>
          <line x1="18" y1="38" x2="38" y2="38" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "North Node":
      // Ω - Horseshoe shape (upward)
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "North Node"}</title>
          <path d="M20 40 Q20 20 32 20 Q44 20 44 40" 
                fill="none" stroke={fill} strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="20" cy="40" r="3" fill={fill}/>
          <circle cx="44" cy="40" r="3" fill={fill}/>
        </svg>
      );

    case "South Node":
      // Ω inverted - Horseshoe shape (downward)
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "South Node"}</title>
          <path d="M20 24 Q20 44 32 44 Q44 44 44 24" 
                fill="none" stroke={fill} strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="20" cy="24" r="3" fill={fill}/>
          <circle cx="44" cy="24" r="3" fill={fill}/>
        </svg>
      );

    case "Ascendant":
      // AS or AC - Arrow pointing right
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Ascendant"}</title>
          <line x1="16" y1="32" x2="48" y2="32" stroke={fill} strokeWidth="2.5"/>
          <line x1="48" y1="32" x2="42" y2="26" stroke={fill} strokeWidth="2.5"/>
          <line x1="48" y1="32" x2="42" y2="38" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    case "Midheaven":
      // MC - Arrow pointing up
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Midheaven"}</title>
          <line x1="32" y1="16" x2="32" y2="48" stroke={fill} strokeWidth="2.5"/>
          <line x1="32" y1="16" x2="26" y2="22" stroke={fill} strokeWidth="2.5"/>
          <line x1="32" y1="16" x2="38" y2="22" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );

    default:
      return (
        <svg {...common} className={className}>
          <circle cx="32" cy="32" r="14" fill="none" stroke={fill} strokeWidth="2.5"/>
        </svg>
      );
  }
}
