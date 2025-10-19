declare module '@appigram/yookassa-node' {
  export interface YooKassaConfig {
    shopId: string;
    secretKey: string;
  }

  export interface Amount {
    value: string;
    currency: string;
  }

  export interface Confirmation {
    type: string;
    return_url?: string;
    confirmation_url?: string;
  }

  export interface CreatePaymentParams {
    amount: Amount;
    confirmation: Confirmation;
    description: string;
    capture?: boolean;
    metadata?: Record<string, any>;
    test?: boolean;
  }

  export interface Payment {
    id: string;
    status: string;
    paid: boolean;
    amount: Amount;
    confirmation?: Confirmation;
    metadata?: Record<string, any>;
    created_at: string;
  }

  export interface CreateRefundParams {
    payment_id: string;
    amount: Amount;
    description?: string;
  }

  export interface Refund {
    id: string;
    status: string;
    payment_id: string;
    amount: Amount;
    created_at: string;
  }

  export default class YooKassa {
    constructor(config: YooKassaConfig);
    createPayment(params: CreatePaymentParams): Promise<Payment>;
    getPayment(paymentId: string): Promise<Payment>;
    createRefund(params: CreateRefundParams): Promise<Refund>;
  }
}
