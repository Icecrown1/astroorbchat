import { useEffect, useState, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LocaleContext';
import { Loader } from '@/components/Loader';
import { CheckCircle, XCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

const SUPPORT_USERNAME =
  (import.meta.env.VITE_SUPPORT_USERNAME || import.meta.env.VITE_BOT_USERNAME || 'AstroOrbBot').replace('@', '');

const AUTO_RETRY_MAX = 10;
const AUTO_RETRY_INTERVAL_MS = 5000;

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const paymentId = params.get('paymentId');
  const paymentType = params.get('type') || 'yookassa';

  const [status, setStatus] = useState<'checking' | 'success' | 'processing' | 'abandoned' | 'failed'>('checking');
  const [message, setMessage] = useState('');
  const [energyAmount, setEnergyAmount] = useState(0);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRetryCountRef = useRef(0);

  const clearTimers = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    retryTimerRef.current = null;
    countdownTimerRef.current = null;
  };

  useEffect(() => {
    if (!paymentId) {
      setStatus('failed');
      setMessage(locale === 'ru' ? 'Платёж не найден' : 'Payment not found');
      return;
    }
    if (paymentType === 'ton') {
      startTonPolling();
    } else {
      checkYooKassaPayment(0);
    }
    return () => clearTimers();
  }, [paymentId]);

  useEffect(() => {
    if (status === 'success') {
      clearTimers();
      const timer = setTimeout(() => navigate('/dashboard'), 2000);
      return () => clearTimeout(timer);
    } else if (status === 'failed' || status === 'abandoned') {
      clearTimers();
      const timer = setTimeout(() => navigate('/buy-energy'), 5000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const scheduleAutoRetry = (attempt: number) => {
    clearTimers();
    let secs = Math.round(AUTO_RETRY_INTERVAL_MS / 1000);
    setCountdown(secs);

    countdownTimerRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0 && countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1000);

    retryTimerRef.current = setTimeout(() => {
      checkYooKassaPayment(attempt);
    }, AUTO_RETRY_INTERVAL_MS);
  };

  const checkYooKassaPayment = async (attempt: number) => {
    try {
      const response = await apiRequest('POST', '/api/payments/yookassa/check-status', { paymentId });

      if (response.ok && response.data) {
        const { status: paymentStatus, energyAmount: amount } = response.data;

        if (paymentStatus === 'succeeded') {
          clearTimers();
          queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
          setStatus('success');
          setEnergyAmount(amount || 0);
          setMessage(
            locale === 'ru'
              ? `Платёж успешно обработан! Начислено ${amount} звёзд.`
              : `Payment successful! Credited ${amount} stars.`
          );
        } else if (paymentStatus === 'processing') {
          const nextAttempt = attempt + 1;
          autoRetryCountRef.current = nextAttempt;
          setAutoRetryCount(nextAttempt);
          setStatus('processing');

          if (nextAttempt < AUTO_RETRY_MAX) {
            setMessage(
              locale === 'ru'
                ? `Банк обрабатывает платёж. Проверяем автоматически (${nextAttempt}/${AUTO_RETRY_MAX})...`
                : `Bank is processing payment. Checking automatically (${nextAttempt}/${AUTO_RETRY_MAX})...`
            );
            scheduleAutoRetry(nextAttempt);
          } else {
            clearTimers();
            setStatus('failed');
            setMessage(
              locale === 'ru'
                ? 'Банк долго не подтверждает платёж. Деньги не потеряны — обычно они зачисляются в течение часа. Если подписка не активируется, напишите в поддержку.'
                : 'The bank is taking too long to confirm. Your money is safe — it usually posts within an hour. If your subscription is not activated, please contact support.'
            );
          }
        } else if (paymentStatus === 'abandoned') {
          clearTimers();
          setStatus('abandoned');
          setMessage(
            locale === 'ru'
              ? 'Платёж не был завершён. Возвращаемся на страницу покупки...'
              : 'Payment was not completed. Returning to purchase page...'
          );
        } else {
          clearTimers();
          setStatus('failed');
          setMessage(locale === 'ru' ? 'Платёж не был завершён.' : 'Payment was not completed.');
        }
      } else {
        clearTimers();
        setStatus('failed');
        setMessage(response.error || (locale === 'ru' ? 'Ошибка проверки платежа' : 'Failed to check payment'));
      }
    } catch (error: any) {
      console.error('Payment check error:', error);
      clearTimers();
      setStatus('failed');
      setMessage(locale === 'ru' ? 'Ошибка проверки платежа' : 'Failed to check payment');
    }
  };

  const handleManualRetry = () => {
    clearTimers();
    autoRetryCountRef.current = 0;
    setAutoRetryCount(0);
    setCountdown(0);
    setStatus('checking');
    if (paymentType === 'ton') {
      startTonPolling();
    } else {
      checkYooKassaPayment(0);
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
        return locale === 'ru' ? 'Платёж не подтверждён' : 'Payment Not Confirmed';
      default:
        return locale === 'ru' ? 'Проверяем платёж...' : 'Checking payment...';
    }
  };

  const supportUrl = `https://t.me/${SUPPORT_USERNAME}`;
  const showSupportButton = status === 'processing' || status === 'failed';

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
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

            {status === 'processing' && paymentType === 'yookassa' && autoRetryCount > 0 && countdown > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-retry-countdown">
                {locale === 'ru'
                  ? `Следующая проверка через ${countdown} сек...`
                  : `Next check in ${countdown}s...`}
              </p>
            )}

            {status === 'processing' && paymentType === 'ton' && pollingAttempt > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-ton-attempt">
                {locale === 'ru' ? 'Попытка' : 'Attempt'} {pollingAttempt}/15
              </p>
            )}

            {status === 'success' && energyAmount > 0 && (
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground">
                  {locale === 'ru' ? 'Зачислено энергии' : 'Energy Credited'}
                </p>
                <p className="text-3xl font-bold text-green-500">+{energyAmount}</p>
              </div>
            )}

            <div className="flex gap-3 w-full pt-4">
              {(status === 'processing' || status === 'failed') && (
                <Button
                  variant="outline"
                  onClick={handleManualRetry}
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

            {showSupportButton && (
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
                data-testid="link-support"
              >
                <Button variant="ghost" className="w-full gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {locale === 'ru' ? 'Связаться с поддержкой' : 'Contact Support'}
                </Button>
              </a>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
