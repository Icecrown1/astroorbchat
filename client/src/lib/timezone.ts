import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Get UTC offset for a timezone
 * @param tz - timezone name (e.g. "Europe/Moscow")
 * @returns UTC offset string (e.g. "UTC+3" or "UTC-5")
 */
export function getTimezoneOffset(tz: string): string {
  try {
    const offset = dayjs().tz(tz).utcOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    
    const sign = offset >= 0 ? '+' : '-';
    const formattedOffset = minutes > 0 
      ? `${hours}:${minutes.toString().padStart(2, '0')}` 
      : `${hours}`;
    
    return `UTC${sign}${formattedOffset}`;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * Format timezone with UTC offset
 * @param tz - timezone name
 * @returns formatted string (e.g. "Europe/Moscow (UTC+3)")
 */
export function formatTimezoneWithOffset(tz: string): string {
  const offset = getTimezoneOffset(tz);
  return `${tz} (${offset})`;
}
