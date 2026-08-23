import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Users, Copy, Share2, Gift, Crown, Calendar } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { FeatureVignette } from '@/components/FeatureVignette';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/store/useAuth';
import { hapticFeedback } from '@/lib/telegram';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';
import { useEffect } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ReferralItem {
  id: string;
  userName: string;
  rewardType: string;
  rewardKind: string;
  energyAmount: number;
  subscriptionDays: number | null;
  createdAt: Date;
}

interface ReferralCodeResponse {
  ok: boolean;
  data: {
    referralCode: string;
    referrals: ReferralItem[];
    pendingChoices: ReferralItem[];
    totalRewards: number;
    totalReferrals: number;
  };
}

export default function Referral() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const { tier } = useEnergy();
  
  // Tier-based rewards info
  // Rewards are triggered when invited friend PAYS for subscription
  const getRewardInfo = () => {
    switch (tier) {
      case 'premium':
        return {
          referrerReward: locale === 'ru' ? '+20 звёзд + продление подписки' : '+20 stars + subscription extension',
          referredReward: '',
          icon: Crown,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
        };
      case 'standard':
        return {
          referrerReward: locale === 'ru' ? '+10 звёзд + продление подписки' : '+10 stars + subscription extension',
          referredReward: '',
          icon: OrbIcon,
          color: 'text-primary',
          bgColor: 'bg-primary/10',
        };
      default: // free
        return {
          referrerReward: locale === 'ru' ? '7 дней Standard или 3 дня Premium' : '7 days Standard or 3 days Premium',
          referredReward: '',
          icon: Calendar,
          color: 'text-chart-3',
          bgColor: 'bg-chart-3/10',
        };
    }
  };
  
  const rewardInfo = getRewardInfo();

  const { data, isLoading } = useQuery<ReferralCodeResponse>({
    queryKey: ['/api/referral/code'],
  });

  // Mark referrals as viewed when page loads
  useEffect(() => {
    if (data?.ok) {
      localStorage.setItem('lastViewedReferrals', new Date().toISOString());
    }
  }, [data]);

  const referralLink = data?.ok && data.data?.referralCode 
    ? `https://t.me/${import.meta.env.VITE_BOT_USERNAME}?startapp=${data.data.referralCode}`
    : '';

  const handleCopy = async () => {
    if (referralLink) {
      await navigator.clipboard.writeText(referralLink);
      hapticFeedback('success');
      toast({
        title: t.referral.copied,
        description: locale === 'ru' ? 'Реферальная ссылка скопирована' : 'Referral link copied to clipboard',
      });
    }
  };

  const handleShare = () => {
    if (referralLink) {
      const text = locale === 'ru' 
        ? `Присоединяйся ко мне в Astro Orb для астрологических прогнозов с ИИ! ${referralLink}`
        : `Join me on Astro Orb for AI-powered astrology readings! ${referralLink}`;
      if (navigator.share) {
        navigator.share({
          title: 'Astro Orb',
          text: text,
          url: referralLink,
        });
      } else {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`);
      }
      hapticFeedback('medium');
    }
  };

  // Dev-only mutation: simulate a referred friend PAYING for a subscription.
  // For free referrers this creates a pending choice (Standard 7d OR Premium 3d).
  const devSimulateReferralMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/dev/test-referral', { action: 'simulate_subscription' });
    },
    onSuccess: (res: any) => {
      hapticFeedback('success');
      const requiresChoice = res?.data?.requiresChoice;
      toast({
        title: locale === 'ru' ? 'Успех!' : 'Success!',
        description: requiresChoice
          ? (locale === 'ru'
            ? 'Реферал оплатил подписку! Выберите награду ниже.'
            : 'Referral paid for subscription! Choose your reward below.')
          : (locale === 'ru'
            ? 'Реферал оплатил подписку! Награда начислена.'
            : 'Referral paid for subscription! Reward applied.'),
      });
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/referral/code'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/energy'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
    },
    onError: () => {
      hapticFeedback('error');
      toast({
        title: locale === 'ru' ? 'Ошибка' : 'Error',
        description: locale === 'ru' 
          ? 'Не удалось симулировать оплату подписки рефералом'
          : 'Failed to simulate referral subscription',
        variant: 'destructive',
      });
    },
  });

  // Claim a pending choice reward: 'standard' (7 days) or 'premium' (3 days)
  const claimChoiceMutation = useMutation({
    mutationFn: async ({ rewardId, choice }: { rewardId: string; choice: 'standard' | 'premium' }) => {
      return await apiRequest('POST', '/api/referral/claim-choice', { rewardId, choice });
    },
    onSuccess: (res: any) => {
      hapticFeedback('success');
      const tier = res?.data?.tier;
      const days = res?.data?.days;
      const tierLabel = tier === 'premium' ? 'Premium' : 'Standard';
      toast({
        title: locale === 'ru' ? 'Награда получена!' : 'Reward claimed!',
        description: locale === 'ru'
          ? `Вам начислено ${days} дн. подписки ${tierLabel}`
          : `${days} days of ${tierLabel} subscription added`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/referral/code'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/energy'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
    },
    onError: () => {
      hapticFeedback('error');
      toast({
        title: locale === 'ru' ? 'Ошибка' : 'Error',
        description: locale === 'ru'
          ? 'Не удалось получить награду'
          : 'Failed to claim reward',
        variant: 'destructive',
      });
    },
  });

  const pendingChoices = data?.data?.pendingChoices || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

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
            <h1 className="text-2xl font-display font-bold">{t.referral.title}</h1>
            <p className="text-muted-foreground">{t.referral.subtitle}</p>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
              <FeatureVignette kind="guest" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t.referral.step1}</h2>
            <p className="text-muted-foreground">
              {t.referral.step1Desc}
            </p>
          </div>

          <Card className={`p-4 ${rewardInfo.bgColor} border-primary/20 mb-4`}>
            <div className="flex items-center gap-3">
              <rewardInfo.icon className={`w-8 h-8 ${rewardInfo.color}`} />
              <div>
                <p className="text-xl font-bold">{rewardInfo.referrerReward}</p>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' 
                    ? 'Когда приглашённый друг оплачивает подписку' 
                    : 'When invited friend pays for subscription'}
                </p>
              </div>
            </div>
          </Card>
          
          {tier === 'free' && (
            <div className="mb-4 p-3 rounded-lg bg-muted text-sm text-muted-foreground text-center">
              {locale === 'ru' 
                ? 'Пригласи друга и получи дни подписки, когда он оплатит!'
                : 'Invite a friend and get subscription days when they pay!'}
            </div>
          )}

          {referralLink && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm font-mono break-all">{referralLink}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="button-copy-link"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t.referral.copy}
                </Button>
                <Button
                  onClick={handleShare}
                  data-testid="button-share-link"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {locale === 'ru' ? 'Поделиться' : 'Share'}
                </Button>
              </div>
              {import.meta.env.DEV && (
                <Button
                  className="w-full mt-2"
                  variant="secondary"
                  size="sm"
                  onClick={() => devSimulateReferralMutation.mutate()}
                  disabled={devSimulateReferralMutation.isPending}
                  data-testid="button-dev-simulate-referral"
                >
                  {devSimulateReferralMutation.isPending ? (
                    <>
                      <Loader size="sm" />
                      {locale === 'ru' ? 'Симуляция...' : 'Simulating...'}
                    </>
                  ) : (
                    <>
                      {locale === 'ru' ? 'Dev: Симулировать реферала' : 'Dev: Simulate Referral'}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </Card>

        {pendingChoices.length > 0 && (
          <Card className="p-6 mb-6 border-primary/40 bg-primary/5">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-7 h-7 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">
                  {locale === 'ru' ? 'Награда за реферала!' : 'Referral reward!'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru'
                    ? 'Ваш друг оформил подписку. Выберите награду:'
                    : 'Your friend subscribed. Choose your reward:'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {pendingChoices.map((choice) => (
                <div
                  key={choice.id}
                  className="space-y-3"
                  data-testid={`pending-choice-${choice.id}`}
                >
                  <p className="text-sm font-medium">{choice.userName}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex-col items-start gap-1"
                      onClick={() => claimChoiceMutation.mutate({ rewardId: choice.id, choice: 'standard' })}
                      disabled={claimChoiceMutation.isPending}
                      data-testid={`button-claim-standard-${choice.id}`}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <OrbIcon className="w-4 h-4 text-primary" />
                        {locale === 'ru' ? '7 дней Standard' : '7 days Standard'}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {locale === 'ru' ? 'Все функции, кроме Solar Return' : 'All features except Solar Return'}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex-col items-start gap-1"
                      onClick={() => claimChoiceMutation.mutate({ rewardId: choice.id, choice: 'premium' })}
                      disabled={claimChoiceMutation.isPending}
                      data-testid={`button-claim-premium-${choice.id}`}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        {locale === 'ru' ? '3 дня Premium' : '3 days Premium'}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {locale === 'ru' ? 'Все функции, включая Solar Return' : 'All features including Solar Return'}
                      </span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data?.data?.referrals && data.data.referrals.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{t.referral.yourReferrals}</h2>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{locale === 'ru' ? 'Всего рефералов' : 'Total Referrals'}</p>
                <p className="text-2xl font-bold text-primary">{data.data.totalReferrals}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-chart-2/10 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{locale === 'ru' ? 'Всего получено наград' : 'Total Rewards Earned'}</p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    +{data.data.totalRewards} {t.common.orbs}
                  </p>
                </div>
                <Gift className="w-12 h-12 text-primary/50" />
              </div>
            </div>

            <div className="space-y-2">
              {data.data.referrals.map((referral) => {
                const isPending = referral.rewardKind === 'pending_choice';
                const isSubscriptionDays =
                  referral.rewardKind === 'subscription_standard_days' ||
                  referral.rewardKind === 'subscription_premium_days';
                const tierLabel = referral.rewardKind === 'subscription_premium_days' ? 'Premium' : 'Standard';

                let rewardBadge: string;
                if (isPending) {
                  rewardBadge = locale === 'ru' ? 'Ожидает выбора' : 'Choice pending';
                } else if (isSubscriptionDays && referral.subscriptionDays) {
                  rewardBadge = locale === 'ru'
                    ? `+${referral.subscriptionDays} дн. ${tierLabel}`
                    : `+${referral.subscriptionDays}d ${tierLabel}`;
                } else {
                  rewardBadge = `+${referral.energyAmount} ${t.common.orbs}`;
                }

                return (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted"
                    data-testid={`referral-item-${referral.id}`}
                  >
                    <div>
                      <p className="font-medium">{referral.userName}</p>
                      <p className="text-sm text-muted-foreground">
                        {referral.rewardType === 'signup'
                          ? (locale === 'ru' ? 'Регистрация' : 'Joined')
                          : (locale === 'ru' ? 'Оформил подписку' : 'Subscribed')
                        } · {new Date(referral.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={isPending ? 'outline' : (referral.rewardType === 'subscription' ? 'default' : 'secondary')}>
                      {rewardBadge}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
