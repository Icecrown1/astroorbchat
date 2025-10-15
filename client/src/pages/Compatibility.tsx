import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Heart, HeartCrack, UserPlus, Users } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';

interface GuestChart {
  id: string;
  name: string;
  gender: string;
  birthdayDate: string;
  birthTime?: string | null;
}

export default function Compatibility() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [compatibilityData, setCompatibilityData] = useState<any>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const { data: guestCharts } = useQuery<{ ok: boolean; data: GuestChart[] }>({
    queryKey: ['/api/natal/external'],
  });

  const compatibilitySchema = useMemo(() => z.object({
    partnerName: z.string().min(1, locale === 'ru' ? 'Имя партнера обязательно' : 'Partner name is required'),
    partnerDate: z.string().min(1, locale === 'ru' ? 'Дата рождения партнера обязательна' : 'Partner birth date is required'),
    partnerTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
    partnerPlace: z.string().optional(),
  }), [locale]);

  const form = useForm({
    resolver: zodResolver(compatibilitySchema),
    defaultValues: {
      partnerName: '',
      partnerDate: '',
      partnerTime: '',
      partnerPlace: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/astrology/compatibility', {
        partner: {
          name: data.partnerName,
          date: data.partnerDate,
          time: data.partnerTime || null,
          place: data.partnerPlace || null,
        },
        locale,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setCompatibilityData(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.compatibility.complete,
        description: t.compatibility.completeDesc,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.compatibility.failed,
        description: error.message || t.compatibility.tryAgain,
        variant: 'destructive',
      });
    },
  });

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
            <h1 className="text-2xl font-display font-bold">{t.nav.compatibility}</h1>
            <p className="text-muted-foreground">{t.compatibility.analyzeRelationship}</p>
          </div>
        </div>

        {!compatibilityData && (
          <Card className="p-6">
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-chart-5/20 to-chart-2/20 mb-4">
                <Heart className="w-12 h-12 text-chart-5" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t.compatibility.relationshipAnalysis}</h2>
              <p className="text-muted-foreground mb-4">
                {t.compatibility.cosmicDynamics}
              </p>
              <p className="text-sm text-primary font-medium mb-6">
                {t.compatibility.cost}
              </p>
            </div>

            {guestCharts?.data && guestCharts.data.length > 0 && (
              <div className="mb-6">
                <Label className="mb-2 block">
                  {locale === 'ru' ? 'Выбрать из сохранённых' : 'Select from saved'}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {guestCharts.data.map((chart) => (
                    <Button
                      key={chart.id}
                      type="button"
                      variant={selectedGuestId === chart.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedGuestId(chart.id);
                        form.setValue('partnerName', chart.name);
                        form.setValue('partnerDate', chart.birthdayDate);
                        form.setValue('partnerTime', chart.birthTime || '');
                      }}
                      data-testid={`button-select-guest-${chart.id}`}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {chart.name}
                    </Button>
                  ))}
                  {selectedGuestId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedGuestId(null);
                        form.reset();
                      }}
                    >
                      {locale === 'ru' ? 'Очистить' : 'Clear'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <div>
                <Label htmlFor="partnerName">{t.compatibility.partnerName}</Label>
                <Input
                  id="partnerName"
                  {...form.register('partnerName')}
                  placeholder={t.compatibility.partnerNamePlaceholder}
                  data-testid="input-partner-name"
                />
                {form.formState.errors.partnerName && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.partnerName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="partnerDate">{t.auth.birthDate}</Label>
                <Input
                  id="partnerDate"
                  type="date"
                  {...form.register('partnerDate')}
                  data-testid="input-partner-date"
                />
                {form.formState.errors.partnerDate && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.partnerDate.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="partnerTime">{t.auth.birthTime}</Label>
                <Input
                  id="partnerTime"
                  type="time"
                  {...form.register('partnerTime')}
                  data-testid="input-partner-time"
                />
              </div>

              <div>
                <Label htmlFor="partnerPlace">{t.compatibility.partnerBirthPlace}</Label>
                <Input
                  id="partnerPlace"
                  {...form.register('partnerPlace')}
                  placeholder={t.compatibility.placePlaceholder}
                  data-testid="input-partner-place"
                />
              </div>

              <Button
                type="submit"
                disabled={mutation.isPending}
                size="lg"
                className="w-full"
                data-testid="button-analyze-compatibility"
              >
                {mutation.isPending ? (
                  <>
                    <Loader className="mr-2" size="sm" />
                    {t.compatibility.analyzing}
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 mr-2" />
                    {t.compatibility.analyze}
                  </>
                )}
              </Button>
            </form>
          </Card>
        )}

        {compatibilityData && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-4">
                <h1 className="text-2xl font-display font-bold mb-2">
                  {compatibilityData.partners || t.compatibility.youAndPartner}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t.compatibility.result}
                </p>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {compatibilityData.analysis}
                </p>
              </div>
            </Card>

            {compatibilityData.strengths && compatibilityData.strengths.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">{t.compatibility.strengths}</h2>
                <div className="space-y-2">
                  {compatibilityData.strengths.map((strength: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-chart-3/10 border border-chart-3/20"
                    >
                      <Heart className="w-4 h-4 text-chart-3 shrink-0 mt-0.5" />
                      <p className="text-sm">{strength}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {compatibilityData.challenges && compatibilityData.challenges.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">{t.compatibility.challenges}</h2>
                <div className="space-y-2">
                  {compatibilityData.challenges.map((challenge: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-chart-4/10 border border-chart-4/20"
                    >
                      <HeartCrack className="w-4 h-4 text-chart-4 shrink-0 mt-0.5" />
                      <p className="text-sm">{challenge}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCompatibilityData(null);
                form.reset();
              }}
              data-testid="button-new-analysis"
            >
              {t.compatibility.analyzeAnother}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
