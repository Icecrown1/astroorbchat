import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { UserPlus, Sparkles } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONES = Intl.supportedValuesOf('timeZone');

interface GuestChart {
  id: string;
  name: string;
  gender: string;
  birthdayDate: string;
  birthTime?: string | null;
  birthPlace?: string | null;
  timezone?: string | null;
}

export function GuestChartForm() {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    gender: 'other' as 'male' | 'female' | 'other',
    birthdayDate: '',
    birthTime: '12:00',
    birthPlace: '',
    timezone: dayjs.tz.guess(),
  });

  const { data: guestCharts, isLoading: chartsLoading } = useQuery<{ ok: boolean; data: GuestChart[] }>({
    queryKey: ['/api/natal/external'],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/natal/external', { ...formData, locale });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/natal/external'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      setFormData({ name: '', gender: 'other', birthdayDate: '', birthTime: '12:00', birthPlace: '', timezone: dayjs.tz.guess() });
      toast({
        title: locale === 'ru' ? "Гостевая карта создана!" : "Guest chart created!",
        description: locale === 'ru' ? "Карта сохранена и доступна для анализа совместимости." : "Chart saved and available for compatibility analysis.",
      });
    },
    onError: (error: any) => {
      toast({
        title: locale === 'ru' ? "Ошибка создания" : "Creation failed",
        description: error.message || (locale === 'ru' ? "Попробуйте снова" : "Try again"),
        variant: 'destructive',
      });
    },
  });

  const isFormValid = formData.name && formData.birthdayDate;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-primary/10">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {locale === 'ru' ? 'Создать гостевую карту' : 'Create Guest Chart'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {locale === 'ru' ? 'Для анализа совместимости (1 звезда)' : 'For compatibility analysis (1 star)'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="guest-name">
              {locale === 'ru' ? 'Имя' : 'Name'}
            </Label>
            <Input
              id="guest-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={locale === 'ru' ? 'Введите имя' : 'Enter name'}
              data-testid="input-guest-name"
            />
          </div>

          <div>
            <Label htmlFor="guest-gender">
              {locale === 'ru' ? 'Пол' : 'Gender'}
            </Label>
            <Select
              value={formData.gender}
              onValueChange={(value: 'male' | 'female' | 'other') =>
                setFormData({ ...formData, gender: value })
              }
            >
              <SelectTrigger id="guest-gender" data-testid="select-guest-gender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{locale === 'ru' ? 'Мужской' : 'Male'}</SelectItem>
                <SelectItem value="female">{locale === 'ru' ? 'Женский' : 'Female'}</SelectItem>
                <SelectItem value="other">{locale === 'ru' ? 'Другой' : 'Other'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="guest-birthday">
              {locale === 'ru' ? 'Дата рождения' : 'Birthday'}
            </Label>
            <Input
              id="guest-birthday"
              type="date"
              value={formData.birthdayDate}
              onChange={(e) => setFormData({ ...formData, birthdayDate: e.target.value })}
              data-testid="input-guest-birthday"
            />
          </div>

          <div>
            <Label htmlFor="guest-birthtime">
              {locale === 'ru' ? 'Время рождения (опционально)' : 'Birth time (optional)'}
            </Label>
            <Input
              id="guest-birthtime"
              type="time"
              value={formData.birthTime}
              onChange={(e) => setFormData({ ...formData, birthTime: e.target.value })}
              data-testid="input-guest-birthtime"
            />
          </div>

          <div>
            <Label htmlFor="guest-birthplace">
              {locale === 'ru' ? 'Место рождения (опционально)' : 'Birth place (optional)'}
            </Label>
            <Input
              id="guest-birthplace"
              value={formData.birthPlace}
              onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
              placeholder={locale === 'ru' ? 'Город, Страна' : 'City, Country'}
              data-testid="input-guest-birthplace"
            />
          </div>

          <div>
            <Label htmlFor="guest-timezone">
              {locale === 'ru' ? 'Часовой пояс' : 'Timezone'}
            </Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger id="guest-timezone" data-testid="select-guest-timezone">
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
            onClick={() => createMutation.mutate()}
            disabled={!isFormValid || createMutation.isPending}
            className="w-full"
            data-testid="button-create-guest-chart"
          >
            {createMutation.isPending ? (
              <>
                <Loader className="mr-2" size="sm" />
                {locale === 'ru' ? 'Создание...' : 'Creating...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {locale === 'ru' ? 'Создать карту (1 звезда)' : 'Create Chart (1 star)'}
              </>
            )}
          </Button>
        </div>
      </Card>

      {!chartsLoading && guestCharts?.data && guestCharts.data.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {locale === 'ru' ? 'Сохранённые гостевые карты' : 'Saved Guest Charts'}
          </h3>
          <div className="space-y-2">
            {guestCharts.data.map((chart) => (
              <div
                key={chart.id}
                className="p-3 rounded-lg bg-muted flex items-center justify-between"
                data-testid={`guest-chart-${chart.id}`}
              >
                <div>
                  <p className="font-medium">{chart.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(chart.birthdayDate).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                    {chart.birthTime && ` • ${chart.birthTime}`}
                    {chart.birthPlace && ` • ${chart.birthPlace}`}
                    {chart.timezone && ` • ${chart.timezone}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
