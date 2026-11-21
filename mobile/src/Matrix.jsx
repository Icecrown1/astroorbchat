import { RewardUnlock } from './RewardUnlock';
import { Fragment, useState } from 'react';
import { calcMatrixFromISO, parseReadingV2 } from '../../shared/matrix';
import { arcanaCardId, arcanaMetaByN } from '../../shared/matrixArcanaMeta';
import { MatrixPlate } from './MatrixPlate';
import { CardButton } from './CardViewer';
import { Frontispiece } from './Editorial';
import { onlineRequest } from './onlineApi';
import { ChartViewport } from './ChartViewport';

function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

function Arcana({ title, number, description }) {
  const card = arcanaMetaByN(number);
  return (
    <article className="arcana">
      <CardButton cards={[{ cardId: arcanaCardId(number), label: title }]} />
      <div>
        <p className="zone">{title}</p>
        <h3>{number} · {card.ru}</h3>
        <p className="key">{card.keyRu}</p>
        {description && <p>{description}</p>}
      </div>
    </article>
  );
}

const arcanaPractice = [
  'Выбери инструмент, которым уже владеешь, и примени его к отложенной задаче.',
  'Запиши первое впечатление от ситуации, затем отдели наблюдения от догадок.',
  'Назови один проект, которому сейчас нужны время и забота.',
  'Сформулируй одно правило, которое сделает твою неделю проще.',
  'Вспомни совет наставника. В какой ситуации он по-прежнему тебе полезен?',
  'Сравни два решения и назови ценность, которую поддерживает каждое.',
  'Наметь ближайший шаг к цели и время, когда его сделаешь.',
  'Запиши, что в споре известно точно, и что ещё стоит узнать.',
  'Выдели десять минут тишины и задай себе один давно отложенный вопрос.',
  'Раздели обстоятельства на те, что можно изменить, и те, к которым можно приспособиться.',
  'Вспомни случай, когда спокойствие помогло больше, чем напор.',
  'Попробуй описать привычную ситуацию с позиции другого участника.',
  'Заверши одно небольшое дело, чтобы освободить место для нового.',
  'Найди занятие, которому сейчас полезнее регулярность, чем рывок.',
  'Заметь одну привычку, которая забирает время, и выбери для неё замену.',
  'Подумай, какую часть плана можно упростить, если обстоятельства изменятся.',
  'Запиши надежду и один достижимый шаг в её сторону.',
  'Раздели тревожную мысль на проверяемые факты и предположения.',
  'Назови недавний успех и человека, с которым хочется им поделиться.',
  'Вернись к старому решению и отметь, чему оно тебя научило.',
  'Подведи итоги завершённого этапа: что хочется взять с собой дальше?',
  'Выбери небольшой эксперимент, в котором можно ошибиться и попробовать снова.',
];

function MatrixResult({ core, title, centerTitle = 'Центр — зона комфорта' }) {
  const [selected, setSelected] = useState(null);
  const nodeId = selected?.id ?? 'e';
  const heading = title ?? 'Твоя матрица';

  const number = selected?.value ?? core.e;
  return (
    <section className="results" aria-label={heading}>
      <h2>{heading}</h2>
      <p className="matrix-hint">Нажми на число, чтобы узнать его значение.</p>
      <ChartViewport className="matrix-board" label="Схема матрицы судьбы">
        <MatrixPlate core={core} selected={nodeId} onSelect={setSelected} />
      </ChartViewport>
      <div aria-live="polite">
        <Arcana
          number={selected?.value ?? core.e}
          title={nodeId === 'e' ? centerTitle : selected.label.ru}
          description={!title && {
            e: 'Центр матрицы. В этой системе он символизирует твой внутренний ресурс.',
            a: 'Аркан дня рождения. Его связывают с первым впечатлением, которое ты производишь.',
          }[nodeId]}
        />
      </div>
      {import.meta.env.MODE === 'ad-preview' && <RewardUnlock id={`matrix-practice:${number}`} title="Практика аркана">
        {() => <article className="result-body"><h3>Практика · {arcanaMetaByN(number).ru}</h3><p>{arcanaPractice[number - 1]}</p></article>}
      </RewardUnlock>}
    </section>
  );
}

