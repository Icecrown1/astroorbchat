import { Frontispiece, plate } from './Editorial';
import { StarConfirmation } from './StarConfirmation';
import { PreviewRewards } from './RewardUnlock';
import { RewardHoroscope } from './RewardReadings';
import { useContext, useState } from 'react';
import { onlineRequest } from './onlineApi';
import { ReportExcerpt } from './ReportReading';
import { ResultCard } from './ResultCard';
import { CityField } from './ProfileSettings';

// These prices match ORB_COSTS in the deployed API.
const periods = {
  day: { name: 'День', cost: 1, path: '/api/astrology/horoscope' },
  week: { name: 'Неделя', cost: 5, path: '/api/astrology/horoscope/weekly-plan' },
  month: { name: 'Месяц', cost: 15, path: '/api/astrology/horoscope/monthly-plan' },
};
const compatibilityCost = 20;
const relations = {
  romantic: 'Отношения',
  friendship: 'Дружба',
  work: 'Работа',
  family: 'Семья',
};
const topics = {
  overview: 'Главное', money: 'Деньги', work: 'Работа', study: 'Учёба',
  love: 'Отношения', health: 'Самочувствие', self_care: 'Забота о себе', advice: 'Совет',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' });

function dateLabel(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? dateFormat.format(date) : '';
}

function Topics({ report }) {
  return Object.entries(topics).map(([key, title]) => typeof report[key] === 'string' && report[key].trim() && (
    <div key={key} className="forecast-topic"><h3>{title}</h3><p>{report[key]}</p></div>
  ));
}

function HoroscopeResult({ report }) {
  if (typeof report === 'string') return <p>{report}</p>;
  if (!report || typeof report !== 'object') return <p>Текст прогноза пока недоступен.</p>;
  return <div className="forecast-result">
    <Topics report={report} />
    {Array.isArray(report.days) && report.days.map((day, index) => (
      <details key={day.date ?? index}>
        <summary>{[day.day_of_week, dateLabel(day.date)].filter(Boolean).join(' · ') || 'День'}</summary>
        <Topics report={day} />
      </details>
    ))}
    {Array.isArray(report.weeks) && report.weeks.map((week, index) => (
      <div key={week.week_number ?? index} className="forecast-topic">
        <h3>{week.dates || `Неделя ${index + 1}`}</h3>
        {week.summary && <p>{week.summary}</p>}
        {Array.isArray(week.key_themes) && week.key_themes.length > 0 &&
          <ul>{week.key_themes.map((theme, i) => <li key={i}>{theme}</li>)}</ul>}
      </div>
    ))}
  </div>;
}

function CompatibilityResult({ report }) {
  const rating = Number(report.compatibilityRating);
  return <div className="forecast-result">
    <h2>{report.partners || report.partnerName || 'Совместимость'}</h2>
    {report.compatibilityRating != null && Number.isFinite(rating) && (
      <p className="forecast-score"><strong>{rating.toLocaleString('ru-RU')}</strong> / 10</p>
    )}
    {report.analysis && <p>{report.analysis}</p>}
  </div>;
}

function savedForecast(row) {
  if (row.data) return row.data;
  try {
    return JSON.parse(row.forecast);
  } catch {
    return row.forecast;
  }
}

function PartnerFields({ busy, profile }) {
  const [time, setTime] = useState('');
  const [city, setCity] = useState('');
  const ownDetails = [dateLabel(profile.birthdayDate), profile.birthTime, profile.birthPlace].filter(Boolean).join(' · ');
  return <>
    <div className="person-line"><img src={plate('portrait')} alt="" /><div><small>Твой профиль</small>
      <strong>{profile.name || 'Твои данные'}</strong><p>{ownDetails}</p></div></div>
    <fieldset className="partner-fields"><legend>Данные партнёра</legend>
    <label htmlFor="partner-name">Имя</label>
    <input id="partner-name" name="name" required maxLength={80} disabled={busy} />
    <label htmlFor="partner-date">Дата рождения</label>
    <input id="partner-date" name="date" type="date" max={new Date().toLocaleDateString('sv-SE')} required disabled={busy} />
    <CityField id="partner-place" name="place" value={city} change={setCity} disabled={busy} required />
    <details>
      <summary>Время рождения и пол</summary>
      <div className="partner-extra">
        <label htmlFor="partner-time">Время рождения</label>
        <input id="partner-time" name="time" type="time" value={time} onChange={event => setTime(event.target.value)} disabled={busy} />
        <label htmlFor="partner-gender">Пол</label>
        <select id="partner-gender" name="gender" disabled={busy}>
          <option value="other">Не указан</option><option value="female">Женский</option><option value="male">Мужской</option>
        </select>
      </div>
    </details>
    {!time && <p className="matrix-hint">Если время неизвестно, расчёт будет на 12:00.</p>}
    </fieldset>
    <label htmlFor="relationship-type">Тип связи</label>
    <select id="relationship-type" name="relationshipType" disabled={busy}>
      {Object.entries(relations).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </>;
}

export function Forecasts({ kind, active, account, openAccount, openNatal, openSettings }) {
  const { token, profile, busy, error, run, refreshProfile } = account;
  const horoscope = kind === 'horoscope';
  const rewardAccess = useContext(PreviewRewards);
  const rewardedForecast = rewardAccess && !rewardAccess.paid && horoscope;
  const title = horoscope ? 'Гороскоп' : 'Совместимость';
  const [period, setPeriod] = useState('day');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [mustCheck, setMustCheck] = useState(false);
  const [needsNatal, setNeedsNatal] = useState(false);
  const [validation, setValidation] = useState('');
  const cost = horoscope ? periods[period].cost : compatibilityCost;
  const needsSubscription = profile && (profile.tier ?? profile.billingTier) === 'free';
  const missingBirthplace = !horoscope && profile && !profile.birthPlace;

  async function loadHistory() {
    const entries = await onlineRequest(`/api/astrology/${kind}/history?limit=20`, { token });
    setHistory(entries);
  }

  function checkHistory() {
    run(async () => {
      await loadHistory();
      if (mustCheck) {
        await refreshProfile(token);
        setMustCheck(false);
      }
    });
  }

  const [confirmation, setConfirmation] = useState(null);

  function generate(event) {
    event.preventDefault();
    if (!profile || mustCheck || needsSubscription || missingBirthplace || busy) return;
    setValidation('');
    const fields = new FormData(event.currentTarget);
    const data = { locale: 'ru' };
    if (!horoscope) {
      data.partner = {
        name: fields.get('name').trim(), place: fields.get('place').trim(),
        date: fields.get('date'), time: fields.get('time') || null,
        gender: fields.get('gender'),
      };
      data.relationshipType = fields.get('relationshipType');
      if (!data.partner.name || !data.partner.place) {
        setValidation('Укажи имя и город рождения.');
        return;
      }
    }

    setConfirmation(data);
  }

  function confirmReading() {
    if (!confirmation || busy) return;
    const data = confirmation;
    setConfirmation(null);
    run(async () => {
      const current = await refreshProfile(token);
      if ((current.tier ?? current.billingTier) === 'free') throw new Error('Для разбора нужна подписка.');
      if (!Number.isFinite(Number(current.orbs)) || Number(current.orbs) < cost) {
        throw new Error('На балансе недостаточно звёзд.');
      }

      const path = horoscope ? periods[period].path : '/api/astrology/compatibility';
      try {
        const report = await onlineRequest(path, { token, data });
        setResult(report);
        setHistory(null);
        setNeedsNatal(false);
      } catch (failure) {
        if (failure.code === 'NATAL_NOT_INITIALIZED') setNeedsNatal(true);
        if (failure.uncertain) {
          setMustCheck(true);
          throw new Error('Ответ не получен. Проверь историю и баланс перед повтором.');
        }
        throw failure;
      }
      await refreshProfile(token);
    });
  }

  const periodPicker = <div className="mode-switch forecast-period" aria-label="Период прогноза">
            {Object.entries(periods).map(([id, item]) => (
              <button key={id} type="button" disabled={busy} aria-pressed={id === period}
                onClick={() => { setConfirmation(null); setPeriod(id); setResult(null); }}>{item.name}</button>
            ))}
          </div>;
  const Result = horoscope ? HoroscopeResult : CompatibilityResult;
  return (
    <section className="tarot-screen">
      <Frontispiece title={title} art={horoscope ? "lion" : "couple"} scene={!horoscope} />
      {rewardedForecast && active && <div className="online-spread">
        {periodPicker}<RewardHoroscope period={period} token={token} />
      </div>}
      {!token ? <div className="profile-card">
        <p>Войди, чтобы получить разбор и сохранить его в аккаунте.</p>
        <button type="button" onClick={openAccount}>Подключить профиль</button>
      </div> : <>
        {profile ? !rewardedForecast && <form className="online-spread" onSubmit={generate}>
          {horoscope ? periodPicker : <PartnerFields busy={busy} profile={profile} />}
          {needsSubscription && <p>Для нового разбора нужна подписка.</p>}
          {missingBirthplace && <>
            <p>Сначала укажи свой город рождения.</p>
            <button type="button" className="secondary-button" onClick={openSettings}>Настройки профиля</button>
          </>}
          <button type="submit" disabled={busy || mustCheck || needsSubscription || missingBirthplace}>
            {busy ? 'Подождите…' : `${horoscope ? 'Получить прогноз' : 'Рассчитать совместимость'} · ${cost} ★`}
          </button>
        </form> : <button type="button" disabled={busy} onClick={account.refresh}>Загрузить профиль</button>}
        {validation && <p role="alert">{validation}</p>}
        {confirmation && <StarConfirmation title={horoscope ? 'Гороскоп' : 'Совместимость'} balance={profile?.orbs} cost={cost}
          onCancel={() => setConfirmation(null)} onConfirm={confirmReading} busy={busy} />}
        {error && <p role="alert">{error}</p>}
        {needsNatal && <button className="secondary-button" type="button" onClick={openNatal}>Открыть натальную карту</button>}
        {result && <ResultCard title={horoscope ? 'Твой прогноз' : 'Разбор совместимости'}
          eyebrow={horoscope ? periods[period].name : 'Совместимость'}><Result report={result} /><ReportExcerpt token={token} kind={horoscope ? 'forecast' : 'compatibility'} text={horoscope ? result : result.analysis} /></ResultCard>}
        <button className="secondary-button" type="button" disabled={busy} onClick={checkHistory}>
          {mustCheck ? 'Проверить историю и баланс' : 'Загрузить историю'}
        </button>
        {history?.length === 0 && <p>В истории пока ничего нет.</p>}
        {history?.map(row => <details key={row.id}>
          <summary>{horoscope ? periods[row.period]?.name ?? 'Прогноз' : row.partnerName} · {dateLabel(row.startDate || row.createdAt)}</summary>
          <div className="server-reading"><Result report={horoscope ? savedForecast(row) : row} /><ReportExcerpt token={token} kind={horoscope ? 'forecast' : 'compatibility'} text={horoscope ? savedForecast(row) : row.analysis} /></div>
        </details>)}
      </>}
    </section>
  );
}
