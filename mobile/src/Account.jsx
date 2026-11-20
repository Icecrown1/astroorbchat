import { useRef, useState } from 'react';
import { getTarotCard } from '../../shared/tarot';
import { cardImage } from './cards';
import { onlineRequest } from './onlineApi';

const tiers = { free: 'Бесплатный', standard: 'Standard', premium: 'Premium' };
const spreads = { daily: 'Карта дня', three: 'Три карты', yesno: 'Да / Нет', celtic: 'Кельтский крест', trial: 'Пробный расклад' };
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

export function Account() {
  const [code, setCode] = useState('');
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [daily, setDaily] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  function signOut() {
    setToken(null);
    setProfile(null);
    setHistory([]);
    setDaily(null);
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
  }

  function openDaily() {
    run(async () => {
      const reading = await onlineRequest('/api/tarot/draw', { token, data: { spread: 'daily', locale: 'ru' } });
      setDaily(reading);
      setHistory(items => [reading, ...items.filter(item => item.id !== reading.id)].slice(0, 30));
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
              <button type="button" disabled={busy} onClick={openDaily}>{busy ? 'Загрузка…' : 'Карта дня с ИИ-разбором'}</button>
              {daily && <ServerReading key={daily.id} reading={daily} open />}
              <h2>История аккаунта</h2>
              {!history.length && <p>В аккаунте пока нет раскладов.</p>}
              {history.filter(reading => reading.id !== daily?.id).map(reading =>
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
