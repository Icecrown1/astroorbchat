import { apiRequest } from './queryClient';

export interface ImportantEvent {
  key: string;
  date: string;
  kind: string;
  planet: string;
  sign?: string;
  natalTarget?: {
    planet: string;
    aspect?: string;
  };
  brief: string;
  unlocked: boolean;
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

export async function unlockImportantDate(eventKey: string): Promise<void> {
  await apiRequest('POST', '/api/astrology/important-dates/unlock', { eventKey });
}

export async function getImportantDateDetail(eventKey: string, locale: string = 'ru'): Promise<ImportantDateInterpretation> {
  const response = await apiRequest('POST', '/api/astrology/important-dates/detail', { eventKey, locale });
  return response.data;
}
