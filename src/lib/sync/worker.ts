/**
 * Background Sync Worker
 * Periodically syncs Match-Trade API data to Supabase cache
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Hybrid Data Loading Architecture
 */

import { createServerClient } from '@/lib/supabase';
import {
  fetchWithdrawalsFromMatchTrade,
  fetchAllWithdrawalsFromMatchTrade,
  mapPaymentStatus,
} from '@/lib/api/payments';
import {
  getLastSyncedAt,
  updateSyncMetadata,
  acquireSyncLock,
  releaseSyncLock,
  getSyncTimestamp,
  getLatestTimestamp,
  formatDuration,
} from '@/lib/data/sync';
import { transformToWithdrawal } from '@/lib/data/withdrawals';
import type { Withdrawal, WithdrawalInsert } from '@/types/supabase';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  recordsInserted: number;
  recordsUpdated: number;
  duration: number;
  errors?: string[];
}

export interface SyncOptions {
  fullSync?: boolean;  // Force full sync instead of delta
  batchSize?: number;  // Records per API page
  maxPages?: number;   // Maximum pages to fetch
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;
const SYNC_BUFFER_MS = 1000; // 1 second buffer for clock drift

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Sync withdrawals from Match-Trade API to Supabase cache
 *
 * Strategy:
 * 1. Acquire sync lock (prevent concurrent syncs)
 * 2. Get last_synced_at timestamp
 * 3. Fetch delta from API (records after last_synced_at)
 * 4. Upsert to Supabase (insert new, update existing)
 * 5. Update sync metadata
 * 6. Release lock
 */
export async function syncWithdrawals(options: SyncOptions = {}): Promise<SyncResult> {
  const {
    fullSync = false,
    batchSize = DEFAULT_BATCH_SIZE,
    maxPages = DEFAULT_MAX_PAGES,
  } = options;

  const startTime = Date.now();
  const errors: string[] = [];
  let recordsInserted = 0;
  let recordsUpdated = 0;

  // Try to acquire sync lock
  const lockAcquired = await acquireSyncLock('withdrawals');
  if (!lockAcquired) {
    return {
      success: false,
      recordsSynced: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      duration: Date.now() - startTime,
      errors: ['Sync already in progress'],
    };
  }

  try {
    const supabase = createServerClient();

    // Get sync starting point
    const lastSyncedAt = fullSync
      ? new Date(0) // Epoch for full sync
      : await getLastSyncedAt('withdrawals');

    const syncTimestamp = getSyncTimestamp(lastSyncedAt, SYNC_BUFFER_MS);

    console.log(`[Sync] Starting ${fullSync ? 'full' : 'delta'} sync from ${syncTimestamp}`);

    // Fetch records from API
    let allRecords: Withdrawal[] = [];

    if (fullSync) {
      // Full sync: fetch ALL pages using optimized pagination
      console.log('[Sync] Fetching all pages for full sync...');
      const response = await fetchAllWithdrawalsFromMatchTrade({
        size: 1000, // Large page size for efficiency
        sort: 'created,desc',
      });
      allRecords = (response.content || []).map(transformToWithdrawal);
      console.log(`[Sync] Full sync fetched ${allRecords.length} total records`);
    } else {
      // Delta sync: fetch only new/updated records since last sync
      let page = 0;
      let hasMore = true;

      while (hasMore && page < maxPages) {
        const response = await fetchWithdrawalsFromMatchTrade({
          from: syncTimestamp,
          page,
          size: batchSize,
          sort: 'created,desc',
        });

        const pageRecords = (response.content || []).map(transformToWithdrawal);
        allRecords = allRecords.concat(pageRecords);

        // Check if there are more pages
        const totalPages = response.totalPages || 1;
        page++;
        hasMore = page < totalPages;

        console.log(`[Sync] Fetched page ${page}/${totalPages}, records: ${pageRecords.length}`);
      }
    }

    if (allRecords.length === 0) {
      console.log('[Sync] No new records to sync');
      await releaseSyncLock('withdrawals');
      return {
        success: true,
        recordsSynced: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        duration: Date.now() - startTime,
      };
    }

    // Get existing UUIDs to determine insert vs update
    const uuids = allRecords.map(r => r.uuid);
    const { data: existingRecords } = await supabase
      .from('withdrawals')
      .select('uuid')
      .in('uuid', uuids);

    const existingUuids = new Set(
      (existingRecords || []).map((r: { uuid: string }) => r.uuid)
    );

    // Use upsert for all records (handles both insert and update atomically)
    const allRecordsToUpsert: WithdrawalInsert[] = allRecords.map(record => ({
      uuid: record.uuid,
      account_uuid: record.account_uuid,
      account_email: record.account_email,
      account_name: record.account_name,
      account_surname: record.account_surname,
      amount: record.amount,
      net_amount: record.net_amount,
      currency: record.currency,
      status: record.status,
      mapped_status: record.mapped_status,
      payment_gateway_uuid: record.payment_gateway_uuid,
      payment_gateway_name: record.payment_gateway_name,
      wallet_address: record.wallet_address,
      reference: record.reference,
      payment_id: record.payment_id,
      partner_id: record.partner_id,
      created_at: record.created_at,
      synced_at: new Date().toISOString(),
      raw_data: record.raw_data,
    }));

    // Batch upsert in chunks to avoid payload limits
    const CHUNK_SIZE = 500;
    for (let i = 0; i < allRecordsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = allRecordsToUpsert.slice(i, i + CHUNK_SIZE);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (supabase as any)
        .from('withdrawals')
        .upsert(chunk, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        errors.push(`Upsert error (chunk ${Math.floor(i / CHUNK_SIZE) + 1}): ${upsertError.message}`);
        console.error('[Sync] Upsert error:', upsertError);
      } else {
        // Count based on existing UUIDs
        const newCount = chunk.filter(r => !existingUuids.has(r.uuid)).length;
        const updateCount = chunk.length - newCount;
        recordsInserted += newCount;
        recordsUpdated += updateCount;
      }

      console.log(`[Sync] Upserted chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(allRecordsToUpsert.length / CHUNK_SIZE)}`);
    }

    // Find the latest timestamp from synced records
    const latestTimestamp = getLatestTimestamp(
      allRecords,
      (r) => r.created_at
    );

    // Update sync metadata
    await updateSyncMetadata(
      'withdrawals',
      latestTimestamp > lastSyncedAt ? latestTimestamp : new Date(),
      allRecords.length,
      Date.now() - startTime
    );

    const totalSynced = recordsInserted + recordsUpdated;
    const duration = Date.now() - startTime;

    console.log(
      `[Sync] Completed: ${totalSynced} records (${recordsInserted} new, ${recordsUpdated} updated) in ${formatDuration(duration)}`
    );

    await releaseSyncLock('withdrawals');

    return {
      success: errors.length === 0,
      recordsSynced: totalSynced,
      recordsInserted,
      recordsUpdated,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync] Fatal error:', errorMessage);

    await releaseSyncLock('withdrawals', errorMessage);

    return {
      success: false,
      recordsSynced: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      duration: Date.now() - startTime,
      errors: [errorMessage],
    };
  }
}

// ============================================================================
// Full Sync (Initial Population)
// ============================================================================

/**
 * Perform a full sync - fetch all records from API
 * Use for initial cache population or recovery
 */
export async function fullSyncWithdrawals(): Promise<SyncResult> {
  return syncWithdrawals({
    fullSync: true,
    maxPages: 100, // Fetch up to 10000 records
    batchSize: 200, // Larger batch for full sync
  });
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if sync is healthy
 * Returns true if last sync was within threshold
 */
export async function isSyncHealthy(
  thresholdMs: number = 60000 // 1 minute default
): Promise<boolean> {
  const lastSyncedAt = await getLastSyncedAt('withdrawals');
  const staleness = Date.now() - lastSyncedAt.getTime();
  return staleness < thresholdMs;
}
