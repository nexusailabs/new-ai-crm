-- Account Equity Table (gRPC Streaming Phase 2)
-- Migration: 004_create_account_equity
-- Created: 2025-12-29
-- Mission: MISSION-20251229-GRPC002 - gRPC Streaming System Phase 2-4
--
-- IMPORTANT: This table uses Delta-Only Storage strategy
-- Only significant equity changes (>1%) are stored to minimize DB load
-- See: GRPC_STREAMING_ARCHITECTURE.md Section 5.2

-- ============================================================================
-- account_equity Table - Real-time equity tracking from gRPC stream
-- Optimized for high-frequency updates with delta-only storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_equity (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Account Information (unique constraint for upsert)
  account_login VARCHAR(50) UNIQUE NOT NULL,
  account_uuid TEXT,
  account_group VARCHAR(100),

  -- Equity Data
  equity DECIMAL(18, 8) NOT NULL,
  balance DECIMAL(18, 8) NOT NULL,
  credit DECIMAL(18, 8) DEFAULT 0,

  -- Margin Data
  margin DECIMAL(18, 8) DEFAULT 0,
  free_margin DECIMAL(18, 8) DEFAULT 0,
  margin_level DECIMAL(18, 4),  -- In percentage (e.g., 150.00 = 150%)

  -- Profit/Loss
  floating_pl DECIMAL(18, 8) DEFAULT 0,
  closed_pl_today DECIMAL(18, 8) DEFAULT 0,

  -- Tier Classification (for optimization)
  tier VARCHAR(20) DEFAULT 'STANDARD' CHECK (tier IN ('VIP', 'ACTIVE', 'DORMANT', 'STANDARD')),

  -- Timestamps
  last_activity_at TIMESTAMPTZ,  -- Last trading activity
  updated_at TIMESTAMPTZ DEFAULT NOW(),  -- Last update from stream
  synced_at TIMESTAMPTZ DEFAULT NOW()  -- Last sync to DB
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookup by login
CREATE INDEX IF NOT EXISTS idx_account_equity_login ON account_equity(account_login);

-- Account UUID lookup
CREATE INDEX IF NOT EXISTS idx_account_equity_uuid ON account_equity(account_uuid);

-- Group filtering
CREATE INDEX IF NOT EXISTS idx_account_equity_group ON account_equity(account_group);

-- Tier filtering (for tiered subscription)
CREATE INDEX IF NOT EXISTS idx_account_equity_tier ON account_equity(tier);

-- Updated timestamp (for polling queries)
CREATE INDEX IF NOT EXISTS idx_account_equity_updated ON account_equity(updated_at DESC);

-- Margin level (for margin call detection)
CREATE INDEX IF NOT EXISTS idx_account_equity_margin_level ON account_equity(margin_level);

-- Composite index for tiered queries
CREATE INDEX IF NOT EXISTS idx_account_equity_tier_updated
  ON account_equity(tier, updated_at DESC);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_account_equity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_equity_updated_at ON account_equity;
CREATE TRIGGER account_equity_updated_at
  BEFORE UPDATE ON account_equity
  FOR EACH ROW
  EXECUTE FUNCTION update_account_equity_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE account_equity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON account_equity;
DROP POLICY IF EXISTS "Allow insert for service role" ON account_equity;
DROP POLICY IF EXISTS "Allow update for service role" ON account_equity;
DROP POLICY IF EXISTS "Allow delete for service role" ON account_equity;

CREATE POLICY "Allow read for authenticated" ON account_equity
  FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON account_equity
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON account_equity
  FOR UPDATE USING (true);
CREATE POLICY "Allow delete for service role" ON account_equity
  FOR DELETE USING (true);

-- ============================================================================
-- NOTE: Realtime NOT enabled for account_equity
-- Frontend should use polling (30-second interval) instead
-- This reduces WebSocket load significantly
-- ============================================================================

-- ============================================================================
-- Initialize sync_metadata for account_equity
-- ============================================================================

INSERT INTO sync_metadata (table_name, last_synced_at, record_count)
VALUES ('account_equity', '1970-01-01T00:00:00Z', 0)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE account_equity IS
  'Real-time account equity from gRPC stream - Delta-Only Storage (MISSION-20251229-GRPC002)';

COMMENT ON COLUMN account_equity.account_login IS 'Unique trading account login';
COMMENT ON COLUMN account_equity.equity IS 'Current equity (balance + floating P/L)';
COMMENT ON COLUMN account_equity.margin_level IS 'Margin level percentage (equity/margin * 100)';
COMMENT ON COLUMN account_equity.tier IS 'Account tier for tiered subscription optimization';
COMMENT ON COLUMN account_equity.floating_pl IS 'Unrealized profit/loss from open positions';
