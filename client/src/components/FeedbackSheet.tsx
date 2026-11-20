import { useEffect, useState } from 'react';
import { MessageCircleHeart, Star, Check } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/contexts/LocaleContext';
import { apiRequest } from '@/lib/queryClient';
import { getStartParam } from '@/lib/telegram';
import { haptic } from '@/lib/haptics';

/**
 * Отзыв о приложении: оценка 1–5, текст, «анонимно» (по умолчанию включено).
 * Уходит на сервер (/api/feedback) → бот пересылает в чат отзывов.
 * Открывается кнопкой на главном или пушем «Как вам AstroOrbi?» (startapp=feedback).
 */
export const FEEDBACK_OPEN_EVENT = 'astro:open-feedback';
export const openFeedback = (source = 'button') =>
  window.dispatchEvent(new CustomEvent(FEEDBACK_OPEN_EVENT, { detail: { source } }));

export default function FeedbackSheet() {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('button');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const onOpen = (e: Event) => {
      setSource((e as CustomEvent<{ source?: string }>).detail?.source || 'button');
      setState('idle');
      setOpen(true);
    };
    window.addEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    // Пуш «Как вам AstroOrbi?» открывает приложение с startapp=feedback — сразу показываем форму (раз за сессию)
    try {
      if (getStartParam() === 'feedback' && !sessionStorage.getItem('astro_feedback_deeplink')) {
        sessionStorage.setItem('astro_feedback_deeplink', '1');
        setSource('push');
        setTimeout(() => setOpen(true), 900);
      }
    } catch { /* noop */ }
    return () => window.removeEventListener(FEEDBACK_OPEN_EVENT, onOpen);
  }, []);

  const send = async () => {
    if (!rating && !text.trim()) return;
    setState('sending');
    try {
      await apiRequest('POST', '/api/feedback', { rating: rating || undefined, text: text.trim(), anonymous, source });
      haptic.notify('success');
      setState('sent');
      setText('');
      setRating(0);
    } catch {
      haptic.notify('error');
      setState('error');
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg px-4 pb-8">
          {state === 'sent' ? (
            <div className="flex flex-col items-center py-8 text-center" data-testid="feedback-sent">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--success))]/15">
                <Check className="h-7 w-7 text-[hsl(var(--success))]" />
              </span>
              <p className="mt-4 font-display text-xl font-bold">{ru ? 'Спасибо!' : 'Thank you!'}</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {ru ? 'Мы читаем каждый отзыв сами и по ним решаем, что улучшить.' : 'We read every piece of feedback ourselves and use it to decide what to improve.'}
              </p>
              <Button variant="outline" className="mt-6 min-h-[44px]" onClick={() => setOpen(false)}>
                {ru ? 'Закрыть' : 'Close'}
              </Button>
            </div>
          ) : (
            <>
              <DrawerHeader className="px-0">
                <DrawerTitle className="flex items-center gap-2">
                  <MessageCircleHeart className="h-5 w-5 text-primary" />
                  {ru ? 'Как вам AstroOrbi?' : 'How do you like AstroOrbi?'}
                </DrawerTitle>
                <DrawerDescription>
                  {ru ? 'Что понравилось, чего не хватило, что раздражает — пишите как есть.' : 'What you liked, what was missing, what annoys you — tell us straight.'}
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex justify-center gap-2 py-2" role="radiogroup" aria-label={ru ? 'Оценка' : 'Rating'}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full tap-scale"
                    onClick={() => { haptic.select(); setRating(n); }}
                    data-testid={`feedback-star-${n}`}
                  >
                    <Star className={`h-8 w-8 ${n <= rating ? 'fill-[hsl(var(--solar-gold))] text-[hsl(var(--solar-gold))]' : 'text-muted-foreground'}`} />
                  </button>
                ))}
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ru ? 'Ваш отзыв или идея…' : 'Your feedback or idea…'}
                maxLength={2000}
                rows={5}
                className="mt-3 text-base"
                data-testid="feedback-text"
              />

              <label className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span>
                  {ru ? 'Отправить анонимно' : 'Send anonymously'}
                  <span className="block text-xs text-muted-foreground">
                    {anonymous
                      ? (ru ? 'Мы не увидим ваше имя и ник' : "We won't see your name or username")
                      : (ru ? 'Мы увидим имя и сможем ответить вам в Telegram' : "We'll see your name and can reply on Telegram")}
                  </span>
                </span>
                <Switch checked={anonymous} onCheckedChange={setAnonymous} data-testid="feedback-anonymous" />
              </label>

              {state === 'error' && (
                <p className="mt-3 text-sm text-destructive">
                  {ru ? 'Не получилось отправить — попробуйте ещё раз чуть позже.' : "Couldn't send — please try again a bit later."}
                </p>
              )}

              <Button
                className="mt-5 w-full min-h-[48px]"
                disabled={state === 'sending' || (!rating && !text.trim())}
                onClick={send}
                data-testid="feedback-send"
              >
                {state === 'sending' ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Отправить отзыв' : 'Send feedback')}
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
