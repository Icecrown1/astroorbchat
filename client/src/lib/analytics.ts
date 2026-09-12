// Аналитика без ручной разметки: страницы + клики по всем элементам с data-testid.
// Тихая: любые сбои глотаются, приложение не тормозит (fire-and-forget).
import { apiRequest } from '@/lib/queryClient';

let lastPage = '';
let installed = false;

function send(name: 'page' | 'click', value: string) {
  try { apiRequest('POST', '/api/track', { name, value }).catch(() => {}); } catch { /* noop */ }
}

export function trackPage(path: string) {
  if (!path || path === lastPage) return;
  lastPage = path;
  send('page', path);
}

/** Глобальный слушатель кликов: элементы (и родители) с data-testid */
export function installClickTracking() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', (e) => {
    try {
      let el = e.target as HTMLElement | null;
      for (let i = 0; el && i < 5; i++, el = el.parentElement) {
        const id = el.getAttribute?.('data-testid');
        if (id) { send('click', id); return; }
      }
    } catch { /* noop */ }
  }, { capture: true, passive: true });
}
