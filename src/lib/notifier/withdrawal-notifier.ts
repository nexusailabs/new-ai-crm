/**
 * Withdrawal Notifier
 * Orchestrates notifications for withdrawal status changes
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

import type { WithdrawalNotificationData, NotificationResult } from './types';
import { sendWithdrawalEmail, isEmailEnabled } from './email-notifier';
import { dispatchWithdrawalWebhook } from './webhook-dispatcher';
import { createServerClient } from '@/lib/supabase';
import type { WebhookConfig } from '@/types/supabase';
import type { WebhookEventType, WithdrawalWebhookData } from '@/types/webhook';

// ============================================================================
// Configuration
// ============================================================================

const NOTIFICATIONS_ENABLED = process.env.NOTIFICATIONS_ENABLED !== 'false';
const WEBHOOK_DISPATCH_ENABLED = process.env.WEBHOOK_DISPATCH_ENABLED === 'true';

// ============================================================================
// Types
// ============================================================================

interface NotificationResults {
  email?: NotificationResult;
  webhooks?: Array<{
    url: string;
    success: boolean;
    error?: string;
  }>;
}

// ============================================================================
// Main Notification Function
// ============================================================================

/**
 * Notify about withdrawal status change
 * Sends email to user and dispatches configured webhooks
 */
export async function notifyWithdrawalStatusChange(
  data: WithdrawalNotificationData
): Promise<NotificationResults> {
  if (!NOTIFICATIONS_ENABLED) {
    console.log('[Notifier] Notifications disabled, skipping');
    return {};
  }

  const results: NotificationResults = {};

  // 1. Send email notification
  if (isEmailEnabled() && data.account_email) {
    try {
      results.email = await sendWithdrawalEmail(data);
      console.log('[Notifier] Email sent:', {
        success: results.email.success,
        recipient: data.account_email,
        action: data.action,
      });
    } catch (error) {
      console.error('[Notifier] Email send error:', error);
      results.email = {
        success: false,
        channel: 'email',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 2. Dispatch webhooks
  if (WEBHOOK_DISPATCH_ENABLED) {
    results.webhooks = await dispatchConfiguredWebhooks(data);
  }

  return results;
}

// ============================================================================
// Webhook Dispatch
// ============================================================================

/**
 * Load webhook configurations and dispatch to all active webhooks
 */
async function dispatchConfiguredWebhooks(
  data: WithdrawalNotificationData
): Promise<Array<{ url: string; success: boolean; error?: string }>> {
  const results: Array<{ url: string; success: boolean; error?: string }> = [];

  try {
    const supabase = createServerClient();

    // Determine event type
    const eventType: WebhookEventType = data.action === 'APPROVE'
      ? 'withdrawal.approved'
      : 'withdrawal.rejected';

    // Fetch active webhook configurations for this event
    const { data: webhooks, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (error) {
      console.error('[Notifier] Failed to fetch webhook configs:', error);
      return results;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('[Notifier] No active webhooks configured for event:', eventType);
      return results;
    }

    // Prepare webhook payload
    const webhookData: WithdrawalWebhookData = {
      uuid: data.withdrawal_uuid,
      action: data.action,
      previous_status: data.previous_status,
      new_status: data.new_status,
      amount: data.amount,
      currency: data.currency,
      account_email: data.account_email,
      reason: data.reason ?? null,
      processed_at: data.processed_at || new Date().toISOString(),
    };

    // Dispatch to each webhook (in parallel)
    const dispatchPromises = (webhooks as WebhookConfig[]).map(async (webhook) => {
      try {
        const result = await dispatchWithdrawalWebhook(
          webhook.url,
          webhook.secret,
          eventType,
          webhookData
        );

        return {
          url: webhook.url,
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        return {
          url: webhook.url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    results.push(...await Promise.all(dispatchPromises));

    console.log('[Notifier] Webhook dispatch complete:', {
      total: results.length,
      successful: results.filter((r) => r.success).length,
    });

  } catch (error) {
    console.error('[Notifier] Webhook dispatch error:', error);
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  return NOTIFICATIONS_ENABLED;
}

/**
 * Check if webhook dispatch is enabled
 */
export function isWebhookDispatchEnabled(): boolean {
  return WEBHOOK_DISPATCH_ENABLED;
}
