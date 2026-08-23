import { Switch, Route, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { initTelegram } from '@/lib/telegram';
import { useAuth } from '@/store/useAuth';
import { useEnergy } from '@/store/useEnergy';
import NotFound from '@/pages/not-found';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import MyNatalChart from '@/pages/MyNatalChart';
import NatalChart from '@/pages/NatalChart';
import GuestNatalChartView from '@/pages/GuestNatalChartView';
import SolarToday from '@/pages/SolarToday';
import Horoscope from '@/pages/Horoscope';
import Compatibility from '@/pages/Compatibility';
import Matrix from '@/pages/Matrix';
import Ask from '@/pages/Ask';
import BuyEnergy from '@/pages/BuyEnergy';
import Subscribe from '@/pages/Subscribe';
import Referral from '@/pages/Referral';
import Settings from '@/pages/Settings';
import PaymentHistory from '@/pages/PaymentHistory';
import Admin from '@/pages/Admin';
import Archive from '@/pages/Archive';
import Legal from '@/pages/Legal';
import PaymentSuccess from '@/pages/PaymentSuccess';
import LeadMagnet from '@/pages/LeadMagnet';

const manifestUrl = `${window.location.origin}/.well-known/tonconnect-manifest.json`;

function Router() {
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    // Public routes that don't require authentication
    const publicRoutes = ['/register', '/login', '/legal', '/lead'];
    const isPublicRoute = publicRoutes.includes(location) || location.startsWith('/payment-success');
    
    if (!isAuthenticated && !isPublicRoute) {
      navigate('/login');
    }
  }, [isAuthenticated, location, navigate]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/legal" component={Legal} />
      <Route path="/lead" component={LeadMagnet} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/my-natal-chart" component={MyNatalChart} />
      <Route path="/natal-chart" component={NatalChart} />
      <Route path="/guest-chart/:id" component={GuestNatalChartView} />
      <Route path="/solar-today" component={SolarToday} />
      <Route path="/horoscope" component={Horoscope} />
      <Route path="/compatibility" component={Compatibility} />
      <Route path="/matrix" component={Matrix} />
      <Route path="/ask" component={Ask} />
      <Route path="/buy-energy" component={BuyEnergy} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/referral" component={Referral} />
      <Route path="/payment-history" component={PaymentHistory} />
      <Route path="/admin" component={Admin} />
      <Route path="/settings" component={Settings} />
      <Route path="/archive" component={Archive} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/" component={isAuthenticated ? Dashboard : Login} />
      <Route component={NotFound} />
    </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function EnergySyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { setOrbs, setMaxOrbs, setTier, setResetAt, setEnergy } = useEnergy();

  const { data } = useQuery<any>({
    queryKey: ['/api/user/me'],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (data?.ok && data.data) {
      if (data.data.orbs !== undefined) {
        setOrbs(data.data.orbs);
      }
      if (data.data.maxOrbs !== undefined) {
        setMaxOrbs(data.data.maxOrbs);
      }
      if (data.data.tier) {
        setTier(data.data.tier);
      }
      if (data.data.orbsResetAt) {
        setResetAt(new Date(data.data.orbsResetAt));
      }
      if (data.data.energy !== undefined) {
        setEnergy(data.data.energy);
      }
    }
  }, [data, setOrbs, setMaxOrbs, setTier, setResetAt, setEnergy]);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <TonConnectUIProvider manifestUrl={manifestUrl}>
          <TooltipProvider>
            <EnergySyncProvider>
              <Toaster />
              <Router />
            </EnergySyncProvider>
          </TooltipProvider>
        </TonConnectUIProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

export default App;
