import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Retention {
  periodDays: number;
  summary: { users: number; returned: number; d1_base: number; d1: number; w1_base: number; w1: number; avg_active_days: number };
  screens: Array<{ key: string; label: string; users: number; returned: number }>;
  cohorts: Array<{ day: string; users: number; returned: number }>;
  dau: Array<{ day: string; users: number }>;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Админка: удержание — вернулись ли люди после первого дня и что они открывали в первый день */
export default function AdminRetentionCard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery<{ ok: boolean; data: Retention }>({ queryKey: [`/api/admin/retention?days=${days}`] });
  const r = data?.data;

  return (
    <Card className="mb-4" data-testid="card-admin-retention">
      <CardHeader>
        <CardTitle>Удержание</CardTitle>
        <CardDescription>
          Возвращаются ли люди после дня регистрации. Активность — любой экран или действие в приложении, дни по Москве, админы не считаются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          {[14, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)} data-testid={`retention-days-${d}`}>
              {d} дней
            </Button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Считаем…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {r && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Новых пользователей" value={String(r.summary.users)} />
              <Stat label="Вернулись хоть раз" value={pct(r.summary.returned, r.summary.users)} hint={`${r.summary.returned} из ${r.summary.users}`} />
              <Stat label="Вернулись на следующий день" value={pct(r.summary.d1, r.summary.d1_base)} hint={`${r.summary.d1} из ${r.summary.d1_base}`} />
              <Stat label="Вернулись за первую неделю" value={pct(r.summary.w1, r.summary.w1_base)} hint={`${r.summary.w1} из ${r.summary.w1_base} (зарег. ≥7 дн. назад)`} />
            </div>
            <p className="text-xs text-muted-foreground">В среднем активных дней на человека: {r.summary.avg_active_days ?? 0}</p>

            <div>
              <p className="mb-2 text-sm font-medium">Что открывали в первый день — и сколько из них вернулись</p>
              <div className="space-y-1">
                {r.screens.map((s) => (
                  <div key={s.key} className="flex justify-between border-b border-border/50 py-1.5 text-sm">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">
                      {s.users} чел ({pct(s.users, r.summary.users)}) · вернулись {pct(s.returned, s.users)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">По дням регистрации</p>
                {r.cohorts.map((c) => (
                  <div key={c.day} className="flex justify-between border-b border-border/50 py-1 text-sm">
                    <span>{c.day}</span>
                    <span className="text-muted-foreground">{c.users} новых · вернулись {c.returned} ({pct(c.returned, c.users)})</span>
                  </div>
                ))}
                {!r.cohorts.length && <p className="text-sm text-muted-foreground">Нет регистраций за 14 дней</p>}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Заходили в приложение (все пользователи)</p>
                {r.dau.map((d) => (
                  <div key={d.day} className="flex justify-between border-b border-border/50 py-1 text-sm">
                    <span>{d.day}</span>
                    <span className="text-muted-foreground">{d.users} чел</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
