import { useEffect, useMemo, useState } from 'react';
import { SkyDial, planetGlyph } from './SkyDial';
import { Frontispiece } from './Editorial';
import { translatePlanet, translateSign } from '../../client/src/lib/astroTranslations';
import { onlineRequest } from './onlineApi';
import { ReadingText } from './ReadingText';
import { ChartViewport } from './ChartViewport';
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

export function NatalWheel({ chart, account, guest = false }) {
  const [selected, setSelected] = useState('Sun');
  const [view, setView] = useState('planets');
  const [houseNumber, setHouseNumber] = useState(1);
  const { data } = chart;
  const cusps = data.houses?.cusps;
  const validHouses = Array.isArray(cusps) && cusps.length === 12 && cusps.every(
    number => Number.isFinite(number) && number >= 0 && number < 360,
  );

  function selectPlanet(name) {
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
  const current = planets.find(planet => planet.name === selected) ?? planets[0];

  if (!current) return <p>В этой карте пока нет положений планет.</p>;
  const interpretation = guest ? data.interpretation : chart.professionalInterpretation?.ru;
  const currentHouse = validHouses ? planetHouse(current.position, cusps) : null;
  const cusp = validHouses ? cusps[houseNumber - 1] : null;
  const members = validHouses ? planets.filter(planet => planetHouse(planet.position, cusps) === houseNumber) : [];

  return <>
    <ChartViewport className="natal-wheel" label="Колесо натальной карты">
      <SkyDial planets={planets} aspects={data.aspects} angles={data.angles}
        cusps={validHouses ? cusps : null} selected={current.name} house={view === 'houses' ? houseNumber : null} onSelect={selectPlanet} />
    </ChartViewport>
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
          {members.length === 0 && <p>В этом доме нет планет.</p>}
        </div>
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
  </>;
}

export function Natal({ account, openAccount, openSettings, openGuests, openDates, active }) {
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
