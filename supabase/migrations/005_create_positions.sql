-- Positions Table (gRPC Streaming Phase 3)
-- Migration: 005_create_positions
-- Created: 2025-12-29
-- Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3

-- ============================================================================
-- positions Table - Real-time open positions from gRPC stream
-- ============================================================================

CREATE TABLE IF NOT EXISTS positions (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Match-Trade Position ID (unique identifier)
  position_id BIGINT UNIQUE NOT NULL,

  -- Account Information
  account_login VARCHAR(50) NOT NULL,
  account_uuid TEXT,

  -- Symbol Information
  symbol VARCHAR(50) NOT NULL,
  alias VARCHAR(100),  -- Symbol alias if any

  -- Position Details
  volume DECIMAL(18, 8) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),

  -- Pricing
  open_time TIMESTAMPTZ NOT NULL,
  open_price DECIMAL(18, 8) NOT NULL,
  current_price DECIMAL(18, 8),

  -- Risk Management
  stop_loss DECIMAL(18, 8),
  take_profit DECIMAL(18, 8),

  -- P&L
  profit DECIMAL(18, 8) DEFAULT 0,
  net_profit DECIMAL(18, 8) DEFAULT 0,
  swap DECIMAL(18, 8) DEFAULT 0,
  commission DECIMAL(18, 8) DEFAULT 0,

  -- Margin
  margin DECIMAL(18, 8) DEFAULT 0,

  -- Status
  is_closed BOOLEAN DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  close_price DECIMAL(18, 8),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookup by position ID
CREATE INDEX IF NOT EXISTS idx_positions_position_id ON positions(position_id);

-- Filter by account
CREATE INDEX IF NOT EXISTS idx_positions_login ON positions(account_login);
CREATE INDEX IF NOT EXISTS idx_positions_account_uuid ON positions(account_uuid);

-- Filter by symbol
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);

-- Filter by side
CREATE INDEX IF NOT EXISTS idx_positions_side ON positions(side);

-- Open positions (most common query)
CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(is_closed, open_time DESC);

-- Sort by open time
CREATE INDEX IF NOT EXISTS idx_positions_open_time ON positions(open_time DESC);

-- Profit tracking
CREATE INDEX IF NOT EXISTS idx_positions_profit ON positions(profit DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_positions_login_open
  ON positions(account_login, is_closed, open_time DESC);
CREATE INDEX IF NOT EXISTS idx_positions_symbol_open
  ON positions(symbol, is_closed, open_time DESC);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS positions_updated_at ON positions;
CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_positions_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON positions;
DROP POLICY IF EXISTS "Allow insert for service role" ON positions;
DROP POLICY IF EXISTS "Allow update for service role" ON positions;
DROP POLICY IF EXISTS "Allow delete for service role" ON positions;

CREATE POLICY "Allow read for authenticated" ON positions
  FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON positions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON positions
  FOR UPDATE USING (true);
CREATE POLICY "Allow delete for service role" ON positions
  FOR DELETE USING (true);

-- ============================================================================
-- Enable Supabase Realtime
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE positions;

-- ============================================================================
-- Initialize sync_metadata for positions
-- ============================================================================

INSERT INTO sync_metadata (table_name, last_synced_at, record_count)
VALUES ('positions', '1970-01-01T00:00:00Z', 0)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE positions IS
  'Real-time open positions from gRPC stream - Phase 3 (MISSION-20251229-GRPC002)';

COMMENT ON COLUMN positions.position_id IS 'Unique position ID from Match-Trade';
COMMENT ON COLUMN positions.side IS 'Position direction: BUY or SELL';
COMMENT ON COLUMN positions.profit IS 'Unrealized P/L in account currency';
COMMENT ON COLUMN positions.net_profit IS 'P/L after swap and commission';
COMMENT ON COLUMN positions.is_closed IS 'TRUE when position is closed';
