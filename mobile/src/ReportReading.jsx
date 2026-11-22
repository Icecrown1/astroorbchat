import { useState } from 'react';
import { onlineRequest } from './onlineApi';
import { playInternal } from './playInternal';

// For interpretations without a stable server reading ID the user confirms
// the displayed excerpt that will be attached to their sandbox report.
export function ReportExcerpt({ token, kind, text }) {
  if (!playInternal || !text) return null;
  const excerpt = (typeof text === 'string' ? text : JSON.stringify(text)).slice(0, 3000);
  return <ExcerptForm key={excerpt} {...{ token, kind, excerpt }} />;
}

function ExcerptForm({ token, kind, excerpt }) {
  const [status, setStatus] = useState('ready');
  if (status === 'received') return <p role="status">Жалоба принята.</p>;
  if (status === 'ready') return <button type="button" className="secondary-button" onClick={() => setStatus('confirm')}>Пожаловаться на ответ</button>;
  async function send() {
    setStatus('sending');
    try {
      await onlineRequest('/api/mobile/reading-feedback', { token, data: { kind, excerpt } });
      setStatus('received');
    } catch { setStatus('failed'); }
  }
  return <section aria-label="Жалоба на ответ"><p>Этот фрагмент получит поддержка AstroOrbi.</p>
    <blockquote style={{overflowWrap:'anywhere'}}>{excerpt}</blockquote>
    {token ? <button type="button" disabled={status === 'sending'} onClick={send}>Отправить жалобу</button> :
      <a href={'mailto:Icecrown@astroorbi.com?subject=AstroOrbi%20Android&body=' + encodeURIComponent(excerpt)}>Отправить в поддержку по почте</a>}
    <button type="button" disabled={status === 'sending'} onClick={() => setStatus('ready')}>Отмена</button>
    {status === 'failed' && <p role="alert">Жалоба не доставлена. Попробуйте снова.</p>}
  </section>;
}

export function ReportReading({ token, kind, reading }) {
  const [state, setState] = useState('ready');
  if (!playInternal || !token) return null;
  async function report() {
    setState('sending');
    try {
      let id = reading.id;
      if (!id && kind === 'oracle') {
        const history = await onlineRequest('/api/astrology/ask/history?limit=20', { token });
        id = history.find(item => item.answer === reading.answer && item.question === reading.question)?.id;
      }
      if (!id) throw Error();
      await onlineRequest('/api/mobile/content-reports', { token, data: { kind, id } });
      setState('received');
    } catch { setState('failed'); }
  }
  if (state === 'received') return <p role="status">Жалоба на этот ответ принята.</p>;
  return <div><button type="button" className="secondary-button" disabled={state === 'sending'} onClick={report}>
    Пожаловаться на ответ</button>{state === 'failed' && <p role="alert">Не удалось отправить жалобу. Попробуйте ещё раз.</p>}</div>;
}
