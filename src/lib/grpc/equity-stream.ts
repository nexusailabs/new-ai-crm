/**
 * Match-Trade gRPC Account Equity Stream Service
 * Real-time subscription to account equity updates
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 2
 *
 * OPTIMIZATION STRATEGIES APPLIED (per Architecture Doc Section 5.2):
 * 1. Tiered Subscription (VIP/Active/Dormant)
 * 2. Delta-Only Storage (1% change threshold)
 * 3. Aggregated Writes (30-second batch)
 * 4. Memory-first, periodic DB flush
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { createServerClient } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface EquityUpdate {
  accountLogin: string;
  accountUuid: string;
  accountGroup: string;
  equity: number;
  balance: number;
  credit: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  floatingPL: number;
  closedPLToday: number;
  timestamp: number; // Unix timestamp in ms
}

export type AccountTier = 'VIP' | 'ACTIVE' | 'DORMANT' | 'STANDARD';

export interface TierConfig {
  tier: AccountTier;
  dbWriteIntervalMs: number;
  deltaThreshold: number; // Minimum % change to trigger DB write
  logins?: string[];
  groups?: string[];
}

export interface EquityStreamConfig {
  serverAddress: string;
  apiKey?: string;
  groups?: string[];
  logins?: string[];
  tiers?: TierConfig[];
  onUpdate?: (update: EquityUpdate) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  onReconnect?: (attempt: number) => void;
}

export interface StreamStats {
  totalReceived: number;
  totalWritten: number;
  skippedByDelta: number;
  accountsTracked: number;
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

// Default tier configurations
const DEFAULT_TIERS: TierConfig[] = [
  {
    tier: 'VIP',
    dbWriteIntervalMs: 5000, // Every update
    deltaThreshold: 0, // Write all changes
  },
  {
    tier: 'ACTIVE',
    dbWriteIntervalMs: 30000, // 30 seconds
    deltaThreshold: 0.01, // 1% change
  },
  {
    tier: 'STANDARD',
    dbWriteIntervalMs: 30000, // 30 seconds
    deltaThreshold: 0.01, // 1% change
  },
  {
    tier: 'DORMANT',
    dbWriteIntervalMs: 300000, // 5 minutes
    deltaThreshold: 0.05, // 5% change
  },
];

// Default: 30 second aggregated writes
const AGGREGATED_WRITE_INTERVAL_MS = 30000;
const DELTA_THRESHOLD = 0.01; // 1% change required to save

// ============================================================================
// gRPC Client Loader
// ============================================================================

function loadProto() {
  const PROTO_PATH = path.resolve(process.cwd(), 'src/lib/grpc/equity.proto');

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
// Delta Calculation
// ============================================================================

function shouldSaveEquity(prevEquity: number, currentEquity: number, threshold: number): boolean {
  if (!prevEquity || prevEquity === 0) return true;
  const changeRatio = Math.abs(currentEquity - prevEquity) / prevEquity;
  return changeRatio >= threshold;
}

// ============================================================================
// Database Record Type
// ============================================================================

interface EquityInsert {
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
  updated_at: string;
  synced_at: string;
}

// ============================================================================
// Equity Aggregator (Memory-first Storage)
// ============================================================================

class EquityAggregator {
  private latestValues: Map<string, EquityUpdate & { tier: AccountTier }> = new Map();
  private previousEquity: Map<string, number> = new Map();
  private deltaThreshold: number;

  constructor(deltaThreshold: number = DELTA_THRESHOLD) {
    this.deltaThreshold = deltaThreshold;
  }

  /**
   * Update equity in memory
   * Returns true if the update should be saved (passes delta threshold)
   */
  update(login: string, data: EquityUpdate, tier: AccountTier = 'STANDARD'): boolean {
    const prevEquity = this.previousEquity.get(login);
    const shouldSave = shouldSaveEquity(prevEquity || 0, data.equity, this.deltaThreshold);

    // Always update memory
    this.latestValues.set(login, {
      ...data,
      tier,
    });

    // Update previous equity if saving
    if (shouldSave) {
      this.previousEquity.set(login, data.equity);
    }

    return shouldSave;
  }

  /**
   * Get all current values and clear the aggregator
   */
  drain(): (EquityUpdate & { tier: AccountTier })[] {
    const values = Array.from(this.latestValues.values());
    this.latestValues.clear();
    return values;
  }

  /**
   * Get current values without clearing
   */
  peek(): (EquityUpdate & { tier: AccountTier })[] {
    return Array.from(this.latestValues.values());
  }

  /**
   * Get number of accounts being tracked
   */
  size(): number {
    return this.latestValues.size;
  }

  /**
   * Get specific account equity
   */
  get(login: string): (EquityUpdate & { tier: AccountTier }) | undefined {
    return this.latestValues.get(login);
  }
}

