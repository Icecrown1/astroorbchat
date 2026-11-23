import { CampCards } from './CampCards';
import { FriendsTarot } from './ReadingTools';
import { FeedbackSession } from './ReadingFeedback';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Frontispiece, IndexRow, NavIcon, PlateInk, plate } from './Editorial';
import editorialHero from './art/card-of-day.webp';
import { Tarot, History, useReadings } from './Tarot';
import { Account, AccountHistory, OnlineTarot, useAccount } from './Account';
import { PreviewRewards } from './RewardUnlock';
import { PreviewShop } from './PreviewShop';
import { authPilot, mechanics, playInternal, rewardsEnabled, playAds, playCatalog } from './playInternal';
import { MobileCardShop } from './MobileCardShop';
import { onlineRequest } from './onlineApi';
import { AdPreview } from './AdPreview';
import { CardViewer, CardViewerContext } from './CardViewer';
import { ProfileSettings } from './ProfileSettings';
import { Natal } from './Natal';
import { GuestNatal } from './GuestNatal';
import { ImportantDates } from './ImportantDates';
import { Forecasts } from './Forecasts';
import { Oracle, Solar } from './AnnualAndOracle';
import { Matrix } from './Matrix';
import './style.css';

const destinations = [['home', 'Главная'], ['tools', 'Инструменты'], ['account', 'Профиль']];
const tools = [
  ['tarot', 'Таро', 'Карта дня и расклады', 'hand'],
  ['compatibility', 'Совместимость', 'Разбор отношений по данным рождения', 'couple'],
  ['oracle', 'Оракул', 'Ответ на твой вопрос', 'owl'],
  ['natal', 'Натальная карта', 'Планеты и дома в момент рождения', 'sun'],
  ['matrix', 'Матрица судьбы', 'Арканы по дате рождения', 'matrix'],
  ['pair', 'Матрица пары', 'Сильные стороны и задачи союза', 'rings'],
  ['horoscope', 'Гороскоп', 'Прогноз на день, неделю или месяц', 'lion'],
  ['dates', 'Важные даты', 'События личного календаря', 'glass'],
  ['solar', 'Соляр', 'Личный прогноз на год', 'sphere'],
  ['camp', 'Карты Кэмпа', 'Карта рождения', 'hand'],
  ['guest-natal', 'Карты близких', 'Натальные карты семьи и друзей', 'portrait'],
];
const featured = [...tools.slice(1), tools[0]];
function visitStamp(id) {
  return ['tarot','horoscope'].includes(id) ? new Date().toLocaleDateString('sv-SE') : 'seen';
}
function hasVisited(id) {
  try { return localStorage.getItem('orbi.visit.'+id) === visitStamp(id); } catch { return false; }
}

function Home({ navigate, online, hasDaily }) {
  return <div className="home">
    {mechanics && <p>Тест механик · профиль на устройстве, примеры ИИ-ответов и покупок</p>}
    <section className={'daily-cover' + (hasVisited('tarot') ? '' : ' unvisited')} style={{ backgroundImage: `url(${editorialHero})` }}>
      <h1>Карта<br />дня</h1>
      <button type="button" onClick={() => navigate('tarot', 'daily', online ? 'online' : 'offline')}>
        {hasDaily && !online ? 'Посмотреть карту' : 'Открыть бесплатно'} <span aria-hidden="true">→</span>
      </button>
    </section>
    <div className="tool-carousel" aria-label="Инструменты">{featured.map(([id, name, , art]) =>
      <button key={id} type="button" className={'cover-tile tile-' + art + (hasVisited(id) ? '' : ' unvisited')} onClick={() => navigate(id)}>
        <img src={plate(art)} alt="" /><strong>{name}</strong>
      </button>)}</div>
    <button className="catalog-link" type="button" onClick={() => navigate('tools')}>Все инструменты <span aria-hidden="true">→</span></button>
  </div>;
}

function Tools({ navigate }) {
  return <section className="tarot-screen">
    <Frontispiece title="Инструменты" art="sphere" />
    <div className="illustrated-index">{tools.map(([id, name, description, art]) =>
      <IndexRow key={id} title={name} description={description} art={art} onClick={() => navigate(id)} />)}</div>
    <IndexRow title="История раскладов" art="books" onClick={() => navigate('history')} />
  </section>;
}

