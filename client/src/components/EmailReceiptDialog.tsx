import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';
import { useTranslation } from '@/contexts/LocaleContext';

interface EmailReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (email: string | undefined) => void;
  amount: string;
  description: string;
}

const formSchema = z.object({
  wantsReceipt: z.boolean(),
  email: z.string().email().optional().or(z.literal('')),
});

export function EmailReceiptDialog({
  open,
  onOpenChange,
  onConfirm,
  amount,
  description,
}: EmailReceiptDialogProps) {
  const { locale } = useTranslation();
  const isRussian = locale === 'ru';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      wantsReceipt: false,
      email: '',
    },
  });

  const wantsReceipt = form.watch('wantsReceipt');

  const handleConfirm = (values: z.infer<typeof formSchema>) => {
    // Only send email if checkbox is checked AND email is non-empty
    // Otherwise send undefined so backend uses synthetic email
    const finalEmail = values.wantsReceipt && values.email ? values.email : undefined;
    onConfirm(finalEmail);
    onOpenChange(false);
    // Reset form
    form.reset();
  };

  const handleCancel = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) form.reset();
    }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-email-receipt">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {isRussian ? 'Оплата картой' : 'Card Payment'}
          </DialogTitle>
          <DialogDescription>
            {isRussian
              ? `Вы оплачиваете: ${description} — ${amount}`
              : `You are paying: ${description} — ${amount}`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <FormField
                control={form.control}
                name="wantsReceipt"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          id="wantsReceipt"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1 h-4 w-4 rounded border-input cursor-pointer"
                          data-testid="checkbox-wants-receipt"
                        />
                      </FormControl>
                      <div className="flex-1">
                        <Label htmlFor="wantsReceipt" className="cursor-pointer font-normal">
                          {isRussian
                            ? 'Получить чек на email (необязательно)'
                            : 'Receive receipt via email (optional)'}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isRussian
                            ? 'ЮКасса автоматически отправит чек на указанную почту'
                            : 'YooKassa will automatically send the receipt to the specified email'}
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {wantsReceipt && (
              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: wantsReceipt,
                  validate: (value) => {
                    if (!wantsReceipt) return true;
                    if (!value || value.trim() === '') {
                      return isRussian ? 'Введите email' : 'Enter email';
                    }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                      return isRussian ? 'Неверный формат email' : 'Invalid email format';
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isRussian ? 'Ваш email' : 'Your email'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={isRussian ? 'example@mail.ru' : 'example@email.com'}
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                {isRussian
                  ? 'После нажатия кнопки вы будете перенаправлены на защищенную страницу оплаты ЮКасса'
                  : 'After clicking the button, you will be redirected to the secure YooKassa payment page'}
              </p>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel-payment"
              >
                {isRussian ? 'Отмена' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                data-testid="button-continue-payment"
              >
                {isRussian ? 'Продолжить к оплате' : 'Continue to payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
