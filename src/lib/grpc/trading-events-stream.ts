/**
 * Match-Trade gRPC Trading Events Stream Service
 * Real-time subscription to trading events (margin calls, stop-outs, TP/SL)
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 2
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { createServerClient } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface TradingEvent {
  uuid: string;
  eventType: TradingEventType;
  accountLogin: string;
  accountUuid: string;
  accountGroup: string;
  symbol: string;
  positionId: number;
  orderId: number;
  volume: number;
  price: number;
  profit: number;
  details: string; // JSON string
  eventTime: number; // Unix timestamp in ms
  createdAt: number; // Unix timestamp in ms
}

export enum TradingEventType {
  UNKNOWN_EVENT = 0,
  MARGIN_CALL = 1,
  STOP_OUT = 2,
  TAKE_PROFIT = 3,
  STOP_LOSS = 4,
  ORDER_ACTIVATION = 5,
  POSITION_CLOSE = 6,
  POSITION_MODIFY = 7,
  ORDER_CANCEL = 8,
  OTHER = 99,
}

export const TradingEventTypeNames: Record<TradingEventType, string> = {
  [TradingEventType.UNKNOWN_EVENT]: 'UNKNOWN_EVENT',
  [TradingEventType.MARGIN_CALL]: 'MARGIN_CALL',
  [TradingEventType.STOP_OUT]: 'STOP_OUT',
  [TradingEventType.TAKE_PROFIT]: 'TAKE_PROFIT',
  [TradingEventType.STOP_LOSS]: 'STOP_LOSS',
  [TradingEventType.ORDER_ACTIVATION]: 'ORDER_ACTIVATION',
  [TradingEventType.POSITION_CLOSE]: 'POSITION_CLOSE',
  [TradingEventType.POSITION_MODIFY]: 'POSITION_MODIFY',
  [TradingEventType.ORDER_CANCEL]: 'ORDER_CANCEL',
  [TradingEventType.OTHER]: 'OTHER',
};

export interface TradingEventsStreamConfig {
  serverAddress: string;
  apiKey?: string;
  groups?: string[];
  logins?: string[];
  eventTypes?: TradingEventType[];
  onEvent?: (event: TradingEvent) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  onReconnect?: (attempt: number) => void;
}

export interface StreamStats {
  totalReceived: number;
  marginCalls: number;
  stopOuts: number;
  takeProfits: number;
  stopLosses: number;
  lastEventAt: Date | null;
  reconnectCount: number;
  isConnected: boolean;
}

type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SERVER = 'grpc-broker-api-demo.match-trader.com';
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BUFFER_FLUSH_MS = 100; // Critical stream - fast flush

// ============================================================================
// gRPC Client Loader
// ============================================================================

function loadProto() {
  const PROTO_PATH = path.resolve(process.cwd(), 'src/lib/grpc/trading-events.proto');

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
// Severity Mapping
// ============================================================================

function getEventSeverity(eventType: TradingEventType): EventSeverity {
  switch (eventType) {
    case TradingEventType.MARGIN_CALL:
    case TradingEventType.STOP_OUT:
      return 'CRITICAL';
    case TradingEventType.STOP_LOSS:
    case TradingEventType.ORDER_CANCEL:
      return 'WARNING';
    default:
      return 'INFO';
  }
}

// ============================================================================
// Database Record Type
// ============================================================================

interface TradingEventInsert {
  uuid: string;
  event_type: string;
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

// ============================================================================
// Trading Events Stream Service Class
// ============================================================================

export class TradingEventsStreamService {
  private client: grpc.Client | null = null;
  private stream: grpc.ClientReadableStream<TradingEvent> | null = null;
  private config: TradingEventsStreamConfig;
  private stats: StreamStats;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  // Buffer for batching database writes
  private eventBuffer: TradingEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: TradingEventsStreamConfig) {
    this.config = {
      ...config,
      serverAddress: config.serverAddress || DEFAULT_SERVER,
      eventTypes: config.eventTypes || [
        TradingEventType.MARGIN_CALL,
        TradingEventType.STOP_OUT,
        TradingEventType.TAKE_PROFIT,
        TradingEventType.STOP_LOSS,
        TradingEventType.ORDER_ACTIVATION,
        TradingEventType.POSITION_CLOSE,
      ],
    };

    this.stats = {
      totalReceived: 0,
      marginCalls: 0,
      stopOuts: 0,
      takeProfits: 0,
      stopLosses: 0,
      lastEventAt: null,
      reconnectCount: 0,
      isConnected: false,
    };
  }

  /**
   * Start the gRPC stream connection
   */
  async start(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[gRPC-TradingEvents] Service is shutting down, cannot start');
      return;
    }

    try {
      console.log(`[gRPC-TradingEvents] Connecting to ${this.config.serverAddress}...`);

      const proto = loadProto();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const TradingEventsService = (proto as any).matchtrader?.trading?.TradingEventsService;

      if (!TradingEventsService) {
        throw new Error('TradingEventsService not found in proto definition');
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

      this.client = new TradingEventsService(this.config.serverAddress, credentials);

      // Build request
      const request = {
        groups: this.config.groups || [],
        logins: this.config.logins || [],
        eventTypes: this.config.eventTypes || [],
      };

      // Start streaming
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.client as any).getTradingEventsStream(request);
      this.stream = stream;

      stream.on('data', (event: TradingEvent) => {
        this.handleEvent(event);
      });

      stream.on('error', (error: Error) => {
        console.error('[gRPC-TradingEvents] Stream error:', error.message);
        this.stats.isConnected = false;
        this.config.onError?.(error);
        this.scheduleReconnect();
      });

      stream.on('end', () => {
        console.log('[gRPC-TradingEvents] Stream ended');
        this.stats.isConnected = false;
        this.config.onEnd?.();
        this.scheduleReconnect();
      });

      this.stats.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[gRPC-TradingEvents] Connected and streaming');

    } catch (error) {
      console.error('[gRPC-TradingEvents] Connection failed:', error);
      this.stats.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming trading event
   */
  private handleEvent(event: TradingEvent): void {
    this.stats.totalReceived++;
    this.stats.lastEventAt = new Date();

    // Track by type
    switch (event.eventType) {
      case TradingEventType.MARGIN_CALL:
        this.stats.marginCalls++;
        break;
      case TradingEventType.STOP_OUT:
        this.stats.stopOuts++;
        break;
      case TradingEventType.TAKE_PROFIT:
        this.stats.takeProfits++;
        break;
      case TradingEventType.STOP_LOSS:
        this.stats.stopLosses++;
        break;
    }

    const eventTypeName = TradingEventTypeNames[event.eventType] || 'UNKNOWN';
    console.log(
      `[gRPC-TradingEvents] Received ${eventTypeName}: ` +
      `${event.uuid} - Account: ${event.accountLogin} - Symbol: ${event.symbol}`
    );

    // Callback for external handling
    this.config.onEvent?.(event);

    // Add to buffer
    this.eventBuffer.push(event);

    // Schedule flush if not already scheduled
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushBuffer(), BUFFER_FLUSH_MS);
    }
  }

  /**
   * Flush event buffer to database
   */
  private async flushBuffer(): Promise<void> {
    this.flushTimer = null;

    if (this.eventBuffer.length === 0) return;

    const eventsToSave = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const supabase = createServerClient();

      const records: TradingEventInsert[] = eventsToSave.map((event) => ({
        uuid: event.uuid,
        event_type: TradingEventTypeNames[event.eventType] || 'UNKNOWN_EVENT',
        account_login: event.accountLogin,
        account_uuid: event.accountUuid || null,
        account_group: event.accountGroup || null,
        symbol: event.symbol || null,
        position_id: event.positionId || null,
        order_id: event.orderId || null,
        volume: event.volume || null,
        price: event.price || null,
        profit: event.profit || null,
        details: event.details ? JSON.parse(event.details) : {},
        severity: getEventSeverity(event.eventType),
        event_time: new Date(event.eventTime).toISOString(),
        created_at: new Date(event.createdAt).toISOString(),
        synced_at: new Date().toISOString(),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('trading_events')
        .upsert(records, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[gRPC-TradingEvents] Database insert error:', error.message);
        // Re-add to buffer for retry
        this.eventBuffer.push(...eventsToSave);
      } else {
        console.log(`[gRPC-TradingEvents] Saved ${records.length} events to database`);
      }

    } catch (error) {
      console.error('[gRPC-TradingEvents] Failed to save to database:', error);
      // Re-add to buffer for retry
      this.eventBuffer.push(...eventsToSave);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[gRPC-TradingEvents] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectCount++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[gRPC-TradingEvents] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.config.onReconnect?.(this.reconnectAttempts);

    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * Stop the stream gracefully
   */
  async stop(): Promise<void> {
    console.log('[gRPC-TradingEvents] Stopping stream service...');
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
    console.log('[gRPC-TradingEvents] Stream service stopped');
  }

  /**
   * Get current statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }
}

// ============================================================================
// Singleton Instance for Server-Side Use
// ============================================================================

let globalTradingEventsStream: TradingEventsStreamService | null = null;

/**
 * Get or create the global trading events stream instance
 */
export function getTradingEventsStream(): TradingEventsStreamService | null {
  return globalTradingEventsStream;
}

/**
 * Start the global trading events stream
 */
export async function startGlobalTradingEventsStream(
  config?: Partial<TradingEventsStreamConfig>
): Promise<TradingEventsStreamService> {
  if (globalTradingEventsStream) {
    console.log('[gRPC-TradingEvents] Global stream already running');
    return globalTradingEventsStream;
  }

  const apiKey = process.env.MATCHTRADE_GRPC_API_KEY || process.env.PARTNER_TOKEN;
  const serverAddress = process.env.MATCHTRADE_GRPC_SERVER || DEFAULT_SERVER;

  globalTradingEventsStream = new TradingEventsStreamService({
    serverAddress,
    apiKey,
    eventTypes: [
      TradingEventType.MARGIN_CALL,
      TradingEventType.STOP_OUT,
      TradingEventType.TAKE_PROFIT,
      TradingEventType.STOP_LOSS,
      TradingEventType.ORDER_ACTIVATION,
      TradingEventType.POSITION_CLOSE,
    ],
    onEvent: (event) => {
      const eventTypeName = TradingEventTypeNames[event.eventType] || 'UNKNOWN';
      console.log(`[gRPC-TradingEvents Global] Event: ${eventTypeName} - ${event.uuid}`);
    },
    onError: (error) => {
      console.error('[gRPC-TradingEvents Global] Error:', error.message);
    },
    onReconnect: (attempt) => {
      console.log(`[gRPC-TradingEvents Global] Reconnect attempt ${attempt}`);
    },
    ...config,
  });

  await globalTradingEventsStream.start();
  return globalTradingEventsStream;
}

/**
 * Stop the global trading events stream
 */
export async function stopGlobalTradingEventsStream(): Promise<void> {
  if (globalTradingEventsStream) {
    await globalTradingEventsStream.stop();
    globalTradingEventsStream = null;
  }
}
