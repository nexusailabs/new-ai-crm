/**
 * Match-Trade gRPC Ledger Stream Service
 * Real-time subscription to deposit/withdrawal events
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Real-time Sync System
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { createServerClient } from '@/lib/supabase';
import type { WithdrawalInsert } from '@/types/supabase';

// ============================================================================
// Types
// ============================================================================

export interface LedgerEntry {
  uuid: string;
  accountUuid: string;
  login: string;
  amount: number;
  netAmount: number;
  currency: string;
  operationType: HistoryOperationType;
  status: string;
  paymentGatewayUuid: string;
  paymentGatewayName: string;
  walletAddress: string;
  reference: string;
  paymentId: string;
  partnerId: string;
  createdAt: number; // Unix timestamp in ms
  accountEmail: string;
  accountName: string;
  accountSurname: string;
}

export enum HistoryOperationType {
  UNKNOWN = 0,
  DEPOSIT = 1,
  WITHDRAW = 2,
  INTERNAL_TRANSFER = 3,
  CREDIT = 4,
  BONUS = 5,
  COMMISSION = 6,
  SWAP = 7,
  DIVIDEND = 8,
  ROLLOVER = 9,
  CORRECTION = 10,
}

export interface LedgerStreamConfig {
  serverAddress: string;
  apiKey?: string;
  groups?: string[];
  logins?: string[];
  operationTypes?: HistoryOperationType[];
  onEntry?: (entry: LedgerEntry) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  onReconnect?: (attempt: number) => void;
}

export interface StreamStats {
  totalReceived: number;
  depositsReceived: number;
  withdrawalsReceived: number;
  lastEventAt: Date | null;
  reconnectCount: number;
  isConnected: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SERVER = 'grpc-broker-api-demo.match-trader.com';
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ============================================================================
// gRPC Client Loader
// ============================================================================

function loadProto() {
  const PROTO_PATH = path.resolve(process.cwd(), 'src/lib/grpc/ledger.proto');

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
// Status Mapping
// ============================================================================

type WithdrawalMappedStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

function mapGrpcStatusToDb(status: string): WithdrawalMappedStatus {
  const statusMap: Record<string, WithdrawalMappedStatus> = {
    'PENDING': 'PENDING',
    'APPROVED': 'APPROVED',
    'COMPLETED': 'APPROVED',
    'REJECTED': 'REJECTED',
    'CANCELLED': 'REJECTED',
    'FAILED': 'REJECTED',
  };
  return statusMap[status?.toUpperCase()] || 'PENDING';
}

// ============================================================================
// Ledger Stream Service Class
// ============================================================================

export class LedgerStreamService {
  private client: grpc.Client | null = null;
  private stream: grpc.ClientReadableStream<LedgerEntry> | null = null;
  private config: LedgerStreamConfig;
  private stats: StreamStats;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  constructor(config: LedgerStreamConfig) {
    this.config = {
      ...config,
      serverAddress: config.serverAddress || DEFAULT_SERVER,
      operationTypes: config.operationTypes || [
        HistoryOperationType.DEPOSIT,
        HistoryOperationType.WITHDRAW,
      ],
    };

    this.stats = {
      totalReceived: 0,
      depositsReceived: 0,
      withdrawalsReceived: 0,
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
      console.log('[gRPC] Service is shutting down, cannot start');
      return;
    }

    try {
      console.log(`[gRPC] Connecting to ${this.config.serverAddress}...`);

      const proto = loadProto();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const LedgerService = (proto as any).matchtrader?.ledger?.LedgerHistoryService;

      if (!LedgerService) {
        throw new Error('LedgerHistoryService not found in proto definition');
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

      this.client = new LedgerService(this.config.serverAddress, credentials);

      // Build request
      const request = {
        groups: this.config.groups || [],
        logins: this.config.logins || [],
        operationTypes: this.config.operationTypes || [],
      };

      // Start streaming
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.client as any).getLedgersStreamByGroupsOrLogins(request);
      this.stream = stream;

      stream.on('data', (entry: LedgerEntry) => {
        this.handleEntry(entry);
      });

      stream.on('error', (error: Error) => {
        console.error('[gRPC] Stream error:', error.message);
        this.stats.isConnected = false;
        this.config.onError?.(error);
        this.scheduleReconnect();
      });

      stream.on('end', () => {
        console.log('[gRPC] Stream ended');
        this.stats.isConnected = false;
        this.config.onEnd?.();
        this.scheduleReconnect();
      });

      this.stats.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[gRPC] Connected and streaming');

    } catch (error) {
      console.error('[gRPC] Connection failed:', error);
      this.stats.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming ledger entry
   */
  private async handleEntry(entry: LedgerEntry): Promise<void> {
    this.stats.totalReceived++;
    this.stats.lastEventAt = new Date();

    // Track by type
    if (entry.operationType === HistoryOperationType.DEPOSIT) {
      this.stats.depositsReceived++;
    } else if (entry.operationType === HistoryOperationType.WITHDRAW) {
      this.stats.withdrawalsReceived++;
    }

    console.log(
      `[gRPC] Received ${HistoryOperationType[entry.operationType]}: ` +
      `${entry.uuid} - ${entry.amount} ${entry.currency}`
    );

    // Callback for external handling
    this.config.onEntry?.(entry);

    // Save to database if it's a withdrawal
    if (entry.operationType === HistoryOperationType.WITHDRAW) {
      await this.saveToDatabase(entry);
    }
  }

  /**
   * Save ledger entry to Supabase
   */
  private async saveToDatabase(entry: LedgerEntry): Promise<void> {
    try {
      const supabase = createServerClient();

      const withdrawal: WithdrawalInsert = {
        uuid: entry.uuid,
        account_uuid: entry.accountUuid,
        account_email: entry.accountEmail,
        account_name: entry.accountName,
        account_surname: entry.accountSurname,
        amount: entry.amount,
        net_amount: entry.netAmount,
        currency: entry.currency,
        status: entry.status,
        mapped_status: mapGrpcStatusToDb(entry.status),
        payment_gateway_uuid: entry.paymentGatewayUuid,
        payment_gateway_name: entry.paymentGatewayName,
        wallet_address: entry.walletAddress,
        reference: entry.reference,
        payment_id: entry.paymentId,
        partner_id: entry.partnerId ? parseInt(entry.partnerId, 10) : null,
        created_at: new Date(entry.createdAt).toISOString(),
        synced_at: new Date().toISOString(),
        raw_data: JSON.parse(JSON.stringify(entry)),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('withdrawals')
        .upsert(withdrawal, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[gRPC] Database insert error:', error.message);
      } else {
        console.log(`[gRPC] Saved withdrawal ${entry.uuid} to database`);
      }

    } catch (error) {
      console.error('[gRPC] Failed to save to database:', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[gRPC] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectCount++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[gRPC] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.config.onReconnect?.(this.reconnectAttempts);

    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * Stop the stream gracefully
   */
  stop(): void {
    console.log('[gRPC] Stopping stream service...');
    this.isShuttingDown = true;

    if (this.stream) {
      this.stream.cancel();
      this.stream = null;
    }

    if (this.client) {
      (this.client as grpc.Client).close();
      this.client = null;
    }

    this.stats.isConnected = false;
    console.log('[gRPC] Stream service stopped');
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

let globalStreamService: LedgerStreamService | null = null;

/**
 * Get or create the global stream service instance
 */
export function getStreamService(): LedgerStreamService | null {
  return globalStreamService;
}

/**
 * Start the global stream service
 */
export async function startGlobalStream(config?: Partial<LedgerStreamConfig>): Promise<LedgerStreamService> {
  if (globalStreamService) {
    console.log('[gRPC] Global stream already running');
    return globalStreamService;
  }

  const apiKey = process.env.MATCHTRADE_GRPC_API_KEY || process.env.PARTNER_TOKEN;
  const serverAddress = process.env.MATCHTRADE_GRPC_SERVER || DEFAULT_SERVER;

  globalStreamService = new LedgerStreamService({
    serverAddress,
    apiKey,
    operationTypes: [HistoryOperationType.DEPOSIT, HistoryOperationType.WITHDRAW],
    onEntry: (entry) => {
      console.log(`[gRPC Global] Entry: ${entry.uuid}`);
    },
    onError: (error) => {
      console.error('[gRPC Global] Error:', error.message);
    },
    onReconnect: (attempt) => {
      console.log(`[gRPC Global] Reconnect attempt ${attempt}`);
    },
    ...config,
  });

  await globalStreamService.start();
  return globalStreamService;
}

/**
 * Stop the global stream service
 */
export function stopGlobalStream(): void {
  if (globalStreamService) {
    globalStreamService.stop();
    globalStreamService = null;
  }
}
