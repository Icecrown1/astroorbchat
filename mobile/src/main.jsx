import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cardImage } from './cards';
import brandIcon from '../../client/public/brand/favicon.svg?url';
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

const destinations = [
  ['home', 'Главная', '✦'],
  ['tarot', 'Таро', '◇'],
  ['natal', 'Натальная', '☉'],
  ['account', 'Профиль', '◉'],
];

const homeSections = [
  { title: 'О себе', items: [
    ['natal', 'Натальная карта', 'sun'],
    ['matrix', 'Матрица судьбы', 'star'],
  ] },
  { title: 'Прогнозы и подсказки', items: [
    ['horoscope', 'Гороскоп', 'wheel-of-fortune'],
    ['dates', 'Важные даты', 'high-priestess'],
    ['solar', 'Соляр', 'temperance'],
    ['oracle', 'Оракул', 'hermit'],
  ] },
  { title: 'О близких', items: [
    ['compatibility', 'Совместимость', 'lovers'],
    ['guest-natal', 'Карты близких', 'two-of-cups'],
  ] },
];

function Home({ navigate, online, hasDaily }) {
  return (
    <div className="home">
      <section className="hero home-hero">
        <img src={cardImage('moon')} alt="" className="cover" />
        <div className="intro">
          <h1>Карта дня</h1>
          <p>{online ? 'На что сегодня стоит обратить внимание?' : 'Вытяни карту дня. Она доступна офлайн и без входа.'}</p>
          <button type="button" onClick={() => navigate('tarot', 'daily', online ? 'online' : 'offline')}>
            {hasDaily && !online ? 'Посмотреть карту' : 'Открыть карту дня'}
          </button>
        </div>
      </section>
      {!online && <section className="profile-card start-options" aria-label="Подключение аккаунта">
        <div><h2>Уже пользуешься AstroOrbi в Telegram?</h2>
          <p>Подключи аккаунт, чтобы открыть свои карты, историю и баланс.</p></div>
        <button type="button" className="secondary-button" onClick={() => navigate('account')}>Подключить аккаунт</button>
      </section>}
      {homeSections.map(({ title, items }) => (
        <section className="home-group" key={title} aria-label={title}>
          <h2>{title}</h2>
          <div className="feature-grid">
            {items.map(([id, label, card]) => (
              <button className="feature" type="button" key={id} onClick={() => navigate(id)}>
                <img src={cardImage(card)} alt="" loading="lazy" /><span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="secondary-button" type="button" onClick={() => navigate('history')}>История раскладов</button>
    </div>
  );
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
    <div className="page">
      <header className="app-header">
        {depth > 0 && screen !== 'home' && <button type="button" className="back-button" aria-label="Назад"
          disabled={screen === 'settings' && account.busy} onClick={() => window.history.back()}>←</button>}
        <img src={brandIcon} alt="" className="app-mark" />
        <span>AstroOrbi</span>
      </header>
      {offline && <p className="offline-notice" role="status">Сейчас офлайн. Таро и расчёт матрицы по дате доступны.</p>}
      {screen === 'home' && <Home navigate={navigate} online={Boolean(account.token)} hasDaily={readings.hasDaily} />}
      {screen === 'tarot' && <section className="tarot-screen">
        <h1>Таро</h1>
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
      <div hidden={screen !== 'matrix'}><Matrix account={account} openAccount={openAccount} /></div>
      {screen === 'history' && <section className="tarot-screen">
        <h1>История</h1>
        <AccountHistory account={account} />
        <History entries={readings.entries} openTarot={() => navigate('tarot')} />
      </section>}
      {(screen === 'account' || (screen === 'settings' && !account.profile)) &&
        <Account account={account} openHistory={openHistory} openSettings={openSettings}
          openOffline={() => navigate('tarot', 'daily', 'offline')} />}
      {screen === 'settings' && account.profile &&
        <ProfileSettings key={account.profile.id} account={account} openAccount={openAccount} openNatal={openNatal} />}
      <nav className="app-nav" aria-label="Разделы AstroOrbi">
        {destinations.map(([id, name, icon]) => (
          <button key={id} type="button" disabled={screen === 'settings' && account.busy} aria-current={id === (screen === 'settings' ? 'account' : ['guest-natal', 'dates'].includes(screen) ? 'natal' : screen) ? 'page' : undefined} onClick={() => navigate(id)}>
            <span aria-hidden="true">{icon}</span><span className="nav-label">{name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
