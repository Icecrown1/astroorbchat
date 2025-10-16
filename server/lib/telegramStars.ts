import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

if (!BOT_TOKEN) {
  console.warn('[Telegram Stars] TELEGRAM_BOT_TOKEN not configured - Stars payments will not work');
}

export interface InvoiceParams {
  title: string;
  description: string;
  payload: string;  // Our signed payload for validation
  prices: Array<{ label: string; amount: number }>;  // amount in Stars
  chatId?: number;  // For sendInvoice (specific chat)
}

export interface AnswerPreCheckoutParams {
  preCheckoutQueryId: string;
  ok: boolean;
  errorMessage?: string;
}

export interface RefundParams {
  telegramPaymentChargeId: string;
  amountStars?: number;  // Optional: refund specific amount
}

/**
 * Create HMAC signature for invoice payload
 */
export function signPayload(data: any): string {
  const secret = process.env.SESSION_SECRET || 'default-secret';
  const payload = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `${Buffer.from(payload).toString('base64')}.${hmac.digest('hex')}`;
}

/**
 * Verify HMAC signature from invoice payload
 */
export function verifyPayload(signedPayload: string): { valid: boolean; data?: any } {
  try {
    const [payloadBase64, signature] = signedPayload.split('.');
    if (!payloadBase64 || !signature) {
      return { valid: false };
    }

    const payload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const secret = process.env.SESSION_SECRET || 'default-secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    return { valid: true, data: JSON.parse(payload) };
  } catch (error) {
    console.error('[Telegram Stars] Payload verification failed:', error);
    return { valid: false };
  }
}

/**
 * Create invoice link for Stars payment (digital goods)
 * https://core.telegram.org/bots/api#createinvoicelink
 */
export async function createInvoiceLink(params: InvoiceParams): Promise<{ ok: boolean; invoiceLink?: string; error?: string }> {
  try {
    if (!BOT_TOKEN) {
      return { ok: false, error: 'Bot token not configured' };
    }

    const response = await fetch(`${BOT_API_URL}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        payload: params.payload,
        currency: 'XTR',  // Telegram Stars
        prices: params.prices,
        provider_token: '',  // Empty for digital goods (Stars)
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('[Telegram Stars] createInvoiceLink failed:', data);
      return { ok: false, error: data.description || 'Failed to create invoice' };
    }

    return { ok: true, invoiceLink: data.result };
  } catch (error: any) {
    console.error('[Telegram Stars] createInvoiceLink error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Send invoice directly to a chat (alternative to createInvoiceLink)
 * https://core.telegram.org/bots/api#sendinvoice
 */
export async function sendInvoice(params: InvoiceParams): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!BOT_TOKEN) {
      return { ok: false, error: 'Bot token not configured' };
    }

    if (!params.chatId) {
      return { ok: false, error: 'chatId required for sendInvoice' };
    }

    const response = await fetch(`${BOT_API_URL}/sendInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        title: params.title,
        description: params.description,
        payload: params.payload,
        currency: 'XTR',
        prices: params.prices,
        provider_token: '',  // Empty for digital goods
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('[Telegram Stars] sendInvoice failed:', data);
      return { ok: false, error: data.description || 'Failed to send invoice' };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('[Telegram Stars] sendInvoice error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Answer pre-checkout query (MUST be called within 10 seconds!)
 * https://core.telegram.org/bots/api#answerprecheckoutquery
 */
export async function answerPreCheckoutQuery(params: AnswerPreCheckoutParams): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!BOT_TOKEN) {
      return { ok: false, error: 'Bot token not configured' };
    }

    const response = await fetch(`${BOT_API_URL}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: params.preCheckoutQueryId,
        ok: params.ok,
        error_message: params.errorMessage,
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('[Telegram Stars] answerPreCheckoutQuery failed:', data);
      return { ok: false, error: data.description || 'Failed to answer pre-checkout' };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('[Telegram Stars] answerPreCheckoutQuery error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Refund Stars payment
 * https://core.telegram.org/bots/api#refundstarpayment
 */
export async function refundStarPayment(params: RefundParams): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!BOT_TOKEN) {
      return { ok: false, error: 'Bot token not configured' };
    }

    const response = await fetch(`${BOT_API_URL}/refundStarPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_payment_charge_id: params.telegramPaymentChargeId,
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('[Telegram Stars] refundStarPayment failed:', data);
      return { ok: false, error: data.description || 'Failed to refund payment' };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('[Telegram Stars] refundStarPayment error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Set webhook URL for bot
 * https://core.telegram.org/bots/api#setwebhook
 */
export async function setWebhook(url: string, secretToken?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!BOT_TOKEN) {
      return { ok: false, error: 'Bot token not configured' };
    }

    const params: any = { url };
    if (secretToken) {
      params.secret_token = secretToken;
    }

    const response = await fetch(`${BOT_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('[Telegram Stars] setWebhook failed:', data);
      return { ok: false, error: data.description || 'Failed to set webhook' };
    }

    console.log('[Telegram Stars] Webhook set successfully:', url);
    return { ok: true };
  } catch (error: any) {
    console.error('[Telegram Stars] setWebhook error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get webhook info
 * https://core.telegram.org/bots/api#getwebhookinfo
 */
export async function getWebhookInfo(): Promise<{ ok: boolean; info?: any; error?: string }> {
  try {
    if (!BOT_TOKEN) {
      return { ok: false, error: 'Bot token not configured' };
    }

    const response = await fetch(`${BOT_API_URL}/getWebhookInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    
    if (!data.ok) {
      return { ok: false, error: data.description || 'Failed to get webhook info' };
    }

    return { ok: true, info: data.result };
  } catch (error: any) {
    console.error('[Telegram Stars] getWebhookInfo error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Auto-register webhook at server startup
 */
export async function registerWebhookAtStartup(): Promise<void> {
  const serverUrl = process.env.SERVER_URL || process.env.REPLIT_DEV_DOMAIN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!BOT_TOKEN) {
    console.warn('[Telegram Webhook] TELEGRAM_BOT_TOKEN not configured - webhook registration skipped');
    return;
  }

  if (!serverUrl) {
    console.warn('[Telegram Webhook] SERVER_URL or REPLIT_DEV_DOMAIN not configured - webhook registration skipped');
    return;
  }

  try {
    // Construct webhook URL with optional secret
    const webhookUrl = webhookSecret 
      ? `https://${serverUrl}/webhooks/telegram/${webhookSecret}`
      : `https://${serverUrl}/webhooks/telegram`;

    const result = await setWebhook(webhookUrl, webhookSecret);

    if (result.ok) {
      console.log(`[Telegram Webhook] ✅ Registered: ${webhookUrl}`);
    } else {
      console.error('[Telegram Webhook] ❌ Registration failed:', result.error);
    }
  } catch (error: any) {
    console.error('[Telegram Webhook] Registration error:', error.message);
  }
}
