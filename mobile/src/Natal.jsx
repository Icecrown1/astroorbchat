import { houseTopics, retrogradeText } from '../../shared/natalLanguage';
import { natalAspects } from '../../shared/readingThemes';
import { ReadingFeedback } from './ReadingFeedback';
import { rewardsEnabled } from './playInternal';
import { useContext, useEffect, useMemo, useState } from 'react';
import { SkyDial, planetGlyph } from './SkyDial';
import { Frontispiece } from './Editorial';
import { translatePlanet, translateSign } from '../../client/src/lib/astroTranslations';
import { onlineRequest } from './onlineApi';
import { ReadingText } from './ReadingText';
import { ChartViewport } from './ChartViewport';
import { PreviewRewards } from './RewardUnlock';
import { RewardPlanet, RewardHouse } from './RewardReadings';
import { NatalReadings } from './NatalReadings';

function positionLabel(placement) {
  const sign = placement.sign ? translateSign(placement.sign, 'ru') : '';
  const degrees = placement.degree_in_sign;
  return [sign, Number.isFinite(degrees) ? `${degrees.toFixed(1)}°` : ''].filter(Boolean).join(' · ');
}

function interpretationText(interpretation) {
  const template = document.createElement('template');
  template.innerHTML = interpretation.replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, '\n');
  template.content.querySelectorAll('script,style').forEach(node => node.remove());
  return template.content.textContent;
}

const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

function planetHouse(position, cusps) {
  const index = cusps.findIndex((start, i) => {
    const end = cusps[(i + 1) % cusps.length];
    return start > end ? position >= start || position < end : position >= start && position < end;
  });
  return index === -1 ? null : index + 1;
}

export function NatalWheel({ chart, account, guest = false, example = false }) {
  const [aspectKey,setAspectKey] = useState('');
  const [selected, setSelected] = useState('Sun');
  const [view, setView] = useState('planets');
  const [houseNumber, setHouseNumber] = useState(1);
  const { data } = chart;
  const cusps = data.houses?.cusps;
  const validHouses = Array.isArray(cusps) && cusps.length === 12 && cusps.every(
    number => Number.isFinite(number) && number >= 0 && number < 360,
  );

  function selectPlanet(name) {
    setAspectKey('');
    setSelected(name);
    setView('planets');
  }
  const planets = useMemo(() => {
    const entries = Array.isArray(data.planets)
      ? data.planets
      : Object.entries(data.planets ?? {}).map(([name, values]) => ({ ...values, name }));
    return entries.map(planet => ({ ...planet, position: planet.position ?? planet.longitude }))
      .filter(planet => Number.isFinite(planet.position));
  }, [data.planets]);
  const aspects = useMemo(()=>natalAspects(planets),[planets]);
  const current = planets.find(planet => planet.name === selected) ?? planets[0];

  const picked=aspects.find(a=>a.planet1+'-'+a.planet2===aspectKey);
  function selectAspect(a) {setAspectKey(a.planet1+'-'+a.planet2);setView('planets');}
  if (!current) return <p>В этой карте пока нет положений планет.</p>;
  const interpretation = guest ? data.interpretation : chart.professionalInterpretation?.ru;
  const currentHouse = validHouses ? planetHouse(current.position, cusps) : null;
  const cusp = validHouses ? cusps[houseNumber - 1] : null;
  const members = validHouses ? planets.filter(planet => planetHouse(planet.position, cusps) === houseNumber) : [];

  return <>
    <ChartViewport className="natal-wheel" label="Колесо натальной карты">
      <SkyDial planets={planets} aspects={aspects} angles={data.angles}
        onAspect={selectAspect} picked={aspectKey} cusps={validHouses ? cusps : null} selected={current.name} house={view === 'houses' ? houseNumber : null} onSelect={selectPlanet} />
    </ChartViewport>
    {picked && <article className="ledger" aria-live="polite"><h3>{picked.glyph} {picked.ru} · {translatePlanet(picked.planet1,'ru')} и {translatePlanet(picked.planet2,'ru')}</h3>
      <small>Угол аспекта {picked.angle}° · отклонение {picked.orb.toFixed(1)}°</small><p>{picked.text}</p></article>}
    {validHouses && <div className="mode-switch" role="group" aria-label="Разделы натальной карты">
      <button type="button" aria-pressed={view === 'planets'} onClick={() => setView('planets')}>Планеты</button>
      <button type="button" aria-pressed={view === 'houses'} onClick={() => setView('houses')}>Дома</button>
    </div>}
    <div hidden={view !== 'planets'}>
      <div className="tarot-screen">
        <div className="celestial-object">
          <div className="object-selector">
            <span className="object-seal" aria-hidden="true">{planetGlyph[current.name] || '✶'}︎</span>
            <div><label>Планета<select aria-label="Выбрать планету" value={current.name} onChange={e => selectPlanet(e.target.value)}>
              {planets.map(p => <option key={p.name} value={p.name}>{translatePlanet(p.name, 'ru')}</option>)}
            </select></label>
            <p aria-live="polite">{[positionLabel(current), currentHouse && `${currentHouse}-й дом`].filter(Boolean).join(' · ')}</p></div>
          </div>
          {current.retrograde === true && <p>℞ Ретроградное движение. {retrogradeText(current.name)}</p>}
          <details><summary>Аспекты выбранной планеты</summary><small>Основные углы, допуск до 6°</small>
            {aspects.filter(a=>a.planet1===current.name || a.planet2===current.name).map(a=><p key={a.planet1+a.planet2}><b>{a.glyph} {a.ru}</b> · {translatePlanet(a.planet1===current.name?a.planet2:a.planet1,'ru')} · орбис {a.orb.toFixed(1)}°. {a.text}</p>)}
            {!aspects.some(a=>a.planet1===current.name || a.planet2===current.name) && <p>В пределах этого допуска основных аспектов нет.</p>}
          </details>
          {rewardsEnabled && (!guest || example) && <RewardPlanet planet={current}
            position={positionLabel(current)} house={currentHouse} example={example} />}
          {!guest && <NatalReadings planet={current.name} houseNumber={currentHouse} account={account} savedHouses={chart.houseInfluences?.ru} />}
        </div>
      </div>
    </div>
    {validHouses && view === 'houses' && <>
      <div className="celestial-object">
        <div className="object-selector">
          <span className="object-seal" aria-hidden="true">{houseNumber}</span>
          <div><label>Дом<select aria-label="Выбрать дом" value={houseNumber} onChange={e => setHouseNumber(Number(e.target.value))}>
            {cusps.map((_, i) => <option key={i} value={i + 1}>{i + 1}-й дом</option>)}
          </select></label><p>{positionLabel({ sign: zodiacSigns[Math.floor(cusp / 30)], degree_in_sign: cusp % 30 })}</p></div>
        </div>
        <div aria-live="polite">
          <p>Куспид — градус, с которого начинается {houseNumber}-й дом. Его тема — {houseTopics[houseNumber-1]}. Планета после этой границы попадает в этот дом до начала следующего. Точное время рождения важно, поскольку оно меняет положение границ.</p>
          {members.length === 0 && <p>В этом доме нет планет.</p>}
        </div>
        {rewardsEnabled && (!guest || example) && <RewardHouse number={houseNumber}
          cusp={cusp} members={members} example={example} />}
        {members.length > 0 && <div className="planet-tabs" role="group" aria-label="Разборы планет в этом доме">
          {members.map(planet => <button key={planet.name} type="button" onClick={() => selectPlanet(planet.name)}>
            {translatePlanet(planet.name, 'ru')}
          </button>)}
        </div>}
      </div>
    </>}
    {typeof interpretation === 'string' && interpretation.trim() && (
      <details className="natal-interpretation">
        <summary>Общий разбор карты</summary>
        <ReadingText text={interpretationText(interpretation)} />
      </details>
    )}
    <ReadingFeedback topic="natal"/>
  </>;
}

