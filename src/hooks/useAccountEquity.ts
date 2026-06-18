/**
 * Account Equity Hook with Polling
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 2
 *
 * Uses polling instead of Realtime subscription for equity data
 * This reduces server load as equity updates are high-frequency
 *
 * Per Architecture Doc Section 5.2:
 * - Frontend uses 30-second polling interval
 * - Realtime NOT used for equity to reduce WebSocket load
 */

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type AccountTier = 'VIP' | 'ACTIVE' | 'DORMANT' | 'STANDARD';

export interface AccountEquity {
  id: number;
  account_login: string;
  account_uuid: string | null;
  account_group: string | null;
  equity: number;
  balance: number;
  credit: number;
  margin: number;
  free_margin: number;
  margin_level: number | null;
  floating_pl: number;
  closed_pl_today: number;
  tier: AccountTier;
  last_activity_at: string | null;
  updated_at: string;
  synced_at: string;
}

export interface UseAccountEquityOptions {
  login?: string;
  logins?: string[];
  group?: string;
  tier?: AccountTier;
  pollingInterval?: number; // in milliseconds
  enabled?: boolean;
}

export interface UseAccountEquityResult {
  equity: AccountEquity | null;
  equities: AccountEquity[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  // Computed values
  totalEquity: number;
  totalBalance: number;
  averageMarginLevel: number | null;
  lowMarginAccounts: AccountEquity[];
}

// ============================================================================
// Constants
// ============================================================================

const QUERY_KEY_BASE = 'account-equity';
const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds per architecture doc
const STALE_TIME = 10000; // 10 seconds
const LOW_MARGIN_THRESHOLD = 150; // 150% margin level

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchSingleEquity(login: string): Promise<AccountEquity | null> {
  const { data, error } = await supabase
    .from('account_equity')
    .select('*')
    .eq('account_login', login)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch equity for ${login}: ${error.message}`);
  }

  return data;
}

async function fetchMultipleEquities(options: UseAccountEquityOptions): Promise<AccountEquity[]> {
  let query = supabase
    .from('account_equity')
    .select('*')
    .order('equity', { ascending: false });

  // Filter by multiple logins
  if (options.logins && options.logins.length > 0) {
    query = query.in('account_login', options.logins);
  }

  // Filter by group
  if (options.group) {
    query = query.eq('account_group', options.group);
  }

  // Filter by tier
  if (options.tier) {
    query = query.eq('tier', options.tier);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch equities: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// Single Account Hook
// ============================================================================

export function useAccountEquity(
  login: string,
  options: Omit<UseAccountEquityOptions, 'login' | 'logins'> = {}
): Omit<UseAccountEquityResult, 'equities' | 'totalEquity' | 'totalBalance' | 'averageMarginLevel' | 'lowMarginAccounts'> & { equity: AccountEquity | null } {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
  } = options;

  const queryKey = [QUERY_KEY_BASE, 'single', login];

  const {
    data: equity = null,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchSingleEquity(login),
    staleTime: STALE_TIME,
    refetchInterval: enabled ? pollingInterval : false,
    enabled: enabled && !!login,
  });

  return {
    equity,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// Multiple Accounts Hook
// ============================================================================

export function useAccountEquities(
  options: UseAccountEquityOptions = {}
): UseAccountEquityResult {
  const {
    logins,
    group,
    tier,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
  } = options;

  const queryKey = useMemo(
    () => [QUERY_KEY_BASE, 'multiple', { logins, group, tier }],
    [logins, group, tier]
  );

  const {
    data: equities = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchMultipleEquities(options),
    staleTime: STALE_TIME,
    refetchInterval: enabled ? pollingInterval : false,
    enabled,
  });

  // Compute aggregated values
  const computed = useMemo(() => {
    if (equities.length === 0) {
      return {
        totalEquity: 0,
        totalBalance: 0,
        averageMarginLevel: null,
        lowMarginAccounts: [],
      };
    }

    let totalEquity = 0;
    let totalBalance = 0;
    let marginLevelSum = 0;
    let marginLevelCount = 0;
    const lowMarginAccounts: AccountEquity[] = [];

    for (const eq of equities) {
      totalEquity += eq.equity;
      totalBalance += eq.balance;

      if (eq.margin_level !== null) {
        marginLevelSum += eq.margin_level;
        marginLevelCount++;

        if (eq.margin_level < LOW_MARGIN_THRESHOLD) {
          lowMarginAccounts.push(eq);
        }
      }
    }

    return {
      totalEquity,
      totalBalance,
      averageMarginLevel: marginLevelCount > 0 ? marginLevelSum / marginLevelCount : null,
      lowMarginAccounts,
    };
  }, [equities]);

  return {
    equity: equities[0] || null,
    equities,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    ...computed,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to monitor low margin accounts only
 */
export function useLowMarginAccounts(
  threshold: number = LOW_MARGIN_THRESHOLD,
  pollingInterval: number = 15000 // More frequent for critical monitoring
) {
  const { equities, ...rest } = useAccountEquities({
    pollingInterval,
  });

  const lowMarginAccounts = useMemo(
    () => equities.filter((eq) => eq.margin_level !== null && eq.margin_level < threshold),
    [equities, threshold]
  );

  return {
    accounts: lowMarginAccounts,
    count: lowMarginAccounts.length,
    ...rest,
  };
}

/**
 * Hook for VIP accounts with more frequent updates
 */
export function useVIPAccountEquities(pollingInterval: number = 10000) {
  return useAccountEquities({
    tier: 'VIP',
    pollingInterval,
  });
}

/**
 * Hook to get equity for a specific group
 */
export function useGroupEquities(group: string, pollingInterval?: number) {
  return useAccountEquities({
    group,
    pollingInterval,
  });
}