function Stars({ account, openAccount }) {
  const profile = account.profile;
  return <section className="tarot-screen">
    <Frontispiece title={<>Звёзды и<br />подписка</>} art="sphere" scene />
    <section className="ledger"><h2>Баланс</h2>
      {profile?.orbs != null && <strong className="balance-number">{Number(profile.orbs).toLocaleString('ru-RU')} ✶</strong>}
      <p>Звёзды тратятся на разборы. На кнопке каждого платного разбора указана его стоимость.</p>
      {!profile && <button type="button" onClick={openAccount}>Открыть профиль</button>}
    </section>
    <section className="ledger"><h2>Бесплатно</h2><p>Карта дня, базовая натальная карта и матрица по дате рождения.</p></section>
    <section className="ledger"><h2>Что даёт подписка</h2>
      <dl><div><dt>Standard</dt><dd>+250 ★ в месяц</dd></div><div><dt>Premium</dt><dd>+550 ★ в месяц и соляр</dd></div></dl>
      <p>Одна покупка даёт доступ на месяц. Автопродления нет.</p>
      {mechanics ? (profile ? <PreviewShop account={account} /> : <button onClick={openAccount}>Войти в тестовый магазин</button>) : playInternal ? <MobileCardShop key={profile?.id} account={account} /> : import.meta.env.MODE === 'ad-preview' ? <PreviewShop key={profile?.id ?? 'guest'} /> :
        <p>Управлять подпиской можно в AstroOrbi в Telegram.</p>}
    </section>
  </section>;
}

