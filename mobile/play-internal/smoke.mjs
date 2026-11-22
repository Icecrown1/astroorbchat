// Launch a local test on an already provisioned, marked, isolated database.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';

const dbUrl = new URL(process.env.ANDROID_SANDBOX_DATABASE_URL);
assert.equal(dbUrl.hostname, '127.0.0.1');
const marker = process.env.ANDROID_SANDBOX_DATABASE_MARKER;
assert.ok(marker?.length >= 32);
const db = new pg.Client({ connectionString: dbUrl.href });
await db.connect();
assert.equal((await db.query('select 1 from public.android_sandbox_identity where marker=$1', [marker])).rowCount, 1);
const port = 55674;
const env = {
  ...process.env, PORT: String(port), ANDROID_SANDBOX_ORIGIN: 'https://stage.example.invalid',
  JWT_SECRET: randomBytes(32).toString('hex'), MOBILE_RU_CHECKOUT_TESTERS: '900000000003',
  YOOKASSA_TEST_MODE: 'true',
};
for (const key of ['TELEGRAM_BOT_TOKEN', 'LEGACY_PAYMENTS', 'YOOKASSA_SECRET_KEY', 'YOOKASSA_SHOP_ID', 'ANDROID_INTERNAL_OPENAI_KEY']) delete env[key];
const args = ['--import', 'tsx', 'server/androidSandbox.ts'];
const review = randomBytes(16).toString('base64url');
env.ANDROID_REVIEW_CODE_SHA256 = createHash('sha256').update(review).digest('hex');
const issue = () => execFileSync(process.execPath, [...args, '--issue-code'], {env, encoding:'utf8'}).trim();
const server = spawn(process.execPath, args, { env, stdio: ['ignore', 'ignore', 'inherit'] });
const closed = once(server, 'close');
let token;
async function request(path, { data, method = data ? 'POST' : 'GET', status = 200 } = {}) {
  const result = await fetch('http://127.0.0.1:' + port + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: data && JSON.stringify(data),
  });
  assert.equal(result.status, status, method + ' ' + path);
  if (result.headers.get('content-type')?.includes('application/json')) return result.json();
  return result.text();
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120 && server.exitCode === null; attempt++) {
    try { ready = (await request('/api/health')).mobileApi === 'internal-v1'; } catch {}
    if (ready) break;
    await pause(250);
  }
  assert.ok(ready, 'Internal API startup');
  const code = issue();
  const expiredDigest = createHash('sha256').update(code).digest('hex');
  await db.query("update mobile_link_codes set expires_at=now()-interval '1 second' where digest=$1", [expiredDigest]);
  const exchange = '/api/mobile/auth/exchange';
  await request(exchange, {data:{code}, status:400});
  const fresh = issue();
  token = (await request(exchange, {data:{code:fresh}})).data.token;
  await request(exchange, {data:{code:fresh}, status:400});
  for (const path of ['/api/user/me', '/api/mobile/shop', '/api/tarot/status', '/api/tarot/history',
    '/api/matrix/me', '/api/matrix/guests', '/api/matrix/pairs', '/api/natal/external',
    '/api/astrology/ask/history', '/api/astrology/compatibility/history', '/api/astrology/horoscope/history']) {
    assert.equal((await request(path)).ok, true, path);
  }
  assert.ok((await request('/api/cities/search?q=' + encodeURIComponent('Москва'))).data.length);
  await request('/api/astrology/ask', {data:{ question:'Тест'}, status:503});
  for (const path of ['/api/mobile/auth/code', '/api/auth/telegram', '/api/cron/subscription-check']) {
    await request(path, {data:{}, status:404});
  }
  token = null;
  await request('/api/tarot/history', {status:401});
  const page = await request('/mobile/payment-return');
  assert.match(page, /astroorbi-internal:\/\/payment-return/);
  assert.match(page, /astroorbi-test:\/\/payment-return/);
  token = (await request(exchange, {data:{code:review}})).data.token;
  const firstReviewer = (await request('/api/user/me')).data;
  assert.equal(firstReviewer.billingTier, 'premium');
  assert.equal(Number(firstReviewer.orbs), 550);
  assert.ok((await request('/api/tarot/history')).data.length);
  const [answer] = (await request('/api/astrology/ask/history')).data;
  assert.ok(answer.id);
  const report = { kind:'oracle', id:answer.id };
  for (let i=0; i<2; i++) assert.equal((await request('/api/mobile/content-reports', {data:report})).data.received, true);
  assert.equal((await db.query("select count(*)::int as n from events where name='mobile_content_report' and user_id=$1", [firstReviewer.id])).rows[0].n, 1);
  assert.equal((await request('/api/mobile/shop')).data.available, false);
  token = (await request(exchange, {data:{code:review}})).data.token;
  assert.notEqual((await request('/api/user/me')).data.id, firstReviewer.id);
  await request('/api/mobile/content-reports', { data:report, status:404 });
  assert.equal((await request('/api/mobile/config')).data.testAds, false);
  console.log('Passed: isolated login, expiry, replay, profile, catalog, history, matrices, cities, route restrictions and return links.');
} finally {
  server.kill();
  await closed;
  await db.end();
}
