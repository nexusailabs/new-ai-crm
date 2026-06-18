/**
 * Email Notifier
 * Handles email notifications for withdrawal status changes
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

import type {
  EmailProvider,
  EmailSendRequest,
  NotificationResult,
  WithdrawalNotificationData,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const EMAIL_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@gudax.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'GUDAX AI CRM';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// ============================================================================
// Email Templates
// ============================================================================

function generateWithdrawalApprovedEmail(data: WithdrawalNotificationData): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.currency,
  }).format(data.amount);

  return {
    subject: `Withdrawal Approved - ${formattedAmount}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .amount { font-size: 32px; font-weight: bold; color: #10b981; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Withdrawal Approved</h1>
          </div>
          <div class="content">
            <p>Your withdrawal request has been approved and is being processed.</p>
            <div class="details">
              <div class="detail-row">
                <span>Amount</span>
                <span class="amount">${formattedAmount}</span>
              </div>
              <div class="detail-row">
                <span>Reference</span>
                <span>${data.withdrawal_uuid}</span>
              </div>
              <div class="detail-row">
                <span>Status</span>
                <span style="color: #10b981; font-weight: bold;">Approved</span>
              </div>
              ${data.reason ? `
              <div class="detail-row">
                <span>Note</span>
                <span>${data.reason}</span>
              </div>
              ` : ''}
            </div>
            <p>The funds should arrive in your account within the standard processing time.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from GUDAX AI CRM.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Withdrawal Approved

Your withdrawal request has been approved and is being processed.

Amount: ${formattedAmount}
Reference: ${data.withdrawal_uuid}
Status: Approved
${data.reason ? `Note: ${data.reason}` : ''}

The funds should arrive in your account within the standard processing time.

---
This is an automated notification from GUDAX AI CRM.
    `.trim(),
  };
}

function generateWithdrawalRejectedEmail(data: WithdrawalNotificationData): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.currency,
  }).format(data.amount);

  return {
    subject: `Withdrawal Rejected - ${formattedAmount}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
          .amount { font-size: 32px; font-weight: bold; color: #ef4444; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .reason-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Withdrawal Rejected</h1>
          </div>
          <div class="content">
            <p>Unfortunately, your withdrawal request has been rejected.</p>
            <div class="details">
              <div class="detail-row">
                <span>Amount</span>
                <span class="amount">${formattedAmount}</span>
              </div>
              <div class="detail-row">
                <span>Reference</span>
                <span>${data.withdrawal_uuid}</span>
              </div>
              <div class="detail-row">
                <span>Status</span>
                <span style="color: #ef4444; font-weight: bold;">Rejected</span>
              </div>
            </div>
            ${data.reason ? `
            <div class="reason-box">
              <strong>Reason:</strong>
              <p>${data.reason}</p>
            </div>
            ` : ''}
            <p>If you believe this was in error, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from GUDAX AI CRM.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Withdrawal Rejected

Unfortunately, your withdrawal request has been rejected.

Amount: ${formattedAmount}
Reference: ${data.withdrawal_uuid}
Status: Rejected
${data.reason ? `Reason: ${data.reason}` : ''}

If you believe this was in error, please contact our support team.

---
This is an automated notification from GUDAX AI CRM.
    `.trim(),
  };
}

// ============================================================================
// Email Provider Implementation
// ============================================================================

class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  readonly channel = 'email' as const;

  isConfigured(): boolean {
    return EMAIL_ENABLED && !!RESEND_API_KEY;
  }

  async verifyConfig(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      // Simple API key validation via Resend API
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async send(data: unknown): Promise<NotificationResult> {
    return this.sendEmail(data as EmailSendRequest);
  }

  async sendEmail(request: EmailSendRequest): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: 'email',
        status: 'failed',
        error: 'Email provider not configured',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`,
          to: request.content.to.map((r) => r.email),
          subject: request.content.subject,
          html: request.content.html,
          text: request.content.text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          channel: 'email',
          status: 'failed',
          error: errorData.message || `HTTP ${response.status}`,
          timestamp: new Date().toISOString(),
        };
      }

      const result = await response.json();

      return {
        success: true,
        channel: 'email',
        status: 'sent',
        message_id: result.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        channel: 'email',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// Console Logger Provider (Development)
// ============================================================================

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  readonly channel = 'email' as const;

  isConfigured(): boolean {
    return true; // Always available for development
  }

  async verifyConfig(): Promise<boolean> {
    return true;
  }

  async send(data: unknown): Promise<NotificationResult> {
    return this.sendEmail(data as EmailSendRequest);
  }

  async sendEmail(request: EmailSendRequest): Promise<NotificationResult> {
    console.log('[Email Notifier] Would send email:', {
      to: request.content.to,
      subject: request.content.subject,
      textPreview: request.content.text?.substring(0, 200) + '...',
    });

    return {
      success: true,
      channel: 'email',
      status: 'sent',
      message_id: `console-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Exported Functions
// ============================================================================

const emailProvider: EmailProvider = RESEND_API_KEY
  ? new ResendEmailProvider()
  : new ConsoleEmailProvider();

/**
 * Send withdrawal status email notification
 */
export async function sendWithdrawalEmail(
  data: WithdrawalNotificationData
): Promise<NotificationResult> {
  // Skip if no email address
  if (!data.account_email) {
    return {
      success: false,
      channel: 'email',
      status: 'failed',
      error: 'No recipient email address',
      timestamp: new Date().toISOString(),
    };
  }

  // Generate email content based on action
  const emailContent = data.action === 'APPROVE'
    ? generateWithdrawalApprovedEmail(data)
    : generateWithdrawalRejectedEmail(data);

  // Send via provider
  return emailProvider.sendEmail({
    content: {
      to: [{ email: data.account_email, name: data.account_name }],
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    },
    options: {
      priority: 'high',
      tags: ['withdrawal', data.action.toLowerCase()],
      metadata: {
        correlation_id: data.withdrawal_uuid,
        source: 'withdrawal-notifier',
      },
    },
  });
}

/**
 * Check if email notifications are enabled
 */
export function isEmailEnabled(): boolean {
  return emailProvider.isConfigured();
}

/**
 * Get the active email provider name
 */
export function getEmailProviderName(): string {
  return emailProvider.name;
}
