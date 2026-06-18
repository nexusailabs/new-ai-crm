# gRPC Real-time Streaming Architecture

> Efficient multi-stream data pipeline from Match-Trade to Supabase
> Created: 2025-12-29
> Mission: MISSION-20251229-0001

## 1. Overview

Match-Trade provides multiple gRPC streaming services for real-time data.
This document outlines an efficient architecture to:
- Connect to multiple streams with a unified manager
- Batch write to Supabase to minimize DB load
- Push updates to frontend via Supabase Realtime

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        gRPC Stream Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────┐                                               │
│  │   Match-Trade gRPC       │                                               │
│  │   grpc-broker-api-*.com  │                                               │
│  └────────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│  ┌──────────────────────────────────────────────────┐                       │
│  │         Unified gRPC Connection Manager          │                       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │                       │
│  │  │ Ledgers  │ │ Trading  │ │ Equity   │ ...     │                       │
│  │  │ Stream   │ │ Events   │ │ Stream   │         │                       │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘         │                       │
│  └───────┼────────────┼────────────┼───────────────┘                       │
│          │            │            │                                        │
│          ▼            ▼            ▼                                        │
│  ┌──────────────────────────────────────────────────┐                       │
│  │            Event Buffer / Batch Queue            │                       │
│  │         (In-memory with configurable TTL)        │                       │
│  └────────────────────┬─────────────────────────────┘                       │
│                       │                                                     │
│                       ▼                                                     │
│  ┌──────────────────────────────────────────────────┐                       │
│  │         Batch Writer (500ms interval)            │                       │
│  │    - Deduplicate by UUID                         │                       │
│  │    - Bulk upsert to Supabase                     │                       │
│  │    - Error handling with retry                   │                       │
│  └────────────────────┬─────────────────────────────┘                       │
│                       │                                                     │
│                       ▼                                                     │
│  ┌──────────────────────────────────────────────────┐                       │
│  │               Supabase (PostgreSQL)              │                       │
│  │   ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │                       │
│  │   │ withdrawals │ │ positions   │ │ equity    │  │                       │
│  │   └─────────────┘ └─────────────┘ └───────────┘  │                       │
│  └────────────────────┬─────────────────────────────┘                       │
│                       │                                                     │
│                       ▼                                                     │
│  ┌──────────────────────────────────────────────────┐                       │
│  │          Supabase Realtime (WebSocket)           │                       │
│  │         postgres_changes subscription            │                       │
│  └────────────────────┬─────────────────────────────┘                       │
│                       │                                                     │
│                       ▼                                                     │
│  ┌──────────────────────────────────────────────────┐                       │
│  │              Frontend (React + TanStack Query)   │                       │
│  │         Real-time UI updates via hooks           │                       │
│  └──────────────────────────────────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Stream Classification & Strategy

### 2.1 Critical Streams (Immediate Processing)

| Stream | Table | Buffer Time | Notes |
|--------|-------|-------------|-------|
| `getLedgersStreamByGroupsOrLogins` | withdrawals, deposits | 100ms | Financial transactions |
| `getTradingEventsStream` | trading_events | 100ms | Margin calls, stop-outs |

**Strategy**: Immediate buffer flush, no batching delay for critical events.

### 2.2 High-frequency Streams (Batched Processing)

| Stream | Table | Buffer Time | Notes |
|--------|-------|-------------|-------|
| `getClientEquityStream` | account_equity | 5000ms | Resource-intensive |
| `getOpenPositionsStreamByGroupsOrLogins` | positions | 1000ms | Position updates |

**Strategy**: Batch writes with deduplication. Only keep latest value per account/position.

### 2.3 Medium-frequency Streams (Aggregated Processing)

| Stream | Table | Buffer Time | Notes |
|--------|-------|-------------|-------|
| `getQuotationsWithMarkupStream` | quotes | 500ms | High volume |
| `getOrdersUpdateStreamByGroupsOrLogins` | pending_orders | 1000ms | Order updates |

