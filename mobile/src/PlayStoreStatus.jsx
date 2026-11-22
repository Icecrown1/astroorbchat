import { useState } from 'react';
import { ORB_PACKS } from '../../shared/orbPacks';
import { playCatalog } from './playInternal';

const products = [
  ...ORB_PACKS.map(pack => [pack.id, pack.orbs + ' ★']),
  ['standard', 'Standard'], ['premium', 'Premium'],
];

export function PlayStoreStatus() {
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function check() {
    setBusy(true);
    setFound(null);
    setError('');
    try {
      const result = await playCatalog.query();
      setFound(result.products);
    } catch {
      setError('Google Play не ответил. Проверь подключение и аккаунт магазина.');
    } finally {
      setBusy(false);
    }
  }
  return <section className="preview-shop">
    <h3>Магазин Google Play</h3>
    <p>Внутренний тест каталога. Можно проверить доступность пакетов и подписок. Покупки через Google Play Billing пока закрыты.</p>
    <button type="button" disabled={busy} onClick={check}>{busy ? 'Запрашиваем товары…' : 'Проверить товары в Google Play'}</button>
    {error && <p role="alert">{error}</p>}
    {found && <dl aria-live="polite">{products.map(([id, name]) => <div key={id}>
      <dt>{name}</dt><dd>{found.includes(id) ? 'Доступно' : 'Недоступно'}</dd>
    </div>)}</dl>}
  </section>;
}
