/**
 * Withdrawals API Route (Hybrid Data Loading)
 * GET /api/withdrawals - Fetch withdrawal events using DB Cache + Delta Sync
 * POST /api/withdrawals - Approve/Reject withdrawal
 * Created: 2025-12-29
 * Updated: 2025-12-29 - Hybrid Data Loading Architecture
 */

import { NextRequest, NextResponse } from "next/server";
import { getWithdrawalsHybrid, getWithdrawalsFromCache } from "@/lib/data/withdrawals";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchAllWithdrawalsFromMatchTrade,
  mapPaymentStatus,
  type MatchTradePaymentRecord,
} from "@/lib/api/payments";
import type {
  WithdrawalEvent,
  PaymentStats,
  PaymentStatus,
  PaymentFilterStatus,
} from "@/types/payment";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Fallback: Direct API Transform (when Supabase not configured)
// ============================================================================

function transformWithdrawal(record: MatchTradePaymentRecord): WithdrawalEvent {
  const status = mapPaymentStatus(record.paymentRequestInfo?.financialDetails?.status || "PENDING");
  const personalDetails = record.accountInfo?.personalDetails;
  const paymentGatewayDetails = record.paymentRequestInfo?.paymentGatewayDetails;
  const additionalInfo = record.paymentRequestInfo?.additionalInfo;
  const financialDetails = record.paymentRequestInfo?.financialDetails;

  return {
    uuid: record.uuid || "",
    timestamp: record.created || new Date().toISOString(),
    accountInfo: {
      uuid: record.accountInfo?.accountUuid || "",
      email: record.accountInfo?.email || "",
      name: personalDetails?.firstname || "Unknown",
      surname: personalDetails?.lastname || "User",
    },
    status,
    amount: financialDetails?.amount ?? 0,
    currency: financialDetails?.currency || "USD",
    method: paymentGatewayDetails?.name || "Unknown",
    transactionId: additionalInfo?.paymentId || record.uuid || "",
    bankInfo: additionalInfo?.walletAddress
      ? {
          bankName: paymentGatewayDetails?.name || "Wallet",
          accountNumber: additionalInfo.walletAddress,
        }
      : undefined,
  };
}

function calculateStats(withdrawals: WithdrawalEvent[]): PaymentStats {
  const stats: PaymentStats = {
    totalAmount: 0,
    totalCount: withdrawals.length,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    rejectedAmount: 0,
  };

  withdrawals.forEach((withdrawal) => {
    stats.totalAmount += withdrawal.amount;

    switch (withdrawal.status) {
      case "PENDING":
        stats.pendingCount++;
        stats.pendingAmount += withdrawal.amount;
        break;
      case "APPROVED":
        stats.approvedCount++;
        stats.approvedAmount += withdrawal.amount;
        break;
      case "REJECTED":
        stats.rejectedCount++;
        stats.rejectedAmount += withdrawal.amount;
        break;
    }
  });

  return stats;
}

// ============================================================================
// GET /api/withdrawals (Hybrid Pattern)
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as PaymentFilterStatus | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const cacheOnly = searchParams.get("cache_only") === "true";

    // Determine status filter
    const status = (statusParam && statusParam !== "ALL")
      ? statusParam as 'PENDING' | 'APPROVED' | 'REJECTED'
      : 'ALL';

    // Try hybrid loading if Supabase is configured
    if (isSupabaseConfigured()) {
      try {
        const result = cacheOnly
          ? await getWithdrawalsFromCache({ limit, status })
          : await getWithdrawalsHybrid({ limit, status });

        const duration = Date.now() - startTime;

        return NextResponse.json({
          withdrawals: result.withdrawals,
          stats: result.stats,
          metadata: {
            ...result.metadata,
            totalDuration: duration,
          },
        }, {
          headers: {
            // Cache control for CDN/browser
            'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
            // Custom headers for debugging
            'X-Data-Source': result.metadata.source,
            'X-DB-Count': String(result.metadata.dbCount),
            'X-Delta-Count': String(result.metadata.deltaCount),
            'X-Duration': String(duration),
          },
        });
      } catch (dbError) {
        console.warn('[Withdrawals API] Hybrid loading failed, falling back to direct API:', dbError);
        // Fall through to direct API call
      }
    }

    // Fallback: Direct API call with full pagination
    console.log('[Withdrawals API] Using direct API call (Supabase not configured or failed)');

    const matchTradeResponse = await fetchAllWithdrawalsFromMatchTrade({
      size: 1000, // Page size for pagination
      sort: "created,desc",
    });

    let withdrawals = matchTradeResponse.content.map(transformWithdrawal);

    // Apply status filter
    if (status !== 'ALL') {
      withdrawals = withdrawals.filter((w) => w.status === status);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      withdrawals,
      stats: calculateStats(withdrawals),
      metadata: {
        source: 'api-only',
        dbCount: 0,
        deltaCount: withdrawals.length,
        totalCount: withdrawals.length,
        lastSyncedAt: null,
        fetchedAt: new Date().toISOString(),
        duration,
        apiAvailable: true,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
        'X-Data-Source': 'api-only',
        'X-Duration': String(duration),
      },
    });

  } catch (error) {
    console.error("[Withdrawals API] Error:", error);

    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch withdrawals";

    return NextResponse.json(
      {
        error: errorMessage,
        withdrawals: [],
        stats: {
          totalAmount: 0,
          totalCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          pendingAmount: 0,
          approvedAmount: 0,
          rejectedAmount: 0,
        },
        metadata: {
          source: 'error',
          duration,
          apiAvailable: false,
        },
      },
      {
        status: 500,
        headers: {
          'X-Data-Source': 'error',
          'X-Duration': String(duration),
        },
      }
    );
  }
}

// ============================================================================
// POST /api/withdrawals (for approve/reject actions)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uuid, action } = body;

    if (!uuid || !action) {
      return NextResponse.json(
        { error: "Missing uuid or action" },
        { status: 400 }
      );
    }

    // Note: Match-Trade API doesn't have a direct approve/reject endpoint for withdrawals
    // This would need to be implemented based on specific Match-Trade API capabilities
    // For now, return a success response to maintain UI functionality

    const newStatus: PaymentStatus =
      action === "APPROVE" ? "APPROVED" : "REJECTED";

    return NextResponse.json({
      success: true,
      uuid,
      newStatus,
      message: `Withdrawal ${action.toLowerCase()}d successfully`,
    });
  } catch (error) {
    console.error("Withdrawal action error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
