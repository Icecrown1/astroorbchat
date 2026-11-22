import type { Express, RequestHandler } from 'express';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { generateToken } from './lib/jwt';
import { requireAuth } from './middleware/auth';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fail = (status: number, reason: string) => ({status, body:{ok:false,error:reason}});
const ok = (data: object = {}) => ({status:200,body:{ok:true,data}});
const prefix = '/api/mobile/pilot';
const mailIdentity = (email: string) => createHmac('sha256',process.env.JWT_SECRET!).update('email:'+email).digest('hex');
const codeProof = (challenge: string, code: string) => createHmac('sha256',process.env.JWT_SECRET!).update(challenge+':'+code).digest('hex');
type Delivery = (to:string,code:string) => Promise<void>;
async function sendEmail(to:string,code:string) {
  if (!process.env.ANDROID_AUTH_MAIL_KEY || !process.env.ANDROID_AUTH_MAIL_FROM) throw Error('mail unavailable');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Bearer '+process.env.ANDROID_AUTH_MAIL_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.ANDROID_AUTH_MAIL_FROM,to:[to],subject:'Код входа в AstroOrbi',
      text:'Ваш код AstroOrbi: '+code+'. Срок действия — 5 минут. Если вы не запрашивали код, пропустите это письмо.'})});
  if(!r.ok) throw Error('delivery failed');
}
export async function registerPilot(app:Express,pool:Pool,deliver:Delivery=sendEmail) {
  if(process.env.ASTROORBI_ANDROID_SANDBOX!=='1' || !process.env.JWT_SECRET) throw Error('sandbox only');
  await pool.query(`CREATE TABLE IF NOT EXISTS android_auth_gate(slot boolean PRIMARY KEY CHECK(slot), enabled boolean NOT NULL);
    INSERT INTO android_auth_gate VALUES(true,true) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS android_auth_mail(identity text PRIMARY KEY,user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS android_auth_challenge(id uuid PRIMARY KEY,identity text NOT NULL UNIQUE, proof text NOT NULL,
      owner varchar REFERENCES users(id) ON DELETE CASCADE, attempts int NOT NULL DEFAULT 0, expires timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS android_auth_session(digest text PRIMARY KEY,user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS android_auth_link(owner varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,digest text NOT NULL UNIQUE,expires timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS android_auth_budget(bucket timestamptz PRIMARY KEY, count integer NOT NULL);
    CREATE TABLE IF NOT EXISTS android_auth_test_inbox(owner varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,code text NOT NULL,expires timestamptz NOT NULL)`);
  const transaction=async <T>(fn:(c:PoolClient)=>Promise<T>)=>{
    const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}
    catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  };
  type Task=(c:PoolClient, req:Parameters<RequestHandler>[0], owner?:string)=>Promise<ReturnType<typeof fail>|ReturnType<typeof ok>>;
  const action=(task:Task):RequestHandler=>async(req,res,next)=>{
    try {
      const result=await transaction(async c=>{
        if(!(await c.query('SELECT enabled FROM android_auth_gate WHERE slot FOR SHARE')).rows[0]?.enabled)return fail(403,'pilot_disabled');
        return task(c,req,res.locals.pilotUser);
      });
      res.set('Cache-Control','no-store').status(result.status).json(result.body);
    }catch(e){next(e);}
  };
  async function session(c:PoolClient,user:string) {
    const token='pilot_'+randomBytes(32).toString('base64url');
    await c.query("INSERT INTO android_auth_session VALUES($1,$2,now()+interval '8 hours')",[hash(token),user]);
    return ok({token});
  }
  app.use('/api',async(req,res,next)=>{
    const raw=req.headers.authorization?.slice(7);
    if(!raw?.startsWith('pilot_'))return next();
    try{
      const r=await pool.query('SELECT user_id FROM android_auth_session,android_auth_gate WHERE slot AND enabled AND digest=$1 AND expires>now()',[hash(raw)]);
      if(!r.rowCount){res.status(401).json({ok:false,error:'session_revoked'});return;}
      res.locals.pilotUser=r.rows[0].user_id;res.locals.pilotDigest=hash(raw);
      if(req.method!=='GET' && !req.originalUrl.startsWith(prefix+'/')){
        res.status(403).json({ok:false,error:'pilot_read_only'});return;
      }
      // This internal credential stays inside this request. Only named read endpoints serve pilot sessions.
      if(!req.originalUrl.startsWith(prefix+'/') && !['/api/user/me','/api/natal/me','/api/astrology/ask/history','/api/tarot/history','/api/tarot/status','/api/mobile/config'].includes(req.originalUrl.split('?')[0])){
        res.status(403).json({ok:false,error:'pilot_read_only'});return;
      }
      req.headers.authorization='Bearer '+generateToken(r.rows[0].user_id,30,'mobile');
      next();
    }catch(e){next(e);}
  });
  // Read the stored balance directly. The ordinary /api/user/me may run balance maintenance.
  app.get('/api/natal/me',async(_req,res,next)=>{
    if(!res.locals.pilotUser)return next();
    try{
      const r=await pool.query('SELECT data, house_influences AS "houseInfluences" FROM natal_charts WHERE user_id=$1',[res.locals.pilotUser]);
      if(!r.rowCount){res.status(409).json({ok:false,error:'NATAL_NOT_INITIALIZED'});return;}
      res.set('Cache-Control','no-store').json(ok(r.rows[0]).body);
    }catch(e){next(e);}
  });
  app.get('/api/user/me',async(_req,res,next)=>{
    if(!res.locals.pilotUser)return next();
    try{
      const r=await pool.query(`SELECT u.id,u.name,u.gender,u.birthday_date AS "birthdayDate",u.birth_time AS "birthTime",
        u.birth_place AS "birthPlace",u.subscription_orbs+u.referral_orbs AS orbs,
        coalesce((SELECT tier FROM subscriptions WHERE user_id=u.id AND status='active' AND current_period_end>now() LIMIT 1),'free') AS tier
        FROM users u WHERE u.id=$1`,[res.locals.pilotUser]);
      const data=r.rows[0];res.set('Cache-Control','no-store').json({ok:true,data:{...data,billingTier:data.tier}});
    }catch(e){next(e);}
  });
  app.post(prefix+'/logout',async(_req,res,next)=>{
    try{if(res.locals.pilotDigest)await pool.query('DELETE FROM android_auth_session WHERE digest=$1',[res.locals.pilotDigest]);res.json(ok().body);}catch(e){next(e);}
  });
  app.post(prefix+'/issue',requireAuth,action(async(c,req,owner)=>{
    const u=(req as any).user;
    if(owner || !String(u.tgId).startsWith('play-review-'))return fail(403,'test_profile_required');
    const code=randomBytes(16).toString('base64url');
    await c.query("INSERT INTO android_auth_link VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(owner) DO UPDATE SET digest=excluded.digest,expires=excluded.expires",[u.id,hash(code)]);
    return ok({code,email:u.id+'@example.invalid'});
  }));
  app.post(prefix+'/exchange',action(async(c,req)=>{
    const code=req.body?.code;if(typeof code!=='string'||!/^[-\w]{22}$/.test(code))return fail(400,'invalid_code');
    const r=await c.query('DELETE FROM android_auth_link WHERE digest=$1 AND expires>now() RETURNING owner',[hash(code)]);
    return r.rowCount?session(c,r.rows[0].owner):fail(400,'invalid_code');
  }));
  app.get(prefix+'/test-inbox',requireAuth,action(async(c,req,owner)=>{
    const u=(req as any).user;
    if(owner || !String(u.tgId).startsWith('play-review-'))return fail(403,'test_profile_required');
    const r=await c.query('SELECT code FROM android_auth_test_inbox WHERE owner=$1 AND expires>now()',[u.id]);
    return ok({code:r.rows[0]?.code??null,email:u.id+'@example.invalid'});
  }));
  app.post(prefix+'/email/start',action(async(c,req,owner)=>{
    const email=String(req.body?.email??'').trim().toLowerCase();
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail(400,'invalid_email');
    const synthetic=email.endsWith('@example.invalid');
    if(!synthetic && deliver===sendEmail && (!process.env.ANDROID_AUTH_MAIL_KEY || !process.env.ANDROID_AUTH_MAIL_FROM))return fail(503,'mail_unconfigured');
    const identity=mailIdentity(email), id=randomUUID(), code=randomInt(1000000).toString().padStart(6,'0');
    const testUser=synthetic?(await c.query("SELECT id FROM users WHERE id=$1 AND tg_id LIKE 'play-review-%'",[email.split('@')[0]])).rows[0]:null;
    if(synthetic && !testUser)return fail(400,'unknown_test_inbox');
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[identity]);
    const recent=await c.query("SELECT 1 FROM android_auth_challenge WHERE identity=$1 AND expires>now()+interval '4 minutes'",[identity]);
    if(recent.rowCount)return fail(429,'otp_wait');
    const budget=await c.query("INSERT INTO android_auth_budget VALUES(date_trunc('hour',now()),1) ON CONFLICT(bucket) DO UPDATE SET count=android_auth_budget.count+1 WHERE android_auth_budget.count<60 RETURNING count");
    if(!budget.rowCount)return fail(429,'otp_wait');
    await c.query("INSERT INTO android_auth_challenge(id,identity,proof,owner,expires) VALUES($1,$2,$3,$4,now()+interval '5 minutes') ON CONFLICT(identity) DO UPDATE SET id=excluded.id,proof=excluded.proof,owner=excluded.owner,expires=excluded.expires,attempts=0",[id,identity,codeProof(id,code),owner??null]);
    if(testUser)await c.query("INSERT INTO android_auth_test_inbox VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(owner) DO UPDATE SET code=excluded.code,expires=excluded.expires",[testUser.id,code]);
    else await deliver(email,code);
    return ok({challenge:id});
  }));
  app.post(prefix+'/email/verify',action(async(c,req,owner)=>{
    const {challenge,code,birthday}=req.body??{};
    if(typeof challenge!=='string'||!/^[a-f0-9-]{36}$/.test(challenge)||typeof code!=='string'||!/^\d{6}$/.test(code))return fail(400,'invalid_code');
    const r=await c.query('SELECT * FROM android_auth_challenge WHERE id::text=$1 AND expires>now() AND attempts<5 FOR UPDATE',[challenge]);
    const ticket=r.rows[0];if(!ticket || ticket.owner!==(owner??null))return fail(400,'invalid_code');
    if(ticket.proof!==codeProof(challenge,code)){await c.query('UPDATE android_auth_challenge SET attempts=attempts+1 WHERE id=$1',[challenge]);return fail(400,'invalid_code');}
    let id=(await c.query('SELECT user_id FROM android_auth_mail WHERE identity=$1',[ticket.identity])).rows[0]?.user_id;
    if(owner && ((id && id!==owner)||(await c.query('SELECT 1 FROM android_auth_mail WHERE user_id=$1 AND identity<>$2',[owner,ticket.identity])).rowCount))return fail(409,'identity_conflict');
    if(!id){
      id=owner;
      if(!id){
        const date=new Date(birthday+'T12:00:00Z');
        if(typeof birthday!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(birthday)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==birthday||birthday<'1900-01-01'||birthday>new Date().toISOString().slice(0,10))return fail(422,'birthday_required');
        const created=await c.query("INSERT INTO users(tg_id,name,gender,age,birthday_date,referral_code,push_enabled,signup_source) VALUES($1,'Тестовый профиль','other',$2,$3,$4,false,'android_email') RETURNING id",['email-'+randomUUID(),Math.floor((Date.now()-+date)/31557600000),birthday,randomBytes(9).toString('hex')]);
        id=created.rows[0].id;
      }
      await c.query('INSERT INTO android_auth_mail VALUES($1,$2)',[ticket.identity,id]);
    }
    await c.query('DELETE FROM android_auth_challenge WHERE id=$1',[challenge]);
    return owner?ok({linked:true}):session(c,id);
  }));
}
export async function setPilot(pool:Pool,enabled:boolean) {
  const c=await pool.connect();try{
    await c.query('BEGIN');await c.query('UPDATE android_auth_gate SET enabled=$1 WHERE slot',[enabled]);
    if(!enabled)for(const table of ['android_auth_session','android_auth_challenge','android_auth_link','android_auth_test_inbox'])await c.query('DELETE FROM '+table);
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
