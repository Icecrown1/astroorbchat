import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/Loader';
import { ArrowLeft, ShoppingBag, Sparkles, Check, Wallet } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useTranslation } from '@/contexts/LocaleContext';
import WebApp from '@twa-dev/sdk';

const ENERGY_PACKS = [
  { amount: 20, usdPrice: 2.99, starsPrice: 190, popular: false },
  { amount: 50, usdPrice: 5.99, starsPrice: 375, popular: true },
  { amount: 120, usdPrice: 11.99, starsPrice: 750, popular: false },
];

export default function BuyEnergy() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const walletConnected = !!wallet;
  const [pendingTonPurchase, setPendingTonPurchase] = useState<typeof ENERGY_PACKS[0] | null>(null);


  // Trigger TON purchase after wallet connects
  useEffect(() => {
    if (walletConnected && pendingTonPurchase) {
      console.log('Wallet connected, processing pending TON purchase...');
      tonMutation.mutate(pendingTonPurchase);
      setPendingTonPurchase(null);
    }
  }, [walletConnected, pendingTonPurchase]);

  const { data: pricesData, isLoading: pricesLoading } = useQuery({
    queryKey: ['/api/payments/price'],
  });

  const tonMutation = useMutation({
    mutationFn: async (pack: typeof ENERGY_PACKS[0]) => {
      console.log('[TON_FRONTEND] Starting mutation for pack:', pack);
      console.log('[TON_FRONTEND] Wallet state:', wallet);
      
      // Get user's wallet address for tracking
      const userWalletAddress = wallet?.account?.address || null;
      
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

        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes max per TON Connect spec
          messages: [
            {
              address: data.walletAddress,
              amount: data.amountTON,
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
            ? 'Подпишите транзакцию в кошельке, затем подождите проверки'
            : 'Sign the transaction in your wallet, then wait for verification',
        });

        // Wait for user to sign in wallet (realistic time: 10-15 seconds)
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 seconds

        // Show that we're starting to check
        toast({
          title: locale === 'ru' ? 'Проверяем блокчейн...' : 'Checking blockchain...',
          description: locale === 'ru' 
            ? 'Ищем вашу транзакцию, это может занять до минуты'
            : 'Searching for your transaction, this may take up to a minute',
        });

        // Start polling blockchain for transaction
        const maxRetries = 15; // 15 attempts = 45 seconds of searching
        const retryDelay = 3000; // 3 seconds between attempts
        let lastError = '';

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`[TON] Blockchain check ${attempt}/${maxRetries}...`);
          
          const confirmResponse = await apiRequest('POST', '/api/payments/ton/confirm', {
            paymentId: data.paymentId,
          });

          if (confirmResponse.ok) {
            console.log('[TON] ✅ Transaction found and confirmed!');
            queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
            toast({
              title: t.common.success,
              description: `${pack.amount} ${t.common.orbs} ${t.common.energy.toLowerCase()}`,
            });
            navigate('/dashboard');
            return;
          }

          lastError = confirmResponse.error || 'Transaction not found';
          
          // If not found on blockchain, wait and retry
          if (lastError.includes('not found on blockchain') && attempt < maxRetries) {
            // Show progress to user every 5 attempts
            if (attempt === 5 || attempt === 10) {
              toast({
                title: locale === 'ru' ? 'Все еще ищем...' : 'Still searching...',
                description: locale === 'ru' 
                  ? `Проверка ${attempt}/${maxRetries}. Транзакции на блокчейне могут занять время`
                  : `Check ${attempt}/${maxRetries}. Blockchain transactions can take time`,
              });
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          // Other errors - don't retry
          break;
        }

        // All retries failed
        throw new Error(
          locale === 'ru' 
            ? 'Транзакция не найдена на блокчейне. Проверьте баланс через несколько минут или обратитесь в поддержку'
            : 'Transaction not found on blockchain. Check your balance in a few minutes or contact support'
        );
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
            ? `Начислено ${data.creditedEnergy} энергии`
            : `Credited ${data.creditedEnergy} energy`,
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

  const getTonPrice = (usdPrice: number) => {
    const data = pricesData as any;
    if (data?.ok && data.data?.tonRate) {
      return (usdPrice / data.data.tonRate).toFixed(2);
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
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">{t.buyEnergy.title}</h1>
            <p className="text-muted-foreground">{t.buyEnergy.subtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkPendingMutation.mutate()}
            disabled={checkPendingMutation.isPending}
            data-testid="button-check-pending"
          >
            {checkPendingMutation.isPending ? (
              <Loader />
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {locale === 'ru' ? 'Проверить' : 'Check'}
              </>
            )}
          </Button>
        </div>

        {pricesLoading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {ENERGY_PACKS.map((pack, index) => (
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
                    {t.subscribe.mostPopular}
                  </Badge>
                )}

                <div className="text-center mb-4">
                  <div className="inline-flex p-3 rounded-full bg-gradient-to-br from-chart-3/20 to-chart-2/20 mb-3">
                    <Sparkles className="w-8 h-8 text-chart-3" />
                  </div>
                  <h3 className="text-3xl font-bold mb-1">{pack.amount}</h3>
                  <p className="text-sm text-muted-foreground">{t.common.energy} {t.common.orbs}</p>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">${pack.usdPrice}</p>
                    <p className="text-sm text-muted-foreground">
                      ≈ {getTonPrice(pack.usdPrice)} TON
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setSelectedPack(pack.amount);
                      if (!walletConnected) {
                        try {
                          console.log('Opening TON Connect modal for pack:', pack);
                          setPendingTonPurchase(pack);
                          await tonConnectUI.openModal();
                          console.log('TON Connect modal opened, waiting for wallet connection...');
                        } catch (error: any) {
                          console.error('Failed to open wallet modal:', error);
                          setPendingTonPurchase(null);
                          toast({
                            title: locale === 'ru' ? 'Ошибка подключения' : 'Connection Error',
                            description: locale === 'ru'
                              ? 'Не удалось открыть окно подключения кошелька. Попробуйте снова.'
                              : 'Failed to open wallet connection modal. Try again.',
                            variant: 'destructive',
                          });
                        }
                      } else {
                        tonMutation.mutate(pack);
                      }
                    }}
                    disabled={tonMutation.isPending && selectedPack === pack.amount}
                    data-testid={`button-buy-ton-${pack.amount}`}
                  >
                    {tonMutation.isPending && selectedPack === pack.amount ? (
                      <>
                        <Loader className="mr-2" size="sm" />
                        {t.buyEnergy.purchasing}
                      </>
                    ) : !walletConnected ? (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        {locale === 'ru' ? 'Подключить TON' : 'Connect TON'}
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        {locale === 'ru' ? 'Оплатить TON' : 'Pay with TON'}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            {locale === 'ru' ? 
              'Оплата через TON блокчейн. Энергия зачисляется мгновенно после подтверждения.' :
              'Pay with TON blockchain. Energy is added instantly after confirmation.'
            }
          </p>
        </Card>
      </div>
    </div>
  );
}
