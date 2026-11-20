/**
 * Удержание: возвращаются ли люди после первого дня и что они успели сделать.
 *
 * Активность = любой просмотр экрана (events) или любое действие с записью в базе
 * (расклады, матрица, гороскопы, совместимость, Оракул, натал, соляр, списания звёзд).
 * Дни считаются по Москве. Админы и тестовые аккаунты (нечисловой tg_id) не учитываются.
 */
import { pool } from '../db';

const ACTIVITY = `
  select user_id, created_at from events where user_id is not null
  union all select user_id, created_at from tarot_readings
  union all select user_id, created_at from matrix_readings
  union all select user_id, created_at from horoscope_readings
  union all select user_id, created_at from compatibility_readings
  union all select user_id, created_at from ai_questions
  union all select user_id, created_at from usage_logs
  union all select user_id, created_at from natal_readings
  union all select user_id, created_at from solar_returns`;

/** Экраны, по которым смотрим «что сделал в первый день» (по просмотрам events) */
const SCREENS: Array<{ key: string; label: string; like: string }> = [
  { key: 'natal', label: 'Натальная карта', like: '/my-natal-chart%' },
  { key: 'matrix', label: 'Матрица судьбы', like: '/matrix%' },
  { key: 'tarot', label: 'Таро', like: '/tarot%' },
  { key: 'horoscope', label: 'Гороскоп', like: '/horoscope%' },
  { key: 'compat', label: 'Совместимость', like: '/compatibility%' },
  { key: 'ask', label: 'Оракул', like: '/ask%' },
  { key: 'solar', label: 'Соляр', like: '/solar%' },
  { key: 'subscribe', label: 'Экран подписки', like: '/subscribe%' },
];

export async function retentionReport(daysBack = 30) {
  const since = `now() - make_interval(days => ${Math.min(180, Math.max(7, Math.round(daysBack)))})`;
  const base = `
    with u as (
      select id, ((created_at at time zone 'UTC') + interval '3 hours')::date as d0
        from users
       where is_admin = false and tg_id ~ '^[0-9]+$' and created_at > ${since}
    ),
    days as (
      select a.user_id, ((a.created_at at time zone 'UTC') + interval '3 hours')::date as d
        from (${ACTIVITY}) a
       group by 1, 2
    ),
    per_user as (
      select u.id, u.d0,
             count(distinct d.d) filter (where d.d >= u.d0) as active_days,
             bool_or(d.d = u.d0 + 1) as d1,
             bool_or(d.d between u.d0 + 1 and u.d0 + 7) as w1,
             bool_or(d.d > u.d0) as returned
        from u left join days d on d.user_id = u.id
       group by u.id, u.d0
    )`;
  const today = `((now() at time zone 'UTC') + interval '3 hours')::date`;

  const { rows: [summary] } = await pool.query(`${base}
    select count(*)::int as users,
           count(*) filter (where returned)::int as returned,
           count(*) filter (where d0 <= ${today} - 1)::int as d1_base,
           count(*) filter (where d0 <= ${today} - 1 and d1)::int as d1,
           count(*) filter (where d0 <= ${today} - 7)::int as w1_base,
           count(*) filter (where d0 <= ${today} - 7 and w1)::int as w1,
           round(avg(active_days)::numeric, 2)::float as avg_active_days
      from per_user`);

  // Что открывали в первый день — и сколько из них вернулись потом
  const screenCases = SCREENS.map(
    (s) => `bool_or(e.value like '${s.like}' and ((e.created_at at time zone 'UTC') + interval '3 hours')::date = p.d0) as "${s.key}"`,
  ).join(',\n');
  const { rows: firstDay } = await pool.query(`${base},
    fd as (
      select p.id, p.returned, ${screenCases}
        from per_user p left join events e on e.user_id = p.id and e.name = 'page'
       group by p.id, p.returned
    )
    select ${SCREENS.map((s) => `count(*) filter (where "${s.key}")::int as "${s.key}", count(*) filter (where "${s.key}" and returned)::int as "${s.key}_ret"`).join(', ')},
           count(*)::int as total
      from fd`);

  const f = firstDay[0] || {};
  const screens = SCREENS.map((s) => ({
    key: s.key,
    label: s.label,
    users: f[s.key] ?? 0,
    returned: f[`${s.key}_ret`] ?? 0,
  })).sort((a, b) => b.users - a.users);

  // По дням регистрации (последние 14 дней)
  const { rows: cohorts } = await pool.query(`${base}
    select to_char(d0, 'DD.MM') as day, count(*)::int as users,
           count(*) filter (where returned)::int as returned
      from per_user where d0 > ${today} - 14
     group by d0 order by d0 desc`);

  // Сколько людей заходило в приложение в каждый из последних 14 дней (все, не только новые)
  const { rows: dau } = await pool.query(`
    select to_char(d, 'DD.MM') as day, count(distinct user_id)::int as users
      from (select a.user_id, ((a.created_at at time zone 'UTC') + interval '3 hours')::date as d
              from (${ACTIVITY}) a join users x on x.id = a.user_id
             where x.is_admin = false and a.created_at > now() - interval '15 days') t
     where d > ${today} - 14
     group by d order by d desc`);

  return { periodDays: daysBack, summary, screens, cohorts, dau };
}
