'use client';

/**
 * useDeposits Hook
 * React Query hook for fetching deposits with SWR pattern
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Virtual Scrolling Optimization
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import type { DepositEvent, PaymentStats, ApiMetadata } from '@/types/payment';

// ============================================================================
// Query Keys
// ============================================================================

export const DEPOSITS_QUERY_KEY = ['deposits'] as const;

// ============================================================================
// Types
// ============================================================================

export interface UseDepositsOptions {
  /** Time in ms before data is considered stale (default: 10s) */
  staleTime?: number;
  /** Background refetch interval in ms (default: 30s) */
  refetchInterval?: number;
  /** Filter by status */
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface DepositsApiResult {
  deposits: DepositEvent[];
  stats: PaymentStats;
  metadata?: ApiMetadata;
  error?: string;
}

export interface UseDepositsReturn {
  /** Deposit events for display */
  deposits: DepositEvent[];
  /** Calculated statistics */
  stats: PaymentStats | null;
  /** Loading state (first load) */
  isLoading: boolean;
  /** Fetching state (background refetch) */
  isFetching: boolean;
  /** Error state */
  isError: boolean;
  /** Error message */
  error: string | null;
  /** Data source metadata */
  metadata: ApiMetadata | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Check if data is stale */
  isStale: boolean;
  /** Check if cache is empty */
  isEmpty: boolean;
  /** Online status */
  isOnline: boolean;
}

// ============================================================================
// API Fetcher
// ============================================================================

async function fetchDeposits(
  status: string = 'ALL'
): Promise<DepositsApiResult> {
  const params = new URLSearchParams();
  if (status !== 'ALL') params.set('status', status);

  const queryString = params.toString();
  const url = `/ai-crm/api/deposits${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch deposits: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Main Hook
// ============================================================================

export function useDeposits(options: UseDepositsOptions = {}): UseDepositsReturn {
  const {
    staleTime = 10 * 1000,        // 10 seconds
    refetchInterval = 30 * 1000,  // 30 seconds background refresh
    status = 'ALL',
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Main data query
  const query = useQuery({
    queryKey: [...DEPOSITS_QUERY_KEY, status],
    queryFn: () => fetchDeposits(status),
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

  // Manual refresh function
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: DEPOSITS_QUERY_KEY });
  }, [queryClient]);

  // Extract data
  const data = query.data;
  const deposits = data?.deposits || [];
  const stats = data?.stats || null;
  const metadata = data?.metadata || null;

  return {
    deposits,
    stats,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error?.message || data?.error || null,
    metadata,
    refresh,
    isStale: query.isStale,
    isEmpty: deposits.length === 0 && !query.isLoading,
    isOnline,
  };
}

// ============================================================================
// Prefetch Helper (for Server Components)
// ============================================================================

/**
 * Prefetch deposits data for server-side rendering
 * Use with HydrationBoundary for optimal performance
 */
export async function prefetchDeposits(
  queryClient: ReturnType<typeof useQueryClient>,
  options: { status?: string } = {}
) {
  const { status = 'ALL' } = options;

  await queryClient.prefetchQuery({
    queryKey: [...DEPOSITS_QUERY_KEY, status],
    queryFn: () => fetchDeposits(status),
    staleTime: 10 * 1000,
  });
}
