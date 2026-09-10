// Лид-магнит из Instagram: один бесплатный пробный расклад (3 карты) на свой вопрос.
// Тексты и состояния — по ТЗ: форма → подготовка → результат → мост к подписке.
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { Sparkles } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { haptic } from '@/lib/haptics';
import { getTarotCard } from '@shared/tarot';

const HINTS_RU = [
  'Что поможет мне разобраться в рабочих планах?',
  'На что обратить внимание в общении с партнёром?',
];
const HINTS_EN = [
  'What will help me sort out my work plans?',
  'What should I pay attention to with my partner?',
];

export default function TarotTrial() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const { toast } = useToast();

  const [question, setQuestion] = useState('');
  const [slowHint, setSlowHint] = useState(false);

  const { data: statusData, isLoading } = useQuery<{ ok: boolean; data: { used: boolean; reading?: any } }>({
    queryKey: ['/api/tarot/trial'],
  });

  const trialMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest('POST', '/api/tarot/trial', { question: question.trim(), locale });
      if (!resp.ok) throw new Error(resp.error);
      return resp.data;
    },
    onSuccess: () => {
      haptic.notify('success');
      queryClient.invalidateQueries({ queryKey: ['/api/tarot/trial'] });
    },
    onError: (e: any) => {
      haptic.notify('error');
      toast({
        title: e?.message === 'question_length'
          ? (ru ? 'Введи вопрос от 10 до 500 символов' : 'Enter a question of 10–500 characters')
          : (ru ? 'Не получилось. Попробуй ещё раз' : 'Something went wrong. Try again'),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!trialMutation.isPending) { setSlowHint(false); return; }
    const t = setTimeout(() => setSlowHint(true), 15000);
    return () => clearTimeout(t);
  }, [trialMutation.isPending]);

  const reading = statusData?.data?.reading;
  const qLen = question.trim().length;
  const qValid = qLen >= 10 && qLen <= 500;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto max-w-lg px-4 pt-8">

        {isLoading ? (
          <div className="py-24 flex justify-center"><Loader /></div>
        ) : trialMutation.isPending ? (
          /* Подготовка результата */
          <Card className="p-8 text-center anim-fade-up">
            <Loader />
            <p className="mt-5 font-display text-lg">{ru ? 'Готовим твой расклад' : 'Preparing your reading'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {slowHint
                ? (ru ? 'Расклад ещё готовится. Повторно отправлять вопрос не нужно.' : 'Still preparing. No need to send the question again.')
                : (ru ? 'Можно закрыть приложение и вернуться позже.' : 'You can close the app and come back later.')}
            </p>
          </Card>
        ) : reading ? (
          /* Результат */
          <div className="space-y-4 anim-fade-up">
            <h1 className="font-display text-2xl">{ru ? 'Твой расклад' : 'Your reading'}</h1>
            {reading.question && (
              <p className="text-sm text-muted-foreground">«{reading.question}»</p>
            )}

            <div className="flex justify-center gap-3">
              {(reading.cards || []).map((c: any, i: number) => {
                const card = getTarotCard(c.cardId);
                return (
                  <div key={i} className="w-[104px] text-center">
                    <img
                      src={`/tarot/${c.cardId}.webp`}
                      alt={card?.nameEn || ''}
                      className={`w-full rounded-lg border border-[hsl(41,50%,40%)]/60 ${c.reversed ? 'rotate-180' : ''}`}
                    />
                    <p className="mt-1.5 text-[10px] text-muted-foreground leading-tight">
                      {card?.nameEn}{c.reversed ? ' ↺' : ''}
                    </p>
                  </div>
                );
              })}
            </div>

            <Card className="p-4 space-y-4">
              {reading.interpretation?.intro && (
                <p className="text-sm leading-relaxed text-foreground/90">{reading.interpretation.intro}</p>
              )}
              {(reading.interpretation?.cards || []).map((c: any, i: number) => (
                <div key={i}>
                  <p className="font-display font-semibold text-[hsl(var(--solar-gold))]">{c.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{c.text}</p>
                </div>
              ))}
              {reading.interpretation?.synthesis && (
                <div>
                  <p className="font-display font-semibold">{ru ? 'Общая картина' : 'The bigger picture'}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">{reading.interpretation.synthesis}</p>
                </div>
              )}
              {reading.interpretation?.advice && (
                <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
                  <p className="text-sm leading-relaxed">{reading.interpretation.advice}</p>
                </div>
              )}
            </Card>

            {/* Мост к подписке */}
            <Card className="p-4 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-[hsl(var(--solar-gold))]" />
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {ru
                  ? 'Таро — один из семи разделов AstroOrbi. Здесь также есть натальная карта, матрица судьбы, совместимость, гороскопы, соляр и Оракул.'
                  : 'Tarot is one of seven AstroOrbi sections. There are also the natal chart, Matrix of Destiny, compatibility, horoscopes, solar return and the Oracle.'}
              </p>
              <Button className="mt-4 w-full h-11" onClick={() => { haptic.impact('medium'); navigate('/subscribe'); }} data-testid="button-trial-subscribe">
                {ru ? 'Посмотреть подписку' : 'See the plans'}
              </Button>
              <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => { haptic.select(); navigate('/dashboard'); }} data-testid="button-trial-later">
                {ru ? 'Позже — к разделам' : 'Later — to the sections'}
              </Button>
            </Card>

            <p className="text-center text-[11px] text-muted-foreground">
              {ru ? 'Таро — повод для размышления. Интерпретацию готовит ИИ.' : 'Tarot is food for thought. The interpretation is AI-made.'}
            </p>
          </div>
        ) : (
          /* Форма вопроса */
          <div className="space-y-4 anim-fade-up">
            <h1 className="font-display text-2xl">{ru ? 'Первый расклад Таро — бесплатно' : 'Your first Tarot reading — free'}</h1>
            <p className="text-sm text-muted-foreground">
              {ru
                ? 'Задай один вопрос о своей ситуации и получи короткий расклад с интерпретацией.'
                : 'Ask one question about your situation and get a short reading with an interpretation.'}
            </p>

            <Card className="p-4">
              <label className="text-sm font-medium" htmlFor="trial-q">{ru ? 'Твой вопрос' : 'Your question'}</label>
              <textarea
                id="trial-q"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
                placeholder={ru ? 'На что мне обратить внимание в этой ситуации?' : 'What should I pay attention to in this situation?'}
                rows={3}
                className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm"
                data-testid="input-trial-question"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{ru ? 'Опиши одну ситуацию. Имена, телефоны и другие личные данные не нужны.' : 'Describe one situation. No names, phone numbers or personal data needed.'}</span>
                <span className={qLen > 0 && !qValid ? 'text-destructive' : ''}>{qLen}/500</span>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {(ru ? HINTS_RU : HINTS_EN).map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="rounded-full border border-border px-4 py-2.5 min-h-[44px] text-left text-xs text-muted-foreground hover-elevate"
                    onClick={() => { haptic.select(); setQuestion(h); }}
                  >
                    {h}
                  </button>
                ))}
              </div>

              <Button
                className="mt-4 w-full h-12"
                disabled={!qValid || trialMutation.isPending}
                onClick={() => { haptic.impact('medium'); trialMutation.mutate(); }}
                data-testid="button-trial-draw"
              >
                {ru ? 'Получить бесплатный расклад' : 'Get my free reading'}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {ru ? 'Одна проба для новых пользователей. Без оплаты и банковской карты.' : 'One trial for new users. No payment, no card required.'}
              </p>
            </Card>

            <p className="text-center text-[11px] text-muted-foreground">
              {ru ? 'Таро — повод для размышления. Интерпретацию готовит ИИ.' : 'Tarot is food for thought. The interpretation is AI-made.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
