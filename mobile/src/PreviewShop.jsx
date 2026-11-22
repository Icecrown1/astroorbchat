import { useState } from 'react';
import { onlineRequest } from './onlineApi';
import { ORB_PACKS } from '../../shared/orbPacks';

export function PreviewShop({ account }) {
  const [item, setItem] = useState(null);
  const [receipt, setReceipt] = useState('');
  function select(name) {
    setItem(name);
    setReceipt('');
  }
  async function confirm() {
    if (account) {
      if (!account.profile) { setReceipt('Сначала откройте тестовый профиль'); setItem(null); return; }
      const pack = ORB_PACKS.find(p => item === `Пакет ${p.orbs} ★`);
      const id = pack?.id ?? item.split(' ')[0].toLowerCase();
      const profile = await onlineRequest('/api/mobile/demo-purchase', {data:{item:id}});
      account.mergeProfile(profile);
    }
    setReceipt(item);
    setItem(null);
  }
  return <section className="preview-shop">
    <h3>Покупки</h3><p>Демонстрация магазина. Деньги не списываются.</p>
    <div className="shop-options">{['Standard', 'Premium'].map(tier =>
      <button type="button" key={tier} onClick={() => select(tier + ' · 1 месяц')}>{tier} · 1 месяц</button>)}</div>
    <h4>Пополнить энергию звёздами</h4>
    <div className="shop-options">{ORB_PACKS.map(pack =>
      <button type="button" key={pack.id} onClick={() => select(`Пакет ${pack.orbs} ★`)}>{pack.orbs} ★</button>)}</div>
    {item && <section className="star-confirmation" aria-label="Подтверждение тестовой покупки">
      <h3>{item}</h3><p>В этой сборке покупка пробная.</p>
      <button type="button" onClick={confirm}>Подтвердить тестовую покупку</button>
      <button type="button" className="secondary-button" onClick={() => setItem(null)}>Отмена</button>
    </section>}
    {receipt && <p role="status">Тестовая покупка подтверждена · {receipt}.</p>}
  </section>;
}
