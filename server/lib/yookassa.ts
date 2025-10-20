// Initialize YooKassa client
const getYooKassaClient = async () => {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  
  console.log('[YooKassa] Initializing client with credentials:', {
    shopId: shopId ? `${shopId.substring(0, 4)}...` : 'MISSING',
    secretKeyPresent: !!secretKey,
  });
  
  if (!shopId || !secretKey) {
    throw new Error('YooKassa credentials not configured. Please set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY');
  }

  try {
    // Dynamic import for CommonJS module in ESM environment
    const yookassaModule = await import('@appigram/yookassa-node');
    
    console.log('[YooKassa] Module loaded, keys:', Object.keys(yookassaModule));
    console.log('[YooKassa] Default export type:', typeof yookassaModule.default);
    console.log('[YooKassa] YooKassa export type:', typeof (yookassaModule as any).YooKassa);
    
    // Try factory function first (based on docs)
    const factory = yookassaModule.default || yookassaModule;
    
    let client;
    try {
      // Try calling as factory function
      client = factory(shopId, secretKey);
      console.log('[YooKassa] Client created via factory function');
    } catch (factoryError: any) {
      console.log('[YooKassa] Factory function failed, trying constructor:', factoryError.message);
      // Try as constructor with new
      client = new (factory as any)(shopId, secretKey);
      console.log('[YooKassa] Client created via constructor');
    }
    
    console.log('[YooKassa] Client type:', typeof client);
    console.log('[YooKassa] Client methods:', Object.keys(client));
    
    return client;
  } catch (error: any) {
    console.error('[YooKassa] Failed to initialize client:', error);
    throw new Error(`Failed to initialize YooKassa client: ${error.message}`);
  }
};

export interface CreatePaymentParams {
  amount: string; // Amount in RUB (e.g., "100.00")
  description: string;
  returnUrl: string;
  metadata?: Record<string, any>;
}

export interface YooKassaPayment {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Create a new payment in YooKassa
 * Returns payment object with confirmation URL for redirect
 */
export async function createPayment(params: CreatePaymentParams): Promise<YooKassaPayment> {
  const isTestMode = process.env.YOOKASSA_TEST_MODE === 'true';

  console.log('[YooKassa] Creating payment:', {
    amount: params.amount,
    description: params.description,
    testMode: isTestMode,
  });
  
  const yooKassa = await getYooKassaClient();
  console.log('[YooKassa] Client obtained, calling createPayment API');

  try {
    const payment = await yooKassa.createPayment({
      amount: {
        value: params.amount,
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      description: params.description,
      capture: true, // Auto-capture payment after authorization
      metadata: params.metadata || {},
      test: isTestMode,
    });

    console.log('[YooKassa] Payment created:', {
      id: payment.id,
      status: payment.status,
      confirmationUrl: payment.confirmation?.confirmation_url,
    });

    return payment;
  } catch (error: any) {
    console.error('[YooKassa] Error creating payment:', error);
    throw new Error(`Failed to create YooKassa payment: ${error.message}`);
  }
}

/**
 * Check payment status by payment ID
 */
export async function checkPaymentStatus(paymentId: string): Promise<YooKassaPayment> {
  const yooKassa = await getYooKassaClient();

  console.log('[YooKassa] Checking payment status:', paymentId);

  try {
    const payment = await yooKassa.getPayment(paymentId);
    
    console.log('[YooKassa] Payment status:', {
      id: payment.id,
      status: payment.status,
      paid: payment.paid,
    });

    return payment;
  } catch (error: any) {
    console.error('[YooKassa] Error checking payment status:', error);
    throw new Error(`Failed to check YooKassa payment status: ${error.message}`);
  }
}

/**
 * Create a refund for a payment
 */
export async function createRefund(paymentId: string, amount: string, reason?: string): Promise<any> {
  const yooKassa = await getYooKassaClient();

  console.log('[YooKassa] Creating refund:', {
    paymentId,
    amount,
    reason,
  });

  try {
    const refund = await yooKassa.createRefund({
      payment_id: paymentId,
      amount: {
        value: amount,
        currency: 'RUB',
      },
      description: reason || 'Refund requested by user',
    });

    console.log('[YooKassa] Refund created:', {
      id: refund.id,
      status: refund.status,
    });

    return refund;
  } catch (error: any) {
    console.error('[YooKassa] Error creating refund:', error);
    throw new Error(`Failed to create YooKassa refund: ${error.message}`);
  }
}

/**
 * Verify webhook notification from YooKassa
 * YooKassa sends webhooks from specific IP addresses
 * 
 * SECURITY NOTE: In production, YooKassa recommends using their webhook
 * IP whitelist. This implementation only allows exact IP matches.
 * CIDR range checking is disabled for security reasons - use a proper
 * CIDR library (like 'ip-address' or 'ipaddr.js') if needed.
 */
export function verifyWebhookIP(ipAddress: string): boolean {
  // In test mode, allow all IPs for local development
  if (process.env.YOOKASSA_TEST_MODE === 'true') {
    console.log('[YooKassa] Test mode - allowing all webhook IPs');
    return true;
  }

  // YooKassa webhook IP addresses (exact IPs only for security)
  // For CIDR ranges, you must install a proper CIDR matching library
  const allowedIPs = [
    '77.75.156.11',
    '77.75.156.35',
  ];

  const isAllowed = allowedIPs.includes(ipAddress);

  if (!isAllowed) {
    console.warn('[YooKassa] Webhook from unauthorized IP:', ipAddress);
    console.warn('[YooKassa] To allow CIDR ranges in production, install a CIDR library like "ipaddr.js"');
  }

  return isAllowed;
}

/**
 * Parse and validate webhook payload
 */
export function parseWebhookPayload(body: any): YooKassaPayment | null {
  try {
    if (!body || !body.object || body.event !== 'payment.succeeded') {
      console.warn('[YooKassa] Invalid webhook payload structure');
      return null;
    }

    return body.object as YooKassaPayment;
  } catch (error: any) {
    console.error('[YooKassa] Error parsing webhook payload:', error);
    return null;
  }
}
