import { useEffect, useRef, useState } from 'react';
import { playCatalog } from './playInternal';
import { onlineRequest } from './onlineApi';

const shopPath = '/api/mobile/shop';
const messages = {
  mobile_login_needed: 'Для покупки выйди из профиля и войди ещё раз по коду из Telegram.',
  shop_unavailable: 'Магазин пока недоступен. Попробуй обновить статус позже.',
  invalid_order: 'Проверь тариф и адрес для чека.',
  price_changed: 'Цена изменилась. Обнови статус и подтверди новую сумму.',
  existing_order: 'У тебя уже есть незавершённая оплата. Обнови статус, чтобы её открыть.',
  active_subscription: 'На этом аккаунте уже есть подписка. Обнови статус.',
  order_review: 'Обратись в поддержку AstroOrbi по поводу этого заказа.',
};

function plan(tier) { return tier === 'premium' ? 'Premium' : 'Standard'; }

export function MobileCardShop({ account }) {
  const { token, profile, mergeProfile } = account;
  const [shop, setShop] = useState(null);
  const [order, setOrder] = useState(null);
  const [tier, setTier] = useState('standard');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [region, setRegion] = useState(false);
  const active = useRef(false);
  const locked = useRef(false);
  const syncOnReturn = useRef(false);

  function report(error) {
    if (active.current) setMessage(messages[error.code] || error.message || 'Не удалось проверить покупку.');
  }

  async function check() {
    if (!token || !profile?.id || locked.current) return;
    locked.current = true;
    if (active.current) { setMessage(''); setBusy(true); }
    try {
      const [info, location] = await Promise.all([
        onlineRequest(shopPath, { token }),
        playCatalog.region().catch(() => ({ russianStore: false })),
      ]);
      let last = info.order;
      if (last?.status === 'pending') last = await onlineRequest(shopPath + '/orders/' + last.id, { token });
      if (!active.current) return;
      setShop(last?.status === 'completed' && info.order?.status === 'pending' ? { ...info, active: true } : info);
      setRegion(location.russianStore);
      setOrder(last);
      if (last?.status === 'completed') {
        const updated = await onlineRequest('/api/user/me', { token });
        if (active.current && updated.id === profile.id) mergeProfile(updated);
      }
    } catch (error) { report(error); }
    finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }

  useEffect(() => {
    active.current = true;
    check();
    function returned() {
      if (document.hidden) { syncOnReturn.current = true; return; }
      if (syncOnReturn.current) { syncOnReturn.current = false; check(); }
    }
    document.addEventListener('visibilitychange', returned);
    return () => { active.current = false; document.removeEventListener('visibilitychange', returned); };
  }, [token, profile?.id]);

  async function pay(event) {
    event.preventDefault();
    if (locked.current || !shop?.available || !region) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (!(await playCatalog.region()).russianStore) {
        setRegion(false);
        return;
      }
      let current = order;
      if (current?.status === 'pending' && !current.needsEmail) {
        current = await onlineRequest(shopPath + '/orders/' + current.id, { token });
      } else {
        current = await onlineRequest(shopPath + '/orders', { token, data: {
          tier: current?.status === 'pending' ? current.tier : tier,
          amount: current?.status === 'pending' ? current.amount : shop.prices[tier], email,
        } });
      }
      if (!active.current) return;
      setOrder(current);
      if (current.checkout) {
        syncOnReturn.current = true;
        try { await playCatalog.openCheckout({ url: current.checkout }); }
        catch { throw Error('Не удалось открыть страницу оплаты. Проверь доступность браузера и попробуй ещё раз.'); }
      } else {
        setMessage('Обнови статус покупки.');
      }
    } catch (error) { report(error); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }

  if (!token || !profile?.id) return null;
  const pending = order?.status === 'pending';
  const review = ['needs_review', 'refund_review'].includes(order?.status);
  const canPay = region && shop?.available && !shop.active && !review &&
    (pending || shop.prices);
  return <section className="preview-shop">
    <h3>Подписка на месяц</h3>
    {order && <p>Номер заказа: {order.id}</p>}
    {order?.status === 'refund_review' && <p>ЮKassa подтвердила возврат. Поддержка сверит тариф и остаток звёзд по номеру заказа.</p>}
    {order?.status === 'completed' && <p>Последняя покупка · {plan(order.tier)}, {order.amount} ₽. Платёж подтверждён.</p>}
    {order?.status === 'canceled' && <p>Последняя оплата отменена.</p>}
    {order?.status === 'needs_review' && <p>Платёж получен. Пока шла оплата, на аккаунте появилась другая подписка. Напиши в поддержку AstroOrbi и укажи номер заказа {order.id}.</p>}
    {pending && <p>Ожидаем подтверждение · {plan(order.tier)}, {order.amount} ₽.</p>}
    {shop?.active && <p>У тебя уже есть действующая подписка.</p>}
    {shop && !shop.active && !canPay && !pending && order?.status !== 'needs_review' && <p>Покупка пока недоступна для этого аккаунта.</p>}
    {canPay && <form onSubmit={pay}>
      {!pending && <label>Тариф<select value={tier} onChange={event => setTier(event.target.value)}>
        {Object.entries(shop.prices).map(([id, value]) => <option key={id} value={id}>{plan(id)} · {value} ₽</option>)}
      </select></label>}
      {(!pending || order.needsEmail) && <label>Электронная почта для чека<input type="email" autoComplete="email"
        maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} /></label>}
      <p>Разовая оплата российской картой. Без автопродления.</p>
      <button className="primary" disabled={busy}>{pending ? 'Продолжить оплату' : 'Оплатить ' + shop.prices[tier] + ' ₽'}</button>
    </form>}
    {message && <p role="alert">{message}</p>}
    <button type="button" disabled={busy} onClick={check}>{busy ? 'Проверяем…' : 'Обновить статус'}</button>
  </section>;
}
