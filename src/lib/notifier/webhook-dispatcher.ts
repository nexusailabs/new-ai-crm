/**
 * Webhook Dispatcher
 * Handles outgoing webhook notifications for external integrations
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

import crypto from 'crypto';
import type {
  WebhookProvider,
  WebhookDispatchRequest,
  WebhookDispatchResult,
  NotificationResult,
} from './types';
import type { WithdrawalWebhookData, WebhookEventType } from '@/types/webhook';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_COUNT = 3;

// ============================================================================
// Webhook Provider Implementation
// ============================================================================

class DefaultWebhookProvider implements WebhookProvider {
  readonly name = 'default';
  readonly channel = 'webhook' as const;

  isConfigured(): boolean {
    return true;
  }

  async send(data: unknown): Promise<NotificationResult> {
    const request = data as WebhookDispatchRequest;
    const result = await this.dispatch(request);

    return {
      success: result.success,
      channel: 'webhook',
      status: result.success ? 'delivered' : 'failed',
      error: result.error,
      timestamp: new Date().toISOString(),
    };
  }

  generateSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  async dispatch<T>(request: WebhookDispatchRequest<T>): Promise<WebhookDispatchResult> {
    const startTime = Date.now();
    const { config, event, payload } = request;
    const timeout = config.timeout_ms || DEFAULT_TIMEOUT_MS;
    const maxRetries = config.retry_count ?? DEFAULT_RETRY_COUNT;

    // Build request body
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GUDAX-CRM-Webhook/1.0',
      ...config.headers,
    };

    // Add signature if secret is provided
    if (config.secret) {
      headers['X-Webhook-Signature'] = this.generateSignature(body, config.secret);
    }

    // Retry loop
    let lastError: string | undefined;
    let lastStatusCode: number | undefined;
    let lastResponseBody: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        lastStatusCode = response.status;
        lastResponseBody = await response.text().catch(() => '');

        // Success (2xx status codes)
        if (response.ok) {
          return {
            success: true,
            status_code: lastStatusCode,
            response_body: lastResponseBody,
            latency_ms: Date.now() - startTime,
          };
        }

        // Client error (4xx) - don't retry
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            status_code: lastStatusCode,
            response_body: lastResponseBody,
            error: `Client error: ${response.status}`,
            latency_ms: Date.now() - startTime,
          };
        }

        // Server error (5xx) - retry
        lastError = `Server error: ${response.status}`;

      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = 'Request timeout';
          } else {
            lastError = error.message;
          }
        } else {
          lastError = 'Unknown error';
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      status_code: lastStatusCode,
      response_body: lastResponseBody,
      error: lastError || 'Max retries exceeded',
      latency_ms: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Exported Functions
// ============================================================================

const webhookProvider = new DefaultWebhookProvider();

/**
 * Dispatch a withdrawal status webhook
 */
export async function dispatchWithdrawalWebhook(
  url: string,
  secret: string,
  event: WebhookEventType,
  data: WithdrawalWebhookData
): Promise<WebhookDispatchResult> {
  return webhookProvider.dispatch({
    config: {
      url,
      secret,
      timeout_ms: DEFAULT_TIMEOUT_MS,
      retry_count: DEFAULT_RETRY_COUNT,
    },
    event,
    payload: data,
  });
}

/**
 * Generate webhook signature for verification
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return webhookProvider.generateSignature(payload, secret);
}

/**
 * Dispatch a generic webhook
 */
export async function dispatchWebhook<T>(
  request: WebhookDispatchRequest<T>
): Promise<WebhookDispatchResult> {
  return webhookProvider.dispatch(request);
}
