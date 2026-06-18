/**
 * Match-Trade gRPC Positions Stream Service
 * Real-time subscription to open positions
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3
 *
 * Features:
 * - 1-second buffering for high-frequency updates
 * - Deduplication by position_id (keeps latest)
 * - Automatic closed position handling
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { createServerClient } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface Position {
  positionId: number;
  accountLogin: string;
  accountUuid: string;
  symbol: string;
  alias: string;
  volume: number;
  side: PositionSide;
  openTime: number; // Unix timestamp in ms
  openPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  netProfit: number;
  swap: number;
  commission: number;
  margin: number;
  isClosed: boolean;
  closedAt: number;
  closePrice: number;
}

export enum PositionSide {
  UNKNOWN_SIDE = 0,
  BUY = 1,
  SELL = 2,
}

export enum UpdateType {
  UNKNOWN_UPDATE = 0,
  NEW = 1,
  MODIFY = 2,
  CLOSE = 3,
}

export interface PositionUpdate {
  position: Position;
  updateType: UpdateType;
}

export const PositionSideNames: Record<PositionSide, string> = {
  [PositionSide.UNKNOWN_SIDE]: 'UNKNOWN',
  [PositionSide.BUY]: 'BUY',
  [PositionSide.SELL]: 'SELL',
};

export const UpdateTypeNames: Record<UpdateType, string> = {
  [UpdateType.UNKNOWN_UPDATE]: 'UNKNOWN',
  [UpdateType.NEW]: 'NEW',
  [UpdateType.MODIFY]: 'MODIFY',
  [UpdateType.CLOSE]: 'CLOSE',
};

export interface PositionsStreamConfig {
  serverAddress: string;
  apiKey?: string;
  groups?: string[];
  logins?: string[];
  onUpdate?: (update: PositionUpdate) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  onReconnect?: (attempt: number) => void;
}

export interface StreamStats {
  totalReceived: number;
  newPositions: number;
  modifications: number;
  closures: number;
  positionsTracked: number;
  lastUpdateAt: Date | null;
  lastFlushAt: Date | null;
  reconnectCount: number;
  isConnected: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SERVER = 'grpc-broker-api-demo.match-trader.com';
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BUFFER_FLUSH_MS = 1000; // 1 second buffer per architecture doc

// ============================================================================
// gRPC Client Loader
// ============================================================================

function loadProto() {
  const PROTO_PATH = path.resolve(process.cwd(), 'src/lib/grpc/positions.proto');

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: Number,
    enums: Number,
    defaults: true,
    oneofs: true,
  });

  return grpc.loadPackageDefinition(packageDefinition);
}

// ============================================================================
// Database Record Type
// ============================================================================

interface PositionInsert {
  position_id: number;
  account_login: string;
  account_uuid: string | null;
  symbol: string;
  alias: string | null;
  volume: number;
  side: string;
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
  updated_at: string;
}

// ============================================================================
// Position Buffer with Deduplication
// ============================================================================

class PositionBuffer {
  private buffer: Map<number, PositionUpdate> = new Map();

  add(update: PositionUpdate): void {
    // Always keep the latest update for each position
    this.buffer.set(update.position.positionId, update);
  }

  drain(): PositionUpdate[] {
    const updates = Array.from(this.buffer.values());
    this.buffer.clear();
    return updates;
  }

  size(): number {
    return this.buffer.size;
  }
}

// ============================================================================
// Positions Stream Service Class
// ============================================================================

export class PositionsStreamService {
  private client: grpc.Client | null = null;
  private stream: grpc.ClientReadableStream<PositionUpdate> | null = null;
  private config: PositionsStreamConfig;
  private stats: StreamStats;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  // Buffer for batching database writes
  private positionBuffer: PositionBuffer;
  private flushTimer: NodeJS.Timeout | null = null;

  // Track active positions in memory
  private activePositions: Map<number, Position> = new Map();

  constructor(config: PositionsStreamConfig) {
    this.config = {
      ...config,
      serverAddress: config.serverAddress || DEFAULT_SERVER,
    };

    this.stats = {
      totalReceived: 0,
      newPositions: 0,
      modifications: 0,
      closures: 0,
      positionsTracked: 0,
      lastUpdateAt: null,
      lastFlushAt: null,
      reconnectCount: 0,
      isConnected: false,
    };

    this.positionBuffer = new PositionBuffer();
  }

  /**
   * Start the gRPC stream connection
   */
  async start(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[gRPC-Positions] Service is shutting down, cannot start');
      return;
    }

    try {
      console.log(`[gRPC-Positions] Connecting to ${this.config.serverAddress}...`);

      const proto = loadProto();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PositionsService = (proto as any).matchtrader?.positions?.PositionsService;

      if (!PositionsService) {
        throw new Error('PositionsService not found in proto definition');
      }

      // Create gRPC client with credentials
      const credentials = this.config.apiKey
        ? grpc.credentials.combineChannelCredentials(
            grpc.credentials.createSsl(),
            grpc.credentials.createFromMetadataGenerator((_, callback) => {
              const metadata = new grpc.Metadata();
              metadata.set('authorization', `Bearer ${this.config.apiKey}`);
              callback(null, metadata);
            })
          )
        : grpc.credentials.createSsl();

      this.client = new PositionsService(this.config.serverAddress, credentials);

      // Build request
      const request = {
        groups: this.config.groups || [],
        logins: this.config.logins || [],
      };

      // Start streaming
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.client as any).getOpenPositionsStreamByGroupsOrLogins(request);
      this.stream = stream;

      stream.on('data', (update: PositionUpdate) => {
        this.handleUpdate(update);
      });

      stream.on('error', (error: Error) => {
        console.error('[gRPC-Positions] Stream error:', error.message);
        this.stats.isConnected = false;
        this.config.onError?.(error);
        this.scheduleReconnect();
      });

      stream.on('end', () => {
        console.log('[gRPC-Positions] Stream ended');
        this.stats.isConnected = false;
        this.config.onEnd?.();
        this.scheduleReconnect();
      });

      this.stats.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[gRPC-Positions] Connected and streaming');

    } catch (error) {
      console.error('[gRPC-Positions] Connection failed:', error);
      this.stats.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming position update
   */
  private handleUpdate(update: PositionUpdate): void {
    this.stats.totalReceived++;
    this.stats.lastUpdateAt = new Date();

    const pos = update.position;
    const updateTypeName = UpdateTypeNames[update.updateType] || 'UNKNOWN';

    // Track by update type
    switch (update.updateType) {
      case UpdateType.NEW:
        this.stats.newPositions++;
        this.activePositions.set(pos.positionId, pos);
        break;
      case UpdateType.MODIFY:
        this.stats.modifications++;
        this.activePositions.set(pos.positionId, pos);
        break;
      case UpdateType.CLOSE:
        this.stats.closures++;
        this.activePositions.delete(pos.positionId);
        break;
    }

    this.stats.positionsTracked = this.activePositions.size;

    // Log update
    const sideName = PositionSideNames[pos.side] || 'UNKNOWN';
    console.log(
      `[gRPC-Positions] ${updateTypeName}: Position ${pos.positionId} - ` +
      `${sideName} ${pos.volume} ${pos.symbol} @ ${pos.openPrice} - ` +
      `P/L: ${pos.profit?.toFixed(2) || '0.00'}`
    );

    // Callback for external handling
    this.config.onUpdate?.(update);

    // Add to buffer
    this.positionBuffer.add(update);

    // Schedule flush if not already scheduled
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushBuffer(), BUFFER_FLUSH_MS);
    }
  }

  /**
   * Flush position buffer to database
   */
  private async flushBuffer(): Promise<void> {
    this.flushTimer = null;

    const updates = this.positionBuffer.drain();
    if (updates.length === 0) return;

    this.stats.lastFlushAt = new Date();

    try {
      const supabase = createServerClient();

      const records: PositionInsert[] = updates.map((update) => {
        const pos = update.position;
        return {
          position_id: pos.positionId,
          account_login: pos.accountLogin,
          account_uuid: pos.accountUuid || null,
          symbol: pos.symbol,
          alias: pos.alias || null,
          volume: pos.volume,
          side: PositionSideNames[pos.side] || 'UNKNOWN',
          open_time: new Date(pos.openTime).toISOString(),
          open_price: pos.openPrice,
          current_price: pos.currentPrice || null,
          stop_loss: pos.stopLoss || null,
          take_profit: pos.takeProfit || null,
          profit: pos.profit || 0,
          net_profit: pos.netProfit || 0,
          swap: pos.swap || 0,
          commission: pos.commission || 0,
          margin: pos.margin || 0,
          is_closed: pos.isClosed || false,
          closed_at: pos.closedAt ? new Date(pos.closedAt).toISOString() : null,
          close_price: pos.closePrice || null,
          updated_at: new Date().toISOString(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('positions')
        .upsert(records, {
          onConflict: 'position_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[gRPC-Positions] Database upsert error:', error.message);
      } else {
        console.log(`[gRPC-Positions] Flushed ${records.length} position updates to database`);
      }

    } catch (error) {
      console.error('[gRPC-Positions] Failed to flush to database:', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[gRPC-Positions] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectCount++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[gRPC-Positions] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.config.onReconnect?.(this.reconnectAttempts);

    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * Stop the stream gracefully
   */
  async stop(): Promise<void> {
    console.log('[gRPC-Positions] Stopping stream service...');
    this.isShuttingDown = true;

    // Flush remaining buffer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushBuffer();

    if (this.stream) {
      this.stream.cancel();
      this.stream = null;
    }

    if (this.client) {
      (this.client as grpc.Client).close();
      this.client = null;
    }

    this.stats.isConnected = false;
    console.log('[gRPC-Positions] Stream service stopped');
  }

  /**
   * Get current statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Get all active positions (from memory)
   */
  getActivePositions(): Position[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Get position by ID (from memory)
   */
  getPosition(positionId: number): Position | undefined {
    return this.activePositions.get(positionId);
  }

  /**
   * Get positions for a specific account (from memory)
   */
  getPositionsByAccount(accountLogin: string): Position[] {
    return this.getActivePositions().filter(
      (pos) => pos.accountLogin === accountLogin
    );
  }
}

// ============================================================================
// Singleton Instance for Server-Side Use
// ============================================================================

let globalPositionsStream: PositionsStreamService | null = null;

export function getPositionsStream(): PositionsStreamService | null {
  return globalPositionsStream;
}

export async function startGlobalPositionsStream(
  config?: Partial<PositionsStreamConfig>
): Promise<PositionsStreamService> {
  if (globalPositionsStream) {
    console.log('[gRPC-Positions] Global stream already running');
    return globalPositionsStream;
  }

  const apiKey = process.env.MATCHTRADE_GRPC_API_KEY || process.env.PARTNER_TOKEN;
  const serverAddress = process.env.MATCHTRADE_GRPC_SERVER || DEFAULT_SERVER;

  globalPositionsStream = new PositionsStreamService({
    serverAddress,
    apiKey,
    onUpdate: (update) => {
      const typeName = UpdateTypeNames[update.updateType] || 'UNKNOWN';
      console.log(`[gRPC-Positions Global] ${typeName}: ${update.position.positionId}`);
    },
    onError: (error) => {
      console.error('[gRPC-Positions Global] Error:', error.message);
    },
    onReconnect: (attempt) => {
      console.log(`[gRPC-Positions Global] Reconnect attempt ${attempt}`);
    },
    ...config,
  });

  await globalPositionsStream.start();
  return globalPositionsStream;
}

export async function stopGlobalPositionsStream(): Promise<void> {
  if (globalPositionsStream) {
    await globalPositionsStream.stop();
    globalPositionsStream = null;
  }
}
