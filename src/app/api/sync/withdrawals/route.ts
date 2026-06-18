/**
 * Withdrawals Sync API Route
 * Trigger background sync of withdrawals from Match-Trade to Supabase
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Hybrid Data Loading Architecture
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncWithdrawals, fullSyncWithdrawals, isSyncHealthy } from '@/lib/sync/worker';
import { getSyncInfo } from '@/lib/data/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for sync

// ============================================================================
// GET - Check Sync Status
// ============================================================================

export async function GET() {
  try {
    const syncInfo = await getSyncInfo('withdrawals');
    const healthy = await isSyncHealthy();

    return NextResponse.json({
      status: 'ok',
      healthy,
      sync: {
        tableName: syncInfo.tableName,
        lastSyncedAt: syncInfo.lastSyncedAt.toISOString(),
        recordCount: syncInfo.recordCount,
        syncStatus: syncInfo.syncStatus,
        lastError: syncInfo.lastError,
        isStale: syncInfo.isStale,
        staleDurationMs: syncInfo.staleDuration,
      },
    });
  } catch (error) {
    console.error('[Sync API] Status check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Trigger Sync
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check for full sync flag
    const { searchParams } = new URL(request.url);
    const fullSync = searchParams.get('full') === 'true';

    // Optional: API key validation for production
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.SYNC_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[Sync API] Triggering ${fullSync ? 'full' : 'delta'} sync`);

    // Run sync
    const result = fullSync
      ? await fullSyncWithdrawals()
      : await syncWithdrawals();

    if (!result.success) {
      return NextResponse.json(
        {
          status: 'error',
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      result,
    });

  } catch (error) {
    console.error('[Sync API] Sync failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
