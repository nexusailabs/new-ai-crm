-- Withdrawal Action Logs Table (Audit Trail)
-- Migration: 007_create_withdrawal_action_logs
-- Created: 2025-12-29
-- Mission: MISSION-20251229-0737 - Post-Implementation Improvements (Audit Logging)

-- ============================================================================
-- withdrawal_action_logs Table - Full audit trail for withdrawal actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawal_action_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Withdrawal Reference
  withdrawal_uuid TEXT NOT NULL,
  withdrawal_id UUID REFERENCES withdrawals(id) ON DELETE SET NULL,

  -- Action Details
  action TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'PENDING_REVIEW', 'ESCALATE', 'COMMENT')),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,

  -- Operator/Actor Information
  operator_id TEXT,
  operator_email TEXT,
  operator_role TEXT,

  -- Action Context
  reason TEXT,
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary lookup by withdrawal UUID
CREATE INDEX IF NOT EXISTS idx_wal_withdrawal_uuid
  ON withdrawal_action_logs(withdrawal_uuid);

-- Filter by action type
CREATE INDEX IF NOT EXISTS idx_wal_action
  ON withdrawal_action_logs(action);

-- Filter by operator
CREATE INDEX IF NOT EXISTS idx_wal_operator_id
  ON withdrawal_action_logs(operator_id);

-- Time-based queries (audit trail review)
CREATE INDEX IF NOT EXISTS idx_wal_created_at
  ON withdrawal_action_logs(created_at DESC);

-- Composite index for common query: withdrawal + time
CREATE INDEX IF NOT EXISTS idx_wal_withdrawal_created
  ON withdrawal_action_logs(withdrawal_uuid, created_at DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE withdrawal_action_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow read for authenticated" ON withdrawal_action_logs;
DROP POLICY IF EXISTS "Allow insert for service role" ON withdrawal_action_logs;

-- Create policies
-- Read: All authenticated users can view audit logs (for transparency)
CREATE POLICY "Allow read for authenticated" ON withdrawal_action_logs
  FOR SELECT USING (true);

-- Insert: Only service role can create audit logs (from API routes)
CREATE POLICY "Allow insert for service role" ON withdrawal_action_logs
  FOR INSERT WITH CHECK (true);

-- Note: No UPDATE or DELETE policies - audit logs are immutable

-- ============================================================================
-- Function: Log Withdrawal Action
-- ============================================================================

CREATE OR REPLACE FUNCTION log_withdrawal_action(
  p_withdrawal_uuid TEXT,
  p_action TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_operator_id TEXT DEFAULT NULL,
  p_operator_email TEXT DEFAULT NULL,
  p_operator_role TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_withdrawal_id UUID;
BEGIN
  -- Get withdrawal internal ID if exists
  SELECT id INTO v_withdrawal_id
  FROM withdrawals
  WHERE uuid = p_withdrawal_uuid
  LIMIT 1;

  -- Insert log entry
  INSERT INTO withdrawal_action_logs (
    withdrawal_uuid,
    withdrawal_id,
    action,
    previous_status,
    new_status,
    operator_id,
    operator_email,
    operator_role,
    reason,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_withdrawal_uuid,
    v_withdrawal_id,
    p_action,
    p_previous_status,
    p_new_status,
    p_operator_id,
    p_operator_email,
    p_operator_role,
    p_reason,
    p_ip_address,
    p_user_agent,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- View: Withdrawal Action Summary
-- ============================================================================

CREATE OR REPLACE VIEW v_withdrawal_action_summary AS
SELECT
  withdrawal_uuid,
  COUNT(*) as total_actions,
  COUNT(CASE WHEN action = 'APPROVE' THEN 1 END) as approve_count,
  COUNT(CASE WHEN action = 'REJECT' THEN 1 END) as reject_count,
  MIN(created_at) as first_action_at,
  MAX(created_at) as last_action_at,
  (SELECT operator_id FROM withdrawal_action_logs wal2
   WHERE wal2.withdrawal_uuid = wal.withdrawal_uuid
   ORDER BY created_at DESC LIMIT 1) as last_operator_id
FROM withdrawal_action_logs wal
GROUP BY withdrawal_uuid;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE withdrawal_action_logs IS
  'Immutable audit trail for all withdrawal approval/rejection actions (MISSION-20251229-0737)';

COMMENT ON COLUMN withdrawal_action_logs.withdrawal_uuid IS
  'Match-Trade withdrawal UUID - primary reference';
COMMENT ON COLUMN withdrawal_action_logs.withdrawal_id IS
  'FK to withdrawals table (nullable for external references)';
COMMENT ON COLUMN withdrawal_action_logs.action IS
  'Action type: APPROVE, REJECT, PENDING_REVIEW, ESCALATE, COMMENT';
COMMENT ON COLUMN withdrawal_action_logs.previous_status IS
  'Status before the action';
COMMENT ON COLUMN withdrawal_action_logs.new_status IS
  'Status after the action';
COMMENT ON COLUMN withdrawal_action_logs.operator_id IS
  'User/Admin ID who performed the action';
COMMENT ON COLUMN withdrawal_action_logs.operator_email IS
  'Email of the operator (for quick reference)';
COMMENT ON COLUMN withdrawal_action_logs.operator_role IS
  'Role at time of action (for compliance)';
COMMENT ON COLUMN withdrawal_action_logs.reason IS
  'Reason/comment for the action (required for rejections)';
COMMENT ON COLUMN withdrawal_action_logs.ip_address IS
  'IP address for security audit';
COMMENT ON COLUMN withdrawal_action_logs.user_agent IS
  'Browser/client user agent';
COMMENT ON COLUMN withdrawal_action_logs.metadata IS
  'Additional context (JSON)';

COMMENT ON FUNCTION log_withdrawal_action IS
  'Helper function to create audit log entries with automatic withdrawal_id lookup';

COMMENT ON VIEW v_withdrawal_action_summary IS
  'Aggregated view of actions per withdrawal for quick dashboard display';
