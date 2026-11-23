import { useRef, useState } from 'react';

type Result = { questions:string[], charged:number };
export function QuestionHelp({ available, onChoose, request, afterCharge }: {
  available:boolean, onChoose:(question:string)=>void, request:(situation:string)=>Promise<Result>, afterCharge:()=>unknown,
}) {
  const [situation,setSituation]=useState('');
  const [result,setResult]=useState<string[]>([]);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const lock=useRef(false);
  async function submit() {
    if(lock.current || !available || situation.trim().length<8) return;
    lock.current=true; setPending(true); setError('');
    try {
      const reply=await request(situation);
      setResult(reply.questions);
      void Promise.resolve(afterCharge()).catch(()=>{});
    } catch(e) {
      const code=e instanceof Error ? e.message : '';
      setError(/insufficient|недостаточно/i.test(code) ? 'Недостаточно звёзд.' : /in_progress/.test(code) ? 'Первый запрос ещё выполняется. Повтори через несколько секунд.' : 'Ответ пока недоступен. Повтори с тем же описанием — оно оплачивается один раз.');
    } finally { lock.current=false; setPending(false); }
  }
  return <details className="question-help"><summary>Помочь с вопросом · 1 ★</summary>
    {available ? <><label>Опиши ситуацию своими словами<textarea value={situation} disabled={pending} maxLength={1000} rows={3}
      onChange={e=>{setSituation(e.target.value); setResult([]); setError('');}}/></label>
      <p>Ты получишь три формулировки. Выбранный вопрос можно отредактировать перед раскладом.</p>
      {!result.length && <button type="button" disabled={pending || situation.trim().length<8} onClick={submit}>{pending?'Подбираем вопросы…':'Получить три вопроса за 1 ★'}</button>}
      {result.map(q=><button type="button" className="secondary-button" key={q} onClick={()=>onChoose(q)}>{q}</button>)}
      {error && <p role="alert">{error}</p>}</> : <p>Помощь с вопросом появится после подключения сервиса в этом профиле.</p>}</details>;
}