export function Matrix({ account, openAccount, initialMode = null }) {
  const [mode, setMode] = useState(initialMode);
  const source = mode ?? (account.token ? 'account' : 'date');
  const accountKey = account.profile?.id ? account.profile.id + account.profile.birthdayDate : Boolean(account.token);
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
      <Frontispiece title={source === 'pair' ? 'Матрица пары' : 'Матрица судьбы'} art={source === 'pair' ? 'couple' : 'portrait'} scene />
      <div className="mode-switch matrix-modes" role="group" aria-label="Режим матрицы">
        <button type="button" aria-pressed={source === 'account'} onClick={() => setMode('account')}>Моя матрица</button>
        <button type="button" aria-pressed={source === 'guest'} onClick={() => setMode('guest')}>Для близких</button>
        <button type="button" aria-pressed={source === 'pair'} onClick={() => setMode('pair')}>Матрица пары</button>
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
        <AccountMatrix key={accountKey} account={account} openAccount={openAccount} />
      </div>
      {['guest', 'pair'].map(kind => (
        <div key={kind + accountKey} hidden={source !== kind}>
          <RelatedMatrices kind={kind} account={account} openAccount={openAccount} />
        </div>
      ))}
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

async function getMatrix(token, guestId) {
  const matrix = guestId
    ? await onlineRequest(`/api/matrix/guest/${encodeURIComponent(guestId)}?locale=ru`, { token })
    : await onlineRequest('/api/matrix/me?locale=ru', { token, envelope: true });
  if (!matrix?.core || !Array.isArray(matrix.sections)) throw new Error('Не удалось загрузить матрицу.');
  return matrix;
}

function AccountMatrix({ account, openAccount, guest }) {
  const guestId = guest?.id;
  const { token, profile, busy, error, run, refreshProfile } = account;
  const [matrix, setMatrix] = useState(guest ?? null);
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
      const updated = await getMatrix(token, guestId);
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
        const latest = await getMatrix(token, guestId);
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
            throw new Error('На балансе недостаточно звёзд.');
          }
        }
        let reply;
        try {
          reply = await onlineRequest('/api/matrix/section', {
            token, envelope: true, data: { section: current.id, locale: 'ru', ...(guestId && { guestId }) },
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
          if (failure.code === 'insufficient_orbs') throw new Error('На балансе недостаточно звёзд.');
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
      <MatrixResult core={matrix.core} title={guest?.name} />
      <section className="matrix-screen" aria-label="Разборы матрицы">
        <h2>Разборы матрицы</h2>
        <div className="matrix-section-list" role="group" aria-label="Разделы разбора">
          {matrix.sections.filter(item => sectionNames[item.id]).map(item => (
            <Fragment key={item.id}>
              <button type="button" aria-expanded={selected === item.id} onClick={() => {
                setSelected(selected === item.id && !mustCheck ? null : item.id);
                if (!busy && !mustCheck) setOwnError(false);
              }} disabled={Boolean(pending)}>
                <span>{sectionNames[item.id]}</span>
                <small>{item.content ? 'Сохранён' : item.free ? 'Бесплатно' : `${sectionCost(item)} ★`}</small>
              </button>
              {selected === item.id && <article className="result-card forecast-result" aria-label={sectionNames[item.id]}>
                {section.content && <MatrixReading content={section.content} />}
                {needsSubscription && <p>Новый разбор доступен с подпиской. Сохранённые разборы можно читать на любом тарифе.</p>}
                {(!section.content || section.outdated) && !needsSubscription && (
                  <button type="button" onClick={generate} disabled={busy || mustCheck}>
                    {pending === section.id ? 'Готовим разбор…' :
                      section.outdated ? 'Обновить разбор бесплатно' :
                      cost > 0 ? `Получить разбор · ${cost} ★` : 'Получить бесплатный разбор'}
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

const relatedMatrixTypes = {
  guest: { list: '/api/matrix/guests', create: '/api/matrix/guest', cost: 15, heading: 'Матрицы близких' },
  pair: { list: '/api/matrix/pairs', create: '/api/matrix/pair', cost: 20, heading: 'Матрица пары' },
};

function personFromRow(row) {
  return { name: row.partnerName ?? row.name, birthDate: row.partnerBirthDate ?? row.birthDate };
}

function samePerson(row, person) {
  const saved = personFromRow(row);
  return saved.birthDate === person.birthDate && saved.name.trim().toLowerCase() === person.name.trim().toLowerCase();
}

const birthDateLabel = value => value.split('-').reverse().join('.');

function PairResult({ result, ownName }) {
  const reading = parseReadingV2(result.reading);
  return <div className="matrix-screen">
    <p>{ownName || 'Ты'} и {result.partnerName} · {birthDateLabel(result.partnerBirthDate)}</p>
    <MatrixResult core={result.pairCore} title="Схема пары" centerTitle="Центр пары" />
    <section className="result-card forecast-result" aria-label="Разбор совместимости">
      <h2>Разбор совместимости</h2>
      {reading?.kind === 'pair' && Array.isArray(reading.zones) && Array.isArray(reading.steps) ? <>
        {reading.summary && <p>{reading.summary}</p>}
        {reading.zones.map(zone => (
          <details key={zone.id}>
            <summary>{zone.title}</summary>
            <div className="server-reading">
              <p>{zone.arcana.map((number, index) => `${zone.roles?.[index] ? zone.roles[index] + ' · ' : ''}${number} ${arcanaMetaByN(number).ru}`).join('\n')}</p>
              {zone.plus && <p><strong>В плюсе.</strong> {zone.plus}</p>}
              {zone.minus && <p><strong>В минусе.</strong> {zone.minus}</p>}
            </div>
          </details>
        ))}
        {reading.steps.length > 0 && <div>
          <h3>Что можно сделать</h3>
          <ol>{reading.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
        </div>}
      </> : <p>{result.reading}</p>}
    </section>
  </div>;
}

function RelatedMatrices({ kind, account, openAccount }) {
  const { token, profile, busy, run, refreshProfile } = account;
  const { list, create, cost, heading } = relatedMatrixTypes[kind];
  const isGuest = kind === 'guest';
  const [rows, setRows] = useState(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [opened, setOpened] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(null);
  const person = { name: name.trim(), birthDate };
  const today = localToday();
  const valid = person.name && birthDate >= '1900-01-01' && birthDate <= today && calcMatrixFromISO(birthDate);
  const needsSubscription = (profile?.tier ?? profile?.billingTier) === 'free';
  const existing = valid && rows?.find(row => samePerson(row, person));

  async function getRows() {
    const saved = await onlineRequest(list, { token });
    if (!Array.isArray(saved)) throw new Error('Не удалось загрузить сохранённые расчёты.');
    setRows(saved);
    return saved;
  }

  function runRelated(action) {
    run(async () => {
      setError('');
      try {
        await action();
      } catch (failure) {
        setError(failure.message);
        if (failure.expired) throw failure;
      }
    });
  }

  function refreshList() {
    runRelated(async () => {
      const saved = await getRows();
      if (!unconfirmed) return;
      await refreshProfile(token);
      setUnconfirmed(null);
      if (!saved.some(row => samePerson(row, unconfirmed))) {
        throw new Error('Расчёта пока нет в списке. Если баланс изменился, дай серверу время и обнови список ещё раз.');
      }
    });
  }

  function openMatrix(requestedPerson, key) {
    runRelated(async () => {
      setPending(true);
      try {
        const saved = await getRows();
        const match = key
          ? saved.find(row => (isGuest ? row.id : row.key) === key)
          : saved.find(row => samePerson(row, requestedPerson));
        if (key && !match) throw new Error('Расчёт больше не отображается в сохранённых.');
        if (match && isGuest) {
          setOpened(await getMatrix(token, match.id));
          return;
        }

        if (!match) {
          const user = await refreshProfile(token);
          if (!['standard', 'premium'].includes(user.tier ?? user.billingTier)) {
            throw new Error('Для нового расчёта нужна подписка.');
          }
          const balance = Number(user.orbs);
          if (!Number.isFinite(balance) || balance < cost) {
            throw new Error('На балансе недостаточно звёзд.');
          }
        }

        const data = match ? personFromRow(match) : requestedPerson;
        let response;
        try {
          response = await onlineRequest(create, { token, data: { ...data, locale: 'ru' } });
          const validResponse = isGuest
            ? response?.id && response.core && Array.isArray(response.sections)
            : response?.key && response.pairCore && typeof response.reading === 'string' && response.partnerBirthDate;
          if (!validResponse) throw Object.assign(new Error(), { uncertain: true });
        } catch (failure) {
          if (failure.uncertain) {
            setUnconfirmed(requestedPerson);
            throw new Error('Ответ не получен. Проверь сохранённые расчёты и баланс перед повтором.');
          }
          if (failure.code === 'subscription_required') throw new Error('Для нового расчёта нужна подписка.');
          if (failure.code === 'insufficient_orbs') throw new Error('На балансе недостаточно звёзд.');
          throw failure;
        }
        setOpened(response);
        if (isGuest || response.charged) await refreshProfile(token);
      } finally {
        setPending(false);
      }
    });
  }

  function submit(event) {
    event.preventDefault();
    if (valid && rows && !busy && !unconfirmed && (existing || !needsSubscription)) {
      openMatrix(person, existing ? (isGuest ? existing.id : existing.key) : undefined);
    }
  }

  if (!token) return <div className="profile-card">
    <p>Подключи профиль, чтобы открыть сохранённые расчёты и добавить новые.</p>
    <button type="button" onClick={openAccount}>Подключить профиль</button>
  </div>;

  return <section className="matrix-screen" aria-label={heading}>
    {opened ? <>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => {
        setOpened(null);
        refreshList();
      }}>К списку расчётов</button>
      {isGuest ? <AccountMatrix key={opened.id} guest={opened} account={account} openAccount={openAccount} />
        : <PairResult result={opened} ownName={profile?.name} />}
    </> : <>
      <h2>{heading}</h2>
      {rows?.length > 0 && <div className="matrix-section-list" aria-label="Сохранённые расчёты">
        {rows.map(row => {
          const saved = personFromRow(row);
          const key = isGuest ? row.id : row.key;
          return <button type="button" key={key} disabled={busy || Boolean(unconfirmed)}
            onClick={() => openMatrix(saved, key)}>
            <span>{saved.name} · {birthDateLabel(saved.birthDate)}</span><small>Открыть</small>
          </button>;
        })}
      </div>}
      <button className="secondary-button" type="button" disabled={busy} onClick={refreshList}>
        {unconfirmed ? 'Проверить расчёты и баланс' : rows ? 'Обновить список' : 'Загрузить сохранённые'}
      </button>
      {rows && <form className="online-spread" onSubmit={submit}>
        <label htmlFor={`matrix-${kind}-name`}>{isGuest ? 'Имя близкого' : 'Имя партнёра'}</label>
        <input id={`matrix-${kind}-name`} value={name} onChange={event => setName(event.target.value)}
          required maxLength={60} disabled={busy} />
        <label htmlFor={`matrix-${kind}-date`}>Дата рождения</label>
        <input id={`matrix-${kind}-date`} type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)}
          required min="1900-01-01" max={today} disabled={busy} />
        {needsSubscription && !existing && <p>С подпиской можно добавить новый расчёт.</p>}
        <button type="submit" disabled={!valid || busy || Boolean(unconfirmed) || (needsSubscription && !existing)}>
          {pending ? 'Загружаем…' : existing ? 'Открыть сохранённый расчёт' :
            isGuest ? `Построить матрицу · ${cost} ★` : `Получить разбор пары · ${cost} ★`}
        </button>
      </form>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
