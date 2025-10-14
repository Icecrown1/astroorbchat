import { storage } from "../storage";
import { calculateNatalChartPython, type NatalChartResult } from "./pythonNatal";
import { getAstrologyInterpretation, getProfessionalInterpretation, type ProfessionalChartData } from "./openai";
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
  
  // Generate professional interpretation for user's own chart (FREE)
  const birthDate = new Date(user.birthdayDate);
  const birthTimeStr = user.birthTime || "12:00";
  const [hours, minutes] = birthTimeStr.split(":").map(Number);
  
  const pythonChart = await calculateNatalChartPython({
    year: birthDate.getFullYear(),
    month: birthDate.getMonth() + 1,
    day: birthDate.getDate(),
    hour: hours,
    minute: minutes,
    latitude: 55.7558,
    longitude: 37.6173,
  });
  
  const professionalInterpretation = await generateProfessionalInterpretation(pythonChart, user, locale);
  
  // Store interpretation by locale
  const interpretations = { [locale]: professionalInterpretation };
  
  const chart = await storage.createNatalChart({
    userId,
    data: natalData,
    professionalInterpretation: interpretations as any,
  });
  
  return chart;
}

/**
 * Генерирует профессиональную интерпретацию натальной карты с учетом домов, управителей и весов
 */
async function generateProfessionalInterpretation(
  pythonChart: NatalChartResult,
  user: User,
  locale: string = 'ru'
) {
  const birthDate = new Date(user.birthdayDate);
  const birthTimeStr = user.birthTime || "12:00";
  const [hours, minutes] = birthTimeStr.split(":").map(Number);
  
  // Convert planets from Record to Array with house info
  const planetsArray = Object.entries(pythonChart.planets).map(([name, data]) => {
    // Determine house based on longitude and house cusps
    const houseIndex = determineHouse(data.longitude, pythonChart.houses.cusps);
    return {
      name,
      lon_deg: data.longitude,
      house_index: houseIndex,
      speed_deg_per_day: 0 // Speed not available in current structure
    };
  });
  
  const professionalData: ProfessionalChartData = {
    profile: {
      name: user.name,
      gender: user.gender,
      birth_accuracy: user.birthTime ? "точное" : "неточное"
    },
    birth: {
      date_iso: birthDate.toISOString().split('T')[0],
      time_iso: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
      tz_offset_minutes: 180, // Moscow timezone offset (can be calculated from user.timezone)
      lat: 55.7558,
      lon: 37.6173
    },
    zodiac_type: "tropical",
    ayanamsha: "none",
    house_system: pythonChart.houses.system || "Placidus",
    angles: {
      ASC_deg: pythonChart.angles.Ascendant?.longitude || 0,
      MC_deg: pythonChart.angles.Midheaven?.longitude || 0,
      DSC_deg: (pythonChart.angles.Ascendant?.longitude || 0) + 180,
      IC_deg: (pythonChart.angles.Midheaven?.longitude || 0) + 180
    },
    house_cusps: pythonChart.houses.cusps,
    planets: planetsArray,
    aspects: [] // Aspects not in current structure, will be empty for now
  };
  
  return await getProfessionalInterpretation(professionalData, locale);
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
    
    // Generate professional interpretation for user's own chart (FREE)
    const pythonChart = await calculateNatalChartPython({
      year: new Date(user.birthdayDate).getFullYear(),
      month: new Date(user.birthdayDate).getMonth() + 1,
      day: new Date(user.birthdayDate).getDate(),
      hour: Number((user.birthTime || "12:00").split(":")[0]),
      minute: Number((user.birthTime || "12:00").split(":")[1]),
      latitude: 55.7558,
      longitude: 37.6173,
    });
    
    const professionalInterpretation = await generateProfessionalInterpretation(pythonChart, user, locale);
    
    // Store interpretations by locale
    const currentInterpretations = (chart.professionalInterpretation as any) || {};
    currentInterpretations[locale] = professionalInterpretation;
    
    await storage.updateNatalChart(userId, { 
      data: newData,
      professionalInterpretation: currentInterpretations as any
    });
  }
}
