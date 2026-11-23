import type { Express } from 'express';
import { createHash } from 'node:crypto';
import { pool } from './db';
import { requireAuth } from './middleware/auth';
import { openai } from './lib/openai';

export const questionHelpCost = 1;
async function generateQuestions(situation: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', max_tokens: 500, response_format:{type:'json_object'},
    messages:[
      {role:'system', content:'Ты редактор вопросов для Таро. Пользователь описывает свою ситуацию. Дай три разные открытые формулировки от первого лица на русском: про выбор, его обстоятельства и возможный следующий шаг. Каждая должна использовать конкретику описания. Не делай расклад, не добавляй имён, фактов или обещаний. Только JSON вида {"questions":["…?","…?","…?"]}. Каждый вопрос не длиннее 230 символов.'},
      {role:'user',content:situation},
    ],
  },{timeout:20000,maxRetries:0});
  return JSON.parse(completion.choices[0]?.message?.content ?? '{}').questions;
}
class HelpError extends Error {
  constructor(readonly status:number, message:string) { super(message); }
}
export async function getQuestions(userId:string, situation:string, generate=generateQuestions) {
  const key = createHash('sha256').update(situation).digest('hex');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const lock=await client.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired',[userId+':question:'+key]);
    if (!lock.rows[0].acquired) throw new HelpError(409,'in_progress');
    const prior=await client.query('SELECT questions FROM tarot_question_help WHERE user_id=$1 AND situation_hash=$2',[userId,key]);
    if (prior.rowCount) {
      await client.query('COMMIT');
      return {questions:prior.rows[0].questions, charged:0};
    }
    const balanceSQL = `SELECT u.referral_orbs::float AS bonus, CASE WHEN EXISTS
      (SELECT 1 FROM subscriptions s WHERE s.user_id=u.id AND s.status IN ('active','canceled') AND s.current_period_end>=now())
      THEN u.subscription_orbs::float ELSE 0 END AS subscription FROM users u WHERE u.id=$1`;
    const balance = async (lockRow:boolean) => {
      const {rows:[row]}=await client.query(balanceSQL+(lockRow?' FOR UPDATE OF u':''),[userId]);
      if (!row || row.bonus+row.subscription<questionHelpCost) throw new HelpError(402,'insufficient_orbs');
      return row;
    }
    await balance(false);
    const questions:unknown = await generate(situation);
    if (!Array.isArray(questions) || questions.length!==3 || questions.some(q=>typeof q!=='string'||q.trim().length<6||q.length>300||!q.trim().endsWith('?')) || new Set(questions.map(q=>q.trim().toLowerCase())).size!==3) throw new Error('invalid_question_response');
    const row=await balance(true);
    const fromSubscription=Math.min(questionHelpCost,row.subscription);
    await client.query('UPDATE users SET subscription_orbs=subscription_orbs-$2, referral_orbs=referral_orbs-$3 WHERE id=$1',[userId,fromSubscription,questionHelpCost-fromSubscription]);
    await client.query('INSERT INTO tarot_question_help(user_id,situation_hash,questions) VALUES($1,$2,$3::jsonb)',[userId,key,JSON.stringify(questions)]);
    await client.query('COMMIT');
    return {questions,charged:questionHelpCost};
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function registerTarotQuestionHelp(app: Express) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tarot_question_help (
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, situation_hash text NOT NULL,
    questions jsonb NOT NULL, PRIMARY KEY(user_id,situation_hash))`);
  app.post('/api/tarot/question-help',requireAuth,async(req,res)=>{
    const raw=req.body?.situation;
    if(typeof raw!=='string' || raw.length>1000 || raw.trim().length<8) { res.status(400).json({ok:false,error:'invalid_situation'}); return; }
    try {
      const data=await getQuestions((req as typeof req & {userId:string}).userId,raw.trim().replace(/\s+/g,' '));
      res.json({ok:true,data});
    } catch(error) {
      res.status(error instanceof HelpError ? error.status : 503).json({ok:false,error:error instanceof HelpError ? error.message : 'question_help_unavailable'});
    }
  });
}