**Strategy**: Aggregate updates, write summary to DB, push to frontend via separate channel.

### 2.4 Low-frequency Streams (Direct Processing)

| Stream | Table | Buffer Time | Notes |
|--------|-------|-------------|-------|
| `getAccountInfoChangedStream` | accounts | 0ms | Rare, important |
| `getSymbolsChangedStream` | symbols | 0ms | Configuration |
| `getGroupChangesStream` | groups | 0ms | Configuration |

**Strategy**: Direct write, no buffering needed.

## 3. Database Schema Design

### 3.1 Core Tables

```sql
-- Trading Events (margin calls, stop-outs, TP/SL)
CREATE TABLE trading_events (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- MARGIN_CALL, STOP_OUT, TAKE_PROFIT, STOP_LOSS, ORDER_ACTIVATION
  account_login VARCHAR(50) NOT NULL,
  account_group VARCHAR(100),
  symbol VARCHAR(50),
  position_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trading_events_login ON trading_events(account_login);
CREATE INDEX idx_trading_events_type ON trading_events(event_type);
CREATE INDEX idx_trading_events_created ON trading_events(created_at DESC);

-- Account Equity (real-time balance tracking)
CREATE TABLE account_equity (
  id SERIAL PRIMARY KEY,
  account_login VARCHAR(50) UNIQUE NOT NULL,
  equity DECIMAL(18,8) NOT NULL,
  balance DECIMAL(18,8) NOT NULL,
  credit DECIMAL(18,8) DEFAULT 0,
  margin DECIMAL(18,8),
  free_margin DECIMAL(18,8),
  margin_level DECIMAL(18,4),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_equity_updated ON account_equity(updated_at DESC);

-- Open Positions
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  position_id BIGINT UNIQUE NOT NULL,
  account_login VARCHAR(50) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  alias VARCHAR(100),
  volume DECIMAL(18,8) NOT NULL,
  side VARCHAR(10) NOT NULL, -- BUY, SELL
  open_time TIMESTAMPTZ NOT NULL,
  open_price DECIMAL(18,8) NOT NULL,
  current_price DECIMAL(18,8),
  stop_loss DECIMAL(18,8),
  take_profit DECIMAL(18,8),
  profit DECIMAL(18,8),
  net_profit DECIMAL(18,8),
  swap DECIMAL(18,8),
  commission DECIMAL(18,8),
  is_closed BOOLEAN DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_login ON positions(account_login);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_open ON positions(is_closed, open_time DESC);

-- Real-time Quotes (summary only, not tick-by-tick)
CREATE TABLE quotes_summary (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(50) UNIQUE NOT NULL,
  bid DECIMAL(18,8) NOT NULL,
  ask DECIMAL(18,8) NOT NULL,
  spread DECIMAL(18,8) GENERATED ALWAYS AS (ask - bid) STORED,
  daily_high DECIMAL(18,8),
  daily_low DECIMAL(18,8),
  daily_change DECIMAL(18,8),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending Orders
CREATE TABLE pending_orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL,
  account_login VARCHAR(50) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  order_type VARCHAR(20) NOT NULL, -- BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP
  volume DECIMAL(18,8) NOT NULL,
  activation_price DECIMAL(18,8) NOT NULL,
  stop_loss DECIMAL(18,8),
  take_profit DECIMAL(18,8),
  created_at TIMESTAMPTZ NOT NULL,
  expiration_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'PENDING',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_orders_login ON pending_orders(account_login);
CREATE INDEX idx_pending_orders_status ON pending_orders(status);
```

### 3.2 Supabase Realtime Configuration

```sql
-- Enable Realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE trading_events;
ALTER PUBLICATION supabase_realtime ADD TABLE account_equity;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;

-- Row Level Security (enable for production)
ALTER TABLE trading_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_equity ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
```

## 4. Implementation Design

### 4.1 Unified gRPC Manager

