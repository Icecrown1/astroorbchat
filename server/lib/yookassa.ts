import YooKassa from '@appigram/yookassa-node';

// Initialize YooKassa client
const getYooKassaClient = () => {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  
  if (!shopId || !secretKey) {
    throw new Error('YooKassa credentials not configured. Please set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY');
  }

  return new YooKassa({
    shopId,
    secretKey,
  });
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
  const yooKassa = getYooKassaClient();
  const isTestMode = process.env.YOOKASSA_TEST_MODE === 'true';

  console.log('[YooKassa] Creating payment:', {
    amount: params.amount,
    description: params.description,
    testMode: isTestMode,
  });

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
  const yooKassa = getYooKassaClient();

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
  const yooKassa = getYooKassaClient();

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
 */
export function verifyWebhookIP(ipAddress: string): boolean {
  // YooKassa webhook IP addresses (as of 2025)
  const allowedIPs = [
    '185.71.76.0/27',
    '185.71.77.0/27',
    '77.75.153.0/25',
    '77.75.156.11',
    '77.75.156.35',
    '77.75.154.128/25',
    '2a02:5180::/32',
  ];

  // In test mode, allow all IPs
  if (process.env.YOOKASSA_TEST_MODE === 'true') {
    console.log('[YooKassa] Test mode - allowing all webhook IPs');
    return true;
  }

  // Simple IP check (in production, use proper CIDR matching library)
  const isAllowed = allowedIPs.some(allowedIP => {
    if (allowedIP.includes('/')) {
      // CIDR notation - just check prefix for simplicity
      const prefix = allowedIP.split('/')[0].split('.').slice(0, 3).join('.');
      return ipAddress.startsWith(prefix);
    }
    return ipAddress === allowedIP;
  });

  if (!isAllowed) {
    console.warn('[YooKassa] Webhook from unauthorized IP:', ipAddress);
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
