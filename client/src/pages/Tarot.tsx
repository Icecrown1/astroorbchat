import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Sparkles, RotateCcw, X, Share2, Copy } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { Loader } from '@/components/Loader';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { haptic } from '@/lib/haptics';
import { getTarotCard, TAROT_SPREADS, type TarotSpreadId, type DrawnTarotCard } from '@shared/tarot';
import { funnelFooter } from '@/lib/shareText';
import { useAuth } from '@/store/useAuth';
import { makeCanvas, drawCosmicBg, drawTarotCard, drawWrappedText, drawFooter, fontsReady, sendShareImage, shareColors, SHARE_W } from '@/lib/shareCard';

interface TarotReading {
  id: string;
  spread: TarotSpreadId;
  question: string | null;
  locale: string;
  cards: DrawnTarotCard[];
  interpretation: {
    intro: string;
    cards: Array<{ title: string; text: string }>;
    synthesis: string;
    advice: string;
    verdict?: string;
  };
  day: string;
  createdAt: string;
  cached?: boolean;
}

/** Рубашка: фирменная восьмиконечная звезда на тёмном */
function CardBack() {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-[#0B0D14]">
      <img src="/brand/tarot-back.svg" alt="" className="w-full h-full object-cover" draggable={false} />
    </div>
  );
}

