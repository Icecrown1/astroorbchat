import { ReportReading, ReportExcerpt } from './ReportReading';
import { Frontispiece } from './Editorial';
import { StarConfirmation } from './StarConfirmation';
import { useState } from 'react';
import { translateSign } from '../../client/src/lib/astroTranslations';
import { onlineRequest } from './onlineApi';
import { ReadingText } from './ReadingText';
import { ResultCard } from './ResultCard';

const solarCost = 15;
const oracleCost = 0.5;
const formatDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' });

function SignInPrompt({ openAccount }) {
  return <div className="profile-card">
    <p>Подключи профиль AstroOrbi, чтобы открыть этот раздел.</p>
    <button type="button" onClick={openAccount}>Подключить профиль</button>
  </div>;
}

function NatalPrompt({ openNatal }) {
  return <button type="button" className="secondary-button" onClick={openNatal}>Открыть натальную карту</button>;
}

function dateLabel(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? formatDate.format(date) : '';
}

export function Solar({ account, openAccount, openNatal, openSettings }) {
  const { token, profile, busy, error, run, refreshProfile } = account;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [city, setCity] = useState('');
  const [checked, setChecked] = useState(null);
  const [result, setResult] = useState(null);
  const [needsNatal, setNeedsNatal] = useState(false);
  const incomplete = profile && (!profile.birthTime || !profile.birthPlace);
  const requiresPremium = checked && !checked.cached && (profile?.tier ?? profile?.billingTier) !== 'premium';

  function check(event) {
    event.preventDefault();
    if (!city.trim() || !profile || busy) return;
    const data = { targetYear: year, location: city.trim() };
    run(async () => {
      setChecked(null);
      const reply = await onlineRequest('/api/astrology/solar/check', { token, data, envelope: true });
      if (typeof reply.cached !== 'boolean') throw new Error('Не удалось проверить сохранённый соляр.');
      setChecked({ ...data, cached: reply.cached });
    });
  }

  function openSolar() {
    if (!checked || requiresPremium || incomplete || busy) return;
    const { targetYear, location, cached } = checked;
    run(async () => {
      const data = { targetYear, location };
      if (cached) {
        const reply = await onlineRequest('/api/astrology/solar/check', { token, data, envelope: true });
        if (reply.cached !== true) {
          setChecked(null);
          throw new Error('Сохранённый соляр недоступен. Проверь город и год ещё раз.');
        }
      } else {
        const user = await refreshProfile(token);
        if ((user.tier ?? user.billingTier) !== 'premium') throw new Error('Для нового соляра нужен Premium.');
        if (Number(user.orbs) < solarCost || !Number.isFinite(Number(user.orbs))) {
          throw new Error('На балансе недостаточно звёзд.');
        }
      }
      let reply;
      try {
        reply = await onlineRequest('/api/astrology/solar', {
          token, envelope: true, data: { ...data, locale: 'ru' },
        });
      } catch (failure) {
        if (failure.code === 'NATAL_NOT_INITIALIZED') setNeedsNatal(true);
        if (failure.uncertain) {
          setChecked(null);
          throw new Error('Ответ не получен. Проверь, сохранился ли расчёт для этого года и города, прежде чем повторять.');
        }
        throw failure;
      }
      setNeedsNatal(false);
      setChecked({ ...data, cached: true });
      setResult({ ...reply.data, location, targetYear, cached: reply.cached });
      if (!reply.cached) await refreshProfile(token);
    });
  }

  return <section className="tarot-screen">
    <Frontispiece title="Соляр" art="sun" />
    {!token ? <SignInPrompt openAccount={openAccount} /> : <>
      {incomplete ? <div className="profile-card">
        <p>Для соляра нужны точное время и город рождения.</p>
        <button type="button" onClick={openSettings}>Настройки профиля</button>
      </div> :
        <form className="online-spread" onSubmit={check} onChange={() => { setChecked(null); setResult(null); }}>
          <label htmlFor="solar-year">Год</label>
          <select id="solar-year" value={year} onChange={event => setYear(Number(event.target.value))} disabled={busy}>
            {Array.from({ length: 4 }, (_, offset) => currentYear + offset).map(value =>
              <option key={value} value={value}>{value}</option>)}
          </select>
          <label htmlFor="solar-city">Город, где будешь в день рождения</label>
          <input id="solar-city" value={city} onChange={event => setCity(event.target.value)}
            placeholder="Например, Уфа" required maxLength={120} disabled={busy} />
          <button type="submit" disabled={busy || !profile || !city.trim()}>{busy ? 'Подождите…' : 'Проверить расчёт'}</button>
        </form>}
      {checked && !incomplete && <div className="profile-card">
        <p>{checked.cached ? 'Соляр уже сохранён в аккаунте.' : 'Для этого года и города нужен новый расчёт.'}</p>
        {requiresPremium ? <p>Новый соляр доступен по тарифу Premium.</p> :
          <button type="button" disabled={busy} onClick={openSolar}>
            {checked.cached ? 'Открыть сохранённый соляр · бесплатно' : `Рассчитать соляр · ${solarCost} ★`}
          </button>}
      </div>}
      {error && <p role="alert">{error}</p>}
      {!profile && !busy && <button className="secondary-button" type="button" onClick={account.refresh}>Загрузить профиль</button>}
      {needsNatal && <NatalPrompt openNatal={openNatal} />}
      {result && <ResultCard title={`Соляр на ${result.targetYear} год`}
        eyebrow={result.cached ? 'Сохранённый соляр' : 'Прогноз на год'}
        meta={[result.location, dateLabel(result.solar?.date)].filter(Boolean).join(' · ')}>
        {result.solar?.sign && <p>Солнце · {translateSign(result.solar.sign, 'ru')}</p>}
        <ReadingText text={result.interpretation} /><ReportExcerpt token={token} kind="solar" text={result.interpretation} />
      </ResultCard>}
    </>}
  </section>;
}

