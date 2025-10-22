import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LocaleContext';
import { Loader } from '@/components/Loader';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const paymentId = params.get('paymentId');
  
  const [status, setStatus] = useState<'checking' | 'success' | 'processing' | 'abandoned' | 'failed'>('checking');
  const [message, setMessage] = useState('');
  const [energyAmount, setEnergyAmount] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      setStatus('failed');
      setMessage(locale === 'ru' ? 'Платёж не найден' : 'Payment not found');
      return;
    }

    checkPaymentStatus();
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

  const checkPaymentStatus = async () => {
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
            ? `Платёж успешно обработан! Начислено ${amount} орбов энергии.`
            : `Payment successful! Credited ${amount} energy orbs.`
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
              {status === 'processing' && (
                <Button
                  variant="outline"
                  onClick={checkPaymentStatus}
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
