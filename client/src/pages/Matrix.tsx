import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Lock, Sparkles } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';
import { MatrixOctagram, type MatrixZone, type OctagramNode } from '@/components/MatrixOctagram';
import { arcanaMetaByN } from '@shared/matrixArcanaMeta';
import { haptic } from '@/lib/haptics';
import type { MatrixCore, MatrixSectionId } from '@shared/matrix';

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
};

export default function Matrix() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { locale } = useTranslation();
  const { decreaseOrbs } = useEnergy();
  const ru = locale === 'ru';

  const [zone, setZone] = useState<MatrixZone>('all');
  const [tapped, setTapped] = useState<OctagramNode | null>(null);
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
      return await apiRequest('POST', '/api/matrix/section', { section, locale });
    },
    onMutate: (section) => setPendingSection(section),
    onSettled: () => setPendingSection(null),
    onSuccess: (resp, section) => {
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
          description: ru ? `Раздел стоит ${SECTION_COST} ⭐` : `A section costs ${SECTION_COST} ⭐`,
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

  const core = data?.core;
  const tappedMeta = tapped ? arcanaMetaByN(tapped.value) : null;

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

        {isError ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {ru ? 'Не получилось построить матрицу. Проверьте соединение и попробуйте ещё раз.' : 'Could not build the matrix. Check your connection and try again.'}
            </p>
            <Button className="mt-4" onClick={() => refetch()}>{ru ? 'Повторить' : 'Retry'}</Button>
          </Card>
        ) : isLoading || !core ? (
          <div className="py-24 flex justify-center"><Loader /></div>
        ) : (
          <>
            {/* Фильтры зон */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => { haptic.select(); setZone(z.id); }}
                  aria-pressed={zone === z.id}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    zone === z.id ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  {ru ? z.ru : z.en}
                </button>
              ))}
            </div>

            <Card className="p-4 anim-fade-up">
              <MatrixOctagram core={core} zone={zone} onNodeTap={(n) => { haptic.impact('light'); setTapped(n); }} activeNodeId={tapped?.id} />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {ru ? 'Нажмите на любую точку матрицы' : 'Tap any point of the matrix'}
              </p>
            </Card>

            {/* Секции разбора */}
            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {ru ? 'Разбор по разделам' : 'Section readings'}
              </h2>
              {data!.sections.map((s, idx) => {
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
                            <Sparkles className="h-4 w-4 animate-pulse" />
                          ) : s.free ? (
                            ru ? 'Открыть бесплатно' : 'Open free'
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3.5 w-3.5" /> {SECTION_COST} <OrbIcon className="h-3.5 w-3.5" />
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
              <p className="text-sm text-muted-foreground">
                {ru
                  ? 'Полное значение этого аркана в вашей матрице — в разборах разделов ниже на странице.'
                  : 'The full meaning of this arcana in your matrix is in the section readings below.'}
              </p>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
