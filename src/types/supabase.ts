/**
 * Supabase Database Types for AI CRM
 * Actual Database Schema
 * Updated: 2025-12-28
 */

// ============================================================================
// JSON Type
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================================
// Enums (matching actual PostgreSQL values)
// ============================================================================

export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP' | 'STANDARD'

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLOCKED'

export type WithdrawalMappedStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type SyncStatus = 'idle' | 'syncing' | 'error'

// ============================================================================
// Actual Database Schema Types
// ============================================================================

/**
 * Customers table - actual DB schema
 */
export interface Customer {
  id: string  // UUID
  email: string
  tier: CustomerTier
  risk_score: number
  created_at: string
  full_name: string | null
  phone: string | null
  country: string | null
  city: string | null
  timezone: string | null
  preferred_language: string | null
  kyc_status: KycStatus
  kyc_level: number
  aml_risk_score: number | null
  segment_data: Json
  preferences: Json
  tags: string[]
  status: CustomerStatus
  last_activity_at: string | null
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type CustomerUpdate = Partial<CustomerInsert>

/**
 * Trading Accounts table - actual DB schema
 */
export interface TradingAccount {
  id: string  // UUID
  user_id: string  // FK to customers.id
  balance: number
  equity: number
  margin_level: number
  currency: string
  created_at: string
  updated_at: string
  platform: string | null
  platform_account_id: string | null
}

export type TradingAccountInsert = Omit<TradingAccount, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type TradingAccountUpdate = Partial<TradingAccountInsert>

/**
 * Withdrawals Cache table - stores cached withdrawal data from Match-Trade API
 */
export interface Withdrawal {
  id: string  // UUID (internal)
  uuid: string  // Match-Trade UUID
  account_uuid: string
  account_email: string | null
  account_name: string | null
  account_surname: string | null
  amount: number
  net_amount: number | null
  currency: string
  status: string  // Original Match-Trade status
  mapped_status: WithdrawalMappedStatus  // Simplified status
  payment_gateway_uuid: string | null
  payment_gateway_name: string | null
  wallet_address: string | null
  reference: string | null
  payment_id: string | null
  partner_id: number | null
  created_at: string
  updated_at: string
  synced_at: string
  raw_data: Json | null
}

export type WithdrawalInsert = Omit<Withdrawal, 'id' | 'updated_at'> & {
  id?: string
  updated_at?: string
}

export type WithdrawalUpdate = Partial<WithdrawalInsert>

/**
 * Sync Metadata table - tracks synchronization state for cached tables
 */
export interface SyncMetadata {
  id: string  // UUID
  table_name: string
  last_synced_at: string
  record_count: number
  sync_duration_ms: number
  sync_status: SyncStatus
  last_error: string | null
  created_at: string
  updated_at: string
}

export type SyncMetadataInsert = Omit<SyncMetadata, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type SyncMetadataUpdate = Partial<SyncMetadataInsert>

/**
 * Withdrawal Action Logs table - Audit trail for withdrawal actions
 * Created: MISSION-20251229-0737
 */
export type WithdrawalActionType = 'APPROVE' | 'REJECT' | 'PENDING_REVIEW' | 'ESCALATE' | 'COMMENT'

export interface WithdrawalActionLog {
  id: string  // UUID
  withdrawal_uuid: string
  withdrawal_id: string | null  // FK to withdrawals.id
  action: WithdrawalActionType
  previous_status: string
  new_status: string
  operator_id: string | null
  operator_email: string | null
  operator_role: string | null
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Json
  created_at: string
}

export type WithdrawalActionLogInsert = Omit<WithdrawalActionLog, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type WithdrawalActionLogUpdate = Partial<WithdrawalActionLogInsert>

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying'

/**
 * Webhook Configs table
 * Created: MISSION-20251229-0737 Phase 2
 */
export interface WebhookConfig {
  id: string  // UUID
  name: string
  url: string
  secret: string
  events: string[]
  is_active: boolean
  headers: Json
  retry_count: number
  timeout_ms: number
  created_at: string
  updated_at: string
}

export type WebhookConfigInsert = Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type WebhookConfigUpdate = Partial<WebhookConfigInsert>

/**
 * Webhook Deliveries table
 * Created: MISSION-20251229-0737 Phase 2
 */
export interface WebhookDelivery {
  id: string  // UUID
  webhook_config_id: string
  event_type: string
  payload: Json
  status: WebhookDeliveryStatus
  response_code: number | null
  response_body: string | null
  attempts: number
  next_retry_at: string | null
  latency_ms: number | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type WebhookDeliveryInsert = Omit<WebhookDelivery, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type WebhookDeliveryUpdate = Partial<WebhookDeliveryInsert>

// ============================================================================
// Database Schema Type (Supabase Client Generic)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer
        Insert: CustomerInsert
        Update: CustomerUpdate
      }
      trading_accounts: {
        Row: TradingAccount
        Insert: TradingAccountInsert
        Update: TradingAccountUpdate
      }
      withdrawals: {
        Row: Withdrawal
        Insert: WithdrawalInsert
        Update: WithdrawalUpdate
      }
      sync_metadata: {
        Row: SyncMetadata
        Insert: SyncMetadataInsert
        Update: SyncMetadataUpdate
      }
      withdrawal_action_logs: {
        Row: WithdrawalActionLog
        Insert: WithdrawalActionLogInsert
        Update: WithdrawalActionLogUpdate
      }
      webhook_configs: {
        Row: WebhookConfig
        Insert: WebhookConfigInsert
        Update: WebhookConfigUpdate
      }
      webhook_deliveries: {
        Row: WebhookDelivery
        Insert: WebhookDeliveryInsert
        Update: WebhookDeliveryUpdate
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      customer_tier: CustomerTier
      kyc_status: KycStatus
      customer_status: CustomerStatus
    }
  }
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CustomerWithTradingAccounts extends Customer {
  trading_accounts: TradingAccount[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}
