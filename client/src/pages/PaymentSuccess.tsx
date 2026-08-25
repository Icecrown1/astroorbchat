import { useEffect, useState, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LocaleContext';
import { Loader } from '@/components/Loader';
import { OrbIcon } from '@/components/OrbIcon';
import { XCircle, AlertCircle, MessageCircle, Crown, X } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { haptic } from '@/lib/haptics';

const SUPPORT_USERNAME =
  (import.meta.env.VITE_SUPPORT_USERNAME || import.meta.env.VITE_BOT_USERNAME || 'AstroOrbBot').replace('@', '');

const AUTO_RETRY_MAX = 10;
const AUTO_RETRY_INTERVAL_MS = 5000;

type Status = 'checking' | 'success' | 'processing' | 'abandoned' | 'failed';

interface SuccessInfo {
  kind: string;
  tier?: string | null;
  orbs?: number | null;
}

const MONTHLY_ORBS: Record<string, number> = { standard: 250, premium: 550 };

function normalizeTier(t?: string | null): 'standard' | 'premium' | null {
  if (!t) return null;
  return t === 'premium' || t === 'pro' ? 'premium' : 'standard';
}

/** Искры по кругу — вспышка при успехе */
function Sparks({ gold }: { gold: boolean }) {
  const sparks = Array.from({ length: 10 }, (_, i) => ({
    a: `${i * 36 + (i % 2 ? 14 : 0)}deg`,
    d: `${54 + (i % 3) * 16}px`,
    dl: `${0.25 + (i % 4) * 0.06}s`,
  }));
  return (
    <>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="ps-spark"
          style={{ ['--a' as any]: s.a, ['--d' as any]: s.d, ['--dl' as any]: s.dl }}
          aria-hidden="true"
        >
          <OrbIcon className={`w-2 h-2 ${gold ? 'text-[hsl(var(--solar-gold))]' : 'text-primary'}`} />
        </span>
      ))}
    </>
  );
}

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const { locale } = useTranslation();
  const ru = locale === 'ru';
  const search = useSearch();
  const params = new URLSearchParams(search);
  const paymentId = params.get('paymentId');
  const paymentType = params.get('type') || 'yookassa';

  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<SuccessInfo | null>(null);
  const [kindHint, setKindHint] = useState<string | null>(null);
  const retryPath = () => (kindHint && kindHint.startsWith('subscription') ? '/subscribe' : '/buy-energy');
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebratedRef = useRef(false);

  // Свежие данные пользователя после активации — дата окончания подписки и баланс
  const { data: me } = useQuery<any>({
    queryKey: ['/api/user/me'],
    enabled: status === 'success',
  });
  const subscription = me?.data?.subscription;
  const balance: number | undefined = me?.data?.orbs;

  const clearTimers = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    retryTimerRef.current = null;
    countdownTimerRef.current = null;
  };

  const refreshEverything = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
    queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/energy'] });
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/upgrade-preview'] });
  };

  const succeed = (data: any) => {
    clearTimers();
    refreshEverything();
    setInfo({
      kind: data?.kind || (data?.tier ? 'subscription' : 'energy_pack'),
      tier: data?.tier,
      orbs: data?.energyAmount,
    });
    setStatus('success');
    setMessage('');
    if (!celebratedRef.current) {
      celebratedRef.current = true;
      haptic.notify('success');
    }
  };

  useEffect(() => {
    // Telegram Stars: оплата подтверждена самим Telegram, зачисление — вебхуком в течение секунд
    if (paymentType === 'stars') {
      if (params.get('kind') === 'subscription') {
        succeed({ kind: 'subscription', tier: params.get('tier') || 'standard' });
      } else {
        const orbs = Number(params.get('orbs')) || null;
        succeed({ kind: 'energy_pack', energyAmount: orbs });
      }
      const t1 = setTimeout(refreshEverything, 1500);
      const t2 = setTimeout(refreshEverything, 4000);
      const t3 = setTimeout(refreshEverything, 8000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    if (!paymentId) {
      setStatus('failed');
      setMessage(ru ? 'Платёж не найден' : 'Payment not found');
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
    if (status === 'failed' || status === 'abandoned') {
      clearTimers();
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
    retryTimerRef.current = setTimeout(() => checkYooKassaPayment(attempt), AUTO_RETRY_INTERVAL_MS);
  };

  const checkYooKassaPayment = async (attempt: number) => {
    try {
      const response = await apiRequest('POST', '/api/payments/yookassa/check-status', { paymentId });
      if (response.ok && response.data) {
        const { status: paymentStatus } = response.data;
        if (response.data.kind) setKindHint(response.data.kind);
        if (paymentStatus === 'succeeded') {
          succeed(response.data);
        } else if (paymentStatus === 'processing' || paymentStatus === 'pending') {
          const nextAttempt = attempt + 1;
          setAutoRetryCount(nextAttempt);
          setStatus('processing');
          if (nextAttempt < AUTO_RETRY_MAX) {
            setMessage(ru
              ? `Банк подтверждает платёж. Проверяем автоматически (${nextAttempt}/${AUTO_RETRY_MAX})`
              : `The bank is confirming the payment. Checking automatically (${nextAttempt}/${AUTO_RETRY_MAX})`);
            scheduleAutoRetry(nextAttempt);
          } else {
            clearTimers();
            setStatus('failed');
            setMessage(ru
              ? 'Банк долго не подтверждает платёж. Деньги не потеряны — обычно зачисление занимает до часа. Если подписка не появится, напишите в поддержку.'
              : 'The bank is taking too long to confirm. Your money is safe — it usually posts within an hour. If the subscription does not appear, contact support.');
          }
        } else if (paymentStatus === 'abandoned') {
          clearTimers();
          setStatus('abandoned');
          setMessage(ru ? 'Деньги не списаны. Можно закрыть это окно или выбрать пакет заново.' : 'Nothing was charged. You can close this or choose a pack again.');
        } else {
          clearTimers();
          setStatus('failed');
          setMessage(ru ? 'Банк отклонил платёж. Деньги не списаны.' : 'The bank declined the payment. Nothing was charged.');
        }
      } else {
        clearTimers();
        setStatus('failed');
        setMessage(response.error || (ru ? 'Не удалось проверить платёж' : 'Failed to check payment'));
      }
    } catch (error: any) {
      console.error('Payment check error:', error);
      clearTimers();
      setStatus('failed');
      setMessage(ru ? 'Не удалось проверить платёж' : 'Failed to check payment');
    }
  };

  const handleManualRetry = () => {
    clearTimers();
    setAutoRetryCount(0);
    setCountdown(0);
    setStatus('checking');
    if (paymentType === 'ton') startTonPolling(); else checkYooKassaPayment(0);
  };

  const checkTonPayment = async () => {
    try {
      const response = await apiRequest('POST', '/api/payments/ton/confirm', { paymentId });
      if (response.ok && response.data?.status === 'succeeded') {
        succeed(response.data);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('[TON] Check error:', error);
      return false;
    }
  };

  const startTonPolling = async () => {
    setStatus('processing');
    setMessage(ru ? 'Ищем транзакцию в блокчейне — до минуты' : 'Looking for the transaction on the blockchain — up to a minute');
    const maxRetries = 15;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      setPollingAttempt(attempt);
      if (await checkTonPayment()) return;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 3000));
    }
    setStatus('failed');
    setMessage(ru
      ? 'Транзакция пока не найдена. Проверьте баланс через несколько минут или нажмите «Проверить снова».'
      : 'Transaction not found yet. Check your balance in a few minutes or tap "Check again".');
  };

  // ---------- Успех ----------
  const isSub = info?.kind === 'subscription' || info?.kind === 'subscription_upgrade' || info?.kind === 'subscription_renewal';
  const tier = normalizeTier(info?.tier);
  const gold = tier === 'premium';
  const tierLabel = tier === 'premium' ? 'Premium' : 'Standard';
  const monthlyOrbs = tier ? MONTHLY_ORBS[tier] : undefined;
  const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  // Оплаченный тариф ниже текущего: включится после окончания текущего
  const isScheduled = isSub && !!subscription?.scheduledTier && normalizeTier(subscription.tier) !== tier
    && normalizeTier(subscription.scheduledTier) === tier;
  const fmtDate = (d: Date) => d.toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const renderSuccess = () => (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-7">
        <Sparks gold={gold} />
        <div
          className={`ps-ring relative w-28 h-28 rounded-full flex items-center justify-center border ${
            gold
              ? 'bg-gradient-to-br from-[hsl(41,50%,16%)] to-[hsl(38,40%,10%)] border-[hsl(41,60%,42%)]'
              : 'bg-gradient-to-br from-primary/25 to-primary/5 border-primary/40'
          }`}
          style={{ ['--ps-glow' as any]: gold ? 'rgba(239,194,107,0.35)' : 'rgba(142,123,255,0.4)' }}
        >
          {isSub && gold
            ? <Crown className="w-11 h-11 text-[hsl(var(--solar-gold))]" strokeWidth={1.6} />
            : <OrbIcon className={`w-12 h-12 ${gold ? 'text-[hsl(var(--solar-gold))]' : 'text-primary'}`} />}
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
        {ru ? 'Оплата прошла' : 'Payment complete'}
      </p>

      {isSub ? (
        <>
          <h1 className="ps-count text-3xl font-display font-bold leading-tight" data-testid="text-payment-title">
            {tierLabel} {isScheduled ? (ru ? 'оплачен' : 'is paid') : (ru ? 'активирован' : 'is active')}
          </h1>
          <p className="ps-count text-muted-foreground mt-3" data-testid="text-payment-message">
            {isScheduled && periodEnd
              ? (ru
                ? `Включится ${fmtDate(periodEnd)}, когда закончится текущий тариф`
                : `Starts on ${fmtDate(periodEnd)}, when your current plan ends`)
              : periodEnd
                ? (ru ? `Доступ до ${fmtDate(periodEnd)}` : `Access until ${fmtDate(periodEnd)}`)
                : (ru ? 'Все функции уже открыты' : 'All features are unlocked')}
            {!isScheduled && monthlyOrbs ? ` · ${monthlyOrbs} ${ru ? 'звёзд в месяц' : 'stars per month'}` : ''}
          </p>
        </>
      ) : (
        <>
          <h1 className="ps-count text-3xl font-display font-bold leading-tight flex items-center justify-center gap-2" data-testid="text-payment-title">
            <span>+{info?.orbs ?? ''}</span>
            <OrbIcon className="w-7 h-7 text-[hsl(var(--solar-gold))]" />
          </h1>
          <p className="ps-count text-muted-foreground mt-3" data-testid="text-payment-message">
            {ru ? 'Звёзды на балансе' : 'Stars added to your balance'}
            {typeof balance === 'number' ? ` · ${ru ? 'теперь' : 'now'} ${balance}` : ''}
          </p>
        </>
      )}

      <Button
        onClick={() => { haptic.impact('light'); navigate('/dashboard'); }}
        className="w-full mt-8"
        size="lg"
        data-testid="button-go-dashboard"
      >
        {isSub ? (ru ? 'Открыть приложение' : 'Open the app') : (ru ? 'К гороскопам' : 'Back to the app')}
      </Button>
    </div>
  );

  // ---------- Остальные состояния ----------
  const getIcon = () => {
    switch (status) {
      case 'processing': return <AlertCircle className="w-14 h-14 text-[hsl(var(--solar-gold))]" strokeWidth={1.6} />;
      case 'abandoned': return <XCircle className="w-14 h-14 text-orange-400" strokeWidth={1.6} />;
      case 'failed': return <XCircle className="w-14 h-14 text-destructive" strokeWidth={1.6} />;
      default: return <Loader size="lg" />;
    }
  };
  const getTitle = () => {
    switch (status) {
      case 'processing': return ru ? 'Платёж обрабатывается' : 'Payment processing';
      case 'abandoned': return ru ? 'Оплата не завершена' : 'Payment not completed';
      case 'failed': return ru ? 'Платёж не подтверждён' : 'Payment not confirmed';
      default: return ru ? 'Проверяем платёж…' : 'Checking payment…';
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
        <Card className="relative p-8 anim-fade-up" data-testid="card-payment-result">
          {status !== 'checking' && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="absolute top-3 right-3 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={ru ? 'Закрыть' : 'Close'}
              data-testid="button-close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {status === 'success' ? renderSuccess() : (
            <div className="flex flex-col items-center text-center space-y-6">
              {getIcon()}
              <h1 className="text-2xl font-display font-bold" data-testid="text-payment-title">{getTitle()}</h1>
              {message && (
                <p className="text-muted-foreground" data-testid="text-payment-message">{message}</p>
              )}
              {status === 'processing' && paymentType === 'yookassa' && autoRetryCount > 0 && countdown > 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-retry-countdown">
                  {ru ? `Следующая проверка через ${countdown} с` : `Next check in ${countdown}s`}
                </p>
              )}
              {status === 'processing' && paymentType === 'ton' && pollingAttempt > 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-ton-attempt">
                  {ru ? 'Попытка' : 'Attempt'} {pollingAttempt}/15
                </p>
              )}

              <div className="flex gap-3 w-full pt-2">
                {(status === 'processing' || status === 'failed') && (
                  <Button variant="outline" onClick={handleManualRetry} className="flex-1" data-testid="button-retry-check">
                    {ru ? 'Проверить снова' : 'Check again'}
                  </Button>
                )}
                {status === 'abandoned' ? (
                  <>
                    <Button variant="outline" onClick={() => navigate('/dashboard')} className="flex-1" data-testid="button-close-abandoned">
                      {ru ? 'Закрыть' : 'Close'}
                    </Button>
                    <Button onClick={() => navigate(retryPath())} className="flex-1" data-testid="button-retry-payment">
                      {ru ? 'Выбрать заново' : 'Choose again'}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => navigate('/dashboard')} className="flex-1" data-testid="button-go-dashboard">
                    {ru ? 'На главную' : 'Go to dashboard'}
                  </Button>
                )}
              </div>

              {showSupportButton && (
                <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="w-full" data-testid="link-support">
                  <Button variant="ghost" className="w-full gap-2">
                    <MessageCircle className="w-4 h-4" />
                    {ru ? 'Написать в поддержку' : 'Contact support'}
                  </Button>
                </a>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
