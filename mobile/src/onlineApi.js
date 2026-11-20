import { Capacitor, CapacitorHttp } from '@capacitor/core';

const apiOrigin = new URL(import.meta.env.VITE_ASTROORBI_API_URL || 'https://astroorbiapp.com');
if (apiOrigin.protocol !== 'https:' || apiOrigin.username || apiOrigin.password) {
  throw new Error('AstroOrbi API must use HTTPS.');
}

const messages = {
  invalid_code: 'Код истёк или уже использован. Получи новый в Telegram.',
  mobile_login_unavailable: 'Вход сейчас недоступен. Попробуй позже.',
};

export async function onlineRequest(path, { token, data } = {}) {
  const url = new URL(path, apiOrigin.origin).href;
  const method = data ? 'POST' : 'GET';
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
    throw new Error('Сервер недоступен. Проверь интернет и попробуй снова.');
  }

  if (response.status === 401) {
    throw Object.assign(new Error('Сессия закончилась. Получи новый код входа.'), { expired: true });
  }
  if (response.status >= 200 && response.status < 300 && body?.ok) return body.data;
  throw new Error(messages[body?.error] || 'Сервер не смог выполнить запрос. Попробуй позже.');
}
