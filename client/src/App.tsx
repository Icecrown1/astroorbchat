import { Switch, Route, useLocation } from 'wouter';
import { useEffect } from 'react';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { initTelegram } from '@/lib/telegram';
import { useAuth } from '@/store/useAuth';
import NotFound from '@/pages/not-found';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import MyNatalChart from '@/pages/MyNatalChart';
import NatalChart from '@/pages/NatalChart';
import GuestNatalChartView from '@/pages/GuestNatalChartView';
import SolarToday from '@/pages/SolarToday';
import Horoscope from '@/pages/Horoscope';
import Compatibility from '@/pages/Compatibility';
import Ask from '@/pages/Ask';
import BuyEnergy from '@/pages/BuyEnergy';
import Subscribe from '@/pages/Subscribe';
import Referral from '@/pages/Referral';
import Settings from '@/pages/Settings';
import PaymentHistory from '@/pages/PaymentHistory';
import Admin from '@/pages/Admin';

const manifestUrl = `${window.location.origin}/.well-known/tonconnect-manifest.json`;

function Router() {
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    if (!isAuthenticated && location !== '/register') {
      navigate('/register');
    }
  }, [isAuthenticated, location, navigate]);

  return (
    <Switch>
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/my-natal-chart" component={MyNatalChart} />
      <Route path="/natal-chart" component={NatalChart} />
      <Route path="/guest-chart/:id" component={GuestNatalChartView} />
      <Route path="/solar-today" component={SolarToday} />
      <Route path="/horoscope" component={Horoscope} />
      <Route path="/compatibility" component={Compatibility} />
      <Route path="/ask" component={Ask} />
      <Route path="/buy-energy" component={BuyEnergy} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/referral" component={Referral} />
      <Route path="/payment-history" component={PaymentHistory} />
      <Route path="/admin" component={Admin} />
      <Route path="/settings" component={Settings} />
      <Route path="/" component={isAuthenticated ? Dashboard : Register} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <TonConnectUIProvider manifestUrl={manifestUrl}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </TonConnectUIProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

export default App;
