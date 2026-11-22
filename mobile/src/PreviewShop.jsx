import { useState } from 'react';
import { ORB_PACKS } from '../../shared/orbPacks';

export function PreviewShop() {
  const [item, setItem] = useState(null);
  const [receipt, setReceipt] = useState('');
  function select(name) {
    setItem(name);
    setReceipt('');
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
      <button type="button" onClick={() => { setReceipt(item); setItem(null); }}>Подтвердить тестовую покупку</button>
      <button type="button" className="secondary-button" onClick={() => setItem(null)}>Отмена</button>
    </section>}
    {receipt && <p role="status">Тестовая покупка подтверждена · {receipt}.</p>}
  </section>;
}
