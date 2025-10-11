import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, CreditCard, Check, Sparkles } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { sendTransaction } from '@/lib/ton';

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
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

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
      if (!response.ok) throw new Error(response.error || 'Failed to create payment');
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
          title: 'Subscription Activated',
          description: `Welcome to ${tier.name}! Enjoy ${tier.dailyEnergy} orbs daily.`,
        });
        navigate('/dashboard');
      } catch (error: any) {
        toast({
          title: 'Transaction Failed',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Please try again',
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
            <h1 className="text-2xl font-display font-bold">Subscription</h1>
            <p className="text-muted-foreground">Unlock unlimited cosmic power</p>
          </div>
        </div>

        {currentSubscription?.status === 'active' && (
          <Card className="p-4 mb-6 bg-chart-3/10 border-chart-3/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Plan: {currentSubscription.tier}</p>
                <p className="text-sm text-muted-foreground">
                  Active until {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <Badge className="bg-chart-3">Active</Badge>
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
                    Most Popular
                  </Badge>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-display font-bold mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ≈ {getTonPrice(tier.price)} TON/month
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-chart-3/20 to-chart-2/20">
                    <Sparkles className="w-5 h-5 text-chart-3" />
                    <span className="font-bold">{tier.dailyEnergy} orbs daily</span>
                  </div>
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-chart-3 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  variant={selectedTier === tier.tier ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    mutation.mutate(tier);
                  }}
                  disabled={mutation.isPending || currentSubscription?.tier === tier.tier}
                  data-testid={`button-subscribe-${tier.tier}`}
                >
                  {mutation.isPending && selectedTier === tier.tier ? (
                    <>
                      <Loader className="mr-2" size="sm" />
                      Processing...
                    </>
                  ) : currentSubscription?.tier === tier.tier ? (
                    'Current Plan'
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Subscribe
                    </>
                  )}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            Subscriptions are billed monthly via TON blockchain. Cancel anytime. Energy resets daily at midnight.
          </p>
        </Card>
      </div>
    </div>
  );
}
