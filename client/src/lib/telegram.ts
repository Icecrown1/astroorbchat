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
