import { storage } from "../storage";
import { calculateNatalChartPython, type NatalChartResult } from "./pythonNatal";
import { getAstrologyInterpretation } from "./openai";
import type { User, NatalChart } from "@shared/schema";

export async function computeNatalFromUser(user: User, locale: string = 'ru'): Promise<NatalChartResult & { interpretation: string }> {
  const birthDate = new Date(user.birthdayDate);
  const birthTimeStr = user.birthTime || "12:00";
  const [hours, minutes] = birthTimeStr.split(":").map(Number);
  
  const latitude = 55.7558; // Moscow fallback
  const longitude = 37.6173; // Moscow fallback
  
  const pythonChart = await calculateNatalChartPython({
    year: birthDate.getFullYear(),
    month: birthDate.getMonth() + 1,
    day: birthDate.getDate(),
    hour: hours,
    minute: minutes,
    latitude,
    longitude,
  });
  
  // Generate AI interpretation
  const interpretation = await getAstrologyInterpretation(
    "natal",
    pythonChart,
    locale,
    user.gender || 'other'
  );
  
  return {
    ...pythonChart,
    interpretation,
  };
}

export async function ensureUserNatalChart(userId: string, locale: string = 'ru'): Promise<NatalChart> {
  const existingChart = await storage.getNatalChart(userId);
  
  if (existingChart) {
    return existingChart;
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  const natalData = await computeNatalFromUser(user, locale);
  
  const chart = await storage.createNatalChart({
    userId,
    data: natalData,
  });
  
  return chart;
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

export async function recomputeIfProfileChanged(userId: string, locale: string = 'ru'): Promise<void> {
  const user = await storage.getUser(userId);
  const chart = await storage.getNatalChart(userId);
  
  if (!user || !chart) {
    return;
  }
  
  const chartCreatedAt = new Date(chart.createdAt);
  const userUpdatedAt = new Date(user.updatedAt);
  
  if (userUpdatedAt > chartCreatedAt) {
    const newData = await computeNatalFromUser(user, locale);
    
    await storage.updateNatalChart(userId, { 
      data: newData,
    });
  }
}
