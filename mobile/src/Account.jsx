import { QuestionHelp } from './ReadingTools';
import { ReadingFeedback } from './ReadingFeedback';
import { PilotAccess } from './PilotAccess';
import { authPilot, mechanics, playInternal, rewardsEnabled } from './playInternal';
import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { getTarotCard } from '../../shared/tarot';
import { Frontispiece, IndexRow, plate } from './Editorial';
import { ClarifyingCard } from './AdPreview';
import { SpreadGallery } from './SpreadGallery';
import { StarConfirmation } from './StarConfirmation';
import { apiOrigin, onlineRequest } from './onlineApi';
import { BirthDetails } from './ProfileSettings';
import { ReportReading } from './ReportReading';

const tiers = { free: 'Бесплатный', standard: 'Standard', premium: 'Premium' };
const spreads = { daily: 'Карта дня', three: 'Три карты', yesno: 'Да / Нет', celtic: 'Кельтский крест', trial: 'Пробный расклад' };
const native = Capacitor.isNativePlatform();
const sessionKey = 'astroorbi.mobile.session.' + apiOrigin.hostname;
const onlineSpreads = ['daily', 'yesno', 'three', 'celtic'];
const verdicts = { yes: 'Да', no: 'Нет', maybe: 'Пока неясно' };
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' });

function ServerReading({ reading, open, token }) {
  const interpretation = reading.interpretation;
  const body = <div className="server-reading">
    {reading.question && <blockquote>{reading.question}</blockquote>}
    {verdicts[interpretation?.verdict] && <strong>Ответ · {verdicts[interpretation.verdict]}</strong>}
    <SpreadGallery cards={reading.cards} spread={reading.spread}
      titles={reading.cards?.map(({ cardId }, i) => {
        const card = getTarotCard(cardId);
        const title = interpretation?.cards?.[i]?.title || '';
        return card ? title.replace(card.nameEn, '').replace('(' + card.nameRu + ')', '').replace(card.nameRu, '').replace(/^[\s:·—–-]+/, '').trim() : title;
      })}
      descriptions={Array.isArray(interpretation?.cards) ? interpretation.cards.map(section => section?.text) : []}>
      {interpretation?.intro && <p>{interpretation.intro}</p>}
      {interpretation?.synthesis && <div className="reading-section"><h3>Общий смысл</h3><p>{interpretation.synthesis}</p></div>}
    </SpreadGallery>
    {rewardsEnabled && !open && reading.spread === 'three' && <ClarifyingCard entry={reading} source="online" earnedOnly />}
    {interpretation?.advice && <div className="reading-section"><h3>Совет</h3><p>{interpretation.advice}</p></div>}
    <ReadingFeedback topic="tarot"/>
    <ReportReading token={token} kind="tarot" reading={reading} />
  </div>;
  const date = <time dateTime={reading.createdAt}>{dateFormat.format(new Date(reading.createdAt))}</time>;
  if (open) return <article className="reading-edition"><h2>{spreads[reading.spread] || 'Расклад'}</h2>{date}{body}</article>;
  return <details><summary><strong>{spreads[reading.spread] || 'Расклад'}</strong>{date}</summary>{body}</details>;
}

