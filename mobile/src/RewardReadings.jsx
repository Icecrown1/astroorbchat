import { MoonPhase, NextMoonQuarter, SearchMoonQuarter } from 'astronomy-engine';
import { useEffect, useMemo, useState } from 'react';
import { onlineRequest } from './onlineApi';
import { RewardUnlock } from './RewardUnlock';
import { translatePlanet } from '../../client/src/lib/astroTranslations';

const planetThemes = {
  Sun: 'Солнце связывают с волей и самовыражением. Вспомни занятие, в котором тебе хочется проявить инициативу.',
  Moon: 'Луна описывает привычки и чувство безопасности. Понаблюдай, что помогает тебе восстановиться.',
  Mercury: 'Меркурий связан с мышлением и речью. Обрати внимание, как ты задаёшь вопросы и объясняешь сложное.',
  Venus: 'Венера говорит о вкусах и привязанностях. Заметь, какие жесты заботы тебе легче всего принять.',
  Mars: 'Марс связан с действием и границами. В какой ситуации тебе пора прямо сказать, чего хочется?',
  Jupiter: 'Юпитер связывают с обучением и расширением опыта. Выбери одно направление для эксперимента.',
  Saturn: 'Сатурн описывает дисциплину и ответственность. Какое правило сегодня действительно помогает?',
  Uranus: 'Уран связывают с самостоятельностью и переменами. Найди привычку, которую хочется пересмотреть.',
  Neptune: 'Нептун говорит о воображении и идеалах. Попробуй сформулировать мечту и один конкретный шаг к ней.',
  Pluto: 'Плутон связывают с глубокими переменами. Что уже исчерпало себя и может уступить место новому?',
  'North Node': 'Северный узел связывают с новым опытом. Что интересно попробовать впервые?',
  'South Node': 'Южный узел связывают с привычным опытом. Какой знакомый навык может послужить опорой?',
};
const houseThemes = [
  'образ себя и первое впечатление', 'личные ресурсы, деньги и ценности', 'повседневное общение и обучение',
  'дом, семья и чувство опоры', 'творчество, удовольствие и самовыражение', 'ежедневные дела и привычки',
  'партнёрство и договорённости', 'общие ресурсы, близость и доверие', 'мировоззрение и дальние путешествия',
  'профессия и общественная роль', 'друзья, сообщества и общие планы', 'уединение и внутренняя жизнь',
];

export function RewardPlanet({ planet, position, house, example }) {
  const name = translatePlanet(planet.name, 'ru');
  return <RewardUnlock id={`planet:${example}:${planet.name}:${planet.position}:${house}`} title={`Разбор планеты · ${name}`}>
    {() => <article className="result-body"><h3>{name} · {position}</h3>
      <p>{planetThemes[planet.name] ?? 'Посмотри, какие темы выбранной планеты ты узнаёшь в своём опыте.'}</p>
      {house && <p>В этой карте планета в {house}-м доме. Его темы — {houseThemes[house - 1]}.</p>}
    </article>}
  </RewardUnlock>;
}

export function RewardHouse({ number, cusp, members, example }) {
  return <RewardUnlock id={`house:${example}:${number}:${cusp}`} title={`Разбор дома · ${number}-й дом`}>
    {() => <article className="result-body"><h3>{number}-й дом</h3>
      <p>К этому дому относят {houseThemes[number - 1]}. Вспомни, какое событие последних дней связано у тебя с этой темой.</p>
      {members.length > 0 && <p>Планеты в доме · {members.map(p => translatePlanet(p.name, 'ru')).join(', ')}.</p>}
    </article>}
  </RewardUnlock>;
}

const forecastTitles = { day: 'Гороскоп на день', week: 'Гороскоп на неделю', month: 'Гороскоп на месяц' };
const phases = [
  ['Новолуние', 'Выбери одно намерение и первый небольшой шаг к нему.'],
  ['Первая четверть', 'Сверь план с тем, что уже получилось. Где пора перейти к действию?'],
  ['Полнолуние', 'Посмотри на результат и отметь, какой разговор стоит довести до ясности.'],
  ['Последняя четверть', 'Заверши начатое и освободи в расписании место для следующего цикла.'],
];
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

function LunarForecast({ period, startTime }) {
  const forecast = useMemo(() => {
    const start = new Date(startTime);
    const end = new Date(start);
    if (period === 'week') end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    const events = [];
    for (let q = SearchMoonQuarter(start); q.time.date < end; q = NextMoonQuarter(q)) {
      events.push({ when: shortDate.format(q.time.date), phase: q.quarter });
    }
    const opening = Math.floor(MoonPhase(start) / 90) % 4;
    return { events, opening, range: [shortDate.format(start), shortDate.format(new Date(end.getTime() - 1))].join(' — ') };
  }, [period, startTime]);
  return <article className="result-body">
    <small>Лунный прогноз · {forecast.range}</small><h3>{forecastTitles[period]}</h3>
    <p>В начале периода — {phases[forecast.opening][1]}</p>
    {forecast.events.map(event => <section key={event.when}>
      <h4>{event.when} · {phases[event.phase][0]}</h4><p>{phases[event.phase][1]}</p>
    </section>)}
  </article>;
}

const signs = { aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы' };

function DailySign({ sign }) {
  const [report, setReport] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    onlineRequest(`/api/public/sign-horoscope/${sign}?locale=ru`).then(data => {
      if (!data?.intro) throw new Error();
      if (active) setReport(data);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [sign, attempt]);
  return <article className="result-body"><h3>Гороскоп на день · {signs[sign]}</h3>
    {failed ? <><p>Прогноз уже открыт. Проверь связь, чтобы загрузить текст.</p>
      <button type="button" onClick={() => setAttempt(n => n + 1)}>Повторить загрузку</button></> :
      report ? <><p>{report.intro}</p>
        {Object.entries({ work: 'Работа', love: 'Отношения', care: 'Забота о себе', advice: 'Совет' }).map(([key, heading]) =>
          report[key] && <div key={key}><h4>{heading}</h4><p>{report[key]}</p></div>)}</> : <p role="status">Загружаем прогноз…</p>}
  </article>;
}

export function RewardHoroscope({ period }) {
  const [sign, setSign] = useState('aries');
  const date = new Date();
  if (period === 'month') date.setDate(1);
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  const stamp = period === 'day' ? date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) :
    [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
  date.setHours(0, 0, 0, 0);
  const title = forecastTitles[period];
  return <>
    {period === 'day' && <label>Знак<select value={sign} onChange={e => setSign(e.target.value)}>
      {Object.entries(signs).map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
    </select></label>}
    <RewardUnlock id={`horoscope:${period}:${stamp}:${period === 'day' ? sign : ''}`}
      total={{ day: 1, week: 2, month: 3 }[period]} title={title}>
      {() => period === 'day' ? <DailySign key={sign + stamp} sign={sign} /> :
        <LunarForecast period={period} startTime={date.getTime()} />}
    </RewardUnlock>
  </>;
}
