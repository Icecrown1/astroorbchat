import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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

/**
 * Вызывает Python-скрипт для расчёта натальной карты через Swiss Ephemeris
 * 
 * @param birthData Данные о рождении
 * @returns Рассчитанная натальная карта
 */
export async function calculateNatalChartPython(birthData: BirthData): Promise<NatalChartResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'natal_chart_api.py');
    
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
