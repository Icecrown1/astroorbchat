import { julian } from 'astronomia';
import * as AstronomyEngine from 'astronomy-engine';

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;

function getZodiacSign(longitude: number): string {
  const signIndex = Math.floor(longitude / 30);
  return ZODIAC_SIGNS[signIndex % 12];
}

export function calculateNatalChart(birthDate: Date, birthTime?: string) {
  const planets: Array<{ name: string; position: number; sign: string; meaning?: string }> = [];
  const aspects: Array<{ planet1: string; planet2: string; type: string; angle: number }> = [];

  try {
    const astroTime = AstronomyEngine.MakeTime(birthDate);
    
    PLANETS.forEach((planetName) => {
      try {
        let longitude: number | undefined;
        
        if (planetName === 'Sun') {
          const sunPos = AstronomyEngine.SunPosition(astroTime);
          longitude = sunPos.elon;
        } else {
          const bodyName = planetName as keyof typeof AstronomyEngine.Body;
          const body = AstronomyEngine.Body[bodyName];
          longitude = AstronomyEngine.EclipticLongitude(body, birthDate);
        }
        
        if (longitude !== undefined && !isNaN(longitude)) {
          planets.push({
            name: planetName,
            position: (longitude + 360) % 360,
            sign: getZodiacSign((longitude + 360) % 360),
          });
        }
      } catch (err) {
        console.error(`Error calculating ${planetName}:`, err);
      }
    });

    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const angle = Math.abs(planets[i].position - planets[j].position);
        const normalizedAngle = angle > 180 ? 360 - angle : angle;

        if (Math.abs(normalizedAngle - 0) < 6) {
          aspects.push({
            planet1: planets[i].name,
            planet2: planets[j].name,
            type: 'conjunction',
            angle: normalizedAngle,
          });
        } else if (Math.abs(normalizedAngle - 60) < 6) {
          aspects.push({
            planet1: planets[i].name,
            planet2: planets[j].name,
            type: 'sextile',
            angle: normalizedAngle,
          });
        } else if (Math.abs(normalizedAngle - 90) < 6) {
          aspects.push({
            planet1: planets[i].name,
            planet2: planets[j].name,
            type: 'square',
            angle: normalizedAngle,
          });
        } else if (Math.abs(normalizedAngle - 120) < 6) {
          aspects.push({
            planet1: planets[i].name,
            planet2: planets[j].name,
            type: 'trine',
            angle: normalizedAngle,
          });
        } else if (Math.abs(normalizedAngle - 180) < 6) {
          aspects.push({
            planet1: planets[i].name,
            planet2: planets[j].name,
            type: 'opposition',
            angle: normalizedAngle,
          });
        }
      }
    }
  } catch (error) {
    console.error('Natal chart calculation error:', error);
  }

  console.log('Calculated planets:', planets.length, planets);
  console.log('Calculated aspects:', aspects.length);
  return { planets, aspects };
}

export function calculateSolarReturn(birthDate: Date) {
  const today = new Date();
  const solarYear = today.getFullYear();
  const solarDate = new Date(solarYear, birthDate.getMonth(), birthDate.getDate());

  try {
    const astroTime = AstronomyEngine.MakeTime(solarDate);
    const sunPos = AstronomyEngine.SunPosition(astroTime);
    const longitude = sunPos.elon;
    
    if (longitude !== undefined && !isNaN(longitude)) {
      return {
        position: (longitude + 360) % 360,
        sign: getZodiacSign((longitude + 360) % 360),
        date: solarDate,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Solar return calculation error:', error);
    return null;
  }
}

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export function calculateBaZi(birthDate: Date) {
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();
  const hour = birthDate.getHours();

  const yearStem = HEAVENLY_STEMS[(year - 4) % 10];
  const yearBranch = EARTHLY_BRANCHES[(year - 4) % 12];

  const monthStem = HEAVENLY_STEMS[(year * 12 + month - 3) % 10];
  const monthBranch = EARTHLY_BRANCHES[(month - 1) % 12];

  const jd = Math.floor(julian.CalendarGregorianToJD(year, month, day));
  const dayStem = HEAVENLY_STEMS[(jd - 11) % 10];
  const dayBranch = EARTHLY_BRANCHES[(jd - 11) % 12];

  const hourBranch = EARTHLY_BRANCHES[Math.floor((hour + 1) / 2) % 12];
  const hourStem = HEAVENLY_STEMS[((Math.floor(jd - 11) % 10) * 12 + Math.floor((hour + 1) / 2)) % 10];

  return {
    year: { stem: yearStem, branch: yearBranch },
    month: { stem: monthStem, branch: monthBranch },
    day: { stem: dayStem, branch: dayBranch },
    hour: { stem: hourStem, branch: hourBranch },
  };
}
