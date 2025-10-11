import { useState, useMemo } from 'react';
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
import { useAuth } from '@/store/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { getInitData } from '@/lib/telegram';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONES = Intl.supportedValuesOf('timeZone');

export default function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [, navigate] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();

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
    };

    try {
      const initData = getInitData();
      
      // Use test endpoint in development or when no valid initData
      const isProduction = import.meta.env.PROD;
      const hasValidInitData = initData && initData.length > 0;
      
      let url = '/api/auth/test';
      let body = finalData;
      
      if (isProduction && hasValidInitData) {
        url = '/api/auth/telegram';
        body = { initData, ...finalData };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          title: t.auth.welcome,
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
            {t.auth.welcome}
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
