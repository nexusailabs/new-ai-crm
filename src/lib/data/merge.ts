/**
 * Data Merge Utilities
 * Timestamp-based deduplication and merging for hybrid data loading
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Hybrid Data Loading Architecture
 */

import type { Withdrawal } from '@/types/supabase';

// ============================================================================
// Types
// ============================================================================

export interface MergeResult<T> {
  data: T[];
  stats: {
    dbCount: number;
    deltaCount: number;
    mergedCount: number;
    duplicatesRemoved: number;
  };
}

// ============================================================================
// Generic Merge Functions
// ============================================================================

/**
 * Merge two arrays of records with timestamp-based deduplication
 * Delta records (from API) override DB records when newer
 *
 * @param dbData - Cached data from Supabase
 * @param deltaData - Fresh data from Match-Trade API
 * @param getId - Function to extract unique identifier from record
 * @param getTimestamp - Function to extract updated_at timestamp
 * @returns Merged and deduplicated array
 */
export function mergeWithTimestamp<T>(
  dbData: T[],
  deltaData: T[],
  getId: (record: T) => string,
  getTimestamp: (record: T) => string | Date
): MergeResult<T> {
  // Map for O(1) lookup by ID
  const mergedMap = new Map<string, T>();

  // Add DB data first (base layer)
  for (const record of dbData) {
    const id = getId(record);
    mergedMap.set(id, record);
  }

  // Override with delta data where applicable (newer wins)
  let overrideCount = 0;
  for (const deltaRecord of deltaData) {
    const id = getId(deltaRecord);
    const existing = mergedMap.get(id);

    if (!existing) {
      // New record from delta
      mergedMap.set(id, deltaRecord);
    } else {
      // Compare timestamps - delta wins if newer
      const existingTime = new Date(getTimestamp(existing)).getTime();
      const deltaTime = new Date(getTimestamp(deltaRecord)).getTime();

      if (deltaTime >= existingTime) {
        mergedMap.set(id, deltaRecord);
        overrideCount++;
      }
    }
  }

  return {
    data: Array.from(mergedMap.values()),
    stats: {
      dbCount: dbData.length,
      deltaCount: deltaData.length,
      mergedCount: mergedMap.size,
      duplicatesRemoved: dbData.length + deltaData.length - mergedMap.size,
    },
  };
}

// ============================================================================
// Withdrawal-Specific Merge
// ============================================================================

/**
 * Merge withdrawal records from DB cache and API delta
 * Uses uuid as unique identifier and updated_at for conflict resolution
 */
export function mergeWithdrawals(
  dbData: Withdrawal[],
  deltaData: Withdrawal[]
): MergeResult<Withdrawal> {
  return mergeWithTimestamp(
    dbData,
    deltaData,
    (record) => record.uuid,
    (record) => record.updated_at
  );
}

/**
 * Sort withdrawals by created_at descending (newest first)
 * Secondary sort by uuid for deterministic ordering
 */
export function sortWithdrawals(withdrawals: Withdrawal[]): Withdrawal[] {
  return [...withdrawals].sort((a, b) => {
    // Primary sort: created_at descending
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    if (timeDiff !== 0) return timeDiff;

    // Secondary sort: uuid (deterministic fallback for same timestamp)
    return b.uuid.localeCompare(a.uuid);
  });
}

/**
 * Merge and sort withdrawals in one operation
 */
export function mergeAndSortWithdrawals(
  dbData: Withdrawal[],
  deltaData: Withdrawal[]
): { data: Withdrawal[]; stats: MergeResult<Withdrawal>['stats'] } {
  const merged = mergeWithdrawals(dbData, deltaData);
  return {
    data: sortWithdrawals(merged.data),
    stats: merged.stats,
  };
}

// ============================================================================
// Deduplication Utilities
// ============================================================================

/**
 * Remove duplicates from an array based on a key extractor
 * Keeps the first occurrence
 */
export function deduplicateBy<T>(
  items: T[],
  getKey: (item: T) => string
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Remove duplicates keeping the newest version based on timestamp
 */
export function deduplicateByNewest<T>(
  items: T[],
  getKey: (item: T) => string,
  getTimestamp: (item: T) => string | Date
): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
    } else {
      const existingTime = new Date(getTimestamp(existing)).getTime();
      const itemTime = new Date(getTimestamp(item)).getTime();

      if (itemTime > existingTime) {
        map.set(key, item);
      }
    }
  }

  return Array.from(map.values());
}
