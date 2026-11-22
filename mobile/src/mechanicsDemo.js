import { calcMatrixFromISO, calcPairMatrix, MATRIX_SECTIONS, FREE_MATRIX_SECTIONS } from '../../shared/matrix';
import { drawCards, TAROT_SPREADS, getTarotCard, yesNoVerdict } from '../../shared/tarot';
import { ORB_PACKS } from '../../shared/orbPacks';

const key = 'astroorbi.local-mechanics.v1';
const sample = 'Демонстрационная трактовка. Выберите одну тему, которую хочется изучить подробнее, и запишите свой вопрос.';
const costs = { daily: 0, yesno: 1, three: 3, celtic: 10 };
function initial() {
  return { profile: { id: 'demo', name: 'Саша · тест механик', tier: 'premium', billingTier: 'premium',
    orbs: 10000, birthdayDate: '1996-01-01', birthTime: '12:00', birthPlace: 'Москва', gender: 'other' },
    tarot: [], oracle: [], forecasts: [], compatibility: [], guests: [], pairs: [], charts: [], saved: {}, houses: {}, reports: [] };
}
function chart() {
  const names = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','North Node','South Node'];
  const signs = 'Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces'.split(' ');
  const planets = Object.fromEntries(names.map((name,i) => [name,{longitude:i*30+8, degree_in_sign:8, sign:signs[i], house:i+1}]));
  return { planets, houses:{cusps: names.map((_,i)=>i*30)}, aspects:[] };
}

