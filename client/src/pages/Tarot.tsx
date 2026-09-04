import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { Loader } from '@/components/Loader';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { haptic } from '@/lib/haptics';
import { getTarotCard, TAROT_SPREADS, type TarotSpreadId, type DrawnTarotCard } from '@shared/tarot';

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
    <div className="w-full h-full bg-[linear-gradient(150deg,hsl(252,40%,14%),hsl(232,32%,9%))] border border-[hsl(252,50%,32%)] rounded-xl flex items-center justify-center">
      <OrbIcon className="w-8 h-8 text-primary/70" />
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

function FlipCard({ drawn, delayMs, positionLabel }: { drawn: DrawnTarotCard; delayMs: number; positionLabel: string }) {
  const [flipped, setFlipped] = useState(false);
  // авто-переворот с каскадной задержкой
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 500 + delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return (
    <div className="flex flex-col items-center gap-1.5 tarot-deal" style={{ animationDelay: `${delayMs * 0.6}ms` }}>
      <div className={`tarot-flip w-[92px] h-[150px] ${flipped ? 'is-flipped' : ''}`}>
        <div className="tarot-flip-inner">
          <div className="tarot-face"><CardBack /></div>
          <div className="tarot-face tarot-face--front"><CardFace cardId={drawn.cardId} reversed={drawn.reversed} /></div>
        </div>
      </div>
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

  const { data: statusData } = useQuery<{ ok: boolean; data: { dailyDone: boolean; costs: Record<string, number> } }>({
    queryKey: [`/api/tarot/status?locale=${locale}`],
  });
  const dailyDone = statusData?.data?.dailyDone ?? false;
  const costs = statusData?.data?.costs ?? { yesno: 1, three: 3, celtic: 10 };

  const drawMutation = useMutation({
    mutationFn: async (spread: TarotSpreadId) => {
      const response = await apiRequest('POST', '/api/tarot/draw', {
        spread,
        locale,
        question: question.trim() || undefined,
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
    { id: 'three', title: ru ? 'Три карты' : 'Three cards', desc: ru ? 'Прошлое · Настоящее · Будущее' : 'Past · Present · Future', cost: costs.three, needsQuestion: true },
    { id: 'celtic', title: ru ? 'Кельтский крест' : 'Celtic Cross', desc: ru ? 'Глубокий разбор из 10 карт' : 'A deep 10-card reading', cost: costs.celtic, needsQuestion: true },
  ];

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

            <Button variant="outline" className="w-full" onClick={() => { haptic.impact('light'); setReading(null); }} data-testid="button-new-reading">
              <RotateCcw className="w-4 h-4 mr-2" />
              {ru ? 'Новый расклад' : 'New reading'}
            </Button>
          </div>
        ) : (
          /* ---------- Выбор расклада ---------- */
          <div className="space-y-4">
            <div className="anim-fade-up">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={ru ? 'Ваш вопрос картам (необязательно)' : 'Your question for the cards (optional)'}
                maxLength={300}
                className="h-11"
                data-testid="input-question"
              />
            </div>

            {spreads.map((s, i) => {
              const isDaily = s.id === 'daily';
              return (
                <Card
                  key={s.id}
                  className={`p-4 hover-elevate cursor-pointer anim-fade-up anim-d${i + 1}`}
                  onClick={() => { haptic.impact('light'); drawMutation.mutate(s.id); }}
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
    </div>
  );
}
