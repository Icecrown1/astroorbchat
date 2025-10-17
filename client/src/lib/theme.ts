export const ASTRO_ORB_PALETTE = {
  solarGold: '#D4A642',
  deepAmber: '#9C6B1F',
  pearlWhite: '#FAFAF8',
  iridescentBlue: '#9BC3E3',
  softRose: '#EAB9C3',
  opalViolet: '#B2A4E0',
} as const;

export const PLANET_COLORS = {
  sun: ASTRO_ORB_PALETTE.solarGold,
  moon: ASTRO_ORB_PALETTE.pearlWhite,
  mercury: ASTRO_ORB_PALETTE.iridescentBlue,
  venus: ASTRO_ORB_PALETTE.softRose,
  mars: '#E57373',
  jupiter: ASTRO_ORB_PALETTE.deepAmber,
  saturn: '#9575CD',
  uranus: ASTRO_ORB_PALETTE.iridescentBlue,
  neptune: '#4FC3F7',
  pluto: '#757575',
  ascendant: ASTRO_ORB_PALETTE.solarGold,
  midheaven: ASTRO_ORB_PALETTE.opalViolet,
} as const;

export const GRADIENTS = {
  primary: 'linear-gradient(135deg, #D4A642, #EAB9C3, #B2A4E0)',
  aura: 'radial-gradient(circle, #FAFAF8 10%, #9BC3E3 60%, transparent 100%)',
} as const;
