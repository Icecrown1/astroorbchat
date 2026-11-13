import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

type Item = { ok: boolean; detail: string; ms: number };
const LABELS: Record<string, string> = {
  database: 'База данных',
  schema: 'Схема базы',
  openai: 'OpenAI (генерация текстов)',
  python: 'Python + Swiss Ephemeris (расчёт карт)',
  telegram: 'Бот Telegram',
};

/** Админка: «Проверить систему» — какие внешние зависимости сейчас работают */
export default function AdminHealthCard() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Record<string, Item> | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await apiRequest('GET', '/api/admin/health');
      setReport(r.data);
    } catch (e: any) {
      setError(e.message || 'Не удалось выполнить проверку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="card-admin-health">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Проверка системы</CardTitle>
          <CardDescription>Если что-то не генерируется или не открывается — нажмите и посмотрите, что сломано.</CardDescription>
        </div>
        <Button onClick={run} disabled={busy} data-testid="button-health-check">
          {busy ? 'Проверяем…' : '🩺 Проверить'}
        </Button>
      </CardHeader>
      {(report || error) && (
        <CardContent className="space-y-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {report && Object.entries(report).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 text-sm" data-testid={`health-${k}`}>
              <span className="shrink-0">{v.ok ? '✅' : '❌'}</span>
              <div className="min-w-0">
                <p className="font-medium">{LABELS[k] || k} <span className="text-xs text-muted-foreground">· {v.ms} мс</span></p>
                <p className={`break-words text-xs ${v.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{v.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
