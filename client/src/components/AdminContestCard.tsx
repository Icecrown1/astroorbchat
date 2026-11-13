import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { contestEndLabel } from '@shared/referralContest';

interface AdminContestData {
  contest: { id: string; endsAt: string; prizeDays: number };
  announced: boolean;
  draw: { winnerId: string; winnerName: string; participants: number; drawnAt: string; forced?: boolean } | null;
  participants: Array<{ id: string; name: string; publicName: string; username: string | null; invited: number }>;
}

/** Админка: конкурс среди пригласивших — участники, анонс-пуш, розыгрыш */
export default function AdminContestCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | 'announce' | 'draw'>(null);
  const { data, isLoading } = useQuery<{ ok: boolean; data: AdminContestData }>({ queryKey: ['/api/admin/contest'] });
  const d = data?.data;
  const ended = d ? Date.now() >= new Date(d.contest.endsAt).getTime() : false;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/contest'] });
    queryClient.invalidateQueries({ queryKey: ['/api/contest/referral'] });
  };

  const announce = async () => {
    if (!d) return;
    const force = d.announced;
    if (!confirm(force ? 'Анонс уже отправляли. Отправить ВСЕМ ещё раз?' : 'Отправить анонс розыгрыша ВСЕМ пользователям?')) return;
    setBusy('announce');
    try {
      const r = await apiRequest('POST', '/api/admin/contest/announce', { force });
      if (r.ok) toast({ title: `Анонс отправлен: ${r.data.sent}`, description: `Заблокировали бота: ${r.data.blocked} · пропущено: ${r.data.skipped}` });
      else toast({ title: 'Ошибка рассылки', description: r.error, variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Ошибка рассылки', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); refresh(); }
  };

  const draw = async () => {
    if (!d) return;
    if (!confirm(ended
      ? `Провести розыгрыш среди ${d.participants.length} участников?`
      : `Срок ещё не вышел. Провести розыгрыш ДОСРОЧНО среди ${d.participants.length} участников? Отменить будет нельзя.`)) return;
    setBusy('draw');
    try {
      const r = await apiRequest('POST', '/api/admin/contest/draw', { force: !ended });
      if (r.ok) toast({ title: `Победитель: ${r.data.result.winnerName}`, description: 'Premium включён, пуши отправлены' });
      else toast({ title: 'Не получилось', description: r.error === 'no_participants' ? 'Пока нет ни одного участника' : r.error, variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Не получилось', description: e.message === 'no_participants' ? 'Пока нет ни одного участника' : e.message, variant: 'destructive' });
    } finally { setBusy(null); refresh(); }
  };

  return (
    <Card className="mt-4" data-testid="card-admin-contest">
      <CardHeader>
        <CardTitle>🎁 Розыгрыш месяца Premium</CardTitle>
        <CardDescription>
          Участник — тот, кто пригласил хотя бы одного друга, прошедшего регистрацию. Админы не участвуют.
          {d && <> Итоги — {contestEndLabel(d.contest.endsAt, 'ru')}; если не провести вручную, розыгрыш пройдёт автоматически.</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !d ? (
          <p className="text-sm text-muted-foreground">Загружаем…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Участников: {d.participants.length}</Badge>
              <Badge variant={d.announced ? 'default' : 'outline'}>{d.announced ? 'Анонс отправлен' : 'Анонс не отправлен'}</Badge>
              {d.draw && <Badge className="bg-[hsl(var(--solar-gold))] text-[hsl(var(--background))]">Победитель: {d.draw.winnerName}</Badge>}
            </div>

            {d.draw ? (
              <p className="text-sm text-muted-foreground">
                Розыгрыш проведён {new Date(d.draw.drawnAt).toLocaleString('ru-RU')}{d.draw.forced ? ' (досрочно)' : ''} среди {d.draw.participants} участников.
                Premium на {d.contest.prizeDays} дней выдан автоматически.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={announce} disabled={!!busy} variant={d.announced ? 'outline' : 'default'} data-testid="button-contest-announce">
                  {busy === 'announce' ? 'Рассылаем…' : d.announced ? '📣 Повторить анонс' : '📣 Разослать анонс всем'}
                </Button>
                <Button onClick={draw} disabled={!!busy || !d.participants.length} variant={ended ? 'default' : 'destructive'} data-testid="button-contest-draw">
                  {busy === 'draw' ? 'Выбираем…' : ended ? '🎲 Провести розыгрыш' : '🎲 Провести досрочно'}
                </Button>
              </div>
            )}

            {d.participants.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                {d.participants.map((p) => (
                  <div key={p.id} className={`flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-0 ${d.draw?.winnerId === p.id ? 'bg-[hsl(var(--solar-gold))]/10' : ''}`}>
                    <span className="min-w-0 truncate">
                      {d.draw?.winnerId === p.id ? '🏆 ' : ''}{p.name}{p.username ? <span className="text-muted-foreground"> · @{p.username}</span> : null}
                    </span>
                    <span className="shrink-0 text-muted-foreground">пригласил(а): {p.invited}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
