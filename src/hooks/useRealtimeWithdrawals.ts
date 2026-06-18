'use client';

/**
 * useRealtimeWithdrawals Hook
 * Supabase Realtime subscription for live withdrawal updates
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Real-time Sync System
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { WITHDRAWALS_QUERY_KEY } from './useWithdrawals';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Withdrawal } from '@/types/supabase';

// ============================================================================
// Types
// ============================================================================

export interface RealtimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Withdrawal | null;
  oldRecord: Withdrawal | null;
  timestamp: Date;
}

export interface RealtimeStats {
  isConnected: boolean;
  insertCount: number;
  updateCount: number;
  deleteCount: number;
  lastEventAt: Date | null;
  connectionAttempts: number;
}

export interface UseRealtimeWithdrawalsOptions {
  /** Enable/disable realtime subscription */
  enabled?: boolean;
  /** Callback when new withdrawal is inserted */
  onInsert?: (record: Withdrawal) => void;
  /** Callback when withdrawal is updated */
  onUpdate?: (record: Withdrawal, oldRecord: Withdrawal) => void;
  /** Callback when withdrawal is deleted */
  onDelete?: (oldRecord: Withdrawal) => void;
  /** Show toast notifications for events */
  showNotifications?: boolean;
}

export interface UseRealtimeWithdrawalsReturn {
  /** Current connection status */
  isConnected: boolean;
  /** Recent events for display */
  recentEvents: RealtimeEvent[];
  /** Statistics */
  stats: RealtimeStats;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect */
  disconnect: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RECENT_EVENTS = 50;
const RECONNECT_DELAY_MS = 3000;

// ============================================================================
// Main Hook
// ============================================================================

export function useRealtimeWithdrawals(
  options: UseRealtimeWithdrawalsOptions = {}
): UseRealtimeWithdrawalsReturn {
  const {
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
  } = options;

  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);
  const [stats, setStats] = useState<RealtimeStats>({
    isConnected: false,
    insertCount: 0,
    updateCount: 0,
    deleteCount: 0,
    lastEventAt: null,
    connectionAttempts: 0,
  });

  /**
   * Add event to recent events list
   */
  const addEvent = useCallback((event: RealtimeEvent) => {
    setRecentEvents((prev) => {
      const updated = [event, ...prev];
      return updated.slice(0, MAX_RECENT_EVENTS);
    });
  }, []);

  /**
   * Handle postgres changes from Supabase
   */
  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Withdrawal>) => {
      const timestamp = new Date();

      console.log('[Realtime] Received event:', payload.eventType, payload);

      // Update stats
      setStats((prev) => ({
        ...prev,
        lastEventAt: timestamp,
        insertCount: prev.insertCount + (payload.eventType === 'INSERT' ? 1 : 0),
        updateCount: prev.updateCount + (payload.eventType === 'UPDATE' ? 1 : 0),
        deleteCount: prev.deleteCount + (payload.eventType === 'DELETE' ? 1 : 0),
      }));

      // Create event record
      const event: RealtimeEvent = {
        type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        record: (payload.new as Withdrawal) || null,
        oldRecord: (payload.old as Withdrawal) || null,
        timestamp,
      };

      addEvent(event);

      // Call appropriate callback
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new) {
            onInsert?.(payload.new as Withdrawal);
          }
          break;
        case 'UPDATE':
          if (payload.new && payload.old) {
            onUpdate?.(payload.new as Withdrawal, payload.old as Withdrawal);
          }
          break;
        case 'DELETE':
          if (payload.old) {
            onDelete?.(payload.old as Withdrawal);
          }
          break;
      }

      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: WITHDRAWALS_QUERY_KEY });
    },
    [queryClient, onInsert, onUpdate, onDelete, addEvent]
  );

  /**
   * Subscribe to Supabase Realtime
   */
  const subscribe = useCallback(() => {
    if (channelRef.current) {
      console.log('[Realtime] Already subscribed');
      return;
    }

    console.log('[Realtime] Subscribing to withdrawals table...');

    setStats((prev) => ({
      ...prev,
      connectionAttempts: prev.connectionAttempts + 1,
    }));

    const channel = supabase
      .channel('withdrawals-realtime')
      .on<Withdrawal>(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'withdrawals',
        },
        handleChange
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setStats((prev) => ({ ...prev, isConnected: true }));
          console.log('[Realtime] Successfully subscribed to withdrawals');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setStats((prev) => ({ ...prev, isConnected: false }));
          console.warn('[Realtime] Connection closed or error');

          // Schedule reconnect
          if (enabled) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[Realtime] Attempting reconnect...');
              channelRef.current = null;
              subscribe();
            }, RECONNECT_DELAY_MS);
          }
        }
      });

    channelRef.current = channel;
  }, [enabled, handleChange]);

  /**
   * Unsubscribe from Supabase Realtime
   */
  const unsubscribe = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (channelRef.current) {
      console.log('[Realtime] Unsubscribing...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
      setStats((prev) => ({ ...prev, isConnected: false }));
    }
  }, []);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    unsubscribe();
    subscribe();
  }, [unsubscribe, subscribe]);

  /**
   * Manual disconnect
   */
  const disconnect = useCallback(() => {
    unsubscribe();
  }, [unsubscribe]);

  // Effect: Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    if (enabled) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [enabled, subscribe, unsubscribe]);

  return {
    isConnected,
    recentEvents,
    stats,
    reconnect,
    disconnect,
  };
}

// ============================================================================
// Utility Hook: Connection Status Only
// ============================================================================

export function useRealtimeStatus(): { isConnected: boolean } {
  const { isConnected } = useRealtimeWithdrawals({ enabled: true });
  return { isConnected };
}
