import { Frontispiece } from './Editorial';
import { useState } from 'react';
import { CityField } from './ProfileSettings';
import { NatalWheel } from './Natal';
import { ImportantDates } from './ImportantDates';
import { onlineRequest } from './onlineApi';
import { playInternal } from './playInternal';

const price = 20;

function sameChart(chart, fields) {
  return chart.name?.trim().toLowerCase() === fields.name.toLowerCase() &&
    chart.birthdayDate?.slice(0, 10) === fields.birthdayDate && (chart.birthTime || null) === fields.birthTime &&
    chart.birthPlace?.trim().toLowerCase() === fields.birthPlace.toLowerCase() && chart.gender === fields.gender;
}

export function GuestNatal({ account, openAccount }) {
  const { token, profile, busy, run, refreshProfile } = account;
  const [charts, setCharts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(null);
  const [showDates, setShowDates] = useState(false);
  const [city, setCity] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const needsSubscription = (profile?.tier ?? profile?.billingTier) === 'free';

  function act(action) {
    run(async () => {
      setError('');
      try {
        await action();
      } catch (failure) {
        if (failure.expired) throw failure;
        setError(failure.message);
      }
    });
  }

  async function getCharts() {
    const rows = await onlineRequest('/api/natal/external', { token });
    if (!Array.isArray(rows)) throw new Error('Не удалось загрузить список карт.');
    setCharts(rows);
    return rows;
  }

  function open(chart) {
    if (!chart?.id || !chart.data) throw new Error('Не удалось открыть натальную карту.');
    setShowDates(false);
    setConfirmRemoval(false);
    setSelected(chart);
  }

  function refresh() {
    act(async () => {
      const saved = await getCharts();
      if (!unknown) return;
      await refreshProfile(token);
      const matching = saved.find(chart => sameChart(chart, unknown));
      setUnknown(null);
      if (matching) open(matching);
      else throw new Error('Карта пока не появилась в списке. Проверь баланс перед повторным расчётом.');
    });
  }

  function create(event) {
    event.preventDefault();
    if (busy || unknown || needsSubscription) return;
    const form = new FormData(event.currentTarget);
    const birthdayDate = form.get('birthdayDate');
    const birthday = new Date(birthdayDate);
    const name = form.get('name').trim();
    const birthPlace = city.trim();
    if (!name || !birthPlace || !Number.isFinite(birthday.getTime()) ||
        birthday.toISOString().slice(0, 10) !== birthdayDate || birthdayDate > new Date().toLocaleDateString('sv-SE')) {
      setError('Проверь имя, дату и город рождения.');
      return;
    }
    const data = { name, birthPlace, birthdayDate, birthTime: form.get('birthTime') || null, gender: form.get('gender'), locale: 'ru' };

    act(async () => {
      const existing = (await getCharts()).find(chart => sameChart(chart, data));
      if (existing) {
        open(existing);
        return;
      }
      const user = await refreshProfile(token);
      if (!['standard', 'premium'].includes(user.tier ?? user.billingTier)) throw new Error('Для новой карты нужна подписка.');
      if (!Number.isFinite(Number(user.orbs)) || Number(user.orbs) < price) throw new Error('На балансе недостаточно звёзд.');
      let chart;
      try {
        chart = await onlineRequest('/api/natal/external', { token, data });
        if (!chart?.id || !chart.data) throw Object.assign(new Error(), { uncertain: true });
      } catch (failure) {
        if (!failure.uncertain) throw failure;
        setUnknown(data);
        throw new Error('Ответ не получен. Проверь сохранённые карты и баланс перед повтором.');
      }
      setCharts(rows => [chart, ...rows.filter(row => row.id !== chart.id)]);
      open(chart);
      setCity('');
      await refreshProfile(token);
    });
  }

  function remove() {
    act(async () => {
      try {
        await onlineRequest(`/api/natal/external/${encodeURIComponent(selected.id)}`, {
          token, method: 'DELETE', envelope: true,
        });
        setCharts(rows => rows.filter(row => row.id !== selected.id));
      } catch (failure) {
        if (!failure.uncertain) throw failure;
        const latest = await getCharts();
        if (latest.some(chart => chart.id === selected.id)) {
          throw new Error('Удаление не подтвердилось. Карта всё ещё в списке.');
        }
      }
      setSelected(null);
      setConfirmRemoval(false);
    });
  }

  return <section className="tarot-screen">
    <Frontispiece title="Карты близких" art="couple" scene />
    {!token ? <div className="profile-card">
      <p>{playInternal ? 'Войди в тестовый профиль, чтобы открыть сохранённые карты.' : 'Подключи профиль, чтобы открыть карты из общего аккаунта.'}</p>
      <button type="button" onClick={openAccount}>Подключить профиль</button>
    </div> : selected ? <>
      <button type="button" className="secondary-button" onClick={() => setSelected(null)} disabled={busy}>К списку карт</button>
      <div className="profile-card">
        <h2>{selected.name}</h2>
        <p>{[selected.birthdayDate?.slice(0, 10).split('-').reverse().join('.'), selected.birthTime, selected.birthPlace].filter(Boolean).join(' · ')}</p>
        {!selected.birthTime && <p>Без времени рождения карта рассчитана на 12:00.</p>}
      </div>
      <NatalWheel key={selected.id} chart={selected} guest />
      <button type="button" className="secondary-button" aria-expanded={showDates} onClick={() => setShowDates(value => !value)}>
        {showDates ? 'Скрыть календарь' : 'Важные даты для этой карты'}
      </button>
      {showDates && <ImportantDates key={selected.id} account={account} guestId={selected.id} />}
      {confirmRemoval ? <div className="profile-card">
        <p>{playInternal ? 'Удалить эту карту из тестового профиля Android?' : 'Удалить карту из общего аккаунта, в том числе из Telegram?'}</p>
        <button type="button" onClick={remove} disabled={busy}>Удалить карту</button>
        <button type="button" className="secondary-button" onClick={() => setConfirmRemoval(false)} disabled={busy}>Отмена</button>
      </div> : <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Удалить из сохранённых</button>}
    </> : <>
      {charts?.map(chart => (
        <button type="button" className="secondary-button guest-card-link" key={chart.id} disabled={busy || Boolean(unknown)}
          onClick={() => act(async () => open(await onlineRequest(`/api/natal/external/${encodeURIComponent(chart.id)}`, { token })))}>
          {chart.name}
        </button>
      ))}
      {charts?.length === 0 && <p className="empty-panel">Сохранённых карт пока нет.</p>}
      <button type="button" className="secondary-button" disabled={busy} onClick={refresh}>
        {unknown ? 'Проверить карты и баланс' : charts ? 'Обновить список' : 'Загрузить карты'}
      </button>
      {charts && !needsSubscription && <form className="online-spread" onSubmit={create}>
        <h2>Новая карта</h2>
        <label htmlFor="guest-natal-name">Имя</label>
        <input id="guest-natal-name" name="name" required maxLength={120} disabled={busy || Boolean(unknown)} />
        <label htmlFor="guest-natal-gender">Пол</label>
        <select id="guest-natal-gender" name="gender" defaultValue="other" disabled={busy || Boolean(unknown)}>
          <option value="other">Другое</option><option value="female">Женский</option><option value="male">Мужской</option>
        </select>
        <label htmlFor="guest-natal-birthday">Дата рождения</label>
        <input id="guest-natal-birthday" type="date" name="birthdayDate" max={new Date().toLocaleDateString('sv-SE')} required disabled={busy || Boolean(unknown)} />
        <label htmlFor="guest-natal-time">Время рождения</label>
        <input id="guest-natal-time" type="time" name="birthTime" disabled={busy || Boolean(unknown)} />
        <CityField id="guest-natal-city" required value={city} change={setCity} disabled={busy || Boolean(unknown)} />
        <button type="submit" disabled={busy || Boolean(unknown)}>{busy ? 'Подождите…' : `Построить карту · ${price} ★`}</button>
      </form>}
      {charts && needsSubscription && <p>Новые карты доступны с подпиской. Сохранённые можно открывать бесплатно.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
