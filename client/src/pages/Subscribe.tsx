import { useState, useEffect } from 'react';
import { haptic } from '@/lib/haptics';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader } from '@/components/Loader';
import { EmailReceiptDialog } from '@/components/EmailReceiptDialog';
import { ArrowLeft, CreditCard, Check, Wallet, RefreshCw, TrendingUp, RotateCcw } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useTranslation } from '@/contexts/LocaleContext';
import WebApp from '@twa-dev/sdk';
import { openPaymentLink } from '@/lib/telegram';
import type { User, Subscription } from '@shared/schema';

interface UserMeResponse {
  ok: boolean;
  data: User & {
    subscription?: Subscription | null;
    natalInitialized?: boolean;
  };
}

interface ExchangeRatesData {
  usdRub: { rate: number; cached: boolean; updatedAt: string };
  tonUsd: { rate: number; cached: boolean; updatedAt: string };
  tonRub: number;
}

type SubscriptionPeriod = 'monthly' | 'semiannual' | 'annual';

interface SubscriptionTier {
  tier: string;
  name: string;
  nameRu: string;
  monthlyOrbs: number;
  features: { ru: string[]; en: string[] };
  popular?: boolean;
  // Fixed RUB prices per month for each period
  pricesRub: {
    monthly: number;
    semiannual: number; // per month when paid for 6 months
    annual: number;     // per month when paid for 12 months
  };
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    tier: 'standard',
    name: 'Standard',
    nameRu: 'Стандарт',
    monthlyOrbs: 250,
    pricesRub: {
      monthly: 199,
      semiannual: 159,
      annual: 99,
    },
    features: {
      ru: [
        '250 звёзд в месяц',
        'Весь функционал, кроме Соляра',
        'Ежедневные гороскопы',
        'Детальные интерпретации планет',
        'Важные даты',
      ],
      en: [
        '250 stars per month',
        'All features except Solar Return',
        'Daily horoscopes',
        'Detailed planet interpretations',
        'Important dates',
      ],
    },
  },
  {
    tier: 'premium',
    name: 'Premium',
    nameRu: 'Премиум',
    monthlyOrbs: 550,
    pricesRub: {
      monthly: 399,
      semiannual: 359,
      annual: 179,
    },
    features: {
      ru: [
        '550 звёзд в месяц',
        'Весь функционал, включая Соляр',
        'Приоритетная обработка AI',
        'Премиум поддержка',
        'Эксклюзивные инсайты',
      ],
      en: [
        '550 stars per month',
        'All features including Solar Return',
        'Priority AI processing',
        'Premium support',
        'Exclusive insights',
      ],
    },
    popular: true,
  },
];

const PERIOD_CONFIG: Record<SubscriptionPeriod, { months: number; labelRu: string; labelEn: string; savingRu?: string; savingEn?: string }> = {
  monthly: { months: 1, labelRu: '1 месяц', labelEn: '1 month' },
  semiannual: { months: 6, labelRu: '6 месяцев', labelEn: '6 months', savingRu: '-16%', savingEn: '-16%' },
  annual: { months: 12, labelRu: '1 год', labelEn: '1 year', savingRu: '-37%', savingEn: '-37%' },
};

function calculatePeriodPriceRub(tier: SubscriptionTier, period: SubscriptionPeriod): number {
  const pricePerMonth = tier.pricesRub[period];
  const months = PERIOD_CONFIG[period].months;
  return pricePerMonth * months;
}

