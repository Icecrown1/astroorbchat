import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, ShoppingBag, Sparkles, Check } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { sendTransaction } from '@/lib/ton';

const ENERGY_PACKS = [
  { amount: 20, usdPrice: 2.99, popular: false },
  { amount: 50, usdPrice: 5.99, popular: true },
  { amount: 120, usdPrice: 11.99, popular: false },
];

export default function BuyEnergy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPack, setSelectedPack] = useState<number | null>(null);

  const { data: pricesData, isLoading: pricesLoading } = useQuery({
    queryKey: ['/api/payments/price'],
  });

  const mutation = useMutation({
    mutationFn: async (pack: typeof ENERGY_PACKS[0]) => {
      const response = await apiRequest('POST', '/api/payments/ton/create', {
        kind: 'energy_pack',
        energyAmount: pack.amount,
        amountUSD: pack.usdPrice,
      });
      if (!response.ok) throw new Error(response.error || 'Failed to create payment');
      return response.data;
    },
    onSuccess: async (data, pack) => {
      try {
        await sendTransaction(
          data.walletAddress,
          data.amountTON,
          data.payload
        );
        queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
        toast({
          title: 'Purchase Successful',
          description: `${pack.amount} energy orbs added to your account`,
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
        title: 'Payment Failed',
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
            <h1 className="text-2xl font-display font-bold">Buy Energy</h1>
            <p className="text-muted-foreground">Recharge your cosmic power</p>
          </div>
        </div>

        {pricesLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {ENERGY_PACKS.map((pack) => (
              <Card
                key={pack.amount}
                className={`p-6 cursor-pointer transition-all hover-elevate ${
                  selectedPack === pack.amount ? 'ring-2 ring-primary' : ''
                } ${pack.popular ? 'relative' : ''}`}
                onClick={() => setSelectedPack(pack.amount)}
                data-testid={`card-energy-pack-${pack.amount}`}
              >
                {pack.popular && (
                  <Badge className="absolute -top-2 -right-2 bg-chart-4">
                    Best Value
                  </Badge>
                )}

                <div className="text-center mb-4">
                  <div className="inline-flex p-3 rounded-full bg-gradient-to-br from-chart-3/20 to-chart-2/20 mb-3">
                    <Sparkles className="w-8 h-8 text-chart-3" />
                  </div>
                  <h3 className="text-3xl font-bold mb-1">{pack.amount}</h3>
                  <p className="text-sm text-muted-foreground">Energy Orbs</p>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">${pack.usdPrice}</p>
                    <p className="text-sm text-muted-foreground">
                      ≈ {getTonPrice(pack.usdPrice)} TON
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant={selectedPack === pack.amount ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    mutation.mutate(pack);
                  }}
                  disabled={mutation.isPending}
                  data-testid={`button-buy-pack-${pack.amount}`}
                >
                  {mutation.isPending && selectedPack === pack.amount ? (
                    <>
                      <Loader className="mr-2" size="sm" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {selectedPack === pack.amount && <Check className="w-4 h-4 mr-2" />}
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Buy Now
                    </>
                  )}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            Payments are processed securely via TON blockchain. Your energy will be added instantly after confirmation.
          </p>
        </Card>
      </div>
    </div>
  );
}
