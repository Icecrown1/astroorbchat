import { Fragment, useState } from 'react';
import { calcMatrixFromISO, parseReadingV2 } from '../../shared/matrix';
import { arcanaCardId, arcanaMetaByN } from '../../shared/matrixArcanaMeta';
import { MatrixOctagram } from '../../client/src/components/MatrixOctagram';
import { cardImage } from './cards';
import { onlineRequest } from './onlineApi';

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
    <section className="results" aria-label="Твоя матрица">
      <h2>Твоя матрица</h2>
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

export function Matrix({ account, openAccount }) {
  const [mode, setMode] = useState(null);
  const source = mode ?? (account.token ? 'account' : 'date');
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
    <section className="matrix-screen">
      <section className="hero">
        <img src={cardImage('star')} alt="" className="cover" />
        <div className="intro">
          <h1>Матрица<br/>судьбы</h1>
          <p>Построй свою матрицу по дате рождения и исследуй её арканы.</p>
        </div>
      </section>
      <div className="mode-switch" role="group" aria-label="Режим матрицы">
        <button type="button" aria-pressed={source === 'account'} onClick={() => setMode('account')}>Моя матрица</button>
        <button type="button" aria-pressed={source === 'date'} onClick={() => setMode('date')}>По дате</button>
      </div>
      <div hidden={source !== 'date'}>
        <form className="online-spread" onSubmit={calculate}>
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
      <div hidden={source !== 'account'}>
        <PersonalMatrix key={account.profile?.id ? account.profile.id + account.profile.birthdayDate : Boolean(account.token)}
          account={account} openAccount={openAccount} />
      </div>
    </section>
  );
}

const sectionNames = {
  comfort: 'Зона комфорта',
  persona: 'Визитная карточка',
  karmic_tail: 'Кармический хвост',
  money: 'Денежный канал',
  love: 'Канал отношений',
  purpose: 'Предназначение',
  rod: 'Родовой квадрат',
  year: 'Аркан года',
};

function sectionCost(section) {
  if (section.free || section.content) return 0;
  return section.id === 'year' ? 3 : 5;
}