/** Лицо карты: картинка client/public/tarot/<id>.webp, фолбэк — имя на тёмном */
function CardFace({ cardId, reversed }: { cardId: string; reversed: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const card = getTarotCard(cardId);
  if (!card) return <CardBack />;
  return (
    <div className={`w-full h-full relative bg-[hsl(232,32%,9%)] border border-[hsl(41,50%,40%)]/70 rounded-xl overflow-hidden ${reversed ? 'rotate-180' : ''}`}>
      {!imgFailed ? (
        <img
          src={`/tarot/${card.id}.webp`}
          alt={card.nameEn}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 bg-[radial-gradient(circle_at_50%_30%,hsl(252,45%,18%),hsl(232,32%,8%))]">
          <OrbIcon className="w-6 h-6 text-[hsl(var(--solar-gold))]" />
          <p className="text-[10px] leading-tight text-center font-display text-foreground/90">{card.nameEn}</p>
        </div>
      )}
    </div>
  );
}

function FlipCard({ drawn, delayMs, positionLabel, onOpen }: { drawn: DrawnTarotCard; delayMs: number; positionLabel: string; onOpen: () => void }) {
  const [flipped, setFlipped] = useState(false);
  // авто-переворот с каскадной задержкой
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 500 + delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return (
    <div className="flex flex-col items-center gap-1.5 tarot-deal" style={{ animationDelay: `${delayMs * 0.6}ms` }}>
      <button
        type="button"
        className={`tarot-flip w-[92px] h-[150px] ${flipped ? 'is-flipped' : ''}`}
        onClick={() => { if (flipped) { haptic.impact('light'); onOpen(); } }}
        aria-label={positionLabel}
      >
        <div className="tarot-flip-inner">
          <div className="tarot-face"><CardBack /></div>
          <div className="tarot-face tarot-face--front"><CardFace cardId={drawn.cardId} reversed={drawn.reversed} /></div>
        </div>
      </button>
      <p className="text-[11px] text-muted-foreground text-center leading-tight max-w-[100px]">
        {positionLabel}{drawn.reversed ? ' ↺' : ''}
      </p>
    </div>
  );
}

export default function Tarot() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const { toast } = useToast();

  const [question, setQuestion] = useState('');
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [lightbox, setLightbox] = useState<{ cardId: string; reversed: boolean; positionLabel: string } | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const { user } = useAuth();
  const { data: statusData } = useQuery<{ ok: boolean; data: { dailyDone: boolean; costs: Record<string, number> } }>({
    queryKey: [`/api/tarot/status?locale=${locale}`],
  });
  const dailyDone = statusData?.data?.dailyDone ?? false;
  const costs = statusData?.data?.costs ?? { yesno: 1, three: 3, celtic: 10 };

  const [questionError, setQuestionError] = useState(false);

  const drawMutation = useMutation({
    mutationFn: async (spread: TarotSpreadId) => {
      const response = await apiRequest('POST', '/api/tarot/draw', {
        spread,
        locale,
        question: spread === 'daily' ? undefined : question.trim(),
      });
      if (!response.ok) {
        const err: any = new Error(response.error || 'failed');
        err.code = response.error;
        err.cost = response.cost;
        throw err;
      }
      return response.data as TarotReading;
    },
    onSuccess: (data) => {
      haptic.notify('success');
      setReading(data);
      queryClient.invalidateQueries({ queryKey: [`/api/tarot/status?locale=${locale}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err: any) => {
      haptic.notify('error');
      if (err.code === 'subscription_required' || err.code === 'premium_required') {
        toast({
          title: ru ? 'Нужна подписка' : 'Subscription needed',
          description: ru ? 'Расклады доступны в подписке. Карта дня — бесплатно.' : 'Spreads are part of a subscription. The daily card is free.',
        });
        navigate('/subscribe');
      } else if (err.code === 'insufficient_orbs') {
        toast({
          title: ru ? 'Не хватает звёзд' : 'Not enough stars',
          description: ru ? `Нужно ${err.cost} ⭐ — пополните баланс` : `You need ${err.cost} ⭐ — top up your balance`,
        });
        navigate('/buy-energy');
      } else {
        toast({ title: ru ? 'Не получилось' : 'Something went wrong', description: ru ? 'Попробуйте ещё раз' : 'Please try again', variant: 'destructive' });
      }
    },
  });

  const spreads: Array<{ id: TarotSpreadId; title: string; desc: string; cost: number | null; needsQuestion: boolean }> = [
    { id: 'daily', title: ru ? 'Карта дня' : 'Card of the day', desc: ru ? 'Фокус и настроение на сегодня' : 'Focus and mood for today', cost: null, needsQuestion: false },
    { id: 'yesno', title: ru ? 'Да / Нет' : 'Yes / No', desc: ru ? 'Один вопрос — один ответ' : 'One question — one answer', cost: costs.yesno, needsQuestion: true },
    { id: 'three', title: ru ? 'Три карты' : 'Three cards', desc: ru ? 'Объёмный ответ на ваш вопрос' : 'A rounded answer to your question', cost: costs.three, needsQuestion: true },
    { id: 'celtic', title: ru ? 'Кельтский крест' : 'Celtic Cross', desc: ru ? 'Глубокий разбор из 10 карт' : 'A deep 10-card reading', cost: costs.celtic, needsQuestion: true },
  ];

  const [sharing, setSharing] = useState(false);

  const shareReading = async () => {
    if (!reading || !spreadDef) return;
    haptic.impact('medium');
    setSharing(true);
    try {
      await fontsReady();
      const { canvas, ctx } = makeCanvas();
      drawCosmicBg(ctx);

      // Вопрос или заголовок расклада
      ctx.textAlign = 'center';
      ctx.fillStyle = shareColors.INK;
      ctx.font = '46px Prata, serif';
      const title = reading.question
        ? `«${reading.question}»`
        : (ru ? (reading.spread === 'daily' ? 'Карта дня' : 'Расклад Таро') : (reading.spread === 'daily' ? 'Card of the day' : 'Tarot reading'));
      drawWrappedText(ctx, title, SHARE_W / 2, 150, 880, 62, 3);

      // Карты: 1 — крупно, 2-3 — веером, больше — первые 3 и бейдж "+N"
      const shown = reading.cards.slice(0, 3);
      const cw = shown.length === 1 ? 380 : 270;
      const cy = 640;
      const spread = shown.length === 1 ? [0] : shown.length === 2 ? [-160, 160] : [-250, 0, 250];
      const rot = shown.length === 1 ? [0] : shown.length === 2 ? [-6, 6] : [-9, 0, 9];
      for (let i = 0; i < shown.length; i++) {
        const cyi = cy + (i === 1 && shown.length === 3 ? -24 : 0);
        await drawTarotCard(ctx, shown[i].cardId, SHARE_W / 2 + spread[i], cyi, cw, rot[i], shown[i].reversed);
        // Позиция и имя карты под каждой
        const posLabel = ru ? spreadDef.positions[shown[i].position][0] : spreadDef.positions[shown[i].position][1];
        const cname = getTarotCard(shown[i].cardId)?.nameEn || '';
        ctx.fillStyle = shareColors.MUTED;
        ctx.font = '24px Inter, sans-serif';
        ctx.fillText(posLabel + (shown[i].reversed ? ' ↺' : ''), SHARE_W / 2 + spread[i], cyi + cw * 0.75 + 46);
        ctx.fillStyle = shareColors.INK;
        ctx.font = '26px Prata, serif';
        drawWrappedText(ctx, cname, SHARE_W / 2 + spread[i], cyi + cw * 0.75 + 84, cw + 60, 30, 2);
      }
      if (reading.cards.length > 3) {
        ctx.fillStyle = shareColors.GOLD;
        ctx.font = '34px Inter, sans-serif';
        ctx.fillText(ru ? `и ещё ${reading.cards.length - 3} карт…` : `and ${reading.cards.length - 3} more…`, SHARE_W / 2, cy + 300);
      }

      // Имена карт / вердикт
      ctx.fillStyle = shareColors.GOLD;
      ctx.font = '32px Prata, serif';
      if (reading.spread === 'yesno' && reading.interpretation.verdict) {
        const v = reading.interpretation.verdict;
        ctx.fillText(v === 'yes' ? (ru ? 'Скорее да' : 'Leaning yes') : v === 'no' ? (ru ? 'Скорее нет' : 'Leaning no') : (ru ? 'Не всё однозначно' : 'It depends'), SHARE_W / 2, 1020);
      } else if (reading.interpretation.synthesis) {
        ctx.fillStyle = shareColors.INK;
        ctx.font = '30px Inter, sans-serif';
        drawWrappedText(ctx, reading.interpretation.synthesis, SHARE_W / 2, 1075, 920, 42, 3);
      }

      await drawFooter(ctx, ru ? 'Вытяни свою карту — бесплатно в AstroOrbi' : 'Draw your own card — free in AstroOrbi');

      // Подпись к фото: краткий текст расклада (лимит Telegram — 1024 символа)
      const capParts: string[] = [];
      capParts.push(ru
        ? (reading.question ? `🔮 «${reading.question}»` : (reading.spread === 'daily' ? '🔮 Моя карта дня' : '🔮 Мой расклад Таро'))
        : (reading.question ? `🔮 “${reading.question}”` : (reading.spread === 'daily' ? '🔮 My card of the day' : '🔮 My Tarot reading')));
      if (reading.spread === 'yesno' && reading.interpretation.verdict) {
        const v = reading.interpretation.verdict;
        capParts.push(v === 'yes' ? (ru ? '✅ Скорее да' : '✅ Leaning yes') : v === 'no' ? (ru ? '⛔ Скорее нет' : '⛔ Leaning no') : (ru ? '⚖️ Не всё однозначно' : '⚖️ It depends'));
      }
      if (reading.interpretation.synthesis) capParts.push(reading.interpretation.synthesis);
      if (reading.interpretation.advice) capParts.push((ru ? '💡 ' : '💡 ') + reading.interpretation.advice);
      let caption = capParts.join('\n\n');
      if (caption.length > 1000) {
        const cut = caption.slice(0, 1000);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('.\n'));
        caption = (end > 500 ? cut.slice(0, end + 1) : cut) + (ru ? ' …' : ' …');
      }
      const result = await sendShareImage(canvas, caption, locale);
      if (result === 'downloaded') toast({ title: ru ? 'Картинка сохранена' : 'Image saved' });
      if (result === 'failed') toast({ title: ru ? 'Не получилось отправить' : 'Could not share', description: ru ? 'Проверьте соединение и попробуйте ещё раз' : 'Check your connection and try again', variant: 'destructive' });
    } catch (e) {
      console.error('[SHARE] tarot failed', e);
      toast({ title: ru ? 'Не получилось поделиться' : 'Share failed', variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const spreadDef = reading ? TAROT_SPREADS[reading.spread] : null;
  const verdictLabel = (v?: string) =>
    v === 'yes' ? (ru ? 'Скорее да' : 'Leaning yes') : v === 'no' ? (ru ? 'Скорее нет' : 'Leaning no') : (ru ? 'Не всё однозначно' : 'It depends');

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-palette opacity-20" />
      </div>

      <div className="container max-w-md mx-auto">
        <div className="flex items-start gap-3 mb-6 anim-fade-up">
          <Button variant="ghost" size="icon" onClick={() => (reading ? setReading(null) : navigate('/dashboard'))} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-2xl font-display font-bold">{ru ? 'Карты Таро' : 'Tarot Cards'}</h1>
            <p className="text-muted-foreground text-sm">
              {ru ? 'Зеркало для размышления, не приговор' : 'A mirror for reflection, not a verdict'}
            </p>
          </div>
        </div>

        {drawMutation.isPending ? (
          <Card className="p-10 flex flex-col items-center gap-5 anim-fade-up" data-testid="tarot-loading">
            <Loader size="lg" />
            <p className="text-muted-foreground text-center">
              {ru ? 'Тасуем колоду и читаем карты…' : 'Shuffling the deck and reading the cards…'}
            </p>
          </Card>
        ) : reading && spreadDef ? (
          /* ---------- Результат ---------- */
          <div className="space-y-5">
            {reading.question && (
              <p className="text-sm text-muted-foreground text-center anim-fade-up" data-testid="text-question">«{reading.question}»</p>
            )}

            <div className={`flex flex-wrap justify-center gap-3 anim-fade-up ${reading.cards.length > 5 ? 'gap-2' : ''}`} data-testid="tarot-cards">
              {reading.cards.map((c, i) => (
                <FlipCard
                  key={`${reading.id}-${i}`}
                  drawn={c}
                  delayMs={i * 350}
                  positionLabel={ru ? spreadDef.positions[c.position][0] : spreadDef.positions[c.position][1]}
                  onOpen={() => setLightbox({
                    cardId: c.cardId,
                    reversed: c.reversed,
                    positionLabel: ru ? spreadDef.positions[c.position][0] : spreadDef.positions[c.position][1],
                  })}
                />
              ))}
            </div>

            {reading.interpretation.verdict && (
              <div className="flex justify-center anim-fade-up anim-d1">
                <Badge className="text-sm px-4 py-1.5" data-testid="badge-verdict">{verdictLabel(reading.interpretation.verdict)}</Badge>
              </div>
            )}

            <Card className="p-5 space-y-4 anim-fade-up anim-d2" data-testid="tarot-interpretation">
              <p className="text-foreground/90">{reading.interpretation.intro}</p>
              {reading.interpretation.cards.map((c, i) => (
                <div key={i}>
                  <h3 className="font-display font-semibold text-[hsl(var(--solar-gold))] mb-1">{c.title}</h3>
                  <p className="text-sm text-foreground/85 whitespace-pre-line">{c.text}</p>
                </div>
              ))}
              <div className="pt-1 border-t border-border">
                <h3 className="font-display font-semibold mb-1 mt-3">{ru ? 'Общая картина' : 'The bigger picture'}</h3>
                <p className="text-sm text-foreground/85 whitespace-pre-line">{reading.interpretation.synthesis}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/25 p-3">
                <p className="text-sm text-foreground/90 whitespace-pre-line">{reading.interpretation.advice}</p>
              </div>
            </Card>

            <p className="text-[11px] text-muted-foreground text-center px-4">
              {ru
                ? 'Расклад носит информационно-развлекательный характер и не заменяет консультацию врача, юриста или психолога.'
                : 'This reading is for reflection and entertainment; it is not medical, legal or psychological advice.'}
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={async () => {
                if (!reading || !spreadDef) return;
                const it = reading.interpretation;
                const parts = [
                  `🔮 ${ru ? 'Расклад Таро' : 'Tarot reading'}${reading.question ? `\n«${reading.question}»` : ''}`,
                  it.intro,
                  ...it.cards.map((c) => `🃏 ${c.title}\n${c.text}`),
                  `🌌 ${ru ? 'Общая картина' : 'The bigger picture'}\n${it.synthesis}`,
                  `💡 ${ru ? 'Совет' : 'Advice'}\n${it.advice}`,
                  funnelFooter(locale, (user as any)?.referralCode),
                ].filter(Boolean).join('\n\n');
                try {
                  await navigator.clipboard.writeText(parts);
                  haptic.notify('success');
                  toast({ title: ru ? 'Разбор скопирован' : 'Reading copied' });
                } catch {
                  toast({ title: ru ? 'Не удалось скопировать' : 'Copy failed', variant: 'destructive' });
                }
              }}
              data-testid="button-copy-reading"
            >
              <Copy className="w-4 h-4 mr-2" />
              {ru ? 'Скопировать разбор' : 'Copy the reading'}
            </Button>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={shareReading} disabled={sharing} data-testid="button-share-reading">
                <Share2 className="w-4 h-4 mr-2" />
                {sharing ? (ru ? 'Готовим…' : 'Preparing…') : (ru ? 'Поделиться' : 'Share')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { haptic.impact('light'); setReading(null); }} data-testid="button-new-reading">
                <RotateCcw className="w-4 h-4 mr-2" />
                {ru ? 'Новый расклад' : 'New reading'}
              </Button>
            </div>
          </div>
        ) : (
          /* ---------- Выбор расклада ---------- */
          <div className="space-y-4">
            <div className="anim-fade-up">
              <Input
                id="tarot-question"
                value={question}
                onChange={(e) => { setQuestion(e.target.value); if (questionError) setQuestionError(false); }}
                placeholder={ru ? 'Ваш вопрос картам' : 'Your question for the cards'}
                maxLength={300}
                className={`h-11 ${questionError ? 'border-destructive' : ''}`}
                data-testid="input-question"
              />
              <p className={`text-xs mt-1.5 ${questionError ? 'text-destructive' : 'text-muted-foreground'}`}>
                {questionError
                  ? (ru ? 'Сначала задайте вопрос — расклады отвечают на него' : 'Ask a question first — the spreads answer it')
                  : (ru ? 'Для раскладов нужен вопрос. Карта дня — без вопроса.' : 'Spreads need a question. The daily card needs none.')}
              </p>
            </div>

            {spreads.map((s, i) => {
              const isDaily = s.id === 'daily';
              return (
                <Card
                  key={s.id}
                  className={`p-4 hover-elevate cursor-pointer anim-fade-up anim-d${i + 1}`}
                  onClick={() => {
                    if (s.needsQuestion && !question.trim()) {
                      haptic.notify('warning');
                      setQuestionError(true);
                      document.getElementById('tarot-question')?.focus();
                      return;
                    }
                    haptic.impact('light');
                    drawMutation.mutate(s.id);
                  }}
                  data-testid={`spread-${s.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3 shrink-0">
                      {Array.from({ length: Math.min(TAROT_SPREADS[s.id].cards, 3) }).map((_, j) => (
                        <div key={j} className="w-8 h-12 rounded-md bg-[linear-gradient(150deg,hsl(252,40%,16%),hsl(232,32%,10%))] border border-[hsl(252,50%,34%)] flex items-center justify-center" style={{ transform: `rotate(${(j - 1) * 8}deg)` }}>
                          {j === 1 || TAROT_SPREADS[s.id].cards === 1 ? <OrbIcon className="w-3 h-3 text-primary/70" /> : null}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display font-semibold">{s.title}</h2>
                        {isDaily ? (
                          dailyDone ? (
                            <Badge variant="secondary" className="text-[10px]">{ru ? 'Сегодня открыта' : 'Done today'}</Badge>
                          ) : (
                            <Badge className="bg-green-600 hover:bg-green-600 text-[10px]">{ru ? 'Бесплатно' : 'Free'}</Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <OrbIcon className="w-2.5 h-2.5" />
                            {s.cost}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                    <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Card>
              );
            })}

            <p className="text-[11px] text-muted-foreground text-center px-4 anim-fade-up anim-d5">
              {ru
                ? 'Карта дня — одна на день и всегда бесплатна. Платные расклады тратят звёзды с баланса.'
                : 'The daily card is one per day and always free. Paid spreads use stars from your balance.'}
            </p>
          </div>
        )}
      </div>

      {/* Лайтбокс: тап по карте — рассмотреть крупно; тап по картинке — зум ×2 со скроллом */}
      {lightbox && (() => {
        const card = getTarotCard(lightbox.cardId);
        if (!card) return null;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
            onClick={() => { setLightbox(null); setZoomed(false); }}
            data-testid="tarot-lightbox"
          >
            <div className="flex items-center justify-between p-4 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="font-display font-semibold">{card.nameEn}</p>
                <p className="text-xs text-muted-foreground">
                  {lightbox.positionLabel}{lightbox.reversed ? (ru ? ' · перевёрнутая' : ' · reversed') : ''}
                </p>
              </div>
              <button
                type="button"
                className="p-2 rounded-full bg-muted/60 text-foreground"
                onClick={() => { setLightbox(null); setZoomed(false); }}
                aria-label={ru ? 'Закрыть' : 'Close'}
                data-testid="button-close-lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`flex-1 min-h-0 ${zoomed ? 'overflow-auto' : 'overflow-hidden flex items-center justify-center'}`} onClick={(e) => e.stopPropagation()}>
              <img
                src={`/tarot/${card.id}.webp`}
                alt={card.nameEn}
                onClick={() => { haptic.impact('light'); setZoomed((z) => !z); }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                className={zoomed
                  ? `w-[190%] max-w-none mx-auto ${lightbox.reversed ? 'rotate-180' : ''}`
                  : `max-h-full max-w-full object-contain px-4 ${lightbox.reversed ? 'rotate-180' : ''}`}
                style={{ cursor: zoomed ? 'zoom-out' : 'zoom-in' }}
              />
            </div>
            <p className="text-center text-[11px] text-muted-foreground p-3 shrink-0" onClick={(e) => e.stopPropagation()}>
              {zoomed
                ? (ru ? 'Двигайте пальцем · тап — уменьшить' : 'Drag to pan · tap to zoom out')
                : (ru ? 'Тап по карте — приблизить' : 'Tap the card to zoom in')}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
