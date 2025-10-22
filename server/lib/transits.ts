import { spawn } from 'child_process';
import path from 'path';

export type EventKind = 
  | 'retrograde-start' 
  | 'retrograde-end' 
  | 'ingress' 
  | 'station-direct' 
  | 'station-retrograde' 
  | 'major-transit';

export type PlanetName = 
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' 
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface ImportantEvent {
  key: string;
  date: string;
  kind: EventKind;
  planet: PlanetName;
  sign?: string;
  natalTarget?: {
    planet: string;
    aspect?: AspectType;
  };
  brief: string;
}

export interface NatalPlanetData {
  name: string;
  longitude: number;
}

export interface TransitOptions {
  from: Date;
  to: Date;
  limit?: number;
}

/**
 * Находит важные астрологические события (транзиты) для пользователя
 * 
 * @param natalPlanets Планеты из натальной карты пользователя
 * @param options Опции поиска (даты, лимит)
 * @returns Список важных событий
 */
export async function findImportantEvents(
  natalPlanets: NatalPlanetData[], 
  options: TransitOptions
): Promise<ImportantEvent[]> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'transit_events_api.py');
    
    // Формируем входные данные для Python скрипта
    const inputData = {
      natal_planets: natalPlanets,
      from_date: options.from.toISOString().split('T')[0], // YYYY-MM-DD
      to_date: options.to.toISOString().split('T')[0],
      limit: options.limit || 10
    };
    
    // Запускаем Python-скрипт
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    // Собираем данные из stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Собираем ошибки из stderr
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Обработка завершения процесса
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.ok) {
            resolve(result.events);
          } else {
            reject(new Error(`Transit calculation failed: ${result.error}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Python output: ${err}`));
        }
      } else {
        try {
          const errorObj = JSON.parse(stderr);
          reject(new Error(`Python error: ${errorObj.error || stderr}`));
        } catch {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      }
    });
    
    // Обработка ошибок запуска
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    
    // Отправляем входные данные в stdin
    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
  });
}

/**
 * Извлекает данные планет из натальной карты для расчёта транзитов
 * 
 * @param natalChartData Данные натальной карты (поле data из таблицы natalCharts)
 * @returns Массив планет с долготами
 */
export function extractNatalPlanets(natalChartData: any): NatalPlanetData[] {
  const planets: NatalPlanetData[] = [];
  
  // Поддержка обоих форматов: объект и массив
  const planetsData = natalChartData.planets;
  
  if (Array.isArray(planetsData)) {
    // Формат массива: [{name, longitude, ...}, ...]
    for (const planet of planetsData) {
      if (planet.name && planet.longitude !== undefined) {
        planets.push({
          name: planet.name,
          longitude: planet.longitude
        });
      }
    }
  } else if (typeof planetsData === 'object') {
    // Формат объекта: {Sun: {longitude, ...}, Moon: {...}, ...}
    for (const [name, data] of Object.entries(planetsData)) {
      if (data && typeof data === 'object' && 'longitude' in data) {
        planets.push({
          name,
          longitude: (data as any).longitude
        });
      }
    }
  }
  
  return planets;
}

/**
 * Новый интерфейс для важных дат с лунными фазами и транзитами
 */
export interface ImportantDateEvent {
  type: 'new_moon' | 'full_moon' | 'planet_transit';
  date: string;
  sign: string;
  degree?: number;
  planet?: string;  // Для транзитов планет
  from_sign?: string;  // Для транзитов: из какого знака
  to_sign?: string;  // Для транзитов: в какой знак
  house_for_sun_sign?: number;  // Дом для солнечного знака пользователя
  importance?: 'high';  // Особо важное событие
  importance_reason?: 'in_sun_sign' | 'in_ascendant';  // Причина важности
}

export interface ImportantDatesResult {
  events: ImportantDateEvent[];
  period: {
    start: string;
    end: string;
    days: number;
  };
  personalization?: {
    sun_sign?: string;
    ascendant_sign?: string;
  };
}

/**
 * Получает важные астрологические даты: лунные фазы и транзиты планет
 * 
 * @param options Опции поиска
 * @param sun_sign Солнечный знак пользователя (опционально)
 * @param ascendant_sign Асцендент пользователя (опционально)
 * @returns Список событий с лунными фазами и транзитами
 */
export async function getImportantDatesWithLunarPhases(
  options: {
    start_date?: string;  // ISO format YYYY-MM-DD
    days_forward?: number;  // Default 60
  },
  sun_sign?: string,
  ascendant_sign?: string
): Promise<ImportantDatesResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'important_dates_api.py');
    
    // Формируем входные данные для Python скрипта
    const inputData = {
      start_date: options.start_date,
      days_forward: options.days_forward || 60,
      sun_sign,
      ascendant_sign
    };
    
    // Запускаем Python-скрипт
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    // Собираем данные из stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Собираем ошибки из stderr
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Обработка завершения процесса
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(`Important dates calculation failed: ${result.error}`));
          } else {
            resolve(result as ImportantDatesResult);
          }
        } catch (err) {
          reject(new Error(`Failed to parse Python output: ${err}`));
        }
      } else {
        console.error('[Important Dates] Python stderr:', stderr);
        try {
          const errorObj = JSON.parse(stdout);
          reject(new Error(`Python error: ${errorObj.error || stderr}`));
        } catch {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      }
    });
    
    // Обработка ошибок запуска
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    
    // Отправляем входные данные в stdin
    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
  });
}
