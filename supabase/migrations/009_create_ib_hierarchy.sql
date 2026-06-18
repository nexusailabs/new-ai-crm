-- IB Hierarchy Table
CREATE TABLE IF NOT EXISTS ib_hierarchy (
  ib_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  level VARCHAR(20) NOT NULL CHECK (level IN ('MASTER', 'BRANCH_MANAGER', 'MANAGER', 'REFERRER', 'MEMBER')),
  parent_id UUID REFERENCES ib_hierarchy(ib_id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ib_hierarchy_parent ON ib_hierarchy(parent_id);
CREATE INDEX idx_ib_hierarchy_path ON ib_hierarchy USING btree(path);
CREATE INDEX idx_ib_hierarchy_level ON ib_hierarchy(level);

-- Commission Rules Table
CREATE TABLE IF NOT EXISTS commission_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  master_percent DECIMAL(5,2) DEFAULT 0 CHECK (master_percent >= 0 AND master_percent <= 100),
  branch_manager_percent DECIMAL(5,2) DEFAULT 0 CHECK (branch_manager_percent >= 0 AND branch_manager_percent <= 100),
  manager_percent DECIMAL(5,2) DEFAULT 0 CHECK (manager_percent >= 0 AND manager_percent <= 100),
  referrer_percent DECIMAL(5,2) DEFAULT 0 CHECK (referrer_percent >= 0 AND referrer_percent <= 100),
  member_percent DECIMAL(5,2) DEFAULT 0 CHECK (member_percent >= 0 AND member_percent <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Commission Transactions Table
CREATE TABLE IF NOT EXISTS commission_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES ib_hierarchy(ib_id),
  original_amount DECIMAL(15,2) NOT NULL,
  deducted_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_commission_transactions_member ON commission_transactions(member_id);
CREATE INDEX idx_commission_transactions_status ON commission_transactions(status);

-- Commission Distributions Table
CREATE TABLE IF NOT EXISTS commission_distributions (
  distribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES commission_transactions(transaction_id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES ib_hierarchy(ib_id),
  recipient_level VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  percent_applied DECIMAL(5,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_commission_distributions_transaction ON commission_distributions(transaction_id);
CREATE INDEX idx_commission_distributions_recipient ON commission_distributions(recipient_id);

-- Commission Balances Table
CREATE TABLE IF NOT EXISTS commission_balances (
  balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID UNIQUE NOT NULL REFERENCES ib_hierarchy(ib_id) ON DELETE CASCADE,
  total_earned DECIMAL(15,2) DEFAULT 0,
  pending_balance DECIMAL(15,2) DEFAULT 0,
  withdrawn_amount DECIMAL(15,2) DEFAULT 0,
  available_balance DECIMAL(15,2) DEFAULT 0,
  last_withdrawal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_commission_balances_ib ON commission_balances(ib_id);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS commission_audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  performed_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_commission_audit_log_entity ON commission_audit_log(entity_type, entity_id);
CREATE INDEX idx_commission_audit_log_created ON commission_audit_log(created_at);
