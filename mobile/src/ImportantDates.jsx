import { Frontispiece } from './Editorial';
import { useEffect, useRef, useState } from 'react';
import { translatePlanet, translateSign, translateSignPrepositional } from '../../client/src/lib/astroTranslations';
import { onlineRequest } from './onlineApi';
import { ReadingText } from './ReadingText';
import { ReportExcerpt } from './ReportReading';
import { ResultCard } from './ResultCard';

// The existing endpoint debits ORB_COSTS.important_date, not its legacy response cost.
const readingCost = 3;

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

function eventKey(event) {
  return JSON.stringify([event.date, event.type, event.planet, event.to_sign ?? event.sign]);
}

export function ImportantDates({ account, openAccount, openNatal, guestId }) {
  const { token, profile, busy, run, refreshProfile } = account;
  const [events, setEvents] = useState(null);
  const [period, setPeriod] = useState(30);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [needsNatal, setNeedsNatal] = useState(false);
  const [readingEvent, setReadingEvent] = useState(null);
  const [readings, setReadings] = useState({});
  const [readingError, setReadingError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [readingBusy, setReadingBusy] = useState(false);
  const readingAnchor = useRef(null);
  const readingKey = readingEvent ? eventKey(readingEvent) : null;
  const result = readings[readingKey];
  const eligible = ['standard', 'premium'].includes(profile?.tier ?? profile?.billingTier);

  useEffect(() => {
    if (!readingEvent) return;
    readingAnchor.current?.focus();
  }, [readingEvent]);

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

  function requestReading() {
    if (!readingEvent || guestId || busy || !eligible || uncertain || result) return;
    run(async () => {
      setReadingBusy(true);
      setReadingError('');
      try {
        const user = await refreshProfile(token);
        if (!['standard', 'premium'].includes(user.tier ?? user.billingTier)) {
          throw new Error('Новый разбор доступен с подпиской.');
        }
        const balance = Number(user.orbs);
        if (!Number.isFinite(balance) || balance < readingCost) {
          throw new Error('На балансе недостаточно звёзд.');
        }
        const event = readingEvent;
        let reply;
        try {
          reply = await onlineRequest('/api/astrology/important-dates/interpret', {
            token,
            data: {
              eventType: event.type, date: event.date, sign: event.sign, planet: event.planet, to_sign: event.to_sign,
              house_for_sun_sign: event.house_for_sun_sign, locale: 'ru',
            },
          });
          if (typeof reply?.interpretation !== 'string' || !reply.interpretation.trim()) {
            throw Object.assign(new Error(), { uncertain: true });
          }
        } catch (failure) {
          if (!failure.uncertain) throw failure;
          setUncertain(true);
          throw new Error('Ответ не получен. Проверь баланс перед повторным запросом.');
        }
        setReadings(previous => ({ ...previous, [readingKey]: reply }));
        if (!reply.cached) await refreshProfile(token);
      } catch (failure) {
        if (failure.expired) throw failure;
        setReadingError(failure.message);
      } finally {
        setReadingBusy(false);
      }
    });
  }

  function checkBalance() {
    run(async () => {
      try {
        const user = await refreshProfile(token);
        setUncertain(false);
        setReadingError(`Баланс · ${user.orbs}. Если разбор уже сохранился, сервер откроет его без повторного списания.`);
      } catch (failure) {
        if (failure.expired) throw failure;
        setReadingError(failure.message);
      }
    });
  }

  function selectEvent(event) {
    setReadingEvent(event);
    if (!uncertain) setReadingError('');
  }

  if (!token) return <section className="tarot-screen">
    <Frontispiece title="Важные даты" art="glass" />
    <p>Подключи профиль, чтобы открыть календарь по натальной карте.</p>
    <button type="button" onClick={openAccount}>Подключить профиль</button>
  </section>;

  const visibleEvents = events?.filter(event => filter === 'all' ||
    (filter === 'lunar' ? event.type !== 'planet_transit' : event.type === 'planet_transit'));

  return <section className="tarot-screen">
    {guestId ? <h2>Важные даты</h2> : <Frontispiece title="Важные даты" art="glass" />}
    <form className="online-spread" onSubmit={load}>
      <label htmlFor={guestId ? 'guest-dates-period' : 'dates-period'}>Период</label>
      <select id={guestId ? 'guest-dates-period' : 'dates-period'} value={period} disabled={busy} onChange={event => {
        setPeriod(Number(event.target.value));
        setEvents(null);
        if (!uncertain) selectEvent(null);
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
      {readingEvent && !guestId && <div ref={readingAnchor} tabIndex={-1} aria-label="Разбор выбранного события"><ResultCard title={eventTitle(readingEvent)} eyebrow="Разбор даты"
        meta={fullDateFormat.format(new Date(readingEvent.date))}>
        {result ? <><ReadingText text={result.interpretation} /><ReportExcerpt token={token} kind="date" text={result.interpretation} /></> : <>
          {eligible ? <button type="button" disabled={busy || uncertain} onClick={requestReading}>
            {readingBusy ? 'Готовим разбор…' : `Получить ИИ-разбор · до ${readingCost} ★`}
          </button> : <p>Новый разбор доступен с подпиской.</p>}
          {uncertain && <button type="button" className="secondary-button" disabled={busy} onClick={checkBalance}>Проверить баланс</button>}
        </>}
        {readingError && <p role="status">{readingError}</p>}
      </ResultCard></div>}
      {visibleEvents.length === 0 && <p className="empty-panel">В этом периоде нет событий по выбранному фильтру.</p>}
      <ol className="dates-list">
        {visibleEvents.map((event, index) => (
          <li key={`${event.date}-${event.type}-${event.planet ?? ''}-${index}`}>
            <time aria-label={fullDateFormat.format(new Date(event.date))} dateTime={event.date}>
              {dayFormat.format(new Date(event.date))}
            </time>
            <div>
              <h3>{guestId || !(event.to_sign || event.sign) ? eventTitle(event) :
                <button type="button" className="date-event-button" disabled={busy} aria-pressed={readingKey === eventKey(event)}
                  onClick={() => selectEvent(event)}>{eventTitle(event)}</button>}</h3>
              <p>{[event.house_for_sun_sign && `${event.house_for_sun_sign}-й дом от Солнца`,
                event.importance === 'high' && 'Особенно важно'].filter(Boolean).join(' · ')}</p>
            </div>
          </li>
        ))}
      </ol>
    </>}
  </section>;
}
