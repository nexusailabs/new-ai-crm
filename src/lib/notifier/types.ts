/**
 * Notifier Types
 * Type definitions for the notification system
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

// ============================================================================
// Base Notification Types
// ============================================================================

export type NotificationChannel = 'email' | 'webhook' | 'in_app' | 'sms';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationMetadata {
  correlation_id?: string;
  source?: string;
  attempt?: number;
  max_attempts?: number;
}

// ============================================================================
// Notification Status
// ============================================================================

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced';

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  status: NotificationStatus;
  message_id?: string;
  error?: string;
  timestamp: string;
}

// ============================================================================
// Withdrawal Notification Types
// ============================================================================

export interface WithdrawalNotificationData {
  withdrawal_uuid: string;
  action: 'APPROVE' | 'REJECT';
  previous_status: string;
  new_status: string;
  amount: number;
  currency: string;
  account_email: string | null;
  account_name?: string;
  reason?: string | null;
  processed_by?: string;
  processed_at?: string;
}

// ============================================================================
// Email Types
// ============================================================================

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailContent {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  text?: string;
  html?: string;
  template_id?: string;
  template_data?: Record<string, unknown>;
}

export interface EmailOptions {
  from?: EmailRecipient;
  reply_to?: EmailRecipient;
  priority?: NotificationPriority;
  tags?: string[];
  metadata?: NotificationMetadata;
}

export interface EmailSendRequest {
  content: EmailContent;
  options?: EmailOptions;
}

// ============================================================================
// Webhook Dispatch Types
// ============================================================================

export interface WebhookDispatchConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
  retry_count?: number;
}

export interface WebhookDispatchRequest<T = unknown> {
  config: WebhookDispatchConfig;
  event: string;
  payload: T;
}

export interface WebhookDispatchResult {
  success: boolean;
  status_code?: number;
  response_body?: string;
  error?: string;
  latency_ms: number;
}

// ============================================================================
// Notifier Provider Interface
// ============================================================================

export interface NotifierProvider {
  readonly name: string;
  readonly channel: NotificationChannel;

  /**
   * Send a notification
   * @param data Notification-specific data
   * @returns Result of the notification send operation
   */
  send(data: unknown): Promise<NotificationResult>;

  /**
   * Check if the provider is configured and ready
   */
  isConfigured(): boolean;
}

// ============================================================================
// Email Provider Interface
// ============================================================================

export interface EmailProvider extends NotifierProvider {
  channel: 'email';

  /**
   * Send an email
   */
  sendEmail(request: EmailSendRequest): Promise<NotificationResult>;

  /**
   * Verify email configuration
   */
  verifyConfig(): Promise<boolean>;
}

// ============================================================================
// Webhook Provider Interface
// ============================================================================

export interface WebhookProvider extends NotifierProvider {
  channel: 'webhook';

  /**
   * Dispatch a webhook
   */
  dispatch<T>(request: WebhookDispatchRequest<T>): Promise<WebhookDispatchResult>;

  /**
   * Generate signature for webhook payload
   */
  generateSignature(payload: string, secret: string): string;
}
