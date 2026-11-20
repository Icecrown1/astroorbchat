import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { calcMatrixFromISO } from '../../shared/matrix';
import { arcanaCardId, arcanaMetaByN } from '../../shared/matrixArcanaMeta';
import { MatrixOctagram } from '../../client/src/components/MatrixOctagram';
import hero from '../../client/public/tarot/star.webp';
import './style.css';

const cardImages = import.meta.glob(
  '../../client/public/tarot/{magician,high-priestess,empress,emperor,hierophant,lovers,chariot,justice,hermit,wheel-of-fortune,strength,hanged-man,death,temperance,devil,tower,star,moon,sun,judgement,world,fool}.webp',
  { eager: true, query: '?url', import: 'default' },
);

function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

function Arcana({ title, number, description }) {
  const card = arcanaMetaByN(number);
  const path = '../../client/public/tarot/' + arcanaCardId(number) + '.webp';
  return (
    <article className="arcana">
      <img src={cardImages[path]} alt="" />
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

function App() {
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
    <div className="page">
      <header><span className="orb" aria-hidden="true"></span>AstroOrbi</header>
      <section className="hero">
        <img src={hero} alt="" className="cover" />
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
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
