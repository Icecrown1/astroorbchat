import { createContext, useContext, useState } from 'react';

export const PreviewRewards = createContext(null);

export function RewardUnlock({ id, title, total = 1, makeReward, earnedOnly, children }) {
  const preview = useContext(PreviewRewards);
  if (!preview) return null;
  const storageKey = `astroorbi.reward.v1:${preview.owner}:${id}`;
  return <Unlock key={storageKey} {...{ storageKey, title, total, makeReward, earnedOnly, children }} watch={preview.watch} />;
}

function Unlock({ storageKey, title, total, makeReward, earnedOnly, children, watch }) {
  const [saved, setSaved] = useState(() => {
    try {
      const item = JSON.parse(localStorage.getItem(storageKey));
      if (Number.isInteger(item?.count) && item.count >= 0 && item.count <= total) return item;
    } catch { /* Storage may be unavailable in a WebView. */ }
    return { count: 0 };
  });
  const remaining = total - saved.count;
  if (!remaining) return children(saved.value);
  if (earnedOnly) return null;

  function credit() {
    const next = { count: saved.count + 1 };
    if (next.count === total && makeReward) next.value = makeReward();
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Still usable in this session. */ }
    setSaved(next);
  }
  return <button className="reward-unlock" type="button" aria-label={`${title}. Осталось просмотров: ${remaining}`}
    onClick={() => watch(title, remaining - 1, credit)}>
    <span>{title}</span><span className="reward-count" aria-hidden="true">
      <svg viewBox="0 0 24 20" focusable="false"><rect x="1" y="2" width="22" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m10 6 6 4-6 4z" fill="currentColor"/></svg>
      {remaining}
    </span>
  </button>;
}
