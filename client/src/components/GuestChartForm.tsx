import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { UserPlus } from 'lucide-react';
import { OrbIcon } from '@/components/OrbIcon';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';
import { useEnergy } from '@/store/useEnergy';

interface GuestChart {
  id: string;
  name: string;
  gender: string;
  birthdayDate: string;
  birthTime?: string | null;
  birthPlace?: string | null;
}

export function GuestChartForm() {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const { decreaseOrbs } = useEnergy();
  const [formData, setFormData] = useState({
    name: '',
    gender: 'other' as 'male' | 'female' | 'other',
    birthdayDate: '',
    birthTime: '12:00',
    birthPlace: '',
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
      decreaseOrbs(20);
      queryClient.invalidateQueries({ queryKey: ['/api/natal/external'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      setFormData({ name: '', gender: 'other', birthdayDate: '', birthTime: '12:00', birthPlace: '' });
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
              {locale === 'ru' ? 'Для анализа совместимости (20 звёзд)' : 'For compatibility analysis (20 stars)'}
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
                <OrbIcon className="w-4 h-4 mr-2" />
                {locale === 'ru' ? 'Создать карту (20 звёзд)' : 'Create Chart (20 stars)'}
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
