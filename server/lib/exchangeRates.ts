/**
 * Exchange Rates Service
 * 
 * Fetches and caches exchange rates:
 * - USD/RUB from Central Bank of Russia (ЦБ РФ) - cached daily
 * - TON/USD from CoinGecko API - cached for 5 minutes
 */

// In-memory cache for quick access
interface RateCache {
  usdRub: {
    rate: number;
    updatedAt: Date;
    source: 'cbr';
  } | null;
  tonUsd: {
    rate: number;
    updatedAt: Date;
    source: 'coingecko';
  } | null;
}

const cache: RateCache = {
  usdRub: null,
  tonUsd: null,
};

// Cache durations
const CBR_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours for RUB
const TON_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes for TON

// Fallback rates if APIs fail
const FALLBACK_USD_RUB = 78.50;
const FALLBACK_TON_USD = 5.50;

/**
 * Fetch USD/RUB rate from Central Bank of Russia
 * API: https://www.cbr-xml-daily.ru/daily_json.js
 */
export async function fetchCbrUsdRubRate(): Promise<number> {
  try {
    console.log('[ExchangeRates] Fetching USD/RUB rate from CBR...');
    
    const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AstroOrb/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`CBR API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // CBR returns rate structure: { Valute: { USD: { Value: 78.50, ... } } }
    const usdRate = data?.Valute?.USD?.Value;
    
    if (typeof usdRate !== 'number' || usdRate <= 0) {
      throw new Error('Invalid USD rate from CBR');
    }
    
    console.log(`[ExchangeRates] CBR USD/RUB rate: ${usdRate}`);
    
    // Update cache
    cache.usdRub = {
      rate: usdRate,
      updatedAt: new Date(),
      source: 'cbr',
    };
    
    return usdRate;
  } catch (error) {
    console.error('[ExchangeRates] Failed to fetch CBR rate:', error);
    throw error;
  }
}

/**
 * Fetch TON/USD rate from CoinGecko API
 * API: https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd
 */
export async function fetchTonUsdRate(): Promise<number> {
  try {
    console.log('[ExchangeRates] Fetching TON/USD rate from CoinGecko...');
    
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AstroOrb/1.0',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // CoinGecko returns: { "the-open-network": { "usd": 5.50 } }
    const tonRate = data?.['the-open-network']?.usd;
    
    if (typeof tonRate !== 'number' || tonRate <= 0) {
      throw new Error('Invalid TON rate from CoinGecko');
    }
    
    console.log(`[ExchangeRates] CoinGecko TON/USD rate: ${tonRate}`);
    
    // Update cache
    cache.tonUsd = {
      rate: tonRate,
      updatedAt: new Date(),
      source: 'coingecko',
    };
    
    return tonRate;
  } catch (error) {
    console.error('[ExchangeRates] Failed to fetch CoinGecko rate:', error);
    throw error;
  }
}

/**
 * Get USD/RUB rate with caching (daily updates)
 */
export async function getUsdRubRate(): Promise<{ rate: number; cached: boolean; updatedAt: Date }> {
  const now = new Date();
  
  // Check if cache is valid
  if (cache.usdRub) {
    const cacheAge = now.getTime() - cache.usdRub.updatedAt.getTime();
    if (cacheAge < CBR_CACHE_DURATION_MS) {
      console.log(`[ExchangeRates] Using cached USD/RUB rate: ${cache.usdRub.rate}`);
      return {
        rate: cache.usdRub.rate,
        cached: true,
        updatedAt: cache.usdRub.updatedAt,
      };
    }
  }
  
  // Fetch fresh rate
  try {
    const rate = await fetchCbrUsdRubRate();
    return {
      rate,
      cached: false,
      updatedAt: new Date(),
    };
  } catch (error) {
    // If fetch fails but we have cached rate, use it
    if (cache.usdRub) {
      console.log(`[ExchangeRates] Using stale cached USD/RUB rate: ${cache.usdRub.rate}`);
      return {
        rate: cache.usdRub.rate,
        cached: true,
        updatedAt: cache.usdRub.updatedAt,
      };
    }
    
    // Last resort: use fallback
    console.log(`[ExchangeRates] Using fallback USD/RUB rate: ${FALLBACK_USD_RUB}`);
    return {
      rate: FALLBACK_USD_RUB,
      cached: false,
      updatedAt: now,
    };
  }
}

/**
 * Get TON/USD rate with caching (5 minute updates)
 */
export async function getTonUsdRate(): Promise<{ rate: number; cached: boolean; updatedAt: Date }> {
  const now = new Date();
  
  // Check if cache is valid
  if (cache.tonUsd) {
    const cacheAge = now.getTime() - cache.tonUsd.updatedAt.getTime();
    if (cacheAge < TON_CACHE_DURATION_MS) {
      console.log(`[ExchangeRates] Using cached TON/USD rate: ${cache.tonUsd.rate}`);
      return {
        rate: cache.tonUsd.rate,
        cached: true,
        updatedAt: cache.tonUsd.updatedAt,
      };
    }
  }
  
  // Fetch fresh rate
  try {
    const rate = await fetchTonUsdRate();
    return {
      rate,
      cached: false,
      updatedAt: new Date(),
    };
  } catch (error) {
    // If fetch fails but we have cached rate, use it
    if (cache.tonUsd) {
      console.log(`[ExchangeRates] Using stale cached TON/USD rate: ${cache.tonUsd.rate}`);
      return {
        rate: cache.tonUsd.rate,
        cached: true,
        updatedAt: cache.tonUsd.updatedAt,
      };
    }
    
    // Last resort: use fallback
    console.log(`[ExchangeRates] Using fallback TON/USD rate: ${FALLBACK_TON_USD}`);
    return {
      rate: FALLBACK_TON_USD,
      cached: false,
      updatedAt: now,
    };
  }
}

/**
 * Get all exchange rates needed for payment pages
 */
export async function getAllExchangeRates(): Promise<{
  usdRub: { rate: number; cached: boolean; updatedAt: Date };
  tonUsd: { rate: number; cached: boolean; updatedAt: Date };
  tonRub: number; // Calculated: TON/USD * USD/RUB
}> {
  const [usdRub, tonUsd] = await Promise.all([
    getUsdRubRate(),
    getTonUsdRate(),
  ]);
  
  return {
    usdRub,
    tonUsd,
    tonRub: tonUsd.rate * usdRub.rate,
  };
}

/**
 * Calculate USD price in TON
 */
export function usdToTon(usdAmount: number, tonUsdRate: number): number {
  if (tonUsdRate <= 0) return 0;
  return Number((usdAmount / tonUsdRate).toFixed(4));
}

/**
 * Calculate USD price in RUB
 */
export function usdToRub(usdAmount: number, usdRubRate: number): number {
  return Math.round(usdAmount * usdRubRate);
}

/**
 * Force refresh all rates (used by cron job)
 */
export async function forceRefreshAllRates(): Promise<{
  usdRub: number;
  tonUsd: number;
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let usdRub = FALLBACK_USD_RUB;
  let tonUsd = FALLBACK_TON_USD;
  
  try {
    usdRub = await fetchCbrUsdRubRate();
  } catch (error: any) {
    errors.push(`CBR: ${error.message}`);
  }
  
  try {
    tonUsd = await fetchTonUsdRate();
  } catch (error: any) {
    errors.push(`CoinGecko: ${error.message}`);
  }
  
  return {
    usdRub,
    tonUsd,
    success: errors.length === 0,
    errors,
  };
}

/**
 * Get current cache status (for debugging/admin)
 */
export function getCacheStatus(): RateCache {
  return { ...cache };
}
