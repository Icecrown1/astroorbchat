/**
 * Геокодинг - конвертация названия города в координаты
 * 1. Сначала ищем в локальной базе
 * 2. Если не найдено - используем Nominatim API (OpenStreetMap)
 */

import { findCityCoordinates, CityCoordinates } from './cities';
import { find as findTimezone } from 'geo-tz';

/**
 * Получает координаты города
 * @param cityName - название города
 * @returns координаты { lat, lon } или null если не найдено
 */
export async function geocodeCity(cityName: string | null): Promise<CityCoordinates | null> {
  if (!cityName || cityName.trim() === '') {
    return null;
  }

  // 1. Проверяем локальную базу
  const localCoords = findCityCoordinates(cityName);
  if (localCoords) {
    console.log(`[Geocoding] Found ${cityName} in local database:`, localCoords);
    return localCoords;
  }

  // 2. Используем Nominatim API (OpenStreetMap)
  try {
    const encodedCity = encodeURIComponent(cityName);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedCity}&format=json&limit=1`;
    
    console.log(`[Geocoding] Querying Nominatim API for: ${cityName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AstroOrb/1.0 (Telegram Mini App)',
      },
    });

    if (!response.ok) {
      console.error(`[Geocoding] Nominatim API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
      console.log(`[Geocoding] Found ${cityName} via Nominatim:`, result);
      return result;
    }

    console.log(`[Geocoding] City ${cityName} not found`);
    return null;
  } catch (error) {
    console.error(`[Geocoding] Error fetching from Nominatim:`, error);
    return null;
  }
}

/**
 * Получает координаты с fallback на Москву
 * @param cityName - название города
 * @returns координаты (или Москва по умолчанию)
 */
export async function geocodeCityWithFallback(cityName: string | null): Promise<CityCoordinates> {
  const coords = await geocodeCity(cityName);
  
  if (coords) {
    return coords;
  }

  // Fallback на Москву
  console.log(`[Geocoding] Using Moscow as fallback for: ${cityName || 'unknown'}`);
  return { lat: 55.7558, lon: 37.6173 };
}

export async function getTimezoneFromCity(cityName: string | null): Promise<string> {
  const coords = await geocodeCityWithFallback(cityName);
  try {
    const timezones = findTimezone(coords.lat, coords.lon);
    if (timezones && timezones.length > 0) {
      console.log(`[Geocoding] Timezone for ${cityName || 'unknown'}: ${timezones[0]}`);
      return timezones[0];
    }
  } catch (error) {
    console.error(`[Geocoding] Error finding timezone for coords:`, error);
  }
  return 'Europe/Moscow';
}
