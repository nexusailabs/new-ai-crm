/**
 * Supabase Row Types
 * Shared types for accounts and trading_accounts tables
 *
 * Created: 2025-12-28
 * Mission: MISSION-20251228-L7WFOB
 */

// ============================================================================
// Accounts Table Row Type
// ============================================================================

/**
 * Supabase accounts table Row type
 * API routes에서 공통 사용
 */
export interface AccountRow {
  uuid: string;
  email: string;
  verification_status: string;
  personal_details: {
    firstname?: string;
    lastname?: string;
    language?: string;
    dateOfBirth?: string;
  } | null;
  contact_details: {
    phoneNumber?: string;
  } | null;
  address_details: {
    country?: string;
    city?: string;
    address?: string;
  } | null;
  lead_details: {
    status?: string;
  } | null;
  created: string;
  updated: string;
  synced_at: string;
}

// ============================================================================
// Trading Accounts Table Row Type
// ============================================================================

/**
 * Finance info JSONB structure
 */
export interface TradingAccountFinanceInfo {
  balance: number | null;
  equity: number | null;
  profit: number | null;
  netProfit: number | null;
  margin: number | null;
  freeMargin: number | null;
  marginLevel: number | null;
  credit: number | null;
  currency: string;
  currencyPrecision: number;
}

/**
 * Supabase trading_accounts table Row type
 */
export interface TradingAccountRow {
  id: string;
  uuid: string;
  login: string;
  account_uuid: string;
  offer_uuid: string | null;
  system_uuid: string | null;
  commission_uuid: string | null;
  group: string | null;
  leverage: number;
  access: 'FULL' | 'CLOSE_ONLY' | 'TRADING_DISABLED' | 'TRADING_AND_LOGIN_DISABLED';
  account_type: 'DEMO' | 'REAL';
  finance_info: TradingAccountFinanceInfo;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

// ============================================================================
// Helper Types for API Responses
// ============================================================================

/**
 * Trading account for customer display (simplified)
 */
export interface TradingAccountDisplay {
  uuid: string;
  login: string;
  balance: number;
  equity: number;
  currency: string;
  type: 'DEMO' | 'REAL';
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSE_ONLY' | 'DISABLED';
  created: string;
}

/**
 * Map TradingAccountRow to display format
 */
export function mapTradingAccountToDisplay(row: TradingAccountRow): TradingAccountDisplay {
  const statusMap: Record<string, TradingAccountDisplay['status']> = {
    'FULL': 'ACTIVE',
    'CLOSE_ONLY': 'CLOSE_ONLY',
    'TRADING_DISABLED': 'INACTIVE',
    'TRADING_AND_LOGIN_DISABLED': 'DISABLED',
  };

  return {
    uuid: row.uuid,
    login: row.login,
    balance: row.finance_info?.balance ?? 0,
    equity: row.finance_info?.equity ?? 0,
    currency: row.finance_info?.currency ?? 'USD',
    type: row.account_type,
    status: statusMap[row.access] || 'INACTIVE',
    created: row.created_at,
  };
}
