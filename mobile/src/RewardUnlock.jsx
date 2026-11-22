import { createContext, useContext, useRef, useState } from 'react';

export const PreviewRewards = createContext(null);

function loadMessage(code) {
  const messages = {
    GMA_LOAD_2: 'Ошибка сети при загрузке рекламы.',
    GMA_LOAD_3: 'У Google сейчас нет тестового ролика для показа.',
    AD_TIMEOUT: 'Ролик не успел загрузиться за 15 секунд.',
    AD_BUSY: 'Другой запрос рекламы ещё выполняется.',
    AD_INACTIVE: 'Для показа вернись к раскладу.',
    UNIMPLEMENTED: 'Показ роликов доступен в приложении Android.',
  };
  const label = messages[code] || 'Не удалось открыть тестовый ролик.';
  const diagnostic = /^GMA_(LOAD|SHOW)_\d+$/.test(code) ? ' Код ' + code + '.' : '';
  return label + diagnostic + ' Можно повторить.';
}

export function RewardUnlock({ id, title, total = 1, makeReward, earnedOnly, children }) {
  const preview = useContext(PreviewRewards);
  if (!preview) return null;
  const storageKey = `astroorbi.reward.v1:${preview.owner}:${id}`;
  return <Unlock key={storageKey} {...{ storageKey, title, total, makeReward, earnedOnly, children }} watch={preview.watch} adFree={preview.adFree} />;
}

function Unlock({ storageKey, title, total, makeReward, earnedOnly, children, watch, adFree }) {
  const [saved, setSaved] = useState(() => {
    try {
      const item = JSON.parse(localStorage.getItem(storageKey));
      if (Number.isInteger(item?.count) && item.count >= 0 && item.count <= total) return item;
    } catch { /* Storage may be unavailable in a WebView. */ }
    return { count: 0 };
  });
  const remaining = total - saved.count;
  const credited = useRef(saved.count);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!remaining) return children(saved.value);
  if (earnedOnly) return null;

  function credit() {
    if (credited.current !== saved.count) return;
    const next = { count: adFree ? total : saved.count + 1 };
    if (next.count === total && makeReward) next.value = makeReward();
    credited.current = next.count;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Still usable in this session. */ }
    setSaved(next);
  }
  if (adFree) return <button className="reward-unlock" type="button" onClick={credit}>{title} · открыть без рекламы</button>;
  async function request(event) {
    const button = event.currentTarget;
    setError('');
    setLoading(true);
    try { await watch(title, remaining - 1, credit, button); }
    catch (failure) { setError(loadMessage(failure?.code)); }
    finally { setLoading(false); }
  }
  return <><button className="reward-unlock" type="button" disabled={loading} aria-busy={loading}
    aria-label={loading ? 'Загружаем тестовый ролик' : `${title}. Осталось просмотров: ${remaining}`} onClick={request}>
    <span>{loading ? 'Загружаем тестовый ролик…' : title}</span><span className="reward-count" aria-hidden="true">
      <svg viewBox="0 0 24 20" focusable="false"><rect x="1" y="2" width="22" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m10 6 6 4-6 4z" fill="currentColor"/></svg>
      {remaining}
    </span>
  </button>{error && <p role="status">{error}</p>}</>;
}
