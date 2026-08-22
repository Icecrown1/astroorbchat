/**
 * Лёгкие метаданные 22 арканов для клиента (октаграмма, шторка узла).
 * Полная база знаний с трактовками — на сервере (server/lib/matrixKb.ts).
 * Марсельский порядок: 8 = Справедливость, 11 = Сила.
 */
export interface ArcanaMeta {
  n: number;
  ru: string;
  en: string;
  keyRu: string;
  keyEn: string;
}

export const ARCANA_META: ArcanaMeta[] = [
  { n: 1, ru: 'Маг', en: 'The Magician', keyRu: 'воля и начало', keyEn: 'will and initiative' },
  { n: 2, ru: 'Жрица', en: 'The High Priestess', keyRu: 'интуиция и знание', keyEn: 'intuition and knowledge' },
  { n: 3, ru: 'Императрица', en: 'The Empress', keyRu: 'изобилие и рост', keyEn: 'abundance and growth' },
  { n: 4, ru: 'Император', en: 'The Emperor', keyRu: 'порядок и власть', keyEn: 'order and authority' },
  { n: 5, ru: 'Жрец', en: 'The Hierophant', keyRu: 'наставничество и традиция', keyEn: 'mentorship and tradition' },
  { n: 6, ru: 'Влюблённые', en: 'The Lovers', keyRu: 'выбор и союз', keyEn: 'choice and union' },
  { n: 7, ru: 'Колесница', en: 'The Chariot', keyRu: 'движение и победа', keyEn: 'momentum and victory' },
  { n: 8, ru: 'Справедливость', en: 'Justice', keyRu: 'баланс и честность', keyEn: 'balance and honesty' },
  { n: 9, ru: 'Отшельник', en: 'The Hermit', keyRu: 'мудрость и поиск', keyEn: 'wisdom and search' },
  { n: 10, ru: 'Колесо Фортуны', en: 'Wheel of Fortune', keyRu: 'циклы и шанс', keyEn: 'cycles and chance' },
  { n: 11, ru: 'Сила', en: 'Strength', keyRu: 'мягкая сила и страсть', keyEn: 'soft power and passion' },
  { n: 12, ru: 'Повешенный', en: 'The Hanged Man', keyRu: 'иной взгляд и пауза', keyEn: 'new angle and pause' },
  { n: 13, ru: 'Смерть', en: 'Death', keyRu: 'трансформация', keyEn: 'transformation' },
  { n: 14, ru: 'Умеренность', en: 'Temperance', keyRu: 'мера и исцеление', keyEn: 'measure and healing' },
  { n: 15, ru: 'Дьявол', en: 'The Devil', keyRu: 'желания и материя', keyEn: 'desire and matter' },
  { n: 16, ru: 'Башня', en: 'The Tower', keyRu: 'прорыв и правда', keyEn: 'breakthrough and truth' },
  { n: 17, ru: 'Звезда', en: 'The Star', keyRu: 'надежда и творчество', keyEn: 'hope and creativity' },
  { n: 18, ru: 'Луна', en: 'The Moon', keyRu: 'подсознание и образы', keyEn: 'subconscious and imagery' },
  { n: 19, ru: 'Солнце', en: 'The Sun', keyRu: 'радость и успех', keyEn: 'joy and success' },
  { n: 20, ru: 'Суд', en: 'Judgement', keyRu: 'пробуждение и род', keyEn: 'awakening and lineage' },
  { n: 21, ru: 'Мир', en: 'The World', keyRu: 'целостность и масштаб', keyEn: 'wholeness and scale' },
  { n: 22, ru: 'Шут', en: 'The Fool', keyRu: 'свобода и лёгкость', keyEn: 'freedom and lightness' },
];

export const arcanaMetaByN = (n: number): ArcanaMeta => ARCANA_META[n - 1];