export function mechanicsRequest(path, {data = {}, method, envelope}) {
  const url = new URL(path,'https://local.invalid');
  const route = url.pathname.replace('/api/','');
  const s = JSON.parse(localStorage.getItem(key) || 'null') || initial();
  const p = s.profile;
  const now = new Date().toISOString();
  const row = () => ({id:crypto.randomUUID(), createdAt:now});
  function debit(cost) {
    if (p.orbs < cost) throw Error('Недостаточно тестовых звёзд. Пополните баланс в демонстрационном магазине.');
    p.orbs -= cost;
  }
  function matrix(person) {
    return {...person, core:calcMatrixFromISO(person.birthDate),
      sections:MATRIX_SECTIONS.map(id=>({id,free:FREE_MATRIX_SECTIONS.includes(id),content:s.saved[person.id+id]}))};
  }
  const own={id:p.id,birthDate:p.birthdayDate};
  let meta = {};
  function handle() {
    switch(route) {
      case 'mobile/config': return {testAds:true};
      case 'user/me': return p;
      case 'user/update': Object.assign(p,data,{lastProfileUpdate:now}); return p;
      case 'user/push': p.pushEnabled=data.enabled; return p;
      case 'cities/search': return [url.searchParams.get('q')].filter(Boolean);
      case 'mobile/account': Object.assign(s,initial()); return {deleted:true};
      case 'mobile/demo-purchase': {
        const pack=ORB_PACKS.find(item=>item.id===data.item);
        if(pack) p.orbs+=pack.orbs;
        else if(['standard','premium'].includes(data.item)) {
          p.tier=p.billingTier=data.item; p.orbs+=data.item==='premium'?550:250;
        } else throw Error('Неизвестный тестовый товар');
        return p;
      }
      case 'mobile/content-reports': case 'mobile/reading-feedback':
        s.reports.push({...row(),...data}); return {received:true};
      case 'tarot/history': return s.tarot;
      case 'tarot/status': return {costs,dailyDone:s.tarot.some(r=>r.spread==='daily' && r.createdAt.slice(0,10)===now.slice(0,10))};
      case 'tarot/draw': {
        const {spread}=data;
        const old=spread==='daily' && s.tarot.find(r=>r.spread===spread && r.createdAt.slice(0,10)===now.slice(0,10));
        if(old) return old;
        const cards=drawCards(TAROT_SPREADS[spread].cards,{allowReversed:data.allowReversed});
        debit(costs[spread]);
        const reading={...row(),...data,cards,interpretation:{synthesis:sample, cards:cards.map((c,i)=>({
          text:TAROT_SPREADS[spread].positions[i][0]+' · '+getTarotCard(c.cardId).nameRu+'. '+sample})),
          verdict:spread==='yesno'?yesNoVerdict(cards[0].cardId,cards[0].reversed):undefined}};
        s.tarot.unshift(reading);return reading;
      }
      case 'natal/me': case 'natal/init': return {data:chart(), houseInfluences:{ru:s.houses}};
      case 'natal/external': {
        if(method==='GET') return s.charts;
        debit(20); const entry={...row(),...data,data:chart()}; s.charts.unshift(entry); return entry;
      }
      case 'astrology/planet-interpretation':
        if(data.mode!=='brief') debit(2);
        return {title:data.planet,summary:sample,strengths:['Наблюдательность'],advice:['Запишите свои впечатления.']};
      case 'astrology/house-influence-status': return {ru:s.houses};
      case 'astrology/house-influence':
        if(!s.houses[data.planet]) {debit(2);s.houses[data.planet]={title:data.planet,manifestation:sample};}
        return s.houses[data.planet];
      case 'astrology/ask/history': return s.oracle;
      case 'astrology/ask': {
        debit(0.5);const entry={...row(),question:data.question,answer:sample};s.oracle.unshift(entry);return entry;
      }
      case 'astrology/compatibility/history': return s.compatibility;
      case 'astrology/compatibility': {
        debit(20);const entry={...row(),partnerName:data.partner.name,compatibilityRating:8,analysis:sample};s.compatibility.unshift(entry);return entry;
      }
      case 'astrology/horoscope/history': return s.forecasts;
      case 'astrology/horoscope': case 'astrology/horoscope/weekly-plan': case 'astrology/horoscope/monthly-plan': {
        const period=route.endsWith('monthly-plan')?'month':route.endsWith('weekly-plan')?'week':'day';
        debit({month:15,week:5,day:1}[period]);const result={overview:sample,advice:'Запишите планы на выбранный период.'};
        s.forecasts.unshift({...row(),period,startDate:now,data:result});return result;
      }
      case 'astrology/solar/check': case 'astrology/solar': {
        const k=JSON.stringify(['solar',data.targetYear,data.location]);
        meta.cached=Boolean(s.saved[k]);
        if(route.endsWith('/check')) return null;
        if(!meta.cached) {debit(15);s.saved[k]={solar:{date:data.targetYear+'-01-01',sign:'Capricorn'},interpretation:sample};}
        return s.saved[k];
      }
      case 'astrology/important-dates':
        return ['new_moon','planet_transit','full_moon'].map((type,i)=>({type,date:new Date(Date.now()+(i+1)*86400000).toISOString(),sign:'Aries',to_sign:'Aries',planet:'Venus'}));
      case 'astrology/important-dates/interpret': {
        const k=JSON.stringify(['date',data.eventType,data.date.slice(0,10)]);
        const cached=Boolean(s.saved[k]);if(!cached){debit(3);s.saved[k]=sample;}
        return {interpretation:s.saved[k],cached};
      }
      case 'matrix/me': meta=matrix(own);return meta;
      case 'matrix/guests': return s.guests;
      case 'matrix/pairs': return s.pairs;
      case 'matrix/guest': {
        debit(15);const guest={...row(),...data};s.guests.unshift(guest);return matrix(guest);
      }
      case 'matrix/pair': {
        const old=s.pairs.find(r=>r.partnerName===data.name && r.partnerBirthDate===data.birthDate);
        if(old)return {...old,charged:false};
        debit(20);const entry={key:crypto.randomUUID(),partnerName:data.name,partnerBirthDate:data.birthDate,
          pairCore:calcPairMatrix(calcMatrixFromISO(p.birthdayDate),calcMatrixFromISO(data.birthDate)),reading:sample};
        s.pairs.unshift(entry);return {...entry,charged:true};
      }
      case 'matrix/section': {
        const k=(data.guestId||p.id)+data.section;
        const cost=s.saved[k]||FREE_MATRIX_SECTIONS.includes(data.section)?0:data.section==='year'?3:5;
        debit(cost);s.saved[k]=sample;meta={section:data.section,content:sample,charged:cost>0};return meta;
      }
      default:
        if(route.startsWith('public/sign-horoscope/'))return {intro:sample};
        if(route.startsWith('matrix/guest/'))return matrix(s.guests.find(g=>g.id===route.split('/').pop()));
        if(route.startsWith('natal/external/')){
          const id=route.split('/').pop();
          if(method==='DELETE'){s.charts=s.charts.filter(c=>c.id!==id);return {deleted:true};}
          return s.charts.find(c=>c.id===id);
        }
        throw Error('Нет демонстрационного сценария для '+route);
    }
  }
  const result=handle();
  localStorage.setItem(key,JSON.stringify(s));
  return envelope?{ok:true,data:result,...meta}:result;
}
