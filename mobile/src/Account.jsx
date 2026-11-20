import { useRef, useState } from 'react';
import { getTarotCard } from '../../shared/tarot';
import { cardImage } from './cards';
import { onlineRequest } from './onlineApi';

const tiers = { free: 'Бесплатный', standard: 'Standard', premium: 'Premium' };
const spreads = { daily: 'Карта дня', three: 'Три карты', yesno: 'Да / Нет', celtic: 'Кельтский крест', trial: 'Пробный расклад' };
const onlineSpreads = ['daily', 'yesno', 'three', 'celtic'];
const verdicts = { yes: 'Да', no: 'Нет', maybe: 'Пока неясно' };
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' });

function ServerReading({ reading, open }) {
  const interpretation = reading.interpretation;
  return (
    <details open={open ? true : undefined}>
      <summary>
        <strong>{spreads[reading.spread] || 'Расклад'}</strong>
        <time dateTime={reading.createdAt}>{dateFormat.format(new Date(reading.createdAt))}</time>
      </summary>
      <div className="server-reading">
        {reading.question && <p>Вопрос: {reading.question}</p>}
        {verdicts[interpretation?.verdict] && <p className="zone">Ответ · {verdicts[interpretation.verdict]}</p>}
        {interpretation?.intro && <p>{interpretation.intro}</p>}
        <ol className="reading">
          {reading.cards?.map(({ cardId, reversed, position }, index) => {
            const card = getTarotCard(cardId);
            const section = interpretation?.cards?.[index];
            return (
              <li className="arcana" key={position ?? index}>
                {card && <img src={cardImage(cardId)} alt="" className={reversed ? 'reversed-card' : undefined} />}
                <div>
                  <h3>{section?.title || card?.nameRu || 'Карта'}</h3>
                  {reversed && <p className="key">Перевёрнутая карта</p>}
                  {section?.text && <p>{section.text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        {interpretation?.synthesis && <p>{interpretation.synthesis}</p>}
        {interpretation?.advice && <p>{interpretation.advice}</p>}
      </div>
    </details>
  );
}

function OnlineSpreadForm({ status, profile, busy, draw }) {
  const [spread, setSpread] = useState('daily');
  const [question, setQuestion] = useState('');
  const [allowReversed, setAllowReversed] = useState(true);
  const paid = spread !== 'daily';
  const cost = status?.costs?.[spread];
  const hasCost = Number.isInteger(cost) && cost >= 0;
  const needsSubscription = paid && (profile.tier ?? profile.billingTier) === 'free';

  return (
    <form className="online-spread" onSubmit={event => {
      event.preventDefault();
      if (paid && (!question.trim() || !hasCost || needsSubscription)) return;
      draw(paid ? { spread, question: question.trim(), allowReversed } : { spread });
    }}>
      <h2>Таро с ИИ</h2>
      <label htmlFor="online-spread">Расклад</label>
      <select id="online-spread" value={spread} onChange={event => setSpread(event.target.value)} disabled={busy}>
        {onlineSpreads.map(id => <option key={id} value={id}>{spreads[id]}</option>)}
      </select>
      {paid && <>
        <label htmlFor="tarot-question">Твой вопрос</label>
        <textarea id="tarot-question" value={question} onChange={event => setQuestion(event.target.value)}
          required maxLength={300} rows={3} disabled={busy} />
        <label className="spread-toggle">
          <input type="checkbox" checked={allowReversed}
            onChange={event => setAllowReversed(event.target.checked)} disabled={busy} />
          Перевёрнутые карты
        </label>
        {needsSubscription && <p>Для этого расклада нужна подписка.</p>}
        {!hasCost && !needsSubscription && <p>Стоимость недоступна. Нажми «Обновить» в профиле.</p>}
      </>}
      <button type="submit" disabled={busy || (paid && (!hasCost || needsSubscription || !question.trim()))}>
        {busy ? 'Подождите…' : paid ? (hasCost ? `Сделать расклад · ${cost} орб.` : 'Сделать расклад') :
          status?.dailyDone ? 'Открыть карту дня' : 'Карта дня с ИИ-разбором'}
      </button>
    </form>
  );
}

export function Account() {
  const [code, setCode] = useState('');
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [tarotStatus, setTarotStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  function signOut() {
    setToken(null);
    setProfile(null);
    setHistory([]);
    setLatest(null);
    setTarotStatus(null);
    setError('');
  }

  async function run(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (failure.expired) signOut();
      setError(failure.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function signIn(event) {
    event.preventDefault();
    if (!/^[A-Za-z0-9_-]{22}$/.test(code.trim())) {
      setError('Проверь, что код скопирован целиком.');
      return;
    }

    run(async () => {
      const session = await onlineRequest('/api/mobile/auth/exchange', { data: { code: code.trim() } });
      setCode('');
      setToken(session.token);
      await loadAccount(session.token);
    });
  }

  async function loadAccount(sessionToken) {
    const [user, readings] = await Promise.all([
      onlineRequest('/api/user/me', { token: sessionToken }),
      onlineRequest('/api/tarot/history', { token: sessionToken }),
    ]);
    setProfile(user);
    setHistory(readings);
    setTarotStatus(null);
    setTarotStatus(await onlineRequest('/api/tarot/status?locale=ru', { token: sessionToken }));
  }

  function draw(data) {
    run(async () => {
      let reading;
      try {
        reading = await onlineRequest('/api/tarot/draw', { token, data: { ...data, locale: 'ru' } });
      } catch (failure) {
        if (data.spread !== 'daily' && failure.uncertain) {
          setTarotStatus(null);
          throw new Error('Результат запроса не получен. Нажми «Обновить» и проверь историю и баланс перед повтором.');
        }
        throw failure;
      }
      setLatest(reading);
      setHistory(items => [reading, ...items.filter(item => item.id !== reading.id)].slice(0, 30));
      if (data.spread === 'daily') {
        setTarotStatus(status => ({ ...status, dailyDone: true }));
      } else {
        try {
          setProfile(await onlineRequest('/api/user/me', { token }));
        } catch (failure) {
          if (failure.expired) throw failure;
          setError('Расклад сохранён. Чтобы увидеть актуальный баланс, нажми «Обновить».');
        }
      }
    });
  }

  return (
    <section className="tarot-screen">
      <h1>Профиль</h1>
      {!token ? (
        <form onSubmit={signIn}>
          <p>Открой AstroOrbi в Telegram и найди «Настройки → Мобильное приложение → Получить код входа».</p>
          <label htmlFor="link-code">Одноразовый код</label>
          <input id="link-code" value={code} onChange={event => setCode(event.target.value)} required
            autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} />
          <button type="submit" disabled={busy}>{busy ? 'Подключаем профиль…' : 'Подключить профиль'}</button>
        </form>
      ) : (
        <>
          {profile && (
            <div className="profile-card">
              <h2>{profile.name}</h2>
              <p>Тариф · {tiers[profile.billingTier] || profile.billingTier}</p>
              {profile.orbs != null && <p>Баланс · {profile.orbs}</p>}
            </div>
          )}
          <div className="mode-switch">
            <button type="button" disabled={busy} onClick={() => run(() => loadAccount(token))}>Обновить</button>
            <button type="button" disabled={busy} onClick={signOut}>Выйти</button>
          </div>
          {profile && (
            <>
              <OnlineSpreadForm status={tarotStatus} profile={profile} busy={busy} draw={draw} />
              {latest && <ServerReading key={latest.id} reading={latest} open />}
              <h2>История аккаунта</h2>
              {!history.length && <p>В аккаунте пока нет раскладов.</p>}
              {history.filter(reading => reading.id !== latest?.id).map(reading =>
                <ServerReading key={reading.id} reading={reading} />,
              )}
            </>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