function calculatePeriodPrice(monthlyPrice: number, period: SubscriptionPeriod): number {
  const config = PERIOD_CONFIG[period];
  return Math.round(monthlyPrice * config.months * 100) / 100;
}

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const walletConnected = !!wallet;
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>('annual');
  const [pendingTonTier, setPendingTonTier] = useState<{ tier: SubscriptionTier; period: SubscriptionPeriod; mode?: 'new' | 'renew' | 'upgrade' } | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [pendingYookassaTier, setPendingYookassaTier] = useState<SubscriptionTier | null>(null);
  const [yookassaIdempotencyKey, setYookassaIdempotencyKey] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);

  // Trigger TON subscription after wallet connects
  useEffect(() => {
    if (walletConnected && pendingTonTier) {
      mutation.mutate(pendingTonTier);
      setPendingTonTier(null);
    }
  }, [walletConnected]);

  // Fetch exchange rates (TON refreshed on page load, RUB from daily cache)
  const { data: exchangeRatesData, isLoading: ratesLoading, refetch: refetchRates } = useQuery<{ ok: boolean; data: ExchangeRatesData }>({
    queryKey: ['/api/exchange-rates'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always', // Always refetch on page load for fresh TON rate
  });

  const { data: userData } = useQuery<UserMeResponse>({
    queryKey: ['/api/user/me'],
  });

  const currentSubscription = userData?.data?.subscription;

  interface UpgradePreviewData {
    canUpgrade: boolean;
    canRenew: boolean;
    currentTier?: string;
    remainingDays?: number;
    currentPeriodEnd?: string;
    upgradePrice?: number;
    upgradeStarsBonus?: number;
    renewalPrice?: number;
  }

  const { data: upgradePreviewData } = useQuery<{ ok: boolean; data: UpgradePreviewData }>({
    queryKey: ['/api/subscription/upgrade-preview'],
    enabled: currentSubscription?.status === 'active',
  });
  const upgradePreview = upgradePreviewData?.data;

  type TonSubArgs = { tier: SubscriptionTier; period: SubscriptionPeriod; mode?: 'new' | 'renew' | 'upgrade' };
  const mutation = useMutation({
    mutationFn: async ({ tier, period, mode }: TonSubArgs) => {
      const periodConfig = PERIOD_CONFIG[period];
      // Цена считается на сервере (₽ → USD по ЦБ → GRAM); здесь только тариф, период и режим
      const response = await apiRequest('POST', '/api/payments/ton/create', {
        kind: 'subscription',
        tier: tier.tier,
        period: period,
        months: periodConfig.months,
        mode: mode || 'new',
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      return response.data;
    },
    onSuccess: async (data) => {
      haptic.notify('success');
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
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: data.walletAddress,
            amount: amountStr,
          },
        ],
      };

      // Fire-and-forget: don't await — wallet redirects back in Mini App
      tonConnectUI.sendTransaction(transaction)
        .then(result => console.log('[TON] Subscription tx signed:', result))
        .catch(err => console.log('[TON] Subscription tx error (may be false alarm):', err));

      toast({
        title: locale === 'ru' ? 'Подтвердите транзакцию' : 'Confirm transaction',
        description: locale === 'ru'
          ? 'Подпишите транзакцию в кошельке'
          : 'Sign the transaction in your wallet',
      });

      navigate(`/payment-success?paymentId=${data.paymentId}&type=ton`);
    },
    onError: (error: any) => {
      toast({
        title: t.common.error,
        description: error.message || t.errors.calculationFailed,
        variant: 'destructive',
      });
    },
  });


  const upgradeMutation = useMutation({
    mutationFn: async ({ email }: { email?: string }) => {
      const idempotencyKey = crypto.randomUUID();
      const response = await apiRequest('POST', '/api/payments/yookassa/create', {
        kind: 'subscription_upgrade',
        idempotencyKey,
        periodMonths: PERIOD_CONFIG[selectedPeriod].months,
        customerEmail: email || null,
        autoRenew: false,
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      if (!response.data?.confirmationUrl) throw new Error(locale === 'ru' ? 'Не удалось создать платёж' : 'Failed to create payment');
      return response.data;
    },
    onSuccess: (data) => {
      haptic.notify('success');
      if (data.confirmationUrl) openPaymentLink(data.confirmationUrl);
    },
    onError: (error: any) => {
      toast({ title: t.common.error, description: error.message || t.errors.calculationFailed, variant: 'destructive' });
    },
  });

  const renewalMutation = useMutation({
    mutationFn: async ({ email }: { email?: string }) => {
      const idempotencyKey = crypto.randomUUID();
      const response = await apiRequest('POST', '/api/payments/yookassa/create', {
        kind: 'subscription_renewal',
        idempotencyKey,
        periodMonths: PERIOD_CONFIG[selectedPeriod].months,
        customerEmail: email || null,
        autoRenew: false,
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      if (!response.data?.confirmationUrl) throw new Error(locale === 'ru' ? 'Не удалось создать платёж' : 'Failed to create payment');
      return response.data;
    },
    onSuccess: (data) => {
      haptic.notify('success');
      if (data.confirmationUrl) openPaymentLink(data.confirmationUrl);
    },
    onError: (error: any) => {
      toast({ title: t.common.error, description: error.message || t.errors.calculationFailed, variant: 'destructive' });
    },
  });

  // Star-подписка: только месячный период (правило Telegram — ровно 30 дней)
  type StarsSubArgs = { tier: 'standard' | 'premium'; periodMonths: number; mode: 'new' | 'renew' | 'upgrade' };
  const starsSubMutation = useMutation({
    mutationFn: async ({ tier, periodMonths, mode }: StarsSubArgs) => {
      const response = await apiRequest('POST', '/api/payments/stars/create-subscription', { tier, periodMonths, mode });
      if (!response.ok) {
        if (response.error === 'stars_subscription_active') {
          throw new Error(locale === 'ru'
            ? 'У вас уже есть подписка за звёзды. Управление — в настройках Telegram → Мои звёзды.'
            : 'You already have a Stars subscription. Manage it in Telegram settings → My Stars.');
        }
        throw new Error(response.error || t.errors.calculationFailed);
      }
      return response as { link: string; stars: number };
    },
    onSuccess: (data, { tier, mode }) => {
      const wa = (window as any)?.Telegram?.WebApp;
      if (!wa?.openInvoice || !data?.link) {
        toast({ title: t.common.error, description: locale === 'ru' ? 'Откройте приложение в Telegram' : 'Open the app in Telegram', variant: 'destructive' });
        return;
      }
      haptic.impact('medium');
      wa.openInvoice(data.link, (status: string) => {
        if (status === 'paid') {
          queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
          queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
          queryClient.invalidateQueries({ queryKey: ['/api/subscription/upgrade-preview'] });
          navigate(`/payment-success?type=stars&kind=subscription&tier=${tier}&mode=${mode}`);
        } else if (status === 'failed') {
          haptic.notify('error');
          toast({ title: locale === 'ru' ? 'Оплата не прошла' : 'Payment failed', variant: 'destructive' });
        }
      });
    },
    onError: (error: any) => {
      haptic.notify('error');
      toast({ title: t.common.error, description: error.message, variant: 'destructive' });
    },
  });
  const insideTelegram = !!(window as any)?.Telegram?.WebApp?.initData;
  // Stars = ceil(₽); месячная новая — 200/400 recurring
  const starsPrice = (rub: number) => Math.max(1, Math.ceil(rub));
  const gramLabel = (rub: number) => {
    const rate = exchangeRatesData?.data?.usdRub?.rate || 84;
    const ton = exchangeRatesData?.data?.tonUsd?.rate;
    return ton ? `${((rub / rate) / ton).toFixed(2)} GRAM` : 'GRAM';
  };
  const GramButton = ({ label, tier, mode, disabled, testId }: { label: string; tier: SubscriptionTier; mode: 'new' | 'renew' | 'upgrade'; disabled?: boolean; testId: string }) => (
    <Button
      className="w-full"
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        haptic.impact('light');
        setSelectedTier(tier.tier);
        if (!walletConnected) {
          setPendingTonTier({ tier, period: selectedPeriod, mode });
          tonConnectUI.openModal();
        } else {
          mutation.mutate({ tier, period: selectedPeriod, mode });
        }
      }}
      disabled={disabled || mutation.isPending}
      data-testid={testId}
    >
      {mutation.isPending && selectedTier === tier.tier
        ? <><Loader className="mr-2" size="sm" />{t.subscribe.subscribing}</>
        : <><Wallet className="w-4 h-4 mr-2" />{label}</>}
    </Button>
  );
  const StarsButton = ({ label, args, primary, disabled, testId }: { label: string; args: StarsSubArgs; primary?: boolean; disabled?: boolean; testId: string }) => (
    <Button
      className="w-full"
      variant={primary ? 'default' : 'outline'}
      onClick={(e) => { e.stopPropagation(); setSelectedTier(args.tier); starsSubMutation.mutate(args); }}
      disabled={disabled || starsSubMutation.isPending}
      data-testid={testId}
    >
      {starsSubMutation.isPending && selectedTier === args.tier
        ? <><Loader className="mr-2" size="sm" />{t.subscribe.subscribing}</>
        : <><OrbIcon className="w-4 h-4 mr-2" />{label}</>}
    </Button>
  );

  const [showUpgradeEmailDialog, setShowUpgradeEmailDialog] = useState(false);
  const [showRenewalEmailDialog, setShowRenewalEmailDialog] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user/subscription/cancel', {});
      if (!response.ok) throw new Error(response.error || 'Failed to cancel subscription');
      return response.data;
    },
    onSuccess: (data) => {
      haptic.notify('success');
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: locale === 'ru' ? 'Подписка отменена' : 'Subscription Canceled',
        description: locale === 'ru' 
          ? `Доступ сохранится до ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
          : `Access remains until ${new Date(data.currentPeriodEnd).toLocaleDateString()}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.common.error,
        description: error.message || 'Failed to cancel',
        variant: 'destructive',
      });
    },
  });

  const devSubscribeMutation = useMutation({
    mutationFn: async (tier: 'standard' | 'pro') => {
      const response = await apiRequest('POST', '/api/dev/subscribe', { tier });
      if (!response.ok) throw new Error(response.error || 'Failed to activate dev subscription');
      return response.data;
    },
    onSuccess: (data) => {
      haptic.notify('success');
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: 'Dev Subscription Activated',
        description: `${data.tier} subscription active for 30 days (FREE in dev mode)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.common.error,
        description: error.message || 'Failed to activate',
        variant: 'destructive',
      });
    },
  });

  const yookassaMutation = useMutation({
    mutationFn: async ({ tier, email, period, enableAutoRenew }: { tier: SubscriptionTier, email: string | undefined, period: SubscriptionPeriod, enableAutoRenew: boolean }) => {
      console.log('[YooKassa] ============ FRONTEND: Creating subscription payment ============');
      console.log('[YooKassa] Tier:', tier.tier);
      console.log('[YooKassa] Period:', period);
      console.log('[YooKassa] Email:', email);
      console.log('[YooKassa] Auto-Renew:', enableAutoRenew);
      console.log('[YooKassa] WebApp Platform:', WebApp.platform);
      console.log('[YooKassa] WebApp Version:', WebApp.version);
      console.log('[YooKassa] initDataUnsafe:', WebApp.initDataUnsafe);
      
      if (!userData?.ok || !userData.data?.id) {
        throw new Error(locale === 'ru' ? 'Пользователь не авторизован' : 'User not authenticated');
      }
      
      const periodConfig = PERIOD_CONFIG[period];
      const totalPriceRub = calculatePeriodPriceRub(tier, period);
      
      // Generate unique idempotency key using UUID v4 (if not already generated)
      let idempotencyKey = yookassaIdempotencyKey;
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        setYookassaIdempotencyKey(idempotencyKey);
      }
      
      console.log('[YooKassa] User ID:', userData.data.id);
      console.log('[YooKassa] Total Price RUB:', totalPriceRub);
      console.log('[YooKassa] Months:', periodConfig.months);
      console.log('[YooKassa] Idempotency Key (UUID v4):', idempotencyKey);
      console.log('[YooKassa] Is retry:', !!yookassaIdempotencyKey);
      
      // Make request with automatic retry for race conditions
      let response = await apiRequest('POST', '/api/payments/yookassa/create', {
        kind: 'subscription',
        tier: tier.tier,
        periodMonths: periodConfig.months,
        autoRenew: enableAutoRenew,
        customerEmail: email || null,
        idempotencyKey
      });
      
      // If server asks to retry (payment being created by another request), wait and retry
      let retryCount = 0;
      while (response.status === 'pending' && response.retryAfter && retryCount < 2) {
        const retryAfter = response.retryAfter || 3;
        console.log('[YooKassa] Payment being created, retrying after', retryAfter, 'seconds... (attempt', retryCount + 1, ')');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        
        // Retry request
        response = await apiRequest('POST', '/api/payments/yookassa/create', {
          kind: 'subscription',
          tier: tier.tier,
          periodMonths: periodConfig.months,
          autoRenew: enableAutoRenew,
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
      haptic.notify('success');
      console.log('[YooKassa] Subscription payment created, redirecting to:', data.confirmationUrl);
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

  // Calculate TON price from exchange rates
  const getTonPrice = (usdPrice: number) => {
    if (exchangeRatesData?.ok && exchangeRatesData.data?.tonUsd?.rate) {
      return (usdPrice / exchangeRatesData.data.tonUsd.rate).toFixed(2);
    }
    return (usdPrice / 5.5).toFixed(2); // Fallback
  };

  // Calculate RUB price from exchange rates
  const getRubPrice = (usdPrice: number) => {
    if (exchangeRatesData?.ok && exchangeRatesData.data?.usdRub?.rate) {
      return Math.round(usdPrice * exchangeRatesData.data.usdRub.rate);
    }
    return Math.round(usdPrice * 78.5); // Fallback
  };

  // Get formatted rate info for display
  const getRateInfo = () => {
    if (!exchangeRatesData?.ok) return null;
    const { usdRub, tonUsd } = exchangeRatesData.data;
    return {
      usdRub: usdRub.rate.toFixed(2),
      tonUsd: tonUsd.rate.toFixed(2),
    };
  };

  const getLocalizedFeatures = (tier: SubscriptionTier) => {
    return locale === 'ru' ? tier.features.ru : tier.features.en;
  };

  const getLocalizedTierName = (tier: SubscriptionTier) => {
    return locale === 'ru' ? tier.nameRu : tier.name;
  };

  const getOrbsDisplay = (tier: SubscriptionTier) => {
    return `${tier.monthlyOrbs} ${locale === 'ru' ? 'звёзд/мес' : 'stars/mo'}`;
  };


  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">{t.subscribe.title}</h1>
            <p className="text-muted-foreground">{t.subscribe.subtitle}</p>
          </div>
        </div>

        {currentSubscription?.status === 'active' && (
          <Card className="p-4 mb-6 bg-chart-3/10 border-chart-3/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium">{t.subscribe.currentPlan}: {currentSubscription.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro}</p>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' ? 'Активна до' : 'Active until'} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
                {(currentSubscription as any)?.scheduledTier && (
                  <p className="text-xs text-[hsl(var(--solar-gold))] mt-1" data-testid="text-scheduled-subscription">
                    {locale === 'ru'
                      ? `Далее: ${(currentSubscription as any).scheduledTier === 'standard' ? 'Standard' : 'Premium'} на ${(currentSubscription as any).scheduledPeriodMonths} мес — оплачено`
                      : `Next: ${(currentSubscription as any).scheduledTier === 'standard' ? 'Standard' : 'Premium'} for ${(currentSubscription as any).scheduledPeriodMonths} mo — paid`}
                  </p>
                )}
              </div>
              <Badge className="bg-chart-3">{locale === 'ru' ? 'Активна' : 'Active'}</Badge>
            </div>
            {currentSubscription.paymentProvider === 'stars' ? (
              <div className="rounded-lg bg-background/40 p-3 text-sm" data-testid="stars-subscription-manage">
                <p className="text-muted-foreground mb-2">
                  {locale === 'ru'
                    ? 'Оплачено звёздами Telegram, продлевается каждые 30 дней автоматически. Отмена и возврат — в настройках Telegram → Мои звёзды.'
                    : 'Paid with Telegram Stars, renews every 30 days automatically. Cancel or refund in Telegram settings → My Stars.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    haptic.impact('light');
                    const wa = (window as any)?.Telegram?.WebApp;
                    try { (wa?.openTelegramLink || window.open)('tg://settings/stars'); } catch { /* noop */ }
                  }}
                  data-testid="button-manage-stars"
                >
                  <OrbIcon className="w-4 h-4 mr-2" />
                  {locale === 'ru' ? 'Открыть настройки звёзд' : 'Open Stars settings'}
                </Button>
              </div>
            ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (confirm(locale === 'ru' 
                  ? 'Отменить подписку? Доступ сохранится до конца периода.'
                  : 'Cancel subscription? Access will remain until period end.')) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel-subscription"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {locale === 'ru' ? 'Отмена...' : 'Canceling...'}
                </>
              ) : (
                locale === 'ru' ? 'Отменить подписку' : 'Cancel Subscription'
              )}
            </Button>
            )}
          </Card>
        )}

        {currentSubscription?.status === 'canceled' && (
          <Card className="p-4 mb-6 bg-orange-500/10 border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t.subscribe.currentPlan}: {currentSubscription.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro}</p>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' ? 'Доступ до' : 'Access until'} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="border-orange-500 text-orange-500">
                {locale === 'ru' ? 'Отменена' : 'Canceled'}
              </Badge>
            </div>
          </Card>
        )}

        {currentSubscription?.status === 'expired' && (
          <Card className="p-4 mb-6 bg-destructive/10 border-destructive/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{locale === 'ru' ? 'Подписка истекла' : 'Subscription Expired'}</p>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' ? 'Истекла' : 'Expired on'} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="border-destructive text-destructive">
                {locale === 'ru' ? 'Истекла' : 'Expired'}
              </Badge>
            </div>
          </Card>
        )}

        {ratesLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <>
            {/* Period Selector */}
            <div className="flex justify-center gap-2 mb-4">
              {(['monthly', 'semiannual', 'annual'] as SubscriptionPeriod[]).map((period) => {
                const config = PERIOD_CONFIG[period];
                return (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    className="relative"
                    data-testid={`button-period-${period}`}
                  >
                    {locale === 'ru' ? config.labelRu : config.labelEn}
                    {config.savingRu && (
                      <Badge className="absolute -top-2 -right-2 bg-chart-3 text-xs px-1">
                        {locale === 'ru' ? config.savingRu : config.savingEn}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
            
            {/* Exchange rates info */}
            {exchangeRatesData?.ok && (
              <Card className="p-3 mb-4 bg-muted/50">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>1 USD = {getRateInfo()?.usdRub} ₽</span>
                    <span>1 GRAM = ${getRateInfo()?.tonUsd}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => refetchRates()}
                    className="h-7 px-2"
                    data-testid="button-refresh-rates"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {locale === 'ru' ? 'Обновить' : 'Refresh'}
                  </Button>
                </div>
              </Card>
            )}

            {/* Auto-Renewal Option (only for YooKassa payments) */}
            <Card className="p-4 mb-6 bg-muted/50">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="auto-renew"
                  checked={autoRenew}
                  onCheckedChange={(checked) => setAutoRenew(checked === true)}
                  data-testid="checkbox-auto-renew"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="auto-renew"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {locale === 'ru' ? 'Автопродление подписки' : 'Auto-renew subscription'}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {locale === 'ru' 
                      ? 'Подписка будет автоматически продлеваться. Вы можете отменить в любой момент. Работает только с оплатой рублями.'
                      : 'Subscription will automatically renew. You can cancel anytime. Works only with ruble payments.'}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {SUBSCRIPTION_TIERS.map((tier) => {
                const totalPriceRub = calculatePeriodPriceRub(tier, selectedPeriod);
                const pricePerMonthRub = tier.pricesRub[selectedPeriod];
                const basePricePerMonth = tier.pricesRub.monthly;
                const periodConfig = PERIOD_CONFIG[selectedPeriod];
                
                return (
                  <Card
                    key={tier.tier}
                    className={`p-6 cursor-pointer transition-all hover-elevate ${
                      selectedTier === tier.tier ? 'ring-2 ring-primary' : ''
                    } ${tier.popular ? 'relative' : ''}`}
                    onClick={() => setSelectedTier(tier.tier)}
                    data-testid={`card-subscription-${tier.tier}`}
                  >
                    {tier.popular && (
                      <Badge className="absolute -top-2 -right-2 bg-primary">
                        {t.subscribe.mostPopular}
                      </Badge>
                    )}

                    <div className="mb-6">
                      <h3 className="text-2xl font-display font-bold mb-2">
                        {getLocalizedTierName(tier)}
                      </h3>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-bold">{pricePerMonthRub} ₽</span>
                        <span className="text-muted-foreground">
                          / {locale === 'ru' ? 'мес' : 'mo'}
                        </span>
                      </div>
                      {selectedPeriod !== 'monthly' && (
                        <p className="text-sm text-muted-foreground line-through">
                          {basePricePerMonth} ₽/{locale === 'ru' ? 'мес' : 'mo'}
                        </p>
                      )}
                      <p className="text-sm text-chart-3 font-medium">
                        {locale === 'ru' ? 'Итого за' : 'Total for'} {locale === 'ru' ? periodConfig.labelRu : periodConfig.labelEn}: {totalPriceRub} ₽
                        {selectedPeriod !== 'monthly' && (
                          <span className="ml-1 text-muted-foreground">
                            {locale === 'ru' ? `· ≈ ${Math.round(totalPriceRub / (periodConfig.months * 30))} ₽/день` : `· ≈ ${Math.round(totalPriceRub / (periodConfig.months * 30))} ₽/day`}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-chart-3/20 to-chart-2/20">
                        <OrbIcon className="w-5 h-5 text-[hsl(41,81%,68%)]" />
                        <span className="font-bold">{getOrbsDisplay(tier)}</span>
                      </div>
                      {getLocalizedFeatures(tier).map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-chart-3 shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const isActiveSub = currentSubscription?.status === 'active';
                        // Map frontend tier name to DB tier name
                        const dbTierName = tier.tier === 'premium' ? 'pro' : tier.tier;
                        const isCurrentTier = isActiveSub && currentSubscription?.tier === dbTierName;
                        const isHigherTierActive = isActiveSub && currentSubscription?.tier === 'pro' && tier.tier === 'standard';

                        // --- CASE 1: This is the current active tier → show Renewal button ---
                        if (isCurrentTier) {
                          return (
                            <div className="space-y-2">
                            {!(currentSubscription?.paymentProvider === 'stars' && selectedPeriod === 'monthly') && (
                              <StarsButton
                                testId={`button-renew-stars-${tier.tier}`}
                                args={{ tier: tier.tier as 'standard' | 'premium', periodMonths: PERIOD_CONFIG[selectedPeriod].months, mode: 'renew' }}
                                label={locale === 'ru' ? `Продлить за ${starsPrice(totalPriceRub)} ⭐` : `Renew for ${starsPrice(totalPriceRub)} ⭐`}
                              />
                            )}
                            <GramButton
                              testId={`button-renew-ton-${tier.tier}`}
                              tier={tier} mode="renew"
                              label={locale === 'ru' ? `Продлить за ${gramLabel(totalPriceRub)}` : `Renew for ${gramLabel(totalPriceRub)}`}
                            />
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); setShowRenewalEmailDialog(true); }}
                              disabled={renewalMutation.isPending}
                              data-testid={`button-renewal-${tier.tier}`}
                            >
                              {renewalMutation.isPending ? (
                                <><Loader className="mr-2" size="sm" />{locale === 'ru' ? 'Обработка...' : 'Processing...'}</>
                              ) : (
                                <>
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  {locale === 'ru'
                                    ? `Продлить на ${periodConfig.labelRu} за ${totalPriceRub} ₽`
                                    : `Renew for ${periodConfig.labelEn} — ${totalPriceRub} ₽`}
                                </>
                              )}
                            </Button>
                            </div>
                          );
                        }

                        // --- CASE 2: Standard user viewing Premium → show Upgrade button ---
                        if (isActiveSub && currentSubscription?.tier === 'standard' && tier.tier === 'premium' && upgradePreview?.canUpgrade) {
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground text-center px-1">
                                {selectedPeriod === 'monthly'
                                  ? (locale === 'ru'
                                    ? `Доплата за ${upgradePreview.remainingDays} оставшихся дней. Дата окончания не меняется. +${upgradePreview.upgradeStarsBonus} звёзд сразу.`
                                    : `Prorated charge for ${upgradePreview.remainingDays} remaining days. Expiry unchanged. +${upgradePreview.upgradeStarsBonus} stars immediately.`)
                                  : (locale === 'ru'
                                    ? `Premium на ${periodConfig.labelRu} (${totalPriceRub} ₽) + доплата ${upgradePreview.upgradePrice} ₽ за ${upgradePreview.remainingDays} дн. текущего периода. Срок продлится от текущей даты окончания.`
                                    : `Premium for ${periodConfig.labelEn} (${totalPriceRub} ₽) + ${upgradePreview.upgradePrice} ₽ prorated for the ${upgradePreview.remainingDays} days left. Term extends from your current expiry.`)}
                              </div>
                              <StarsButton
                                primary
                                testId={`button-upgrade-stars-${tier.tier}`}
                                args={{ tier: 'premium', periodMonths: PERIOD_CONFIG[selectedPeriod].months, mode: 'upgrade' }}
                                label={locale === 'ru'
                                  ? `Апгрейд за ${starsPrice((upgradePreview.upgradePrice ?? 0) + (selectedPeriod === 'monthly' ? 0 : totalPriceRub))} ⭐`
                                  : `Upgrade for ${starsPrice((upgradePreview.upgradePrice ?? 0) + (selectedPeriod === 'monthly' ? 0 : totalPriceRub))} ⭐`}
                              />
                              <GramButton
                                testId={`button-upgrade-ton-${tier.tier}`}
                                tier={tier} mode="upgrade"
                                label={locale === 'ru'
                                  ? `Апгрейд за ${gramLabel((upgradePreview.upgradePrice ?? 0) + (selectedPeriod === 'monthly' ? 0 : totalPriceRub))}`
                                  : `Upgrade for ${gramLabel((upgradePreview.upgradePrice ?? 0) + (selectedPeriod === 'monthly' ? 0 : totalPriceRub))}`}
                              />
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); setShowUpgradeEmailDialog(true); }}
                                disabled={upgradeMutation.isPending}
                                data-testid={`button-upgrade-${tier.tier}`}
                              >
                                {upgradeMutation.isPending ? (
                                  <><Loader className="mr-2" size="sm" />{locale === 'ru' ? 'Обработка...' : 'Processing...'}</>
                                ) : (
                                  <>
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    {selectedPeriod === 'monthly'
                                      ? (locale === 'ru' ? `Апгрейд за ${upgradePreview.upgradePrice} ₽` : `Upgrade for ${upgradePreview.upgradePrice} ₽`)
                                      : (locale === 'ru'
                                        ? `Перейти на Premium за ${(upgradePreview.upgradePrice ?? 0) + totalPriceRub} ₽`
                                        : `Go Premium for ${(upgradePreview.upgradePrice ?? 0) + totalPriceRub} ₽`)}
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        }

                        // --- CASE 3: Premium user viewing Standard → оплатить Standard со стартом после Premium ---
                        if (isHigherTierActive) {
                          const startsAt = new Date(currentSubscription!.currentPeriodEnd).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US');
                          const alreadyScheduled = !!(currentSubscription as any)?.scheduledTier;
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground text-center px-1">
                                {alreadyScheduled
                                  ? (locale === 'ru' ? `Standard уже запланирован с ${startsAt}` : `Standard is already scheduled from ${startsAt}`)
                                  : (locale === 'ru'
                                    ? `Premium останется до ${startsAt}, затем включится Standard на ${periodConfig.labelRu}`
                                    : `Premium stays until ${startsAt}, then Standard for ${periodConfig.labelEn} kicks in`)}
                              </div>
                              <StarsButton
                                testId={`button-schedule-stars-${tier.tier}`}
                                disabled={alreadyScheduled}
                                args={{ tier: tier.tier as 'standard' | 'premium', periodMonths: PERIOD_CONFIG[selectedPeriod].months, mode: 'new' }}
                                label={locale === 'ru' ? `Standard с ${startsAt} за ${starsPrice(totalPriceRub)} ⭐` : `Standard from ${startsAt} for ${starsPrice(totalPriceRub)} ⭐`}
                              />
                              <GramButton
                                testId={`button-schedule-ton-${tier.tier}`}
                                tier={tier} mode="new" disabled={alreadyScheduled}
                                label={locale === 'ru' ? `Standard с ${startsAt} за ${gramLabel(totalPriceRub)}` : `Standard from ${startsAt} for ${gramLabel(totalPriceRub)}`}
                              />
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); haptic.impact('light'); setPendingYookassaTier(tier); setShowEmailDialog(true); }}
                                disabled={yookassaMutation.isPending || alreadyScheduled}
                                data-testid={`button-schedule-${tier.tier}`}
                              >
                                {yookassaMutation.isPending ? (
                                  <><Loader className="mr-2" size="sm" />{t.subscribe.subscribing}</>
                                ) : (
                                  <><CreditCard className="w-4 h-4 mr-2" />{locale === 'ru' ? `Standard с ${startsAt} за ${totalPriceRub} ₽` : `Standard from ${startsAt} for ${totalPriceRub} ₽`}</>
                                )}
                              </Button>
                            </div>
                          );
                        }

                        // --- CASE 4: No active sub or sub is canceled/expired → regular subscribe buttons ---
                        const starsTier = tier.tier as 'standard' | 'premium';
                        return (
                          <>
                            {insideTelegram && (
                              <StarsButton
                                primary={!!tier.popular}
                                testId={`button-subscribe-stars-${tier.tier}`}
                                args={{ tier: starsTier, periodMonths: PERIOD_CONFIG[selectedPeriod].months, mode: 'new' }}
                                label={selectedPeriod === 'monthly'
                                  ? (locale === 'ru' ? `Оформить за ${starsTier === 'premium' ? 400 : 200} ⭐/мес` : `Subscribe for ${starsTier === 'premium' ? 400 : 200} ⭐/mo`)
                                  : (locale === 'ru' ? `Оформить за ${starsPrice(totalPriceRub)} ⭐` : `Subscribe for ${starsPrice(totalPriceRub)} ⭐`)}
                              />
                            )}
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!walletConnected) {
                                  setPendingTonTier({ tier, period: selectedPeriod });
                                  tonConnectUI.openModal();
                                } else {
                                  mutation.mutate({ tier, period: selectedPeriod });
                                }
                              }}
                              disabled={mutation.isPending}
                              data-testid={`button-subscribe-ton-${tier.tier}`}
                            >
                              {mutation.isPending && selectedTier === tier.tier ? (
                                <><Loader className="mr-2" size="sm" />{t.subscribe.subscribing}</>
                              ) : !walletConnected ? (
                                <><Wallet className="w-4 h-4 mr-2" />{locale === 'ru' ? 'Подключить кошелек' : 'Connect Wallet'}</>
                              ) : (
                                <><Wallet className="w-4 h-4 mr-2" />{locale === 'ru' ? `Оплатить ${gramLabel(totalPriceRub)}` : `Pay ${gramLabel(totalPriceRub)}`}</>
                              )}
                            </Button>
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingYookassaTier(tier);
                                setShowEmailDialog(true);
                              }}
                              disabled={yookassaMutation.isPending}
                              data-testid={`button-subscribe-rubles-${tier.tier}`}
                            >
                              {yookassaMutation.isPending ? (
                                <><Loader className="mr-2" size="sm" />{t.subscribe.subscribing}</>
                              ) : (
                                <><CreditCard className="w-4 h-4 mr-2" />{locale === 'ru' ? `Оплатить ${totalPriceRub} ₽` : `Pay ${totalPriceRub} ₽`}</>
                              )}
                            </Button>
                          </>
                        );
                      })()}
                    </div>

                    {/* DEV ONLY: Free subscription button */}
                    {import.meta.env.DEV && (
                      <Button
                        className="w-full mt-2"
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          devSubscribeMutation.mutate(tier.tier as 'standard' | 'pro');
                        }}
                        disabled={devSubscribeMutation.isPending}
                        data-testid={`button-dev-subscribe-${tier.tier}`}
                      >
                        {devSubscribeMutation.isPending ? (
                          <>
                            <Loader className="mr-2" size="sm" />
                            Activating...
                          </>
                        ) : (
                          <>
                            Dev: Free Subscribe
                          </>
                        )}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        <Card className="mt-6 p-4 bg-muted/50">
        {/* Trust-блок: почему нам можно верить */}
        <div className="mt-6 grid gap-2 anim-fade-up">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="mt-0.5 text-[hsl(41,81%,68%)]">✦</span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {locale === 'ru'
                ? 'Расчёты — Swiss Ephemeris, та же астрономия, что у NASA JPL. Никаких «примерно»: позиции планет с точностью до минуты дуги.'
                : 'Calculations run on Swiss Ephemeris — the same astronomy as NASA JPL. No approximations: planet positions to the arc minute.'}
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="mt-0.5 text-[hsl(160,55%,56%)]">✓</span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {locale === 'ru'
                ? 'Отмена в один клик в любой момент. Никаких скрытых списаний: автопродление — только по вашему явному согласию.'
                : 'Cancel anytime in one tap. No hidden charges: auto-renewal only with your explicit consent.'}
            </p>
          </div>
        </div>

          <p className="text-sm text-muted-foreground text-center">
            {locale === 'ru' 
              ? 'Оплата картой (₽), в GRAM или Telegram Stars. Звёзды подписки начисляются раз в месяц, купленные отдельно — не сгорают. Отмена в любой момент.'
              : 'Pay by card (₽), in GRAM or with Telegram Stars. Subscription stars are credited monthly; purchased stars never expire. Cancel anytime.'
            }
          </p>
        </Card>
      </div>

      {/* Email Receipt Dialog — new subscription */}
      {pendingYookassaTier && (
        <EmailReceiptDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          onConfirm={(email) => {
            if (pendingYookassaTier) {
              yookassaMutation.mutate({ tier: pendingYookassaTier, email, period: selectedPeriod, enableAutoRenew: autoRenew });
              setPendingYookassaTier(null);
            }
          }}
          amount={`${calculatePeriodPriceRub(pendingYookassaTier, selectedPeriod)} ₽`}
          description={locale === 'ru' 
            ? `Подписка ${pendingYookassaTier.nameRu} (${PERIOD_CONFIG[selectedPeriod].labelRu})`
            : `${pendingYookassaTier.name} Subscription (${PERIOD_CONFIG[selectedPeriod].labelEn})`
          }
        />
      )}

      {/* Email Receipt Dialog — upgrade Standard → Premium */}
      <EmailReceiptDialog
        open={showUpgradeEmailDialog}
        onOpenChange={setShowUpgradeEmailDialog}
        onConfirm={(email) => {
          upgradeMutation.mutate({ email });
        }}
        amount={`${(upgradePreview?.upgradePrice ?? 0) + (selectedPeriod === 'monthly' ? 0 : calculatePeriodPriceRub(SUBSCRIPTION_TIERS[1], selectedPeriod))} ₽`}
        description={selectedPeriod === 'monthly'
          ? (locale === 'ru'
            ? `Апгрейд до Премиум (доплата за ${upgradePreview?.remainingDays ?? '...'} дн.)`
            : `Upgrade to Premium (prorated for ${upgradePreview?.remainingDays ?? '...'} days)`)
          : (locale === 'ru'
            ? `Премиум на ${PERIOD_CONFIG[selectedPeriod].labelRu} + доплата за ${upgradePreview?.remainingDays ?? '...'} дн.`
            : `Premium for ${PERIOD_CONFIG[selectedPeriod].labelEn} + prorated ${upgradePreview?.remainingDays ?? '...'} days`)}
      />

      {/* Email Receipt Dialog — renewal same tier */}
      <EmailReceiptDialog
        open={showRenewalEmailDialog}
        onOpenChange={setShowRenewalEmailDialog}
        onConfirm={(email) => {
          renewalMutation.mutate({ email });
        }}
        amount={`${calculatePeriodPriceRub(SUBSCRIPTION_TIERS[currentSubscription?.tier === 'standard' ? 0 : 1], selectedPeriod)} ₽`}
        description={locale === 'ru'
          ? `Продление подписки на ${PERIOD_CONFIG[selectedPeriod].labelRu}`
          : `Subscription renewal for ${PERIOD_CONFIG[selectedPeriod].labelEn}`}
      />
    </div>
  );
}
