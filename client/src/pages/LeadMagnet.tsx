import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Star, Sparkles, Moon, Sun, ArrowRight, Send } from 'lucide-react';

const leadFormSchema = z.object({
  name: z.string().min(2, 'Введите ваше имя'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Выберите пол' }),
  birthDate: z.string().min(1, 'Введите дату рождения'),
  birthTime: z.string().optional(),
  birthPlace: z.string().min(2, 'Введите место рождения'),
  email: z.string().email('Введите корректный email').optional().or(z.literal('')),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

interface HoroscopeResult {
  leadId: string;
  horoscope: {
    morning: { title: string; description: string };
    afternoon: { title: string; description: string };
    evening: { title: string; description: string };
    overall: { summary: string; keyAdvice: string };
    luckyTime: string;
    luckyColor: string;
  };
  sunSign: string;
  ascendant?: string;
}

export default function LeadMagnet() {
  const [step, setStep] = useState<'form' | 'loading' | 'result'>('form');
  const [result, setResult] = useState<HoroscopeResult | null>(null);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: '',
      gender: undefined,
      birthDate: '',
      birthTime: '',
      birthPlace: '',
      email: '',
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const response = await fetch('/api/lead/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка расчёта');
      }
      return response.json();
    },
    onMutate: () => {
      setStep('loading');
    },
    onSuccess: (data) => {
      setResult(data.data);
      setStep('result');
    },
    onError: (error) => {
      console.error('Calculation error:', error);
      setStep('form');
    },
  });

  const onSubmit = (data: LeadFormData) => {
    calculateMutation.mutate(data);
  };

  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'AstroOrbBot';
  const telegramDeepLink = result ? `https://t.me/${botUsername}?start=lead_${result.leadId}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-chart-1/10 relative overflow-hidden">
      {/* Cosmic background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-chart-1 rounded-full animate-pulse" />
        <div className="absolute top-40 right-20 w-1 h-1 bg-chart-2 rounded-full animate-pulse delay-100" />
        <div className="absolute top-60 left-1/3 w-1.5 h-1.5 bg-chart-3 rounded-full animate-pulse delay-200" />
        <div className="absolute bottom-40 right-1/4 w-2 h-2 bg-chart-4 rounded-full animate-pulse delay-300" />
        <div className="absolute bottom-20 left-20 w-1 h-1 bg-chart-5 rounded-full animate-pulse delay-400" />
      </div>

      <div className="container max-w-lg mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Moon className="w-16 h-16 text-chart-1" />
              <Sparkles className="w-6 h-6 text-chart-3 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-chart-1 via-chart-2 to-chart-3 bg-clip-text text-transparent mb-2">
            Astro Orb
          </h1>
          <p className="text-muted-foreground">
            Персональный гороскоп на сегодня
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card className="p-6 backdrop-blur-sm bg-card/80">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    {/* Name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ваше имя</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Как вас зовут?" 
                              {...field} 
                              data-testid="input-lead-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Gender */}
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Пол</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="female" id="female" data-testid="radio-female" />
                                <Label htmlFor="female" className="cursor-pointer">Женский</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="male" id="male" data-testid="radio-male" />
                                <Label htmlFor="male" className="cursor-pointer">Мужской</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Birth Date */}
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Дата рождения</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              data-testid="input-lead-birthdate"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Birth Time (optional) */}
                    <FormField
                      control={form.control}
                      name="birthTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Время рождения <span className="text-muted-foreground text-xs">(опционально)</span>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              {...field} 
                              data-testid="input-lead-birthtime"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Для более точного прогноза
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Birth Place */}
                    <FormField
                      control={form.control}
                      name="birthPlace"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Место рождения</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Введите город, страну"
                              {...field}
                              data-testid="input-lead-birthplace"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email (optional) */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Email <span className="text-muted-foreground text-xs">(опционально)</span>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="your@email.com" 
                              {...field} 
                              data-testid="input-lead-email"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Для получения персональных прогнозов
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={calculateMutation.isPending}
                      data-testid="button-calculate-horoscope"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Рассчитать гороскоп
                    </Button>
                  </form>
                </Form>
              </Card>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-16"
            >
              <Card className="p-8 backdrop-blur-sm bg-card/80">
                <div className="relative w-32 h-32 mx-auto mb-6">
                  {/* Animated cosmic orb */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-chart-1 via-chart-2 to-chart-3"
                    animate={{
                      rotate: 360,
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
                      scale: { duration: 2, repeat: Infinity },
                    }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full bg-background"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Star className="w-12 h-12 text-chart-1" />
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-xl font-display font-bold mb-2">
                    Считываем звёзды...
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Анализируем положение планет для вашего персонального прогноза
                  </p>
                </motion.div>

                <motion.div 
                  className="mt-6 space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <LoadingStep text="Расчёт натальной карты" delay={0} />
                  <LoadingStep text="Анализ транзитов планет" delay={1} />
                  <LoadingStep text="Составление прогноза" delay={2} />
                </motion.div>
              </Card>
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header with sun sign */}
              <Card className="p-6 backdrop-blur-sm bg-card/80 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <Sun className="w-16 h-16 mx-auto text-chart-3 mb-4" />
                </motion.div>
                <h2 className="text-2xl font-display font-bold mb-1">
                  {form.getValues('name')}, ваш знак — {result.sunSign}
                </h2>
                {result.ascendant && (
                  <p className="text-muted-foreground">
                    Асцендент: {result.ascendant}
                  </p>
                )}
              </Card>

              {/* Overall summary */}
              <Card className="p-6 backdrop-blur-sm bg-gradient-to-br from-chart-1/10 to-chart-2/10">
                <h3 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-chart-3" />
                  Прогноз на сегодня
                </h3>
                <p className="text-foreground/90 leading-relaxed mb-4">
                  {result.horoscope.overall.summary}
                </p>
                <div className="p-4 bg-chart-3/10 rounded-lg">
                  <p className="text-sm font-medium text-chart-3">
                    Ключевой совет: {result.horoscope.overall.keyAdvice}
                  </p>
                </div>
              </Card>

              {/* Time periods */}
              <div className="grid gap-4">
                <TimeCard 
                  title="Утро" 
                  icon="🌅"
                  content={result.horoscope.morning}
                />
                <TimeCard 
                  title="День" 
                  icon="☀️"
                  content={result.horoscope.afternoon}
                />
                <TimeCard 
                  title="Вечер" 
                  icon="🌙"
                  content={result.horoscope.evening}
                />
              </div>

              {/* Lucky info */}
              <Card className="p-4 backdrop-blur-sm bg-card/80">
                <div className="flex justify-around text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Удачное время</p>
                    <p className="font-medium">{result.horoscope.luckyTime}</p>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Удачный цвет</p>
                    <p className="font-medium">{result.horoscope.luckyColor}</p>
                  </div>
                </div>
              </Card>

              {/* CTA to Telegram */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="p-6 backdrop-blur-sm bg-gradient-to-r from-primary/20 to-chart-2/20 border-primary/30">
                  <div className="text-center">
                    <h3 className="text-lg font-display font-bold mb-2">
                      Хотите больше?
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Получите полный разбор натальной карты, еженедельные прогнозы и персональные советы в нашем приложении
                    </p>
                    <Button 
                      asChild 
                      className="w-full"
                      data-testid="button-open-telegram"
                    >
                      <a href={telegramDeepLink} target="_blank" rel="noopener noreferrer">
                        <Send className="w-4 h-4 mr-2" />
                        Открыть в Telegram
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LoadingStep({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-2 text-sm text-muted-foreground"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay * 0.5 + 0.5 }}
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-chart-1"
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: delay * 0.3 }}
      />
      {text}
    </motion.div>
  );
}

function TimeCard({ 
  title, 
  icon, 
  content 
}: { 
  title: string; 
  icon: string;
  content: { title: string; description: string };
}) {
  return (
    <Card className="p-4 backdrop-blur-sm bg-card/80">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h4 className="font-medium mb-1">{title}: {content.title}</h4>
          <p className="text-sm text-muted-foreground">{content.description}</p>
        </div>
      </div>
    </Card>
  );
}