```typescript
// src/lib/grpc/stream-manager.ts

interface StreamConfig {
  name: string;
  serviceMethod: string;
  bufferMs: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  transform: (data: any) => any;
  table: string;
  dedupeKey?: string;
}

const STREAM_CONFIGS: StreamConfig[] = [
  {
    name: 'ledgers',
    serviceMethod: 'getLedgersStreamByGroupsOrLogins',
    bufferMs: 100,
    priority: 'critical',
    transform: transformLedger,
    table: 'withdrawals',
    dedupeKey: 'uuid',
  },
  {
    name: 'tradingEvents',
    serviceMethod: 'getTradingEventsStream',
    bufferMs: 100,
    priority: 'critical',
    transform: transformTradingEvent,
    table: 'trading_events',
    dedupeKey: 'uuid',
  },
  {
    name: 'equity',
    serviceMethod: 'getClientEquityStream',
    bufferMs: 5000,
    priority: 'high',
    transform: transformEquity,
    table: 'account_equity',
    dedupeKey: 'account_login', // Keep only latest per account
  },
  {
    name: 'positions',
    serviceMethod: 'getOpenPositionsStreamByGroupsOrLogins',
    bufferMs: 1000,
    priority: 'high',
    transform: transformPosition,
    table: 'positions',
    dedupeKey: 'position_id',
  },
  // ... more configs
];

class GrpcStreamManager {
  private streams: Map<string, GrpcStream> = new Map();
  private buffers: Map<string, EventBuffer> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();

  async connectAll(systemUuid: string, groups: string[]) {
    for (const config of STREAM_CONFIGS) {
      await this.connect(config, systemUuid, groups);
    }
  }

  private async connect(config: StreamConfig, systemUuid: string, groups: string[]) {
    const stream = await this.grpcClient[config.serviceMethod]({
      systemUuid,
      groups,
    });

    stream.on('data', (data) => {
      this.onData(config, data);
    });

    stream.on('error', (error) => {
      this.onError(config, error);
      this.reconnect(config, systemUuid, groups);
    });

    this.streams.set(config.name, stream);
    this.buffers.set(config.name, new EventBuffer(config.dedupeKey));
  }

  private onData(config: StreamConfig, data: any) {
    const transformed = config.transform(data);
    const buffer = this.buffers.get(config.name)!;

    buffer.add(transformed);

    // Schedule flush based on priority
    if (!this.flushTimers.has(config.name)) {
      const timer = setTimeout(
        () => this.flush(config),
        config.bufferMs
      );
      this.flushTimers.set(config.name, timer);
    }
  }

  private async flush(config: StreamConfig) {
    this.flushTimers.delete(config.name);

    const buffer = this.buffers.get(config.name)!;
    const records = buffer.drain();

    if (records.length === 0) return;

    // Batch upsert to Supabase
    const { error } = await supabase
      .from(config.table)
      .upsert(records, {
        onConflict: config.dedupeKey,
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`[${config.name}] Upsert failed:`, error);
      // Re-add to buffer for retry
      records.forEach(r => buffer.add(r));
    }

    console.log(`[${config.name}] Flushed ${records.length} records`);
  }
}
```

### 4.2 Event Buffer with Deduplication

```typescript
// src/lib/grpc/event-buffer.ts

class EventBuffer<T extends Record<string, any>> {
  private buffer: Map<string, T> = new Map();
  private dedupeKey: string;

  constructor(dedupeKey: string = 'uuid') {
    this.dedupeKey = dedupeKey;
  }

  add(record: T) {
    const key = record[this.dedupeKey];
    // Always keep the latest version
    this.buffer.set(key, {
      ...record,
      updated_at: new Date().toISOString(),
    });
  }

  drain(): T[] {
    const records = Array.from(this.buffer.values());
    this.buffer.clear();
    return records;
  }

  size(): number {
    return this.buffer.size;
  }
}
```

### 4.3 Frontend Hooks with Realtime

