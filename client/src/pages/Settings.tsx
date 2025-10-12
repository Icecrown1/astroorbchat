import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { Loader } from '@/components/Loader';
import { ArrowLeft, Save, LogOut, Trash2, Languages } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/store/useAuth';
import { useTranslation } from '@/contexts/LocaleContext';
import { Locale } from '@/lib/translations';
import type { User, Subscription } from '@shared/schema';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import { useEffect, useMemo } from 'react';

dayjs.extend(timezone);

const TIMEZONES = Intl.supportedValuesOf('timeZone');

interface UserMeResponse {
  ok: boolean;
  data: User & {
    subscription?: Subscription | null;
  };
}

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, updateUser, clearAuth } = useAuth();
  const { t, locale, setLocale } = useTranslation();

  const handleLogoutAndClear = () => {
    clearAuth();
    queryClient.clear();
    toast({
      title: locale === 'ru' ? 'Вышли из аккаунта' : 'Logged Out',
      description: locale === 'ru' ? 'Теперь вы можете снова протестировать регистрацию' : 'You can now test registration again',
    });
    navigate('/register');
  };

  const { data, isLoading } = useQuery<UserMeResponse>({
    queryKey: ['/api/user/me'],
  });

  const settingsSchema = useMemo(() => z.object({
    name: z.string().min(1, locale === 'ru' ? 'Имя обязательно' : 'Name is required'),
    gender: z.enum(['male', 'female', 'other']),
    age: z.string().transform((val) => parseInt(val, 10)).pipe(
      z.number()
        .min(1, locale === 'ru' ? 'Возраст должен быть не менее 1 года' : 'Age must be at least 1')
        .max(150, locale === 'ru' ? 'Возраст должен быть не более 150 лет' : 'Age must be at most 150')
    ),
    birthdayDate: z.string().min(1, locale === 'ru' ? 'Дата рождения обязательна' : 'Birth date is required'),
    birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
    birthPlace: z.string().optional(),
    timezone: z.string(),
  }), [locale]);

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      gender: 'other' as any,
      age: '',
      birthdayDate: '',
      birthTime: '',
      birthPlace: '',
      timezone: dayjs.tz.guess(),
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (data?.data) {
      const userData = data.data;
      form.reset({
        name: userData.name || '',
        gender: (userData.gender as any) || 'other',
        age: userData.age?.toString() || '',
        birthdayDate: userData.birthdayDate ? dayjs(userData.birthdayDate).format('YYYY-MM-DD') : '',
        birthTime: userData.birthTime || '',
        birthPlace: userData.birthPlace || '',
        timezone: userData.timezone || dayjs.tz.guess(),
      });
    }
  }, [data, form.reset]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/user/update', {
        ...data,
        age: parseInt(data.age, 10),
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace || null,
      });
      if (!response.ok) throw new Error(response.error || 'Failed to update profile');
      return response.data;
    },
    onSuccess: (data) => {
      updateUser(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.settings.updateSuccess,
        description: t.settings.saveChanges,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.settings.updateError,
        description: error.message || t.errors.invalidInput,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

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
            <h1 className="text-2xl font-display font-bold">{t.settings.title}</h1>
            <p className="text-muted-foreground">{t.settings.subtitle}</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">{t.settings.language}</h3>
              <Select
                value={locale}
                onValueChange={(value) => setLocale(value as Locale)}
              >
                <SelectTrigger data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t.settings.english}</SelectItem>
                  <SelectItem value="ru">{t.settings.russian}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">{t.settings.personalInfo}</h3>
            </div>

            <div>
              <Label htmlFor="name">{t.auth.firstName}</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder={t.auth.firstName}
                data-testid="input-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="gender">{locale === 'ru' ? 'Пол' : 'Gender'}</Label>
              <Select
                onValueChange={(value) => form.setValue('gender', value as any)}
                value={form.watch('gender')}
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
                {...form.register('age')}
                placeholder={locale === 'ru' ? 'Возраст' : 'Age'}
                data-testid="input-age"
              />
              {form.formState.errors.age && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.age.message}
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">{t.settings.birthData}</h3>
            </div>

            <div>
              <Label htmlFor="birthdayDate">{t.auth.birthDate}</Label>
              <Input
                id="birthdayDate"
                type="date"
                {...form.register('birthdayDate')}
                data-testid="input-birthday"
              />
              {form.formState.errors.birthdayDate && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.birthdayDate.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="birthTime">{t.auth.birthTime}</Label>
              <Input
                id="birthTime"
                type="time"
                {...form.register('birthTime')}
                data-testid="input-birthtime"
              />
            </div>

            <div>
              <Label htmlFor="birthPlace">{t.auth.birthPlace}</Label>
              <Input
                id="birthPlace"
                {...form.register('birthPlace')}
                placeholder={locale === 'ru' ? 'Город, Страна' : 'City, Country'}
                data-testid="input-birthplace"
              />
            </div>

            <div>
              <Label htmlFor="timezone">{locale === 'ru' ? 'Часовой пояс' : 'Timezone'}</Label>
              <Select
                onValueChange={(value) => form.setValue('timezone', value)}
                value={form.watch('timezone')}
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

            <Button
              type="submit"
              disabled={mutation.isPending}
              size="lg"
              className="w-full"
              data-testid="button-save-settings"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {t.settings.saving}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t.settings.saveChanges}
                </>
              )}
            </Button>
          </form>
        </Card>

        {!import.meta.env.PROD && (
          <Card className="p-6 mt-6 border-destructive/50">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-destructive">{locale === 'ru' ? 'Панель разработки' : 'Development Panel'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'ru' ? 'Инструменты для тестирования и разработки' : 'Tools for testing and development'}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="destructive"
                onClick={handleLogoutAndClear}
                className="w-full"
                data-testid="button-dev-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {locale === 'ru' ? 'Выйти и очистить данные' : 'Logout & Clear Data'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {locale === 'ru' ? 'Это выполнит выход и очистит все локальные данные. Используйте для повторного тестирования регистрации.' : 'This will log you out and clear all local data. Use this to test registration again.'}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