function OnlineSpreadForm({ account, status, profile, busy, draw, initialSpread }) {
  const [spread, setSpread] = useState(initialSpread ?? 'daily');
  const [question, setQuestion] = useState('');
  const [allowReversed, setAllowReversed] = useState(true);
  const [approval, setApproval] = useState(null);
  const paid = spread !== 'daily';
  const cost = status?.costs?.[spread];
  const hasCost = Number.isInteger(cost) && cost >= 0;
  const needsSubscription = paid && (profile.tier ?? profile.billingTier) === 'free';

  if (approval) return <StarConfirmation title={spreads[approval.spread]} balance={profile.orbs} cost={cost}
    onCancel={() => setApproval(null)} onConfirm={() => { setApproval(null); draw(approval); }} busy={busy} />;
  return (
    <form className="online-spread" onSubmit={event => {
      event.preventDefault();
      if (paid && (!question.trim() || !hasCost || needsSubscription)) return;
      if (paid && cost > 0) setApproval({ spread, question: question.trim(), allowReversed });
      else draw(paid ? { spread, question: question.trim(), allowReversed } : { spread });
    }}>

      <div className="spread-choice"><img src={plate('hand')} alt="" /><div>
      <label htmlFor="online-spread">Выбери расклад</label>
      <select id="online-spread" value={spread} onChange={event => setSpread(event.target.value)} disabled={busy}>
        {onlineSpreads.map(id => <option key={id} value={id}>{spreads[id]}</option>)}
      </select>
      <p>{spread === 'daily' ? 'Одна карта на сегодня · бесплатно' : spread === 'yesno' ? 'Одна карта на твой вопрос' : spread === 'three' ? 'Три стороны одной ситуации' : 'Десять позиций для подробного разбора'}</p>
      </div></div>
      {paid && <>
        <QuestionHelp account={account} onChoose={setQuestion}/>
        <label htmlFor="tarot-question">Твой вопрос</label>
        <textarea id="tarot-question" value={question} onChange={event => setQuestion(event.target.value)}
          required maxLength={300} rows={3} disabled={busy} />
        <label className="spread-toggle">
          <input type="checkbox" checked={allowReversed}
            onChange={event => setAllowReversed(event.target.checked)} disabled={busy} />
          Перевёрнутые карты
        </label>
        {needsSubscription && <p>Для этого расклада нужна подписка.</p>}
        {!hasCost && !needsSubscription && <p>Стоимость недоступна. Обнови историю и баланс.</p>}
      </>}
      <button type="submit" disabled={busy || (paid && (!hasCost || needsSubscription || !question.trim()))}>
        {busy ? 'Подождите…' : paid ? (hasCost ? `Сделать расклад · ${cost} ★` : 'Сделать расклад') :
          status?.dailyDone ? 'Открыть карту дня' : 'Карта дня с ИИ-разбором'}
      </button>
    </form>
  );
}

