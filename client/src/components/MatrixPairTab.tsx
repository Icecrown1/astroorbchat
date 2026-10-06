import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrbIcon } from '@/components/OrbIcon';
import { Loader } from '@/components/Loader';
import { X, Share2, Heart } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useEnergy } from '@/store/useEnergy';
import { haptic } from '@/lib/haptics';
import { MatrixOctagram, type OctagramNode } from '@/components/MatrixOctagram';
import { PairReadingView } from '@/components/MatrixReading';
import { arcanaMetaByN } from '@shared/matrixArcanaMeta';
import { parseReadingV2, type MatrixCore } from '@shared/matrix';

export const PAIR_COST = 20;

export type PairResult = {
  key: string;
  partnerName: string;
  partnerBirthDate: string;
  userCore: MatrixCore;
  partnerCore: MatrixCore;
  pairCore: MatrixCore;
  reading: string;
  cached: boolean;
  charged: boolean;
  cost: number;
};

type SavedPair = { key: string; partnerName: string; partnerBirthDate: string };
type Guest = { id: string; name: string; birthDate: string };

const fmtDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/**
 * Вкладка «Совместимость»: матрица пары = сумма одноимённых позиций двух матриц.
 * Подаётся как карта устройства пары — без вердикта «совместимы / нет».
 */
