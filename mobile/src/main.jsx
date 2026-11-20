import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { calcMatrixFromISO } from '../../shared/matrix';
import { arcanaCardId, arcanaMetaByN } from '../../shared/matrixArcanaMeta';
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
        <p>{description}</p>
      </div>
    </article>
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
          <p>Узнай два своих аркана по дате рождения.</p>
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
      <div aria-live="polite">
        {result && <section className="results">
          <h2>Твои арканы</h2>
          <Arcana number={result.e} title="Зона комфорта"
            description="Центр матрицы. В этой системе он символизирует твой внутренний ресурс." />
          <Arcana number={result.a} title="Визитная карточка"
            description="Аркан дня рождения. Его связывают с первым впечатлением, которое ты производишь." />
        </section>}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
