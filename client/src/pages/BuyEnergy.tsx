import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmailReceiptDialog } from '@/components/EmailReceiptDialog';
import { ArrowLeft, CreditCard, Check, Wallet, RefreshCw, Lock, Loader2 } from 'lucide-react';
import { ORB_PACKS } from '@shared/orbPacks';
import { useEnergy } from '@/store/useEnergy';
import { haptic } from '@/lib/haptics';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useTranslation } from '@/contexts/LocaleContext';
import WebApp from '@twa-dev/sdk';
import { openPaymentLink } from '@/lib/telegram';

// Единый прайс (shared/orbPacks.ts): одни и те же паки для Stars, карты и TON
const ENERGY_PACKS = ORB_PACKS.map((p) => ({
  id: p.id,
  amount: p.orbs,
  base: p.base,
  stars: p.stars,
  usdPrice: p.usd,
  rub: p.rub,
  popular: !!p.hot,
}));
type EnergyPack = typeof ENERGY_PACKS[number];

// Exchange rates response type
interface ExchangeRatesData {
  usdRub: { rate: number; cached: boolean; updatedAt: string };
  tonUsd: { rate: number; cached: boolean; updatedAt: string };
  tonRub: number;
}

export default function BuyEnergy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Оплата паков за Telegram Stars: инвойс с сервера -> нативное окно Telegram
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
            toast({ title: locale === 'ru' ? 'Оплата не прошла' : 'Payment failed', variant: 'destructive' });
          }
        });
      } else if (link) {
        window.open(link, '_blank'); // вне Telegram — открыть ссылку
      }
    },
    onError: () => toast({ title: locale === 'ru' ? 'Не удалось создать счёт' : 'Could not create invoice', variant: 'destructive' }),
  });

  const { t, locale } = useTranslation();
  const { tier } = useEnergy();
  const insideTelegram = !!(window as any)?.Telegram?.WebApp?.initData;
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const walletConnected = !!wallet;
  const [pendingTonPurchase, setPendingTonPurchase] = useState<EnergyPack | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [pendingYookassaPack, setPendingYookassaPack] = useState<EnergyPack | null>(null);
  const [yookassaIdempotencyKey, setYookassaIdempotencyKey] = useState<string | null>(null);


  // Trigger TON purchase after wallet connects
  useEffect(() => {
    if (walletConnected && pendingTonPurchase) {
      console.log('Wallet connected, processing pending TON purchase...');
      tonMutation.mutate(pendingTonPurchase);
      setPendingTonPurchase(null);
    }
  }, [walletConnected, pendingTonPurchase]);

  const { data: userData } = useQuery<{ ok: boolean; data: { id: string } }>({
    queryKey: ['/api/user/me'],
  });

  // Fetch exchange rates (TON refreshed on page load, RUB from daily cache)
  const { data: exchangeRatesData, isLoading: ratesLoading, refetch: refetchRates } = useQuery<{ ok: boolean; data: ExchangeRatesData }>({
    queryKey: ['/api/exchange-rates'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always', // Always refetch on page load for fresh TON rate
  });

  const tonMutation = useMutation({
    mutationFn: async (pack: EnergyPack) => {
      console.log('[TON_FRONTEND] Starting mutation for pack:', pack);
      console.log('[TON_FRONTEND] Wallet state:', wallet);
      
      // Get user's wallet address for tracking
      const userWalletAddress = wallet?.account?.address;
      
      if (!userWalletAddress) {
        throw new Error(
          locale === 'ru'
            ? 'Адрес кошелька недоступен. Пожалуйста, переподключите кошелек.'
            : 'Wallet address not available. Please reconnect your wallet.'
        );
      }
      
      console.log('[TON_FRONTEND] Sending request with userWalletAddress:', userWalletAddress);
      
      const response = await apiRequest('POST', '/api/payments/ton/create', {
        kind: 'energy_pack',
        energyAmount: pack.amount,
        amountUSD: pack.usdPrice,
        userWalletAddress, // Send wallet address to backend
      });
      
      console.log('[TON_FRONTEND] Response received:', response);
      
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      return response.data;
    },
    onSuccess: async (data, pack) => {
      try {
        console.log('[TON] Payment created, preparing transaction...', {
          paymentId: data.paymentId,
          wallet: data.walletAddress,
          amount: data.amountTON
        });

        // Validate amountTON is a positive integer string (nanotons) before sending to TON Connect.
        // If the TON exchange rate failed to load, amountTON can be "NaN"/"Infinity" which the
        // TON Connect SDK rejects with "Invalid 'payload' in message at index 0".
        const amountStr = String(data.amountTON ?? '');
        if (!data.walletAddress || !/^\d+$/.test(amountStr) || amountStr === '0') {
          toast({
            title: t.common.error,
            description: locale === 'ru'
              ? 'Не удалось получить курс GRAM. Попробуйте ещё раз через минуту.'
              : 'Failed to fetch GRAM exchange rate. Please try again in a minute.',
            variant: 'destructive',
          });
          return;
        }

        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes max per TON Connect spec
          messages: [
            {
              address: data.walletAddress,
              amount: amountStr,
            },
          ],
        };

        console.log('[TON] Opening wallet to sign transaction...');
        
        // Fire transaction request (don't wait for result - it's unreliable due to HMR)
        tonConnectUI.sendTransaction(transaction)
          .then(result => console.log('[TON] Transaction signed:', result))
          .catch(err => console.log('[TON] Transaction error (may be false alarm):', err));

        // Show notification to user
        toast({
          title: locale === 'ru' ? 'Подтвердите транзакцию' : 'Confirm transaction',
          description: locale === 'ru' 
            ? 'Подпишите транзакцию в кошельке'
            : 'Sign the transaction in your wallet',
        });

        // Redirect to payment success page where polling will happen
        // This prevents state loss when wallet redirects back in Mini App
        navigate(`/payment-success?paymentId=${data.paymentId}&type=ton`);
      } catch (error: any) {
        console.error('[TON] Error:', error);
        toast({
          title: t.common.error,
          description: error.message || t.errors.calculationFailed,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: t.common.error,
        description: error.message || t.errors.calculationFailed,
        variant: 'destructive',
      });
    },
  });


  const checkPendingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/payments/ton/check-pending', {});
      if (!response.ok) throw new Error(response.error || 'Failed to check payments');
      return response.data;
    },
    onSuccess: (data: any) => {
      if (data.found > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
        toast({
          title: locale === 'ru' ? 'Платежи найдены!' : 'Payments found!',
          description: locale === 'ru' 
            ? `На баланс зачислено ${data.creditedEnergy} звёзд`
            : `${data.creditedEnergy} stars added to your balance`,
        });
      } else {
        toast({
          title: locale === 'ru' ? 'Платежи не найдены' : 'No payments found',
          description: locale === 'ru'
            ? 'Незавершенных транзакций не обнаружено'
            : 'No pending transactions found',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: t.common.error,
        description: error.message || t.errors.calculationFailed,
        variant: 'destructive',
      });
    },
  });

  const yookassaMutation = useMutation({
    mutationFn: async ({ pack, email }: { pack: EnergyPack, email: string | undefined }) => {
      console.log('[YooKassa] ============ FRONTEND: Creating payment ============');
      console.log('[YooKassa] Pack:', pack);
      console.log('[YooKassa] Email:', email);
      console.log('[YooKassa] WebApp Platform:', WebApp.platform);
      console.log('[YooKassa] WebApp Version:', WebApp.version);
      console.log('[YooKassa] initDataUnsafe:', WebApp.initDataUnsafe);
      
      if (!userData?.ok || !userData.data?.id) {
        throw new Error(locale === 'ru' ? 'Пользователь не авторизован' : 'User not authenticated');
      }
      
      // Generate unique idempotency key using UUID v4 (if not already generated)
      // The key is persisted in state to handle retries correctly:
      // - First click: generate new UUID and save to state
      // - Retries: reuse the same UUID to prevent duplicate payments
      // - Success/Error: clear the key for next payment attempt
      let idempotencyKey = yookassaIdempotencyKey;
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        setYookassaIdempotencyKey(idempotencyKey);
      }
      
      console.log('[YooKassa] User ID:', userData.data.id);
      console.log('[YooKassa] Idempotency Key (UUID v4):', idempotencyKey);
      console.log('[YooKassa] Is retry:', !!yookassaIdempotencyKey);
      console.log('[YooKassa] Request payload:', {
        kind: 'energy_pack',
        pack: { energy: pack.amount },
        customerEmail: email || null,
        idempotencyKey
      });
      
      // Make request with automatic retry for race conditions
      let response = await apiRequest('POST', '/api/payments/yookassa/create', {
        kind: 'energy_pack',
        pack: { energy: pack.amount },
        customerEmail: email || null,
        idempotencyKey
      });
      
      console.log('[YooKassa] Response received:', response);
      console.log('[YooKassa] Response.ok:', response.ok);
      console.log('[YooKassa] Response.error:', response.error);
      console.log('[YooKassa] Response.data:', response.data);
      
      // If server asks to retry (payment being created by another request), wait and retry
      // Backend returns { ok: true, status: 'pending', retryAfter: N } for race conditions
      // Allow up to 2 retries to handle edge cases
      let retryCount = 0;
      while (response.status === 'pending' && response.retryAfter && retryCount < 2) {
        const retryAfter = response.retryAfter || 3;
        console.log('[YooKassa] Payment being created, retrying after', retryAfter, 'seconds... (attempt', retryCount + 1, ')');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        
        // Retry request
        response = await apiRequest('POST', '/api/payments/yookassa/create', {
          kind: 'energy_pack',
          pack: { energy: pack.amount },
          customerEmail: email || null,
          idempotencyKey
        });
        retryCount++;
      }
      
      // Check if we have valid response data
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      if (!response.data || !response.data.confirmationUrl) {
        throw new Error(locale === 'ru' 
          ? 'Платёж обрабатывается. Пожалуйста, повторите попытку через минуту.'
          : 'Payment is being processed. Please try again in a minute.');
      }
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[YooKassa] Payment created, redirecting to:', data.confirmationUrl);
      // Clear idempotency key on success (ready for next payment)
      setYookassaIdempotencyKey(null);
      
      if (data.confirmationUrl) {
        // Open YooKassa payment page. Inside Telegram Mini App window.location.href is
        // unreliable (especially on iOS), so prefer WebApp.openLink with fallbacks.
        openPaymentLink(data.confirmationUrl);
      } else {
        toast({
          title: t.common.error,
          description: locale === 'ru'
            ? 'Не удалось получить ссылку на оплату'
            : 'Failed to get payment link',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      console.error('[YooKassa] Error:', error);
      // Clear idempotency key on error (ready for next payment attempt)
      setYookassaIdempotencyKey(null);
      
      toast({
        title: t.common.error,
        description: error.message || t.errors.calculationFailed,
        variant: 'destructive',
      });
    },
  });

  // TON — по курсу от USD
  const getTonPrice = (usdPrice: number) => {
    if (exchangeRatesData?.ok && exchangeRatesData.data?.tonUsd?.rate) {
      return (usdPrice / exchangeRatesData.data.tonUsd.rate).toFixed(2);
    }
    return (usdPrice / 5.5).toFixed(2);
  };

  const ru = locale === 'ru';

  const startTon = async (pack: EnergyPack) => {
    haptic.impact('light');
    setSelectedPack(pack.amount);
    if (!walletConnected) {
      try {
        setPendingTonPurchase(pack);
        await tonConnectUI.openModal();
      } catch (error: any) {
        console.error('Failed to open wallet modal:', error);
        setPendingTonPurchase(null);
        toast({
          title: ru ? 'Ошибка подключения' : 'Connection error',
          description: ru ? 'Не удалось открыть окно кошелька. Попробуйте снова.' : 'Failed to open the wallet window. Try again.',
          variant: 'destructive',
        });
      }
    } else {
      tonMutation.mutate(pack);
    }
  };

  const startCard = (pack: EnergyPack) => {
    haptic.impact('light');
    setSelectedPack(pack.amount);
    setPendingYookassaPack(pack);
    setShowEmailDialog(true);
  };

  const startStars = (pack: EnergyPack) => {
    haptic.impact('medium');
    setSelectedPack(pack.amount);
    starsMutation.mutate(pack.id);
  };

  const busy = (pack: EnergyPack) =>
    selectedPack === pack.amount && (starsMutation.isPending || tonMutation.isPending || yookassaMutation.isPending);

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
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button className="h-10" onClick={() => { haptic.impact('light'); navigate('/subscribe'); }} data-testid="button-go-subscribe-stars">
                <OrbIcon className="w-4 h-4 mr-1.5" />{ru ? 'От 200 ⭐' : 'From 200 ⭐'}
              </Button>
              <Button variant="outline" className="h-10" onClick={() => { haptic.impact('light'); navigate('/subscribe'); }} data-testid="button-go-subscribe">
                <CreditCard className="w-4 h-4 mr-1.5" />{ru ? 'От 199 ₽' : 'From 199 ₽'}
              </Button>
            </div>
          </Card>
        )}

        <>
            {/* Паки — один прайс для всех способов оплаты */}
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
                    <p className="text-xs text-muted-foreground text-right">
                      ≈ {(pack.rub / pack.amount).toFixed(1).replace('.0', '')} ₽ / <OrbIcon className="w-3 h-3 inline -mt-0.5" />
                    </p>
                  </div>

                  {insideTelegram && (
                    <Button
                      className="w-full h-11 text-base"
                      onClick={() => startStars(pack)}
                      disabled={busy(pack)}
                      data-testid={`button-stars-${pack.id}`}
                    >
                      {starsMutation.isPending && selectedPack === pack.amount
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <>{ru ? 'Оплатить' : 'Pay'} {pack.stars} ⭐</>}
                    </Button>
                  )}

                  <div className={`grid grid-cols-2 gap-2 ${insideTelegram ? 'mt-2' : ''}`}>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => startCard(pack)}
                      disabled={busy(pack)}
                      data-testid={`button-buy-rubles-${pack.amount}`}
                    >
                      {yookassaMutation.isPending && selectedPack === pack.amount
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><CreditCard className="w-4 h-4 mr-1.5" />{pack.rub} ₽</>}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => startTon(pack)}
                      disabled={busy(pack) || ratesLoading}
                      data-testid={`button-buy-ton-${pack.amount}`}
                    >
                      {tonMutation.isPending && selectedPack === pack.amount
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Wallet className="w-4 h-4 mr-1.5" />{ratesLoading ? '…' : `${getTonPrice(pack.usdPrice)} GRAM`}</>}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Способы оплаты и проверка TON */}
            <div className="mt-5 space-y-3 anim-fade-up anim-d4">
              <p className="text-xs text-muted-foreground text-center px-2">
                {insideTelegram
                  ? (ru
                    ? 'Telegram Stars — в один тап, без ввода карты. Карта (₽) и GRAM (сеть TON) — во внешнем окне, зачисление сразу после подтверждения.'
                    : 'Telegram Stars — one tap, no card details. Card (₽) and GRAM (TON network) open in an external window; stars arrive right after confirmation.')
                  : (ru
                    ? 'Карта (₽) и GRAM (сеть TON). Зачисление сразу после подтверждения оплаты.'
                    : 'Card (₽) and GRAM (TON network). Stars arrive right after the payment is confirmed.')}
              </p>

              {exchangeRatesData?.ok && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>1 GRAM = ${exchangeRatesData.data.tonUsd.rate.toFixed(2)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => refetchRates()} data-testid="button-refresh-rates">
                      <RefreshCw className="w-3 h-3 mr-1" />{ru ? 'Курс' : 'Rate'}
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2 text-xs"
                      onClick={() => checkPendingMutation.mutate()}
                      disabled={checkPendingMutation.isPending}
                      data-testid="button-check-pending"
                    >
                      {checkPendingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />{ru ? 'Проверить GRAM' : 'Check GRAM'}</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
        </>
      </div>

      {pendingYookassaPack && (
        <EmailReceiptDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          onConfirm={(email) => {
            if (pendingYookassaPack) {
              yookassaMutation.mutate({ pack: pendingYookassaPack, email });
              setPendingYookassaPack(null);
            }
          }}
          amount={`${pendingYookassaPack.rub} ₽`}
          description={ru ? `Покупка ${pendingYookassaPack.amount} звёзд` : `Purchase ${pendingYookassaPack.amount} stars`}
        />
      )}
    </div>
  );
}
