import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
if (process.env.DATABASE_URL !== 'postgresql://auth11@127.0.0.1:55588/postgres' || process.env.ASTROORBI_ANDROID_SANDBOX !== '1') throw new Error('Isolated test database required');
const {getQuestions,registerTarotQuestionHelp} = await import('../server/tarotQuestionHelp');
const {pool} = await import('../server/db');
const id=randomUUID();
const rows=async()=>Number((await pool.query('SELECT referral_orbs FROM users WHERE id=$1',[id])).rows[0].referral_orbs);
const situation='Мне предложили повышение, но тогда придётся чаще задерживаться на работе.';
const mock=['Какие условия повышения для меня важны?','Как обсудить с руководителем время окончания работы?','Какой график оставит время для семьи?'];
try {
  await registerTarotQuestionHelp(express());
  await pool.query("INSERT INTO users(id,tg_id,name,gender,age,birthday_date,referral_orbs,referral_code) VALUES($1,$2,'Synthetic','other',26,'2000-01-01',1,left(md5(random()::text),12))",[id,'question-qa:'+id]);
  await assert.rejects(getQuestions(id,situation,async()=>['invalid']));
  assert.equal(await rows(),1);
  const attempts=await Promise.allSettled(Array.from({length:4},()=>getQuestions(id,situation,async()=>mock)));
  assert.ok(attempts.some(r=>r.status==='fulfilled' && r.value.charged===1));
  assert.deepEqual((await getQuestions(id,situation,async()=>{throw Error('unexpected generation');})),{charged:0,questions:mock});
  assert.equal(await rows(),0);
  await assert.rejects(getQuestions(id,'Меня интересует другая ситуация.',async()=>mock),/insufficient_orbs/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM tarot_question_help WHERE user_id=$1',[id])).rows[0].n,1);
  console.log('PASS failed response, concurrent requests, repeat after interrupted delivery, insufficient funds');
} finally { await pool.query('DELETE FROM users WHERE id=$1',[id]);await pool.end(); }
