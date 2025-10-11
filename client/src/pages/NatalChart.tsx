import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartCanvas } from '@/components/ChartCanvas';
import { Loader } from '@/components/Loader';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function NatalChart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [chartData, setChartData] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/astrology/natal', {});
      return response.data;
    },
    onSuccess: (data) => {
      setChartData(data);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: 'Natal Chart Generated',
        description: 'Your cosmic blueprint is ready',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
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
            <h1 className="text-2xl font-display font-bold">Natal Chart</h1>
            <p className="text-muted-foreground">Your cosmic blueprint</p>
          </div>
        </div>

        {!chartData && (
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Generate Your Natal Chart</h2>
              <p className="text-muted-foreground mb-4">
                Discover the planetary positions at the moment of your birth
              </p>
              <p className="text-sm text-primary font-medium">
                Cost: 2 Energy Orbs
              </p>
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              size="lg"
              data-testid="button-generate-natal"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  Calculating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Chart
                </>
              )}
            </Button>
          </Card>
        )}

        {chartData && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Chart Visualization</h2>
              <ChartCanvas
                planets={chartData.planets || []}
                aspects={chartData.aspects || []}
              />
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Interpretation</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {chartData.interpretation}
                </p>
              </div>
            </Card>

            {chartData.planets && chartData.planets.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Planetary Positions</h2>
                <Accordion type="single" collapsible>
                  {chartData.planets.map((planet: any, index: number) => (
                    <AccordionItem key={index} value={`planet-${index}`}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{planet.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {planet.sign} {planet.position.toFixed(2)}°
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-muted-foreground">
                          {planet.meaning || 'Planetary influence in your chart'}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            )}

            {chartData.aspects && chartData.aspects.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Major Aspects</h2>
                <div className="space-y-2">
                  {chartData.aspects.map((aspect: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted"
                    >
                      <span className="text-sm">
                        {aspect.planet1} {aspect.type} {aspect.planet2}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {aspect.angle.toFixed(1)}°
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setChartData(null)}
              data-testid="button-regenerate"
            >
              Generate New Chart
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
