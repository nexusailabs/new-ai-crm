/**
 * Withdrawal Reject API Route
 * POST /api/withdrawals/[uuid]/reject - Reject a pending withdrawal
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0713
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { WithdrawalActionResult } from "@/lib/api/withdrawal-actions";
import type { Withdrawal, WithdrawalMappedStatus } from "@/types/supabase";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

interface RejectRequestBody {
  reason: string;
  operatorId?: string;
}

// ============================================================================
// POST /api/withdrawals/[uuid]/reject
// ============================================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<WithdrawalActionResult | { error: string }>> {
  const startTime = Date.now();
  const { uuid } = await context.params;

  try {
    // Parse request body
    let body: RejectRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body required for rejection" },
        { status: 400 }
      );
    }

    const { reason, operatorId } = body;

    // Validate UUID
    if (!uuid || uuid.length < 8) {
      return NextResponse.json(
        { error: "Invalid withdrawal UUID" },
        { status: 400 }
      );
    }

    // Validate reason (required for rejections)
    if (!reason || reason.trim().length < 3) {
      return NextResponse.json(
        { error: "Rejection reason is required (minimum 3 characters)" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Step 1: Fetch withdrawal from database
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('uuid', uuid)
      .single();

    if (fetchError || !withdrawal) {
      console.error('[Reject API] Withdrawal not found:', uuid);
      return NextResponse.json(
        { error: `Withdrawal not found: ${uuid}` },
        { status: 404 }
      );
    }

    // Cast to typed Withdrawal
    const typedWithdrawal = withdrawal as unknown as Withdrawal;

    // Step 2: Check if already processed
    if (typedWithdrawal.mapped_status !== 'PENDING') {
      return NextResponse.json(
        { error: `Withdrawal already ${typedWithdrawal.mapped_status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Step 3: Update status in database (optimistic locking via updated_at check)
    const previousUpdatedAt = typedWithdrawal.updated_at;
    const now = new Date().toISOString();

    const updatePayload = {
      mapped_status: 'REJECTED' as WithdrawalMappedStatus,
      status: 'REJECTED',
      updated_at: now,
    };

    const { data: updatedWithdrawal, error: updateError } = await supabase
      .from('withdrawals')
      .update(updatePayload as never)
      .eq('uuid', uuid)
      .eq('updated_at', previousUpdatedAt) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      console.error('[Reject API] Update error:', updateError);

      // Check if it was a concurrent modification
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Withdrawal was modified by another operation. Please refresh and try again." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to reject withdrawal" },
        { status: 500 }
      );
    }

    if (!updatedWithdrawal) {
      // Optimistic lock failed - concurrent modification
      return NextResponse.json(
        { error: "Concurrent modification detected. Please refresh and try again." },
        { status: 409 }
      );
    }

    // Step 4: Log the action (console logging only - action_logs table pending)
    console.log('[Reject API] Action log:', {
      withdrawal_uuid: uuid,
      action: 'REJECT',
      operator_id: operatorId || null,
      reason: reason.trim(),
      previous_status: typedWithdrawal.mapped_status,
      new_status: 'REJECTED',
      created_at: now,
    });

    const duration = Date.now() - startTime;
    console.log(`[Reject API] Withdrawal ${uuid} rejected in ${duration}ms. Reason: ${reason}`);

    const result: WithdrawalActionResult = {
      success: true,
      uuid,
      newStatus: 'REJECTED',
      matchTradeStatus: 'REJECTED',
      message: `Withdrawal rejected: ${reason}`,
      timestamp: now,
    };

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'X-Duration': String(duration),
      },
    });

  } catch (error) {
    console.error('[Reject API] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
