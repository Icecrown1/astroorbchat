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
import { ArrowLeft, Save, LogOut, Trash2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/store/useAuth';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(timezone);

const TIMEZONES = Intl.supportedValuesOf('timeZone');

const settingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  gender: z.enum(['male', 'female', 'other']),
  age: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(150)),
  birthdayDate: z.string().min(1, 'Birth date is required'),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  birthPlace: z.string().optional(),
  timezone: z.string(),
});

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, updateUser, clearAuth } = useAuth();

  const handleLogoutAndClear = () => {
    clearAuth();
    queryClient.clear();
    toast({
      title: 'Logged Out',
      description: 'You can now test registration again',
    });
    navigate('/register');
  };

  const { data, isLoading } = useQuery({
    queryKey: ['/api/user/me'],
  });

  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: user?.name || '',
      gender: (user?.gender as any) || 'other',
      age: user?.age?.toString() || '',
      birthdayDate: user?.birthdayDate ? dayjs(user.birthdayDate).format('YYYY-MM-DD') : '',
      birthTime: user?.birthTime || '',
      birthPlace: user?.birthPlace || '',
      timezone: user?.timezone || dayjs.tz.guess(),
    },
  });

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
        title: 'Settings Updated',
        description: 'Your profile has been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Please try again',
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
            <h1 className="text-2xl font-display font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your profile</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter your name"
                data-testid="input-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                onValueChange={(value) => form.setValue('gender', value as any)}
                defaultValue={user?.gender || 'other'}
              >
                <SelectTrigger id="gender" data-testid="select-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                {...form.register('age')}
                placeholder="Enter your age"
                data-testid="input-age"
              />
              {form.formState.errors.age && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.age.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="birthdayDate">Birth Date</Label>
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
              <Label htmlFor="birthTime">Birth Time (Optional)</Label>
              <Input
                id="birthTime"
                type="time"
                {...form.register('birthTime')}
                data-testid="input-birthtime"
              />
            </div>

            <div>
              <Label htmlFor="birthPlace">Birth Place (Optional)</Label>
              <Input
                id="birthPlace"
                {...form.register('birthPlace')}
                placeholder="City, Country"
                data-testid="input-birthplace"
              />
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                onValueChange={(value) => form.setValue('timezone', value)}
                defaultValue={user?.timezone || dayjs.tz.guess()}
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </Card>

        {!import.meta.env.PROD && (
          <Card className="p-6 mt-6 border-destructive/50">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-destructive">Development Panel</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tools for testing and development
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
                Logout & Clear Data
              </Button>
              <p className="text-xs text-muted-foreground">
                This will log you out and clear all local data. Use this to test registration again.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
