import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Copy, Check, RotateCw } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LocaleContext';
import { PAYMENT_LINK_EVENT, launchPaymentUrl } from '@/lib/telegram';
import { haptic } from '@/lib/haptics';

/**
 * Подсказка после открытия страницы оплаты ЮKassa.
 * Страница открывается поверх мини-аппа (встроенный браузер Telegram / Custom Tab);
 * если она осталась чёрной или грузится бесконечно, пользователь закрывает её и видит здесь:
 * «Открыть оплату снова», «Скопировать ссылку» (для Safari/Chrome) и подсказку про VPN и звёзды.
 * Клики считаются глобальной аналитикой по data-testid.
 */

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function PaymentLinkHelper() {
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const [location] = useLocation();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    const onOpen = (e: Event) => {
      const next = (e as CustomEvent<{ url?: string }>).detail?.url;
      if (!next) return;
      setCopied('idle');
      setUrl(next);
    };
    window.addEventListener(PAYMENT_LINK_EVENT, onOpen);
    return () => window.removeEventListener(PAYMENT_LINK_EVENT, onOpen);
  }, []);

  // Вернулись с оплаты (startapp=pay_…) — подсказка больше не нужна
  useEffect(() => {
    if (location.startsWith('/payment-success')) setUrl(null);
  }, [location]);

  const browser = isIOS() ? 'Safari' : 'Chrome';

  return (
    <Drawer open={!!url} onOpenChange={(o) => !o && setUrl(null)}>
      <DrawerContent>
        {url && (
          <div className="mx-auto w-full max-w-lg px-4 pb-8">
            <DrawerHeader className="px-0">
              <DrawerTitle>{ru ? 'Оплата открывается в браузере' : 'Payment is opening in the browser'}</DrawerTitle>
              <DrawerDescription>
                {ru
                  ? 'Если страница оплаты осталась чёрной или грузится бесконечно, закройте её и попробуйте так:'
                  : 'If the payment page stays black or keeps loading, close it and try this:'}
              </DrawerDescription>
            </DrawerHeader>

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">1</span>
                <span className="text-muted-foreground">
                  {ru ? (
                    <><span className="text-foreground">Выключите VPN</span> — страница ЮKassa может не загружаться с зарубежных адресов. Затем откройте оплату снова.</>
                  ) : (
                    <><span className="text-foreground">Turn off your VPN</span> — the YooKassa page may not load from foreign IP addresses. Then reopen the payment.</>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">2</span>
                <span className="text-muted-foreground">
                  {ru ? (
                    <><span className="text-foreground">Откройте оплату в {browser}</span>: скопируйте ссылку и вставьте её в адресную строку. После оплаты вы вернётесь в приложение.</>
                  ) : (
                    <><span className="text-foreground">Open the payment in {browser}</span>: copy the link and paste it into the address bar. After paying you'll come back to the app.</>
                  )}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">3</span>
                <span className="text-muted-foreground">
                  {ru ? (
                    <><span className="text-foreground">Или оплатите звёздами Telegram</span> — оплата проходит прямо в Telegram, без браузера.</>
                  ) : (
                    <><span className="text-foreground">Or pay with Telegram Stars</span> — the payment happens right inside Telegram, no browser needed.</>
                  )}
                </span>
              </li>
            </ol>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button
                className="min-h-[48px]"
                onClick={() => {
                  haptic.impact('light');
                  launchPaymentUrl(url);
                }}
                data-testid="payment-help-reopen"
              >
                <RotateCw className="mr-2 h-4 w-4" />
                {ru ? 'Открыть снова' : 'Reopen'}
              </Button>
              <Button
                variant="outline"
                className="min-h-[48px]"
                onClick={async () => {
                  const ok = await copyText(url);
                  haptic.notify(ok ? 'success' : 'error');
                  setCopied(ok ? 'ok' : 'fail');
                }}
                data-testid="payment-help-copy"
              >
                {copied === 'ok' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied === 'ok' ? (ru ? 'Скопировано' : 'Copied') : ru ? 'Скопировать ссылку' : 'Copy link'}
              </Button>
            </div>

            {copied === 'fail' && (
              <div className="mt-3">
                <p className="mb-1 text-xs text-muted-foreground">
                  {ru ? 'Не получилось скопировать автоматически — выделите ссылку вручную:' : "Couldn't copy automatically — select the link manually:"}
                </p>
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              </div>
            )}

            <Button
              variant="ghost"
              className="mt-3 w-full min-h-[44px] text-muted-foreground"
              onClick={() => setUrl(null)}
              data-testid="payment-help-close"
            >
              {ru ? 'Закрыть' : 'Close'}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
