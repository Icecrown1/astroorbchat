import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Lock, Users, Plus, X, Share2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';
import { MatrixOctagram, type MatrixZone, type OctagramNode } from '@/components/MatrixOctagram';
import { arcanaMetaByN, arcanaCardId } from '@shared/matrixArcanaMeta';
import { haptic } from '@/lib/haptics';
import { makeCanvas, drawCosmicBg, drawWrappedText, drawFooter, fontsReady, sendShareImage, shareColors, SHARE_W } from '@/lib/shareCard';
import { shareOrCopyText, funnelFooter } from '@/lib/shareText';
import { useAuth } from '@/store/useAuth';
import type { MatrixCore, MatrixSectionId } from '@shared/matrix';
import { arcanaOfYear } from '@shared/matrix';

type SectionState = { id: MatrixSectionId; free: boolean; content: string | null };
type MatrixResponse = { ok: boolean; core: MatrixCore; sections: SectionState[] };

const SECTION_COST = 5;

const ZONES: { id: MatrixZone; ru: string; en: string }[] = [
  { id: 'all', ru: 'Вся матрица', en: 'Full matrix' },
  { id: 'personal', ru: 'Личность', en: 'Personality' },
  { id: 'money', ru: 'Деньги', en: 'Money' },
  { id: 'love', ru: 'Любовь', en: 'Love' },
  { id: 'karma', ru: 'Карма', en: 'Karma' },
  { id: 'purpose', ru: 'Предназначение', en: 'Purpose' },
  { id: 'rod', ru: 'Род', en: 'Ancestry' },
];

const SECTIONS_META: Record<MatrixSectionId, { ru: string; en: string; descRu: string; descEn: string }> = {
  comfort: { ru: 'Зона комфорта', en: 'Comfort zone', descRu: 'Центр матрицы: ядро личности и главный ресурс', descEn: 'Matrix center: core self and main resource' },
  persona: { ru: 'Визитная карточка', en: 'Calling card', descRu: 'Как вас считывают при первой встрече', descEn: 'How people read you at first sight' },
  karmic_tail: { ru: 'Кармический хвост', en: 'Karmic tail', descRu: 'Опыт прошлого, который «держит» деньги и отношения', descEn: 'Past patterns holding money and love back' },
  money: { ru: 'Денежный канал', en: 'Money channel', descRu: 'Как деньги входят в вашу жизнь и что блокирует поток', descEn: 'How money enters your life and what blocks it' },
  love: { ru: 'Канал отношений', en: 'Love channel', descRu: 'Какой партнёр «ваш» и что мешает встрече', descEn: 'Your kind of partner and what stands in the way' },
  purpose: { ru: 'Предназначение', en: 'Purpose', descRu: 'Личное, социальное, духовное и планетарное — 4 уровня', descEn: 'Personal, social, spiritual, planetary — 4 levels' },
  rod: { ru: 'Родовой квадрат', en: 'Ancestral square', descRu: 'Программы рода по четырём линиям', descEn: 'Family programs across four lines' },
  year: { ru: 'Аркан года', en: 'Year arcana', descRu: 'Тема и уроки вашего личного года', descEn: 'Theme and lessons of your personal year' },
};

