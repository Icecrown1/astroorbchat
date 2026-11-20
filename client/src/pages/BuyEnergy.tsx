import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { ORB_PACKS } from '@shared/orbPacks';
import { STARS_SUB_PRICES } from '@shared/subscriptionPrices';
import { useEnergy } from '@/store/useEnergy';
import { haptic } from '@/lib/haptics';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';

/**
 * Пакеты звёзд. Оплата внутри Telegram — только Telegram Stars (правило Telegram для цифровых товаров).
 * Прайс — shared/orbPacks.ts.
 */
const ENERGY_PACKS = ORB_PACKS.map((p) => ({
  id: p.id,
  amount: p.orbs,
  base: p.base,
  stars: p.stars,
  popular: !!p.hot,
}));
type EnergyPack = typeof ENERGY_PACKS[number];

export default function BuyEnergy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const ru = locale === 'ru';
  const { tier } = useEnergy();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);

  // Инвойс с сервера → нативное окно оплаты Telegram
  const starsMutation = useMutation({
    mutationFn: async (packId: string) => {
      return await apiRequest('POST', '/api/payments/stars/create-invoice', { packId });
    },
    onSuccess: (data: any, packId) => {
      const link = data?.link;
      const orbs = ENERGY_PACKS.find((p) => p.id === packId)?.amount ?? 0;
      const wa = (window as any)?.Telegram?.WebApp;
      if (link && wa?.openInvoice) {
        wa.openInvoice(link, (status: string) => {
          if (status === 'paid') {
            queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
            queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
            navigate(`/payment-success?type=stars&orbs=${orbs}`);
          } else if (status === 'failed') {
            haptic.notify('error');
            toast({ title: ru ? 'Оплата не прошла' : 'Payment failed', variant: 'destructive' });
          }
        });
      } else if (link) {
        window.open(link, '_blank'); // вне Telegram — счёт откроется в приложении Telegram
      }
    },
    onError: () => toast({ title: ru ? 'Не удалось создать счёт' : 'Could not create invoice', variant: 'destructive' }),
  });

  const buy = (pack: EnergyPack) => {
    haptic.impact('medium');
    setSelectedPack(pack.id);
    starsMutation.mutate(pack.id);
  };
  const busy = (pack: EnergyPack) => selectedPack === pack.id && starsMutation.isPending;

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-palette opacity-20" />
      </div>

      <div className="container max-w-md mx-auto">
        {/* Заголовок */}
        <div className="flex items-start gap-3 mb-6 anim-fade-up">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-2xl font-display font-bold">{t.buyEnergy.title}</h1>
            <p className="text-muted-foreground text-sm">
              {ru ? 'Не сгорают в конце месяца — тратятся после звёзд подписки' : 'Never expire — spent after your monthly stars run out'}
            </p>
          </div>
        </div>

        {tier === 'free' && (
          /* Free: звёзды тратятся только внутри подписки — сначала тариф */
          <Card className="p-5 mb-5 anim-fade-up anim-d1" data-testid="card-subscribe-first">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-muted shrink-0">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-semibold leading-tight mb-1">
                  {ru ? 'Сначала подписка' : 'Subscription first'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {ru
                    ? 'Звёзды тратятся на функции внутри подписки: Standard — 250 в месяц, Premium — 550. Докупать имеет смысл, когда месячный запас закончился.'
                    : 'Stars are spent on features inside a subscription: Standard — 250 a month, Premium — 550. Top-ups make sense once your monthly stars run out.'}
                </p>
              </div>
            </div>
            <Button className="mt-4 h-11 w-full" onClick={() => { haptic.impact('light'); navigate('/subscribe'); }} data-testid="button-go-subscribe-stars">
              {ru ? `Подписка от ${STARS_SUB_PRICES.standard} ⭐ / мес` : `Plans from ${STARS_SUB_PRICES.standard} ⭐ / mo`}
            </Button>
          </Card>
        )}

        <>
            {/* Паки */}
            <div className="space-y-4">
              {ENERGY_PACKS.map((pack, i) => (
                <Card
                  key={pack.id}
                  className={`relative p-5 anim-fade-up anim-d${i + 1} ${pack.popular ? 'ring-1 ring-[hsl(var(--solar-gold))]/60' : ''}`}
                  data-testid={`card-energy-pack-${pack.amount}`}
                >
                  {pack.popular && (
                    <Badge className="absolute -top-2.5 right-4 bg-[hsl(var(--solar-gold))] text-[hsl(38,40%,10%)] hover:bg-[hsl(var(--solar-gold))]">
                      {ru ? 'Чаще всего берут' : 'Most popular'}
                    </Badge>
                  )}

                  <div className="flex items-end justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-4xl font-display font-bold leading-none">{pack.amount}</span>
                        <OrbIcon className="w-6 h-6 text-[hsl(var(--solar-gold))]" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {pack.base} <span className="text-[hsl(var(--solar-gold))]">+{pack.amount - pack.base} {ru ? 'бонус' : 'bonus'}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full h-11 text-base"
                    variant={pack.popular ? 'default' : 'outline'}
                    onClick={() => buy(pack)}
                    disabled={starsMutation.isPending}
                    data-testid={`button-stars-${pack.id}`}
                  >
                    {busy(pack)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <>{ru ? 'Купить за' : 'Buy for'} {pack.stars} ⭐</>}
                  </Button>
                </Card>
              ))}
            </div>

            <p className="mt-5 px-2 text-center text-xs text-muted-foreground anim-fade-up anim-d4">
              {ru
                ? 'Оплата — Telegram Stars, в одно касание. Звёзды зачисляются сразу после оплаты и не сгорают.'
                : 'Pay with Telegram Stars in one tap. Stars arrive right after payment and never expire.'}
            </p>
        </>
      </div>

    </div>
  );
}
