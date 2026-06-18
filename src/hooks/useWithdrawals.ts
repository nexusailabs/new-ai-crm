'use client';

/**
 * useWithdrawals Hook
 * React Query hook for fetching withdrawals with SWR pattern
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Hybrid Data Loading Architecture
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { HybridWithdrawalsResult } from '@/lib/data/withdrawals';
import type { WithdrawalEvent, PaymentStats } from '@/types/payment';

// ============================================================================
// Query Keys
// ============================================================================

export const WITHDRAWALS_QUERY_KEY = ['withdrawals'] as const;
export const SYNC_STATUS_QUERY_KEY = ['sync', 'withdrawals'] as const;

// ============================================================================
// Types
// ============================================================================

export interface UseWithdrawalsOptions {
  /** Time in ms before data is considered stale (default: 10s) */
  staleTime?: number;
  /** Background refetch interval in ms (default: 30s) */
  refetchInterval?: number;
  /** Enable optimistic updates */
  enableOptimisticUpdates?: boolean;
  /** Filter by status */
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  /** Maximum records to fetch */
  limit?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface UseWithdrawalsReturn {
  /** Withdrawal events for display */
  withdrawals: WithdrawalEvent[];
  /** Calculated statistics */
  stats: PaymentStats | null;
  /** Loading state (first load) */
  isLoading: boolean;
  /** Fetching state (background refetch) */
  isFetching: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Data source metadata */
  metadata: HybridWithdrawalsResult['metadata'] | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Check if data is stale */
  isStale: boolean;
  /** Check if cache is empty */
  isEmpty: boolean;
  /** Trigger background sync */
  triggerSync: () => void;
  /** Sync mutation state */
  isSyncing: boolean;
}

// ============================================================================
// API Fetcher
// ============================================================================

async function fetchWithdrawals(
  status: string = 'ALL',
  limit: number = 10000
): Promise<HybridWithdrawalsResult> {
  const params = new URLSearchParams();
  if (status !== 'ALL') params.set('status', status);
  if (limit) params.set('limit', String(limit));

  const queryString = params.toString();
  const url = `/ai-crm/api/withdrawals${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch withdrawals: ${response.status}`);
  }

  return response.json();
}

async function triggerSyncApi(): Promise<{ status: string; result?: unknown }> {
  const response = await fetch('/ai-crm/api/sync/withdrawals', {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Sync failed');
  }

  return response.json();
}

// ============================================================================
// Main Hook
// ============================================================================

export function useWithdrawals(options: UseWithdrawalsOptions = {}): UseWithdrawalsReturn {
  const {
    staleTime = 10 * 1000,        // 10 seconds (matches DB sync interval)
    refetchInterval = 30 * 1000,  // 30 seconds background refresh
    status = 'ALL',
    limit = 10000,  // Load all data for scrolling
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  // Main data query
  const query = useQuery({
    queryKey: [...WITHDRAWALS_QUERY_KEY, status, limit],
    queryFn: () => fetchWithdrawals(status, limit),
    staleTime,
    refetchInterval,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
    // Refetch on mount if stale
    refetchOnMount: 'always',
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: triggerSyncApi,
    onSuccess: () => {
      // Invalidate withdrawals query after successful sync
      queryClient.invalidateQueries({ queryKey: WITHDRAWALS_QUERY_KEY });
    },
  });

  // Manual refresh function
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: WITHDRAWALS_QUERY_KEY });
  }, [queryClient]);

  // Trigger background sync
  const triggerSync = useCallback(() => {
    syncMutation.mutate();
  }, [syncMutation]);

  // Extract data
  const data = query.data;
  const withdrawals = data?.withdrawals || [];
  const stats = data?.stats || null;
  const metadata = data?.metadata || null;

  return {
    withdrawals,
    stats,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    metadata,
    refresh,
    isStale: query.isStale,
    isEmpty: withdrawals.length === 0 && !query.isLoading,
    triggerSync,
    isSyncing: syncMutation.isPending,
  };
}

// ============================================================================
// Prefetch Helper (for Server Components)
// ============================================================================

/**
 * Prefetch withdrawals data for server-side rendering
 * Use with HydrationBoundary for optimal performance
 */
export async function prefetchWithdrawals(
  queryClient: ReturnType<typeof useQueryClient>,
  options: { status?: string; limit?: number } = {}
) {
  const { status = 'ALL', limit = 50 } = options;

  await queryClient.prefetchQuery({
    queryKey: [...WITHDRAWALS_QUERY_KEY, status, limit],
    queryFn: () => fetchWithdrawals(status, limit),
    staleTime: 10 * 1000,
  });
}

// ============================================================================
// Sync Status Hook
// ============================================================================

export interface SyncStatus {
  healthy: boolean;
  lastSyncedAt: string;
  recordCount: number;
  syncStatus: 'idle' | 'syncing' | 'error';
  isStale: boolean;
  lastError: string | null;
}

export function useSyncStatus() {
  return useQuery({
    queryKey: SYNC_STATUS_QUERY_KEY,
    queryFn: async (): Promise<SyncStatus> => {
      const response = await fetch('/ai-crm/api/sync/withdrawals');
      if (!response.ok) throw new Error('Failed to fetch sync status');
      const data = await response.json();
      return {
        healthy: data.healthy,
        lastSyncedAt: data.sync.lastSyncedAt,
        recordCount: data.sync.recordCount,
        syncStatus: data.sync.syncStatus,
        isStale: data.sync.isStale,
        lastError: data.sync.lastError,
      };
    },
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}
