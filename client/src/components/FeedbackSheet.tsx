import { useEffect, useRef, useState } from 'react';
import { MessageCircleHeart, Star, Check, X } from 'lucide-react';
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
 *
 * Своя шторка вместо vaul-Drawer: в WebView Telegram на iOS клавиатура не сжимает страницу,
 * и Drawer уезжал под клавиатуру (кнопку «Отправить» было не нажать). Здесь контейнер
 * повторяет видимую область (visualViewport): с открытой клавиатурой шторка стоит прямо над ней,
 * а если не помещается — прокручивается. Кнопка «Отправить» — сразу под полем ввода.
 */
export const FEEDBACK_OPEN_EVENT = 'astro:open-feedback';
export const openFeedback = (source = 'button') =>
  window.dispatchEvent(new CustomEvent(FEEDBACK_OPEN_EVENT, { detail: { source } }));

function useVisibleViewport(active: boolean) {
  const [box, setBox] = useState<{ top: number; height: number }>(() => ({ top: 0, height: typeof window !== 'undefined' ? window.innerHeight : 800 }));
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const update = () => setBox({ top: vv ? vv.offsetTop : 0, height: vv ? vv.height : window.innerHeight });
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return box;
}

export default function FeedbackSheet() {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('button');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const box = useVisibleViewport(open);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Фокус запоминаем на pointerdown: к моменту click браузер уже снимает фокус с поля
  const typingOnDown = useRef(false);

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

  // Фон под шторкой не прокручивается
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    textRef.current?.blur();
    setOpen(false);
    // iOS иногда оставляет страницу прокрученной после клавиатуры
    setTimeout(() => window.scrollTo(0, 0), 50);
  };

  // Тап по затемнению: если была открыта клавиатура — только убрать её, иначе закрыть
  const isTyping = () => {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
  };
  const onBackdrop = () => {
    if (typingOnDown.current) {
      typingOnDown.current = false;
      (document.activeElement as HTMLElement | null)?.blur?.();
      setTimeout(() => window.scrollTo(0, 0), 50);
      return;
    }
    close();
  };

  const send = async () => {
    if (!rating && !text.trim()) return;
    textRef.current?.blur();
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex flex-col justify-end"
      style={{ top: box.top, height: box.height }}
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Отзыв о приложении' : 'App feedback'}
    >
      <div
        className="absolute inset-0 bg-black/70"
        onPointerDown={() => { typingOnDown.current = isTyping(); }}
        onClick={onBackdrop}
        data-testid="feedback-backdrop"
      />
      <div
        className="relative max-h-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-background px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
        data-testid="feedback-sheet"
      >
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageCircleHeart className="h-5 w-5 text-primary" />
              {ru ? 'Как вам AstroOrbi?' : 'How do you like AstroOrbi?'}
            </h2>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label={ru ? 'Закрыть' : 'Close'}
              data-testid="feedback-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {state === 'sent' ? (
            <div className="flex flex-col items-center py-6 text-center" data-testid="feedback-sent">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--success))]/15">
                <Check className="h-7 w-7 text-[hsl(var(--success))]" />
              </span>
              <p className="mt-4 font-display text-xl font-bold">{ru ? 'Спасибо!' : 'Thank you!'}</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {ru ? 'Мы читаем каждый отзыв сами и по ним решаем, что улучшить.' : 'We read every piece of feedback ourselves and use it to decide what to improve.'}
              </p>
              <Button variant="outline" className="mt-6 min-h-[44px]" onClick={close}>
                {ru ? 'Закрыть' : 'Close'}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {ru ? 'Что понравилось, чего не хватило — пишите как есть.' : 'What you liked, what was missing — tell us straight.'}
              </p>

              <div className="flex justify-center gap-1 py-2" role="radiogroup" aria-label={ru ? 'Оценка' : 'Rating'}>
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
                    <Star className={`h-7 w-7 ${n <= rating ? 'fill-[hsl(var(--solar-gold))] text-[hsl(var(--solar-gold))]' : 'text-muted-foreground'}`} />
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between gap-3 py-1 text-sm">
                <span>
                  {ru ? 'Анонимно' : 'Anonymous'}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {anonymous ? (ru ? 'имя и ник не увидим' : "we won't see your name") : (ru ? 'сможем ответить вам' : 'we can reply to you')}
                  </span>
                </span>
                <Switch checked={anonymous} onCheckedChange={setAnonymous} data-testid="feedback-anonymous" />
              </label>

              <Textarea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ru ? 'Ваш отзыв или идея…' : 'Your feedback or idea…'}
                maxLength={2000}
                rows={3}
                className="mt-2 min-h-[88px] text-base"
                data-testid="feedback-text"
              />

              {state === 'error' && (
                <p className="mt-2 text-sm text-destructive">
                  {ru ? 'Не получилось отправить — попробуйте ещё раз чуть позже.' : "Couldn't send — please try again a bit later."}
                </p>
              )}

              <Button
                className="mt-3 w-full min-h-[48px]"
                disabled={state === 'sending' || (!rating && !text.trim())}
                onClick={send}
                data-testid="feedback-send"
              >
                {state === 'sending' ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Отправить отзыв' : 'Send feedback')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
