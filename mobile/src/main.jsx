import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cardImage } from './cards';
import { Tarot, History, useReadings } from './Tarot';
import { Account, AccountHistory, OnlineTarot, useAccount } from './Account';
import { ProfileSettings } from './ProfileSettings';
import { Natal } from './Natal';
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

function Home({ navigate, online, hasDaily }) {
  return (
    <div className="home">
      <section className="hero home-hero">
        <img src={cardImage('moon')} alt="" className="cover" />
        <div className="intro">
          <h1>Карта дня</h1>
          <p>Вытащи карту и посмотри, на что сегодня стоит обратить внимание.</p>
          <button type="button" onClick={() => navigate('tarot', 'daily', online ? 'online' : 'offline')}>
            {hasDaily && !online ? 'Посмотреть карту' : 'Открыть карту дня'}
          </button>
        </div>
      </section>
      <h2>Исследуй себя</h2>
      <div className="feature-grid">
        <button className="feature" type="button" onClick={() => navigate('natal')}>
          <img src={cardImage('sun')} alt="" /><span>Натальная карта</span>
        </button>
        <button className="feature" type="button" onClick={() => navigate('matrix')}>
          <img src={cardImage('star')} alt="" /><span>Матрица судьбы</span>
        </button>
        <button className="feature" type="button" onClick={() => navigate('horoscope')}>
          <img src={cardImage('wheel-of-fortune')} alt="" /><span>Гороскоп</span>
        </button>
        <button className="feature" type="button" onClick={() => navigate('compatibility')}>
          <img src={cardImage('lovers')} alt="" /><span>Совместимость</span>
        </button>
        <button className="feature" type="button" onClick={() => navigate('solar')}>
          <img src={cardImage('temperance')} alt="" /><span>Соляр</span>
        </button>
        <button className="feature" type="button" onClick={() => navigate('oracle')}>
          <img src={cardImage('hermit')} alt="" /><span>Оракул</span>
        </button>
      </div>
      <button className="secondary-button" type="button" onClick={() => navigate('history')}>История раскладов</button>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('home');
  const [tarotMode, setTarotMode] = useState('daily');
  const [tarotSource, setTarotSource] = useState(null);
  const readings = useReadings();
  const account = useAccount();
  const source = tarotSource ?? (account.token ? 'online' : 'offline');
  const openAccount = () => navigate('account');
  const openHistory = () => navigate('history');
  const openSettings = () => navigate('settings');
  const openNatal = () => navigate('natal');
  const profileKey = JSON.stringify([Boolean(account.token), account.profile?.id, account.profile?.birthdayDate,
    account.profile?.birthTime, account.profile?.birthPlace]);

  function navigate(next, mode, requestedSource) {
    if (mode) setTarotMode(mode);
    if (requestedSource) setTarotSource(requestedSource);
    setScreen(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="page">
      <header><span className="orb" aria-hidden="true"></span>AstroOrbi</header>
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
      {screen === 'natal' && <Natal key={profileKey} account={account} openAccount={openAccount} openSettings={openSettings} />}
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
        <Account account={account} openHistory={openHistory} openSettings={openSettings} />}
      {screen === 'settings' && account.profile &&
        <ProfileSettings key={account.profile.id} account={account} openAccount={openAccount} openNatal={openNatal} />}
      <nav className="app-nav" aria-label="Разделы AstroOrbi">
        {destinations.map(([id, name, icon]) => (
          <button key={id} type="button" disabled={screen === 'settings' && account.busy} aria-current={id === (screen === 'settings' ? 'account' : screen) ? 'page' : undefined} onClick={() => navigate(id)}>
            <span aria-hidden="true">{icon}</span>{name}
          </button>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