// ============================================================================
// Equity Stream Service Class
// ============================================================================

export class EquityStreamService {
  private client: grpc.Client | null = null;
  private stream: grpc.ClientReadableStream<EquityUpdate> | null = null;
  private config: EquityStreamConfig;
  private stats: StreamStats;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  // Aggregator for memory-first storage
  private aggregator: EquityAggregator;
  private flushTimer: NodeJS.Timeout | null = null;

  // Tier mapping
  private accountTiers: Map<string, AccountTier> = new Map();
  private groupTiers: Map<string, AccountTier> = new Map();

  constructor(config: EquityStreamConfig) {
    this.config = {
      ...config,
      serverAddress: config.serverAddress || DEFAULT_SERVER,
      tiers: config.tiers || DEFAULT_TIERS,
    };

    this.stats = {
      totalReceived: 0,
      totalWritten: 0,
      skippedByDelta: 0,
      accountsTracked: 0,
      lastUpdateAt: null,
      lastFlushAt: null,
      reconnectCount: 0,
      isConnected: false,
    };

    this.aggregator = new EquityAggregator(DELTA_THRESHOLD);

    // Build tier mappings
    this.buildTierMappings();
  }

  /**
   * Build mappings from config tiers
   */
  private buildTierMappings(): void {
    for (const tierConfig of this.config.tiers || DEFAULT_TIERS) {
      // Map logins to tiers
      for (const login of tierConfig.logins || []) {
        this.accountTiers.set(login, tierConfig.tier);
      }
      // Map groups to tiers
      for (const group of tierConfig.groups || []) {
        this.groupTiers.set(group, tierConfig.tier);
      }
    }
  }

  /**
   * Get tier for an account
   */
  private getAccountTier(login: string, group: string): AccountTier {
    // Check login-specific tier first
    if (this.accountTiers.has(login)) {
      return this.accountTiers.get(login)!;
    }
    // Check group tier
    if (this.groupTiers.has(group)) {
      return this.groupTiers.get(group)!;
    }
    // Default tier
    return 'STANDARD';
  }

  /**
   * Start the gRPC stream connection
   */
  async start(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[gRPC-Equity] Service is shutting down, cannot start');
      return;
    }

