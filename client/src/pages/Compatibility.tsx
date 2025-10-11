import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Heart } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useEnergy } from '@/store/useEnergy';

const compatibilitySchema = z.object({
  partnerName: z.string().min(1, 'Partner name is required'),
  partnerDate: z.string().min(1, 'Birth date is required'),
  partnerTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  partnerPlace: z.string().optional(),
});

export default function Compatibility() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { decreaseEnergy } = useEnergy();
  const [compatibilityData, setCompatibilityData] = useState<any>(null);

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
      });
      if (!response.ok) throw new Error(response.error || 'Failed to generate compatibility analysis');
      return response.data;
    },
    onSuccess: (data) => {
      setCompatibilityData(data);
      decreaseEnergy(2);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: 'Compatibility Analysis Complete',
        description: 'Your relationship insights are ready',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Please try again',
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
            <h1 className="text-2xl font-display font-bold">Compatibility</h1>
            <p className="text-muted-foreground">Analyze your relationship</p>
          </div>
        </div>

        {!compatibilityData && (
          <Card className="p-6">
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-chart-5/20 to-chart-2/20 mb-4">
                <Heart className="w-12 h-12 text-chart-5" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Relationship Analysis</h2>
              <p className="text-muted-foreground mb-4">
                Discover the cosmic dynamics between you and another person
              </p>
              <p className="text-sm text-primary font-medium mb-6">
                Cost: 2 Energy Orbs
              </p>
            </div>

            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <div>
                <Label htmlFor="partnerName">Partner's Name</Label>
                <Input
                  id="partnerName"
                  {...form.register('partnerName')}
                  placeholder="Enter partner's name"
                  data-testid="input-partner-name"
                />
                {form.formState.errors.partnerName && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.partnerName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="partnerDate">Birth Date</Label>
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
                <Label htmlFor="partnerTime">Birth Time (Optional)</Label>
                <Input
                  id="partnerTime"
                  type="time"
                  {...form.register('partnerTime')}
                  data-testid="input-partner-time"
                />
              </div>

              <div>
                <Label htmlFor="partnerPlace">Birth Place (Optional)</Label>
                <Input
                  id="partnerPlace"
                  {...form.register('partnerPlace')}
                  placeholder="City, Country"
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
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 mr-2" />
                    Analyze Compatibility
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
                <h2 className="text-lg font-semibold">Compatibility Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  {compatibilityData.partners || 'You and your partner'}
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
                <h2 className="text-lg font-semibold mb-4">Strengths</h2>
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
                <h2 className="text-lg font-semibold mb-4">Challenges</h2>
                <div className="space-y-2">
                  {compatibilityData.challenges.map((challenge: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-chart-4/10 border border-chart-4/20"
                    >
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
              Analyze Another Relationship
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
