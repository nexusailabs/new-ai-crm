/**
 * Webhook Types
 * Type definitions for webhook configuration and events
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

// ============================================================================
// Webhook Event Types
// ============================================================================

export type WebhookEventType =
  | 'withdrawal.approved'
  | 'withdrawal.rejected'
  | 'deposit.received'
  | 'customer.created'
  | 'customer.updated';

// ============================================================================
// Webhook Configuration
// ============================================================================

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  is_active: boolean;
  headers?: Record<string, string>;
  retry_count: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
}

export type WebhookConfigInsert = Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WebhookConfigUpdate = Partial<WebhookConfigInsert>;

// ============================================================================
// Webhook Payload
// ============================================================================

export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: T;
}

export interface WithdrawalWebhookData {
  uuid: string;
  action: 'APPROVE' | 'REJECT';
  previous_status: string;
  new_status: string;
  amount: number;
  currency: string;
  account_email: string | null;
  reason: string | null;
  processed_at: string;
}

// ============================================================================
// Webhook Delivery
// ============================================================================

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WebhookDelivery {
  id: string;
  webhook_config_id: string;
  event_type: WebhookEventType;
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Webhook Signature
// ============================================================================

export interface WebhookSignature {
  timestamp: number;
  signature: string;
}

/**
 * Generate webhook signature header value
 * Format: t=<timestamp>,v1=<signature>
 */
export function formatSignatureHeader(sig: WebhookSignature): string {
  return `t=${sig.timestamp},v1=${sig.signature}`;
}

/**
 * Parse webhook signature header value
 */
export function parseSignatureHeader(header: string): WebhookSignature | null {
  const parts = header.split(',');
  let timestamp = 0;
  let signature = '';

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = parseInt(value, 10);
    if (key === 'v1') signature = value;
  }

  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}
