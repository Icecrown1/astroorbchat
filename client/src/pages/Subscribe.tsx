import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader } from '@/components/Loader';
import { EmailReceiptDialog } from '@/components/EmailReceiptDialog';
import { ArrowLeft, CreditCard, Check, Sparkles, Wallet, RefreshCw, TrendingUp, RotateCcw } from 'lucide-react';
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
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>('monthly');
  const [pendingTonTier, setPendingTonTier] = useState<{ tier: SubscriptionTier; period: SubscriptionPeriod } | null>(null);
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

  const mutation = useMutation({
    mutationFn: async ({ tier, period }: { tier: SubscriptionTier; period: SubscriptionPeriod }) => {
      const periodConfig = PERIOD_CONFIG[period];
      const totalPriceRub = calculatePeriodPriceRub(tier, period);
      const totalPriceUsd = totalPriceRub / (exchangeRatesData?.data?.usdRub?.rate || 78.5);
      const response = await apiRequest('POST', '/api/payments/ton/create', {
        kind: 'subscription',
        tier: tier.tier,
        amountUSD: totalPriceUsd,
        period: period,
        months: periodConfig.months,
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      return response.data;
    },
    onSuccess: async (data) => {
      // Validate amountTON is a positive integer string (nanotons) before sending to TON Connect.
      // If the TON exchange rate failed to load, amountTON can be "NaN"/"Infinity" which the
      // TON Connect SDK rejects with "Invalid 'payload' in message at index 0".
      const amountStr = String(data.amountTON ?? '');
      if (!data.walletAddress || !/^\d+$/.test(amountStr) || amountStr === '0') {
        toast({
          title: t.common.error,
          description: locale === 'ru'
            ? 'Не удалось получить курс TON. Попробуйте ещё раз через минуту.'
            : 'Failed to fetch TON exchange rate. Please try again in a minute.',
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
        customerEmail: email || null,
        autoRenew: false,
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      if (!response.data?.confirmationUrl) throw new Error(locale === 'ru' ? 'Не удалось создать платёж' : 'Failed to create payment');
      return response.data;
    },
    onSuccess: (data) => {
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
        customerEmail: email || null,
        autoRenew: false,
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      if (!response.data?.confirmationUrl) throw new Error(locale === 'ru' ? 'Не удалось создать платёж' : 'Failed to create payment');
      return response.data;
    },
    onSuccess: (data) => {
      if (data.confirmationUrl) openPaymentLink(data.confirmationUrl);
    },
    onError: (error: any) => {
      toast({ title: t.common.error, description: error.message || t.errors.calculationFailed, variant: 'destructive' });
    },
  });

  const [showUpgradeEmailDialog, setShowUpgradeEmailDialog] = useState(false);
  const [showRenewalEmailDialog, setShowRenewalEmailDialog] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user/subscription/cancel', {});
      if (!response.ok) throw new Error(response.error || 'Failed to cancel subscription');
      return response.data;
    },
    onSuccess: (data) => {
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
              </div>
              <Badge className="bg-chart-3">{locale === 'ru' ? 'Активна' : 'Active'}</Badge>
            </div>
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
                    <span>1 TON = ${getRateInfo()?.tonUsd}</span>
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
                      </p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-chart-3/20 to-chart-2/20">
                        <Sparkles className="w-5 h-5 text-chart-3" />
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
                                    ? `Продлить +30 дней за ${upgradePreview?.renewalPrice ?? (tier.tier === 'standard' ? 199 : 399)} ₽`
                                    : `Renew +30 days for ${upgradePreview?.renewalPrice ?? (tier.tier === 'standard' ? 199 : 399)} ₽`}
                                </>
                              )}
                            </Button>
                          );
                        }

                        // --- CASE 2: Standard user viewing Premium → show Upgrade button ---
                        if (isActiveSub && currentSubscription?.tier === 'standard' && tier.tier === 'premium' && upgradePreview?.canUpgrade) {
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground text-center px-1">
                                {locale === 'ru'
                                  ? `Доплата за ${upgradePreview.remainingDays} оставшихся дней. Дата окончания не меняется. +${upgradePreview.upgradeStarsBonus} звёзд сразу.`
                                  : `Prorated charge for ${upgradePreview.remainingDays} remaining days. Expiry unchanged. +${upgradePreview.upgradeStarsBonus} stars immediately.`}
                              </div>
                              <Button
                                className="w-full"
                                onClick={(e) => { e.stopPropagation(); setShowUpgradeEmailDialog(true); }}
                                disabled={upgradeMutation.isPending}
                                data-testid={`button-upgrade-${tier.tier}`}
                              >
                                {upgradeMutation.isPending ? (
                                  <><Loader className="mr-2" size="sm" />{locale === 'ru' ? 'Обработка...' : 'Processing...'}</>
                                ) : (
                                  <>
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    {locale === 'ru'
                                      ? `Апгрейд за ${upgradePreview.upgradePrice} ₽`
                                      : `Upgrade for ${upgradePreview.upgradePrice} ₽`}
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        }

                        // --- CASE 3: Premium user viewing Standard → disabled downgrade ---
                        if (isHigherTierActive) {
                          return (
                            <Button className="w-full" variant="outline" disabled data-testid={`button-downgrade-disabled-${tier.tier}`}>
                              {locale === 'ru' ? 'Недоступно (понижение тарифа)' : 'Unavailable (downgrade)'}
                            </Button>
                          );
                        }

                        // --- CASE 4: No active sub or sub is canceled/expired → regular subscribe buttons ---
                        return (
                          <>
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
                                <><CreditCard className="w-4 h-4 mr-2" />{t.subscribe.subscribeWith}</>
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
          <p className="text-sm text-muted-foreground text-center">
            {locale === 'ru' 
              ? 'Подписка оплачивается ежемесячно через TON блокчейн. Отмена в любое время. Энергия обновляется ежедневно в полночь.'
              : 'Subscriptions are billed monthly via TON blockchain. Cancel anytime. Energy resets daily at midnight.'
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
        amount={`${upgradePreview?.upgradePrice ?? '...'} ₽`}
        description={locale === 'ru'
          ? `Апгрейд до Премиум (доплата за ${upgradePreview?.remainingDays ?? '...'} дн.)`
          : `Upgrade to Premium (prorated for ${upgradePreview?.remainingDays ?? '...'} days)`}
      />

      {/* Email Receipt Dialog — renewal same tier */}
      <EmailReceiptDialog
        open={showRenewalEmailDialog}
        onOpenChange={setShowRenewalEmailDialog}
        onConfirm={(email) => {
          renewalMutation.mutate({ email });
        }}
        amount={`${upgradePreview?.renewalPrice ?? (currentSubscription?.tier === 'standard' ? 199 : 399)} ₽`}
        description={locale === 'ru'
          ? `Продление подписки +30 дней`
          : `Subscription renewal +30 days`}
      />
    </div>
  );
}
