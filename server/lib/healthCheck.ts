/**
 * Самодиагностика для админки: что из внешних зависимостей сейчас работает.
 * База, схема, OpenAI (короткий запрос на 1 токен), Python + Swiss Ephemeris, бот Telegram.
 * Ответ — человекочитаемые ошибки, чтобы по ним сразу было понятно, что чинить.
 */
import { spawn } from 'child_process';

export interface HealthItem { ok: boolean; detail: string; ms: number }
export type HealthReport = Record<'database' | 'schema' | 'openai' | 'python' | 'telegram', HealthItem>;

async function timed(fn: () => Promise<string>, timeoutMs = 25_000): Promise<HealthItem> {
  const t0 = Date.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error(`нет ответа за ${timeoutMs / 1000} с`)), timeoutMs)),
    ]);
    return { ok: true, detail, ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message || e).slice(0, 400), ms: Date.now() - t0 };
  }
}

function explainOpenAiError(e: any): string {
  const status = e?.status ?? e?.response?.status;
  const code = e?.code || e?.error?.code;
  const msg = e?.error?.message || e?.message || String(e);
  if (code === 'insufficient_quota') return `Закончились деньги/лимит на аккаунте OpenAI (insufficient_quota). Пополните баланс на platform.openai.com → Billing. ${msg}`;
  if (status === 401) return `Ключ OPENAI_API_KEY не принят (401) — проверьте ключ в Secrets. ${msg}`;
  if (status === 403) return `Доступ запрещён (403): регион или права ключа. ${msg}`;
  if (status === 404) return `Модель недоступна для этого ключа (404). ${msg}`;
  if (status === 429) return `Лимит запросов OpenAI (429). ${msg}`;
  return `${status ? `HTTP ${status}: ` : ''}${msg}`;
}

export async function runHealthCheck(): Promise<HealthReport> {
  const [database, schema, openai, python, telegram] = await Promise.all([
    timed(async () => {
      const { pool } = await import('../db');
      const { rows } = await pool.query('select count(*)::int as n from users');
      return `подключение есть, пользователей: ${rows[0]?.n ?? '?'}`;
    }),
    timed(async () => {
      const { ensureSchema } = await import('./ensureSchema');
      const r = await ensureSchema();
      if (r.error) throw new Error(r.error);
      if (r.missing.length) throw new Error(`в базе не хватает: ${r.missing.join(', ')}`);
      return r.added.length ? `добавлены колонки: ${r.added.join(', ')}` : 'совпадает со схемой';
    }),
    timed(async () => {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY не задан в Secrets');
      const { openai } = await import('./openai');
      try {
        const r = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        });
        return `gpt-4o отвечает (${r.model})`;
      } catch (e: any) {
        throw new Error(explainOpenAiError(e));
      }
    }),
    timed(
      () =>
        new Promise<string>((resolve, reject) => {
          const p = spawn('python3', ['-c', 'import swisseph as swe, sys; print(sys.version.split()[0], swe.version)']);
          let out = '', err = '';
          p.stdout.on('data', (d) => (out += d));
          p.stderr.on('data', (d) => (err += d));
          p.on('error', (e) => reject(new Error(`python3 не запускается: ${e.message}`)));
          p.on('close', (code) =>
            code === 0 ? resolve(`Python ${out.trim().replace(' ', ', Swiss Ephemeris ')}`) : reject(new Error(err.trim().split('\n').pop() || `код ${code}`)),
          );
        }),
      15_000,
    ),
    timed(async () => {
      if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не задан');
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
      const j: any = await r.json();
      if (!j.ok) throw new Error(j.description || `HTTP ${r.status}`);
      return `бот @${j.result.username}`;
    }, 10_000),
  ]);
  return { database, schema, openai, python, telegram };
}