export function Natal({ account, openAccount, openSettings, openGuests, openDates, active }) {
  const canPreview = useContext(PreviewRewards);
  const { token, profile, run, busy, error } = account;
  const [result, setResult] = useState(null);
  const canBuild = Boolean(profile?.birthPlace && profile?.birthdayDate);

  function load(create = false) {
    run(async () => {
      if (create) {
        const chart = await onlineRequest('/api/natal/init', { token, data: {} });
        if (chart?.data) setResult({ chart });
      }
      try {
        const chart = await onlineRequest('/api/natal/me?locale=ru', { token });
        setResult({ chart });
      } catch (failure) {
        if (failure.code !== 'NATAL_NOT_INITIALIZED') throw failure;
        setResult({ chart: null });
      }
    });
  }

  useEffect(() => {
    if (active && token && canBuild && !busy && result === null && !error) load();
  }, [active, token, canBuild, busy, result, error]);

  return (
    <section className="tarot-screen">
      <Frontispiece title={<>Натальная<br />карта</>} art="moon" />
      {canPreview && (!token || (profile && !canBuild)) && <details className="natal-interpretation">
        <summary>Пример натальной карты</summary>
        <NatalWheel guest example chart={{ data: { planets: {
          Sun: { longitude: 70, sign: 'Gemini', degree_in_sign: 10 },
          Moon: { longitude: 149, sign: 'Leo', degree_in_sign: 29 },
          Venus: { longitude: 114, sign: 'Cancer', degree_in_sign: 24 },
        }, houses: { cusps: Array.from({ length: 12 }, (_, i) => i * 30) } } }} />
      </details>}
      {!token ? <div className="profile-card">
        <p>Войди, чтобы открыть карту своего аккаунта.</p>
        <button type="button" onClick={openAccount}>Подключить профиль</button>
      </div> : <>
        {profile && !canBuild ? <div className="profile-card">
          <p>Укажи дату и город рождения в настройках профиля.</p>
          <button type="button" disabled={busy} onClick={openSettings}>Настройки профиля</button>
        </div> : result?.chart?.data ? <>
          {profile && !profile.birthTime && <p>Время рождения не указано. Карта рассчитана на 12:00.</p>}
          <NatalWheel chart={result.chart} account={account} />
        </> : result ? <div className="profile-card">
          <p>Построим карту по данным рождения из твоего профиля.</p>
          <button type="button" disabled={busy} onClick={() => load(true)}>{busy ? 'Строим карту…' : 'Построить карту'}</button>
        </div> : busy ? <p role="status">Загружаем карту…</p> :
          <button type="button" onClick={() => profile ? load() : account.refresh()}>Загрузить карту</button>}
        <div className="mode-switch">
          <button type="button" onClick={openGuests}>Карты близких</button>
          {result?.chart?.data && canBuild && <button type="button" onClick={openDates}>Важные даты</button>}
        </div>
        {error && <p role="alert">{error}</p>}
      </>}
    </section>
  );
}
