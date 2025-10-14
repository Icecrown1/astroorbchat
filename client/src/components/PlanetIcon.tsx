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
}: PlanetIconProps) {
  const { fill, stroke } = useColors(variant);
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    role: "img",
    "aria-label": title ?? name,
  } as const;

  switch (name) {
    case "Sun":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Sun"}</title>
          <defs>
            <radialGradient id="gSun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffe08a" />
              <stop offset="60%" stopColor={fill} />
              <stop offset="100%" stopColor={stroke} />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="16" fill="url(#gSun)" stroke={stroke} strokeWidth="1.5"/>
          {Array.from({length:12}).map((_,i)=> {
            const a = (i * Math.PI*2)/12;
            const x1 = 32 + Math.cos(a)*22, y1 = 32 + Math.sin(a)*22;
            const x2 = 32 + Math.cos(a)*30, y2 = 32 + Math.sin(a)*30;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth="2" strokeLinecap="round"/>;
          })}
        </svg>
      );

    case "Moon":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Moon"}</title>
          <defs>
            <linearGradient id="gMoon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f5f2e8"/>
              <stop offset="100%" stopColor={fill}/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="16" fill="#faf8f1" stroke={stroke} strokeWidth="1"/>
          <path d="M40,16 A16,16 0 1,0 40,48 A12,16 0 1,1 40,16 Z"
                fill="url(#gMoon)" stroke={stroke} strokeWidth="1"/>
        </svg>
      );

    case "Saturn":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Saturn"}</title>
          <defs>
            <linearGradient id="gSat" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={fill}/>
              <stop offset="100%" stopColor={stroke}/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="14" fill="url(#gSat)" stroke={stroke} strokeWidth="1.5"/>
          <ellipse cx="32" cy="34" rx="26" ry="10" fill="none" stroke={fill} strokeWidth="3"/>
          <ellipse cx="32" cy="34" rx="26" ry="10" fill="none" stroke={stroke} strokeWidth="1"/>
          <ellipse cx="32" cy="34" rx="18" ry="7" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1"/>
        </svg>
      );

    case "Mercury":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Mercury"}</title>
          <circle cx="32" cy="28" r="10" fill={fill} stroke={stroke} strokeWidth="1.5"/>
          <path d="M22 16 C26 12, 38 12, 42 16" fill="none" stroke={stroke} strokeWidth="2"/>
          <line x1="32" y1="38" x2="32" y2="48" stroke={stroke} strokeWidth="2"/>
          <line x1="28" y1="44" x2="36" y2="44" stroke={stroke} strokeWidth="2"/>
        </svg>
      );

    case "Venus":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Venus"}</title>
          <circle cx="32" cy="24" r="10" fill={fill} stroke={stroke} strokeWidth="1.5"/>
          <line x1="32" y1="34" x2="32" y2="50" stroke={stroke} strokeWidth="2"/>
          <line x1="24" y1="42" x2="40" y2="42" stroke={stroke} strokeWidth="2"/>
        </svg>
      );

    case "Mars":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Mars"}</title>
          <circle cx="28" cy="36" r="10" fill={fill} stroke={stroke} strokeWidth="1.5"/>
          <line x1="36" y1="28" x2="46" y2="18" stroke={stroke} strokeWidth="2"/>
          <polygon points="46,18 42,18 46,22" fill={stroke}/>
        </svg>
      );

    case "Jupiter":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Jupiter"}</title>
          <circle cx="32" cy="28" r="12" fill={fill} stroke={stroke} strokeWidth="1.5"/>
          <path d="M22 36 H42" stroke={stroke} strokeWidth="2"/>
          <path d="M26 40 H40" stroke={stroke} strokeWidth="2"/>
        </svg>
      );

    case "Uranus":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Uranus"}</title>
          <circle cx="32" cy="34" r="10" fill={fill} stroke={stroke} strokeWidth="1.5"/>
          <line x1="32" y1="12" x2="32" y2="24" stroke={stroke} strokeWidth="2"/>
          <line x1="22" y1="20" x2="42" y2="20" stroke={stroke} strokeWidth="2"/>
        </svg>
      );

    case "Neptune":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Neptune"}</title>
          <line x1="20" y1="20" x2="44" y2="20" stroke={stroke} strokeWidth="2"/>
          <path d="M24 20 C24 34, 40 34, 40 20" fill="none" stroke={stroke} strokeWidth="2"/>
          <line x1="32" y1="20" x2="32" y2="48" stroke={stroke} strokeWidth="2"/>
          <line x1="26" y1="42" x2="38" y2="42" stroke={stroke} strokeWidth="2"/>
        </svg>
      );

    case "Pluto":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Pluto"}</title>
          <circle cx="32" cy="24" r="8" fill={fill} stroke={stroke} strokeWidth="1.5"/>
          <line x1="32" y1="32" x2="32" y2="48" stroke={stroke} strokeWidth="2"/>
          <line x1="24" y1="40" x2="40" y2="40" stroke={stroke} strokeWidth="2"/>
        </svg>
      );

    case "North Node":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "North Node"}</title>
          <path d="M20 40 Q32 20, 44 40" fill="none" stroke={stroke} strokeWidth="2"/>
          <circle cx="32" cy="26" r="6" fill={fill} stroke={stroke} strokeWidth="1.5"/>
        </svg>
      );

    case "South Node":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "South Node"}</title>
          <path d="M20 24 Q32 44, 44 24" fill="none" stroke={stroke} strokeWidth="2"/>
          <circle cx="32" cy="38" r="6" fill={fill} stroke={stroke} strokeWidth="1.5"/>
        </svg>
      );

    case "Ascendant":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Ascendant"}</title>
          <line x1="12" y1="32" x2="52" y2="32" stroke={stroke} strokeWidth="2"/>
          <polygon points="52,32 46,28 46,36" fill={stroke}/>
        </svg>
      );

    case "Midheaven":
      return (
        <svg {...common} className={className}>
          <title>{title ?? "Midheaven"}</title>
          <line x1="32" y1="12" x2="32" y2="52" stroke={stroke} strokeWidth="2"/>
          <polygon points="32,12 28,18 36,18" fill={stroke}/>
        </svg>
      );

    default:
      return (
        <svg {...common} className={className}>
          <circle cx="32" cy="32" r="14" fill={fill} stroke={stroke} strokeWidth="1.5"/>
        </svg>
      );
  }
}
