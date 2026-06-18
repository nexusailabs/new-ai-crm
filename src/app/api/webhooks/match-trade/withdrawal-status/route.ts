/**
 * Match-Trade Withdrawal Status Webhook Handler
 * Receives external status updates from Match-Trade broker system
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737 - Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { logWithdrawalAction, createAuditEntry } from '@/lib/audit/withdrawal-audit';
import { notifyWithdrawalStatusChange } from '@/lib/notifier';
import type { Withdrawal } from '@/types/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================================
// Match-Trade Webhook Configuration
// ============================================================================

const MATCH_TRADE_WEBHOOK_SECRET = process.env.MATCH_TRADE_WEBHOOK_SECRET || '';
const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes tolerance for timestamp

// ============================================================================
// Match-Trade Webhook Types
// ============================================================================

interface MatchTradeWithdrawalWebhookPayload {
  uuid: string;
  status: string;
  previousStatus?: string;
  amount: number;
  currency: string;
  login: string;
  systemUuid: string;
  paymentGatewayUuid?: string;
  processedAt?: string;
  comment?: string;
  errorMessage?: string;
}

interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Status Mapping
// ============================================================================

const MATCH_TRADE_STATUS_MAP: Record<string, string> = {
  'DONE': 'APPROVED',
  'COMPLETED': 'APPROVED',
  'PROCESSED': 'APPROVED',
  'REJECTED': 'REJECTED',
  'CANCELLED': 'REJECTED',
  'FAILED': 'REJECTED',
  'PENDING': 'PENDING',
  'PROCESSING': 'PROCESSING',
};

function mapMatchTradeStatus(mtStatus: string): string {
  return MATCH_TRADE_STATUS_MAP[mtStatus.toUpperCase()] || 'UNKNOWN';
}

// ============================================================================
// Webhook Signature Verification
// ============================================================================

function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): WebhookVerificationResult {
  // Skip verification if no secret configured (development mode)
  if (!MATCH_TRADE_WEBHOOK_SECRET) {
    console.warn('[Webhook] No webhook secret configured - skipping verification');
    return { valid: true };
  }

  // Check timestamp freshness
  const webhookTimestamp = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - webhookTimestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    return {
      valid: false,
      error: 'Webhook timestamp expired or invalid',
    };
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', MATCH_TRADE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: 'Invalid signature' };
  }

  const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  return isValid
    ? { valid: true }
    : { valid: false, error: 'Invalid signature' };
}

// ============================================================================
// POST - Handle Match-Trade Webhook
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Extract webhook headers
    const signature = request.headers.get('x-match-trade-signature') || '';
    const timestamp = request.headers.get('x-match-trade-timestamp') || '';
    const eventType = request.headers.get('x-match-trade-event') || 'withdrawal.status';

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const verification = verifyWebhookSignature(rawBody, signature, timestamp);

    if (!verification.valid) {
      console.error('[Webhook] Signature verification failed:', verification.error);
      return NextResponse.json(
        { error: 'Webhook verification failed', details: verification.error },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: MatchTradeWithdrawalWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload.uuid || !payload.status) {
      return NextResponse.json(
        { error: 'Missing required fields: uuid, status' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Received withdrawal status update:', {
      uuid: payload.uuid,
      status: payload.status,
      eventType,
    });

    // Get Supabase client
    const supabase = createServerClient();

    // Fetch current withdrawal record
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('uuid', payload.uuid)
      .single();

    if (fetchError || !withdrawal) {
      console.warn('[Webhook] Withdrawal not found:', payload.uuid);
      // Return 200 to acknowledge receipt (prevent retries for unknown UUIDs)
      return NextResponse.json({
        success: true,
        message: 'Withdrawal not found in system - acknowledged',
        uuid: payload.uuid,
      });
    }

    // Cast to typed Withdrawal
    const typedWithdrawal = withdrawal as Withdrawal;

    // Map Match-Trade status to internal status
    const mappedStatus = mapMatchTradeStatus(payload.status);
    const previousStatus = typedWithdrawal.mapped_status;

    // Skip if status hasn't changed
    if (previousStatus === mappedStatus) {
      console.log('[Webhook] Status unchanged, skipping update');
      return NextResponse.json({
        success: true,
        message: 'Status unchanged',
        uuid: payload.uuid,
        status: mappedStatus,
      });
    }

    // Update withdrawal status in database
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({
        mapped_status: mappedStatus,
        status: payload.status,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('uuid', payload.uuid);

    if (updateError) {
      console.error('[Webhook] Database update error:', updateError);
      return NextResponse.json(
        { error: 'Database update failed', details: updateError.message },
        { status: 500 }
      );
    }

    // Create audit log entry
    const auditEntry = createAuditEntry({
      withdrawal_uuid: payload.uuid,
      action: mappedStatus === 'APPROVED' ? 'APPROVE' : 'REJECT',
      previous_status: previousStatus || 'UNKNOWN',
      new_status: mappedStatus,
      reason: payload.comment || 'Status updated via Match-Trade webhook',
      match_trade_response: {
        original_status: payload.status,
        error_message: payload.errorMessage,
        processed_at: payload.processedAt,
      },
      amount: payload.amount,
      currency: payload.currency,
    });

    // Log audit entry asynchronously
    logWithdrawalAction(auditEntry).catch((err) => {
      console.error('[Webhook] Audit logging failed:', err);
    });

    // Trigger notification (async, don't block response)
    notifyWithdrawalStatusChange({
      withdrawal_uuid: payload.uuid,
      action: mappedStatus === 'APPROVED' ? 'APPROVE' : 'REJECT',
      previous_status: previousStatus || 'PENDING',
      new_status: mappedStatus,
      amount: payload.amount,
      currency: payload.currency,
      account_email: typedWithdrawal.account_email,
      reason: payload.comment,
    }).catch((err) => {
      console.error('[Webhook] Notification dispatch failed:', err);
    });

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      uuid: payload.uuid,
      previousStatus,
      newStatus: mappedStatus,
      processingTimeMs: processingTime,
    });

  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Health Check / Webhook Info
// ============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/webhooks/match-trade/withdrawal-status',
    method: 'POST',
    description: 'Match-Trade withdrawal status webhook handler',
    headers: {
      'x-match-trade-signature': 'HMAC-SHA256 signature',
      'x-match-trade-timestamp': 'Unix timestamp',
      'x-match-trade-event': 'Event type (optional)',
    },
    payload: {
      uuid: 'string (required)',
      status: 'string (required)',
      previousStatus: 'string (optional)',
      amount: 'number',
      currency: 'string',
      login: 'string',
      systemUuid: 'string',
      comment: 'string (optional)',
      errorMessage: 'string (optional)',
    },
    configured: !!MATCH_TRADE_WEBHOOK_SECRET,
  });
}
