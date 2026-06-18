/**
 * Type Definitions Index
 * Re-exports all types for convenient imports
 */

// Auth Types
export type {
  User,
  Token,
  AuthState,
  LoginCredentials,
  AuthActions,
  AuthStore,
} from "./auth";

// Customer Types (includes legacy TradingAccount for backward compatibility)
export type {
  VerificationStatus,
  AccountType,
  AccountFilterType,
  Passport,
  PersonalDetails,
  ToContact,
  ContactDetails,
  AccountManager,
  CrmUserScope,
  AccountConfiguration,
  AddressDetails,
  BankingDetails,
  LeadDetails,
  TradingAccountLegacy,
  TradingAccount,
  Customer,
  PagedResponse,
  GetCustomersParams,
  CustomerState,
  CustomerActions,
  CustomerStore,
} from "./customer";

// Full Trading Account Types (Match-Trade API v1.25)
// Use TradingAccountFull for complete API schema with nested objects
export type {
  TradingAccountAccess,
  TradingAccountType,
  TradingAccountInfo,
  TradingAccountFinanceInfo,
  TradingAccount as TradingAccountFull,
  TradingAccountSimple,
  GetTradingAccountsParams,
  TradingAccountsPagedResponse,
  CreateTradingAccountRequest,
  CreateTradingAccountResponse,
  UpdateTradingAccountRequest,
  ChangeLeverageRequest,
  BulkDeleteTradingAccountsRequest,
  BulkDeleteTradingAccountsResponse,
  TradingAccountDisplay,
  TradingAccountsSummary,
} from "./trading-account";

// Trading Account Helper Functions (work with TradingAccountFull)
export {
  hasFullAccess,
  isLiveAccount,
  isDemoAccount,
  toSimpleTradingAccount,
  calculateTradingAccountsSummary,
} from "./trading-account";

// Supabase Types
export type {
  Database,
  Customer as SupabaseCustomer,
  CustomerWithTradingAccounts,
  TradingAccount as SupabaseTradingAccount,
  CustomerTier,
  KycStatus,
  CustomerStatus,
  Json,
} from "./supabase";

// Column Configuration for CustomerList
export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

// Payment Types (gRPC stream simulation)
export type {
  PaymentAccountInfo,
  PaymentStatus,
  DepositEvent,
  WithdrawalEvent,
  PaymentEvent,
  PaymentStats,
  PaymentFilterStatus,
  PaymentFilters,
  PaymentState,
  PaymentActions,
  PaymentStore,
  DepositsApiResponse,
  WithdrawalsApiResponse,
  PaymentActionRequest,
  PaymentActionResponse,
} from "./payment";
