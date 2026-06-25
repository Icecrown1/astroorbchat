import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, DollarSign, CreditCard, TrendingUp, Zap, Settings, AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LocaleContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminStats {
  totalUsers: number;
  totalRevenue: string;
  activeSubscriptions: number;
  totalPayments: number;
  recentUsers: any[];
}

interface User {
  id: string;
  name: string;
  email?: string;
  energy: number;
  createdAt: string;
}

interface PendingPayment {
  id: string;
  userId: string;
  userName: string;
  kind: string;
  amountRUB: string;
  status: string;
  yookassaPaymentId: string | null;
  createdAt: string;
}

interface WebhookError {
  id: string;
  paymentId: string | null;
  provider: string;
  errorMessage: string;
  createdAt: string;
}

export default function Admin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [energyAmount, setEnergyAmount] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ ok: boolean; data: AdminStats }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ ok: boolean; data: User[] }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: pendingPaymentsData, isLoading: pendingLoading, refetch: refetchPending } = useQuery<{ ok: boolean; payments: PendingPayment[] }>({
    queryKey: ["/api/admin/payments/pending"],
  });

  const { data: webhookErrorsData, isLoading: errorsLoading, refetch: refetchErrors } = useQuery<{ ok: boolean; errors: WebhookError[] }>({
    queryKey: ["/api/admin/payments/webhook-errors"],
  });

  const updateEnergyMutation = useMutation({
    mutationFn: async ({ userId, energy }: { userId: string; energy: number }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/energy`, { energy });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: t.admin.energyUpdatedSuccess });
      setSelectedUser(null);
      setEnergyAmount("");
    },
    onError: (error: any) => {
      toast({ title: t.admin.energyUpdateFailed, description: error.message, variant: "destructive" });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, tier, status }: { userId: string; tier: string; status: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/subscription`, { tier, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: t.admin.subscriptionUpdatedSuccess });
      setSelectedUser(null);
      setSubscriptionTier("");
      setSubscriptionStatus("");
    },
    onError: (error: any) => {
      toast({ title: t.admin.subscriptionUpdateFailed, description: error.message, variant: "destructive" });
    },
  });

  const handleForceActivate = async (payment: PendingPayment) => {
    if (!payment.yookassaPaymentId) {
      toast({ title: t.admin.forceActivateFailed, description: "No YooKassa payment ID available", variant: "destructive" });
      return;
    }
    setActivatingId(payment.id);
    try {
      await apiRequest("POST", "/api/admin/payments/force-activate", {
        userId: payment.userId,
        yookassaPaymentId: payment.yookassaPaymentId,
      });
      toast({ title: t.admin.forceActivateSuccess });
      refetchPending();
    } catch (error: any) {
      toast({ title: t.admin.forceActivateFailed, description: error.message, variant: "destructive" });
    } finally {
      setActivatingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString();

  if (statsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-admin" />
      </div>
    );
  }

  const stats = statsData?.data;
  const users = usersData?.data || [];
  const pendingPayments = pendingPaymentsData?.payments || [];
  const webhookErrors = webhookErrorsData?.errors || [];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-admin-title">{t.admin.title}</h1>
            <p className="text-muted-foreground mt-1">{t.admin.subtitle}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-users">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.admin.totalUsers}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.admin.totalRevenue}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">${stats?.totalRevenue || "0.00"}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-subs">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.admin.activeSubscriptions}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-subs">{stats?.activeSubscriptions || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-payments">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.admin.totalPayments}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-payments">{stats?.totalPayments || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" data-testid="admin-tabs">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              {t.admin.tabUsers}
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="h-4 w-4 mr-2" />
              {t.admin.tabPayments}
              {pendingPayments.length > 0 && (
                <Badge className="ml-2" data-testid="badge-pending-count">
                  {pendingPayments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.admin.userManagement}</CardTitle>
                <CardDescription>{t.admin.viewManageUsers}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                      data-testid={`user-row-${user.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium" data-testid={`text-user-name-${user.id}`}>{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.common.energy}: <span data-testid={`text-user-energy-${user.id}`}>{user.energy}</span> {t.common.orbs}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUser(user)}
                              data-testid={`button-edit-energy-${user.id}`}
                            >
                              <Zap className="h-4 w-4 mr-1" />
                              {t.common.energy}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t.admin.updateEnergy}</DialogTitle>
                              <DialogDescription>{t.admin.setEnergyAmount} {user.name}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <Input
                                type="number"
                                placeholder={t.common.energy}
                                value={energyAmount}
                                onChange={(e) => setEnergyAmount(e.target.value)}
                                data-testid="input-energy-amount"
                              />
                              <Button
                                className="w-full"
                                onClick={() => {
                                  if (selectedUser && energyAmount) {
                                    updateEnergyMutation.mutate({
                                      userId: selectedUser.id,
                                      energy: parseInt(energyAmount),
                                    });
                                  }
                                }}
                                disabled={updateEnergyMutation.isPending}
                                data-testid="button-save-energy"
                              >
                                {updateEnergyMutation.isPending ? t.admin.updating : t.admin.updateEnergy}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUser(user)}
                              data-testid={`button-edit-subscription-${user.id}`}
                            >
                              <Settings className="h-4 w-4 mr-1" />
                              {t.common.subscription}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t.admin.updateSubscription}</DialogTitle>
                              <DialogDescription>{t.admin.manageSubscription} {user.name}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <Select value={subscriptionTier} onValueChange={setSubscriptionTier}>
                                <SelectTrigger data-testid="select-subscription-tier">
                                  <SelectValue placeholder={t.admin.selectTier} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="standard">{t.subscribe.standard}</SelectItem>
                                  <SelectItem value="pro">{t.subscribe.pro}</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
                                <SelectTrigger data-testid="select-subscription-status">
                                  <SelectValue placeholder={t.admin.selectStatus} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                              </Select>

                              <Button
                                className="w-full"
                                onClick={() => {
                                  if (selectedUser && subscriptionTier && subscriptionStatus) {
                                    updateSubscriptionMutation.mutate({
                                      userId: selectedUser.id,
                                      tier: subscriptionTier,
                                      status: subscriptionStatus,
                                    });
                                  }
                                }}
                                disabled={updateSubscriptionMutation.isPending}
                                data-testid="button-save-subscription"
                              >
                                {updateSubscriptionMutation.isPending ? t.admin.updating : t.admin.updateSubscription}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground" data-testid="text-no-users">
                      {t.admin.noUsers}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle>{t.admin.pendingPayments}</CardTitle>
                    <CardDescription className="mt-1">{t.admin.pendingPaymentsDesc}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPending()}
                    disabled={pendingLoading}
                    data-testid="button-refresh-pending"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${pendingLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingPayments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground" data-testid="text-no-pending">
                    {t.admin.noPendingPayments}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-wrap items-start justify-between gap-3 p-4 rounded-lg border"
                        data-testid={`payment-row-${payment.id}`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-payment-user-${payment.id}`}>
                              {payment.userName}
                            </span>
                            <Badge variant="outline" data-testid={`badge-payment-kind-${payment.id}`}>
                              {payment.kind}
                            </Badge>
                            <Badge variant="secondary" data-testid={`badge-payment-status-${payment.id}`}>
                              {payment.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">{payment.amountRUB} ₽</span>
                            {" · "}
                            {formatDate(payment.createdAt)}
                          </p>
                          {payment.yookassaPaymentId && (
                            <p className="text-xs text-muted-foreground font-mono truncate" data-testid={`text-payment-ykid-${payment.id}`}>
                              YK: {payment.yookassaPaymentId}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground font-mono truncate" data-testid={`text-payment-id-${payment.id}`}>
                            ID: {payment.id}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleForceActivate(payment)}
                          disabled={activatingId === payment.id || !payment.yookassaPaymentId}
                          data-testid={`button-force-activate-${payment.id}`}
                        >
                          {activatingId === payment.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              {t.admin.forceActivating}
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-1" />
                              {t.admin.forceActivate}
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      {t.admin.webhookErrors}
                    </CardTitle>
                    <CardDescription className="mt-1">{t.admin.webhookErrorsDesc}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchErrors()}
                    disabled={errorsLoading}
                    data-testid="button-refresh-errors"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${errorsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {errorsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : webhookErrors.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground" data-testid="text-no-webhook-errors">
                    {t.admin.noWebhookErrors}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webhookErrors.map((err) => (
                      <div
                        key={err.id}
                        className="p-4 rounded-lg border space-y-2"
                        data-testid={`webhook-error-row-${err.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" data-testid={`badge-error-provider-${err.id}`}>
                              {err.provider}
                            </Badge>
                            <span className="text-xs text-muted-foreground" data-testid={`text-error-time-${err.id}`}>
                              {formatDate(err.createdAt)}
                            </span>
                          </div>
                          {err.paymentId && (
                            <span className="text-xs text-muted-foreground font-mono" data-testid={`text-error-payment-id-${err.id}`}>
                              {err.paymentId}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-destructive" data-testid={`text-error-message-${err.id}`}>
                          {err.errorMessage}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
