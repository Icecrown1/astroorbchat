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
    const jd = julian.CalendarGregorianToJD(
      birthDate.getFullYear(),
      birthDate.getMonth() + 1,
      birthDate.getDate()
    );

    PLANETS.forEach((planetName) => {
      try {
        let bodyName = planetName as any;
        if (planetName === 'Sun') bodyName = 'Sun';
        else if (planetName === 'Moon') bodyName = 'Moon';
        else if (planetName === 'Mercury') bodyName = 'Mercury';
        else if (planetName === 'Venus') bodyName = 'Venus';
        else if (planetName === 'Mars') bodyName = 'Mars';
        else if (planetName === 'Jupiter') bodyName = 'Jupiter';
        else if (planetName === 'Saturn') bodyName = 'Saturn';

        const equ = (AstronomyEngine as any).Equator((AstronomyEngine as any).Body[bodyName], birthDate);
        const longitude = (equ.ra * 15) % 360;

        planets.push({
          name: planetName,
          position: longitude,
          sign: getZodiacSign(longitude),
        });
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

  return { planets, aspects };
}

export function calculateSolarReturn(birthDate: Date) {
  const today = new Date();
  const solarYear = today.getFullYear();
  const solarDate = new Date(solarYear, birthDate.getMonth(), birthDate.getDate());

  try {
    const equ = (AstronomyEngine as any).Equator((AstronomyEngine as any).Body.Sun, solarDate);
    const longitude = (equ.ra * 15) % 360;

    return {
      position: longitude,
      sign: getZodiacSign(longitude),
      date: solarDate,
    };
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
