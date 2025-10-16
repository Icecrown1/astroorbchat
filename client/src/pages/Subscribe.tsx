import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, CreditCard, Check, Sparkles, Wallet } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { sendTransaction, connectWallet, isWalletConnected } from '@/lib/ton';
import { useTranslation } from '@/contexts/LocaleContext';
import WebApp from '@twa-dev/sdk';

const SUBSCRIPTION_TIERS = [
  {
    tier: 'standard',
    name: 'Standard',
    price: 9,
    dailyEnergy: 100,
    features: ['100 energy orbs daily', 'All astrology features', 'Daily horoscope', 'Basic support'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 15,
    dailyEnergy: 250,
    features: ['250 energy orbs daily', 'All astrology features', 'Priority AI responses', 'Premium support', 'Advanced insights'],
    popular: true,
  },
];

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);

  // Check Telegram version for Stars support (6.0+)
  const isTelegramVersionSupported = () => {
    const version = WebApp.version;
    const [major] = version.split('.').map(Number);
    return major >= 6;
  };

  const supportsStars = isTelegramVersionSupported();

  useEffect(() => {
    const checkWallet = () => {
      setWalletConnected(isWalletConnected());
    };
    checkWallet();
    const interval = setInterval(checkWallet, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: pricesData, isLoading: pricesLoading } = useQuery({
    queryKey: ['/api/payments/price'],
  });

  const { data: userData } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const currentSubscription = userData?.data?.subscription;

  const mutation = useMutation({
    mutationFn: async (tier: typeof SUBSCRIPTION_TIERS[0]) => {
      const response = await apiRequest('POST', '/api/payments/ton/create', {
        kind: 'subscription',
        tier: tier.tier,
        amountUSD: tier.price,
      });
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      return response.data;
    },
    onSuccess: async (data, tier) => {
      try {
        await sendTransaction(
          data.walletAddress,
          data.amountTON,
          data.payload
        );
        queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
        toast({
          title: t.common.success,
          description: `${tier.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro}! ${tier.dailyEnergy} ${t.common.orbs}`,
        });
        navigate('/dashboard');
      } catch (error: any) {
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

  const starsMutation = useMutation({
    mutationFn: async (tier: typeof SUBSCRIPTION_TIERS[0]) => {
      alert('🟢 Step 1: Starting Stars subscription for ' + tier.tier);
      const response = await apiRequest('POST', '/api/payments/stars/create', {
        kind: 'subscription',
        tier: tier.tier,
      });
      alert('🟢 Step 2: API response: ' + JSON.stringify(response).substring(0, 100));
      if (!response.ok) throw new Error(response.error || t.errors.calculationFailed);
      return response.data;
    },
    onSuccess: (data, tier) => {
      alert('🟢 Step 3: Got invoice link: ' + data.invoiceLink.substring(0, 50));
      try {
        WebApp.openInvoice(data.invoiceLink, (status: string) => {
          alert('🟢 Step 4: Invoice status = ' + status);
          if (status === 'paid') {
            queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
            toast({
              title: t.common.success,
              description: `${tier.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro} ${t.subscribe.subscribeWith}!`,
            });
            navigate('/dashboard');
          } else if (status === 'cancelled') {
            toast({
              title: locale === 'ru' ? 'Платеж отменен' : 'Payment cancelled',
              description: locale === 'ru' ? 'Вы отменили платеж' : 'You cancelled the payment',
            });
          } else if (status === 'failed') {
            toast({
              title: t.common.error,
              description: locale === 'ru' ? 'Платеж не прошел' : 'Payment failed',
              variant: 'destructive',
            });
          }
        });
      } catch (error: any) {
        alert('🔴 Error opening invoice: ' + error.message);
        toast({
          title: t.common.error,
          description: error.message || t.errors.calculationFailed,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      alert('🔴 Mutation error: ' + error.message);
      toast({
        title: t.common.error,
        description: error.message || t.errors.calculationFailed,
        variant: 'destructive',
      });
    },
  });

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

  const getTonPrice = (usdPrice: number) => {
    if (pricesData?.ok && pricesData.data?.tonRate) {
      return (usdPrice / pricesData.data.tonRate).toFixed(2);
    }
    return (usdPrice / 7.5).toFixed(2);
  };

  const getLocalizedFeatures = (tier: string) => {
    if (tier === 'standard') {
      return locale === 'ru' ? [
        '100 сфер ежедневно',
        'Бесплатный план на неделю',
        'Бесплатный план на месяц',
        'Базовая поддержка'
      ] : [
        '100 orbs daily',
        'Free weekly plan',
        'Free monthly plan',
        'Basic support'
      ];
    } else {
      return locale === 'ru' ? [
        '250 сфер ежедневно',
        'Бесплатный план на неделю',
        'Бесплатный план на месяц',
        'Приоритет в обработке',
        'Премиум поддержка'
      ] : [
        '250 orbs daily',
        'Free weekly plan',
        'Free monthly plan',
        'Priority processing',
        'Premium support'
      ];
    }
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

        {pricesLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {SUBSCRIPTION_TIERS.map((tier) => (
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
                    {tier.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro}
                  </h3>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">{t.subscribe.perMonth}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ≈ {getTonPrice(tier.price)} TON{t.subscribe.perMonth}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {locale === 'ru' ? 'или' : 'or'} {pricesData?.data?.subscriptions?.[tier.tier as 'standard' | 'pro']?.stars || (tier.tier === 'standard' ? 565 : 940)} ⭐ Stars
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-chart-3/20 to-chart-2/20">
                    <Sparkles className="w-5 h-5 text-chart-3" />
                    <span className="font-bold">{tier.dailyEnergy} {t.common.orbs} {locale === 'ru' ? 'ежедневно' : 'daily'}</span>
                  </div>
                  {getLocalizedFeatures(tier.tier).map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-chart-3 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTier(tier.tier);
                      if (!supportsStars) {
                        toast({
                          title: locale === 'ru' ? 'Обновите Telegram' : 'Update Telegram',
                          description: locale === 'ru' 
                            ? 'Для оплаты Stars требуется Telegram версии 6.0 или выше. Пожалуйста, обновите приложение.'
                            : 'Stars payment requires Telegram version 6.0 or higher. Please update your app.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      starsMutation.mutate(tier);
                    }}
                    disabled={(starsMutation.isPending && selectedTier === tier.tier) || !supportsStars || currentSubscription?.tier === tier.tier}
                    data-testid={`button-subscribe-stars-${tier.tier}`}
                  >
                    {starsMutation.isPending && selectedTier === tier.tier ? (
                      <>
                        <Loader className="mr-2" size="sm" />
                        {t.subscribe.subscribing}
                      </>
                    ) : currentSubscription?.tier === tier.tier ? (
                      t.subscribe.currentPlan
                    ) : (
                      <>
                        <span className="mr-2">⭐</span>
                        {locale === 'ru' ? 'Оплатить Stars' : 'Pay with Stars'}
                      </>
                    )}
                  </Button>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!walletConnected) {
                        try {
                          await connectWallet();
                          setWalletConnected(true);
                          mutation.mutate(tier);
                        } catch (error: any) {
                          toast({
                            title: t.common.error,
                            description: error.message || 'Failed to connect wallet',
                            variant: 'destructive',
                          });
                        }
                      } else {
                        mutation.mutate(tier);
                      }
                    }}
                    disabled={mutation.isPending || currentSubscription?.tier === tier.tier}
                    data-testid={`button-subscribe-${tier.tier}`}
                  >
                    {mutation.isPending && selectedTier === tier.tier ? (
                      <>
                        <Loader className="mr-2" size="sm" />
                        {t.subscribe.subscribing}
                      </>
                    ) : currentSubscription?.tier === tier.tier ? (
                      t.subscribe.currentPlan
                    ) : !walletConnected ? (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        {locale === 'ru' ? 'Подключить кошелек' : 'Connect Wallet'}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        {t.subscribe.subscribeWith}
                      </>
                    )}
                  </Button>
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
            ))}
          </div>
        )}

        {!supportsStars && (
          <Card className="mt-6 p-4 bg-destructive/10 border-destructive/20">
            <p className="text-sm text-destructive text-center">
              {locale === 'ru' ? 
                '⚠️ Ваша версия Telegram не поддерживает Stars. Обновите приложение или используйте TON.' :
                '⚠️ Your Telegram version doesn\'t support Stars. Update your app or use TON payment.'
              }
            </p>
          </Card>
        )}

        <Card className="mt-6 p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            {locale === 'ru' 
              ? 'Подписка оплачивается ежемесячно через Telegram Stars ⭐ или TON блокчейн. Отмена в любое время. Энергия обновляется ежедневно в полночь.'
              : 'Subscriptions are billed monthly via Telegram Stars ⭐ or TON blockchain. Cancel anytime. Energy resets daily at midnight.'
            }
          </p>
        </Card>
      </div>
    </div>
  );
}
