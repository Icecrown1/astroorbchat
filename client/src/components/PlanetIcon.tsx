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
          <circle cx="32" cy="32" r="14" fill="none" stroke={fill} strokeWidth="3"/>
          <circle cx="32" cy="32" r="5" fill={fill}/>
        </svg>
      );

    case "Moon":
      // ☽ - Crescent
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Moon"}</title>
          <path d="M32 16 A16 16 0 1 0 32 48 A11 11 0 1 1 32 16 Z" 
                fill="none" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Mercury":
      // ☿ - Circle with cross below and horns on top
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Mercury"}</title>
          <circle cx="32" cy="30" r="7" fill="none" stroke={fill} strokeWidth="3"/>
          <path d="M25 22 Q32 16 39 22" fill="none" stroke={fill} strokeWidth="3"/>
          <line x1="32" y1="37" x2="32" y2="48" stroke={fill} strokeWidth="3"/>
          <line x1="27" y1="44" x2="37" y2="44" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Venus":
      // ♀ - Circle with cross below
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Venus"}</title>
          <circle cx="32" cy="24" r="9" fill="none" stroke={fill} strokeWidth="3"/>
          <line x1="32" y1="33" x2="32" y2="48" stroke={fill} strokeWidth="3"/>
          <line x1="25" y1="42" x2="39" y2="42" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Mars":
      // ♂ - Circle with arrow pointing upper-right
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Mars"}</title>
          <circle cx="28" cy="36" r="9" fill="none" stroke={fill} strokeWidth="3"/>
          <line x1="35" y1="29" x2="47" y2="17" stroke={fill} strokeWidth="3"/>
          <line x1="47" y1="17" x2="47" y2="24" stroke={fill} strokeWidth="3"/>
          <line x1="47" y1="17" x2="40" y2="17" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Jupiter":
      // ♃ - Stylized number 4 or 2|
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Jupiter"}</title>
          <line x1="22" y1="18" x2="22" y2="46" stroke={fill} strokeWidth="3"/>
          <path d="M22 30 Q32 22 42 30" fill="none" stroke={fill} strokeWidth="3"/>
          <line x1="30" y1="37" x2="38" y2="37" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Saturn":
      // ♄ - Cross with tail (like letter h)
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Saturn"}</title>
          <line x1="32" y1="18" x2="32" y2="38" stroke={fill} strokeWidth="3"/>
          <line x1="22" y1="28" x2="42" y2="28" stroke={fill} strokeWidth="3"/>
          <path d="M18 46 Q26 38 32 40" fill="none" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Uranus":
      // ♅ - H with circle in center and dot on top
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Uranus"}</title>
          <circle cx="32" cy="36" r="7" fill="none" stroke={fill} strokeWidth="3"/>
          <line x1="25" y1="18" x2="25" y2="36" stroke={fill} strokeWidth="3"/>
          <line x1="39" y1="18" x2="39" y2="36" stroke={fill} strokeWidth="3"/>
          <circle cx="32" cy="18" r="4" fill={fill}/>
        </svg>
      );

    case "Neptune":
      // ♆ - Trident
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Neptune"}</title>
          <line x1="32" y1="20" x2="32" y2="46" stroke={fill} strokeWidth="3"/>
          <line x1="22" y1="20" x2="42" y2="20" stroke={fill} strokeWidth="3"/>
          <path d="M26 20 Q26 32 22 40" fill="none" stroke={fill} strokeWidth="3"/>
          <path d="M38 20 Q38 32 42 40" fill="none" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Pluto":
      // ♇ - PL monogram or circle with P-like symbol
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Pluto"}</title>
          <circle cx="32" cy="24" r="7" fill="none" stroke={fill} strokeWidth="3"/>
          <line x1="25" y1="24" x2="25" y2="46" stroke={fill} strokeWidth="3"/>
          <line x1="20" y1="38" x2="36" y2="38" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "North Node":
      // ☊ - Rahu (Horseshoe shape upward)
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Rahu"}</title>
          <path d="M22 42 Q22 22 32 22 Q42 22 42 42" 
                fill="none" stroke={fill} strokeWidth="3" strokeLinecap="round"/>
          <circle cx="22" cy="42" r="4" fill={fill}/>
          <circle cx="42" cy="42" r="4" fill={fill}/>
        </svg>
      );

    case "South Node":
      // ☋ - Ketu (Horseshoe shape downward)
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Ketu"}</title>
          <path d="M22 22 Q22 42 32 42 Q42 42 42 22" 
                fill="none" stroke={fill} strokeWidth="3" strokeLinecap="round"/>
          <circle cx="22" cy="22" r="4" fill={fill}/>
          <circle cx="42" cy="22" r="4" fill={fill}/>
        </svg>
      );

    case "Ascendant":
      // AS or AC - Arrow pointing right
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Ascendant"}</title>
          <line x1="18" y1="32" x2="46" y2="32" stroke={fill} strokeWidth="3"/>
          <line x1="46" y1="32" x2="40" y2="26" stroke={fill} strokeWidth="3"/>
          <line x1="46" y1="32" x2="40" y2="38" stroke={fill} strokeWidth="3"/>
        </svg>
      );

    case "Midheaven":
      // MC - Arrow pointing up
      return (
        <svg {...common} className={`${className ?? ""} ${animClass}`}>
          <title>{title ?? "Midheaven"}</title>
          <line x1="32" y1="18" x2="32" y2="46" stroke={fill} strokeWidth="3"/>
          <line x1="32" y1="18" x2="26" y2="24" stroke={fill} strokeWidth="3"/>
          <line x1="32" y1="18" x2="38" y2="24" stroke={fill} strokeWidth="3"/>
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
