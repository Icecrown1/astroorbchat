/**
 * Тактильный отклик Telegram WebApp — «дорогое» ощущение интерфейса.
 * Безопасен вне Telegram (все вызовы no-op при отсутствии API).
 */
type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

const hf = () => (window as any)?.Telegram?.WebApp?.HapticFeedback;

export const haptic = {
  /** Тап по интерактивному элементу (узел карты, карточка) */
  impact(style: Impact = 'light') {
    try { hf()?.impactOccurred(style); } catch { /* noop */ }
  },
  /** Успех/ошибка/предупреждение (покупка, генерация) */
  notify(type: 'success' | 'warning' | 'error') {
    try { hf()?.notificationOccurred(type); } catch { /* noop */ }
  },
  /** Смена выбора (фильтры, табы, свайпы) */
  select() {
    try { hf()?.selectionChanged(); } catch { /* noop */ }
  },
};
