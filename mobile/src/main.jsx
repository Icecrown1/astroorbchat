import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Frontispiece, IndexRow, NavIcon, plate } from './Editorial';
import editorialHero from './art/card-of-day.webp';
import { Tarot, History, useReadings } from './Tarot';
import { Account, AccountHistory, OnlineTarot, useAccount } from './Account';
import { ProfileSettings } from './ProfileSettings';
import { Natal } from './Natal';
import { GuestNatal } from './GuestNatal';
import { ImportantDates } from './ImportantDates';
import { Forecasts } from './Forecasts';
import { Oracle, Solar } from './AnnualAndOracle';
import { Matrix } from './Matrix';
import './style.css';

const destinations = [['home', 'Главная'], ['tools', 'Инструменты'], ['account', 'Профиль']];
const tools = [
  ['tarot', 'Таро', 'Карта дня и расклады', 'hand'],
  ['compatibility', 'Совместимость', 'Разбор отношений по данным рождения', 'couple'],
  ['oracle', 'Оракул', 'Ответ на твой вопрос', 'owl'],
  ['natal', 'Натальная карта', 'Планеты и дома в момент рождения', 'sun'],
  ['matrix', 'Матрица судьбы', 'Арканы по дате рождения', 'matrix'],
  ['pair', 'Матрица пары', 'Сильные стороны и задачи союза', 'rings'],
  ['horoscope', 'Гороскоп', 'Прогноз на день, неделю или месяц', 'lion'],
  ['dates', 'Важные даты', 'События личного календаря', 'glass'],
  ['solar', 'Соляр', 'Личный прогноз на год', 'sphere'],
  ['guest-natal', 'Карты близких', 'Натальные карты семьи и друзей', 'portrait'],
];
const featured = tools.slice(1, 5);

function Home({ navigate, online, hasDaily }) {
  return <div className="home">
    <section className="daily-cover" style={{ backgroundImage: `url(${editorialHero})` }}>
      <h1>Карта<br />дня</h1>
      <button type="button" onClick={() => navigate('tarot', 'daily', online ? 'online' : 'offline')}>
        {hasDaily && !online ? 'Посмотреть карту' : 'Открыть бесплатно'} <span aria-hidden="true">→</span>
      </button>
    </section>
    <div className="cover-grid">{featured.map(([id, name, , art]) =>
      <button key={id} type="button" className={'cover-tile tile-' + art} onClick={() => navigate(id)}>
        <img src={plate(art)} alt="" /><strong>{name}</strong>
      </button>)}</div>
    <button className="catalog-link" type="button" onClick={() => navigate('tools')}>Все инструменты <span aria-hidden="true">→</span></button>
  </div>;
}

function Tools({ navigate }) {
  return <section className="tarot-screen">
    <Frontispiece title="Инструменты" art="sphere" />
    <div className="illustrated-index">{tools.map(([id, name, description, art]) =>
      <IndexRow key={id} title={name} description={description} art={art} onClick={() => navigate(id)} />)}</div>
    <IndexRow title="История раскладов" art="books" onClick={() => navigate('history')} />
  </section>;
}

function Stars({ profile, openAccount }) {
  return <section className="tarot-screen">
    <Frontispiece title={<>Звёзды<br />и подписка</>} art="sphere" scene />
    <section className="ledger"><h2>Баланс</h2>
      {profile?.orbs != null && <strong className="balance-number">{Number(profile.orbs).toLocaleString('ru-RU')} ✶</strong>}
      <p>Звёзды тратятся на разборы. На кнопке каждого платного разбора указана его стоимость.</p>
      {!profile && <button type="button" onClick={openAccount}>Открыть профиль</button>}
    </section>
    <section className="ledger"><h2>Бесплатно</h2><p>Карта дня, базовая натальная карта и матрица по дате рождения.</p></section>
    <section className="ledger"><h2>Что даёт подписка</h2>
      <dl><div><dt>Standard</dt><dd>+250 ★ в месяц</dd></div><div><dt>Premium</dt><dd>+550 ★ в месяц и соляр</dd></div></dl>
      <p>Это ежемесячное пополнение баланса. Управлять подпиской можно в AstroOrbi в Telegram.</p>
    </section>
  </section>;
}

