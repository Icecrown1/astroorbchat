import { useState } from 'react';
import { haptic } from '@/lib/haptics';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Check, Gift, RefreshCw } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useFirstMonthOffer } from '@/components/FirstMonthOfferButton';
import {
  STARS_SUB_PRICES,
  subscriptionStars,
  upgradeStars,
  type PaidTier,
  type PeriodMonths,
} from '@shared/subscriptionPrices';
import type { User, Subscription } from '@shared/schema';

/**
 * Экран подписки. Оплата внутри Telegram — только Telegram Stars (правило Telegram для цифровых товаров):
 * 1 месяц — recurring star-подписка (Telegram продлевает каждые 30 дней), 6/12 месяцев — разовый счёт,
 * акция «первый месяц −50%» — разовый счёт на месяц. Цены — shared/subscriptionPrices (как на сервере).
 */

interface UserMeResponse {
  ok: boolean;
  data: User & {
    subscription?: Subscription | null;
    natalInitialized?: boolean;
  };
}

type SubscriptionPeriod = 'monthly' | 'semiannual' | 'annual';

interface SubscriptionTier {
  tier: PaidTier;
  name: string;
  nameRu: string;
  monthlyOrbs: number;
  features: { ru: string[]; en: string[] };
  popular?: boolean;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    tier: 'standard',
    name: 'Standard',
    nameRu: 'Стандарт',
    monthlyOrbs: 250,
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

const PERIOD_CONFIG: Record<SubscriptionPeriod, { months: PeriodMonths; labelRu: string; labelEn: string }> = {
  monthly: { months: 1, labelRu: '1 месяц', labelEn: '1 month' },
  semiannual: { months: 6, labelRu: '6 месяцев', labelEn: '6 months' },
  annual: { months: 12, labelRu: '1 год', labelEn: '1 year' },
};

/** Цена в Stars за весь период */
const periodStars = (tier: PaidTier, period: SubscriptionPeriod) => subscriptionStars(tier, PERIOD_CONFIG[period].months);
/** Скидка периода к помесячной оплате, % */
const periodSavingPct = (tier: PaidTier, period: SubscriptionPeriod) => {
  const months = PERIOD_CONFIG[period].months;
  if (months === 1) return 0;
  return Math.round((1 - periodStars(tier, period) / (STARS_SUB_PRICES[tier] * months)) * 100);
};
/** Максимальная скидка периода среди тарифов — для бейджа «до −N%» */
const maxSavingPct = (period: SubscriptionPeriod) =>
  Math.max(...SUBSCRIPTION_TIERS.map((t) => periodSavingPct(t.tier, period)));

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const ru = locale === 'ru';
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>(() => {
    try {
      return new URLSearchParams(window.location.search).get('offer') === 'first_month' ? 'monthly' : 'annual';
    } catch {
      return 'annual';
    }
  });

  const { data: userData, isLoading: userLoading } = useQuery<UserMeResponse>({
    queryKey: ['/api/user/me'],
  });

  const currentSubscription = userData?.data?.subscription;
  const isActiveSub = currentSubscription?.status === 'active';

  // Акция «первый месяц −50%» — цены в Stars, разовая оплата за 1 месяц (право решает сервер)
  const firstMonthOffer = useFirstMonthOffer(!isActiveSub);
  const promoStars = (tier: PaidTier): number | null => {
    if (!firstMonthOffer) return null;
    const p = tier === 'premium' ? firstMonthOffer.premium?.promo : firstMonthOffer.standard?.promo;
    return typeof p === 'number' ? p : null;
  };

  interface UpgradePreviewData {
    canUpgrade: boolean;
    canRenew: boolean;
    currentTier?: string;
    remainingDays?: number;
    currentPeriodEnd?: string;
    upgradePrice?: number;
    upgradeStarsBonus?: number;
    upgradeStarsPrice?: Record<string, number>;
  }

  const { data: upgradePreviewData } = useQuery<{ ok: boolean; data: UpgradePreviewData }>({
    queryKey: ['/api/subscription/upgrade-preview'],
    enabled: isActiveSub,
  });
  const upgradePreview = upgradePreviewData?.data;
  const upgradePriceStars = (months: PeriodMonths) =>
    upgradePreview?.upgradeStarsPrice?.[String(months)] ?? upgradeStars(upgradePreview?.remainingDays ?? 0, months);

