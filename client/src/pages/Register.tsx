import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { ArrowRight } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { haptic } from '@/lib/haptics';
import { apiRequest } from '@/lib/queryClient';
import { Loader } from '@/components/Loader';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { useAuth } from '@/store/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { getInitData, getReferralCode, getLeadIdFromStartParam, getWebSourceFromStartParam, getStartParam } from '@/lib/telegram';
interface LeadData {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  birthTime: string | null;
  birthPlace: string | null;
}

type Gender = 'male' | 'female' | 'other';
type TimeMode = 'exact' | 'approx' | 'unknown';

interface OnbForm {
  name: string;
  gender: Gender;
  birthdayDate: string;
  timeMode: TimeMode;
  birthTime: string;
  birthPlace: string;
}

const EMPTY_FORM: OnbForm = { name: '', gender: 'other', birthdayDate: '', timeMode: 'exact', birthTime: '', birthPlace: '' };
const FORM_KEY = 'onb_form';
const HELLO_KEY = 'onb_hello';
const UNKNOWN_TIME = '12:00'; // текущий дефолт сервера
const APPROX_CHIPS: { key: string; time: string; ru: string; en: string }[] = [
  { key: 'morning', time: '09:00', ru: 'Утро', en: 'Morning' },
  { key: 'day', time: '14:00', ru: 'День', en: 'Afternoon' },
  { key: 'evening', time: '20:00', ru: 'Вечер', en: 'Evening' },
  { key: 'night', time: '02:00', ru: 'Ночь', en: 'Night' },
];

