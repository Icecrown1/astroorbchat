import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { calcMatrixFromISO } from '../../shared/matrix';
import { arcanaCardId, arcanaMetaByN } from '../../shared/matrixArcanaMeta';
import { MatrixOctagram } from '../../client/src/components/MatrixOctagram';
import { cardImage } from './cards';
import { Tarot, History, useReadings } from './Tarot';
import { Account, AccountHistory, OnlineTarot, useAccount } from './Account';
import { Natal } from './Natal';
import './style.css';

function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

function Arcana({ title, number, description }) {
  const card = arcanaMetaByN(number);
  return (
    <article className="arcana">
      <img src={cardImage(arcanaCardId(number))} alt="" />
      <div>
        <p className="zone">{title}</p>
        <h3>{number} · {card.ru}</h3>
        <p className="key">{card.keyRu}</p>
        {description && <p>{description}</p>}
      </div>
    </article>
  );
}

function MatrixResult({ core }) {
  const [selected, setSelected] = useState(null);
  const nodeId = selected?.id ?? 'e';

  return (
    <section className="results" aria-labelledby="result-title">
      <h2 id="result-title">Твоя матрица</h2>
      <p className="matrix-hint">Нажми на число, чтобы узнать его значение.</p>
      <div className="matrix-board">
        <MatrixOctagram core={core} zone="all" onNodeTap={setSelected} activeNodeId={nodeId} label="Схема матрицы судьбы" />
      </div>
      <div aria-live="polite">
        <Arcana
          number={selected?.value ?? core.e}
          title={selected?.label.ru ?? 'Центр — зона комфорта'}
          description={{
            e: 'Центр матрицы. В этой системе он символизирует твой внутренний ресурс.',
            a: 'Аркан дня рождения. Его связывают с первым впечатлением, которое ты производишь.',
          }[nodeId]}
        />
      </div>
    </section>
  );
}

function Matrix() {
  const [date, setDate] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const today = localToday();
  function calculate(event) {
    event.preventDefault();
    const core = calcMatrixFromISO(date);
    if (!core || date > today) {
      setError('Проверь дату рождения.');
      return;
    }
    setResult(core);
    setError('');
  }

  return (
    <>
      <section className="hero">
        <img src={cardImage('star')} alt="" className="cover" />
        <div className="intro">
          <h1>Матрица<br/>судьбы</h1>
          <p>Построй свою матрицу по дате рождения и исследуй её арканы.</p>
        </div>
      </section>
      <form onSubmit={calculate}>
        <label htmlFor="birthday">Дата рождения</label>
        <input id="birthday" type="date" required min="1900-01-01" max={today}
          value={date} onChange={(event) => {
            setDate(event.target.value);
            setResult(null);
            setError('');
          }} />
        <button type="submit">Рассчитать матрицу</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {result && <MatrixResult key={date} core={result} />}
    </>
  );
}

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
      {screen === 'natal' && <Natal key={account.profile?.id ?? Boolean(account.token)} account={account} openAccount={openAccount} />}
      <div hidden={screen !== 'matrix'}><Matrix /></div>
      {screen === 'history' && <section className="tarot-screen">
        <h1>История</h1>
        <AccountHistory account={account} />
        <History entries={readings.entries} openTarot={() => navigate('tarot')} />
      </section>}
      {screen === 'account' && <Account account={account} openHistory={openHistory} />}
      <nav className="app-nav" aria-label="Разделы AstroOrbi">
        {destinations.map(([id, name, icon]) => (
          <button key={id} type="button" aria-current={id === screen ? 'page' : undefined} onClick={() => navigate(id)}>
            <span aria-hidden="true">{icon}</span>{name}
          </button>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
