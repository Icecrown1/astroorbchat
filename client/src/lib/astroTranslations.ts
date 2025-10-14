import { Locale } from './translations';

type PlanetName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'
  | 'North Node' | 'South Node' | 'Ascendant' | 'Midheaven';

type SignName =
  | 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo'
  | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

const PLANET_TRANSLATIONS: Record<Locale, Record<PlanetName, string>> = {
  en: {
    'Sun': 'Sun',
    'Moon': 'Moon',
    'Mercury': 'Mercury',
    'Venus': 'Venus',
    'Mars': 'Mars',
    'Jupiter': 'Jupiter',
    'Saturn': 'Saturn',
    'Uranus': 'Uranus',
    'Neptune': 'Neptune',
    'Pluto': 'Pluto',
    'North Node': 'North Node',
    'South Node': 'South Node',
    'Ascendant': 'Ascendant',
    'Midheaven': 'Midheaven',
  },
  ru: {
    'Sun': 'Солнце',
    'Moon': 'Луна',
    'Mercury': 'Меркурий',
    'Venus': 'Венера',
    'Mars': 'Марс',
    'Jupiter': 'Юпитер',
    'Saturn': 'Сатурн',
    'Uranus': 'Уран',
    'Neptune': 'Нептун',
    'Pluto': 'Плутон',
    'North Node': 'Северный узел',
    'South Node': 'Южный узел',
    'Ascendant': 'Асцендент',
    'Midheaven': 'МС',
  },
};

const SIGN_TRANSLATIONS: Record<Locale, Record<SignName, string>> = {
  en: {
    'Aries': 'Aries',
    'Taurus': 'Taurus',
    'Gemini': 'Gemini',
    'Cancer': 'Cancer',
    'Leo': 'Leo',
    'Virgo': 'Virgo',
    'Libra': 'Libra',
    'Scorpio': 'Scorpio',
    'Sagittarius': 'Sagittarius',
    'Capricorn': 'Capricorn',
    'Aquarius': 'Aquarius',
    'Pisces': 'Pisces',
  },
  ru: {
    'Aries': 'Овен',
    'Taurus': 'Телец',
    'Gemini': 'Близнецы',
    'Cancer': 'Рак',
    'Leo': 'Лев',
    'Virgo': 'Дева',
    'Libra': 'Весы',
    'Scorpio': 'Скорпион',
    'Sagittarius': 'Стрелец',
    'Capricorn': 'Козерог',
    'Aquarius': 'Водолей',
    'Pisces': 'Рыбы',
  },
};

export function translatePlanet(planetName: string, locale: Locale): string {
  const normalizedName = planetName.trim() as PlanetName;
  return PLANET_TRANSLATIONS[locale]?.[normalizedName] ?? planetName;
}

export function translateSign(signName: string, locale: Locale): string {
  const normalizedName = signName.trim() as SignName;
  return SIGN_TRANSLATIONS[locale]?.[normalizedName] ?? signName;
}
