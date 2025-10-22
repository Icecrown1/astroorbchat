import { apiRequest } from './queryClient';

// Новый формат событий с лунными фазами и транзитами
export interface ImportantEvent {
  type: 'new_moon' | 'full_moon' | 'planet_transit';
  date: string;
  sign: string;
  degree?: number;
  planet?: string;  // Для транзитов планет
  from_sign?: string;  // Для транзитов: из какого знака
  to_sign?: string;  // Для транзитов: в какой знак
  house_for_sun_sign?: number;  // Дом для солнечного знака пользователя
  importance?: 'high';  // Особо важное событие
  importance_reason?: 'in_sun_sign' | 'in_ascendant' | 'in_1st_house' | 'in_7th_house' | 'in_10th_house';  // Причина важности
}

export interface ImportantDateInterpretation {
  title: string;
  window: string;
  whatItMeans: string[];
  risks: string[];
  do: string[];
  dont: string[];
  timingTips: string[];
}

export async function getImportantDates(): Promise<ImportantEvent[]> {
  const response = await apiRequest('GET', '/api/astrology/important-dates');
  return response.data;
}

export async function getImportantDateInterpretation(
  event: ImportantEvent,
  locale: string = 'ru'
): Promise<string> {
  const response = await apiRequest('POST', '/api/astrology/important-dates/interpret', {
    eventType: event.type,
    date: event.date,
    sign: event.sign,
    planet: event.planet,
    to_sign: event.to_sign,
    house_for_sun_sign: event.house_for_sun_sign,
    locale,
  });
  return response.data.interpretation;
}
