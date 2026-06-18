/**
 * Trading Events Hook with Supabase Realtime
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 2
 *
 * Subscribes to real-time trading events (margin calls, stop-outs, TP/SL)
 * Uses Supabase Realtime for instant updates
 */

'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type TradingEventType =
  | 'MARGIN_CALL'
  | 'STOP_OUT'
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'ORDER_ACTIVATION'
  | 'POSITION_CLOSE'
  | 'POSITION_MODIFY'
  | 'ORDER_CANCEL'
  | 'OTHER';

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface TradingEvent {
  id: number;
  uuid: string;
  event_type: TradingEventType;
  account_login: string;
  account_uuid: string | null;
  account_group: string | null;
  symbol: string | null;
  position_id: number | null;
  order_id: number | null;
  volume: number | null;
  price: number | null;
  profit: number | null;
  details: Record<string, unknown>;
  severity: EventSeverity;
  event_time: string;
  created_at: string;
  synced_at: string;
}

export interface UseTradingEventsOptions {
  accountLogin?: string;
  eventTypes?: TradingEventType[];
  severity?: EventSeverity[];
  limit?: number;
  enableRealtime?: boolean;
}

export interface UseTradingEventsResult {
  events: TradingEvent[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  criticalCount: number;
  warningCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const QUERY_KEY_BASE = 'trading-events';
const DEFAULT_LIMIT = 100;
const STALE_TIME = 10000; // 10 seconds

// ============================================================================
// Fetch Function
// ============================================================================

async function fetchTradingEvents(options: UseTradingEventsOptions): Promise<TradingEvent[]> {
  
  let query = supabase
    .from('trading_events')
    .select('*')
    .order('event_time', { ascending: false })
    .limit(options.limit || DEFAULT_LIMIT);

  // Filter by account login
  if (options.accountLogin) {
    query = query.eq('account_login', options.accountLogin);
  }

  // Filter by event types
  if (options.eventTypes && options.eventTypes.length > 0) {
    query = query.in('event_type', options.eventTypes);
  }

  // Filter by severity
  if (options.severity && options.severity.length > 0) {
    query = query.in('severity', options.severity);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch trading events: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// Hook
// ============================================================================

export function useTradingEvents(
  options: UseTradingEventsOptions = {}
): UseTradingEventsResult {
  const queryClient = useQueryClient();
  
  const {
    accountLogin,
    eventTypes,
    severity,
    limit = DEFAULT_LIMIT,
    enableRealtime = true,
  } = options;

  // Build query key
  const queryKey = useMemo(
    () => [QUERY_KEY_BASE, { accountLogin, eventTypes, severity, limit }],
    [accountLogin, eventTypes, severity, limit]
  );

  // Initial fetch
  const {
    data: events = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchTradingEvents(options),
    staleTime: STALE_TIME,
  });

  // Handle new event from realtime
  const handleNewEvent = useCallback(
    (newEvent: TradingEvent) => {
      queryClient.setQueryData<TradingEvent[]>(queryKey, (oldEvents) => {
        if (!oldEvents) return [newEvent];

        // Check if event already exists
        const exists = oldEvents.some((e) => e.uuid === newEvent.uuid);
        if (exists) return oldEvents;

        // Add new event at the beginning, maintain limit
        const updatedEvents = [newEvent, ...oldEvents];
        return updatedEvents.slice(0, limit);
      });
    },
    [queryClient, queryKey, limit]
  );

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('trading_events_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trading_events',
        },
        (payload) => {
          const newEvent = payload.new as TradingEvent;

          // Apply client-side filters
          if (accountLogin && newEvent.account_login !== accountLogin) {
            return;
          }

          if (eventTypes && eventTypes.length > 0) {
            if (!eventTypes.includes(newEvent.event_type)) {
              return;
            }
          }

          if (severity && severity.length > 0) {
            if (!severity.includes(newEvent.severity)) {
              return;
            }
          }

          handleNewEvent(newEvent);
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
    eventTypes,
    severity,
    handleNewEvent,
  ]);

  // Calculate severity counts
  const { criticalCount, warningCount } = useMemo(() => {
    let critical = 0;
    let warning = 0;

    for (const event of events) {
      if (event.severity === 'CRITICAL') critical++;
      else if (event.severity === 'WARNING') warning++;
    }

    return { criticalCount: critical, warningCount: warning };
  }, [events]);

  return {
    events,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    criticalCount,
    warningCount,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get only critical events (margin calls, stop-outs)
 */
export function useCriticalEvents(accountLogin?: string) {
  return useTradingEvents({
    accountLogin,
    eventTypes: ['MARGIN_CALL', 'STOP_OUT'],
    severity: ['CRITICAL'],
    limit: 50,
  });
}

/**
 * Hook to get recent TP/SL events
 */
export function useTakeProfitStopLossEvents(accountLogin?: string) {
  return useTradingEvents({
    accountLogin,
    eventTypes: ['TAKE_PROFIT', 'STOP_LOSS'],
    limit: 50,
  });
}
