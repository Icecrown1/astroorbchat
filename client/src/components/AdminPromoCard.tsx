import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Promo { id: string; amount: number; days: number; startedAt: string; endsAt: string; granted?: number; feedbackAsked?: number }

/** Админка: акция «N звёзд всем + пробный доступ на D дней», пуш сразу, просьба об отзыве — через сутки */
export default function AdminPromoCard() {
  const { toast } = useToast();
  const [amount, setAmount] = useState('50');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const { data } = useQuery<{ ok: boolean; data: { active: Promo | null; campaigns: Promo[] } }>({ queryKey: ['/api/admin/promo'] });
  const active = data?.data?.active;
  const campaigns = data?.data?.campaigns || [];
  const fmt = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const start = async () => {
    const a = parseInt(amount) || 50;
    const d = parseInt(days) || 7;
    if (!confirm(`Начислить ВСЕМ по ${a} звёзд, открыть пробный доступ на ${d} дн. и разослать пуш? Отменить будет нельзя.`)) return;
    setBusy(true);
    try {
      const r = await apiRequest('POST', '/api/admin/promo/start', { amount: a, days: d, push: true });
      toast({ title: `Начислено: ${r.data.granted} пользователям`, description: 'Пуш рассылается в фоне. Новые пользователи получат звёзды при первом входе, пока идёт акция.' });
    } catch (e: any) {
      toast({ title: 'Не получилось', description: e.message === 'already_active' ? 'Акция уже идёт' : e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promo'] });
    }
  };

  return (
    <Card className="mt-4" data-testid="card-admin-promo">
      <CardHeader>
        <CardTitle>🎁 Звёзды всем + пробный доступ</CardTitle>
        <CardDescription>
          Каждому начисляются звёзды и открываются все функции (включая Premium, например соляр) на выбранный срок — даже на бесплатном тарифе.
          Сразу уходит пуш, через сутки — пуш «Как вам AstroOrbi?» с формой отзыва. Новые пользователи получают то же при первом входе, пока акция идёт.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {active ? (
          <div className="rounded-lg border border-border p-3 text-sm">
            <Badge className="mb-2">Идёт акция</Badge>
            <p>+{active.amount} звёзд, доступ {active.days} дн. · с {fmt(active.startedAt)} до {fmt(active.endsAt)}</p>
            {campaigns[0]?.id === active.id && (
              <p className="mt-1 text-muted-foreground">
                Начислено: {campaigns[0].granted} · просьба об отзыве отправлена: {campaigns[0].feedbackAsked}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Звёзд каждому
              <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mt-1 w-28" data-testid="input-promo-amount" />
            </label>
            <label className="text-sm">
              Пробный доступ, дней
              <Input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mt-1 w-28" data-testid="input-promo-days" />
            </label>
            <Button onClick={start} disabled={busy} data-testid="button-promo-start">
              {busy ? 'Начисляем…' : '🎁 Начислить и разослать пуш'}
            </Button>
          </div>
        )}

        {campaigns.filter((c) => c.id !== active?.id).length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Прошлые акции</p>
            {campaigns.filter((c) => c.id !== active?.id).map((c) => (
              <p key={c.id}>{fmt(c.startedAt)}: +{c.amount} звёзд, {c.days} дн. · начислено {c.granted} · отзыв запрошен {c.feedbackAsked}</p>
            ))}
          </div>
        )}

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Куда приходят отзывы</p>
          <p className="mt-1">
            Добавьте бота в группу для отзывов — он пришлёт ID чата. Впишите его в Secrets как <code>FEEDBACK_CHAT_ID</code> и перезапустите сервер.
            Пока чат не настроен, отзывы приходят в чат поддержки, а если его нет — лично админам в бота.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