```typescript
// src/hooks/useTradingEvents.ts

export function useTradingEvents(options: { accountLogin?: string }) {
  const queryClient = useQueryClient();

  // Initial fetch from cache
  const query = useQuery({
    queryKey: ['tradingEvents', options.accountLogin],
    queryFn: async () => {
      const { data } = await supabase
        .from('trading_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return data;
    },
    staleTime: 10000,
  });

  // Realtime subscription
  useEffect(() => {
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
          // Optimistic update
          queryClient.setQueryData(
            ['tradingEvents', options.accountLogin],
            (old: TradingEvent[] | undefined) => {
              if (!old) return [payload.new];
              return [payload.new, ...old].slice(0, 100);
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.accountLogin, queryClient]);

  return query;
}
```

## 5. Performance Considerations

### 5.1 Buffer Tuning by Stream Type

| Stream Type | Buffer Size | Flush Interval | Max Batch |
|-------------|-------------|----------------|-----------|
| Critical | 10 | 100ms | 10 |
| High | 100 | 1000ms | 500 |
| Medium | 500 | 500ms | 1000 |
| Low | 1 | 0ms | 1 |

### 5.2 Equity Stream Optimization (Resource-Intensive)

Match-Trade 공식 경고:
> "The stream can be resource-intensive. Although the default update interval is
> set to 5 seconds, we recommend using it with caution."

#### Problem Analysis
- 기본 업데이트 간격: 5초
- 1000 계정 × 12 updates/min = **720,000 records/hour** to DB
- 메모리, CPU, DB 연결 모두 과부하 위험

#### Optimization Strategy 1: Tiered Subscription

```typescript
// 계정 중요도에 따른 구독 분리
const TIERS = {
  VIP: {
    updateInterval: 5000,    // 5초 (기본값)
    dbWriteInterval: 5000,   // 매번 저장
    accounts: ['login1', 'login2'],  // VIP 고객만
  },
  ACTIVE: {
    updateInterval: 5000,    // 5초
    dbWriteInterval: 30000,  // 30초마다 저장 (6개 중 1개만)
    groups: ['active_traders'],
  },
  DORMANT: {
    updateInterval: 5000,    // 5초
    dbWriteInterval: 300000, // 5분마다 저장
    groups: ['dormant'],
  },
};
```

#### Optimization Strategy 2: Delta-Only Storage

```typescript
// 의미 있는 변화만 저장
const EQUITY_CHANGE_THRESHOLD = 0.01; // 1% 변화

function shouldSaveEquity(prev: number, current: number): boolean {
  if (!prev) return true;
  const changeRatio = Math.abs(current - prev) / prev;
  return changeRatio >= EQUITY_CHANGE_THRESHOLD;
}
```

#### Optimization Strategy 3: Aggregated Writes

```typescript
// 메모리에 최신값만 유지, 주기적 배치 저장
class EquityAggregator {
  private latestValues: Map<string, EquityData> = new Map();
  private flushInterval: number = 30000; // 30초

  onEquityUpdate(login: string, data: EquityData) {
    // 항상 최신값으로 덮어쓰기 (메모리만)
    this.latestValues.set(login, {
      ...data,
      updatedAt: Date.now(),
    });
  }

  async flush() {
    const records = Array.from(this.latestValues.values());
    if (records.length === 0) return;

    // 한 번에 배치 upsert
    await supabase
      .from('account_equity')
      .upsert(records, { onConflict: 'account_login' });

    // 저장 후에도 메모리 유지 (다음 delta 비교용)
  }
}
```

#### Optimization Strategy 4: Group Sharding

```typescript
// 그룹별 별도 스트림으로 분산
const GROUP_SHARDS = [
  { groups: ['group_a', 'group_b'], streamId: 'shard-1' },
  { groups: ['group_c', 'group_d'], streamId: 'shard-2' },
  { groups: ['group_e', 'group_f'], streamId: 'shard-3' },
];

// 각 샤드를 별도 워커/컨테이너에서 실행
for (const shard of GROUP_SHARDS) {
  new EquityStreamService({
    groups: shard.groups,
    instanceId: shard.streamId,
  }).start();
}
```

#### Recommended Configuration

