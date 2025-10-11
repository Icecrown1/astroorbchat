import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/Loader';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LocaleContext';

export default function Ask() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [answer, setAnswer] = useState<string | null>(null);

  const askSchema = useMemo(() => z.object({
    question: z.string()
      .min(1, locale === 'ru' ? 'Пожалуйста, введите ваш вопрос' : 'Please enter your question')
      .min(10, locale === 'ru' ? 'Вопрос должен содержать минимум 10 символов' : 'Question must be at least 10 characters'),
  }), [locale]);

  const form = useForm({
    resolver: zodResolver(askSchema),
    defaultValues: {
      question: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/astrology/ask', {
        question: data.question,
        locale,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setAnswer(data.answer);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      toast({
        title: t.ask.answerReceived,
        description: t.ask.answerReady,
      });
    },
    onError: (error: any) => {
      toast({
        title: t.ask.requestFailed,
        description: error.message || t.ask.tryAgain,
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
            <h1 className="text-2xl font-display font-bold">{t.ask.askAI}</h1>
            <p className="text-muted-foreground">{t.ask.getInsights}</p>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="mb-6">
            <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 mb-4">
              <MessageCircle className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t.ask.askYourQuestion}</h2>
            <p className="text-muted-foreground mb-4">
              {t.ask.aiInsights}
            </p>
            <p className="text-sm text-primary font-medium mb-6">
              {t.ask.costOne}
            </p>
          </div>

          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div>
              <Label htmlFor="question">{t.ask.yourQuestion}</Label>
              <Textarea
                id="question"
                {...form.register('question')}
                placeholder={t.ask.questionPlaceholder}
                rows={6}
                data-testid="textarea-question"
              />
              {form.formState.errors.question && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.question.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={mutation.isPending}
              size="lg"
              className="w-full"
              data-testid="button-ask-question"
            >
              {mutation.isPending ? (
                <>
                  <Loader className="mr-2" size="sm" />
                  {t.ask.thinking}
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t.ask.getAnswer}
                </>
              )}
            </Button>
          </form>
        </Card>

        {answer && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">{t.ask.cosmicGuidance}</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {answer}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => {
                setAnswer(null);
                form.reset();
              }}
              data-testid="button-ask-another"
            >
              {t.ask.askAnother}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
