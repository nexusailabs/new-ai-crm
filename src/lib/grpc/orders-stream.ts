/**
 * Match-Trade gRPC Pending Orders Stream Service
 * Real-time subscription to pending order updates
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3
 *
 * Features:
 * - 1-second buffering for updates
 * - Deduplication by order_id
 * - Order status tracking (created, modified, activated, cancelled, expired)
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { createServerClient } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface PendingOrder {
  orderId: number;
  accountLogin: string;
  accountUuid: string;
  symbol: string;
  orderType: OrderType;
  volume: number;
  activationPrice: number;
  limitPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: OrderStatus;
  createdAt: number; // Unix timestamp in ms
  expirationAt: number;
  activatedAt: number;
  cancelledAt: number;
  comment: string;
}

export enum OrderType {
  UNKNOWN_ORDER_TYPE = 0,
  BUY_LIMIT = 1,
  SELL_LIMIT = 2,
  BUY_STOP = 3,
  SELL_STOP = 4,
  BUY_STOP_LIMIT = 5,
  SELL_STOP_LIMIT = 6,
}

export enum OrderStatus {
  UNKNOWN_STATUS = 0,
  PENDING = 1,
  ACTIVATED = 2,
  CANCELLED = 3,
  EXPIRED = 4,
  FILLED = 5,
}

export enum OrderUpdateType {
  UNKNOWN_ORDER_UPDATE = 0,
  CREATED = 1,
  MODIFIED = 2,
  ACTIVATED = 3,
  CANCELLED = 4,
  EXPIRED = 5,
}

export interface OrderUpdate {
  order: PendingOrder;
  updateType: OrderUpdateType;
}

export const OrderTypeNames: Record<OrderType, string> = {
  [OrderType.UNKNOWN_ORDER_TYPE]: 'UNKNOWN',
  [OrderType.BUY_LIMIT]: 'BUY_LIMIT',
  [OrderType.SELL_LIMIT]: 'SELL_LIMIT',
  [OrderType.BUY_STOP]: 'BUY_STOP',
  [OrderType.SELL_STOP]: 'SELL_STOP',
  [OrderType.BUY_STOP_LIMIT]: 'BUY_STOP_LIMIT',
  [OrderType.SELL_STOP_LIMIT]: 'SELL_STOP_LIMIT',
};

export const OrderStatusNames: Record<OrderStatus, string> = {
  [OrderStatus.UNKNOWN_STATUS]: 'UNKNOWN',
  [OrderStatus.PENDING]: 'PENDING',
  [OrderStatus.ACTIVATED]: 'ACTIVATED',
  [OrderStatus.CANCELLED]: 'CANCELLED',
  [OrderStatus.EXPIRED]: 'EXPIRED',
  [OrderStatus.FILLED]: 'FILLED',
};

export const OrderUpdateTypeNames: Record<OrderUpdateType, string> = {
  [OrderUpdateType.UNKNOWN_ORDER_UPDATE]: 'UNKNOWN',
  [OrderUpdateType.CREATED]: 'CREATED',
  [OrderUpdateType.MODIFIED]: 'MODIFIED',
  [OrderUpdateType.ACTIVATED]: 'ACTIVATED',
  [OrderUpdateType.CANCELLED]: 'CANCELLED',
  [OrderUpdateType.EXPIRED]: 'EXPIRED',
};

export interface OrdersStreamConfig {
  serverAddress: string;
  apiKey?: string;
  groups?: string[];
  logins?: string[];
  onUpdate?: (update: OrderUpdate) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  onReconnect?: (attempt: number) => void;
}

export interface StreamStats {
  totalReceived: number;
  created: number;
  modified: number;
  activated: number;
  cancelled: number;
  expired: number;
  pendingOrdersTracked: number;
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
const BUFFER_FLUSH_MS = 1000; // 1 second buffer

// ============================================================================
// gRPC Client Loader
// ============================================================================

function loadProto() {
  const PROTO_PATH = path.resolve(process.cwd(), 'src/lib/grpc/orders.proto');

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

interface OrderInsert {
  order_id: number;
  account_login: string;
  account_uuid: string | null;
  symbol: string;
  order_type: string;
  volume: number;
  activation_price: number;
  limit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  created_at: string;
  expiration_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  comment: string | null;
  updated_at: string;
  synced_at: string;
}

// ============================================================================
// Order Buffer with Deduplication
// ============================================================================

class OrderBuffer {
  private buffer: Map<number, OrderUpdate> = new Map();

  add(update: OrderUpdate): void {
    // Always keep the latest update for each order
    this.buffer.set(update.order.orderId, update);
  }

  drain(): OrderUpdate[] {
    const updates = Array.from(this.buffer.values());
    this.buffer.clear();
    return updates;
  }

  size(): number {
    return this.buffer.size;
  }
}

// ============================================================================
// Orders Stream Service Class
// ============================================================================

export class OrdersStreamService {
  private client: grpc.Client | null = null;
  private stream: grpc.ClientReadableStream<OrderUpdate> | null = null;
  private config: OrdersStreamConfig;
  private stats: StreamStats;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  // Buffer for batching database writes
  private orderBuffer: OrderBuffer;
  private flushTimer: NodeJS.Timeout | null = null;

  // Track active pending orders in memory
  private pendingOrders: Map<number, PendingOrder> = new Map();

  constructor(config: OrdersStreamConfig) {
    this.config = {
      ...config,
      serverAddress: config.serverAddress || DEFAULT_SERVER,
    };

    this.stats = {
      totalReceived: 0,
      created: 0,
      modified: 0,
      activated: 0,
      cancelled: 0,
      expired: 0,
      pendingOrdersTracked: 0,
      lastUpdateAt: null,
      lastFlushAt: null,
      reconnectCount: 0,
      isConnected: false,
    };

    this.orderBuffer = new OrderBuffer();
  }

  /**
   * Start the gRPC stream connection
   */
  async start(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[gRPC-Orders] Service is shutting down, cannot start');
      return;
    }

    try {
      console.log(`[gRPC-Orders] Connecting to ${this.config.serverAddress}...`);

      const proto = loadProto();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const OrdersService = (proto as any).matchtrader?.orders?.OrdersService;

      if (!OrdersService) {
        throw new Error('OrdersService not found in proto definition');
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

      this.client = new OrdersService(this.config.serverAddress, credentials);

      // Build request
      const request = {
        groups: this.config.groups || [],
        logins: this.config.logins || [],
      };

      // Start streaming
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.client as any).getOrdersUpdateStreamByGroupsOrLogins(request);
      this.stream = stream;

      stream.on('data', (update: OrderUpdate) => {
        this.handleUpdate(update);
      });

      stream.on('error', (error: Error) => {
        console.error('[gRPC-Orders] Stream error:', error.message);
        this.stats.isConnected = false;
        this.config.onError?.(error);
        this.scheduleReconnect();
      });

      stream.on('end', () => {
        console.log('[gRPC-Orders] Stream ended');
        this.stats.isConnected = false;
        this.config.onEnd?.();
        this.scheduleReconnect();
      });

      this.stats.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[gRPC-Orders] Connected and streaming');

    } catch (error) {
      console.error('[gRPC-Orders] Connection failed:', error);
      this.stats.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming order update
   */
  private handleUpdate(update: OrderUpdate): void {
    this.stats.totalReceived++;
    this.stats.lastUpdateAt = new Date();

    const order = update.order;
    const updateTypeName = OrderUpdateTypeNames[update.updateType] || 'UNKNOWN';

    // Track by update type and manage pending orders map
    switch (update.updateType) {
      case OrderUpdateType.CREATED:
        this.stats.created++;
        this.pendingOrders.set(order.orderId, order);
        break;
      case OrderUpdateType.MODIFIED:
        this.stats.modified++;
        this.pendingOrders.set(order.orderId, order);
        break;
      case OrderUpdateType.ACTIVATED:
        this.stats.activated++;
        this.pendingOrders.delete(order.orderId);
        break;
      case OrderUpdateType.CANCELLED:
        this.stats.cancelled++;
        this.pendingOrders.delete(order.orderId);
        break;
      case OrderUpdateType.EXPIRED:
        this.stats.expired++;
        this.pendingOrders.delete(order.orderId);
        break;
    }

    this.stats.pendingOrdersTracked = this.pendingOrders.size;

    // Log update
    const orderTypeName = OrderTypeNames[order.orderType] || 'UNKNOWN';
    console.log(
      `[gRPC-Orders] ${updateTypeName}: Order ${order.orderId} - ` +
      `${orderTypeName} ${order.volume} ${order.symbol} @ ${order.activationPrice}`
    );

    // Callback for external handling
    this.config.onUpdate?.(update);

    // Add to buffer
    this.orderBuffer.add(update);

    // Schedule flush if not already scheduled
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushBuffer(), BUFFER_FLUSH_MS);
    }
  }

  /**
   * Flush order buffer to database
   */
  private async flushBuffer(): Promise<void> {
    this.flushTimer = null;

    const updates = this.orderBuffer.drain();
    if (updates.length === 0) return;

    this.stats.lastFlushAt = new Date();

    try {
      const supabase = createServerClient();

      const records: OrderInsert[] = updates.map((update) => {
        const order = update.order;
        return {
          order_id: order.orderId,
          account_login: order.accountLogin,
          account_uuid: order.accountUuid || null,
          symbol: order.symbol,
          order_type: OrderTypeNames[order.orderType] || 'UNKNOWN',
          volume: order.volume,
          activation_price: order.activationPrice,
          limit_price: order.limitPrice || null,
          stop_loss: order.stopLoss || null,
          take_profit: order.takeProfit || null,
          status: OrderStatusNames[order.status] || 'UNKNOWN',
          created_at: new Date(order.createdAt).toISOString(),
          expiration_at: order.expirationAt ? new Date(order.expirationAt).toISOString() : null,
          activated_at: order.activatedAt ? new Date(order.activatedAt).toISOString() : null,
          cancelled_at: order.cancelledAt ? new Date(order.cancelledAt).toISOString() : null,
          comment: order.comment || null,
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('pending_orders')
        .upsert(records, {
          onConflict: 'order_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[gRPC-Orders] Database upsert error:', error.message);
      } else {
        console.log(`[gRPC-Orders] Flushed ${records.length} order updates to database`);
      }

    } catch (error) {
      console.error('[gRPC-Orders] Failed to flush to database:', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[gRPC-Orders] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectCount++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[gRPC-Orders] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.config.onReconnect?.(this.reconnectAttempts);

    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * Stop the stream gracefully
   */
  async stop(): Promise<void> {
    console.log('[gRPC-Orders] Stopping stream service...');
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
    console.log('[gRPC-Orders] Stream service stopped');
  }

  /**
   * Get current statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Get all pending orders (from memory)
   */
  getPendingOrders(): PendingOrder[] {
    return Array.from(this.pendingOrders.values());
  }

  /**
   * Get order by ID (from memory)
   */
  getOrder(orderId: number): PendingOrder | undefined {
    return this.pendingOrders.get(orderId);
  }

  /**
   * Get orders for a specific account (from memory)
   */
  getOrdersByAccount(accountLogin: string): PendingOrder[] {
    return this.getPendingOrders().filter(
      (order) => order.accountLogin === accountLogin
    );
  }
}

// ============================================================================
// Singleton Instance for Server-Side Use
// ============================================================================

let globalOrdersStream: OrdersStreamService | null = null;

export function getOrdersStream(): OrdersStreamService | null {
  return globalOrdersStream;
}

export async function startGlobalOrdersStream(
  config?: Partial<OrdersStreamConfig>
): Promise<OrdersStreamService> {
  if (globalOrdersStream) {
    console.log('[gRPC-Orders] Global stream already running');
    return globalOrdersStream;
  }

  const apiKey = process.env.MATCHTRADE_GRPC_API_KEY || process.env.PARTNER_TOKEN;
  const serverAddress = process.env.MATCHTRADE_GRPC_SERVER || DEFAULT_SERVER;

  globalOrdersStream = new OrdersStreamService({
    serverAddress,
    apiKey,
    onUpdate: (update) => {
      const typeName = OrderUpdateTypeNames[update.updateType] || 'UNKNOWN';
      console.log(`[gRPC-Orders Global] ${typeName}: ${update.order.orderId}`);
    },
    onError: (error) => {
      console.error('[gRPC-Orders Global] Error:', error.message);
    },
    onReconnect: (attempt) => {
      console.log(`[gRPC-Orders Global] Reconnect attempt ${attempt}`);
    },
    ...config,
  });

  await globalOrdersStream.start();
  return globalOrdersStream;
}

export async function stopGlobalOrdersStream(): Promise<void> {
  if (globalOrdersStream) {
    await globalOrdersStream.stop();
    globalOrdersStream = null;
  }
}
