// Текстовый шаринг с реф-воронкой: нативная карточка Telegram (текст + кнопка
// «Попробовать бесплатно» с реф-ссылкой) либо копирование в буфер с ссылкой в конце.
import { apiRequest } from '@/lib/queryClient';

const BOT_USERNAME = 'AstroOrbI_Bot';

export function refLink(referralCode?: string | null): string {
  return referralCode
    ? `https://t.me/${BOT_USERNAME}?startapp=${referralCode}`
    : `https://t.me/${BOT_USERNAME}`;
}

/** Подвал воронки для копируемого текста */
export function funnelFooter(locale: string, referralCode?: string | null): string {
  const link = refLink(referralCode);
  return locale === 'ru'
    ? `━━━━━━━━━━━━\n✨ Сделано в AstroOrbi — натальная карта бесплатно:\n${link}`
    : `━━━━━━━━━━━━\n✨ Made in AstroOrbi — free birth chart:\n${link}`;
}

/**
 * Нативный шэр текста; фолбэк — буфер обмена (текст уже содержит воронку).
 * Возвращает 'shared' | 'copied' | 'failed'.
 */
export async function shareOrCopyText(text: string, locale: string): Promise<'shared' | 'copied' | 'failed'> {
  const wa = (window as any).Telegram?.WebApp;
  try {
    const resp = await apiRequest('POST', '/api/share/text', { text, locale });
    if (resp.ok && resp.data?.preparedMessageId && wa?.shareMessage) {
      wa.shareMessage(resp.data.preparedMessageId);
      return 'shared';
    }
  } catch { /* фолбэк ниже */ }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch { return 'failed'; }
}
