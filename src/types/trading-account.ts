/**
 * Trading Account Types for Match-Trade API
 * Based on Match-Trade Broker API v1.25
 * Section: 07-trading-accounts
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Trading account access levels
 */
export type TradingAccountAccess =
  | "FULL"
  | "CLOSE_ONLY"
  | "TRADING_DISABLED"
  | "TRADING_AND_LOGIN_DISABLED";

/**
 * Trading account type (DEMO or REAL)
 */
export type TradingAccountType = "DEMO" | "REAL";

// ============================================================================
// NESTED TYPES
// ============================================================================

/**
 * Basic account info (owner reference)
 */
export interface TradingAccountInfo {
  uuid: string;
  email: string;
}

/**
 * Financial information for a trading account
 * All values can be null when account is not active
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

// ============================================================================
// MAIN TRADING ACCOUNT TYPE
// ============================================================================

/**
 * Full Trading Account as returned by Match-Trade API
 * GET /v1/trading-accounts
 * GET /v1/trading-account?systemUuid=&login=
 */
export interface TradingAccount {
  /** Trading Account UUID */
  uuid: string;
  /** Trading Account login (numeric string) */
  login: string;
  /** Creation timestamp (ISO 8601) */
  created: string;
  /** Reference to parent account (customer) */
  accountInfo: TradingAccountInfo;
  /** Offer UUID linked to this trading account */
  offerUuid: string;
  /** System UUID (trading platform identifier) */
  systemUuid: string;
  /** Commission structure UUID (nullable) */
  commissionUuid: string | null;
  /** Trading group name (e.g., "testUSD", "realUSD") */
  group: string;
  /** Leverage multiplier (e.g., 30, 100, 500) */
  leverage: number;
  /** Access level for the account */
  access: TradingAccountAccess;
  /** Account type (DEMO or REAL) */
  accountType: TradingAccountType;
  /** Financial details */
  financeInfo: TradingAccountFinanceInfo;
}

/**
 * Simplified Trading Account for display purposes
 * Used in CustomerDetail views where full API data isn't loaded
 */
export interface TradingAccountSimple {
  uuid: string;
  login: string;
  balance: number;
  equity: number;
  currency: string;
  type: string;
  status: string;
  created: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Parameters for GET /v1/trading-accounts
 */
export interface GetTradingAccountsParams {
  /** Filter by login, email, name, surname, or manager name */
  query?: string;
  /** Page number (0-indexed) */
  page?: number;
  /** Page size (max 1000) */
  size?: number;
  /** Sort order (default: "created,desc") */
  sort?: string;
  /** Filter from date (ISO 8601) */
  from?: string;
  /** Filter to date (ISO 8601) */
  to?: string;
}

/**
 * Paginated response for trading accounts
 */
export interface TradingAccountsPagedResponse {
  content: TradingAccount[];
  totalPages: number;
  totalElements: number;
  number: number | null;
  size: number;
}

/**
 * Request body for POST /v1/accounts/{accountUuid}/trading-accounts
 */
export interface CreateTradingAccountRequest {
  /** Required: Offer UUID for the new trading account */
  offerUuid: string;
  /** Optional: Commission structure UUID */
  commissionUuid?: string;
}

/**
 * Response for POST /v1/accounts/{accountUuid}/trading-accounts
 */
export interface CreateTradingAccountResponse {
  uuid: string;
  created: string;
  updated: string;
  login: string;
  offerUuid: string;
  status: string;
  commissionUuid: string | null;
}

/**
 * Request body for PATCH /v1/trading-account
 */
export interface UpdateTradingAccountRequest {
  /** Offer UUID to change */
  offerUuid?: string;
  /** Commission structure UUID to change */
  commissionUuid?: string;
  /** Access level to set */
  access?: TradingAccountAccess;
  /** Leverage to set */
  leverage?: number;
}

/**
 * Request body for PUT /v1/trading-account/leverage
 */
export interface ChangeLeverageRequest {
  leverage: number;
}

/**
 * Request body for POST /v1/trading-accounts/bulk-delete
 */
export interface BulkDeleteTradingAccountsRequest {
  systemUuid: string;
  logins: string[];
}

/**
 * Response for POST /v1/trading-accounts/bulk-delete
 */
export interface BulkDeleteTradingAccountsResponse {
  errorDetails: string[];
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Trading account with computed display fields
 */
export interface TradingAccountDisplay extends TradingAccount {
  /** Computed: Display-friendly type (LIVE/DEMO) */
  displayType: "LIVE" | "DEMO";
  /** Computed: Is account active (has trading access) */
  isActive: boolean;
  /** Computed: Formatted balance string */
  formattedBalance: string;
  /** Computed: Formatted equity string */
  formattedEquity: string;
}

/**
 * Summary statistics for trading accounts
 */
export interface TradingAccountsSummary {
  totalAccounts: number;
  liveAccounts: number;
  demoAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  totalEquity: number;
  totalProfit: number;
  primaryCurrency: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if account has full trading access
 */
export function hasFullAccess(account: TradingAccount): boolean {
  return account.access === "FULL";
}

/**
 * Check if account is a live/real account
 */
export function isLiveAccount(account: TradingAccount): boolean {
  return account.accountType === "REAL";
}

/**
 * Check if account is a demo account
 */
export function isDemoAccount(account: TradingAccount): boolean {
  return account.accountType === "DEMO";
}

/**
 * Convert full TradingAccount to simplified version for display
 */
export function toSimpleTradingAccount(account: TradingAccount): TradingAccountSimple {
  const accessToStatus: Record<TradingAccountAccess, string> = {
    FULL: "ACTIVE",
    CLOSE_ONLY: "CLOSE_ONLY",
    TRADING_DISABLED: "INACTIVE",
    TRADING_AND_LOGIN_DISABLED: "DISABLED",
  };

  return {
    uuid: account.uuid,
    login: account.login,
    balance: account.financeInfo.balance ?? 0,
    equity: account.financeInfo.equity ?? 0,
    currency: account.financeInfo.currency,
    type: account.accountType,
    status: accessToStatus[account.access],
    created: account.created,
  };
}

/**
 * Calculate summary statistics for a list of trading accounts
 */
export function calculateTradingAccountsSummary(
  accounts: TradingAccount[]
): TradingAccountsSummary {
  const liveAccounts = accounts.filter(isLiveAccount);
  const demoAccounts = accounts.filter(isDemoAccount);
  const activeAccounts = accounts.filter(hasFullAccess);

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + (acc.financeInfo.balance ?? 0),
    0
  );
  const totalEquity = accounts.reduce(
    (sum, acc) => sum + (acc.financeInfo.equity ?? 0),
    0
  );
  const totalProfit = accounts.reduce(
    (sum, acc) => sum + (acc.financeInfo.profit ?? 0),
    0
  );

  // Find most common currency
  const currencyCounts = accounts.reduce((counts, acc) => {
    const currency = acc.financeInfo.currency;
    counts[currency] = (counts[currency] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const primaryCurrency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  return {
    totalAccounts: accounts.length,
    liveAccounts: liveAccounts.length,
    demoAccounts: demoAccounts.length,
    activeAccounts: activeAccounts.length,
    totalBalance,
    totalEquity,
    totalProfit,
    primaryCurrency,
  };
}
