import { useEffect, useMemo, useState } from 'react';
import { ChartCanvas } from '../../client/src/components/ChartCanvas';
import { translatePlanet, translateSign } from '../../client/src/lib/astroTranslations';
import { onlineRequest } from './onlineApi';

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

function NatalWheel({ chart }) {
  const [selected, setSelected] = useState('Sun');
  const { data } = chart;
  const planets = useMemo(() => {
    const entries = Array.isArray(data.planets)
      ? data.planets
      : Object.entries(data.planets ?? {}).map(([name, values]) => ({ ...values, name }));
    return entries.map(planet => ({ ...planet, position: planet.position ?? planet.longitude }))
      .filter(planet => Number.isFinite(planet.position));
  }, [data.planets]);
  const current = planets.find(planet => planet.name === selected) ?? planets[0];

  if (!current) return <p>В этой карте пока нет положений планет.</p>;
  const interpretation = chart.professionalInterpretation?.ru;

  return <>
    <div className="natal-wheel">
      <ChartCanvas planets={planets} aspects={data.aspects ?? []} angles={data.angles}
        houses={data.houses} onPlanetClick={setSelected} />
    </div>
    <div className="planet-tabs" aria-label="Планеты">
      {planets.map(planet => (
        <button key={planet.name} type="button" aria-pressed={current.name === planet.name}
          onClick={() => setSelected(planet.name)}>{translatePlanet(planet.name, 'ru')}</button>
      ))}
    </div>
    <div className="profile-card" aria-live="polite">
      <h2>{translatePlanet(current.name, 'ru')}</h2>
      <p>{positionLabel(current)}</p>
    </div>
    {typeof interpretation === 'string' && interpretation.trim() && (
      <details className="natal-interpretation">
        <summary>Общий разбор карты</summary>
        <p>{interpretationText(interpretation)}</p>
      </details>
    )}
  </>;
}

export function Natal({ account, openAccount }) {
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
    if (token && profile && !busy && result === null && !error) load();
  }, [token, profile, busy, result, error]);

  return (
    <section className="tarot-screen">
      <h1>Натальная карта</h1>
      {!token ? <div className="profile-card">
        <p>Войди, чтобы открыть карту своего аккаунта.</p>
        <button type="button" onClick={openAccount}>Подключить профиль</button>
      </div> : <>
        {result?.chart?.data ? <>
          {profile && !profile.birthTime && <p>Время рождения не указано. Карта рассчитана на 12:00.</p>}
          <NatalWheel chart={result.chart} />
        </> : result ? <div className="profile-card">
          <p>{canBuild ? 'Построим карту по данным рождения из твоего профиля.' : 'Укажи дату и место рождения в настройках AstroOrbi в Telegram.'}</p>
          {canBuild && <button type="button" disabled={busy} onClick={() => load(true)}>{busy ? 'Строим карту…' : 'Построить карту'}</button>}
        </div> : busy ? <p role="status">Загружаем карту…</p> :
          <button type="button" onClick={() => profile ? load() : account.refresh()}>Загрузить карту</button>}
        {error && <p role="alert">{error}</p>}
      </>}
    </section>
  );
}
