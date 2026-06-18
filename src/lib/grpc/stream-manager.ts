/**
 * Unified gRPC Stream Manager
 * Manages all gRPC streams with centralized control
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3
 *
 * Features:
 * - Centralized start/stop for all streams
 * - Health monitoring and auto-reconnection
 * - Aggregated statistics
 * - Event-based notifications
 */

import {
  LedgerStreamService,
  LedgerStreamConfig,
  startGlobalStream as startLedgerStream,
  stopGlobalStream as stopLedgerStream,
  getStreamService as getLedgerStream,
} from './ledger-stream';

import {
  TradingEventsStreamService,
  TradingEventsStreamConfig,
  startGlobalTradingEventsStream,
  stopGlobalTradingEventsStream,
  getTradingEventsStream,
} from './trading-events-stream';

import {
  EquityStreamService,
  EquityStreamConfig,
  startGlobalEquityStream,
  stopGlobalEquityStream,
  getEquityStream,
} from './equity-stream';

import {
  PositionsStreamService,
  PositionsStreamConfig,
  startGlobalPositionsStream,
  stopGlobalPositionsStream,
  getPositionsStream,
} from './positions-stream';

import {
  OrdersStreamService,
  OrdersStreamConfig,
  startGlobalOrdersStream,
  stopGlobalOrdersStream,
  getOrdersStream,
} from './orders-stream';

// ============================================================================
// Types
// ============================================================================

export type StreamName = 'ledgers' | 'tradingEvents' | 'equity' | 'positions' | 'orders';
export type StreamPriority = 'critical' | 'high' | 'medium' | 'low';

export interface StreamConfig {
  name: StreamName;
  priority: StreamPriority;
  enabled: boolean;
  bufferMs: number;
  table: string;
}

export interface StreamStatus {
  name: StreamName;
  isConnected: boolean;
  totalReceived: number;
  lastEventAt: Date | null;
  reconnectCount: number;
  error: string | null;
}

export interface ManagerConfig {
  ledgers?: Partial<LedgerStreamConfig>;
  tradingEvents?: Partial<TradingEventsStreamConfig>;
  equity?: Partial<EquityStreamConfig>;
  positions?: Partial<PositionsStreamConfig>;
  orders?: Partial<OrdersStreamConfig>;
  enabledStreams?: StreamName[];
  onStatusChange?: (status: StreamStatus) => void;
  onError?: (streamName: StreamName, error: Error) => void;
}

export interface ManagerStats {
  isRunning: boolean;
  startedAt: Date | null;
  uptime: number; // in seconds
  streams: Record<StreamName, StreamStatus>;
  totalEventsReceived: number;
  totalReconnects: number;
}

// ============================================================================
// Stream Configurations
// ============================================================================

const STREAM_CONFIGS: StreamConfig[] = [
  {
    name: 'ledgers',
    priority: 'critical',
    enabled: true,
    bufferMs: 100,
    table: 'withdrawals',
  },
  {
    name: 'tradingEvents',
    priority: 'critical',
    enabled: true,
    bufferMs: 100,
    table: 'trading_events',
  },
  {
    name: 'equity',
    priority: 'high',
    enabled: true,
    bufferMs: 5000,
    table: 'account_equity',
  },
  {
    name: 'positions',
    priority: 'high',
    enabled: true,
    bufferMs: 1000,
    table: 'positions',
  },
  {
    name: 'orders',
    priority: 'medium',
    enabled: true,
    bufferMs: 1000,
    table: 'pending_orders',
  },
];

// ============================================================================
// Unified Stream Manager
// ============================================================================

export class GrpcStreamManager {
  private config: ManagerConfig;
  private isRunning = false;
  private startedAt: Date | null = null;
  private statusInterval: NodeJS.Timeout | null = null;
  private streamErrors: Map<StreamName, string | null> = new Map();

  // Stream instances (accessed via getters)
  private ledgersStream: LedgerStreamService | null = null;
  private tradingEventsStream: TradingEventsStreamService | null = null;
  private equityStream: EquityStreamService | null = null;
  private positionsStream: PositionsStreamService | null = null;
  private ordersStream: OrdersStreamService | null = null;

  constructor(config: ManagerConfig = {}) {
    this.config = {
      enabledStreams: ['ledgers', 'tradingEvents', 'equity', 'positions', 'orders'],
      ...config,
    };

    // Initialize error tracking
    for (const streamConfig of STREAM_CONFIGS) {
      this.streamErrors.set(streamConfig.name, null);
    }
  }

