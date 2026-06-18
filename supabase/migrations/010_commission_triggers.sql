-- Function to update path on parent change
CREATE OR REPLACE FUNCTION update_ib_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path = NEW.ib_id::text;
  ELSE
    SELECT path || '.' || NEW.ib_id::text
    INTO NEW.path
    FROM ib_hierarchy
    WHERE ib_id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_ib_path
BEFORE INSERT OR UPDATE OF parent_id ON ib_hierarchy
FOR EACH ROW
EXECUTE FUNCTION update_ib_path();

-- Function to update balance after distribution
CREATE OR REPLACE FUNCTION update_balance_on_distribution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' THEN
    INSERT INTO commission_balances (ib_id, total_earned, pending_balance, available_balance)
    VALUES (NEW.recipient_id, NEW.amount, 0, NEW.amount)
    ON CONFLICT (ib_id) DO UPDATE SET
      total_earned = commission_balances.total_earned + NEW.amount,
      available_balance = commission_balances.available_balance + NEW.amount,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balance_on_distribution
AFTER INSERT OR UPDATE OF status ON commission_distributions
FOR EACH ROW
EXECUTE FUNCTION update_balance_on_distribution();

-- Function to create balance record for new IB
CREATE OR REPLACE FUNCTION create_balance_for_new_ib()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO commission_balances (ib_id, total_earned, pending_balance, available_balance)
  VALUES (NEW.ib_id, 0, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_balance_for_new_ib
AFTER INSERT ON ib_hierarchy
FOR EACH ROW
EXECUTE FUNCTION create_balance_for_new_ib();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_ib_hierarchy_updated_at
BEFORE UPDATE ON ib_hierarchy
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_commission_rules_updated_at
BEFORE UPDATE ON commission_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_commission_transactions_updated_at
BEFORE UPDATE ON commission_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_commission_distributions_updated_at
BEFORE UPDATE ON commission_distributions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_commission_balances_updated_at
BEFORE UPDATE ON commission_balances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