function loadForm(): OnbForm {
  try {
    const raw = sessionStorage.getItem(FORM_KEY);
    if (raw) return { ...EMPTY_FORM, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return EMPTY_FORM;
}

export default function Register() {
  // 0 = приветствие, 1..3 = шаги, 4 = сцена «строим карту»
  const [step, setStep] = useState<number>(() => {
    try { return sessionStorage.getItem(HELLO_KEY) ? 1 : 0; } catch { return 0; }
  });
  const [form, setForm] = useState<OnbForm>(loadForm);
  const [errors, setErrors] = useState<Partial<Record<keyof OnbForm, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [whyTimeOpen, setWhyTimeOpen] = useState(false);
  const [stepKey, setStepKey] = useState(0); // перезапуск анимации шага
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [, navigate] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  // Check if running in Telegram Mini App context with event-driven + polling fallback
  useEffect(() => {
    let isMounted = true;
    let cleanupFn: (() => void) | null = null;
    
    const checkTelegramContext = async () => {
      // Check if registration without Telegram is allowed
      const allowWithoutTelegram = import.meta.env.VITE_ALLOW_REGISTRATION_WITHOUT_TELEGRAM === 'true';
      
      if (!isMounted) return;
      
      // If allowing without Telegram, skip all Telegram checks and proceed directly
      if (allowWithoutTelegram) {
        console.log('[Register] Registration without Telegram allowed - skipping all Telegram checks');
        setIsCheckingTelegram(false);
        return;
      }
      
      // Check if Telegram WebApp is available
      const isTelegramWebApp = window.Telegram?.WebApp !== undefined;
      
      if (!isTelegramWebApp) {
        // Not in Telegram context at all - redirect to web login
        navigate('/login');
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

  // Extract referral code or lead ID from Telegram (after Telegram context is ready)
  useEffect(() => {
    if (!isCheckingTelegram) {
      // Check for lead ID first (format: lead_xxx)
      const extractedLeadId = getLeadIdFromStartParam();
      if (extractedLeadId) {
        console.log('[Registration] Lead ID detected:', extractedLeadId);
        setLeadId(extractedLeadId);
        
        // Fetch lead data from server
        fetch(`/api/lead/${extractedLeadId}`)
          .then(res => {
            if (res.status === 404 || res.status === 410) {
              // Lead not found or already used - proceed with normal registration
              console.log('[Registration] Lead not available, proceeding with normal registration');
              setLeadId(null);
              return null;
            }
            return res.json();
          })
          .then(data => {
            if (data && data.ok && data.data) {
              const lead = data.data;
              console.log('[Registration] Lead data loaded:', lead);
              
              setLeadData({
                id: lead.id,
                name: lead.name,
                gender: lead.gender,
                birthDate: lead.birthDate,
                birthTime: lead.birthTime,
                birthPlace: lead.birthPlace,
              });
              
              toast({
                title: locale === 'ru' ? 'Данные загружены' : 'Data loaded',
                description: locale === 'ru' 
                  ? 'Ваши данные с сайта уже заполнены' 
                  : 'Your data from the website is pre-filled',
              });
            }
          })
          .catch(err => {
            console.error('[Registration] Failed to load lead data:', err);
            setLeadId(null);
          });
      } else {
        // Check for regular referral code
        const code = getReferralCode();
        if (code) {
          console.log('[Registration] Referral code detected:', code);
          setReferralCode(code);
          toast({
            title: locale === 'ru' ? 'Реферальный код применён!' : 'Referral code applied!',
            description: locale === 'ru' 
              ? 'Вы получите бонус после регистрации' 
              : 'You will receive a bonus after registration',
          });
        }
      }
    }
  }, [isCheckingTelegram, locale, toast]);


  // Черновик формы живёт в сессии — прерывание на шаге 2 не теряет введённое на шаге 1
  useEffect(() => {
    try { sessionStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch { /* noop */ }
  }, [form]);

  // Pre-fill when lead data is loaded
  useEffect(() => {
    if (leadData) {
      console.log('[Registration] Pre-filling form with lead data:', leadData);
      setForm((f) => ({
        ...f,
        name: leadData.name || f.name,
        gender: (leadData.gender as Gender) || f.gender,
        birthdayDate: leadData.birthDate || f.birthdayDate,
        birthTime: leadData.birthTime || f.birthTime,
        timeMode: leadData.birthTime ? 'exact' : f.timeMode,
        birthPlace: leadData.birthPlace || f.birthPlace,
      }));
    }
  }, [leadData]);

  const ru = locale === 'ru';
  const set = <K extends keyof OnbForm>(key: K, value: OnbForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const goTo = (next: number) => {
    haptic.select();
    setStep(next);
    setStepKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };

  const validateStep = (n: number): boolean => {
    const e: Partial<Record<keyof OnbForm, string>> = {};
    if (n === 1 && !form.name.trim()) e.name = ru ? 'Как к вам обращаться?' : 'How should we call you?';
    if (n === 2) {
      if (!form.birthdayDate) e.birthdayDate = ru ? 'Без даты карту не построить' : 'We need the date to build the chart';
      else {
        const d = new Date(form.birthdayDate);
        if (isNaN(d.getTime()) || d > new Date()) e.birthdayDate = ru ? 'Проверьте дату' : 'Check the date';
      }
      if (form.timeMode !== 'unknown' && !/^\d{2}:\d{2}$/.test(form.birthTime)) {
        e.birthTime = form.timeMode === 'exact'
          ? (ru ? 'Укажите время или выберите «Примерно»' : 'Enter the time or pick "Roughly"')
          : (ru ? 'Выберите время суток' : 'Pick a time of day');
      }
    }
    if (n === 3 && !form.birthPlace.trim()) e.birthPlace = ru ? 'Нужен город — от него зависят дома карты' : 'We need the city — it sets the chart houses';
    setErrors(e);
    if (Object.keys(e).length) haptic.notify('error');
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    goTo(step + 1);
  };

  // ---------- Сабмит: контракт /api/auth/telegram не меняется ----------
  const submit = async () => {
    if (!validateStep(3)) return;
    haptic.impact('medium');
    setSubmitError(null);
    setStep(4);
    const startedAt = Date.now();
    const MIN_SCENE_MS = 2500;

    const finalData = {
      name: form.name.trim(),
      gender: form.gender,
      birthdayDate: form.birthdayDate,
      birthTime: form.timeMode === 'unknown' ? UNKNOWN_TIME : form.birthTime,
      birthPlace: form.birthPlace,
      ...(referralCode && { referralCode }),
    };

    try {
      const initData = getInitData();
      const allowWithoutTelegram = import.meta.env.VITE_ALLOW_REGISTRATION_WITHOUT_TELEGRAM === 'true';
      if (!allowWithoutTelegram && (!initData || initData.length === 0)) {
        toast({
          title: t.common.error,
          description: ru ? 'Регистрация доступна только через Telegram Mini App' : 'Registration is only available through Telegram Mini App',
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData || '',
          signupSource: getWebSourceFromStartParam() || undefined,
          ...finalData,
        }),
        credentials: 'include',
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(ru ? `Сервер вернул не-JSON ответ: ${text.substring(0, 100)}` : `Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || (ru ? `Запрос не удался со статусом ${response.status}` : `Request failed with status ${response.status}`));
      }
      if (!(result.ok && result.data)) {
        throw new Error(result.error || (ru ? 'Регистрация не удалась' : 'Registration failed'));
      }

      setAuth(result.data.user, result.data.token);
      await new Promise((r) => setTimeout(r, 100));

      if (leadId && result.data.token) {
        try {
          await fetch(`/api/lead/${leadId}/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${result.data.token}` },
          });
        } catch (err) {
          console.error('[Registration] Failed to convert lead:', err);
        }
      }

      // Сцена идёт минимум 2.5 с, даже если сервер ответил быстрее
      const left = MIN_SCENE_MS - (Date.now() - startedAt);
      if (left > 0) await new Promise((r) => setTimeout(r, left));

      try { sessionStorage.removeItem(FORM_KEY); } catch { /* noop */ }
      haptic.notify('success');
      // Дип-линк с сайта web_matrix_* — сразу в матрицу (как делает Dashboard), иначе первый экран — своя карта
      const sp = getStartParam();
      if (sp && String(sp).startsWith('web_matrix')) {
        try { sessionStorage.setItem('astro_matrix_deeplink_done', '1'); } catch { /* noop */ }
        navigate('/matrix');
      } else {
        navigate('/my-natal-chart');
      }
    } catch (error: any) {
      haptic.notify('error');
      setSubmitError(error?.message || t.errors.invalidInput);
      setStep(3);
      setStepKey((k) => k + 1);
    }
  };

  // Клавиатура не должна перекрывать поле
  const focusScroll = (e: React.FocusEvent<HTMLElement>) => {
    setTimeout(() => e.target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 250);
  };

  // ---------- Экраны ----------
  if (isCheckingTelegram) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="mt-4 text-muted-foreground">{ru ? 'Проверка контекста Telegram...' : 'Checking Telegram context...'}</p>
        </div>
      </div>
    );
  }

  // H1 — приветствие
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background wheel-nebula !rounded-none flex flex-col items-center justify-center p-6 text-center">
        <div className="anim-fade-up">
          <Loader size="lg" />
        </div>
        <h1 className="anim-fade-up anim-d1 font-display font-bold text-3xl leading-tight mt-8 max-w-sm">
          {ru ? 'Ваша карта уже на небе. Построим её за минуту' : 'Your chart is already in the sky. Let\u2019s build it in a minute'}
        </h1>
        <p className="anim-fade-up anim-d2 text-muted-foreground mt-4 max-w-xs">
          {ru ? 'Swiss Ephemeris — та же астрономия, что у NASA' : 'Swiss Ephemeris — the same astronomy NASA uses'}
        </p>
        <Button
          size="lg"
          className="anim-fade-up anim-d3 mt-10 w-full max-w-xs h-12 text-base tap-scale"
          onClick={() => { haptic.impact('light'); try { sessionStorage.setItem(HELLO_KEY, '1'); } catch { /* noop */ } goTo(1); }}
          data-testid="button-onb-start"
        >
          {ru ? 'Начать' : 'Start'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // H3 — сцена «строим карту»
  if (step === 4) {
    return <BuildingScene ru={ru} />;
  }

  const segBtn = (active: boolean) =>
    `flex-1 h-10 rounded-lg text-sm transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`;
  const chipBtn = (active: boolean) =>
    `h-9 px-3 rounded-full text-sm border transition-colors ${active ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`;
  const errText = (msg?: string) => msg ? <p className="text-sm text-destructive mt-1.5" role="alert">{msg}</p> : null;

  const titles: Record<number, [string, string]> = {
    1: ru ? ['Как к вам обращаться', 'Так карта будет говорить с вами лично'] : ['How should we call you', 'So the chart speaks to you personally'],
    2: ru ? ['Момент рождения', 'Дата обязательна, время — как получится'] : ['Moment of birth', 'Date is required, time — as best you can'],
    3: ru ? ['Место рождения', 'Город задаёт горизонт и дома карты'] : ['Place of birth', 'The city sets the horizon and houses'],
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-palette opacity-20" />
      </div>

      <div className="container max-w-md mx-auto pt-4">
        {/* Прогресс-доты */}
        <div className="flex items-center justify-center gap-2 mb-8" aria-label={`${ru ? 'Шаг' : 'Step'} ${step} / 3`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all duration-300 ${n === step ? 'w-8 bg-primary' : n < step ? 'w-3 bg-primary/50' : 'w-3 bg-muted'}`}
            />
          ))}
        </div>

        <div key={stepKey} className="onb-step">
          <h1 className="text-2xl font-display font-bold">{titles[step][0]}</h1>
          <p className="text-muted-foreground text-sm mt-1 mb-6">{titles[step][1]}</p>

          {/* Шаг 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="name">{ru ? 'Имя' : 'Name'}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  onFocus={focusScroll}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
                  placeholder={ru ? 'Например, Алексей' : 'e.g. Alex'}
                  autoComplete="given-name"
                  className="mt-1.5 h-11"
                  data-testid="input-name"
                />
                {errText(errors.name)}
              </div>
              <div>
                <Label>{ru ? 'Пол' : 'Gender'}</Label>
                <div className="flex gap-1.5 mt-1.5 p-1 rounded-xl bg-muted/50" role="radiogroup">
                  {(['female', 'male', 'other'] as Gender[]).map((g) => (
                    <button
                      key={g} type="button" role="radio" aria-checked={form.gender === g}
                      className={segBtn(form.gender === g)}
                      onClick={() => { haptic.select(); set('gender', g); }}
                      data-testid={`gender-${g}`}
                    >
                      {g === 'female' ? (ru ? 'Женский' : 'Female') : g === 'male' ? (ru ? 'Мужской' : 'Male') : (ru ? 'Другое' : 'Other')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Шаг 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="birthdayDate">{ru ? 'Дата рождения' : 'Date of birth'}</Label>
                <Input
                  id="birthdayDate" type="date" max={new Date().toISOString().slice(0, 10)}
                  value={form.birthdayDate}
                  onChange={(e) => set('birthdayDate', e.target.value)}
                  onFocus={focusScroll}
                  className="mt-1.5 h-11"
                  data-testid="input-birthday"
                />
                {errText(errors.birthdayDate)}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label>{ru ? 'Время рождения' : 'Time of birth'}</Label>
                  <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setWhyTimeOpen(true)} data-testid="link-why-time">
                    {ru ? 'зачем время?' : 'why time?'}
                  </button>
                </div>
                <div className="flex gap-1.5 mt-1.5 p-1 rounded-xl bg-muted/50" role="tablist">
                  {(['exact', 'approx', 'unknown'] as TimeMode[]).map((m) => (
                    <button
                      key={m} type="button" role="tab" aria-selected={form.timeMode === m}
                      className={segBtn(form.timeMode === m)}
                      onClick={() => { haptic.select(); set('timeMode', m); if (m === 'approx') set('birthTime', ''); }}
                      data-testid={`timemode-${m}`}
                    >
                      {m === 'exact' ? (ru ? 'Знаю точно' : 'Exactly') : m === 'approx' ? (ru ? 'Примерно' : 'Roughly') : (ru ? 'Не знаю' : "Don't know")}
                    </button>
                  ))}
                </div>

                {form.timeMode === 'exact' && (
                  <Input
                    type="time" value={form.birthTime}
                    onChange={(e) => set('birthTime', e.target.value)}
                    onFocus={focusScroll}
                    className="mt-2 h-11"
                    data-testid="input-birthtime"
                  />
                )}
                {form.timeMode === 'approx' && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {APPROX_CHIPS.map((c) => (
                      <button key={c.key} type="button" className={chipBtn(form.birthTime === c.time)} onClick={() => { haptic.select(); set('birthTime', c.time); }} data-testid={`chip-${c.key}`}>
                        {ru ? c.ru : c.en} {c.time}
                      </button>
                    ))}
                  </div>
                )}
                {form.timeMode === 'unknown' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {ru
                      ? 'Ничего страшного: карта будет точной по планетам, а асцендент уточним позже в настройках.'
                      : 'No problem: the planets will be exact, and we can refine the ascendant later in settings.'}
                  </p>
                )}
                {errText(errors.birthTime)}
              </div>
            </div>
          )}

          {/* Шаг 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <Label>{ru ? 'Город рождения' : 'City of birth'}</Label>
                <div className="mt-1.5" onFocusCapture={focusScroll}>
                  <CityAutocomplete
                    value={form.birthPlace}
                    onChange={(v) => set('birthPlace', v)}
                    placeholder={ru ? 'Город, страна' : 'City, country'}
                    locale={locale}
                  />
                </div>
                {errText(errors.birthPlace)}
                <p className="text-xs text-muted-foreground mt-2">
                  {ru ? 'Не находит ваш город? Попробуйте ближайший крупный — разница в минуты дуги.' : 'Can\u2019t find your town? Try the nearest big city — the difference is arc-minutes.'}
                </p>
              </div>
              {submitError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert" data-testid="text-submit-error">
                  <p className="font-medium">{ru ? 'Не получилось построить карту' : 'Could not build the chart'}</p>
                  <p className="text-muted-foreground mt-1">{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Нижняя панель действий */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="container max-w-md mx-auto flex items-center gap-3">
          {step > 1 && (
            <button type="button" className="text-sm text-muted-foreground px-2 py-3" onClick={() => goTo(step - 1)} data-testid="button-back">
              {ru ? 'Назад' : 'Back'}
            </button>
          )}
          {step < 3 ? (
            <Button className="flex-1 h-12 text-base tap-scale" onClick={handleNext} data-testid={`button-next-step${step}`}>
              {ru ? 'Дальше' : 'Next'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button className="flex-1 h-12 text-base tap-scale" onClick={submit} data-testid="button-complete-registration">
              {submitError ? (ru ? 'Попробовать ещё раз' : 'Try again') : (ru ? 'Построить мою карту' : 'Build my chart')}
              <OrbIcon className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <Drawer open={whyTimeOpen} onOpenChange={setWhyTimeOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{ru ? 'Зачем время рождения' : 'Why the time of birth'}</DrawerTitle>
            <DrawerDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground pt-1">
                <p>{ru ? 'Время определяет асцендент — знак, восходивший на горизонте, — и разбивку карты на 12 домов.' : 'Time sets the ascendant — the sign rising on the horizon — and the split of the chart into 12 houses.'}</p>
                <p>{ru ? 'Асцендент меняется примерно каждые два часа, так что «утро» и «вечер» уже дают разные карты.' : 'The ascendant changes roughly every two hours, so "morning" and "evening" already give different charts.'}</p>
                <p>{ru ? 'Положения планет от времени почти не зависят: без него карта всё равно будет точной по планетам.' : 'Planet positions barely depend on time: without it the chart is still exact for the planets.'}</p>
              </div>
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pt-0">
            <Button variant="outline" className="w-full" onClick={() => setWhyTimeOpen(false)}>{ru ? 'Понятно' : 'Got it'}</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** Полноэкранная сцена, пока идёт регистрация + расчёт */
function BuildingScene({ ru }: { ru: boolean }) {
  const phrases = ru
    ? ['Сверяемся с эфемеридами…', 'Расставляем планеты по домам…', 'Рисуем ваш космический отпечаток…']
    : ['Checking the ephemerides…', 'Placing the planets in houses…', 'Drawing your cosmic fingerprint…'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % phrases.length), 1200);
    return () => clearInterval(id);
  }, [phrases.length]);
  return (
    <div className="min-h-screen bg-background wheel-nebula !rounded-none flex flex-col items-center justify-center p-6 text-center" data-testid="onb-building-scene">
      <Loader size="lg" />
      <p key={i} className="onb-phrase mt-8 text-lg font-display text-foreground/90" aria-live="polite">{phrases[i]}</p>
    </div>
  );
}