function App() {
  const [route, setRoute] = useState({ screen: 'home', depth: 0 });
  const [viewer, setViewer] = useState(null);
  const [tarotMode, setTarotMode] = useState('daily');
  const [tarotSource, setTarotSource] = useState(null);
  const { screen, depth } = route;
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const readings = useReadings();
  const account = useAccount();
  const accessTier = account.profile?.tier ?? account.profile?.billingTier;
  const adEligible = rewardsEnabled && (account.token === null || accessTier === 'free');
  const [testAds, setTestAds] = useState(false);
  useEffect(() => {
    if (!playInternal) return;
    let generation = 0;
    async function refresh() {
      if (document.hidden) return;
      const current = ++generation;
      try {
        const config = await onlineRequest('/api/mobile/config?build=7');
        if (generation === current) setTestAds(config.testAds === true);
      } catch { if (generation === current) setTestAds(false); }
    }
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => { generation++; document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const source = tarotSource ?? (account.token ? 'online' : 'offline');
  const [adType, setAdType] = useState(null);
  const previousScreen = useRef(screen);
  const readingCompleted = useRef(false);
  const lastAd = useRef(Number(sessionStorage.getItem('astroorbi.last-test-ad')) || 0);
  const grantReward = useRef(null);

  const nativeAdPending = useRef(false);
  const rewardOwner = useRef(null);
  rewardOwner.current = adEligible ? (account.profile?.id ?? 'guest') : null;
  const rewardScreen = useRef(0);
  useLayoutEffect(() => { rewardScreen.current++; }, [route, viewer, tarotMode, tarotSource, adEligible, testAds, account.profile?.id]);

  useEffect(() => {
    if (mechanics || !playInternal || !adEligible || !testAds) return;
    function prepare() {
      if (!document.hidden) playAds.prepare().catch(() => {});
    }
    prepare();
    window.addEventListener('online', prepare);
    document.addEventListener('visibilitychange', prepare);
    return () => {
      window.removeEventListener('online', prepare);
      document.removeEventListener('visibilitychange', prepare);
    };
  }, [adEligible, testAds]);

  async function showAd(type, onEarn, title, remaining = 0, button) {
    if (!adEligible || window.history.state?.adOverlay) return;
    if (playInternal && !mechanics) {
      if (!testAds) return;
      if (nativeAdPending.current) {
        if (type === 'rewarded') throw Object.assign(new Error(), { code: 'AD_BUSY' });
        return;
      }
      nativeAdPending.current = true;
      const owner = rewardOwner.current;
      const requestedScreen = rewardScreen.current;
      try {
        if (type === 'rewarded') {
          await playAds.loadReward();
          if (document.hidden || requestedScreen !== rewardScreen.current ||
              owner !== rewardOwner.current || !button?.isConnected || !button.getClientRects().length) return;
        }
        const { earned } = await playAds.show({ type });
        lastAd.current = Date.now();
        sessionStorage.setItem('astroorbi.last-test-ad', String(lastAd.current));
        if (earned && owner !== null && owner === rewardOwner.current) onEarn?.();
      } catch (error) {
        if (type === 'rewarded' && requestedScreen === rewardScreen.current) throw error;
      } finally {
        nativeAdPending.current = false;
      }
      return;
    }
    grantReward.current = onEarn ?? null;
    lastAd.current = Date.now();
    const current = window.history.state;
    const returnRoute = current.screen === 'tarot' ? { ...current, tarotMode, tarotSource } : current;
    window.history.replaceState(returnRoute, '');
    window.history.pushState({ ...returnRoute, adOverlay: true }, '');
    setAdType({ type, title, remaining });
  }

  // Show an interstitial only on leaving a completed reading, including Android Back.
  useLayoutEffect(() => {
    const leftTarot = previousScreen.current === 'tarot' && screen !== 'tarot';
    previousScreen.current = screen;
    if (!leftTarot) return;
    if (readingCompleted.current && screen !== 'stars' && screen !== 'settings' && Date.now() - lastAd.current >= 120_000) {
      showAd('interstitial');
    }
    readingCompleted.current = false;
  }, [screen, adEligible]);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    if (!playInternal) return;
    let active = true;
    function returned() {
      if (active && window.history.state?.screen !== 'stars') navigateRef.current('stars');
    }
    const listener = playCatalog.addListener('paymentReturn', returned).catch(() => null);
    playCatalog.consumeReturn().then(result => { if (result.returning) returned(); }).catch(() => {});
    return () => { active = false; listener.then(handle => handle?.remove()).catch(() => {}); };
  }, []);

  function onReadingComplete() {
    if (adEligible && window.history.state?.screen === 'tarot') readingCompleted.current = true;
  }

  const paid = ['standard', 'premium', 'pro'].includes(accessTier);
  const rewards = (adEligible || (playInternal && paid)) ? { owner: account.profile?.id ?? 'guest', paid,
    adFree: playInternal && (paid || !testAds),
    watch: (title, remaining, credit, button) => showAd('rewarded', credit, title, remaining, button) } : null;
  const openAccount = () => navigate('account');
  const openHistory = () => navigate('history');
  const openSettings = () => navigate('settings');
  const openNatal = () => navigate('natal');
  const openGuests = () => navigate('guest-natal');
  const openDates = () => navigate('dates');
  const profileKey = JSON.stringify([Boolean(account.token), account.profile?.id, account.profile?.birthdayDate,
    account.profile?.birthTime, account.profile?.birthPlace]);

  useEffect(() => {
    window.history.replaceState({ astroOrbi: true, screen: 'home', depth: 0 }, '');
    function restore(event) {
      if (!event.state?.astroOrbi) return;
      const { viewer: restoredViewer, adOverlay, ...destination } = event.state;
      // A cancelled or finished reward cannot replay through browser Forward.
      if (adOverlay) window.history.replaceState(destination, '');
      grantReward.current = null;
      setAdType(null);
      setViewer(restoredViewer ?? null);
      setRoute(destination);
      if (event.state.tarotMode) setTarotMode(event.state.tarotMode);
      setTarotSource(event.state.tarotSource ?? null);
    }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  function openCards(cards, index) {
    const current = { ...route, astroOrbi: true, tarotMode, tarotSource };
    const nextViewer = { cards, index };
    window.history.replaceState(current, '');
    window.history.pushState({ ...current, viewer: nextViewer }, '');
    setViewer(nextViewer);
  }

  function navigate(next, mode, requestedSource) {
    if (tools.some(([id])=>id===next)) {
      try { localStorage.setItem('orbi.visit.'+next,visitStamp(next)); } catch {}
    }
    if (mode) setTarotMode(mode);
    if (requestedSource) setTarotSource(requestedSource);
    if (next === screen) return;
    window.history.replaceState({ ...route, astroOrbi: true, tarotMode, tarotSource }, '');
    const destination = {
      astroOrbi: true, screen: next, depth: depth + 1,
      tarotMode: mode ?? tarotMode, tarotSource: requestedSource ?? tarotSource,
    };
    window.history.pushState(destination, '');
    setRoute(destination);
    window.scrollTo(0, 0);
  }

  return (
    <FeedbackSession.Provider value={account}><CardViewerContext.Provider value={openCards}><PreviewRewards.Provider value={rewards}><div className="page" data-screen={screen}>
      <PlateInk />
      <header className="app-header">
        {depth > 0 && !destinations.some(([id]) => id === screen) && <button type="button" className="back-button" aria-label="Назад"
          disabled={screen === 'settings' && account.busy} onClick={() => window.history.back()}>←</button>}
        <span className="editorial-wordmark">Astro<b>Orbi</b><i aria-hidden="true">✶</i></span>
        <button className="star-balance" type="button" onClick={() => navigate('stars')} aria-label="Звёзды и подписка">
          <span aria-hidden="true">✦</span> {account.profile?.orbs != null ? Number(account.profile.orbs).toLocaleString('ru-RU') : 'Звёзды'}
        </button>
      </header>
      {offline && <p className="offline-notice" role="status">Сейчас офлайн. Таро и расчёт матрицы по дате доступны.</p>}
      {authPilot && screen==='home' && !account.token && <button className="secondary-button" onClick={openAccount}>Войти по почте или коду Mini App</button>}
      {screen === 'home' && <Home navigate={navigate} online={Boolean(account.token)} hasDaily={readings.hasDaily} />}
      {screen === 'tools' && <Tools navigate={navigate} />}
      {screen === 'camp' && <CampCards/>}
      {screen === 'stars' && <Stars account={account} openAccount={openAccount} />}
      {screen === 'tarot' && <section className="tarot-screen">
        <Frontispiece title="Таро" art="hand" />
        <div className="mode-switch" aria-label="Вариант расклада">
          <button type="button" aria-pressed={source === 'online'} onClick={() => setTarotSource('online')}>С ИИ</button>
          <button type="button" aria-pressed={source === 'offline'} onClick={() => setTarotSource('offline')}>Офлайн</button>
        </div>
        <button className="secondary-button" aria-pressed={source==='friends'} onClick={()=>setTarotSource('friends')}>Разложить другому</button>
        {source === 'friends' ? <FriendsTarot account={account} openAccount={openAccount}/> : source === 'online'
          ? <OnlineTarot onReadingComplete={onReadingComplete} account={account} openAccount={openAccount} openHistory={openHistory} initialSpread={tarotMode} />
          : <Tarot onReadingComplete={onReadingComplete} readings={readings} mode={tarotMode} setMode={setTarotMode} />}
      </section>}
      <div key={'natal' + profileKey} hidden={screen !== 'natal'}>
        <Natal active={screen === 'natal'} account={account} openAccount={openAccount} openSettings={openSettings}
          openGuests={openGuests} openDates={openDates} />
      </div>
      <div key={'guests' + profileKey} hidden={screen !== 'guest-natal'}>
        {account.token || screen === 'guest-natal' ? <GuestNatal account={account} openAccount={openAccount} /> : null}
      </div>
      <div key={'dates' + profileKey} hidden={screen !== 'dates'}>
        {account.token || screen === 'dates' ? <ImportantDates account={account} openAccount={openAccount} openNatal={openNatal} /> : null}
      </div>
      {['horoscope', 'compatibility'].map(kind => (
        <div key={kind + profileKey} hidden={screen !== kind}>
          <Forecasts active={screen === kind} kind={kind} account={account} openAccount={openAccount} openNatal={openNatal} openSettings={openSettings} />
        </div>
      ))}
      <div key={'solar' + profileKey} hidden={screen !== 'solar'}>
        <Solar account={account} openAccount={openAccount} openNatal={openNatal} openSettings={openSettings} />
      </div>
      <div key={'oracle' + profileKey} hidden={screen !== 'oracle'}>
        <Oracle account={account} openAccount={openAccount} openNatal={openNatal} />
      </div>
      <div hidden={!['matrix', 'pair'].includes(screen)}><Matrix key={profileKey + (screen === 'pair' ? 'pair' : 'matrix')} initialMode={screen === 'pair' ? 'pair' : null} account={account} openAccount={openAccount} /></div>
      {screen === 'history' && <section className="tarot-screen">
        <Frontispiece title="История раскладов" art="books" />
        <AccountHistory account={account} />
        <History entries={readings.entries} openTarot={() => navigate('tarot')} />
      </section>}
      {(screen === 'account' || (screen === 'settings' && !account.profile)) &&
        <Account account={account} openHistory={openHistory} openSettings={openSettings}
          openStars={() => navigate('stars')} openOffline={() => navigate('tarot', 'daily', 'offline')} />}
      {screen === 'settings' && account.profile &&
        <ProfileSettings key={account.profile.id} account={account} openAccount={openAccount} openNatal={openNatal} />}
      <nav className="app-nav" aria-label="Разделы AstroOrbi">
        {destinations.map(([id, name]) => (
          <button key={id} type="button" disabled={screen === 'settings' && account.busy} aria-current={id === (['settings','stars','history'].includes(screen) ? 'account' : screen === 'home' || screen === 'account' ? screen : 'tools') ? 'page' : undefined} onClick={() => navigate(id)}>
            <NavIcon name={id} /><span className="nav-label">{name}</span>
          </button>
        ))}
      </nav>
      {adType && adEligible && <AdPreview rewarded={adType.type === 'rewarded'}
        rewardName={adType.title} remaining={adType.remaining} onEarn={grantReward.current} onDismiss={() => window.history.back()} />}
      {viewer && <CardViewer viewer={viewer} onDismiss={() => window.history.back()} />}
    </div></PreviewRewards.Provider></CardViewerContext.Provider></FeedbackSession.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
