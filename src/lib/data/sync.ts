/**
 * Sync Utilities
 * Helper functions for tracking and managing data synchronization
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Hybrid Data Loading Architecture
 */

import { createServerClient, type SupabaseClient } from '@/lib/supabase';
import type { SyncMetadata, SyncStatus, SyncMetadataInsert, SyncMetadataUpdate } from '@/types/supabase';

// Type helper to bypass strict type checking when schema is not synced
type AnyTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

// ============================================================================
// Types
// ============================================================================

export interface SyncInfo {
  tableName: string;
  lastSyncedAt: Date;
  recordCount: number;
  syncStatus: SyncStatus;
  lastError: string | null;
  isStale: boolean;
  staleDuration: number; // milliseconds since last sync
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  duration: number;
  errors?: string[];
}

// ============================================================================
// Configuration
// ============================================================================

// How long before data is considered stale (default: 10 seconds)
export const DEFAULT_STALE_THRESHOLD_MS = 10 * 1000;

// ============================================================================
// Sync Metadata Functions
// ============================================================================

/**
 * Get sync metadata for a specific table
 */
export async function getSyncMetadata(tableName: string): Promise<SyncMetadata | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('sync_metadata')
    .select('*')
    .eq('table_name', tableName)
    .single();

  if (error) {
    console.warn(`[Sync] Failed to get metadata for ${tableName}:`, error.message);
    return null;
  }

  return data;
}

/**
 * Get the last synced timestamp for a table
 * Returns epoch (1970-01-01) if no sync metadata exists
 */
export async function getLastSyncedAt(tableName: string): Promise<Date> {
  const metadata = await getSyncMetadata(tableName);

  if (!metadata) {
    return new Date(0); // Epoch - will trigger full sync
  }

  return new Date(metadata.last_synced_at);
}

/**
 * Update sync metadata after a successful sync
 */
export async function updateSyncMetadata(
  tableName: string,
  lastSyncedAt: Date,
  recordCount: number,
  durationMs: number
): Promise<void> {
  const supabase = createServerClient();

  const upsertData = {
    table_name: tableName,
    last_synced_at: lastSyncedAt.toISOString(),
    record_count: recordCount,
    sync_duration_ms: durationMs,
    sync_status: 'idle' as SyncStatus,
    last_error: null,
  };

  // Note: Type assertion needed until Supabase CLI regenerates types with new tables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('sync_metadata')
    .upsert(upsertData, { onConflict: 'table_name' });

  if (error) {
    console.error(`[Sync] Failed to update metadata for ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Set sync status (for in-progress tracking)
 */
export async function setSyncStatus(
  tableName: string,
  status: SyncStatus,
  errorMsg?: string
): Promise<void> {
  const supabase = createServerClient();

  const updateData: Record<string, unknown> = {
    sync_status: status,
  };

  if (errorMsg) {
    updateData.last_error = errorMsg;
  } else if (status === 'idle') {
    updateData.last_error = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('sync_metadata')
    .update(updateData)
    .eq('table_name', tableName);
}

/**
 * Get comprehensive sync info for a table
 */
export async function getSyncInfo(
  tableName: string,
  staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS
): Promise<SyncInfo> {
  const metadata = await getSyncMetadata(tableName);
  const now = Date.now();

  if (!metadata) {
    return {
      tableName,
      lastSyncedAt: new Date(0),
      recordCount: 0,
      syncStatus: 'idle',
      lastError: null,
      isStale: true,
      staleDuration: now,
    };
  }

  const lastSyncedAt = new Date(metadata.last_synced_at);
  const staleDuration = now - lastSyncedAt.getTime();

  return {
    tableName,
    lastSyncedAt,
    recordCount: metadata.record_count,
    syncStatus: metadata.sync_status,
    lastError: metadata.last_error,
    isStale: staleDuration > staleThresholdMs,
    staleDuration,
  };
}

// ============================================================================
// Sync Lock Functions (prevent concurrent syncs)
// ============================================================================

/**
 * Attempt to acquire a sync lock for a table
 * Returns true if lock acquired, false if another sync is in progress
 */
export async function acquireSyncLock(tableName: string): Promise<boolean> {
  const supabase = createServerClient();

  const updateData = {
    sync_status: 'syncing' as SyncStatus,
  };

  // Try to set status to 'syncing' only if currently 'idle' or 'error'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sync_metadata')
    .update(updateData)
    .eq('table_name', tableName)
    .in('sync_status', ['idle', 'error'])
    .select('id')
    .single();

  if (error || !data) {
    // Could not acquire lock - another sync might be in progress
    return false;
  }

  return true;
}

/**
 * Release a sync lock for a table
 */
export async function releaseSyncLock(
  tableName: string,
  error?: string
): Promise<void> {
  await setSyncStatus(tableName, error ? 'error' : 'idle', error);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Create a timeout promise
 */
export function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([promise, timeout(ms)]);
}

/**
 * Calculate the ISO timestamp to use for delta sync
 * Subtracts a small buffer to avoid missing records due to clock drift
 */
export function getSyncTimestamp(lastSyncedAt: Date, bufferMs: number = 1000): string {
  const bufferedTime = new Date(lastSyncedAt.getTime() - bufferMs);
  return bufferedTime.toISOString();
}

/**
 * Find the most recent updated_at timestamp in an array of records
 */
export function getLatestTimestamp<T>(
  records: T[],
  getTimestamp: (record: T) => string | Date
): Date {
  if (records.length === 0) {
    return new Date(0);
  }

  return records.reduce((latest, record) => {
    const recordTime = new Date(getTimestamp(record));
    return recordTime > latest ? recordTime : latest;
  }, new Date(0));
}
