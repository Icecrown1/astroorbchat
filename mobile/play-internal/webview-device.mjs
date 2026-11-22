// Android instrumentation of this app's debug WebView on a disposable emulator.
// Use Android for installation, system Back, deep links, screenshots and ad dismissal.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import assert from 'node:assert/strict';

const pkg='app.astroorbi.mobile', out='device-results', results={};
mkdirSync(out,{recursive:true});
const adb=(...args)=>execFileSync('adb',args,{timeout:60000,encoding:'utf8'}).trim();
const snap=name=>writeFileSync(join(out,name+'.png'),execFileSync('adb',['exec-out','screencap','-p'],{maxBuffer:16e6}));
function record(name,value) {
  results[name]=value;
  writeFileSync(join(out,'scenarios.json'),JSON.stringify(results,null,2));
  console.log(name,JSON.stringify(value));
}
let socket,seq=0;
const pending=new Map();
async function connect() {
  socket?.close();
  for(let i=0;i<50;i++) {
    try {
      const pid=adb('shell','pidof','-s',pkg);
      adb('forward','tcp:19227','localabstract:webview_devtools_remote_'+pid);
      const pages=await (await fetch('http://localhost:19227/json/list')).json();
      const page=pages.find(p=>p.type==='page' && /localhost/.test(p.url));
      if(!page) throw Error('WebView warming up');
      const sock=new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve,reject)=>{sock.onopen=resolve;sock.onerror=reject;});
      socket=sock;
      sock.onmessage=e=>{const message=JSON.parse(e.data);pending.get(message.id)?.(message);};
      return;
    } catch { await pause(600); }
  }
  throw Error('Application WebView unavailable');
}
async function command(method,params) {
  const id=++seq;
  const reply=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('WebView response timeout'));},10000);
    pending.set(id,m=>{clearTimeout(timer);pending.delete(id);resolve(m);});
    socket.send(JSON.stringify({id,method,params}));
  });
  if(reply.error || reply.result?.exceptionDetails) throw Error('WebView evaluation failed');
  return reply.result;
}
const js=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
async function until(fn,label,ms=15000) {
  const end=Date.now()+ms;
  do { if(await fn())return; await pause(250); } while(Date.now()<end);
  throw Error(label);
}
const visible="el=>el.getClientRects().length && !el.disabled";
const buttons=`[...document.querySelectorAll('button')].filter(${visible})`;
async function tap(expression) {
  let point;
  await until(async()=>{point=await js(`(()=>{const e=${expression};if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);return point;},'tap target');
  await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await pause(300);
}
const click=text=>tap(`${buttons}.find(b=>b.innerText.trim()===${JSON.stringify(text)} || b.getAttribute('aria-label')===${JSON.stringify(text)})`);
const selector=async q=>until(()=>js(`[...document.querySelectorAll(${JSON.stringify(q)})].some(${visible})`),'visible '+q);
const clickSel=q=>tap(`[...document.querySelectorAll(${JSON.stringify(q)})].find(${visible})`);
const foreground=()=>adb('shell','dumpsys','activity','activities').split('\n').find(line=>line.includes('topResumedActivity=')) || '';
async function closeTestAd() {
  if(!foreground().includes('AdActivity')) return;
  adb('shell','uiautomator','dump','/sdcard/astro-ad-window.xml');
  const xml=adb('shell','cat','/sdcard/astro-ad-window.xml');
  const close=xml.match(/<node\b[^>]*(?:content-desc="(?:Close|Close ad|Dismiss|Закрыть)"|resource-id="[^"]*[:/]close_button")[^>]*>/i)?.[0];
  const bounds=close?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if(bounds) {
    adb('shell','input','tap',String(Math.floor((+bounds[1]+ +bounds[3])/2)),String(Math.floor((+bounds[2]+ +bounds[4])/2)));
  } else if(foreground().includes('AdActivity')) adb('shell','input','keyevent','4');
}
const page=async s=>selector('.page[data-screen="'+s+'"]');
const launch=()=>adb('shell','am','start','-W','-n',adb('shell','cmd','package','resolve-activity','--brief',pkg).split('\n').at(-1));
async function step(name,fn) {
  try { await fn();record(name,'pass'); }
  catch(e) {
    const foreground=adb('shell','dumpsys','activity','activities').split('\n').find(v=>v.includes('topResumedActivity=')) || '';
    record(name,(e.message+' '+foreground.trim()).slice(0,220));
  }
  try {snap(name);} catch {}
}
const pick=async (screen,title)=>{await click('Инструменты');await page('tools');
  await tap(`[...document.querySelectorAll('.illustrated-index button')].find(b=>b.innerText.split('\\n')[0].trim()===${JSON.stringify(title)} || b.innerText.startsWith(${JSON.stringify(title)}))`);
  await page(screen);};
const readout=async()=>js('document.body.innerText');
try {
  adb('shell','input','keyevent','KEYCODE_WAKEUP');adb('shell','wm','dismiss-keyguard');
  adb('shell','settings','put','system','screen_off_timeout','1800000');
  record('pageBytes',Number(adb('shell','getconf','PAGE_SIZE')));
  adb('install',join(process.env.RUNNER_TEMP,'candidate-6.apk'));launch();await connect();
  await step('v6-first-draw',async()=>{
    for(const label of ['Открыть бесплатно →','Вытянуть карту дня']) {
      const button=`${buttons}.find(b=>b.innerText.trim()===${JSON.stringify(label)})`;
      await until(()=>js(`Boolean(${button})`),'baseline button '+label);
      await js(`${button}.click()`);
    }
    await selector('.one-card button');
  });
  adb('install','-r',join(process.env.RUNNER_TEMP,'candidate-7.apk'));launch();await connect();
  await step('upgrade',async()=>{await page('home');assert.match(await readout(),/Посмотреть карту/);});
  await step('home-small-font130',async()=>{
    adb('shell','wm','size','720x1280');adb('shell','wm','density','320');adb('shell','settings','put','system','font_scale','1.3');
    adb('shell','am','force-stop',pkg);launch();await connect();await page('home');
    assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));});
  await step('tarot-fullscreen',async()=>{await pick('tarot','Таро');await clickSel('.one-card button');await selector('dialog[open] img');snap('card-full-size');adb('shell','input','keyevent','4');await until(()=>js("!document.querySelector('dialog[open]')"),'close card with Back');await page('tarot');});
  await step('three-cards',async()=>{await click('Три карты');await click('Вытянуть три карты');await selector('.three-cards button');assert.equal(await js("document.querySelectorAll('.three-cards button').length"),3);});
  await step('rewarded-sdk',async()=>{
    await selector('.reward-unlock');await until(()=>js("Boolean(document.querySelector('.reward-unlock[aria-label]'))"),'test ads disabled or ad configuration unavailable',12000);
    let shown=false;
    for(let i=0;i<4 && !shown;i++) {
      await clickSel('.reward-unlock');await pause(2500);
      shown=/AdActivity/.test(adb('shell','dumpsys','activity','activities').split('\n').filter(s=>/ResumedActivity|topResumedActivity/.test(s)).join(' '));
      if(!shown)await pause(3500);
    }
    if(!shown)throw Error('Test ad did not open; no earned callback observed');
    snap('sdk-test-ad');await pause(42000);
    for(let i=0;i<3 && foreground().includes('AdActivity');i++) {await closeTestAd();await pause(1600);}
    assert.ok(foreground().includes(pkg),'app resumed after test ad');
    await selector('.rewarded-advice');
  });
  if(results['rewarded-sdk']==='pass')await step('reward-rotation-restart',async()=>{
    const caption=()=>js("document.querySelector('.rewarded-advice h3')?.textContent");
    const initial=await caption();assert.ok(initial);
    adb('shell','settings','put','system','accelerometer_rotation','0');
    try {
      adb('shell','settings','put','system','user_rotation','1');
      await until(()=>js('innerWidth>innerHeight'),'landscape');assert.equal(await caption(),initial);
    } finally {adb('shell','settings','put','system','user_rotation','0');}
    adb('shell','am','force-stop',pkg);launch();await connect();await pick('tarot','Таро');await click('Три карты');
    await selector('.rewarded-advice');assert.equal(await caption(),initial);
  });
  adb('shell','am','force-stop',pkg);launch();await connect();
  for (const [key,title] of [['compatibility','Совместимость'],['oracle','Оракул'],['natal','Натальная карта'],['matrix','Матрица судьбы'],['horoscope','Гороскоп'],['dates','Важные даты'],['solar','Соляр']]) {
    await step(key,async()=>{await pick(key,title);assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));});
  }
  await step('profile-keyboard',async()=>{await click('Профиль');await selector('#link-code');
    await clickSel('#link-code');assert.ok(await js("document.activeElement.id==='link-code'"));
    await until(()=>/m(?:InputShown|IsInputViewShown)=true/.test(adb('shell','dumpsys','input_method')),'Android IME shown',6000);});
  await step('cold-return',async()=>{
    adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','astroorbi-internal://payment-return',pkg);
    await connect();await page('stars');assert.doesNotMatch(await readout(),/Платёж подтверждён/);});
  await step('offline-back',async()=>{
    adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');
    await click('Главная');await pick('tarot','Таро');await selector('.one-card button');
    adb('shell','input','keyevent','4');await page('tools');
  });
} finally {socket?.close();}
if(Object.entries(results).some(([k,v])=>k!=='pageBytes'&&v!=='pass'))process.exitCode=1;