export function MatrixPairTab({
  ru,
  locale,
  userName,
  pair,
  setPair,
  activeNodeId,
  onNodeTap,
  onCardZoom,
  onShareImage,
  onShareText,
  sharing,
  onNavigate,
}: {
  ru: boolean;
  locale: string;
  userName: string;
  pair: PairResult | null;
  setPair: (p: PairResult | null) => void;
  activeNodeId?: string;
  onNodeTap: (n: OctagramNode) => void;
  onCardZoom: (cardId: string) => void;
  onShareImage: () => void;
  onShareText: () => void;
  sharing: boolean;
  onNavigate: (path: string) => void;
}) {
  const { toast } = useToast();
  const { decreaseOrbs } = useEnergy();
  const [pName, setPName] = useState('');
  const [pDate, setPDate] = useState('');
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const { data: pairsData } = useQuery<{ ok: boolean; data: SavedPair[] }>({ queryKey: ['/api/matrix/pairs'] });
  const { data: guestsData } = useQuery<{ ok: boolean; data: Guest[] }>({ queryKey: ['/api/matrix/guests'] });

  const pairMutation = useMutation({
    mutationFn: async (v: { name: string; birthDate: string; key?: string }) => {
      const resp = await apiRequest('POST', '/api/matrix/pair', { name: v.name, birthDate: v.birthDate, locale });
      return resp.data as PairResult;
    },
    onMutate: (v) => setOpeningKey(v.key ?? 'new'),
    onSettled: () => setOpeningKey(null),
    onSuccess: (d) => {
      haptic.notify('success');
      setPair(d);
      setPName('');
      setPDate('');
      if (d.charged && d.cost) decreaseOrbs(d.cost);
      queryClient.invalidateQueries({ queryKey: ['/api/matrix/pairs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (e: any) => {
      haptic.notify('error');
      const code = e?.message || '';
      if (code === 'subscription_required' || code === 'premium_required') {
        toast({
          title: ru ? 'Нужна подписка' : 'Subscription needed',
          description: ru ? 'Совместимость по матрице доступна на Standard и Premium' : 'Matrix compatibility is available on Standard and Premium',
        });
        onNavigate('/subscribe');
      } else if (code === 'insufficient_orbs') {
        toast({
          title: ru ? 'Не хватает звёзд' : 'Not enough stars',
          description: ru ? `Совместимость стоит ${PAIR_COST} ⭐` : `Compatibility costs ${PAIR_COST} ⭐`,
        });
        onNavigate('/buy-energy');
      } else if (code === 'invalid_date' || code === 'name_and_date_required') {
        toast({ title: ru ? 'Проверьте имя и дату рождения' : 'Check the name and birth date', variant: 'destructive' });
      } else {
        toast({ title: ru ? 'Не получилось' : 'Something went wrong', description: ru ? 'Попробуйте ещё раз — звёзды не списаны' : 'Please try again — no stars were charged', variant: 'destructive' });
      }
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(pDate) && pDate >= '1900-01-01' && pDate <= today;
  const busyNew = pairMutation.isPending && openingKey === 'new';
  const guests = guestsData?.data ?? [];
  const saved = pairsData?.data ?? [];

  /* ---------- Результат ---------- */
  if (pair) {
    const reading = parseReadingV2(pair.reading);
    const centers = [
      { label: ru ? 'Ваш центр' : 'Your center', n: pair.userCore.e, accent: false },
      { label: ru ? `Центр: ${pair.partnerName}` : `${pair.partnerName}'s center`, n: pair.partnerCore.e, accent: false },
      { label: ru ? 'Центр пары' : 'Couple center', n: pair.pairCore.e, accent: true },
    ];
    return (
      <>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">
              {userName} + {pair.partnerName}
            </p>
            <p className="text-xs text-muted-foreground">
              {ru ? 'Дата рождения партнёра' : "Partner's birth date"}: {fmtDate(pair.partnerBirthDate)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { haptic.select(); setPair(null); }} data-testid="button-pair-close">
            <X className="mr-1 h-4 w-4" />
            {ru ? 'К списку' : 'Back'}
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {centers.map((c) => (
            <Card key={c.label} className={`p-2.5 text-center ${c.accent ? 'border-primary/60 bg-primary/10' : ''}`}>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${c.accent ? 'text-primary' : ''}`}>{c.n}</p>
              <p className="truncate text-[11px] text-muted-foreground">{ru ? arcanaMetaByN(c.n)?.ru : arcanaMetaByN(c.n)?.en}</p>
            </Card>
          ))}
        </div>

        <Card className="anim-fade-up wheel-nebula p-4">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {ru ? 'Матрица пары — сумма ваших матриц' : 'Couple matrix — the sum of your two matrices'}
          </p>
          <MatrixOctagram core={pair.pairCore} zone="all" onNodeTap={onNodeTap} activeNodeId={activeNodeId} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {ru ? 'Нажмите на любую точку матрицы' : 'Tap any point of the matrix'}
          </p>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onShareImage} disabled={sharing} data-testid="button-share-pair-image">
            <Share2 className="mr-2 h-4 w-4" />
            {sharing ? (ru ? 'Готовим…' : 'Preparing…') : (ru ? 'Поделиться матрицей пары' : 'Share the couple matrix')}
          </Button>
        </Card>

        <Card className="mt-6 p-4 anim-fade-up">
          <h2 className="font-display text-lg font-semibold">{ru ? 'Как устроена ваша пара' : 'How your couple works'}</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            {ru ? 'Сильные стороны и точки роста в пяти зонах матрицы пары' : 'Strengths and growth points across the five zones of the couple matrix'}
          </p>
          {reading?.kind === 'pair' ? (
            <PairReadingView r={reading} ru={ru} onCardZoom={onCardZoom} />
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{pair.reading}</p>
          )}
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onShareText} data-testid="button-share-pair-text">
            <Share2 className="mr-2 h-4 w-4" />
            {ru ? 'Поделиться разбором пары' : 'Share the couple reading'}
          </Button>
        </Card>
      </>
    );
  }

  /* ---------- Форма + сохранённые пары ---------- */
  return (
    <>
      <Card className="p-4 anim-fade-up">
        <div className="mb-1 flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">{ru ? 'Совместимость по матрице судьбы' : 'Matrix of Destiny compatibility'}</h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {ru
            ? 'Сложим вашу матрицу с матрицей партнёра и покажем, как устроена пара: на чём держится союз, быт, деньги, общий кармический хвост и задача пары. Без вердикта «совместимы / нет» — только сильные стороны и зоны роста.'
            : "We add your matrix to your partner's and show how the couple works: what holds you together, everyday life, money, the shared karmic tail and your purpose as a couple. No 'compatible / not compatible' verdict — just strengths and growth areas."}
        </p>

        {guests.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] text-muted-foreground">{ru ? 'Выбрать из сохранённых:' : 'Pick from saved:'}</p>
            <div className="-mx-1 flex flex-wrap gap-1.5">
              {guests.slice(0, 8).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { haptic.select(); setPName(g.name); setPDate(g.birthDate); }}
                  className={`mx-1 min-h-[36px] rounded-full border px-3 text-xs transition-colors ${
                    pName === g.name && pDate === g.birthDate ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground'
                  }`}
                  data-testid={`pair-pick-${g.id}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder={ru ? 'Имя партнёра' : "Partner's name"} maxLength={60} className="mb-2 h-11" data-testid="input-pair-name" />
        <Input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} min="1900-01-01" max={today} className="mb-3 h-11" data-testid="input-pair-date" />
        <Button
          className="h-11 w-full"
          disabled={pairMutation.isPending || !pName.trim() || !dateOk}
          onClick={() => { haptic.impact('medium'); pairMutation.mutate({ name: pName.trim(), birthDate: pDate }); }}
          data-testid="button-pair-calc"
        >
          {busyNew ? (
            ru ? 'Складываем матрицы…' : 'Combining your matrices…'
          ) : (
            <>
              {ru ? 'Рассчитать совместимость' : 'Calculate compatibility'} <OrbIcon className="mx-1 h-4 w-4" /> {PAIR_COST}
            </>
          )}
        </Button>
        {busyNew && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {ru ? 'Пишем разбор по пяти зонам — обычно это занимает до минуты' : 'Writing the reading for five zones — usually takes up to a minute'}
          </p>
        )}
      </Card>

      {saved.length > 0 && (
        <div className="mt-5 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{ru ? 'Ваши пары' : 'Your couples'}</h2>
          {saved.map((p) => {
            const busy = pairMutation.isPending && openingKey === p.key;
            return (
              <Card
                key={p.key}
                className={`hover-elevate cursor-pointer p-3 ${pairMutation.isPending ? 'pointer-events-none opacity-70' : ''}`}
                onClick={() => { haptic.select(); pairMutation.mutate({ name: p.partnerName, birthDate: p.partnerBirthDate, key: p.key }); }}
                data-testid={`pair-${p.key}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{userName} + {p.partnerName}</span>
                  {busy ? <Loader size="sm" /> : <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(p.partnerBirthDate)}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        {ru
          ? 'Повторное открытие сохранённой пары — бесплатно.'
          : 'Reopening a saved couple reading is free.'}
      </p>
    </>
  );
}