export function Oracle({ account, openAccount, openNatal }) {
  const { token, profile, busy, error, run, refreshProfile } = account;
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [mustCheck, setMustCheck] = useState(false);
  const [needsNatal, setNeedsNatal] = useState(false);
  const needsSubscription = profile && (profile.tier ?? profile.billingTier) === 'free';

  function openHistory() {
    run(async () => {
      const items = await onlineRequest('/api/astrology/ask/history?limit=20', { token });
      setHistory(items);
      if (mustCheck) {
        await refreshProfile(token);
        setMustCheck(false);
      }
    });
  }

  const [confirmation, setConfirmation] = useState(null);

  function ask(event) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 10 || !profile || mustCheck || needsSubscription || busy) return;
    setConfirmation(text);
  }

  function confirmReading() {
    if (!confirmation || busy) return;
    const text = confirmation;
    setConfirmation(null);
    run(async () => {
      const current = await refreshProfile(token);
      if ((current.tier ?? current.billingTier) === 'free') throw new Error('Для Оракула нужна подписка.');
      if (Number(current.orbs) < oracleCost || !Number.isFinite(Number(current.orbs))) {
        throw new Error('На балансе недостаточно звёзд.');
      }
      try {
        const { answer } = await onlineRequest('/api/astrology/ask', { token, data: { question: text, locale: 'ru' } });
        setResult({ question: text, answer });
        setQuestion('');
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

  return <section className="tarot-screen">
    <Frontispiece title="Оракул" art="owl" scene />
    {!token ? <SignInPrompt openAccount={openAccount} /> : <>
      <form className="online-spread" onSubmit={ask}>
        <label htmlFor="oracle-question">Твой вопрос</label>
        <textarea id="oracle-question" value={question} onChange={event => setQuestion(event.target.value)}
          rows={4} minLength={10} maxLength={1000} required disabled={busy} />
        {needsSubscription && <p>Для нового ответа нужна подписка.</p>}
        <button type="submit" disabled={busy || !profile || mustCheck || needsSubscription || question.trim().length < 10}>
          {busy ? 'Подождите…' : 'Задать вопрос · 0,5 ★'}
        </button>
      </form>
      {confirmation && <StarConfirmation title={'Вопрос Оракулу'} balance={profile?.orbs} cost={oracleCost}
          onCancel={() => setConfirmation(null)} onConfirm={confirmReading} busy={busy} />}
        {error && <p role="alert">{error}</p>}
      {!profile && !busy && <button className="secondary-button" type="button" onClick={account.refresh}>Загрузить профиль</button>}
      {needsNatal && <NatalPrompt openNatal={openNatal} />}
      {result && <ResultCard title={result.question} eyebrow="Ответ Оракула"><ReadingText text={result.answer} />
        <ReportReading key={result.answer} token={token} kind="oracle" reading={result} /></ResultCard>}
      <button className="secondary-button" type="button" onClick={openHistory} disabled={busy}>
        {mustCheck ? 'Проверить историю и баланс' : 'История вопросов'}
      </button>
      {history?.length === 0 && <p className="empty-panel">В истории пока нет вопросов.</p>}
      {history?.map(item => <details key={item.id}>
        <summary>{item.question}</summary>
        <ReportReading token={token} kind="oracle" reading={item} />
        <div className="server-reading">{dateLabel(item.createdAt) && <p>{dateLabel(item.createdAt)}</p>}<p>{item.answer}</p></div>
      </details>)}
    </>}
  </section>;
}
