/**
 * Positions Hook with Supabase Realtime
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3
 *
 * Subscribes to real-time position updates
 * Uses Supabase Realtime for instant updates
 */

'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type PositionSide = 'BUY' | 'SELL';

export interface Position {
  id: number;
  position_id: number;
  account_login: string;
  account_uuid: string | null;
  symbol: string;
  alias: string | null;
  volume: number;
  side: PositionSide;
  open_time: string;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  net_profit: number;
  swap: number;
  commission: number;
  margin: number;
  is_closed: boolean;
  closed_at: string | null;
  close_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface UsePositionsOptions {
  accountLogin?: string;
  symbol?: string;
  side?: PositionSide;
  openOnly?: boolean;
  limit?: number;
  enableRealtime?: boolean;
}

export interface UsePositionsResult {
  positions: Position[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  // Computed values
  totalProfit: number;
  totalVolume: number;
  buyPositions: number;
  sellPositions: number;
}

// ============================================================================
// Constants
// ============================================================================

const QUERY_KEY_BASE = 'positions';
const DEFAULT_LIMIT = 100;
const STALE_TIME = 5000; // 5 seconds

// ============================================================================
// Fetch Function
// ============================================================================

async function fetchPositions(options: UsePositionsOptions): Promise<Position[]> {
  
  let query = supabase
    .from('positions')
    .select('*')
    .order('open_time', { ascending: false })
    .limit(options.limit || DEFAULT_LIMIT);

  // Filter by account login
  if (options.accountLogin) {
    query = query.eq('account_login', options.accountLogin);
  }

  // Filter by symbol
  if (options.symbol) {
    query = query.eq('symbol', options.symbol);
  }

  // Filter by side
  if (options.side) {
    query = query.eq('side', options.side);
  }

  // Filter open positions only
  if (options.openOnly !== false) {
    query = query.eq('is_closed', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch positions: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// Hook
// ============================================================================

export function usePositions(options: UsePositionsOptions = {}): UsePositionsResult {
  const queryClient = useQueryClient();
  
  const {
    accountLogin,
    symbol,
    side,
    openOnly = true,
    limit = DEFAULT_LIMIT,
    enableRealtime = true,
  } = options;

  // Build query key
  const queryKey = useMemo(
    () => [QUERY_KEY_BASE, { accountLogin, symbol, side, openOnly, limit }],
    [accountLogin, symbol, side, openOnly, limit]
  );

  // Initial fetch
  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchPositions(options),
    staleTime: STALE_TIME,
    refetchInterval: 10000, // Refetch every 10 seconds for profit updates
  });

  // Handle position update from realtime
  const handlePositionUpdate = useCallback(
    (updatedPosition: Position) => {
      queryClient.setQueryData<Position[]>(queryKey, (oldPositions) => {
        if (!oldPositions) return [updatedPosition];

        const index = oldPositions.findIndex(
          (p) => p.position_id === updatedPosition.position_id
        );

        if (index === -1) {
          // New position
          return [updatedPosition, ...oldPositions].slice(0, limit);
        }

        // Update existing position
        const newPositions = [...oldPositions];
        newPositions[index] = updatedPosition;
        return newPositions;
      });
    },
    [queryClient, queryKey, limit]
  );

  // Handle position close from realtime
  const handlePositionClose = useCallback(
    (closedPosition: Position) => {
      if (openOnly) {
        // Remove closed position from list
        queryClient.setQueryData<Position[]>(queryKey, (oldPositions) => {
          if (!oldPositions) return [];
          return oldPositions.filter(
            (p) => p.position_id !== closedPosition.position_id
          );
        });
      } else {
        // Update closed position
        handlePositionUpdate(closedPosition);
      }
    },
    [queryClient, queryKey, openOnly, handlePositionUpdate]
  );

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('positions_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'positions',
        },
        (payload) => {
          const position = payload.new as Position;

          // Apply client-side filters
          if (accountLogin && position.account_login !== accountLogin) {
            return;
          }
          if (symbol && position.symbol !== symbol) {
            return;
          }
          if (side && position.side !== side) {
            return;
          }

          if (payload.eventType === 'INSERT') {
            handlePositionUpdate(position);
          } else if (payload.eventType === 'UPDATE') {
            if (position.is_closed) {
              handlePositionClose(position);
            } else {
              handlePositionUpdate(position);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
    enableRealtime,
    accountLogin,
    symbol,
    side,
    handlePositionUpdate,
    handlePositionClose,
  ]);

  // Calculate computed values
  const computed = useMemo(() => {
    let totalProfit = 0;
    let totalVolume = 0;
    let buyPositions = 0;
    let sellPositions = 0;

    for (const pos of positions) {
      totalProfit += pos.profit || 0;
      totalVolume += pos.volume || 0;
      if (pos.side === 'BUY') buyPositions++;
      else if (pos.side === 'SELL') sellPositions++;
    }

    return { totalProfit, totalVolume, buyPositions, sellPositions };
  }, [positions]);

  return {
    positions,
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
 * Hook to get positions for a specific account
 */
export function useAccountPositions(accountLogin: string) {
  return usePositions({
    accountLogin,
    openOnly: true,
  });
}

/**
 * Hook to get positions for a specific symbol
 */
export function useSymbolPositions(symbol: string) {
  return usePositions({
    symbol,
    openOnly: true,
  });
}

/**
 * Hook to get all open positions
 */
export function useOpenPositions() {
  return usePositions({
    openOnly: true,
  });
}
