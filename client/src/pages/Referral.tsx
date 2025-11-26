import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Users, Copy, Share2, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/store/useAuth';
import { hapticFeedback } from '@/lib/telegram';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEffect } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ReferralCodeResponse {
  ok: boolean;
  data: {
    referralCode: string;
    referrals: Array<{
      id: string;
      userName: string;
      rewardType: string;
      energyAmount: number;
      createdAt: Date;
    }>;
    totalRewards: number;
    totalReferrals: number;
  };
}

export default function Referral() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, locale } = useTranslation();

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

  // Dev-only mutation for simulating a referral signup without a real user
  const devSimulateReferralMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/dev/test-referral', { action: 'simulate_signup' });
    },
    onSuccess: () => {
      hapticFeedback('success');
      toast({
        title: locale === 'ru' ? 'Успех!' : 'Success!',
        description: locale === 'ru' 
          ? 'Реферальная регистрация симулирована. +10 энергии начислено!'
          : 'Referral signup simulated. +10 energy credited!',
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
          ? 'Не удалось симулировать реферальную регистрацию'
          : 'Failed to simulate referral signup',
        variant: 'destructive',
      });
    },
  });

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
              <Users className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t.referral.step1}</h2>
            <p className="text-muted-foreground">
              {t.referral.step1Desc}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card className="p-4 bg-chart-3/10 border-chart-3/20">
              <div className="flex items-center gap-3">
                <Gift className="w-8 h-8 text-chart-3" />
                <div>
                  <p className="text-2xl font-bold">+10</p>
                  <p className="text-sm text-muted-foreground">{locale === 'ru' ? 'Вам за приглашение' : 'For you per invite'}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-chart-4/10 border-chart-4/20">
              <div className="flex items-center gap-3">
                <Gift className="w-8 h-8 text-chart-4" />
                <div>
                  <p className="text-2xl font-bold">+5</p>
                  <p className="text-sm text-muted-foreground">{locale === 'ru' ? 'Другу при регистрации' : 'Friend on signup'}</p>
                </div>
              </div>
            </Card>
          </div>

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
              {data.data.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
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
                  <Badge variant={referral.rewardType === 'subscription' ? 'default' : 'secondary'}>
                    +{referral.energyAmount} {t.common.orbs}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
