import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { calcMatrixFromISO } from '../../shared/matrix';
import { arcanaCardId, arcanaMetaByN } from '../../shared/matrixArcanaMeta';
import { MatrixOctagram } from '../../client/src/components/MatrixOctagram';
import { cardImage } from './cards';
import { Tarot, History, useReadings } from './Tarot';
import { Account } from './Account';
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
  ['matrix', 'Матрица', '⟐'],
  ['history', 'История', '☾'],
  ['account', 'Профиль', '◉'],
];

function Home({ navigate, hasDaily }) {
  return (
    <div className="home">
      <section className="hero home-hero">
        <img src={cardImage('moon')} alt="" className="cover" />
        <div className="intro">
          <h1>Карта дня</h1>
          <p>Один аркан и вопрос, над которым можно подумать сегодня.</p>
          <button type="button" onClick={() => navigate('tarot', 'daily')}>{hasDaily ? 'Посмотреть карту' : 'Открыть карту дня'}</button>
        </div>
      </section>
      <div className="feature-grid">
        <button className="feature" type="button" onClick={() => navigate('tarot', 'three')}>
          <img src={cardImage('high-priestess')} alt="" /><span>Три карты</span>
        </button>
        <button className="feature" type="button" onClick={() => navigate('matrix')}>
          <img src={cardImage('star')} alt="" /><span>Матрица судьбы</span>
        </button>
      </div>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('home');
  const [tarotMode, setTarotMode] = useState('daily');
  const readings = useReadings();

  function navigate(next, mode) {
    if (mode) setTarotMode(mode);
    setScreen(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="page">
      <header><span className="orb" aria-hidden="true"></span>AstroOrbi</header>
      {screen === 'home' && <Home navigate={navigate} hasDaily={readings.hasDaily} />}
      {screen === 'tarot' && <Tarot readings={readings} mode={tarotMode} setMode={setTarotMode} />}
      <div hidden={screen !== 'matrix'}><Matrix /></div>
      {screen === 'history' && <History entries={readings.entries} openTarot={() => navigate('tarot')} />}
      <div hidden={screen !== 'account'}><Account /></div>
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