function App() {
  const [route, setRoute] = useState({ screen: 'home', depth: 0 });
  const [tarotMode, setTarotMode] = useState('daily');
  const [tarotSource, setTarotSource] = useState(null);
  const { screen, depth } = route;
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const readings = useReadings();
  const account = useAccount();
  const source = tarotSource ?? (account.token ? 'online' : 'offline');
  const openAccount = () => navigate('account');
  const openHistory = () => navigate('history');
  const openSettings = () => navigate('settings');
  const openNatal = () => navigate('natal');
  const openGuests = () => navigate('guest-natal');
  const openDates = () => navigate('dates');
  const profileKey = JSON.stringify([Boolean(account.token), account.profile?.id, account.profile?.birthdayDate,
    account.profile?.birthTime, account.profile?.birthPlace]);

  useEffect(() => {
    window.history.replaceState({ astroOrbi: true, screen: 'home', depth: 0 }, '');
    function restore(event) {
      if (!event.state?.astroOrbi) return;
      setRoute(event.state);
      if (event.state.tarotMode) setTarotMode(event.state.tarotMode);
      setTarotSource(event.state.tarotSource ?? null);
    }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  function navigate(next, mode, requestedSource) {
    if (mode) setTarotMode(mode);
    if (requestedSource) setTarotSource(requestedSource);
    if (next === screen) return;
    window.history.replaceState({ ...route, astroOrbi: true, tarotMode, tarotSource }, '');
    const destination = {
      astroOrbi: true, screen: next, depth: depth + 1,
      tarotMode: mode ?? tarotMode, tarotSource: requestedSource ?? tarotSource,
    };
    window.history.pushState(destination, '');
    setRoute(destination);
    window.scrollTo(0, 0);
  }

  return (
    <div className="page" data-screen={screen}>
      <header className="app-header">
        {depth > 0 && !destinations.some(([id]) => id === screen) && <button type="button" className="back-button" aria-label="Назад"
          disabled={screen === 'settings' && account.busy} onClick={() => window.history.back()}>←</button>}
        <span className="editorial-wordmark">Astro<b>Orbi</b><i aria-hidden="true">✶</i></span>
        <button className="star-balance" type="button" onClick={() => navigate('stars')} aria-label="Звёзды и подписка">
          <span aria-hidden="true">✦</span> {account.profile?.orbs != null ? Number(account.profile.orbs).toLocaleString('ru-RU') : 'Звёзды'}
        </button>
      </header>
      {offline && <p className="offline-notice" role="status">Сейчас офлайн. Таро и расчёт матрицы по дате доступны.</p>}
      {screen === 'home' && <Home navigate={navigate} online={Boolean(account.token)} hasDaily={readings.hasDaily} />}
      {screen === 'tools' && <Tools navigate={navigate} />}
      {screen === 'stars' && <Stars profile={account.profile} openAccount={openAccount} />}
      {screen === 'tarot' && <section className="tarot-screen">
        <Frontispiece title="Таро" art="hand" />
        <div className="mode-switch" aria-label="Вариант расклада">
          <button type="button" aria-pressed={source === 'online'} onClick={() => setTarotSource('online')}>С ИИ</button>
          <button type="button" aria-pressed={source === 'offline'} onClick={() => setTarotSource('offline')}>Офлайн</button>
        </div>
        {source === 'online'
          ? <OnlineTarot account={account} openAccount={openAccount} openHistory={openHistory} initialSpread={tarotMode} />
          : <Tarot readings={readings} mode={tarotMode} setMode={setTarotMode} />}
      </section>}
      <div key={'natal' + profileKey} hidden={screen !== 'natal'}>
        <Natal active={screen === 'natal'} account={account} openAccount={openAccount} openSettings={openSettings}
          openGuests={openGuests} openDates={openDates} />
      </div>
      <div key={'guests' + profileKey} hidden={screen !== 'guest-natal'}>
        {account.token || screen === 'guest-natal' ? <GuestNatal account={account} openAccount={openAccount} /> : null}
      </div>
      <div key={'dates' + profileKey} hidden={screen !== 'dates'}>
        {account.token || screen === 'dates' ? <ImportantDates account={account} openAccount={openAccount} openNatal={openNatal} /> : null}
      </div>
      {['horoscope', 'compatibility'].map(kind => (
        <div key={kind + profileKey} hidden={screen !== kind}>
          <Forecasts kind={kind} account={account} openAccount={openAccount} openNatal={openNatal} openSettings={openSettings} />
        </div>
      ))}
      <div key={'solar' + profileKey} hidden={screen !== 'solar'}>
        <Solar account={account} openAccount={openAccount} openNatal={openNatal} openSettings={openSettings} />
      </div>
      <div key={'oracle' + Boolean(account.token)} hidden={screen !== 'oracle'}>
        <Oracle account={account} openAccount={openAccount} openNatal={openNatal} />
      </div>
      <div hidden={!['matrix', 'pair'].includes(screen)}><Matrix key={screen === 'pair' ? 'pair' : 'matrix'} initialMode={screen === 'pair' ? 'pair' : null} account={account} openAccount={openAccount} /></div>
      {screen === 'history' && <section className="tarot-screen">
        <Frontispiece title="История раскладов" art="books" />
        <AccountHistory account={account} />
        <History entries={readings.entries} openTarot={() => navigate('tarot')} />
      </section>}
      {(screen === 'account' || (screen === 'settings' && !account.profile)) &&
        <Account account={account} openHistory={openHistory} openSettings={openSettings}
          openStars={() => navigate('stars')} openOffline={() => navigate('tarot', 'daily', 'offline')} />}
      {screen === 'settings' && account.profile &&
        <ProfileSettings key={account.profile.id} account={account} openAccount={openAccount} openNatal={openNatal} />}
      <nav className="app-nav" aria-label="Разделы AstroOrbi">
        {destinations.map(([id, name]) => (
          <button key={id} type="button" disabled={screen === 'settings' && account.busy} aria-current={id === (['settings','stars','history'].includes(screen) ? 'account' : screen === 'home' || screen === 'account' ? screen : 'tools') ? 'page' : undefined} onClick={() => navigate(id)}>
            <NavIcon name={id} /><span className="nav-label">{name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
