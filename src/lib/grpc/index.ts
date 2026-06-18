/**
 * gRPC Streaming Services - Main Export
 * Created: 2025-12-29
 * Mission: MISSION-20251229-GRPC002 - gRPC Streaming System
 */

// ============================================================================
// Unified Stream Manager
// ============================================================================

export {
  GrpcStreamManager,
  getGlobalStreamManager,
  startAllStreams,
  stopAllStreams,
  getStreamManagerStats,
  type StreamName,
  type StreamPriority,
  type StreamConfig,
  type StreamStatus,
  type ManagerConfig,
  type ManagerStats,
} from './stream-manager';

// ============================================================================
// Ledger Stream (Deposits/Withdrawals)
// ============================================================================

export {
  LedgerStreamService,
  HistoryOperationType,
  getStreamService as getLedgerStreamService,
  startGlobalStream as startLedgerStream,
  stopGlobalStream as stopLedgerStream,
  type LedgerEntry,
  type LedgerStreamConfig,
  type StreamStats as LedgerStreamStats,
} from './ledger-stream';

// ============================================================================
// Trading Events Stream
// ============================================================================

export {
  TradingEventsStreamService,
  TradingEventType,
  TradingEventTypeNames,
  getTradingEventsStream,
  startGlobalTradingEventsStream,
  stopGlobalTradingEventsStream,
  type TradingEvent,
  type TradingEventsStreamConfig,
  type StreamStats as TradingEventsStreamStats,
} from './trading-events-stream';

// ============================================================================
// Equity Stream
// ============================================================================

export {
  EquityStreamService,
  getEquityStream,
  startGlobalEquityStream,
  stopGlobalEquityStream,
  type EquityUpdate,
  type AccountTier,
  type TierConfig,
  type EquityStreamConfig,
  type StreamStats as EquityStreamStats,
} from './equity-stream';

// ============================================================================
// Positions Stream
// ============================================================================

export {
  PositionsStreamService,
  PositionSide,
  UpdateType as PositionUpdateType,
  PositionSideNames,
  UpdateTypeNames as PositionUpdateTypeNames,
  getPositionsStream,
  startGlobalPositionsStream,
  stopGlobalPositionsStream,
  type Position,
  type PositionUpdate,
  type PositionsStreamConfig,
  type StreamStats as PositionsStreamStats,
} from './positions-stream';

// ============================================================================
// Orders Stream
// ============================================================================

export {
  OrdersStreamService,
  OrderType,
  OrderStatus,
  OrderUpdateType,
  OrderTypeNames,
  OrderStatusNames,
  OrderUpdateTypeNames,
  getOrdersStream,
  startGlobalOrdersStream,
  stopGlobalOrdersStream,
  type PendingOrder,
  type OrderUpdate,
  type OrdersStreamConfig,
  type StreamStats as OrdersStreamStats,
} from './orders-stream';
