-- Trading Accounts Table (Match-Trade API v1.25 based)
-- Migration: 001_create_trading_accounts
-- Created: 2025-12-28
-- Mission: MISSION-20251228-L7WFOB

-- Create trading_accounts table
CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid TEXT UNIQUE NOT NULL,  -- Match-Trade UUID
  login TEXT NOT NULL,
  account_uuid TEXT NOT NULL REFERENCES accounts(uuid) ON DELETE CASCADE,

  -- Account Info
  offer_uuid TEXT,
  system_uuid TEXT,
  commission_uuid TEXT,
  "group" TEXT,
  leverage INTEGER DEFAULT 1,
  access TEXT DEFAULT 'FULL' CHECK (access IN ('FULL', 'CLOSE_ONLY', 'TRADING_DISABLED', 'TRADING_AND_LOGIN_DISABLED')),
  account_type TEXT DEFAULT 'DEMO' CHECK (account_type IN ('DEMO', 'REAL')),

  -- Finance Info (JSONB for flexibility)
  finance_info JSONB DEFAULT '{
    "balance": null,
    "equity": null,
    "profit": null,
    "netProfit": null,
    "margin": null,
    "freeMargin": null,
    "marginLevel": null,
    "credit": null,
    "currency": "USD",
    "currencyPrecision": 2
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT trading_accounts_login_system_unique UNIQUE (login, system_uuid)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trading_accounts_account_uuid ON trading_accounts(account_uuid);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_login ON trading_accounts(login);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_account_type ON trading_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_synced_at ON trading_accounts(synced_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_trading_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trading_accounts_updated_at ON trading_accounts;
CREATE TRIGGER trading_accounts_updated_at
  BEFORE UPDATE ON trading_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_accounts_updated_at();

-- RLS Policies
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow read for authenticated" ON trading_accounts;
DROP POLICY IF EXISTS "Allow insert for service role" ON trading_accounts;
DROP POLICY IF EXISTS "Allow update for service role" ON trading_accounts;

-- Create new policies
CREATE POLICY "Allow read for authenticated" ON trading_accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON trading_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON trading_accounts FOR UPDATE USING (true);

-- Verification comment
COMMENT ON TABLE trading_accounts IS 'Trading accounts synced from Match-Trade API v1.25 - Created by MISSION-20251228-L7WFOB';
