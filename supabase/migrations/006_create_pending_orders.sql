-- Pending Orders Table (gRPC Streaming Phase 3)
-- Migration: 006_create_pending_orders
-- Created: 2025-12-29
-- Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 3

-- ============================================================================
-- pending_orders Table - Real-time pending orders from gRPC stream
-- Order Types: BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_orders (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Match-Trade Order ID (unique identifier)
  order_id BIGINT UNIQUE NOT NULL,

  -- Account Information
  account_login VARCHAR(50) NOT NULL,
  account_uuid TEXT,

  -- Symbol Information
  symbol VARCHAR(50) NOT NULL,

  -- Order Type
  order_type VARCHAR(30) NOT NULL CHECK (order_type IN (
    'BUY_LIMIT',
    'SELL_LIMIT',
    'BUY_STOP',
    'SELL_STOP',
    'BUY_STOP_LIMIT',
    'SELL_STOP_LIMIT'
  )),

  -- Order Details
  volume DECIMAL(18, 8) NOT NULL,
  activation_price DECIMAL(18, 8) NOT NULL,
  limit_price DECIMAL(18, 8),  -- For stop-limit orders

  -- Risk Management
  stop_loss DECIMAL(18, 8),
  take_profit DECIMAL(18, 8),

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'ACTIVATED',
    'CANCELLED',
    'EXPIRED',
    'FILLED'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL,
  expiration_at TIMESTAMPTZ,  -- Order expiration time
  activated_at TIMESTAMPTZ,  -- When order was triggered
  cancelled_at TIMESTAMPTZ,

  -- Comments
  comment TEXT,

  -- Sync timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookup by order ID
CREATE INDEX IF NOT EXISTS idx_pending_orders_order_id ON pending_orders(order_id);

-- Filter by account
CREATE INDEX IF NOT EXISTS idx_pending_orders_login ON pending_orders(account_login);
CREATE INDEX IF NOT EXISTS idx_pending_orders_account_uuid ON pending_orders(account_uuid);

-- Filter by symbol
CREATE INDEX IF NOT EXISTS idx_pending_orders_symbol ON pending_orders(symbol);

-- Filter by order type
CREATE INDEX IF NOT EXISTS idx_pending_orders_type ON pending_orders(order_type);

-- Filter by status (most common filter)
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);

-- Sort by creation time
CREATE INDEX IF NOT EXISTS idx_pending_orders_created ON pending_orders(created_at DESC);

-- Expiration tracking
CREATE INDEX IF NOT EXISTS idx_pending_orders_expiration ON pending_orders(expiration_at)
  WHERE status = 'PENDING';

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pending_orders_login_status
  ON pending_orders(account_login, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_orders_symbol_status
  ON pending_orders(symbol, status, created_at DESC);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pending_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pending_orders_updated_at ON pending_orders;
CREATE TRIGGER pending_orders_updated_at
  BEFORE UPDATE ON pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_orders_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON pending_orders;
DROP POLICY IF EXISTS "Allow insert for service role" ON pending_orders;
DROP POLICY IF EXISTS "Allow update for service role" ON pending_orders;
DROP POLICY IF EXISTS "Allow delete for service role" ON pending_orders;

CREATE POLICY "Allow read for authenticated" ON pending_orders
  FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON pending_orders
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON pending_orders
  FOR UPDATE USING (true);
CREATE POLICY "Allow delete for service role" ON pending_orders
  FOR DELETE USING (true);

-- ============================================================================
-- Enable Supabase Realtime
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE pending_orders;

-- ============================================================================
-- Initialize sync_metadata for pending_orders
-- ============================================================================

INSERT INTO sync_metadata (table_name, last_synced_at, record_count)
VALUES ('pending_orders', '1970-01-01T00:00:00Z', 0)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE pending_orders IS
  'Real-time pending orders from gRPC stream - Phase 3 (MISSION-20251229-GRPC002)';

COMMENT ON COLUMN pending_orders.order_id IS 'Unique order ID from Match-Trade';
COMMENT ON COLUMN pending_orders.order_type IS 'Order type: BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP, etc.';
COMMENT ON COLUMN pending_orders.activation_price IS 'Price at which the order will be activated';
COMMENT ON COLUMN pending_orders.limit_price IS 'Limit price for stop-limit orders';
COMMENT ON COLUMN pending_orders.status IS 'Order status: PENDING, ACTIVATED, CANCELLED, EXPIRED, FILLED';
