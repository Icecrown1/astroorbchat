import { useState } from 'react';
import { onlineRequest } from './onlineApi';
import { playInternal } from './playInternal';

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
