/**
 * Withdrawal Action API Route
 * Process withdrawal requests: APPROVE or REJECT
 *
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0713 - Withdrawal Pending Action API
 * Updated: 2025-12-29
 * Mission: MISSION-20251229-0737 - Added audit logging
 * Updated: 2025-12-29
 * - Removed Match-Trade API integration (see IMPORTANT NOTE below)
 *
 * IMPORTANT: Match-Trade API Limitation
 * =====================================
 * Match-Trade Broker API v1.25 does NOT provide an endpoint to approve/reject
 * existing PENDING withdrawal requests. The available endpoints are:
 *
 * - GET /v1/withdrawals - List/search withdrawals (read-only)
 * - POST /v1/withdrawals/manual - Create NEW manual withdrawal (deducts balance immediately)
 *
 * Withdrawal approval in Match-Trade works via:
 * 1. Match-Trade CRM UI - Admin manually approves in their dashboard
 * 2. Auto-approval - Payment Gateway with autoWithdrawals: true
 * 3. Webhooks - Match-Trade sends status updates to our CRM
 *
 * This API route only updates the status in our Supabase database for:
 * - Internal tracking and audit trail
 * - UI status display
 * - Historical records
 *
 * The actual Match-Trade status should be synced via:
 * - Webhook handlers (when available)
 * - Periodic sync from GET /v1/withdrawals
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { PaymentActionRequest, PaymentActionResponse, PaymentStatus } from '@/types/payment';
import type { Withdrawal, WithdrawalMappedStatus } from '@/types/supabase';
import { createAuditEntry, logWithdrawalAction, extractRequestMetadata } from '@/lib/audit/withdrawal-audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate action request payload
 */
function validateActionRequest(body: unknown): PaymentActionRequest | null {
  if (!body || typeof body !== 'object') return null;

  const data = body as Record<string, unknown>;

  if (!data.action || !['APPROVE', 'REJECT'].includes(data.action as string)) {
    return null;
  }

  return {
    uuid: data.uuid as string,
    action: data.action as 'APPROVE' | 'REJECT',
    reason: data.reason as string | undefined,
  };
}

/**
 * Map action to new status
 */
function mapActionToStatus(action: 'APPROVE' | 'REJECT'): PaymentStatus {
  return action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
}

// ============================================================================
// POST - Execute Withdrawal Action
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse<PaymentActionResponse>> {
  const { uuid } = await params;

  try {
    // Parse and validate request body
    const body = await request.json();
    const actionRequest = validateActionRequest(body);

    if (!actionRequest) {
      return NextResponse.json(
        {
          success: false,
          uuid,
          newStatus: 'PENDING' as PaymentStatus,
          message: 'Invalid request. Required: { action: "APPROVE" | "REJECT", reason?: string }',
        },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = createServerClient();

    // Fetch withdrawal record from database
    const { data: withdrawalData, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('uuid', uuid)
      .single();

    if (fetchError || !withdrawalData) {
      return NextResponse.json(
        {
          success: false,
          uuid,
          newStatus: 'PENDING' as PaymentStatus,
          message: `Withdrawal not found: ${uuid}`,
        },
        { status: 404 }
      );
    }

    // Cast to typed Withdrawal
    const withdrawal = withdrawalData as Withdrawal;

    // Check if already processed
    if (withdrawal.mapped_status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          uuid,
          newStatus: withdrawal.mapped_status as PaymentStatus,
          message: `Withdrawal already processed with status: ${withdrawal.mapped_status}`,
        },
        { status: 409 }
      );
    }

    const newStatus = mapActionToStatus(actionRequest.action);

    // NOTE: Match-Trade API does NOT have an endpoint to approve/reject existing withdrawals.
    // This action only updates our local Supabase database.
    // The actual Match-Trade status must be managed via:
    // - Match-Trade CRM UI
    // - Webhook sync when Match-Trade approves/rejects
    // - Periodic GET /v1/withdrawals sync
    console.log(`[Withdrawal Action] ${actionRequest.action} action for ${uuid} - updating Supabase only (Match-Trade API not available for approval)`);

    // Update withdrawal status in database
    // Use type assertion for update payload
    const updatePayload: { mapped_status: WithdrawalMappedStatus; status: string; updated_at: string } = {
      mapped_status: newStatus as WithdrawalMappedStatus,
      status: actionRequest.action === 'APPROVE' ? 'DONE' : 'REJECTED',
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('withdrawals')
      .update(updatePayload as never)
      .eq('uuid', uuid);

    if (updateError) {
      console.error('[Withdrawal Action] Database update error:', updateError);
      return NextResponse.json(
        {
          success: false,
          uuid,
          newStatus: 'PENDING' as PaymentStatus,
          message: `Database update failed: ${updateError.message}`,
        },
        { status: 500 }
      );
    }

    // Audit logging - record action for compliance
    const { ip_address, user_agent } = extractRequestMetadata(request);
    const auditEntry = createAuditEntry({
      withdrawal_uuid: uuid,
      action: actionRequest.action,
      previous_status: 'PENDING',
      new_status: newStatus,
      reason: actionRequest.reason,
      ip_address: ip_address ?? undefined,
      user_agent: user_agent ?? undefined,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      account_email: withdrawal.account_email ?? undefined,
    });

    // Log to audit trail (async, don't block response)
    logWithdrawalAction(auditEntry).catch((err) => {
      console.error('[Withdrawal Action] Audit logging failed:', err);
    });

    return NextResponse.json({
      success: true,
      uuid,
      newStatus,
      message: `Withdrawal ${actionRequest.action.toLowerCase()}d successfully`,
    });

  } catch (error) {
    console.error('[Withdrawal Action] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        uuid,
        newStatus: 'PENDING' as PaymentStatus,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Retrieve Withdrawal Details
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse> {
  const { uuid } = await params;

  try {
    const supabase = createServerClient();

    const { data: withdrawalData, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('uuid', uuid)
      .single();

    if (error || !withdrawalData) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // Cast to typed Withdrawal
    const withdrawal = withdrawalData as Withdrawal;

    return NextResponse.json({
      uuid: withdrawal.uuid,
      status: withdrawal.mapped_status,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      accountEmail: withdrawal.account_email,
      accountName: `${withdrawal.account_name || ''} ${withdrawal.account_surname || ''}`.trim(),
      paymentGateway: withdrawal.payment_gateway_name,
      createdAt: withdrawal.created_at,
      updatedAt: withdrawal.updated_at,
      canProcess: withdrawal.mapped_status === 'PENDING',
    });

  } catch (error) {
    console.error('[Withdrawal GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve withdrawal' },
      { status: 500 }
    );
  }
}