function MatrixReading({ content }) {
  const reading = parseReadingV2(content);
  if (reading?.kind !== 'section' || !Array.isArray(reading.items) || !Array.isArray(reading.steps)) {
    return <p>{content}</p>;
  }
  return <>
    {reading.summary && <p>{reading.summary}</p>}
    {reading.items.map(({ arcana, role, plus, minus }, index) => (
      <Arcana key={index} number={arcana} title={role} description={<>
        {plus && <span><strong>В плюсе.</strong> {plus}</span>}
        {minus && <span><strong>В минусе.</strong> {minus}</span>}
      </>} />
    ))}
    {reading.steps.length > 0 && <div>
      <h3>Что можно сделать</h3>
      <ol>{reading.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
    </div>}
  </>;
}

async function getMatrix(token) {
  const matrix = await onlineRequest('/api/matrix/me?locale=ru', { token, envelope: true });
  if (!matrix.core || !Array.isArray(matrix.sections)) throw new Error('Не удалось загрузить матрицу.');
  return matrix;
}

function PersonalMatrix({ account, openAccount }) {
  const { token, profile, busy, error, run, refreshProfile } = account;
  const [matrix, setMatrix] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mustCheck, setMustCheck] = useState(false);
  const [pending, setPending] = useState(null);
  const [ownError, setOwnError] = useState(false);
  const section = matrix?.sections.find(item => item.id === selected);
  const cost = section ? sectionCost(section) : 0;
  const needsSubscription = cost > 0 && (profile?.tier ?? profile?.billingTier) === 'free';

  function load() {
    run(async () => {
      setOwnError(true);
      const updated = await getMatrix(token);
      setMatrix(updated);
      if (mustCheck) await refreshProfile(token);
      setMustCheck(false);
    });
  }

  function generate() {
    if (!section || busy || mustCheck || needsSubscription) return;
    run(async () => {
      setOwnError(true);
      setPending(section.id);
      try {
        const latest = await getMatrix(token);
        setMatrix(latest);
        const current = latest.sections.find(item => item.id === section.id);
        if (!current) throw new Error('Этот раздел сейчас недоступен.');
        if (current.content && !current.outdated) return;
        const currentCost = sectionCost(current);
        if (currentCost > 0 && currentCost !== cost) {
          throw new Error('Доступ к разделу изменился. Проверь стоимость перед открытием.');
        }
        if (currentCost > 0) {
          const user = await refreshProfile(token);
          if (!['standard', 'premium'].includes(user.tier ?? user.billingTier)) {
            throw new Error('Для нового разбора нужна подписка.');
          }
          const balance = Number(user.orbs);
          if (!Number.isFinite(balance) || balance < currentCost) {
            throw new Error('На балансе недостаточно орбов.');
          }
        }
        let reply;
        try {
          reply = await onlineRequest('/api/matrix/section', {
            token, envelope: true, data: { section: current.id, locale: 'ru' },
          });
          if (reply.section !== current.id || typeof reply.content !== 'string' || !reply.content.trim()) {
            throw Object.assign(new Error(), { uncertain: true });
          }
        } catch (failure) {
          if (failure.uncertain) {
            setMustCheck(true);
            throw new Error('Ответ не получен. Проверь, сохранился ли разбор, и обнови баланс перед повтором.');
          }
          if (failure.code === 'subscription_required') throw new Error('Для нового разбора нужна подписка.');
          if (failure.code === 'insufficient_orbs') throw new Error('На балансе недостаточно орбов.');
          throw failure;
        }
        setMatrix({
          ...latest,
          sections: latest.sections.map(item => item.id === current.id
            ? { ...item, content: reply.content, outdated: false }
            : item),
        });
        if (reply.charged) await refreshProfile(token);
      } finally {
        setPending(null);
      }
    });
  }

  if (!token) return <div className="profile-card">
    <p>Подключи профиль, чтобы открыть матрицу по своей дате рождения и разборы из Telegram.</p>
    <button type="button" onClick={openAccount}>Подключить профиль</button>
  </div>;

  return <div className="matrix-screen">
    {!matrix && <div className="profile-card">
      <p>Возьмём дату рождения из профиля и покажем сохранённые разборы.</p>
      <button type="button" disabled={busy} onClick={load}>{busy ? 'Загружаем…' : 'Открыть мою матрицу'}</button>
    </div>}
    {matrix && <>
      <MatrixResult core={matrix.core} />
      <section className="matrix-screen" aria-labelledby="matrix-sections-title">
        <h2 id="matrix-sections-title">Разборы матрицы</h2>
        <div className="matrix-section-list" role="group" aria-label="Разделы разбора">
          {matrix.sections.filter(item => sectionNames[item.id]).map(item => (
            <Fragment key={item.id}>
              <button type="button" aria-expanded={selected === item.id} onClick={() => {
                setSelected(selected === item.id && !mustCheck ? null : item.id);
                if (!busy && !mustCheck) setOwnError(false);
              }} disabled={Boolean(pending)}>
                <span>{sectionNames[item.id]}</span>
                <small>{item.content ? 'Сохранён' : item.free ? 'Бесплатно' : `${sectionCost(item)} орб.`}</small>
              </button>
              {selected === item.id && <article className="profile-card forecast-result" aria-label={sectionNames[item.id]}>
                {section.content && <MatrixReading content={section.content} />}
                {needsSubscription && <p>Новый разбор доступен с подпиской. Сохранённые разборы можно читать на любом тарифе.</p>}
                {(!section.content || section.outdated) && !needsSubscription && (
                  <button type="button" onClick={generate} disabled={busy || mustCheck}>
                    {pending === section.id ? 'Готовим разбор…' :
                      section.outdated ? 'Обновить разбор бесплатно' :
                      cost > 0 ? `Получить разбор · ${cost} орб.` : 'Получить бесплатный разбор'}
                  </button>
                )}
                {ownError && error && <p role="alert">{error}</p>}
                {mustCheck && <button type="button" className="secondary-button" disabled={busy} onClick={load}>
                  Проверить разбор и баланс
                </button>}
              </article>}
            </Fragment>
          ))}
        </div>
      </section>
      <button type="button" className="secondary-button" disabled={busy} onClick={load}>Обновить разборы</button>
    </>}
    {(!matrix || !section) && ownError && error && <p role="alert">{error}</p>}
  </div>;
}
