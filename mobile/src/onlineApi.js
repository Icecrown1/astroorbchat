import { Capacitor, CapacitorHttp } from '@capacitor/core';

const sandbox = import.meta.env.MODE === 'android-sandbox';
const configuredOrigin = import.meta.env.VITE_ASTROORBI_API_URL;
const apiOrigin = new URL(sandbox ? configuredOrigin : (configuredOrigin || 'https://astroorbiapp.com'));
if (sandbox && ['astroorbiapp.com', 'astro-orb-chat.replit.app', 'astroorbi.com'].includes(apiOrigin.hostname)) {
  throw new Error('Android sandbox must use its own API.');
}
if (apiOrigin.protocol !== 'https:' || apiOrigin.username || apiOrigin.password) {
  throw new Error('AstroOrbi API must use HTTPS.');
}

const messages = {
  NATAL_INCOMPLETE: 'Добавь точное время и место рождения в профиле.',
  SUBSCRIPTION_REQUIRED: 'Для этого раздела нужна подписка.',
  INSUFFICIENT_ORBS: 'На балансе недостаточно звёзд.',
  'Premium subscription required for Solar Return': 'Для нового соляра нужен Premium.',
  'Subscription required': 'Для этого раздела нужна подписка.',
  'Необходима подписка': 'Для этого раздела нужна подписка.',
  'Недостаточно звёзд': 'На балансе недостаточно звёзд.',
  'Insufficient stars': 'На балансе недостаточно звёзд.',
  NATAL_NOT_INITIALIZED: 'Натальная карта ещё не построена.',
  subscription_required: 'Для этого расклада нужна подписка.',
  premium_required: 'Этот расклад доступен по тарифу Premium.',
  insufficient_orbs: 'Для расклада не хватает звёзд.',
  question_required: 'Добавь вопрос к раскладу.',
  invalid_code: sandbox ? 'Код истёк или уже использован. Запроси новый тестовый код.' : 'Код истёк или уже использован. Получи новый в Telegram.',
  mobile_login_unavailable: 'Вход сейчас недоступен. Попробуй позже.',
};

export async function onlineRequest(path, { token, data, envelope = false, method = data ? 'POST' : 'GET' } = {}) {
  const url = new URL(path, apiOrigin.origin).href;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (data) headers['Content-Type'] = 'application/json';

  let response;
  let body;
  try {
    if (Capacitor.isNativePlatform()) {
      response = await CapacitorHttp.request({
        url, method, headers, data,
        connectTimeout: 10_000, readTimeout: 90_000, disableRedirects: true,
      });
      body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } else {
      response = await fetch(url, {
        method, headers, body: data ? JSON.stringify(data) : undefined,
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(90_000),
      });
      body = await response.json();
    }
  } catch {
    throw Object.assign(new Error('Связь с сервером прервалась. Проверь интернет и попробуй снова.'), { uncertain: true });
  }

  if (response.status === 401) {
    throw Object.assign(new Error('Сессия закончилась. Получи новый код входа.'), { expired: true });
  }
  if (response.status >= 200 && response.status < 300 && body?.ok) return envelope ? body : body.data;
  throw Object.assign(new Error(messages[body?.error] || 'Сервер не смог выполнить запрос. Попробуй позже.'), { uncertain: response.status >= 500, code: body?.error, daysRemaining: body?.daysRemaining });
}
