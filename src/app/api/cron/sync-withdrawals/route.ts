/**
 * Vercel Cron Job: Sync Withdrawals
 * Runs every minute to perform delta sync from Match-Trade API to Supabase
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Real-time Sync System
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncWithdrawals } from '@/lib/sync/worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for sync

/**
 * Vercel Cron calls this endpoint every minute
 * Schedule: * * * * * (every minute)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request from Vercel
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the cron secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cron] Unauthorized cron request attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting scheduled delta sync...');
    const startTime = Date.now();

    // Run delta sync (not full sync)
    const result = await syncWithdrawals({
      fullSync: false,
      batchSize: 100,
      maxPages: 5, // Limit pages per cron run to stay within time limits
    });

    const duration = Date.now() - startTime;

    if (!result.success) {
      console.error('[Cron] Sync failed:', result.errors);
      return NextResponse.json(
        {
          status: 'error',
          message: 'Sync failed',
          errors: result.errors,
          duration,
        },
        { status: 500 }
      );
    }

    console.log(
      `[Cron] Sync completed: ${result.recordsSynced} records ` +
      `(${result.recordsInserted} new, ${result.recordsUpdated} updated) ` +
      `in ${duration}ms`
    );

    return NextResponse.json({
      status: 'ok',
      message: 'Delta sync completed',
      result: {
        recordsSynced: result.recordsSynced,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        duration: result.duration,
      },
      cronTimestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron] Fatal error:', errorMessage);

    return NextResponse.json(
      {
        status: 'error',
        error: errorMessage,
        cronTimestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