  /**
   * Start all enabled streams
   */
  async startAll(): Promise<void> {
    if (this.isRunning) {
      console.log('[StreamManager] Already running');
      return;
    }

    console.log('[StreamManager] Starting all streams...');
    this.startedAt = new Date();

    const enabledStreams = this.config.enabledStreams || [];

    // Start streams in priority order (critical first)
    const sortedConfigs = [...STREAM_CONFIGS].sort((a, b) => {
      const priorityOrder: Record<StreamPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const streamConfig of sortedConfigs) {
      if (!enabledStreams.includes(streamConfig.name)) {
        console.log(`[StreamManager] Skipping disabled stream: ${streamConfig.name}`);
        continue;
      }

      try {
        await this.startStream(streamConfig.name);
        console.log(`[StreamManager] Started stream: ${streamConfig.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[StreamManager] Failed to start ${streamConfig.name}:`, errorMessage);
        this.streamErrors.set(streamConfig.name, errorMessage);
        this.config.onError?.(streamConfig.name, error as Error);
      }
    }

    this.isRunning = true;

    // Start status monitoring
    this.startStatusMonitoring();

    console.log('[StreamManager] All streams started');
  }

  /**
   * Start a specific stream
   */
  private async startStream(name: StreamName): Promise<void> {
    switch (name) {
      case 'ledgers':
        this.ledgersStream = await startLedgerStream(this.config.ledgers);
        break;
      case 'tradingEvents':
        this.tradingEventsStream = await startGlobalTradingEventsStream(this.config.tradingEvents);
        break;
      case 'equity':
        this.equityStream = await startGlobalEquityStream(this.config.equity);
        break;
      case 'positions':
        this.positionsStream = await startGlobalPositionsStream(this.config.positions);
        break;
      case 'orders':
        this.ordersStream = await startGlobalOrdersStream(this.config.orders);
        break;
    }
  }

  /**
   * Stop all streams
   */
  async stopAll(): Promise<void> {
    if (!this.isRunning) {
      console.log('[StreamManager] Not running');
      return;
    }

    console.log('[StreamManager] Stopping all streams...');

    // Stop status monitoring
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    // Stop all streams
    await Promise.all([
      stopLedgerStream(),
      stopGlobalTradingEventsStream(),
      stopGlobalEquityStream(),
      stopGlobalPositionsStream(),
      stopGlobalOrdersStream(),
    ]);

    this.ledgersStream = null;
    this.tradingEventsStream = null;
    this.equityStream = null;
    this.positionsStream = null;
    this.ordersStream = null;

    this.isRunning = false;
    this.startedAt = null;

    console.log('[StreamManager] All streams stopped');
  }

  /**
   * Restart a specific stream
   */
  async restartStream(name: StreamName): Promise<void> {
    console.log(`[StreamManager] Restarting stream: ${name}`);

    // Stop the stream
    switch (name) {
      case 'ledgers':
        stopLedgerStream();
        break;
      case 'tradingEvents':
        await stopGlobalTradingEventsStream();
        break;
      case 'equity':
        await stopGlobalEquityStream();
        break;
      case 'positions':
        await stopGlobalPositionsStream();
        break;
      case 'orders':
        await stopGlobalOrdersStream();
        break;
    }

    // Clear error
    this.streamErrors.set(name, null);

    // Start the stream again
    try {
      await this.startStream(name);
      console.log(`[StreamManager] Restarted stream: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.streamErrors.set(name, errorMessage);
      throw error;
    }
  }

  /**
   * Get status of a specific stream
   */
  getStreamStatus(name: StreamName): StreamStatus {
    // Get stream based on name
    const ledgerStream = name === 'ledgers' ? getLedgerStream() : null;
    const tradingEventsStream = name === 'tradingEvents' ? getTradingEventsStream() : null;
    const equityStream = name === 'equity' ? getEquityStream() : null;
    const positionsStream = name === 'positions' ? getPositionsStream() : null;
    const ordersStream = name === 'orders' ? getOrdersStream() : null;

    // Default status for not started streams
    const defaultStatus: StreamStatus = {
      name,
      isConnected: false,
      totalReceived: 0,
      lastEventAt: null,
      reconnectCount: 0,
      error: this.streamErrors.get(name) || 'Stream not started',
    };

    // Handle each stream type
    if (ledgerStream) {
      const stats = ledgerStream.getStats();
      return {
        name,
        isConnected: stats.isConnected,
        totalReceived: stats.totalReceived,
        lastEventAt: stats.lastEventAt,
        reconnectCount: stats.reconnectCount,
        error: this.streamErrors.get(name) || null,
      };
    }

    if (tradingEventsStream) {
      const stats = tradingEventsStream.getStats();
      return {
        name,
        isConnected: stats.isConnected,
        totalReceived: stats.totalReceived,
        lastEventAt: stats.lastEventAt,
        reconnectCount: stats.reconnectCount,
        error: this.streamErrors.get(name) || null,
      };
    }

    if (equityStream) {
      const stats = equityStream.getStats();
      return {
        name,
        isConnected: stats.isConnected,
        totalReceived: stats.totalReceived,
        lastEventAt: stats.lastUpdateAt, // Equity uses lastUpdateAt
        reconnectCount: stats.reconnectCount,
        error: this.streamErrors.get(name) || null,
      };
    }

    if (positionsStream) {
      const stats = positionsStream.getStats();
      return {
        name,
        isConnected: stats.isConnected,
        totalReceived: stats.totalReceived,
        lastEventAt: stats.lastUpdateAt,
        reconnectCount: stats.reconnectCount,
        error: this.streamErrors.get(name) || null,
      };
    }

    if (ordersStream) {
      const stats = ordersStream.getStats();
      return {
        name,
        isConnected: stats.isConnected,
        totalReceived: stats.totalReceived,
        lastEventAt: stats.lastUpdateAt,
        reconnectCount: stats.reconnectCount,
        error: this.streamErrors.get(name) || null,
      };
    }

    return defaultStatus;
  }

  /**
   * Get aggregated manager statistics
   */
  getStats(): ManagerStats {
    const streams: Record<StreamName, StreamStatus> = {
      ledgers: this.getStreamStatus('ledgers'),
      tradingEvents: this.getStreamStatus('tradingEvents'),
      equity: this.getStreamStatus('equity'),
      positions: this.getStreamStatus('positions'),
      orders: this.getStreamStatus('orders'),
    };

    let totalEventsReceived = 0;
    let totalReconnects = 0;

    for (const status of Object.values(streams)) {
      totalEventsReceived += status.totalReceived;
      totalReconnects += status.reconnectCount;
    }

    const uptime = this.startedAt
      ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
      : 0;

    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      uptime,
      streams,
      totalEventsReceived,
      totalReconnects,
    };
  }

  /**
   * Start status monitoring
   */
  private startStatusMonitoring(): void {
    // Check status every 30 seconds
    this.statusInterval = setInterval(() => {
      const stats = this.getStats();

      // Log status
      console.log('[StreamManager] Status:', JSON.stringify({
        uptime: stats.uptime,
        totalEvents: stats.totalEventsReceived,
        reconnects: stats.totalReconnects,
        connected: Object.values(stats.streams).filter((s) => s.isConnected).length,
      }));

      // Notify status changes
      for (const [name, status] of Object.entries(stats.streams)) {
        this.config.onStatusChange?.(status);
      }
    }, 30000);
  }

  /**
   * Get specific stream service instance
   */
  getLedgersStream(): LedgerStreamService | null {
    return getLedgerStream();
  }

  getTradingEventsStream(): TradingEventsStreamService | null {
    return getTradingEventsStream();
  }

  getEquityStream(): EquityStreamService | null {
    return getEquityStream();
  }

  getPositionsStream(): PositionsStreamService | null {
    return getPositionsStream();
  }

  getOrdersStream(): OrdersStreamService | null {
    return getOrdersStream();
  }

  /**
   * Check if manager is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Global Manager Instance
// ============================================================================

let globalManager: GrpcStreamManager | null = null;

/**
 * Get or create the global stream manager
 */
export function getGlobalStreamManager(config?: ManagerConfig): GrpcStreamManager {
  if (!globalManager) {
    globalManager = new GrpcStreamManager(config);
  }
  return globalManager;
}

/**
 * Start all global streams
 */
export async function startAllStreams(config?: ManagerConfig): Promise<GrpcStreamManager> {
  const manager = getGlobalStreamManager(config);
  await manager.startAll();
  return manager;
}

/**
 * Stop all global streams
 */
export async function stopAllStreams(): Promise<void> {
  if (globalManager) {
    await globalManager.stopAll();
  }
}

/**
 * Get global stream manager stats
 */
export function getStreamManagerStats(): ManagerStats | null {
  if (!globalManager) {
    return null;
  }
  return globalManager.getStats();
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  LedgerStreamConfig,
  TradingEventsStreamConfig,
  EquityStreamConfig,
  PositionsStreamConfig,
  OrdersStreamConfig,
};