  type StarsMode = 'new' | 'renew' | 'upgrade' | 'first_month';
  type StarsSubArgs = { tier: PaidTier; periodMonths: PeriodMonths; mode: StarsMode };
  const starsSubMutation = useMutation({
    mutationFn: async ({ tier, periodMonths, mode }: StarsSubArgs) => {
      try {
        return (await apiRequest('POST', '/api/payments/stars/create-subscription', { tier, periodMonths, mode })) as { link: string; stars: number };
      } catch (e: any) {
        const code = String(e?.message || '');
        if (code === 'stars_subscription_active') {
          throw new Error(ru
            ? 'У вас уже есть подписка за Telegram Stars. Управление — в настройках Telegram → Мои звёзды.'
            : 'You already have a Telegram Stars subscription. Manage it in Telegram settings → My Stars.');
        }
        if (code === 'offer_not_available') {
          queryClient.invalidateQueries({ queryKey: ['/api/offers/first-month'] });
          throw new Error(ru ? 'Скидка на первый месяц уже недоступна.' : 'The first-month discount is no longer available.');
        }
        throw new Error(ru ? 'Не удалось создать счёт. Попробуйте ещё раз.' : 'Could not create the invoice. Please try again.');
      }
    },
    onSuccess: (data, { tier, mode }) => {
      if (!data?.link) return;
      const wa = (window as any)?.Telegram?.WebApp;
      if (!wa?.openInvoice) {
        // Вне Telegram: ссылка на счёт откроется в приложении Telegram, доступ включится после оплаты
        window.open(data.link, '_blank');
        return;
      }
      haptic.impact('medium');
      wa.openInvoice(data.link, (status: string) => {
        if (status === 'paid') {
          queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
          queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
          queryClient.invalidateQueries({ queryKey: ['/api/subscription/upgrade-preview'] });
          queryClient.invalidateQueries({ queryKey: ['/api/offers/first-month'] });
          navigate(`/payment-success?type=stars&kind=subscription&tier=${tier}&mode=${mode === 'first_month' ? 'new' : mode}`);
        } else if (status === 'failed') {
          haptic.notify('error');
          toast({ title: ru ? 'Оплата не прошла' : 'Payment failed', variant: 'destructive' });
        }
      });
    },
    onError: (error: any) => {
      haptic.notify('error');
      toast({ title: t.common.error, description: error.message, variant: 'destructive' });
    },
  });

