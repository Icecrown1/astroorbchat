import crypto from 'crypto';

export function validateTelegramInitData(initData: string): boolean {
  if (!initData) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    if (!hash) return false;

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return false;

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  } catch (error) {
    console.error('Telegram validation error:', error);
    return false;
  }
}

export function parseTelegramInitData(initData: string): any {
  const params = new URLSearchParams(initData);
  const userParam = params.get('user');
  
  if (!userParam) return null;

  try {
    return JSON.parse(userParam);
  } catch {
    return null;
  }
}
