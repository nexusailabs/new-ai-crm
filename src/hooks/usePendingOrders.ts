/**
 * Pending Orders Hook with Supabase Realtime
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3
 *
 * Subscribes to real-time pending order updates
 * Uses Supabase Realtime for instant updates
 */

'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type OrderType =
  | 'BUY_LIMIT'
  | 'SELL_LIMIT'
  | 'BUY_STOP'
  | 'SELL_STOP'
  | 'BUY_STOP_LIMIT'
  | 'SELL_STOP_LIMIT';

export type OrderStatus =
  | 'PENDING'
  | 'ACTIVATED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FILLED';

export interface PendingOrder {
  id: number;
  order_id: number;
  account_login: string;
  account_uuid: string | null;
  symbol: string;
  order_type: OrderType;
  volume: number;
  activation_price: number;
  limit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: OrderStatus;
  created_at: string;
  expiration_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  comment: string | null;
  updated_at: string;
  synced_at: string;
}

export interface UsePendingOrdersOptions {
  accountLogin?: string;
  symbol?: string;
  orderTypes?: OrderType[];
  status?: OrderStatus[];
  pendingOnly?: boolean;
  limit?: number;
  enableRealtime?: boolean;
}

export interface UsePendingOrdersResult {
  orders: PendingOrder[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  // Computed values
  buyLimitCount: number;
  sellLimitCount: number;
  buyStopCount: number;
  sellStopCount: number;
  totalOrders: number;
}

// ============================================================================
// Constants
// ============================================================================

const QUERY_KEY_BASE = 'pending-orders';
const DEFAULT_LIMIT = 100;
const STALE_TIME = 5000; // 5 seconds

// ============================================================================
// Fetch Function
// ============================================================================

async function fetchPendingOrders(options: UsePendingOrdersOptions): Promise<PendingOrder[]> {
  
  let query = supabase
    .from('pending_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit || DEFAULT_LIMIT);

  // Filter by account login
  if (options.accountLogin) {
    query = query.eq('account_login', options.accountLogin);
  }

  // Filter by symbol
  if (options.symbol) {
    query = query.eq('symbol', options.symbol);
  }

  // Filter by order types
  if (options.orderTypes && options.orderTypes.length > 0) {
    query = query.in('order_type', options.orderTypes);
  }

  // Filter by status
  if (options.status && options.status.length > 0) {
    query = query.in('status', options.status);
  } else if (options.pendingOnly !== false) {
    // Default: pending orders only
    query = query.eq('status', 'PENDING');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch pending orders: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// Hook
// ============================================================================

export function usePendingOrders(options: UsePendingOrdersOptions = {}): UsePendingOrdersResult {
  const queryClient = useQueryClient();
  
  const {
    accountLogin,
    symbol,
    orderTypes,
    status,
    pendingOnly = true,
    limit = DEFAULT_LIMIT,
    enableRealtime = true,
  } = options;

  // Build query key
  const queryKey = useMemo(
    () => [QUERY_KEY_BASE, { accountLogin, symbol, orderTypes, status, pendingOnly, limit }],
    [accountLogin, symbol, orderTypes, status, pendingOnly, limit]
  );

  // Initial fetch
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchPendingOrders(options),
    staleTime: STALE_TIME,
  });

  // Handle order update from realtime
  const handleOrderUpdate = useCallback(
    (updatedOrder: PendingOrder) => {
      queryClient.setQueryData<PendingOrder[]>(queryKey, (oldOrders) => {
        if (!oldOrders) return [updatedOrder];

        const index = oldOrders.findIndex(
          (o) => o.order_id === updatedOrder.order_id
        );

        if (index === -1) {
          // New order
          return [updatedOrder, ...oldOrders].slice(0, limit);
        }

        // Update existing order
        const newOrders = [...oldOrders];
        newOrders[index] = updatedOrder;
        return newOrders;
      });
    },
    [queryClient, queryKey, limit]
  );

  // Handle order removal (activated, cancelled, expired)
  const handleOrderRemove = useCallback(
    (removedOrder: PendingOrder) => {
      if (pendingOnly) {
        // Remove from list
        queryClient.setQueryData<PendingOrder[]>(queryKey, (oldOrders) => {
          if (!oldOrders) return [];
          return oldOrders.filter(
            (o) => o.order_id !== removedOrder.order_id
          );
        });
      } else {
        // Update with new status
        handleOrderUpdate(removedOrder);
      }
    },
    [queryClient, queryKey, pendingOnly, handleOrderUpdate]
  );

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('pending_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_orders',
        },
        (payload) => {
          const order = payload.new as PendingOrder;

          // Apply client-side filters
          if (accountLogin && order.account_login !== accountLogin) {
            return;
          }
          if (symbol && order.symbol !== symbol) {
            return;
          }
          if (orderTypes && orderTypes.length > 0) {
            if (!orderTypes.includes(order.order_type)) {
              return;
            }
          }

          if (payload.eventType === 'INSERT') {
            if (order.status === 'PENDING' || !pendingOnly) {
              handleOrderUpdate(order);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (order.status !== 'PENDING') {
              handleOrderRemove(order);
            } else {
              handleOrderUpdate(order);
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
    orderTypes,
    pendingOnly,
    handleOrderUpdate,
    handleOrderRemove,
  ]);

  // Calculate computed values
  const computed = useMemo(() => {
    let buyLimitCount = 0;
    let sellLimitCount = 0;
    let buyStopCount = 0;
    let sellStopCount = 0;

    for (const order of orders) {
      switch (order.order_type) {
        case 'BUY_LIMIT':
          buyLimitCount++;
          break;
        case 'SELL_LIMIT':
          sellLimitCount++;
          break;
        case 'BUY_STOP':
        case 'BUY_STOP_LIMIT':
          buyStopCount++;
          break;
        case 'SELL_STOP':
        case 'SELL_STOP_LIMIT':
          sellStopCount++;
          break;
      }
    }

    return {
      buyLimitCount,
      sellLimitCount,
      buyStopCount,
      sellStopCount,
      totalOrders: orders.length,
    };
  }, [orders]);

  return {
    orders,
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
 * Hook to get pending orders for a specific account
 */
export function useAccountPendingOrders(accountLogin: string) {
  return usePendingOrders({
    accountLogin,
    pendingOnly: true,
  });
}

/**
 * Hook to get pending orders for a specific symbol
 */
export function useSymbolPendingOrders(symbol: string) {
  return usePendingOrders({
    symbol,
    pendingOnly: true,
  });
}

/**
 * Hook to get all pending limit orders
 */
export function useLimitOrders() {
  return usePendingOrders({
    orderTypes: ['BUY_LIMIT', 'SELL_LIMIT'],
    pendingOnly: true,
  });
}

/**
 * Hook to get all pending stop orders
 */
export function useStopOrders() {
  return usePendingOrders({
    orderTypes: ['BUY_STOP', 'SELL_STOP', 'BUY_STOP_LIMIT', 'SELL_STOP_LIMIT'],
    pendingOnly: true,
  });
}
