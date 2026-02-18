import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LocaleContext';
import { Loader } from '@/components/Loader';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const paymentId = params.get('paymentId');
  const paymentType = params.get('type') || 'yookassa'; // 'ton' or 'yookassa'
  
  const [status, setStatus] = useState<'checking' | 'success' | 'processing' | 'abandoned' | 'failed'>('checking');
  const [message, setMessage] = useState('');
  const [energyAmount, setEnergyAmount] = useState(0);
  const [pollingAttempt, setPollingAttempt] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      setStatus('failed');
      setMessage(locale === 'ru' ? 'Платёж не найден' : 'Payment not found');
      return;
    }

    if (paymentType === 'ton') {
      startTonPolling();
    } else {
      checkYooKassaPayment();
    }
  }, [paymentId]);

  // Auto-redirect after payment check
  useEffect(() => {
    if (status === 'success') {
      // Redirect to dashboard after successful payment (2 seconds to show success message)
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    } else if (status === 'failed' || status === 'abandoned') {
      // Redirect to buy-energy page after failed/abandoned payment (5 seconds to show message)
      const timer = setTimeout(() => {
        navigate('/buy-energy');
      }, 5000);
      return () => clearTimeout(timer);
    }
    // Note: 'processing' status does NOT redirect - user can check again
  }, [status, navigate]);

  const checkYooKassaPayment = async () => {
    try {
      const response = await apiRequest('POST', '/api/payments/yookassa/check-status', {
        paymentId,
      });

      if (response.ok && response.data) {
        const { status: paymentStatus, energyAmount: amount } = response.data;
        
        if (paymentStatus === 'succeeded') {
          setStatus('success');
          setEnergyAmount(amount || 0);
          setMessage(locale === 'ru' 
            ? `Платёж успешно обработан! Начислено ${amount} звёзд.`
            : `Payment successful! Credited ${amount} stars.`
          );
        } else if (paymentStatus === 'processing') {
          setStatus('processing');
          setMessage(locale === 'ru'
            ? 'Платёж обрабатывается банком. Нажмите "Проверить снова" через несколько секунд.'
            : 'Payment is being processed by bank. Click "Check Again" in a few seconds.'
          );
        } else if (paymentStatus === 'abandoned') {
          setStatus('abandoned');
          setMessage(locale === 'ru'
            ? 'Платёж не был завершён. Возвращаемся на страницу покупки...'
            : 'Payment was not completed. Returning to purchase page...'
          );
        } else {
          setStatus('failed');
          setMessage(locale === 'ru'
            ? 'Платёж не был завершён.'
            : 'Payment was not completed.'
          );
        }
      } else {
        setStatus('failed');
        setMessage(response.error || (locale === 'ru' ? 'Ошибка проверки платежа' : 'Failed to check payment'));
      }
    } catch (error: any) {
      console.error('Payment check error:', error);
      setStatus('failed');
      setMessage(locale === 'ru' ? 'Ошибка проверки платежа' : 'Failed to check payment');
    }
  };

  const checkTonPayment = async () => {
    try {
      console.log(`[TON] Checking blockchain for payment ${paymentId}...`);
      
      const response = await apiRequest('POST', '/api/payments/ton/confirm', {
        paymentId,
      });

      if (response.ok && response.data) {
        const { status: paymentStatus, energyAmount: amount } = response.data;
        
        if (paymentStatus === 'succeeded') {
          console.log('[TON] ✅ Transaction found and confirmed!');
          queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
          setStatus('success');
          setEnergyAmount(amount || 0);
          setMessage(locale === 'ru' 
            ? `Транзакция найдена! Начислено ${amount} звёзд.`
            : `Transaction found! Credited ${amount} stars.`
          );
          return true;
        } else if (paymentStatus === 'processing') {
          console.log('[TON] Transaction still processing...');
          return false; // Continue polling
        } else {
          console.log('[TON] Transaction failed or unknown status:', paymentStatus);
          return false;
        }
      }

      console.log('[TON] Invalid response from server');
      return false;
    } catch (error: any) {
      console.error('[TON] Check error:', error);
      return false;
    }
  };

  const startTonPolling = async () => {
    setStatus('processing');
    setMessage(locale === 'ru' 
      ? 'Ищем вашу транзакцию на блокчейне. Это может занять до минуты...'
      : 'Searching for your transaction on blockchain. This may take up to a minute...'
    );

    const maxRetries = 15; // 15 attempts = 45 seconds of searching
    const retryDelay = 3000; // 3 seconds between attempts

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      setPollingAttempt(attempt);
      console.log(`[TON] Polling attempt ${attempt}/${maxRetries}...`);

      const found = await checkTonPayment();
      if (found) {
        return;
      }

      // Update message every 5 attempts
      if (attempt === 5 || attempt === 10) {
        setMessage(locale === 'ru'
          ? `Проверка ${attempt}/${maxRetries}. Транзакции на блокчейне могут занять время...`
          : `Check ${attempt}/${maxRetries}. Blockchain transactions can take time...`
        );
      }

      // If not last attempt, wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // All retries failed
    setStatus('failed');
    setMessage(locale === 'ru' 
      ? 'Транзакция не найдена на блокчейне. Проверьте баланс через несколько минут или нажмите "Проверить снова".'
      : 'Transaction not found on blockchain. Check your balance in a few minutes or click "Check Again".'
    );
  };

  const getIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'processing':
        return <AlertCircle className="w-16 h-16 text-yellow-500" />;
      case 'abandoned':
        return <XCircle className="w-16 h-16 text-orange-500" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500" />;
      default:
        return <Loader size="lg" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'success':
        return locale === 'ru' ? 'Оплата успешна!' : 'Payment Successful!';
      case 'processing':
        return locale === 'ru' ? 'Платёж обрабатывается' : 'Payment Processing';
      case 'abandoned':
        return locale === 'ru' ? 'Платёж не завершён' : 'Payment Not Completed';
      case 'failed':
        return locale === 'ru' ? 'Платёж не удался' : 'Payment Failed';
      default:
        return locale === 'ru' ? 'Проверяем платёж...' : 'Checking payment...';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      {/* Full Palette Gradient Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-palette opacity-20" />
      </div>
      
      <div className="container max-w-md mx-auto">
        <Card className="p-8" data-testid="card-payment-result">
          <div className="flex flex-col items-center text-center space-y-6">
            {getIcon()}
            
            <h1 className="text-2xl font-display font-bold" data-testid="text-payment-title">
              {getTitle()}
            </h1>
            
            {message && (
              <p className="text-muted-foreground" data-testid="text-payment-message">
                {message}
              </p>
            )}

            {status === 'processing' && paymentType === 'ton' && pollingAttempt > 0 && (
              <p className="text-sm text-muted-foreground">
                {locale === 'ru' ? 'Попытка' : 'Attempt'} {pollingAttempt}/15
              </p>
            )}

            {status === 'success' && energyAmount > 0 && (
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' ? 'Зачислено энергии' : 'Energy Credited'}
                </p>
                <p className="text-3xl font-bold text-green-500">
                  +{energyAmount}
                </p>
              </div>
            )}

            <div className="flex gap-3 w-full pt-4">
              {(status === 'processing' || status === 'failed') && (
                <Button
                  variant="outline"
                  onClick={() => paymentType === 'ton' ? startTonPolling() : checkYooKassaPayment()}
                  className="flex-1"
                  data-testid="button-retry-check"
                >
                  {locale === 'ru' ? 'Проверить снова' : 'Check Again'}
                </Button>
              )}
              
              <Button
                onClick={() => navigate('/dashboard')}
                className="flex-1"
                data-testid="button-go-dashboard"
              >
                {locale === 'ru' ? 'На главную' : 'Go to Dashboard'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
