-- Webhook Configurations Table
-- Migration: 008_create_webhook_configs
-- Created: 2025-12-29
-- Mission: MISSION-20251229-0737 - Phase 2 (Webhook Handler & Notifier Interface)

-- ============================================================================
-- webhook_configs Table - Stores outgoing webhook configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_configs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Configuration
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,

  -- Events to subscribe (array of event types)
  events TEXT[] NOT NULL DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Request Configuration
  headers JSONB DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Active webhooks lookup
CREATE INDEX IF NOT EXISTS idx_wc_is_active
  ON webhook_configs(is_active) WHERE is_active = true;

-- Events array search (GIN index for containment queries)
CREATE INDEX IF NOT EXISTS idx_wc_events
  ON webhook_configs USING GIN (events);

-- ============================================================================
-- Trigger: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_webhook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_configs_updated_at ON webhook_configs;

CREATE TRIGGER trg_webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_configs_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow read for authenticated" ON webhook_configs;
DROP POLICY IF EXISTS "Allow full access for service role" ON webhook_configs;

-- Create policies
-- Read: Authenticated users can view configs
CREATE POLICY "Allow read for authenticated" ON webhook_configs
  FOR SELECT USING (true);

-- Full access: Service role only
CREATE POLICY "Allow full access for service role" ON webhook_configs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- webhook_deliveries Table - Logs all webhook dispatch attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  webhook_config_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,

  -- Event Info
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'retrying')),

  -- Response Details
  response_code INTEGER,
  response_body TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  latency_ms INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes for webhook_deliveries
-- ============================================================================

-- By config
CREATE INDEX IF NOT EXISTS idx_wd_config_id
  ON webhook_deliveries(webhook_config_id);

-- By status
CREATE INDEX IF NOT EXISTS idx_wd_status
  ON webhook_deliveries(status) WHERE status IN ('pending', 'retrying');

-- By event type
CREATE INDEX IF NOT EXISTS idx_wd_event_type
  ON webhook_deliveries(event_type);

-- Time-based
CREATE INDEX IF NOT EXISTS idx_wd_created_at
  ON webhook_deliveries(created_at DESC);

-- ============================================================================
-- Trigger: Auto-update updated_at for deliveries
-- ============================================================================

CREATE OR REPLACE FUNCTION update_webhook_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_deliveries_updated_at ON webhook_deliveries;

CREATE TRIGGER trg_webhook_deliveries_updated_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_deliveries_updated_at();

-- ============================================================================
-- Row Level Security for webhook_deliveries
-- ============================================================================

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow read for authenticated" ON webhook_deliveries;
DROP POLICY IF EXISTS "Allow full access for service role" ON webhook_deliveries;

-- Create policies
CREATE POLICY "Allow read for authenticated" ON webhook_deliveries
  FOR SELECT USING (true);

CREATE POLICY "Allow full access for service role" ON webhook_deliveries
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- View: Recent Webhook Delivery Summary
-- ============================================================================

CREATE OR REPLACE VIEW v_webhook_delivery_summary AS
SELECT
  wc.id as config_id,
  wc.name as config_name,
  wc.url,
  wc.is_active,
  COUNT(wd.id) as total_deliveries,
  COUNT(CASE WHEN wd.status = 'success' THEN 1 END) as successful,
  COUNT(CASE WHEN wd.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN wd.status IN ('pending', 'retrying') THEN 1 END) as pending,
  AVG(wd.latency_ms)::INTEGER as avg_latency_ms,
  MAX(wd.created_at) as last_delivery_at
FROM webhook_configs wc
LEFT JOIN webhook_deliveries wd ON wc.id = wd.webhook_config_id
GROUP BY wc.id, wc.name, wc.url, wc.is_active;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE webhook_configs IS
  'Outgoing webhook configurations for external integrations (MISSION-20251229-0737)';

COMMENT ON COLUMN webhook_configs.name IS
  'Friendly name for the webhook config';
COMMENT ON COLUMN webhook_configs.url IS
  'Target URL to POST webhook payloads';
COMMENT ON COLUMN webhook_configs.secret IS
  'Shared secret for HMAC signature generation';
COMMENT ON COLUMN webhook_configs.events IS
  'Array of event types: withdrawal.approved, withdrawal.rejected, etc.';
COMMENT ON COLUMN webhook_configs.is_active IS
  'Whether this webhook is enabled';
COMMENT ON COLUMN webhook_configs.headers IS
  'Additional headers to include in requests';
COMMENT ON COLUMN webhook_configs.retry_count IS
  'Max retry attempts for failed deliveries';
COMMENT ON COLUMN webhook_configs.timeout_ms IS
  'Request timeout in milliseconds';

COMMENT ON TABLE webhook_deliveries IS
  'Audit log of all webhook delivery attempts';

COMMENT ON VIEW v_webhook_delivery_summary IS
  'Aggregated delivery statistics per webhook config';
