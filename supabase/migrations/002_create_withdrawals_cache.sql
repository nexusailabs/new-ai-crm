-- Withdrawals Cache Table (Hybrid Data Loading Architecture)
-- Migration: 002_create_withdrawals_cache
-- Created: 2025-12-29
-- Mission: MISSION-20251229-0001 - Hybrid Data Loading Architecture

-- ============================================================================
-- sync_metadata Table - Tracks last sync time for each cached table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT UNIQUE NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  record_count INTEGER DEFAULT 0,
  sync_duration_ms INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by table_name
CREATE INDEX IF NOT EXISTS idx_sync_metadata_table_name ON sync_metadata(table_name);

-- ============================================================================
-- withdrawals Table - Cache for Match-Trade withdrawal data
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawals (
  -- Primary Key (internal)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Match-Trade UUID (unique identifier from API)
  uuid TEXT UNIQUE NOT NULL,

  -- Account Information
  account_uuid TEXT NOT NULL,
  account_email TEXT,
  account_name TEXT,
  account_surname TEXT,

  -- Financial Details
  amount DECIMAL(18, 8) NOT NULL,
  net_amount DECIMAL(18, 8),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'NEW',
  mapped_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (mapped_status IN ('PENDING', 'APPROVED', 'REJECTED')),

  -- Payment Gateway Details
  payment_gateway_uuid TEXT,
  payment_gateway_name TEXT,

  -- Additional Info
  wallet_address TEXT,
  reference TEXT,
  payment_id TEXT,

  -- Partner Info
  partner_id INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL,  -- From Match-Trade API
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Full JSON response for reference
  raw_data JSONB
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookup by Match-Trade UUID
CREATE INDEX IF NOT EXISTS idx_withdrawals_uuid ON withdrawals(uuid);

-- Filter by account
CREATE INDEX IF NOT EXISTS idx_withdrawals_account_uuid ON withdrawals(account_uuid);
CREATE INDEX IF NOT EXISTS idx_withdrawals_account_email ON withdrawals(account_email);

-- Filter by status (most common query)
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_mapped_status ON withdrawals(mapped_status);

-- Sort by date (most common sort)
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_updated_at ON withdrawals(updated_at DESC);

-- Delta sync: find records updated after a timestamp
CREATE INDEX IF NOT EXISTS idx_withdrawals_synced_at ON withdrawals(synced_at);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created
  ON withdrawals(mapped_status, created_at DESC);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS withdrawals_updated_at ON withdrawals;
CREATE TRIGGER withdrawals_updated_at
  BEFORE UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawals_updated_at();

-- Same for sync_metadata
CREATE OR REPLACE FUNCTION update_sync_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_metadata_updated_at ON sync_metadata;
CREATE TRIGGER sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_metadata_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow read for authenticated" ON withdrawals;
DROP POLICY IF EXISTS "Allow insert for service role" ON withdrawals;
DROP POLICY IF EXISTS "Allow update for service role" ON withdrawals;
DROP POLICY IF EXISTS "Allow delete for service role" ON withdrawals;

DROP POLICY IF EXISTS "Allow read for authenticated" ON sync_metadata;
DROP POLICY IF EXISTS "Allow all for service role" ON sync_metadata;

-- Create policies for withdrawals
CREATE POLICY "Allow read for authenticated" ON withdrawals
  FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON withdrawals
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON withdrawals
  FOR UPDATE USING (true);
CREATE POLICY "Allow delete for service role" ON withdrawals
  FOR DELETE USING (true);

-- Create policies for sync_metadata
CREATE POLICY "Allow read for authenticated" ON sync_metadata
  FOR SELECT USING (true);
CREATE POLICY "Allow all for service role" ON sync_metadata
  FOR ALL USING (true);

-- ============================================================================
-- Initialize sync_metadata for withdrawals table
-- ============================================================================

INSERT INTO sync_metadata (table_name, last_synced_at, record_count)
VALUES ('withdrawals', '1970-01-01T00:00:00Z', 0)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE withdrawals IS
  'Cache table for Match-Trade withdrawal data - Hybrid Data Loading Architecture (MISSION-20251229-0001)';

COMMENT ON TABLE sync_metadata IS
  'Tracks synchronization state for cached tables - Used for delta sync strategy';

COMMENT ON COLUMN withdrawals.uuid IS 'Unique identifier from Match-Trade API';
COMMENT ON COLUMN withdrawals.status IS 'Original status from Match-Trade API';
COMMENT ON COLUMN withdrawals.mapped_status IS 'Simplified status for UI (PENDING/APPROVED/REJECTED)';
COMMENT ON COLUMN withdrawals.synced_at IS 'When this record was last synced from API';
COMMENT ON COLUMN withdrawals.raw_data IS 'Full JSON response from Match-Trade API for debugging';

COMMENT ON COLUMN sync_metadata.last_synced_at IS 'Timestamp of the most recent record synced';
COMMENT ON COLUMN sync_metadata.sync_status IS 'Current sync status: idle, syncing, or error';
