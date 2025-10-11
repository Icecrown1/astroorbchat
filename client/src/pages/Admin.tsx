import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, DollarSign, CreditCard, TrendingUp, Zap, Settings } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function Admin() {
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

  const updateEnergyMutation = useMutation({
    mutationFn: async ({ userId, energy }: { userId: string; energy: number }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/energy`, { energy });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Energy updated successfully" });
      setSelectedUser(null);
      setEnergyAmount("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update energy", description: error.message, variant: "destructive" });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, tier, status }: { userId: string; tier: string; status: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/subscription`, { tier, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Subscription updated successfully" });
      setSelectedUser(null);
      setSubscriptionTier("");
      setSubscriptionStatus("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update subscription", description: error.message, variant: "destructive" });
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
            <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
            <p className="text-muted-foreground mt-1">Manage users and view system statistics</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-users">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">${stats?.totalRevenue || "0.00"}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-subs">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-subs">{stats?.activeSubscriptions || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-payments">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-payments">{stats?.totalPayments || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage all users</CardDescription>
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
                      Energy: <span data-testid={`text-user-energy-${user.id}`}>{user.energy}</span> orbs
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
                          Energy
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Update Energy</DialogTitle>
                          <DialogDescription>Set new energy amount for {user.name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            type="number"
                            placeholder="Energy amount"
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
                            {updateEnergyMutation.isPending ? "Updating..." : "Update Energy"}
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
                          Subscription
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Update Subscription</DialogTitle>
                          <DialogDescription>Manage subscription for {user.name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Select value={subscriptionTier} onValueChange={setSubscriptionTier}>
                            <SelectTrigger data-testid="select-subscription-tier">
                              <SelectValue placeholder="Select tier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
                            <SelectTrigger data-testid="select-subscription-status">
                              <SelectValue placeholder="Select status" />
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
                            {updateSubscriptionMutation.isPending ? "Updating..." : "Update Subscription"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-users">
                  No users found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
