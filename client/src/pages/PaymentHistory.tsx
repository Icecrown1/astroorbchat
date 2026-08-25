import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, Wallet, Calendar, TrendingUp, ArrowUpRight, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LocaleContext";

interface Payment {
  id: string;
  kind: string;
  tier?: string | null;
  energyAmount?: number | null;
  amountRUB: number | null;
  amountTON: string | null;
  amountStars?: number | null;
  txHash: string | null;
  yookassaPaymentId: string | null;
  paymentMethod: 'ton' | 'yookassa' | 'stars';
  status: string;
  createdAt: string;
}

export default function PaymentHistory() {
  const [, navigate] = useLocation();
  const { t, locale } = useTranslation();
  const { data, isLoading, error } = useQuery<{ ok: boolean; data: Payment[] }>({
    queryKey: ["/api/payments/history"],
  });

  const getPaymentIcon = (kind: string) => {
    if (kind === "subscription") return <TrendingUp className="h-4 w-4" />;
    if (kind === "energy" || kind === "energy_pack") return <Wallet className="h-4 w-4" />;
    return <Receipt className="h-4 w-4" />;
  };

  const getPaymentLabel = (payment: Payment) => {
    if (payment.kind === "subscription") {
      return `${payment.tier?.toUpperCase()} ${t.paymentHistory.subscription}`;
    }
    if (payment.kind === "energy" || payment.kind === "energy_pack") {
      return `${payment.energyAmount} ${t.paymentHistory.energyOrbs}`;
    }
    return payment.kind;
  };

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const getStatusColor = (status: string, createdAt: string) => {
    switch (status) {
      case "completed":
      case "confirmed":
      case "succeeded":
        return "default";
      case "waiting_for_capture":
        return "secondary";
      case "canceled":
        return "outline";
      case "pending": {
        const isOld = Date.now() - new Date(createdAt).getTime() > ONE_DAY_MS;
        return isOld ? "destructive" : "secondary";
      }
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string, createdAt: string) => {
    switch (status) {
      case "succeeded":
      case "completed":
        return t.paymentHistory.completed;
      case "waiting_for_capture":
        return t.paymentHistory.pending;
      case "canceled":
        return (t.paymentHistory as any).canceled ?? "Отменён";
      case "confirmed":
        return t.paymentHistory.confirmed;
      case "pending": {
        const isOld = Date.now() - new Date(createdAt).getTime() > ONE_DAY_MS;
        return isOld
          ? (locale === 'ru' ? 'Не завершён' : 'Not completed')
          : t.paymentHistory.pending;
      }
      case "failed":
        return t.paymentHistory.failed;
      default:
        return status;
    }
  };

  const openTxExplorer = (txHash: string) => {
    if (txHash.startsWith("pending_")) return;
    window.open(`https://tonviewer.com/transaction/${txHash}`, "_blank");
  };

  const isCompleted = (status: string) => {
    return status === "completed" || status === "confirmed" || status === "succeeded";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-payments" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-destructive font-medium" data-testid="text-error">
                  {t.paymentHistory.loadFailed}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t.paymentHistory.tryAgainLater}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const payments = data?.data || [];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">{t.paymentHistory.title}</h1>
            <p className="text-muted-foreground mt-1" data-testid="text-page-description">
              {t.paymentHistory.viewAll}
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-payments">
                  {t.paymentHistory.noPayments}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t.paymentHistory.noPurchases}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <Card key={payment.id} className="hover-elevate" data-testid={`card-payment-${payment.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {getPaymentIcon(payment.kind)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base" data-testid={`text-payment-label-${payment.id}`}>
                          {getPaymentLabel(payment)}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          <span data-testid={`text-payment-date-${payment.id}`}>
                            {format(new Date(payment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(payment.status, payment.createdAt)} data-testid={`badge-status-${payment.id}`}>
                      {getStatusLabel(payment.status, payment.createdAt)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.paymentHistory.amount}</span>
                    <div className="flex items-center gap-3">
                      {payment.paymentMethod === 'yookassa' && payment.amountRUB && (
                        <span className="font-medium" data-testid={`text-amount-rub-${payment.id}`}>
                          {payment.amountRUB} ₽
                        </span>
                      )}
                      {payment.paymentMethod === 'stars' && payment.amountStars && (
                        <span className="font-medium" data-testid={`text-amount-stars-${payment.id}`}>
                          {payment.amountStars} ⭐
                        </span>
                      )}
                      {payment.paymentMethod === 'ton' && payment.amountTON && (
                        <span className="font-medium" data-testid={`text-amount-ton-${payment.id}`}>
                          {parseFloat(payment.amountTON).toFixed(2)} TON
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.paymentHistory.paymentMethod || 'Payment Method'}</span>
                    <Badge variant="outline" data-testid={`badge-method-${payment.id}`}>
                      {payment.paymentMethod === 'ton' ? 'TON' : payment.paymentMethod === 'stars' ? 'Telegram Stars' : t.paymentHistory.bankCard || 'Bank Card'}
                    </Badge>
                  </div>
                  
                  {isCompleted(payment.status) && payment.paymentMethod === 'ton' && payment.txHash && !payment.txHash.startsWith("pending_") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => openTxExplorer(payment.txHash!)}
                      data-testid={`button-view-tx-${payment.id}`}
                    >
                      <span>{t.paymentHistory.viewOnBlockchain}</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
