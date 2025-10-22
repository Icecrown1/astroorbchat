import { storage } from "../storage";
import { calculateNatalChartPython, type NatalChartResult } from "./pythonNatal";
import { getAstrologyInterpretation } from "./openai";
import { geocodeCityWithFallback } from "./geocoding";
import type { User, NatalChart } from "@shared/schema";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

function getTimezoneOffset(tz: string, year: number, month: number, day: number): number {
  // Create a date in the specified timezone
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 12:00:00`;
  const tzDate = dayjs.tz(dateStr, tz);
  const utcDate = dayjs.utc(dateStr);
  
  // Return offset in minutes
  return tzDate.utcOffset();
}

export async function computeNatalFromUser(user: User): Promise<NatalChartResult> {
  // Parse birthday date safely (extract year/month/day from string directly to avoid timezone issues)
  const birthdayStr = typeof user.birthdayDate === 'string' ? user.birthdayDate : user.birthdayDate.toISOString();
  const [datePart] = birthdayStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  
  const birthTimeStr = user.birthTime || "12:00";
  const [localHours, localMinutes] = birthTimeStr.split(":").map(Number);
  
  console.log('[NATAL SERVICE] Computing natal chart for user:', {
    userId: user.id,
    name: user.name,
    birthdayDate: user.birthdayDate,
    birthTime: user.birthTime,
    birthPlace: user.birthPlace,
    timezone: user.timezone,
    parsedDate: { year, month, day },
    localTime: { hours: localHours, minutes: localMinutes }
  });
  
  // Geocode birth city to get coordinates
  const coords = await geocodeCityWithFallback(user.birthPlace);
  
  console.log('[NATAL SERVICE] Geocoded coordinates:', coords);
  
  // Convert local time to UTC for Swiss Ephemeris
  const userTimezone = user.timezone || 'UTC';
  
  // Create datetime in user's timezone
  const localDateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}:00`;
  const localDateTime = dayjs.tz(localDateTimeStr, userTimezone);
  
  // Convert to UTC
  const utcDateTime = localDateTime.utc();
  
  const pythonInput = {
    year: utcDateTime.year(),
    month: utcDateTime.month() + 1, // dayjs months are 0-indexed
    day: utcDateTime.date(),
    hour: utcDateTime.hour(),
    minute: utcDateTime.minute(),
    latitude: coords.lat,
    longitude: coords.lon,
  };
  
  console.log('[NATAL SERVICE] Local time:', localDateTime.format('YYYY-MM-DD HH:mm:ss'), userTimezone);
  console.log('[NATAL SERVICE] UTC time:', utcDateTime.format('YYYY-MM-DD HH:mm:ss'));
  console.log('[NATAL SERVICE] Sending to Python:', pythonInput);
  
  const pythonChart = await calculateNatalChartPython(pythonInput);
  
  return pythonChart;
}

export async function ensureUserNatalChart(userId: string): Promise<NatalChart> {
  const existingChart = await storage.getNatalChart(userId);
  
  if (existingChart) {
    return existingChart;
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  const natalData = await computeNatalFromUser(user);
  
  const chart = await storage.createNatalChart({
    userId,
    data: natalData,
  });
  
  return chart;
}

/**
 * Ensures natal chart interpretation is cached for the given locale
 * Returns interpretation from cache if exists, generates and saves if not
 */
export async function ensureNatalInterpretation(userId: string, locale: string = 'ru'): Promise<string> {
  const chart = await storage.getNatalChart(userId);
  
  if (!chart) {
    throw new Error("Natal chart not found");
  }
  
  // Check if interpretation already exists for this locale
  const interpretations = chart.professionalInterpretation as Record<string, string> | null;
  if (interpretations && interpretations[locale]) {
    console.log(`[NATAL SERVICE] Using cached interpretation for locale: ${locale}`);
    return interpretations[locale];
  }
  
  // Generate new interpretation
  console.log(`[NATAL SERVICE] Generating new interpretation for locale: ${locale}`);
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  const chartData = chart.data as NatalChartResult;
  const interpretation = await getAstrologyInterpretation(
    "natal",
    chartData,
    locale,
    user.gender || 'other'
  );
  
  // Save interpretation to database
  const updatedInterpretations = {
    ...(interpretations || {}),
    [locale]: interpretation,
  };
  
  await storage.updateNatalChart(userId, {
    professionalInterpretation: updatedInterpretations,
  });
  
  return interpretation;
}

/**
 * Рассчитывает оверлеи домов - какие планеты партнера попадают в какие дома пользователя
 */
export function calculateHouseOverlays(
  partnerPlanets: Record<string, any>,
  userHouses: Record<string, any>
): Record<string, string[]> {
  const overlays: Record<string, string[]> = {};
  
  // Инициализируем массивы для каждого дома
  for (let i = 1; i <= 12; i++) {
    overlays[`house${i}`] = [];
  }
  
  // Extract house cusps array from houses object
  let houseCusps: number[] | Record<string, number>;
  if (Array.isArray(userHouses)) {
    houseCusps = userHouses;
  } else if (userHouses.cusps && Array.isArray(userHouses.cusps)) {
    houseCusps = userHouses.cusps;
  } else {
    houseCusps = userHouses;
  }
  
  // Validate houseCusps is array before using
  if (!Array.isArray(houseCusps)) {
    console.warn('House cusps is not an array, using fallback');
    return overlays; // Return empty overlays
  }
  
  // Для каждой планеты партнера определяем в какой дом пользователя она попадает
  Object.entries(partnerPlanets).forEach(([planetName, planetData]) => {
    const planetLongitude = planetData.longitude || planetData.lon_deg;
    if (planetLongitude !== undefined) {
      const houseNumber = determineHouse(planetLongitude, houseCusps as number[]);
      overlays[`house${houseNumber}`].push(planetName);
    }
  });
  
  return overlays;
}

/**
 * Определяет дом на основе долготы планеты и куспидов
 */
function determineHouse(longitude: number, cusps: number[]): number {
  const normalizedLon = longitude % 360;
  
  for (let i = 0; i < cusps.length; i++) {
    const currentCusp = cusps[i];
    const nextCusp = cusps[(i + 1) % cusps.length];
    
    if (nextCusp > currentCusp) {
      if (normalizedLon >= currentCusp && normalizedLon < nextCusp) {
        return i + 1;
      }
    } else {
      // Handle wrap around (e.g., 12th house crossing 0°)
      if (normalizedLon >= currentCusp || normalizedLon < nextCusp) {
        return i + 1;
      }
    }
  }
  
  return 1; // Default to 1st house
}

export async function recomputeIfProfileChanged(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  const chart = await storage.getNatalChart(userId);
  
  if (!user || !chart) {
    return;
  }
  
  const chartUpdatedAt = new Date(chart.updatedAt);
  const userUpdatedAt = new Date(user.updatedAt);
  
  // Only recompute if user profile was updated after the chart
  if (userUpdatedAt > chartUpdatedAt) {
    console.log('[NATAL SERVICE] Profile changed, recomputing chart and clearing interpretations');
    const newData = await computeNatalFromUser(user);
    
    await storage.updateNatalChart(userId, { 
      data: newData,
      professionalInterpretation: null, // Clear cached interpretations when profile changes
    });
  }
}