| 계정 수 | 전략 | 예상 DB Writes/Hour |
|--------|------|-------------------|
| < 100 | 전체 구독 + 30초 flush | 12,000 |
| 100-1000 | Tiered + Delta | ~5,000 |
| 1000-10000 | Group Sharding + Aggregation | ~20,000 |
| > 10000 | 외부 시계열 DB (InfluxDB/TimescaleDB) | N/A |

#### Frontend Optimization

```typescript
// 프론트엔드는 Supabase Realtime 대신 폴링 권장
// Equity는 초단위 업데이트 불필요
const useAccountEquity = (login: string) => {
  return useQuery({
    queryKey: ['equity', login],
    queryFn: () => fetchEquity(login),
    staleTime: 10000,       // 10초 캐시
    refetchInterval: 30000,  // 30초 폴링
  });
};
```

### 5.3 Connection Management

- **Heartbeat**: gRPC ping every 50 seconds (per Match-Trade spec)
- **Reconnect**: Exponential backoff (1s, 2s, 4s, 8s, max 30s)
- **Connection Pool**: One connection per stream type
- **Load Distribution**: Split equity stream by group to avoid overload

### 5.4 Database Optimization

- **Partitioning**: Consider partitioning `trading_events` by month
- **Indexes**: Composite indexes for common query patterns
- **Vacuum**: Schedule regular vacuum for high-write tables
- **Connection Pool**: Use pgbouncer for connection management

## 6. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Next.js Frontend)                    │
│  - Pages & API Routes                                           │
│  - Cron Jobs (/api/cron/sync-*)                                │
│  - SSR with Supabase client                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 gRPC Stream Worker (Separate)                   │
│  Options:                                                       │
│  1. Railway/Render (long-running Node.js)                       │
│  2. AWS ECS/Fargate                                             │
│  3. Google Cloud Run (always-on)                                │
│  4. Self-hosted VPS                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                             │
│  - PostgreSQL with Realtime                                     │
│  - Row Level Security                                           │
│  - Edge Functions (optional)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1 Why Separate gRPC Worker?

Vercel Functions have a 10-60s timeout limit, unsuitable for persistent gRPC streams.
The gRPC worker needs to run as a **long-running process** on:
- Railway ($5/mo starter)
- Render ($7/mo starter)
- Fly.io (free tier available)
- Self-hosted (existing VPS)

## 7. Implementation Priority

### Phase 1 (Current)
- [x] Cron-based sync (1-minute intervals)
- [ ] gRPC Ledger stream for withdrawals
- [ ] Supabase Realtime subscription

### Phase 2
- [ ] Trading Events stream (margin calls, stop-outs)
- [ ] Account Equity stream
- [ ] Trading Events dashboard UI

### Phase 3
- [ ] Positions stream
- [ ] Pending Orders stream
- [ ] Unified gRPC manager

### Phase 4
- [ ] Quotes stream (for price ticker)
- [ ] Historical data archival
- [ ] Analytics & reporting

## 8. Monitoring & Alerts

```typescript
// Metrics to track
interface StreamMetrics {
  streamName: string;
  eventsReceived: number;
  eventsWritten: number;
  bufferSize: number;
  lastEventAt: Date;
  lastFlushAt: Date;
  errorCount: number;
  reconnectCount: number;
}

// Alert conditions
const ALERT_CONDITIONS = {
  NO_EVENTS_THRESHOLD: 5 * 60 * 1000, // 5 minutes
  ERROR_RATE_THRESHOLD: 0.05, // 5% errors
  BUFFER_SIZE_THRESHOLD: 1000, // buffer overflow risk
};
```

## 9. Security Considerations

1. **API Key Rotation**: Store Match-Trade credentials in env vars, rotate quarterly
2. **Network Security**: Use TLS for all gRPC connections
3. **Rate Limiting**: Implement client-side rate limiting per stream
4. **Data Validation**: Validate all incoming gRPC data before DB write
5. **Audit Logging**: Log all sync operations for compliance

---

*Document Version: 1.0*
*Last Updated: 2025-12-29*
