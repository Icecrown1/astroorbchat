import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, DollarSign, CreditCard, TrendingUp, Zap, Settings, Star, TrendingDown, ExternalLink, AlertCircle, Clock } from "lucide-react";
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

interface StarsBalanceResponse {
  ok: boolean;
  balance: number;
  totalIncoming: number;
  totalOutgoing: number;
  transactionCount: number;
  minimumWithdrawal: number;
  conversionRate: number;
}

export default function Admin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [energyAmount, setEnergyAmount] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");

  const { data: statsData, isLoading: statsLoading } = useQuery<{ ok: boolean; data: AdminStats }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ ok: boolean; data: User[] }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: starsBalanceData, isLoading: starsBalanceLoading } = useQuery<StarsBalanceResponse>({
    queryKey: ["/api/admin/stars/balance"],
    retry: false,
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

  if (statsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-admin" />
      </div>
    );
  }

  const stats = statsData?.data;
  const users = usersData?.data || [];

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

        {/* Stars Revenue Management */}
        <Card data-testid="card-stars-balance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Баланс Telegram Stars
            </CardTitle>
            <CardDescription>
              Управление доходами от Stars платежей
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {starsBalanceLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : starsBalanceData?.ok ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Текущий баланс</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold" data-testid="text-stars-balance">
                        {starsBalanceData.balance.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        Stars
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ≈ ${(starsBalanceData.balance * starsBalanceData.conversionRate).toFixed(2)} USD
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Получено
                      </span>
                      <span className="font-mono text-sm" data-testid="text-stars-incoming">
                        {starsBalanceData.totalIncoming.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                        Выведено
                      </span>
                      <span className="font-mono text-sm" data-testid="text-stars-outgoing">
                        {starsBalanceData.totalOutgoing.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-sm flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Курс
                      </span>
                      <span className="text-sm">${starsBalanceData.conversionRate} / Star</span>
                    </div>
                  </div>
                </div>

                {/* Withdrawal Status */}
                <div className="pt-4 border-t">
                  {starsBalanceData.balance >= starsBalanceData.minimumWithdrawal ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-green-600 dark:text-green-400">
                        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Вывод доступен
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ваш баланс превышает минимум {starsBalanceData.minimumWithdrawal} Stars
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <div className="text-sm space-y-1">
                          <p className="font-medium">Как вывести Stars:</p>
                          <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-2">
                            <li>Откройте @BotFather в Telegram</li>
                            <li>/mybots → Выберите бот → Bot Settings</li>
                            <li>Нажмите "Balance" ⭐</li>
                            <li>Нажмите "Withdraw"</li>
                            <li>Введите адрес TON кошелька на Fragment</li>
                          </ol>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => window.open('https://t.me/BotFather', '_blank')}
                          data-testid="button-open-botfather"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Открыть @BotFather
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Недостаточно для вывода
                        </p>
                        <p className="text-xs">
                          Минимум: {starsBalanceData.minimumWithdrawal} Stars
                          <br />
                          Осталось: {(starsBalanceData.minimumWithdrawal - starsBalanceData.balance).toLocaleString()} Stars
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Не удалось загрузить данные о Stars</p>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}
