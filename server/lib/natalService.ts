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
    await storage.updateNatalChart(userId, { data: newData });
  }
}
