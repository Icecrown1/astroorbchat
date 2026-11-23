import { useState } from 'react';
import { calendarNumber, cardName, connection, yearSpread, rulingNumber, birthPositions } from '../../shared/campCards';
import { compactCard, cardMeaning, theme, inLove, planetContexts } from '../../shared/campReadings';
import { histories } from '../../shared/readingThemes';
import { CampIndices } from './CampIndices';

const tabs = ['Карты любви','Прогноз на год','Совместимость','Прогноз на день'];
const prettyDate = time => new Date(time).toLocaleDateString('ru-RU',{timeZone:'UTC'});
const dayMs = 86400000;
function anniversary(birth, age) {
  const [y,m,d] = birth.split('-').map(Number);
  return Date.UTC(y+age,m-1,Math.min(d,new Date(Date.UTC(y+age,m,0)).getUTCDate()));
}
function Position({title, card, children}) {
  if (!card) return null;
  return <article className="camp-position"><h4>{title} · {compactCard(card)}</h4>{children && <p>{children}</p>}<p>{cardMeaning(card)}</p></article>;
}
function Profile({date,card}) {
  if (!card) return <><h2>Джокер</h2><p>{cardMeaning(0)}</p></>;
  const ruling = rulingNumber(date), layout = birthPositions(card);
  const story = histories.find(p=>calendarNumber(p.date)===card && rulingNumber(p.date)===ruling);
  return <><small>Карта рождения · {compactCard(card)}</small><h2>{cardName(card)}</h2><p>{cardMeaning(card)}</p>
    <h3>В близких отношениях</h3><p>{inLove(card)}</p>
    <Position title="Карта планетарного управления" card={ruling}>Она уточняет, как проявляется карта рождения. Здесь дополнительная тема — {theme(ruling)}.</Position>
    <details><summary>Планетарные позиции и кармические карты</summary>
      <Position title="Луна" card={layout.moon}>{planetContexts['Луна']}</Position>
      {layout.periods.map(p=><Position key={p.planet} title={p.planet} card={p.horizontal}>{planetContexts[p.planet]}</Position>)}
      <Position title="Плутон" card={layout.pluto}>Обстоятельства, в которых привычный способ действия приходится пересматривать.</Position>
      <Position title="Плутон · результат" card={layout.result}>Что может стать опорой после такой перемены.</Position>
      <Position title="Космический урок" card={layout.cosmicLesson}>Так в системе Кэмпа называется сквозная тема жизни. Эту карту читают вместе с картой рождения.</Position>
      {layout.firstKarma===card ? <p>Карта сохраняет место в жизненном и духовном раскладах.</p> : <>
        <Position title="Первая кармическая карта" card={layout.firstKarma}>Повторяющийся сюжет, который может требовать внимания.</Position>
        <Position title="Вторая кармическая карта" card={layout.secondKarma}>Опыт, к которому можно обращаться, когда сюжет повторяется.</Position></>}
    </details>
    {story && <details><summary>История · {story.name}</summary><p>В этой биографии совпадают карта рождения {compactCard(card)} и карта управления {compactCard(ruling)}.</p><p>{story.text}</p><a href={story.source} target="_blank" rel="noreferrer">Биография NASA ↗</a></details>}</>;
}
function Annual({birth, card, today}) {
  const target = Date.parse(today+'T00:00:00Z');
  const difference = Number(today.slice(0,4))-Number(birth.slice(0,4));
  const currentAge = difference-(target<anniversary(birth,difference)?1:0);
  const [choice,setChoice] = useState('');
  const [layer,setLayer] = useState('birth');
  const age = choice==='' ? currentAge : Number(choice);
  const basis = layer==='birth'?card:rulingNumber(birth);
  const spread = age>=0 && age<=150 && yearSpread(basis,age);
  const start = anniversary(birth,age);
  const periods = spread ? spread.periods.map((period,i)=>({...period,
    begin:start+(i===0?0:52*i+1)*dayMs, end:i===6?anniversary(birth,age+1)-dayMs:start+52*(i+1)*dayMs})) : [];
  const current = periods.find(p=>p.begin<=target && target<=p.end);
  return <><label>Возраст на день рождения<input type="number" min="0" max="150" value={choice} placeholder={String(currentAge)} onChange={e=>setChoice(e.target.value)}/></label>
    <label>Основа расклада<select value={layer} onChange={e=>setLayer(e.target.value)}><option value="birth">Карта рождения</option><option value="ruling">Карта планетарного управления</option></select></label>
    {spread ? <><h2>Год с {prettyDate(start)}</h2><p>Задача года связана с картой {compactCard(spread.pluto)}. {cardMeaning(spread.pluto)}</p>
      {current && <p className="camp-current"><b>Сейчас · {current.planet}</b><br/>{prettyDate(current.begin)} — {prettyDate(current.end)}</p>}
      {periods.map(p=><details key={p.planet+age+layer} open={current===p || undefined}><summary>{p.planet} · {prettyDate(p.begin)} — {prettyDate(p.end)}</summary>
        <p>{planetContexts[p.planet]}</p><Position title="Основная карта" card={p.horizontal}/><Position title="Дополняющая карта" card={p.vertical}/>
        {p.vertical && <p>{p.horizontal===p.vertical ? 'Одна карта занимает обе позиции, поэтому мотив периода повторяется.' : theme(p.horizontal)===theme(p.vertical) ? 'Обе карты раскрывают одну сферу — '+theme(p.horizontal)+'. Первая задаёт ситуацию, вторая показывает ещё одну её сторону.' : 'Первая карта выделяет '+theme(p.horizontal)+'. Дополняющая показывает, какую роль в этой ситуации играют '+theme(p.vertical)+'.'}</p>}</details>)}
      <h3>Карты всего года</h3><Position title="Плутон · перемены" card={spread.pluto}/><Position title="Последствия · результат" card={spread.result}/><Position title="Перспектива" card={spread.perspective}/></> : <p>Укажи возраст от 0 до 150 лет.</p>}</>;
}
function Compatibility({a,b,partner,setPartner}) {
  const pair = a && b ? connection(a,b) : null;
  return <><label>Дата рождения второго человека<input type="date" value={partner} onChange={e=>setPartner(e.target.value)}/></label>
    {b===0 && <p>Для пары с Джокером эта методика не задаёт расклад.</p>}
    {pair && <><h2>{compactCard(a)} и {compactCard(b)}</h2>
      <CampIndices key={a+':'+b} a={a} b={b}/>
      <Position title="Как ты воспринимаешь партнёра" card={pair.first}>В этой позиции отражается твой отклик на встречу.</Position>
      <Position title="Как партнёр воспринимает тебя" card={pair.second}>Ответный отклик партнёра имеет собственную карту.</Position>
      <Position title="Что сближает" card={pair.bond}/><Position title="Где могут возникать трения" card={pair.conflict}/>
      <details><summary>Другие позиции пары</summary><Position title="Общая тема встречи" card={pair.field}/>
        <Position title="Твоя опора" card={pair.firstBond}/><Position title="Опора партнёра" card={pair.secondBond}/>
        <Position title="Твоя сторона разногласия" card={pair.firstConflict}/><Position title="Сторона партнёра" card={pair.secondConflict}/>
        <Position title="Основа отношений" card={pair.root}/></details></>}</>;
}
export function CampCards() {
  const [mode,setMode]=useState(tabs[0]), [birth,setBirth]=useState(''), [partner,setPartner]=useState('');
  const now=new Date(), today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const [day,setDay]=useState(today);
  const a=calendarNumber(birth), b=calendarNumber(partner), d=calendarNumber(day);
  const forecast=a && d ? connection(a,d) : null;
  return <section className="tarot-screen"><h1>Карты Кэмпа</h1>
    <div className="camp-tabs">{tabs.map(t=><button key={t} aria-pressed={mode===t} onClick={()=>setMode(t)}>{t}</button>)}</div>
    <label>Дата рождения<input type="date" value={birth} max={today} onChange={e=>setBirth(e.target.value)}/></label>
    {a!==null && <section className="ledger camp-reading">
      {mode===tabs[0] && <Profile card={a} date={birth}/>}
      {mode!==tabs[0] && a===0 && <p>31 декабря соответствует Джокеру. Для него эта методика не задаёт персональный расклад.</p>}
      {a>0 && mode===tabs[1] && <Annual key={birth} birth={birth} card={a} today={today}/>}
      {a>0 && mode===tabs[2] && <Compatibility a={a} b={b} partner={partner} setPartner={setPartner}/>}
      {a>0 && mode===tabs[3] && <><label>Дата прогноза<input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>
        {d===0 && <p>Для дня Джокера расклад не определён.</p>}
        {forecast && <><h2>Прогноз на {prettyDate(Date.parse(day+'T00:00:00Z'))}</h2><p>Карта дня · {compactCard(d)}<br/>Твоя карта · {compactCard(a)}</p>
          <Position title="Поле событий" card={forecast.field}>Тема, которую проще заметить в повседневных делах.</Position>
          <Position title="Урок дня" card={forecast.second}>Так может проявиться ситуация, требующая внимания.</Position>
          <Position title="Бонус" card={forecast.first}>В этом сюжете можно найти поддержку.</Position></>}</>}
    </section>}</section>;
}