export default function Matrix() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { locale } = useTranslation();
  const { decreaseOrbs } = useEnergy();
  const ru = locale === 'ru';

  const [zone, setZone] = useState<MatrixZone>('all');
  const [tapped, setTapped] = useState<OctagramNode | null>(null);
  const [cardZoom, setCardZoom] = useState<string | null>(null); // id карты Таро в лайтбоксе
  // Режим «для другого человека»
  const [guestMode, setGuestMode] = useState(false);
  const [guest, setGuest] = useState<{ id: string; name: string; birthDate: string; core: MatrixCore; sections?: SectionState[] } | null>(null);
  const [gName, setGName] = useState('');
  const [gDate, setGDate] = useState('');
  const [pendingSection, setPendingSection] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<MatrixResponse>({
    queryKey: ['/api/matrix/me', locale],
    queryFn: async () => {
      // apiRequest в этом проекте сам парсит JSON и бросает Error(message) на не-2xx
      return (await apiRequest('GET', `/api/matrix/me?locale=${locale}`)) as MatrixResponse;
    },
  });

  const sectionMutation = useMutation({
    mutationFn: async (section: MatrixSectionId) => {
      return await apiRequest('POST', '/api/matrix/section', { section, locale, guestId: guestMode && guest ? guest.id : undefined });
    },
    onMutate: (section) => setPendingSection(section),
    onSettled: () => setPendingSection(null),
    onSuccess: (resp, section) => {
      if (guestMode) {
        setGuest((g) => g ? {
          ...g,
          sections: (g.sections || []).map((x) => (x.id === section ? { ...x, content: resp.content } : x)),
        } : g);
      }
      queryClient.setQueryData<MatrixResponse>(['/api/matrix/me', locale], (old) =>
        old
          ? { ...old, sections: old.sections.map((s) => (s.id === section ? { ...s, content: resp.content } : s)) }
          : old,
      );
      haptic.notify('success');
      const wasFree = data?.sections.find((s) => s.id === section)?.free;
      if (!wasFree && !resp.cached) decreaseOrbs(SECTION_COST);
    },
    onError: (e: any) => {
      haptic.notify('error');
      const code = e?.message || '';
      if (code === 'subscription_required' || code === 'premium_required') {
        toast({
          title: ru ? 'Нужна подписка' : 'Subscription needed',
          description: ru ? 'Платные разделы матрицы доступны на Standard и Premium' : 'Paid matrix sections are available on Standard and Premium',
        });
        setLocation('/subscribe');
      } else if (code === 'insufficient_orbs') {
        toast({
          title: ru ? 'Не хватает звёзд' : 'Not enough stars',
          description: ru ? `Раздел стоит ${SECTION_COST} ⭐ (Аркан года — 3 ⭐)` : `A section costs ${SECTION_COST} ⭐ (Year arcana — 3 ⭐)`,
        });
        setLocation('/buy-energy');
      } else {
        toast({ title: ru ? 'Не получилось' : 'Something went wrong', description: ru ? 'Попробуйте ещё раз' : 'Please try again', variant: 'destructive' });
      }
    },
  });

  // Дип-линк web_matrix_*: если пришли с сайта — мы уже здесь; сбрасываем маркер
  useEffect(() => {
    sessionStorage.removeItem('astro_pending_matrix');
  }, []);

  const core = guestMode ? guest?.core : data?.core; // гостевой режим рисует матрицу гостя
  const { data: guestsData } = useQuery<{ ok: boolean; data: Array<{ id: string; name: string; birthDate: string }> }>({
    queryKey: ['/api/matrix/guests'],
    enabled: guestMode,
  });

  const guestMutation = useMutation({
    mutationFn: async (payload: { name: string; birthDate: string }) => {
      const resp = await apiRequest('POST', '/api/matrix/guest', payload);
      if (!resp.ok) { const e: any = new Error(resp.error); e.code = resp.error; e.cost = resp.cost; throw e; }
      return resp.data;
    },
    onSuccess: (d) => {
      haptic.notify('success');
      setGuest(d); setGName(''); setGDate('');
      queryClient.invalidateQueries({ queryKey: ['/api/matrix/guests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
    },
    onError: (e: any) => {
      haptic.notify('error');
      if (e.code === 'subscription_required') { toast({ title: ru ? 'Нужна подписка' : 'Subscription needed' }); setLocation('/subscribe'); }
      else if (e.code === 'insufficient_orbs') { toast({ title: ru ? `Не хватает звёзд (нужно ${e.cost} ⭐)` : `Not enough stars (${e.cost} ⭐)` }); setLocation('/buy-energy'); }
      else toast({ title: ru ? 'Не получилось' : 'Failed', variant: 'destructive' });
    },
  });

  const openGuest = async (id: string) => {
    try {
      const resp = await apiRequest('GET', `/api/matrix/guest/${id}?locale=${locale}`);
      if (resp.ok) { haptic.select(); setGuest(resp.data); }
    } catch { /* noop */ }
  };

  const [sharing, setSharing] = useState(false);

  const shareMatrix = async () => {
    haptic.impact('medium');
    setSharing(true);
    try {
      await fontsReady();
      const svgEl = document.querySelector('svg[data-octagram]') as SVGSVGElement | null;
      if (!svgEl) throw new Error('octagram not found');
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '400'); clone.setAttribute('height', '400');
      const svgText = new XMLSerializer().serializeToString(clone);
      const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = svgUrl;
      });

      const { canvas, ctx } = makeCanvas();
      drawCosmicBg(ctx);

      ctx.textAlign = 'center';
      ctx.fillStyle = shareColors.INK;
      ctx.font = '52px Prata, serif';
      const title = guestMode && guest ? guest.name : (ru ? 'Моя Матрица судьбы' : 'My Matrix of Destiny');
      drawWrappedText(ctx, title, SHARE_W / 2, 140, 900, 64, 2);
      const dateLine = guestMode && guest ? guest.birthDate : '';
      if (dateLine) {
        ctx.fillStyle = shareColors.MUTED;
        ctx.font = '32px Inter, sans-serif';
        ctx.fillText(dateLine, SHARE_W / 2, 210);
      }

      const size = 880;
      ctx.drawImage(img, (SHARE_W - size) / 2, 260, size, size);
      URL.revokeObjectURL(svgUrl);

      await drawFooter(ctx, ru ? 'Рассчитай свою матрицу — бесплатно в AstroOrbi' : 'Calculate your own matrix — free in AstroOrbi');

      const caption = guestMode && guest
        ? (ru ? `Матрица судьбы: ${guest.name} ✨` : `Matrix of Destiny: ${guest.name} ✨`)
        : (ru ? 'Моя Матрица судьбы в AstroOrbi ✨' : 'My Matrix of Destiny in AstroOrbi ✨');
      const result = await sendShareImage(canvas, caption, locale);
      if (result === 'downloaded') toast({ title: ru ? 'Картинка сохранена' : 'Image saved' });
    } catch (e) {
      console.error('[SHARE] matrix failed', e);
      toast({ title: ru ? 'Не получилось поделиться' : 'Share failed', variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const shareReadings = async () => {
    haptic.impact('medium');
    const src = guestMode ? (guest?.sections || []) : (data?.sections || []);
    const opened = src.filter((x: any) => x.content);
    if (!opened.length) {
      toast({ title: ru ? 'Сначала откройте хотя бы один раздел' : 'Open at least one section first' });
      return;
    }
    const title = guestMode && guest
      ? (ru ? `🔯 Матрица судьбы: ${guest.name} (${guest.birthDate})` : `🔯 Matrix of Destiny: ${guest.name} (${guest.birthDate})`)
      : (ru ? '🔯 Моя Матрица судьбы' : '🔯 My Matrix of Destiny');
    const parts = [title];
    for (const sec of opened.slice(0, 4)) {
      const meta = SECTIONS_META[sec.id as MatrixSectionId];
      const label = meta ? (ru ? meta.ru : meta.en) : sec.id;
      parts.push(`✦ ${label}\n${String(sec.content).slice(0, 700)}`);
    }
    if (opened.length > 4) parts.push(ru ? `…и ещё ${opened.length - 4} раздел(а) в приложении` : `…and ${opened.length - 4} more sections in the app`);
    parts.push(funnelFooter(locale, (user as any)?.referralCode));
    const r = await shareOrCopyText(parts.join('\n\n'), locale);
    if (r === 'copied') toast({ title: ru ? 'Разбор скопирован' : 'Reading copied' });
  };

  const tappedMeta = tapped ? arcanaMetaByN(tapped.value) : null;
  const activeCore: MatrixCore | null = guestMode ? (guest?.core ?? null) : (data?.core ?? null);

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard')} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{ru ? 'Матрица судьбы' : 'Matrix of Destiny'}</h1>
            <p className="text-xs text-muted-foreground">
              {ru ? '22 аркана по вашей дате рождения' : '22 arcana from your birth date'}
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-1.5 p-1 rounded-xl bg-muted/50">
          <button
            type="button"
            className={`flex-1 h-11 rounded-lg text-sm transition-colors ${!guestMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            onClick={() => { haptic.select(); setGuestMode(false); }}
            data-testid="matrix-tab-my"
          >
            {ru ? 'Моя матрица' : 'My matrix'}
          </button>
          <button
            type="button"
            className={`flex-1 h-11 rounded-lg text-sm transition-colors ${guestMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            onClick={() => { haptic.select(); setGuestMode(true); setTapped(null); }}
            data-testid="matrix-tab-guest"
          >
            {ru ? 'Для другого' : 'For someone else'}
          </button>
        </div>

        {isError ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {ru ? 'Не получилось построить матрицу. Проверьте соединение и попробуйте ещё раз.' : 'Could not build the matrix. Check your connection and try again.'}
            </p>
            <Button className="mt-4" onClick={() => refetch()}>{ru ? 'Повторить' : 'Retry'}</Button>
          </Card>
        ) : guestMode && !guest ? (
          <>
            <Card className="p-4 anim-fade-up">
              <h2 className="font-display font-semibold mb-1">{ru ? 'Матрица для другого человека' : 'Matrix for someone else'}</h2>
              <p className="text-xs text-muted-foreground mb-3">
                {ru ? 'Октаграмма, зоны и арканы по дате рождения. Разборы разделов доступны только для своей матрицы.' : 'Octagram, zones and arcana by birth date. Section readings are for your own matrix only.'}
              </p>
              <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder={ru ? 'Имя человека' : 'Person name'} className="h-11 mb-2" data-testid="input-guest-name" />
              <Input type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="h-11 mb-3" data-testid="input-guest-date" />
              <Button
                className="w-full h-11"
                disabled={guestMutation.isPending || !gName.trim() || !gDate}
                onClick={() => { haptic.impact('medium'); guestMutation.mutate({ name: gName.trim(), birthDate: gDate }); }}
                data-testid="button-guest-calc"
              >
                {guestMutation.isPending ? (ru ? 'Считаем…' : 'Calculating…') : (<>{ru ? 'Построить матрицу' : 'Build the matrix'} <OrbIcon className="w-4 h-4 mx-1" /> 15</>)}
              </Button>
            </Card>

            {(guestsData?.data?.length ?? 0) > 0 && (
              <div className="mt-5 space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">{ru ? 'Сохранённые' : 'Saved'}</h2>
                {guestsData!.data.map((g) => (
                  <Card key={g.id} className="p-3 hover-elevate cursor-pointer" onClick={() => openGuest(g.id)} data-testid={`guest-${g.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.birthDate}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (isLoading && !guestMode) || !core ? (
          <div className="py-24 flex justify-center"><Loader /></div>
        ) : (
          <>
            {/* Фильтры зон */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mx-no-scrollbar">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => { haptic.select(); setZone(z.id); }}
                  aria-pressed={zone === z.id}
                  className={`whitespace-nowrap rounded-full border px-4 py-2.5 min-h-[44px] text-xs transition-colors flex items-center ${
                    zone === z.id ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  {ru ? z.ru : z.en}
                </button>
              ))}
            </div>

            {guestMode && guest && (
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold">{guest.name}</p>
                  <p className="text-xs text-muted-foreground">{guest.birthDate}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { haptic.select(); setGuest(null); }} data-testid="button-guest-close">
                  <X className="w-4 h-4 mr-1" />{ru ? 'К списку' : 'Back'}
                </Button>
              </div>
            )}

            <Card className="p-4 anim-fade-up wheel-nebula">
              <MatrixOctagram core={core} zone={zone} onNodeTap={(n) => { haptic.impact('light'); setTapped(n); }} activeNodeId={tapped?.id} />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {ru ? 'Нажмите на любую точку матрицы' : 'Tap any point of the matrix'}
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={shareMatrix} disabled={sharing} data-testid="button-share-matrix">
                <Share2 className="w-4 h-4 mr-2" />
                {sharing ? (ru ? 'Готовим…' : 'Preparing…') : (ru ? 'Поделиться' : 'Share')}
              </Button>
            </Card>

            {core && (() => {
              const yn = arcanaOfYear(core, new Date().getFullYear());
              const ym = arcanaMetaByN(yn);
              const cid = arcanaCardId(yn);
              return (
                <Card className="mt-6 p-3 flex items-center gap-3 anim-fade-up" data-testid="card-year-arcana">
                  {cid && (
                    <button type="button" className="shrink-0 w-14 rounded-lg overflow-hidden border border-[hsl(41,50%,40%)]/50" onClick={() => { haptic.impact('light'); setCardZoom(cid); }}>
                      <img src={`/tarot/${cid}.webp`} alt="" className="w-full h-auto" loading="lazy" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {ru ? `Аркан ${new Date().getFullYear()} года` : `Arcana of ${new Date().getFullYear()}`}
                    </p>
                    <p className="font-display font-semibold truncate">{yn} · {ym ? (ru ? ym.ru : ym.en) : ''}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ru ? 'Личная тема года — разбор в списке ниже (3 ⭐)' : 'Your personal year theme — reading below (3 ⭐)'}
                    </p>
                  </div>
                </Card>
              );
            })()}

            {(<>
            {/* Секции разбора */}
            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {ru ? 'Разбор по разделам' : 'Section readings'}
              </h2>
              {(guestMode ? (guest?.sections || []) : (data?.sections || [])).map((s, idx) => {
                const meta = SECTIONS_META[s.id];
                const busy = pendingSection === s.id;
                return (
                  <Card key={s.id} className={`p-4 tap-scale anim-fade-up anim-d${Math.min(idx + 1, 6)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{ru ? meta.ru : meta.en}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{ru ? meta.descRu : meta.descEn}</p>
                      </div>
                      {!s.content && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => { haptic.impact('medium'); sectionMutation.mutate(s.id); }}
                          data-testid={`button-matrix-${s.id}`}
                        >
                          {busy ? (
                            <OrbIcon className="h-4 w-4 animate-pulse" />
                          ) : s.free ? (
                            ru ? 'Открыть бесплатно' : 'Open free'
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3.5 w-3.5" /> {s.id === 'year' ? 3 : SECTION_COST} <OrbIcon className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                    {s.content && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{s.content}</p>
                    )}
                  </Card>
                );
              })}
            </div>

              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={shareReadings} data-testid="button-share-readings">
                <Share2 className="w-4 h-4 mr-2" />
                {ru ? 'Поделиться разбором (текст)' : 'Share readings (text)'}
              </Button>
            </>)}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              {ru
                ? 'Матрица судьбы — нумерологическая система для саморефлексии. Не является научным методом, медицинской или финансовой рекомендацией.'
                : 'Matrix of Destiny is a numerological self-reflection system. Not a scientific method, medical or financial advice.'}
            </p>
          </>
        )}
      </div>

      {/* Шторка узла */}
      <Drawer open={!!tapped} onOpenChange={(o) => !o && setTapped(null)}>
        <DrawerContent>
          {tapped && tappedMeta && (
            <div className="mx-auto w-full max-w-lg px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-lg font-bold text-primary">
                    {tapped.value}
                  </span>
                  {ru ? tappedMeta.ru : tappedMeta.en}
                </DrawerTitle>
                <DrawerDescription>
                  {ru ? tapped.label.ru : tapped.label.en} · {ru ? tappedMeta.keyRu : tappedMeta.keyEn}
                </DrawerDescription>
              </DrawerHeader>
              {arcanaCardId(tapped.value) && (
                <button
                  type="button"
                  className="mx-auto mb-3 block w-[132px] rounded-xl overflow-hidden border border-[hsl(41,50%,40%)]/60 tap-scale"
                  onClick={() => { haptic.impact('light'); setCardZoom(arcanaCardId(tapped.value)); }}
                  aria-label={ru ? 'Увеличить карту' : 'Zoom the card'}
                  data-testid="button-arcana-card"
                >
                  <img src={`/tarot/${arcanaCardId(tapped.value)}.webp`} alt="" className="w-full h-auto" loading="lazy"
                       onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                </button>
              )}
              <p className="text-center text-[11px] text-muted-foreground mb-3">
                {ru ? 'Нажмите на карту, чтобы рассмотреть' : 'Tap the card to view it large'}
              </p>
              <p className="text-sm text-muted-foreground">
                {ru
                  ? (guestMode
                    ? 'Ключ аркана — выше. Полные AI-разборы доступны в вашей собственной матрице.'
                    : 'Полное значение этого аркана в вашей матрице — в разборах разделов ниже на странице.')
                  : (guestMode
                    ? 'The arcana key is above. Full AI readings are available in your own matrix.'
                    : 'The full meaning of this arcana in your matrix is in the section readings below.')}
              </p>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Лайтбокс карты аркана */}
      {cardZoom && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col" onClick={() => setCardZoom(null)} data-testid="arcana-lightbox">
          <div className="flex justify-end p-4">
            <button type="button" className="p-2 rounded-full bg-muted/60 text-foreground" onClick={() => setCardZoom(null)} aria-label={ru ? 'Закрыть' : 'Close'}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <img src={`/tarot/${cardZoom}.webp`} alt="" className="max-h-full max-w-full object-contain rounded-xl" onClick={() => setCardZoom(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
