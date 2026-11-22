// A real isolated PostgreSQL and HTTP handlers, an in-memory test merchant.
// Run from the repository root with node --import tsx.
import assert from 'node:assert/strict';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';

const dbUrl = new URL(process.env.ANDROID_SANDBOX_DATABASE_URL);
assert.equal(dbUrl.hostname,'127.0.0.1');
const db = new pg.Client({connectionString:dbUrl.href});
await db.connect();
const marker = process.env.ANDROID_SANDBOX_DATABASE_MARKER;
assert.ok(marker?.length >= 32);
assert.equal((await db.query('select 1 from android_sandbox_identity where marker=$1',[marker])).rowCount,1);
const tester = String(900000000000 + randomInt(1000000000));
const demo = randomBytes(16).toString('base64url');
Object.assign(process.env,{
  PORT:'55687', ANDROID_SANDBOX_ORIGIN:'https://android-test.example.invalid',
  MOBILE_RU_CHECKOUT_TESTERS:tester, JWT_SECRET:randomBytes(40).toString('hex'),
  YOOKASSA_SHOP_ID:'simulation', YOOKASSA_SECRET_KEY:'test_local_fixture', YOOKASSA_TEST_MODE:'true',
  ANDROID_REVIEW_CODE_SHA256:createHash('sha256').update(demo).digest('hex'),
});
for(const key of ['TELEGRAM_BOT_TOKEN','LEGACY_PAYMENTS','ANDROID_INTERNAL_OPENAI_KEY','ANDROID_INTERNAL_PURCHASES_DISABLED']) delete process.env[key];
const merchant = new Map(), refunds = new Map();
const require = createRequire(import.meta.url);
require.cache[require.resolve('@appigram/yookassa-node')] = { exports:() => ({
  async createPayment(body,key) {
    assert.equal(body.test,true);
    assert.equal(body.confirmation.return_url,'https://android-test.example.invalid/mobile/payment-return');
    assert.equal(body.payment_method_data.type,'bank_card');
    assert.ok(!body.save_payment_method);
    assert.equal(body.receipt.customer.email,'synthetic@example.invalid');
    assert.equal(body.amount.currency,'RUB');
    if (!merchant.has(key)) merchant.set(key,{...body,id:key,paid:false,status:'pending',confirmation:{confirmation_url:'https://checkout.example.invalid/'+key}});
    return merchant.get(key);
  },
  async getPayment(id) { return merchant.get(id); },
  async getRefund(id) { return refunds.get(id); },
}) };
const issue = () => execFileSync(process.execPath,['--import','tsx','server/androidSandbox.ts','--issue-code'],{encoding:'utf8'}).trim();
await import('../../server/androidSandbox.ts');
const base = 'http://127.0.0.1:55687', shop='/api/mobile/shop', orders=shop+'/orders', me='/api/user/me';
let token;
async function request(path, data, status=200, method=data?'POST':'GET') {
  const res = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token&&{Authorization:'Bearer '+token})},body:data&&JSON.stringify(data)});
  assert.equal(res.status,status,method+' '+path);
  if (res.headers.get('content-type')?.includes('json')) return (await res.json()).data;
  return res.text();
}
const order = (tier,amount,status) => request(orders,{tier,amount,email:'synthetic@example.invalid'},status);
const notify = p => request('/webhooks/yookassa',{event:'payment.'+p.status,object:p});
const complete = p => Object.assign(p,{status:'succeeded',paid:true});
const login = async code => { token=(await request('/api/mobile/auth/exchange',{code})).token; };
const pass = s => process.stdout.write('PASS '+s+'\n');
try {
  for (let i=0;i<100;i++) { try { if ((await fetch(base+'/api/health')).ok) break; } catch {} await sleep(100); }
  for (const page of ['privacy','delete-account']) assert.match(await request('/mobile/'+page),/AstroOrbi/);
  assert.equal((await request('/api/mobile/config?build=7')).testAds,true);
  process.env.ANDROID_S7_TEST_ADS='0';
  assert.equal((await request('/api/mobile/config?build=7')).testAds,false);
  pass('public pages and ad kill switch');
  await login(issue());
  const id=(await request(me)).id;
  await login(issue());
  assert.equal((await request(me)).id,id);
  await db.query('update users set referral_orbs=37 where id=$1',[id]);
  assert.deepEqual((await request(shop)).prices,{standard:99,premium:199});
  await order('standard',1,409);
  await request(orders,{tier:'standard',amount:99,email:'invalid'},400);
  const a=await order('standard',99);
  let p=[...merchant.values()].at(-1);
  assert.equal((await order('standard',99)).id,a.id);
  assert.equal((await request(orders+'/'+a.id)).status,'pending');
  await request('/mobile/payment-return');
  assert.equal((await request(me)).billingTier,'free');
  Object.assign(p,{status:'canceled'}); await notify(p);
  assert.equal((await request(orders+'/'+a.id)).status,'canceled');
  assert.equal(Number((await request(me)).orbs),37);
  pass('same profile, promo, receipt, idempotent create, closed checkout, return without credit and cancellation');
  const b=await order('standard',99);
  p=[...merchant.values()].at(-1);
  process.env.ANDROID_INTERNAL_PURCHASES_DISABLED='1';
  await order('standard',99,403);
  complete(p);
  await Promise.all([notify(p),notify(p),request(orders+'/'+b.id)]);
  const paid=await request(me);
  assert.equal(paid.billingTier,'standard'); assert.equal(Number(paid.orbs),287);
  assert.equal(paid.subscription.autoRenew,false);
  assert.equal(Date.parse(paid.orbsResetAt),Date.parse(paid.subscription.currentPeriodEnd));
  assert.ok(Date.parse(paid.subscription.currentPeriodEnd)-Date.now()>27*86400000);
  await notify(p);
  assert.equal((await request(me)).subscription.currentPeriodEnd,paid.subscription.currentPeriodEnd);
  delete process.env.ANDROID_INTERNAL_PURCHASES_DISABLED;
  pass('delayed success, parallel webhook and status, repeat delivery, one month and preserved 37 non-plan stars');
  await db.query("update subscriptions set current_period_end=(now() at time zone 'UTC')-interval '1 minute' where user_id=$1",[id]);
  const expired=await request(me);
  assert.equal(expired.billingTier,'free'); assert.equal(Number(expired.orbs),37);
  assert.deepEqual((await request(shop)).prices,{standard:199,premium:399});
  const c=await order('premium',399);
  const later=complete([...merchant.values()].at(-1));
  await notify(later);
  assert.equal((await request(orders+'/'+c.id)).status,'completed');
  assert.equal(Number((await request(me)).orbs),587);
  await db.query('update users set subscription_orbs=510 where id=$1',[id]);
  const refundId=randomBytes(16).toString('hex');
  refunds.set(refundId,{id:refundId,status:'succeeded',payment_id:p.id,amount:{value:'99.00',currency:'RUB'}});
  const refund=()=>request('/webhooks/yookassa',{event:'refund.succeeded',object:{id:refundId}});
  await Promise.all([refund(),refund()]);
  await notify(p);
  assert.equal((await request(orders+'/'+b.id)).status,'refund_review');
  const after=await request(me); assert.equal(after.billingTier,'premium'); assert.equal(Number(after.orbs),547);
  pass('expiry, full-price repurchase, old refund after spending and newer purchase, refund replay');
  const original=token;
  await login(demo); const disposable=(await request(me)).id;
  await request(orders+'/'+c.id,undefined,404);
  assert.ok((await request('/api/tarot/history')).some(r=>r.spread==='celtic'&&r.cards.length===10&&r.cards.some(c=>c.reversed)));
  for(const kind of ['forecast','compatibility','matrix','solar','date','planet','house','daily-sign']) {
    for(let i=0;i<2;i++) await request('/api/mobile/reading-feedback',{kind,excerpt:'Синтетический фрагмент'});
  }
  const count = async () => (await db.query('select count(*)::int n from android_reading_feedback where user_id=$1',[disposable])).rows[0].n;
  assert.equal(await count(),8);
  await request('/api/mobile/account',{confirmation:'DELETE'},200,'DELETE');
  await request(me,undefined,401); assert.equal(await count(),0);
  for (const table of ['tarot_readings','subscriptions','ai_questions']) assert.equal((await db.query('select 1 from '+table+' where user_id=$1',[disposable])).rowCount,0);
  token=original; assert.equal((await request(me)).id,id);
  pass('eight complaint types, deduplication, deletion and invalidated session, other profile preserved');
  // Use a second synthetic checkout, isolated from the refunded account.
  process.env.MOBILE_RU_CHECKOUT_TESTERS=String(Number(tester)+1);
  await login(issue()); const other=(await request(me)).id;
  const conflict=await order('premium',199);
  await request('/api/mobile/account',{confirmation:'DELETE'},409,'DELETE');
  await db.query("insert into subscriptions(user_id,tier,status,started_at,current_period_end,payment_provider) values($1,'standard','active',now(),now()+interval '1 month','stars')",[other]);
  const competing=complete([...merchant.values()].at(-1)); await notify(competing);
  assert.equal((await request(orders+'/'+conflict.id)).status,'needs_review');
  assert.equal((await request(me)).subscription.paymentProvider,'stars');
  pass('cross-channel conflict on synthetic subscription, open-order deletion deferred');
} finally { await db.end(); }
process.exit(0);
