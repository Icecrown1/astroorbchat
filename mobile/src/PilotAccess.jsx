import {useState} from 'react';
import {onlineRequest,apiOrigin} from './onlineApi';

export function PilotAccess({account,openGuest,linking=false}){
  const [mode,setMode]=useState(linking?'closed':'email');
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [challenge,setChallenge]=useState('');
  const [birthday,setBirthday]=useState('');
  const [notice,setNotice]=useState('');
  const {busy,run,token}=account;
  function choose(next){setMode(next);setCode('');setChallenge('');setNotice('');}
  function submit(event){
    event.preventDefault();
    run(async()=>{
      setNotice('');
      if(mode==='mini'){
        const session=await onlineRequest('/api/mobile/pilot/exchange',{data:{code:code.trim()}});
        await account.acceptSession(session.token);
      }else if(!challenge){
        const sent=await onlineRequest('/api/mobile/pilot/email/start',{token,data:{email}});
        setChallenge(sent.challenge);setCode('');setNotice('Введите шестизначный код. Он действует пять минут.');
      }else{
        const result=await onlineRequest('/api/mobile/pilot/email/verify',{token,data:{challenge,code:code.trim(),birthday}});
        if(linking){choose('closed');setNotice('Почта привязана. Теперь можно входить в этот профиль по почте.');}
        else await account.acceptSession(result.token);
      }
    });
  }
  if(linking && mode==='closed')return <section className="profile-card"><button disabled={busy} onClick={()=>choose('email')}>Привязать почту</button>{notice && <p role="status">{notice}</p>}</section>;
  return <section className="profile-card"><h2>{linking?'Привязать почту':'Вход в Android-песочницу'}</h2>
    {!linking && <div className="mode-switch"><button disabled={busy} aria-pressed={mode==='email'} onClick={()=>choose('email')}>По почте</button>
      <button disabled={busy} aria-pressed={mode==='mini'} onClick={()=>choose('mini')}>Код из Mini App</button></div>}
    <form onSubmit={submit} className="online-spread">
      {mode==='email' && <label>Электронная почта<input type="email" value={email} required disabled={busy||Boolean(challenge)} onChange={e=>setEmail(e.target.value)}/></label>}
      {(mode==='mini'||challenge) && <label>{mode==='mini'?'Код тестовой Mini App':'Код из письма'}<input value={code} required autoComplete="one-time-code" inputMode={mode==='mini'?'text':'numeric'} pattern={mode==='mini'?'[A-Za-z0-9_\\-]{22}':'[0-9]{6}'} onChange={e=>setCode(e.target.value)}/></label>}
      {challenge && !linking && <label>Дата рождения для нового профиля<input value={birthday} type="date" onChange={e=>setBirthday(e.target.value)}/></label>}
      <button disabled={busy}>{mode==='mini'?'Войти':challenge?'Подтвердить код':'Получить письмо'}</button>
    </form>
    {notice && <p role="status">{notice}</p>}
    {challenge && <button disabled={busy} onClick={()=>choose('email')}>Запросить другой код</button>}
    <a href={new URL('/mobile/auth-pilot',apiOrigin).href} target="_blank" rel="noreferrer">Открыть тестовую Mini App и почтовый ящик</a>
    {!linking && <button className="secondary-button" onClick={openGuest}>Продолжить без входа</button>}
  </section>;
}