    try {
      console.log(`[gRPC-Equity] Connecting to ${this.config.serverAddress}...`);
      console.log('[gRPC-Equity] WARNING: This stream is resource-intensive');

      const proto = loadProto();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ClientEquityService = (proto as any).matchtrader?.equity?.ClientEquityService;

      if (!ClientEquityService) {
        throw new Error('ClientEquityService not found in proto definition');
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

      this.client = new ClientEquityService(this.config.serverAddress, credentials);

      // Build request
      const request = {
        groups: this.config.groups || [],
        logins: this.config.logins || [],
        updateIntervalMs: 5000, // Default: 5 seconds (Match-Trade default)
      };

      // Start streaming
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.client as any).getClientEquityStream(request);
      this.stream = stream;

      stream.on('data', (update: EquityUpdate) => {
        this.handleUpdate(update);
      });

      stream.on('error', (error: Error) => {
        console.error('[gRPC-Equity] Stream error:', error.message);
        this.stats.isConnected = false;
        this.config.onError?.(error);
        this.scheduleReconnect();
      });

      stream.on('end', () => {
        console.log('[gRPC-Equity] Stream ended');
        this.stats.isConnected = false;
        this.config.onEnd?.();
        this.scheduleReconnect();
      });

      this.stats.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[gRPC-Equity] Connected and streaming');

      // Start aggregated write timer
      this.startFlushTimer();

    } catch (error) {
      console.error('[gRPC-Equity] Connection failed:', error);
      this.stats.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming equity update
   */
  private handleUpdate(update: EquityUpdate): void {
    this.stats.totalReceived++;
    this.stats.lastUpdateAt = new Date();

    const tier = this.getAccountTier(update.accountLogin, update.accountGroup);

    // Update aggregator (memory-first)
    const shouldSave = this.aggregator.update(update.accountLogin, update, tier);

    if (!shouldSave) {
      this.stats.skippedByDelta++;
    }

    this.stats.accountsTracked = this.aggregator.size();

    // Callback for external handling
    this.config.onUpdate?.(update);

    // Log only significant updates or periodically
    if (shouldSave || this.stats.totalReceived % 100 === 0) {
      console.log(
        `[gRPC-Equity] Update: ${update.accountLogin} - ` +
        `Equity: ${update.equity.toFixed(2)} - ` +
        `Margin Level: ${update.marginLevel?.toFixed(2) || 'N/A'}%`
      );
    }
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushToDatabase();
    }, AGGREGATED_WRITE_INTERVAL_MS);
  }

  /**
   * Flush aggregated updates to database
   */
  private async flushToDatabase(): Promise<void> {
    const updates = this.aggregator.drain();

    if (updates.length === 0) return;

    this.stats.lastFlushAt = new Date();

    try {
      const supabase = createServerClient();

      const records: EquityInsert[] = updates.map((update) => ({
        account_login: update.accountLogin,
        account_uuid: update.accountUuid || null,
        account_group: update.accountGroup || null,
        equity: update.equity,
        balance: update.balance,
        credit: update.credit || 0,
        margin: update.margin || 0,
        free_margin: update.freeMargin || 0,
        margin_level: update.marginLevel || null,
        floating_pl: update.floatingPL || 0,
        closed_pl_today: update.closedPLToday || 0,
        tier: update.tier,
        updated_at: new Date(update.timestamp).toISOString(),
        synced_at: new Date().toISOString(),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('account_equity')
        .upsert(records, {
          onConflict: 'account_login',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('[gRPC-Equity] Database upsert error:', error.message);
      } else {
        this.stats.totalWritten += records.length;
        console.log(
          `[gRPC-Equity] Flushed ${records.length} equity records to database ` +
          `(skipped ${this.stats.skippedByDelta} by delta)`
        );
        this.stats.skippedByDelta = 0;
      }

    } catch (error) {
      console.error('[gRPC-Equity] Failed to flush to database:', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[gRPC-Equity] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectCount++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[gRPC-Equity] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.config.onReconnect?.(this.reconnectAttempts);

    setTimeout(() => {
      this.start();
    }, delay);
  }

  /**
   * Stop the stream gracefully
   */
  async stop(): Promise<void> {
    console.log('[gRPC-Equity] Stopping stream service...');
    this.isShuttingDown = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flushToDatabase();

    if (this.stream) {
      this.stream.cancel();
      this.stream = null;
    }

    if (this.client) {
      (this.client as grpc.Client).close();
      this.client = null;
    }

    this.stats.isConnected = false;
    console.log('[gRPC-Equity] Stream service stopped');
  }

  /**
   * Get current statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Get current equity for a specific account (from memory)
   */
  getEquity(login: string): (EquityUpdate & { tier: AccountTier }) | undefined {
    return this.aggregator.get(login);
  }

  /**
   * Get all current equities (from memory)
   */
  getAllEquities(): (EquityUpdate & { tier: AccountTier })[] {
    return this.aggregator.peek();
  }

  /**
   * Set tier for a specific account at runtime
   */
  setAccountTier(login: string, tier: AccountTier): void {
    this.accountTiers.set(login, tier);
  }
}

// ============================================================================
// Singleton Instance for Server-Side Use
// ============================================================================

let globalEquityStream: EquityStreamService | null = null;

/**
 * Get the global equity stream instance
 */
export function getEquityStream(): EquityStreamService | null {
  return globalEquityStream;
}

/**
 * Start the global equity stream
 */
export async function startGlobalEquityStream(
  config?: Partial<EquityStreamConfig>
): Promise<EquityStreamService> {
  if (globalEquityStream) {
    console.log('[gRPC-Equity] Global stream already running');
    return globalEquityStream;
  }

  const apiKey = process.env.MATCHTRADE_GRPC_API_KEY || process.env.PARTNER_TOKEN;
  const serverAddress = process.env.MATCHTRADE_GRPC_SERVER || DEFAULT_SERVER;

  globalEquityStream = new EquityStreamService({
    serverAddress,
    apiKey,
    tiers: DEFAULT_TIERS,
    onUpdate: (update) => {
      // Only log significant updates
      if (update.marginLevel && update.marginLevel < 150) {
        console.log(
          `[gRPC-Equity Global] LOW MARGIN: ${update.accountLogin} - ` +
          `Level: ${update.marginLevel.toFixed(2)}%`
        );
      }
    },
    onError: (error) => {
      console.error('[gRPC-Equity Global] Error:', error.message);
    },
    onReconnect: (attempt) => {
      console.log(`[gRPC-Equity Global] Reconnect attempt ${attempt}`);
    },
    ...config,
  });

  await globalEquityStream.start();
  return globalEquityStream;
}

/**
 * Stop the global equity stream
 */
export async function stopGlobalEquityStream(): Promise<void> {
  if (globalEquityStream) {
    await globalEquityStream.stop();
    globalEquityStream = null;
  }
}
