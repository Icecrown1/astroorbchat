import { TonConnectUI } from '@tonconnect/ui-react';

let tonConnectUI: TonConnectUI | null = null;

function getTonConnectUI(): TonConnectUI {
  if (!tonConnectUI) {
    const manifestUrl = `${window.location.origin}/.well-known/tonconnect-manifest.json`;
    tonConnectUI = new TonConnectUI({
      manifestUrl,
    });
  }
  return tonConnectUI;
}

export async function connectWallet() {
  try {
    const ui = getTonConnectUI();
    const connectedWallet = await ui.connectWallet();
    return connectedWallet;
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}

export async function disconnectWallet() {
  try {
    const ui = getTonConnectUI();
    await ui.disconnect();
  } catch (error) {
    console.error('Failed to disconnect wallet:', error);
    throw error;
  }
}

export async function sendTransaction(to: string, amount: string, payload?: string) {
  try {
    const ui = getTonConnectUI();
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: to,
          amount: amount,
          payload: payload || '',
        },
      ],
    };

    const result = await ui.sendTransaction(transaction);
    return result;
  } catch (error) {
    console.error('Failed to send transaction:', error);
    throw error;
  }
}

export function getWalletAddress(): string | null {
  const ui = getTonConnectUI();
  return ui.wallet?.account.address || null;
}

export function isWalletConnected(): boolean {
  const ui = getTonConnectUI();
  return ui.connected;
}
