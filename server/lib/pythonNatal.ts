import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BirthData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  latitude: number;
  longitude: number;
  house_system?: string;
}

export interface NatalChartResult {
  planets: Record<string, {
    longitude: number;
    latitude: number;
    sign: string;
    degree_in_sign: number;
  }>;
  houses: {
    system: string;
    cusps: number[];
  };
  angles: Record<string, {
    longitude: number;
    sign: string;
    degree_in_sign: number;
  }>;
  julian_day: number;
}

export interface SolarReturnTimeInput {
  natal_sun_longitude: number;
  birth_month: number;
  birth_day: number;
  target_year: number;
}

export interface SolarReturnTimeResult {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TransitData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TransitsResult {
  planets: Record<string, {
    longitude: number;
    latitude: number;
    sign: string;
    degree_in_sign: number;
  }>;
  date: string;
  time: string;
}

/**
 * Находит точное время Solar Return - момент возвращения Солнца в натальную позицию
 */
export async function calculateSolarReturnTime(input: SolarReturnTimeInput): Promise<SolarReturnTimeResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'natal_chart_api.py');
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
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
    
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    
    // Отправляем входные данные с типом запроса 'solar_return_time'
    const requestData = {
      type: 'solar_return_time',
      ...input
    };
    pythonProcess.stdin.write(JSON.stringify(requestData));
    pythonProcess.stdin.end();
  });
}

/**
 * Рассчитывает транзиты (позиции планет на указанную дату)
 */
export async function calculateTransits(transitData: TransitData): Promise<TransitsResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'natal_chart_api.py');
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
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
    
    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    
    // Отправляем входные данные с типом запроса 'transits'
    const requestData = {
      type: 'transits',
      ...transitData
    };
    pythonProcess.stdin.write(JSON.stringify(requestData));
    pythonProcess.stdin.end();
  });
}

/**
 * Определяет в какой натальный дом попадает транзитная планета
 * Используется для персонализированного гороскопа
 */
export function getTransitHousePosition(
  transitLongitude: number,
  natalHouseCusps: number[]
): number {
  // Нормализуем долготу в диапазон 0-360
  const normalizedLongitude = ((transitLongitude % 360) + 360) % 360;
  
  // Находим дом, в который попадает планета
  for (let i = 0; i < 12; i++) {
    const currentCusp = natalHouseCusps[i];
    const nextCusp = natalHouseCusps[(i + 1) % 12];
    
    // Обработка случая, когда дом пересекает 0° Овна
    if (currentCusp > nextCusp) {
      if (normalizedLongitude >= currentCusp || normalizedLongitude < nextCusp) {
        return i + 1; // Дома нумеруются с 1
      }
    } else {
      if (normalizedLongitude >= currentCusp && normalizedLongitude < nextCusp) {
        return i + 1;
      }
    }
  }
  
  // Если не нашли (не должно происходить), возвращаем 1-й дом
  return 1;
}

/**
 * Сопоставляет транзиты с натальной картой
 * Определяет в какие натальные дома попадают транзитные планеты
 */
export function mapTransitsToNatalHouses(
  transits: TransitsResult,
  natalChart: NatalChartResult
): Record<string, { sign: string; natalHouse: number; longitude: number }> {
  const result: Record<string, { sign: string; natalHouse: number; longitude: number }> = {};
  
  for (const [planetName, planetData] of Object.entries(transits.planets)) {
    const natalHouse = getTransitHousePosition(
      planetData.longitude,
      natalChart.houses.cusps
    );
    
    result[planetName] = {
      sign: planetData.sign,
      natalHouse,
      longitude: planetData.longitude
    };
  }
  
  return result;
}

/**
 * Вызывает Python-скрипт для расчёта натальной карты через Swiss Ephemeris
 * 
 * @param birthData Данные о рождении
 * @returns Рассчитанная натальная карта
 */
export async function calculateNatalChartPython(birthData: BirthData): Promise<NatalChartResult> {
  return new Promise((resolve, reject) => {
    // Всегда используем путь относительно корня проекта
    const scriptPath = path.join(process.cwd(), 'server', 'natal_chart_api.py');
    
    console.log('Python script path:', scriptPath);
    console.log('Script exists:', fs.existsSync(scriptPath));
    console.log('Current working directory:', process.cwd());
    
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
          resolve(result);
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
    pythonProcess.stdin.write(JSON.stringify(birthData));
    pythonProcess.stdin.end();
  });
}
