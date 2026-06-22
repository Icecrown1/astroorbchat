import WebApp from '@twa-dev/sdk';

declare global {
  interface Window {
    Telegram?: {
      WebApp: typeof WebApp;
    };
  }
}

export const telegram = window.Telegram?.WebApp || WebApp;

export function initTelegram() {
  telegram.ready();
  telegram.expand();
  
  // Set header color to match Solar Gold design
  if (telegram.setHeaderColor) {
    telegram.setHeaderColor('#D4A642'); // Solar Gold
  }
  
  if (telegram.setBackgroundColor) {
    telegram.setBackgroundColor('#0a0a0a');
  }
  
  return telegram;
}

export function getInitData(): string {
  return telegram.initData || '';
}

export function getTelegramUser() {
  return telegram.initDataUnsafe?.user;
}

export function showMainButton(text: string, onClick: () => void) {
  telegram.MainButton.setText(text);
  telegram.MainButton.onClick(onClick);
  telegram.MainButton.show();
}

export function hideMainButton() {
  telegram.MainButton.hide();
}

export function showBackButton(onClick: () => void) {
  telegram.BackButton.onClick(onClick);
  telegram.BackButton.show();
}

export function hideBackButton() {
  telegram.BackButton.hide();
}

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'error' | 'success' | 'warning' = 'medium') {
  if (telegram.HapticFeedback) {
    switch (type) {
      case 'light':
      case 'medium':
      case 'heavy':
        telegram.HapticFeedback.impactOccurred(type);
        break;
      case 'error':
      case 'success':
      case 'warning':
        telegram.HapticFeedback.notificationOccurred(type);
        break;
    }
  }
}

export function closeTelegramApp() {
  telegram.close();
}

export function openTelegramLink(url: string) {
  telegram.openTelegramLink(url);
}

export function openLink(url: string) {
  telegram.openLink(url);
}

/**
 * Reliably open an external payment URL from inside the Telegram Mini App.
 * window.location.href is unreliable in the Mini App (especially on iOS), so we
 * prefer WebApp.openLink and fall back to window.open / location only if needed.
 */
export function openPaymentLink(url: string) {
  if (!url) return;
  try {
    const tg = telegram as any;
    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url, { try_instant_view: false });
      return;
    }
  } catch (err) {
    console.warn('[Payment] WebApp.openLink failed, falling back:', err);
  }

  try {
    const opened = window.open(url, '_blank');
    if (opened) return;
  } catch (err) {
    console.warn('[Payment] window.open failed, falling back:', err);
  }

  window.location.href = url;
}

/**
 * Get the start parameter from Telegram WebApp
 * Returns the raw startParam value from various sources
 */
export function getStartParam(): string | null {
  // Method 1: Telegram WebApp startParam (most reliable)
  const tgApp = telegram as any;
  if (tgApp.startParam) {
    console.log('[StartParam] Found via startParam:', tgApp.startParam);
    return tgApp.startParam;
  }

  // Method 2: Telegram initDataUnsafe start_param
  if (telegram.initDataUnsafe?.start_param) {
    console.log('[StartParam] Found via initDataUnsafe.start_param:', telegram.initDataUnsafe.start_param);
    return telegram.initDataUnsafe.start_param;
  }

  // Method 3: URL Hash (#tgWebAppStartParam=CODE)
  if (window.location.hash) {
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const codeFromHash = hashParams.get('tgWebAppStartParam');
    if (codeFromHash) {
      console.log('[StartParam] Found via URL hash:', codeFromHash);
      return codeFromHash;
    }
  }

  // Method 4: URL Search Parameters (?startapp=CODE)
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromQuery = urlParams.get('startapp');
  if (codeFromQuery) {
    console.log('[StartParam] Found via URL query:', codeFromQuery);
    return codeFromQuery;
  }

  console.log('[StartParam] No start parameter found');
  return null;
}

/**
 * Extract lead ID from start parameter (format: lead_xxx)
 */
export function getLeadIdFromStartParam(): string | null {
  const startParam = getStartParam();
  if (startParam && startParam.startsWith('lead_')) {
    const leadId = startParam.substring(5); // Remove 'lead_' prefix
    console.log('[Lead] Found lead ID:', leadId);
    return leadId;
  }
  return null;
}

/**
 * Smart extraction of referral code from Telegram
 * Tries 4 different methods to find the referral code:
 * 1. Telegram WebApp startParam
 * 2. Telegram initDataUnsafe start_param
 * 3. URL Hash (#tgWebAppStartParam=CODE)
 * 4. URL Search Parameters (?startapp=CODE or ?ref=CODE)
 */
export function getReferralCode(): string | null {
  // Method 1: Telegram WebApp startParam (most reliable)
  // Note: startParam may not be in TypeScript definitions but exists at runtime
  const tgApp = telegram as any;
  if (tgApp.startParam) {
    console.log('[Referral] Found code via startParam:', tgApp.startParam);
    return tgApp.startParam;
  }

  // Method 2: Telegram initDataUnsafe start_param
  if (telegram.initDataUnsafe?.start_param) {
    console.log('[Referral] Found code via initDataUnsafe.start_param:', telegram.initDataUnsafe.start_param);
    return telegram.initDataUnsafe.start_param;
  }

  // Method 3: URL Hash (#tgWebAppStartParam=CODE)
  if (window.location.hash) {
    const hash = window.location.hash.slice(1); // Remove '#'
    const hashParams = new URLSearchParams(hash);
    const codeFromHash = hashParams.get('tgWebAppStartParam');
    if (codeFromHash) {
      console.log('[Referral] Found code via URL hash:', codeFromHash);
      return codeFromHash;
    }
  }

  // Method 4: URL Search Parameters (?startapp=CODE, ?ref=CODE, ?referral=CODE)
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromQuery = urlParams.get('startapp') || 
                        urlParams.get('ref') || 
                        urlParams.get('referral');
  if (codeFromQuery) {
    console.log('[Referral] Found code via URL query:', codeFromQuery);
    return codeFromQuery;
  }

  console.log('[Referral] No referral code found');
  return null;
}
