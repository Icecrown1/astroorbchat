import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/store/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { getInitData, getReferralCode } from '@/lib/telegram';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  // Check if running in Telegram Mini App context with event-driven + polling fallback
  useEffect(() => {
    let isMounted = true;
    let cleanupFn: (() => void) | null = null;
    
    const checkTelegramContext = async () => {
      // TEMPORARY: Allow registration without Telegram for moderation/testing
      // Set VITE_ALLOW_REGISTRATION_WITHOUT_TELEGRAM=true to enable
      const allowWithoutTelegram = import.meta.env.VITE_ALLOW_REGISTRATION_WITHOUT_TELEGRAM === 'true';
      
      // Check if Telegram WebApp is available
      const isTelegramWebApp = window.Telegram?.WebApp !== undefined;
      
      if (!isMounted) return;
      
      if (!isTelegramWebApp && !allowWithoutTelegram) {
        // Not in Telegram context at all - redirect to web login
        navigate('/login');
        return;
      }
      
      // If allowing without Telegram, skip initData checks and proceed directly
      if (allowWithoutTelegram && !isTelegramWebApp) {
        console.log('[Register] Registration without Telegram allowed');
        setIsCheckingTelegram(false);
        return;
      }
      
      const startTime = Date.now();
      const maxWaitTime = 30000; // 30 seconds max for slow networks
      
      // Event-driven approach with polling fallback
      const waitForInitData = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const telegram = window.Telegram?.WebApp;
          let resolved = false;
          let pollInterval: NodeJS.Timeout | null = null;
          let timeoutHandle: NodeJS.Timeout | null = null;
          const timeouts: NodeJS.Timeout[] = [];
          let readyHandler: (() => void) | null = null;
          
          const cleanup = () => {
            if (pollInterval) clearInterval(pollInterval);
            if (timeoutHandle) clearTimeout(timeoutHandle);
            timeouts.forEach(t => clearTimeout(t));
            // Unsubscribe from web_app_ready event
            if (telegram && readyHandler && typeof (telegram as any).offEvent === 'function') {
              try {
                (telegram as any).offEvent('web_app_ready', readyHandler);
              } catch (e) {
                console.warn('[Telegram Auth] Failed to unsubscribe from web_app_ready:', e);
              }
            }
          };
          
          cleanupFn = cleanup;
          
          const checkAndResolve = () => {
            if (resolved || !isMounted) return;
            
            const initData = getInitData();
            if (initData && initData.length > 0) {
              const loadTime = Date.now() - startTime;
              console.log('[Telegram Auth] InitData loaded in', loadTime, 'ms');
              resolved = true;
              cleanup();
              resolve(true);
              return true;
            }
            return false;
          };
          
          // Check immediately first
          if (checkAndResolve()) return;
          
          // Subscribe to web_app_ready event (if available in runtime)
          if (telegram && typeof (telegram as any).onEvent === 'function') {
            try {
              readyHandler = () => {
                console.log('[Telegram Auth] web_app_ready event fired');
                checkAndResolve();
              };
              (telegram as any).onEvent('web_app_ready', readyHandler);
            } catch (e) {
              console.warn('[Telegram Auth] Failed to subscribe to web_app_ready:', e);
            }
          }
          
          // Call ready() to signal WebApp initialization
          if (telegram && typeof telegram.ready === 'function') {
            telegram.ready();
            // Check shortly after ready() to catch fast initData injection
            timeouts.push(setTimeout(() => checkAndResolve(), 100));
            timeouts.push(setTimeout(() => checkAndResolve(), 300));
          }
          
          // Set up adaptive polling as additional fallback
          let currentDelay = 200;
          
          const startPolling = (delay: number) => {
            if (pollInterval) clearInterval(pollInterval);
            if (resolved || !isMounted) return;
            
            pollInterval = setInterval(() => {
              if (!isMounted) {
                cleanup();
                return;
              }
              checkAndResolve();
            }, delay);
          };
          
          // Start with fast polling, then slow down
          startPolling(200);
          timeouts.push(setTimeout(() => !resolved && isMounted && startPolling(500), 2000));
          timeouts.push(setTimeout(() => !resolved && isMounted && startPolling(1000), 5000));
          
          // Maximum timeout of 30 seconds
          timeoutHandle = setTimeout(() => {
            if (resolved || !isMounted) return;
            console.warn('[Telegram Auth] Timeout after 30s, no initData found');
            cleanup();
            resolved = true;
            resolve(false);
          }, maxWaitTime);
        });
      };
      
      const hasInitData = await waitForInitData();
      
      if (!isMounted) return;
      
      if (hasInitData) {
        // Valid Telegram Mini App context - allow registration
        setIsCheckingTelegram(false);
      } else {
        // After 30 seconds, no initData found - redirect to login
        navigate('/login');
      }
    };
    
    checkTelegramContext();
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (cleanupFn) cleanupFn();
    };
  }, [navigate]);

  // Extract referral code from Telegram (after Telegram context is ready)
  useEffect(() => {
    if (!isCheckingTelegram) {
      const code = getReferralCode();
      if (code) {
        console.log('[Registration] Referral code detected:', code);
        setReferralCode(code);
        toast({
          title: locale === 'ru' ? '🎁 Реферальный код применён!' : '🎁 Referral code applied!',
          description: locale === 'ru' 
            ? 'Вы получите бонус после регистрации' 
            : 'You will receive a bonus after registration',
        });
      }
    }
  }, [isCheckingTelegram, locale, toast]);

  const step1Schema = useMemo(() => z.object({
    name: z.string().min(1, locale === 'ru' ? 'Имя обязательно' : 'Name is required'),
    gender: z.enum(['male', 'female', 'other']),
    age: z.string().transform((val) => parseInt(val, 10)).pipe(
      z.number()
        .min(1, locale === 'ru' ? 'Возраст должен быть не менее 1 года' : 'Age must be at least 1')
        .max(150, locale === 'ru' ? 'Возраст должен быть не более 150 лет' : 'Age must be at most 150')
    ),
  }), [locale]);

  const step2Schema = useMemo(() => z.object({
    birthdayDate: z.string().min(1, locale === 'ru' ? 'Дата рождения обязательна' : 'Birth date is required'),
    birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
    birthPlace: z.string().optional(),
  }), [locale]);

  const step3Schema = useMemo(() => z.object({
    timezone: z.string().min(1, locale === 'ru' ? 'Часовой пояс обязателен' : 'Timezone is required'),
  }), [locale]);

  const step1Form = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      gender: 'other' as const,
      age: '',
    },
  });

  const step2Form = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      birthdayDate: '',
      birthTime: '',
      birthPlace: '',
    },
  });

  const step3Form = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      timezone: dayjs.tz.guess(),
    },
  });

  const handleStep1 = (data: any) => {
    setFormData({ ...formData, ...data });
    setStep(2);
  };

  const handleStep2 = (data: any) => {
    setFormData({ ...formData, ...data });
    setStep(3);
  };

  const handleStep3 = async (data: any) => {
    const finalData = {
      ...formData,
      ...data,
      age: parseInt(formData.age, 10),
      birthTime: formData.birthTime || null,
      birthPlace: formData.birthPlace || null,
      ...(referralCode && { referralCode }), // Add referral code if present
    };

    try {
      const initData = getInitData();
      const allowWithoutTelegram = import.meta.env.VITE_ALLOW_REGISTRATION_WITHOUT_TELEGRAM === 'true';
      
      // Must have valid Telegram initData to register through Mini App (unless override is enabled)
      if (!allowWithoutTelegram && (!initData || initData.length === 0)) {
        toast({
          title: t.common.error,
          description: locale === 'ru' 
            ? 'Регистрация доступна только через Telegram Mini App' 
            : 'Registration is only available through Telegram Mini App',
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData: initData || '', // Allow empty initData if override is enabled
          ...finalData 
        }),
        credentials: 'include',
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(locale === 'ru' 
          ? `Сервер вернул не-JSON ответ: ${text.substring(0, 100)}` 
          : `Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      const result = await response.json();
      console.log('Registration result:', result);

      if (!response.ok) {
        throw new Error(result.error || (locale === 'ru' 
          ? `Запрос не удался со статусом ${response.status}` 
          : `Request failed with status ${response.status}`));
      }

      if (result.ok && result.data) {
        console.log('Setting auth with user:', result.data.user);
        console.log('Token:', result.data.token);
        setAuth(result.data.user, result.data.token);
        
        // Wait a bit for auth to be saved
        await new Promise(resolve => setTimeout(resolve, 100));
        
        toast({
          title: t.auth.welcomeDefault,
          description: t.dashboard.subtitle,
        });
        navigate('/dashboard');
      } else {
        throw new Error(result.error || (locale === 'ru' ? 'Регистрация не удалась' : 'Registration failed'));
      }
    } catch (error: any) {
      toast({
        title: t.common.error,
        description: error.message || t.errors.invalidInput,
        variant: 'destructive',
      });
    }
  };

  const progress = (step / 3) * 100;

  // Show loading while checking Telegram context
  if (isCheckingTelegram) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="mt-4 text-muted-foreground">
            {locale === 'ru' ? 'Проверка контекста Telegram...' : 'Checking Telegram context...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-primary to-chart-2">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-display font-bold text-center mb-2">
            {t.auth.welcomeDefault}
          </h1>
          <p className="text-center text-muted-foreground">
            {t.common.next} {step} {t.common.back} 3
          </p>
        </div>

        <Progress value={progress} className="mb-6" />

        {step === 1 && (
          <form onSubmit={step1Form.handleSubmit(handleStep1)} className="space-y-4">
            <div>
              <Label htmlFor="name">{t.auth.firstName}</Label>
              <Input
                id="name"
                {...step1Form.register('name')}
                placeholder={t.auth.firstName}
                data-testid="input-name"
              />
              {step1Form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {step1Form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="gender">{t.settings.personalInfo}</Label>
              <Select
                onValueChange={(value) => step1Form.setValue('gender', value as any)}
                defaultValue="other"
              >
                <SelectTrigger id="gender" data-testid="select-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{locale === 'ru' ? 'Мужской' : 'Male'}</SelectItem>
                  <SelectItem value="female">{locale === 'ru' ? 'Женский' : 'Female'}</SelectItem>
                  <SelectItem value="other">{locale === 'ru' ? 'Другое' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="age">{locale === 'ru' ? 'Возраст' : 'Age'}</Label>
              <Input
                id="age"
                type="number"
                {...step1Form.register('age')}
                placeholder={locale === 'ru' ? 'Введите возраст' : 'Enter your age'}
                data-testid="input-age"
              />
              {step1Form.formState.errors.age && (
                <p className="text-sm text-destructive mt-1">
                  {step1Form.formState.errors.age.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" data-testid="button-next-step1">
              {t.common.next}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={step2Form.handleSubmit(handleStep2)} className="space-y-4">
            <div>
              <Label htmlFor="birthdayDate">{t.auth.birthDate}</Label>
              <Input
                id="birthdayDate"
                type="date"
                {...step2Form.register('birthdayDate')}
                data-testid="input-birthday"
              />
              {step2Form.formState.errors.birthdayDate && (
                <p className="text-sm text-destructive mt-1">
                  {step2Form.formState.errors.birthdayDate.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="birthTime">{t.auth.birthTime}</Label>
              <Input
                id="birthTime"
                type="time"
                {...step2Form.register('birthTime')}
                placeholder="HH:mm"
                data-testid="input-birthtime"
              />
            </div>

            <div>
              <Label htmlFor="birthPlace">{t.auth.birthPlace}</Label>
              <Input
                id="birthPlace"
                {...step2Form.register('birthPlace')}
                placeholder={locale === 'ru' ? 'Город, Страна' : 'City, Country'}
                data-testid="input-birthplace"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
                data-testid="button-back-step2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.common.back}
              </Button>
              <Button type="submit" className="flex-1" data-testid="button-next-step2">
                {t.common.next}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={step3Form.handleSubmit(handleStep3)} className="space-y-4">
            <div>
              <Label htmlFor="timezone">{locale === 'ru' ? 'Часовой пояс' : 'Timezone'}</Label>
              <Select
                onValueChange={(value) => step3Form.setValue('timezone', value)}
                defaultValue={dayjs.tz.guess()}
              >
                <SelectTrigger id="timezone" data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
                data-testid="button-back-step3"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.common.back}
              </Button>
              <Button type="submit" className="flex-1" data-testid="button-complete-registration">
                {locale === 'ru' ? 'Завершить' : 'Complete'}
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