  const StarsButton = ({ label, args, primary, disabled, testId }: { label: string; args: StarsSubArgs; primary?: boolean; disabled?: boolean; testId: string }) => (
    <Button
      className="w-full h-11 text-base"
      variant={primary ? 'default' : 'outline'}
      onClick={(e) => { e.stopPropagation(); haptic.impact('light'); setSelectedTier(args.tier); starsSubMutation.mutate(args); }}
      disabled={disabled || starsSubMutation.isPending}
      data-testid={testId}
    >
      {starsSubMutation.isPending && selectedTier === args.tier
        ? <><Loader className="mr-2" size="sm" />{t.subscribe.subscribing}</>
        : label}
    </Button>
  );

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
        title: ru ? 'Подписка отменена' : 'Subscription Canceled',
        description: ru
          ? `Доступ сохранится до ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
          : `Access remains until ${new Date(data.currentPeriodEnd).toLocaleDateString()}`,
      });
    },
    onError: (error: any) => {
      toast({ title: t.common.error, description: error.message || 'Failed to cancel', variant: 'destructive' });
    },
  });

  const devSubscribeMutation = useMutation({
    mutationFn: async ({ tier, months }: { tier: 'standard' | 'pro'; months: number }) => {
      const response = await apiRequest('POST', '/api/dev/subscribe', { tier, months });
      if (!response.ok) throw new Error(response.error || 'Failed to activate dev subscription');
      return response.data;
    },
    onSuccess: (data) => {
      haptic.notify('success');
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({ title: 'Dev Subscription Activated', description: `${data.tier} subscription active (FREE in dev mode)` });
    },
    onError: (error: any) => {
      toast({ title: t.common.error, description: error.message || 'Failed to activate', variant: 'destructive' });
    },
  });

  const openStarsSettings = () => {
    haptic.impact('light');
    const wa = (window as any)?.Telegram?.WebApp;
    try { (wa?.openTelegramLink || window.open)('tg://settings/stars'); } catch { /* noop */ }
  };

  const tierName = (tier: SubscriptionTier) => (ru ? tier.nameRu : tier.name);
  const periodLabel = (period: SubscriptionPeriod) => (ru ? PERIOD_CONFIG[period].labelRu : PERIOD_CONFIG[period].labelEn);
  const perMonth = ru ? 'мес' : 'mo';

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">{t.subscribe.title}</h1>
            <p className="text-muted-foreground">{t.subscribe.subtitle}</p>
          </div>
        </div>

        {isActiveSub && currentSubscription && (
          <Card className="p-4 mb-6 bg-chart-3/10 border-chart-3/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium">{t.subscribe.currentPlan}: {currentSubscription.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro}</p>
                <p className="text-sm text-muted-foreground">
                  {ru ? 'Активна до' : 'Active until'} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
                {(currentSubscription as any)?.scheduledTier && (
                  <p className="text-xs text-[hsl(var(--solar-gold))] mt-1" data-testid="text-scheduled-subscription">
                    {ru
                      ? `Далее: ${(currentSubscription as any).scheduledTier === 'standard' ? 'Standard' : 'Premium'} на ${(currentSubscription as any).scheduledPeriodMonths} мес — оплачено`
                      : `Next: ${(currentSubscription as any).scheduledTier === 'standard' ? 'Standard' : 'Premium'} for ${(currentSubscription as any).scheduledPeriodMonths} mo — paid`}
                  </p>
                )}
              </div>
              <Badge className="bg-chart-3">{ru ? 'Активна' : 'Active'}</Badge>
            </div>
            {currentSubscription.paymentProvider === 'stars' && currentSubscription.autoRenew ? (
              <div className="rounded-lg bg-background/40 p-3 text-sm" data-testid="stars-subscription-manage">
                <p className="text-muted-foreground mb-2">
                  {ru
                    ? 'Оплачено в Telegram Stars, продлевается каждые 30 дней автоматически. Отмена — в настройках Telegram → Мои звёзды.'
                    : 'Paid with Telegram Stars, renews every 30 days automatically. Cancel in Telegram settings → My Stars.'}
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={openStarsSettings} data-testid="button-manage-stars">
                  {ru ? 'Открыть настройки Telegram Stars' : 'Open Telegram Stars settings'}
                </Button>
              </div>
            ) : currentSubscription.autoRenew ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (confirm(ru ? 'Отменить подписку? Доступ сохранится до конца периода.' : 'Cancel subscription? Access will remain until period end.')) {
                    cancelMutation.mutate();
                  }
                }}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-subscription"
              >
                {cancelMutation.isPending
                  ? <><Loader className="mr-2" size="sm" />{ru ? 'Отмена...' : 'Canceling...'}</>
                  : (ru ? 'Отменить подписку' : 'Cancel Subscription')}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground" data-testid="text-no-autorenew">
                {ru ? 'Без автопродления — продлить можно ниже.' : 'No auto-renewal — you can renew below.'}
              </p>
            )}
          </Card>
        )}

        {currentSubscription?.status === 'canceled' && (
          <Card className="p-4 mb-6 bg-orange-500/10 border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t.subscribe.currentPlan}: {currentSubscription.tier === 'standard' ? t.subscribe.standard : t.subscribe.pro}</p>
                <p className="text-sm text-muted-foreground">
                  {ru ? 'Доступ до' : 'Access until'} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="border-orange-500 text-orange-500">{ru ? 'Отменена' : 'Canceled'}</Badge>
            </div>
          </Card>
        )}

        {currentSubscription?.status === 'expired' && (
          <Card className="p-4 mb-6 bg-destructive/10 border-destructive/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{ru ? 'Подписка истекла' : 'Subscription Expired'}</p>
                <p className="text-sm text-muted-foreground">
                  {ru ? 'Истекла' : 'Expired on'} {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="border-destructive text-destructive">{ru ? 'Истекла' : 'Expired'}</Badge>
            </div>
          </Card>
        )}

        {userLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <>
            {firstMonthOffer && (
              <Card className="p-4 mb-5 border-primary/40 bg-primary/10" data-testid="card-offer-first-month">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--solar-gold))]/15">
                    <Gift className="h-5 w-5 text-[hsl(var(--solar-gold))]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold">
                      {ru ? `Первый месяц −${firstMonthOffer.discountPct ?? 50}%` : `First month ${firstMonthOffer.discountPct ?? 50}% off`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ru
                        ? `Standard — ${firstMonthOffer.standard?.promo} ⭐ вместо ${firstMonthOffer.standard?.full} ⭐, Premium — ${firstMonthOffer.premium?.promo} ⭐ вместо ${firstMonthOffer.premium?.full} ⭐. Разовая оплата за первый месяц, без автопродления.`
                        : `Standard ${firstMonthOffer.standard?.promo} ⭐ instead of ${firstMonthOffer.standard?.full} ⭐, Premium ${firstMonthOffer.premium?.promo} ⭐ instead of ${firstMonthOffer.premium?.full} ⭐. One-time payment for your first month, no auto-renewal.`}
                    </p>
                    {selectedPeriod !== 'monthly' && (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => { haptic.impact('light'); setSelectedPeriod('monthly'); }}
                        data-testid="button-offer-pick-monthly"
                      >
                        {ru ? 'Выбрать 1 месяц со скидкой' : 'Pick 1 month with the discount'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Period Selector */}
            <div className="flex justify-center gap-2 mb-6 pt-3">
              {(['monthly', 'semiannual', 'annual'] as SubscriptionPeriod[]).map((period) => {
                const saving = maxSavingPct(period);
                return (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    className="relative"
                    data-testid={`button-period-${period}`}
                  >
                    {periodLabel(period)}
                    {saving > 0 && (
                      <Badge className="no-default-hover-elevate absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-chart-3 px-1 text-[10px] leading-4">
                        {ru ? `до −${saving}%` : `up to −${saving}%`}
                      </Badge>
                    )}
                    {period === 'monthly' && firstMonthOffer && (
                      <Badge className="no-default-hover-elevate absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[hsl(var(--solar-gold))] px-1 text-[10px] leading-4 text-[hsl(var(--background))]">
                        −{firstMonthOffer.discountPct ?? 50}%
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {SUBSCRIPTION_TIERS.map((tier) => {
                const months = PERIOD_CONFIG[selectedPeriod].months;
                const totalStars = periodStars(tier.tier, selectedPeriod);
                const monthlyStars = STARS_SUB_PRICES[tier.tier];
                const perMonthStars = Math.round(totalStars / months);
                const saving = periodSavingPct(tier.tier, selectedPeriod);
                const promo = selectedPeriod === 'monthly' ? promoStars(tier.tier) : null;

                return (
                  <Card
                    key={tier.tier}
                    className={`p-6 cursor-pointer transition-all hover-elevate ${selectedTier === tier.tier ? 'ring-2 ring-primary' : ''} ${tier.popular ? 'relative' : ''}`}
                    onClick={() => setSelectedTier(tier.tier)}
                    data-testid={`card-subscription-${tier.tier}`}
                  >
                    {tier.popular && (
                      <Badge className="no-default-hover-elevate absolute -top-2.5 right-4 bg-primary">{t.subscribe.mostPopular}</Badge>
                    )}

                    <div className="mb-6">
                      <h3 className="text-2xl font-display font-bold mb-2">{tierName(tier)}</h3>
                      {promo !== null ? (
                        <>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-4xl font-bold text-[hsl(var(--solar-gold))]">{promo} ⭐</span>
                            <span className="text-muted-foreground line-through">{monthlyStars} ⭐</span>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`text-promo-note-${tier.tier}`}>
                            {ru ? 'первый месяц, без автопродления' : 'first month, no auto-renewal'}
                          </p>
                        </>
                      ) : (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-4xl font-bold">{perMonthStars} ⭐</span>
                          <span className="text-muted-foreground">/ {perMonth}</span>
                          {saving > 0 && (
                            <span className="text-sm text-muted-foreground line-through">{monthlyStars} ⭐</span>
                          )}
                        </div>
                      )}
                      {promo === null && (
                        <p className="text-sm text-chart-3 font-medium" data-testid={`text-total-${tier.tier}`}>
                          {months === 1
                            ? (ru ? 'Telegram продлевает каждые 30 дней' : 'Telegram renews every 30 days')
                            : (ru
                              ? `Итого за ${periodLabel(selectedPeriod)}: ${totalStars} ⭐ · −${saving}%`
                              : `Total for ${periodLabel(selectedPeriod)}: ${totalStars} ⭐ · −${saving}%`)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-chart-3/20 to-chart-2/20">
                        <OrbIcon className="w-5 h-5 text-[hsl(var(--solar-gold))]" />
                        <span className="font-bold">{tier.monthlyOrbs} {ru ? 'звёзд/мес' : 'stars/mo'}</span>
                      </div>
                      {(ru ? tier.features.ru : tier.features.en).map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-chart-3 shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const dbTierName = tier.tier === 'premium' ? 'pro' : tier.tier;
                        const isCurrentTier = isActiveSub && currentSubscription?.tier === dbTierName;
                        const isHigherTierActive = isActiveSub && currentSubscription?.tier === 'pro' && tier.tier === 'standard';

                        // CASE 1: текущий тариф → продление
                        if (isCurrentTier) {
                          const starsAutoRenew = currentSubscription?.paymentProvider === 'stars' && !!currentSubscription?.autoRenew;
                          if (starsAutoRenew && selectedPeriod === 'monthly') {
                            return (
                              <p className="text-xs text-muted-foreground text-center px-1" data-testid={`text-autorenew-${tier.tier}`}>
                                {ru
                                  ? 'Ваш тариф — продлевается автоматически каждые 30 дней. Можно оплатить сразу 6 или 12 месяцев — выгоднее.'
                                  : 'Your plan — renews automatically every 30 days. You can prepay 6 or 12 months for less.'}
                              </p>
                            );
                          }
                          return (
                            <StarsButton
                              primary
                              testId={`button-renew-stars-${tier.tier}`}
                              args={{ tier: tier.tier, periodMonths: months, mode: 'renew' }}
                              label={ru ? `Продлить на ${periodLabel(selectedPeriod)} за ${totalStars} ⭐` : `Renew for ${periodLabel(selectedPeriod)} — ${totalStars} ⭐`}
                            />
                          );
                        }

                        // CASE 2: Standard смотрит на Premium → апгрейд
                        if (isActiveSub && currentSubscription?.tier === 'standard' && tier.tier === 'premium' && upgradePreview?.canUpgrade) {
                          const price = upgradePriceStars(months);
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground text-center px-1">
                                {months === 1
                                  ? (ru
                                    ? `Доплата за ${upgradePreview.remainingDays} оставшихся дней. Дата окончания не меняется. +${upgradePreview.upgradeStarsBonus} звёзд сразу.`
                                    : `Prorated charge for ${upgradePreview.remainingDays} remaining days. Expiry unchanged. +${upgradePreview.upgradeStarsBonus} stars immediately.`)
                                  : (ru
                                    ? `Premium на ${periodLabel(selectedPeriod)} + доплата за ${upgradePreview.remainingDays} дн. текущего периода. Срок продлится от текущей даты окончания.`
                                    : `Premium for ${periodLabel(selectedPeriod)} + prorated ${upgradePreview.remainingDays} days left. Term extends from your current expiry.`)}
                              </div>
                              <StarsButton
                                primary
                                testId={`button-upgrade-stars-${tier.tier}`}
                                args={{ tier: 'premium', periodMonths: months, mode: 'upgrade' }}
                                label={ru ? `Перейти на Premium за ${price} ⭐` : `Go Premium for ${price} ⭐`}
                              />
                            </div>
                          );
                        }

                        // CASE 3: Premium смотрит на Standard → Standard стартует после Premium
                        if (isHigherTierActive) {
                          const startsAt = new Date(currentSubscription!.currentPeriodEnd).toLocaleDateString(ru ? 'ru-RU' : 'en-US');
                          const alreadyScheduled = !!(currentSubscription as any)?.scheduledTier;
                          // Сервер выставит разовый счёт: Standard включится после окончания Premium
                          const schedulePeriod = selectedPeriod;
                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground text-center px-1">
                                {alreadyScheduled
                                  ? (ru ? `Standard уже запланирован с ${startsAt}` : `Standard is already scheduled from ${startsAt}`)
                                  : (ru
                                    ? `Premium останется до ${startsAt}, затем включится Standard на ${periodLabel(schedulePeriod)}`
                                    : `Premium stays until ${startsAt}, then Standard for ${periodLabel(schedulePeriod)} kicks in`)}
                              </div>
                              <StarsButton
                                testId={`button-schedule-stars-${tier.tier}`}
                                disabled={alreadyScheduled}
                                args={{ tier: 'standard', periodMonths: PERIOD_CONFIG[schedulePeriod].months, mode: 'new' }}
                                label={ru ? `Standard с ${startsAt} за ${periodStars('standard', schedulePeriod)} ⭐` : `Standard from ${startsAt} for ${periodStars('standard', schedulePeriod)} ⭐`}
                              />
                            </div>
                          );
                        }

                        // CASE 4: нет активной подписки → оформить
                        if (promo !== null) {
                          return (
                            <StarsButton
                              primary
                              testId={`button-subscribe-offer-${tier.tier}`}
                              args={{ tier: tier.tier, periodMonths: 1, mode: 'first_month' }}
                              label={ru ? `Первый месяц за ${promo} ⭐` : `First month for ${promo} ⭐`}
                            />
                          );
                        }
                        return (
                          <StarsButton
                            primary={!!tier.popular}
                            testId={`button-subscribe-stars-${tier.tier}`}
                            args={{ tier: tier.tier, periodMonths: months, mode: 'new' }}
                            label={months === 1
                              ? (ru ? `Оформить за ${monthlyStars} ⭐ / мес` : `Subscribe for ${monthlyStars} ⭐ / mo`)
                              : (ru ? `Оформить за ${totalStars} ⭐` : `Subscribe for ${totalStars} ⭐`)}
                          />
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
                          devSubscribeMutation.mutate({ tier: tier.tier === 'premium' ? 'pro' : 'standard', months: PERIOD_CONFIG[selectedPeriod].months });
                        }}
                        disabled={devSubscribeMutation.isPending}
                        data-testid={`button-dev-subscribe-${tier.tier}`}
                      >
                        {devSubscribeMutation.isPending ? <><Loader className="mr-2" size="sm" />Activating...</> : 'Dev: Free Subscribe'}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Trust-блок */}
        <div className="mt-6 grid gap-2 anim-fade-up">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="mt-0.5 text-[hsl(var(--solar-gold))]">✦</span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {ru
                ? 'Расчёты — Swiss Ephemeris, та же астрономия, что у NASA JPL. Никаких «примерно»: позиции планет с точностью до минуты дуги.'
                : 'Calculations run on Swiss Ephemeris — the same astronomy as NASA JPL. No approximations: planet positions to the arc minute.'}
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {ru
                ? 'Оплата — Telegram Stars, в одно касание. Автопродление только у подписки на 1 месяц, отменить её можно в любой момент в настройках Telegram → Мои звёзды. 6 и 12 месяцев — разовая оплата.'
                : 'Pay with Telegram Stars in one tap. Only the 1-month plan auto-renews — cancel anytime in Telegram settings → My Stars. 6 and 12 months are one-time payments.'}
            </p>
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {ru
              ? 'Звёзды подписки начисляются раз в месяц, купленные отдельно — не сгорают.'
              : 'Subscription stars are credited monthly; purchased stars never expire.'}
          </p>
        </div>
      </div>
    </div>
  );
}
