import { useState } from 'react';
import { onlineRequest } from './onlineApi';

const cost = 2;
const supportedPlanets = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
]);

const sections = {
  detailed: { strengths: 'Сильные стороны', risks: 'На что обратить внимание', advice: 'Рекомендации' },
  house: { key_themes: 'Ключевые темы', opportunities: 'Возможности', challenges: 'Сложности', practical_work: 'Практические шаги' },
};

function hasReading(reading, type) {
  const text = type === 'house' ? reading?.manifestation : reading?.summary;
  return typeof text === 'string' && Boolean(text.trim());
}

function Reading({ reading, kind }) {
  return <article className="result-body forecast-result">
    {reading.title && <h3>{reading.title}</h3>}
    {kind === 'house' ? <>
      {reading.life_sphere && <p><strong>Сфера жизни.</strong> {reading.life_sphere}</p>}
      <p>{reading.manifestation}</p>
    </> : <p>{reading.summary}</p>}
    {Object.entries(sections[kind] ?? {}).map(([key, label]) => {
      const values = reading[key];
      if (!Array.isArray(values) || values.length === 0) return null;
      return <div key={key}>
        <h4>{label}</h4>
        <ul>{values.map((value, index) => <li key={index}>{value}</li>)}</ul>
      </div>;
    })}
  </article>;
}

function houseStatus(token) {
  return onlineRequest('/api/astrology/house-influence-status?chartType=own', { token });
}

export function NatalReadings({ planet, houseNumber, account, savedHouses }) {
  const { token, profile, busy, run, refreshProfile } = account;
  const [readings, setReadings] = useState({});
  const [houses, setHouses] = useState(savedHouses ?? {});
  const [openedHouse, setOpenedHouse] = useState(null);
  const [pending, setPending] = useState(null);
  const [unconfirmed, setUnconfirmed] = useState(null);
  const [errors, setErrors] = useState({});
  const personal = readings[planet] ?? {};
  const house = houses[planet];
  const needsSubscription = (profile?.tier ?? profile?.billingTier) === 'free';
  const pastHouse = hasReading(house, 'house');

  function act(action, task) {
    run(async () => {
      setPending(action);
      setErrors(old => ({ ...old, [planet]: '' }));
      try {
        await task();
      } catch (failure) {
        if (failure.expired) throw failure;
        setErrors(old => ({ ...old, [planet]: failure.message }));
      } finally {
        setPending(null);
      }
    });
  }

  async function refreshHouses() {
    const status = await houseStatus(token);
    if (!status || typeof status !== 'object' || Array.isArray(status)) {
      throw new Error('Не удалось проверить сохранённые разборы домов.');
    }
    const latest = status.ru ?? {};
    setHouses(latest);
    return latest;
  }

  function open(kind) {
    const paid = kind !== 'brief';
    if (busy || (paid && (unconfirmed || needsSubscription))) return;

    act(kind, async () => {
      if (kind === 'house') {
        const latest = await refreshHouses();
        if (hasReading(latest[planet], 'house')) {
          setOpenedHouse(planet);
          return;
        }
      }
      if (paid) {
        const user = await refreshProfile(token);
        if (!['standard', 'premium'].includes(user.tier ?? user.billingTier)) {
          throw new Error('Для нового разбора нужна подписка.');
        }
        const balance = Number(user.orbs);
        if (!Number.isFinite(balance) || balance < cost) throw new Error('На балансе недостаточно орбов.');
      }

      const path = kind === 'house' ? 'house-influence' : 'planet-interpretation';
      const data = { planet, chartType: 'own', locale: 'ru', ...(kind !== 'house' && { mode: kind }) };
      let result;
      try {
        result = await onlineRequest(`/api/astrology/${path}`, { token, data });
        if (!hasReading(result, kind)) {
          throw Object.assign(new Error('Сервер вернул пустой разбор.'), { uncertain: true });
        }
      } catch (failure) {
        if (paid && failure.uncertain) {
          setUnconfirmed({ kind, planet });
          throw new Error('Ответ не получен. Сверь баланс и сохранённые разборы перед повторным запросом.');
        }
        throw failure;
      }

      if (kind === 'house') {
        setHouses(previous => ({ ...previous, [planet]: result }));
        setOpenedHouse(planet);
      } else {
        setReadings(previous => ({ ...previous, [planet]: { ...previous[planet], [kind]: result } }));
      }
      if (paid) {
        try {
          await refreshProfile(token);
        } catch (failure) {
          if (failure.expired) throw failure;
          throw new Error('Разбор получен. Актуальный баланс можно проверить в профиле.');
        }
      }
    });
  }

  function reconcile() {
    act('check', async () => {
      const latest = unconfirmed.kind === 'house' ? await refreshHouses() : null;
      const user = await refreshProfile(token);
      if (unconfirmed.kind === 'house' && hasReading(latest[unconfirmed.planet], 'house')) {
        setErrors(old => ({ ...old, [unconfirmed.planet]: '' }));
        setOpenedHouse(unconfirmed.planet);
      } else {
        const balance = user.orbs;
        const note = balance == null
          ? 'Разбор не подтверждён. При повторном запросе возможно новое списание.'
          : `Баланс · ${balance}. При повторном запросе возможно новое списание.`;
        setErrors(old => ({ ...old, [unconfirmed.planet]: note, [planet]: note }));
      }
      setUnconfirmed(null);
    });
  }

  if (!supportedPlanets.has(planet)) return null;

  return <div className="tarot-screen">
    {personal.brief ? <Reading reading={personal.brief} kind="brief" /> :
      <button type="button" className="secondary-button" disabled={busy} onClick={() => open('brief')}>
        {pending === 'brief' ? 'Загружаем…' : 'Краткий разбор · бесплатно'}
      </button>}
    {personal.detailed ? <details className="natal-detail" open>
      <summary>Подробный разбор планеты</summary>
      <Reading reading={personal.detailed} kind="detailed" />
    </details> : !needsSubscription && <button type="button" disabled={busy || Boolean(unconfirmed)} onClick={() => open('detailed')}>
      {pending === 'detailed' ? 'Готовим разбор…' : `Подробный разбор планеты · ${cost} орба`}
    </button>}
    {pastHouse ? <details key={planet} className="natal-detail" open={openedHouse === planet}>
      <summary>Сохранённый разбор влияния дома</summary>
      <Reading reading={house} kind="house" />
    </details> : houseNumber && (needsSubscription ?
      <button type="button" className="secondary-button" disabled={busy} onClick={() => act('saved', refreshHouses)}>
        {pending === 'saved' ? 'Проверяем…' : 'Проверить сохранённые разборы домов'}
      </button> :
      <button type="button" className="secondary-button" disabled={busy || Boolean(unconfirmed)} onClick={() => open('house')}>
        {pending === 'house' ? 'Готовим разбор…' : `Разобрать влияние дома · ${cost} орба`}
      </button>)}
    {needsSubscription && !personal.detailed && <p>Новый подробный разбор доступен с подпиской.</p>}
    {errors[planet] && <p role="alert">{errors[planet]}</p>}
    {unconfirmed && <button type="button" className="secondary-button" disabled={busy} onClick={reconcile}>
      {pending === 'check' ? 'Сверяем…' : 'Сверить баланс и разборы'}
    </button>}
  </div>;
}
