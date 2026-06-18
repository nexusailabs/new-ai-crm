-- Trading Events Table (gRPC Streaming Phase 2)
-- Migration: 003_create_trading_events
-- Created: 2025-12-29
-- Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 2-4

-- ============================================================================
-- trading_events Table - Real-time trading events from gRPC stream
-- Events: Margin calls, stop-outs, take-profit, stop-loss, order activation
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_events (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Match-Trade UUID (unique identifier)
  uuid UUID UNIQUE NOT NULL,

  -- Event Type
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'MARGIN_CALL',
    'STOP_OUT',
    'TAKE_PROFIT',
    'STOP_LOSS',
    'ORDER_ACTIVATION',
    'POSITION_CLOSE',
    'POSITION_MODIFY',
    'ORDER_CANCEL',
    'OTHER'
  )),

  -- Account Information
  account_login VARCHAR(50) NOT NULL,
  account_uuid TEXT,
  account_group VARCHAR(100),

  -- Trading Details
  symbol VARCHAR(50),
  position_id BIGINT,
  order_id BIGINT,

  -- Financial Information
  volume DECIMAL(18, 8),
  price DECIMAL(18, 8),
  profit DECIMAL(18, 8),

  -- Event Details (flexible JSON for various event types)
  details JSONB DEFAULT '{}',

  -- Severity/Priority
  severity VARCHAR(20) DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),

  -- Timestamps
  event_time TIMESTAMPTZ NOT NULL,  -- When the event occurred
  created_at TIMESTAMPTZ NOT NULL,  -- From gRPC stream
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookup by UUID
CREATE INDEX IF NOT EXISTS idx_trading_events_uuid ON trading_events(uuid);

-- Filter by account
CREATE INDEX IF NOT EXISTS idx_trading_events_login ON trading_events(account_login);
CREATE INDEX IF NOT EXISTS idx_trading_events_account_uuid ON trading_events(account_uuid);

-- Filter by event type (common query)
CREATE INDEX IF NOT EXISTS idx_trading_events_type ON trading_events(event_type);

-- Filter by severity
CREATE INDEX IF NOT EXISTS idx_trading_events_severity ON trading_events(severity);

-- Sort by time (most common sort)
CREATE INDEX IF NOT EXISTS idx_trading_events_event_time ON trading_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_trading_events_created ON trading_events(created_at DESC);

-- Symbol and position lookup
CREATE INDEX IF NOT EXISTS idx_trading_events_symbol ON trading_events(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_events_position_id ON trading_events(position_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trading_events_type_time
  ON trading_events(event_type, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_trading_events_login_time
  ON trading_events(account_login, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_trading_events_severity_time
  ON trading_events(severity, event_time DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE trading_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON trading_events;
DROP POLICY IF EXISTS "Allow insert for service role" ON trading_events;
DROP POLICY IF EXISTS "Allow update for service role" ON trading_events;
DROP POLICY IF EXISTS "Allow delete for service role" ON trading_events;

CREATE POLICY "Allow read for authenticated" ON trading_events
  FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON trading_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON trading_events
  FOR UPDATE USING (true);
CREATE POLICY "Allow delete for service role" ON trading_events
  FOR DELETE USING (true);

-- ============================================================================
-- Enable Supabase Realtime
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE trading_events;

-- ============================================================================
-- Initialize sync_metadata for trading_events
-- ============================================================================

INSERT INTO sync_metadata (table_name, last_synced_at, record_count)
VALUES ('trading_events', '1970-01-01T00:00:00Z', 0)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE trading_events IS
  'Real-time trading events from gRPC stream - Phase 2 (MISSION-20251229-GRPC002)';

COMMENT ON COLUMN trading_events.uuid IS 'Unique identifier from Match-Trade gRPC stream';
COMMENT ON COLUMN trading_events.event_type IS 'Type of trading event (MARGIN_CALL, STOP_OUT, etc.)';
COMMENT ON COLUMN trading_events.severity IS 'Event severity for UI display and alerts';
COMMENT ON COLUMN trading_events.details IS 'Additional event-specific details as JSON';
COMMENT ON COLUMN trading_events.event_time IS 'When the event actually occurred on the trading server';
COMMENT ON COLUMN trading_events.synced_at IS 'When this record was synced to database';
