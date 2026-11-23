import { useEffect, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { indexSource, readIndices } from '../../shared/campIndices';
import { compactCard, linkStory } from '../../shared/campReadings';
import { onlineRequest } from './onlineApi';

export function CampIndices({ a, b }) {
  const [scores, setScores] = useState(null);
  const [attempt, retry] = useState(0);
  const [failed, setFailed] = useState(false);
  const url = indexSource(a, b);
  useEffect(() => {
    let active = true;
    const key = 'camp-indices-v1:' + a + ':' + b;
    async function load() {
      setFailed(false);
      try {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
        const valid = data => Array.isArray(data) && data.length === 2 && data.every(row => ['attraction','tension','compatibility'].every(k => Number.isInteger(row?.[k]) && Math.abs(row[k])<=10));
        if (valid(saved?.scores) && Date.now()-saved.time < 7*86400000) { setScores(saved.scores); return; }
        let data;
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({ url, responseType:'text', connectTimeout:6000, readTimeout:8000, disableRedirects:true });
          if (response.status !== 200) throw new Error();
          data = readIndices(response.data);
        } else data = await onlineRequest('/api/camp/indices/'+a+'/'+b);
        if (!valid(data)) throw new Error();
        if (active) setScores(data);
        try { localStorage.setItem(key, JSON.stringify({time:Date.now(), scores:data})); } catch {}
      } catch { if (active) setFailed(true); }
    }
    load();
    return () => { active = false; };
  }, [a, b, url, attempt]);
  return <section className="camp-indices"><h3>Индексы отношений</h3>
    {scores ? <table><thead><tr><th>Индекс</th><th>Ты → партнёр<br/>{compactCard(a)} → {compactCard(b)}</th><th>Партнёр → ты<br/>{compactCard(b)} → {compactCard(a)}</th></tr></thead>
      <tbody>{[['attraction','Привлекательность'],['tension','Напряжённость'],['compatibility','Совместимость']].map(([key,label])=><tr key={key}><th>{label}</th>{scores.map((s,i)=><td key={i}>{s[key]}</td>)}</tr>)}</tbody></table> : failed ? <><p>Сейчас не удалось получить индексы.</p><button type="button" onClick={()=>retry(attempt+1)}>Повторить</button></> : <p role="status">Загружаем индексы пары…</p>}
    {scores?.map((row,i)=>row.links?.length>0 && <details key={i}><summary>{i ? 'Как партнёр воспринимает тебя' : 'Как ты воспринимаешь партнёра'} · планетарные связи</summary>{row.links.map((link,j)=><article key={j}><b>{link.planet} · {link.spiritual ? 'духовный расклад' : 'жизненный расклад'}</b><p>{linkStory(link,i===1)}</p></article>)}</details>)}
    <p>Привлекательность описывает интерес к человеку, напряжённость — силу трений, совместимость — лёгкость совместной жизни. Оценки могут различаться в двух направлениях.</p>
    <a href={url} target="_blank" rel="noreferrer">Расчёт Tragos для этих карт ↗</a>
  </section>;
}
