import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';

interface MeResp {
  ok: boolean;
  data: { tier?: 'free' | 'standard' | 'premium' };
}

/**
 * Гейт подписки на уровне страницы: дип-линки из пушей заходят на роут напрямую,
 * минуя проверку в Dashboard, поэтому каждая платная страница защищается сама.
 * Free → /subscribe; premiumOnly-страницы дополнительно требуют premium.
 * До загрузки /api/user/me ничего не делает (данные из кэша TanStack — запрос общий).
 */
export function useTierGate(opts?: { premiumOnly?: boolean }) {
  const { data } = useQuery<MeResp>({ queryKey: ['/api/user/me'] });
  const [, navigate] = useLocation();
  const tier = data?.data?.tier;
  useEffect(() => {
    if (!tier) return;
    if (tier === 'free' || (opts?.premiumOnly && tier !== 'premium')) {
      navigate('/subscribe', { replace: true });
    }
  }, [tier, opts?.premiumOnly, navigate]);
}
