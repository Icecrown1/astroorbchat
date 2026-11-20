import { useState } from 'react';
import { translatePlanet, translateSign, translateSignPrepositional } from '../../client/src/lib/astroTranslations';
import { onlineRequest } from './onlineApi';

const eventLabels = { new_moon: 'Новолуние', full_moon: 'Полнолуние', planet_transit: 'Переход планеты' };
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' });

function eventTitle(event) {
  if (event.type === 'planet_transit') {
    return [event.planet && translatePlanet(event.planet, 'ru'), event.to_sign && translateSign(event.to_sign, 'ru')]
      .filter(Boolean).join(' → ') || eventLabels.planet_transit;
  }
  const phase = eventLabels[event.type];
  return event.sign ? `${phase} в ${translateSignPrepositional(event.sign, 'ru')}` : phase;
}

export function ImportantDates({ account, openAccount, openNatal, guestId }) {
  const { token, busy, run } = account;
  const [events, setEvents] = useState(null);
  const [period, setPeriod] = useState(30);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [needsNatal, setNeedsNatal] = useState(false);

  function load(event) {
    event.preventDefault();
    run(async () => {
      setPending(true);
      setError('');
      setNeedsNatal(false);
      try {
        const params = new URLSearchParams({ days: String(period) });
        if (guestId) params.set('externalChartId', guestId);
        const items = await onlineRequest(`/api/astrology/important-dates?${params}`, { token });
        if (!Array.isArray(items)) throw new Error('Не удалось загрузить календарь.');
        setEvents(items.filter(item => Object.hasOwn(eventLabels, item.type) && Number.isFinite(Date.parse(item.date)))
          .sort((left, right) => Date.parse(left.date) - Date.parse(right.date)));
      } catch (failure) {
        if (failure.expired) throw failure;
        const missingChart = failure.code === 'Natal chart required. Please create your natal chart first.';
        setNeedsNatal(missingChart);
        setError(missingChart ? 'Сначала построй свою натальную карту.' : failure.message);
      } finally {
        setPending(false);
      }
    });
  }

  if (!token) return <section className="profile-card">
    <h1>Важные даты</h1>
    <p>Подключи профиль, чтобы открыть календарь по натальной карте.</p>
    <button type="button" onClick={openAccount}>Подключить профиль</button>
  </section>;

  const visibleEvents = events?.filter(event => filter === 'all' ||
    (filter === 'lunar' ? event.type !== 'planet_transit' : event.type === 'planet_transit'));

  return <section className="tarot-screen">
    {guestId ? <h2>Важные даты</h2> : <h1>Важные даты</h1>}
    <form className="online-spread" onSubmit={load}>
      <label htmlFor={guestId ? 'guest-dates-period' : 'dates-period'}>Период</label>
      <select id={guestId ? 'guest-dates-period' : 'dates-period'} value={period} disabled={busy} onChange={event => {
        setPeriod(Number(event.target.value));
        setEvents(null);
        setError('');
      }}>
        <option value="30">30 дней</option>
        <option value="60">60 дней</option>
      </select>
      <button type="submit" disabled={busy}>{pending ? 'Загружаем…' : 'Показать календарь'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {error && needsNatal && !guestId && <button type="button" className="secondary-button" onClick={openNatal}>Открыть натальную карту</button>}
    {events && <>
      <div className="planet-tabs" role="group" aria-label="События календаря">
        {Object.entries({ all: 'Все', lunar: 'Фазы Луны', transits: 'Переходы планет' }).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      {visibleEvents.length === 0 && <p>В этом периоде нет событий по выбранному фильтру.</p>}
      <ol className="dates-list">
        {visibleEvents.map((event, index) => (
          <li key={`${event.date}-${event.type}-${event.planet ?? ''}-${index}`}>
            <time aria-label={fullDateFormat.format(new Date(event.date))} dateTime={event.date}>
              {dayFormat.format(new Date(event.date))}
            </time>
            <div>
              <h3>{eventTitle(event)}</h3>
              <p>{[event.house_for_sun_sign && `${event.house_for_sun_sign}-й дом от Солнца`,
                event.importance === 'high' && 'Особенно важно'].filter(Boolean).join(' · ')}</p>
            </div>
          </li>
        ))}
      </ol>
    </>}
  </section>;
}