export function useAccount() {
  const [code, setCode] = useState('');
  // undefined while the device is checking for a saved session, null for a confirmed guest.
  const [token, setToken] = useState(native ? undefined : null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [tarotStatus, setTarotStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  function clearAccount() {
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
      return await action();
    } catch (failure) {
      if (failure.expired) {
        clearAccount();
        if (native) await SecureStorage.remove(sessionKey, false).catch(() => {});
      }
      setError(failure.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function signIn(event) {
    event.preventDefault();
    if (mechanics) {
      localStorage.removeItem('mechanics-guest');
      run(async () => { setToken('demo'); await loadAccount('demo'); });
      return;
    }
    if (!/^[A-Za-z0-9_-]{22}$/.test(code.trim())) {
      setError('Проверь, что код скопирован целиком.');
      return;
    }

    run(async () => {
      const session = await onlineRequest('/api/mobile/auth/exchange', { data: { code: code.trim() } });
      await acceptSession(session.token);
    });
  }

  async function acceptSession(value) {
      const session={token:value};
      setCode('');
      setToken(session.token);
      let stored = true;
      if (native) {
        try {
          await SecureStorage.set(sessionKey, session.token, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
        } catch {
          stored = false;
        }
      }
      await loadAccount(session.token);
      if (!stored) setError('Вход выполнен. Сохранить его на телефоне не удалось.');
  }

  async function refreshProfile(sessionToken) {
    const user = await onlineRequest('/api/user/me', { token: sessionToken });
    setProfile(user);
    return user;
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

  useEffect(() => {
    if (mechanics) {
      if (localStorage.getItem('mechanics-guest')) setToken(null);
      else run(async () => { setToken('demo'); await loadAccount('demo'); });
      return;
    }
    if (!native) return;
    run(async () => {
      const saved = await SecureStorage.get(sessionKey, false, false);
      if (typeof saved !== 'string' || !saved) {
        setToken(null);
        return;
      }
      setToken(saved);
      await loadAccount(saved);
    });
  }, []);

  useEffect(() => {
    if (!authPilot || !token) return;
    const refresh = () => { if (!document.hidden) run(() => refreshProfile(token)); };
    document.addEventListener('visibilitychange',refresh);
    return () => document.removeEventListener('visibilitychange',refresh);
  },[token]);

  function deleteProfile() {
    return run(async () => {
      await onlineRequest('/api/mobile/account', { token, method: 'DELETE', data: { confirmation: 'DELETE' } });
      const prefix = 'astroorbi.reward.v1:' + profile.id + ':';
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
      if (mechanics) localStorage.setItem('mechanics-guest','1');
      clearAccount();
      if (native && !mechanics) await SecureStorage.remove(sessionKey, false);
    });
  }

  function signOut() {
    run(async () => {
      if(authPilot) await onlineRequest('/api/mobile/pilot/logout',{token,data:{}});
      if (mechanics) localStorage.setItem('mechanics-guest','1');
      if (native && !mechanics) {
        try {
          await SecureStorage.remove(sessionKey, false);
        } catch {
          throw new Error('Не удалось удалить сохранённый вход. Попробуй снова.');
        }
      }
      clearAccount();
    });
  }

  function draw(data) {
    return run(async () => {
      let reading;
      try {
        reading = await onlineRequest('/api/tarot/draw', { token, data: { ...data, locale: 'ru' } });
      } catch (failure) {
        if (data.spread !== 'daily' && failure.uncertain) {
          setTarotStatus(null);
          throw new Error('Результат запроса не получен. Обнови историю и баланс, прежде чем повторять.');
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
          setError('Расклад сохранён. Чтобы увидеть актуальный баланс, обнови историю.');
        }
      }
      return reading;
    });
  }

  return {
    code, setCode, token, profile, history, latest, tarotStatus, busy, error, run, signIn, signOut, deleteProfile, draw, acceptSession,
    refresh: () => run(() => loadAccount(token)), refreshProfile,
    mergeProfile: changes => setProfile(previous => ({ ...previous, ...changes })),
  };
}

export function Account({ account, openHistory, openSettings, openOffline, openStars }) {
  const { token, profile, code, setCode, signIn, signOut, refresh, busy, error } = account;
  const [deleting, setDeleting] = useState(false);
  return (
    <section className="tarot-screen">
      <Frontispiece title="Профиль" art="portrait" scene />
      {!token ? (
        <>
          {authPilot ? <PilotAccess key="sign-in" account={account} openGuest={openOffline}/> : mechanics ? <form className="profile-card" onSubmit={signIn}>
            <button disabled={busy}>Открыть тестовый профиль</button>
          </form> : <form className="profile-card account-connect" onSubmit={signIn}>
            <h2>{playInternal ? 'Войти в тестовый профиль' : 'Войти через Telegram'}</h2>
            {playInternal ? <p>Введите код Android-песочницы. Обычный код действует 5 минут. Для проверки Google используйте код из инструкции App access.</p> : <ol className="connect-steps">
              <li>Открой AstroOrbi в Telegram.</li>
              <li>В настройках найди «Мобильное приложение» и получи код входа.</li>
              <li>Вставь код сюда в течение 5 минут.</li>
            </ol>}
            <label htmlFor="link-code">{playInternal ? 'Тестовый код' : 'Код из Telegram'}</label>
            <input id="link-code" value={code} onChange={event => setCode(event.target.value)} required
              autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy}
              aria-invalid={Boolean(error) || undefined} aria-describedby={error ? 'account-status' : undefined} />
            <button type="submit" disabled={busy}>{busy ? 'Подключаем…' : 'Войти'}</button>
          </form>}
          {!authPilot && <button className="secondary-button" type="button" onClick={openOffline} disabled={busy}>Открыть офлайн-Таро</button>}
        </>
      ) : <>
        {authPilot && profile && <PilotAccess key="link-email" account={account} linking/>}
        {profile && <div className="identity-line">
          <h2>{profile.name}</h2><span>{tiers[profile.billingTier] || profile.billingTier}</span>
        </div>}
        <div className="illustrated-index">
          {profile && <BirthDetails profile={profile} openSettings={openSettings} busy={busy} />}
          <IndexRow title="История раскладов" description="Карты и толкования" art="books" onClick={openHistory} />
          <IndexRow title="Баланс и подписка" description={profile?.orbs == null ? 'Звёзды и активный тариф' : `На счету ${Number(profile.orbs).toLocaleString('ru-RU')} ★`} art="saturn" onClick={openStars} />
        </div>
        <div className="account-actions">
          <button type="button" disabled={busy} onClick={refresh}>Обновить</button>
          <button type="button" disabled={busy} onClick={signOut}>Выйти</button>
        </div>
      </>}
      {error && <p id="account-status" role="alert">{error}</p>}
      {playInternal && <section className="profile-card">
        <p>Астрологические разборы предназначены для развлечения.</p>
        <a href={new URL('/mobile/privacy', apiOrigin).href} target="_blank" rel="noreferrer">Конфиденциальность</a>
        {' · '}<a href="mailto:Icecrown@astroorbi.com">Поддержка</a>
        {profile && !authPilot && <><p>Номер тестового профиля: {profile.id}</p>
          {deleting ? <><p>Удалить профиль Android, историю, звёзды и завершённые тестовые заказы? Восстановить их в приложении нельзя.</p>
            <button type="button" disabled={busy} onClick={() => { setDeleting(false); account.deleteProfile(); }}>Подтвердить удаление</button>
            <button type="button" disabled={busy} onClick={() => setDeleting(false)}>Отмена</button></> :
            <button type="button" className="secondary-button" onClick={() => setDeleting(true)}>Удалить тестовый профиль</button>}</>}
      </section>}
    </section>
  );
}

export function OnlineTarot({ account, openAccount, openHistory, initialSpread, onReadingComplete }) {
  const { token, profile, tarotStatus, busy, error, draw, refresh } = account;
  const [opened, setOpened] = useState(() =>
    account.latest?.spread === initialSpread && initialSpread !== 'daily' ? account.latest : null);
  const [nextSpread, setNextSpread] = useState(initialSpread);
  if (!token) return (
    <div className="profile-card">
      <p>Войди, чтобы получить ИИ-разбор и сохранить его в аккаунте.</p>
      <button type="button" onClick={openAccount}>Подключить профиль</button>
    </div>
  );

  return <>
    {!profile && busy && <p role="status">Загружаем профиль…</p>}
    {opened ? <>
      <ServerReading key={opened.id} reading={opened} open token={token} />
      {rewardsEnabled && opened.spread === 'three' && <ClarifyingCard entry={opened} source="online" />}
      <button className="secondary-button" type="button" onClick={() => setOpened(null)}>Выбрать другой расклад</button>
    </> : profile && <OnlineSpreadForm account={account} status={tarotStatus} profile={profile} busy={busy} initialSpread={nextSpread}
      draw={async data => {
        const result = await draw(data);
        if (result) {
          onReadingComplete();
          setNextSpread(data.spread);
          setOpened(result);
          window.scrollTo(0, 0);
        }
      }} />}
    {error && <>
      <p role="alert">{error}</p>
      <button className="secondary-button" type="button" onClick={refresh} disabled={busy}>Обновить историю и баланс</button>
    </>}
    <button className="secondary-button" type="button" onClick={openHistory}>История раскладов</button>
  </>;
}

export function AccountHistory({ account }) {
  if (!account.token) return null;
  return (
    <section className="tarot-screen">
      <h2>Из аккаунта</h2>
      {!account.history.length && <p className="empty-panel">В аккаунте пока нет раскладов.</p>}
      {account.history.map(reading => <ServerReading key={reading.id} reading={reading} token={account.token} />)}
    </section>
  );
}
