/**
 * Payment Types
 * Type definitions for deposit and withdrawal events
 * Based on Match-Trade gRPC stream structure
 * Created: 2025-12-29
 */

// ============================================================================
// Account Info (shared between deposit and withdrawal)
// ============================================================================

export interface PaymentAccountInfo {
  uuid: string;
  email: string;
  name: string;
  surname: string;
}

// ============================================================================
// Payment Status
// ============================================================================

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ============================================================================
// Deposit Event (GetDepositEventsStream)
// ============================================================================

export interface DepositEvent {
  uuid: string;
  timestamp: string;
  accountInfo: PaymentAccountInfo;
  status: PaymentStatus;
  amount: number;
  currency: string;
  // Extended fields for UI
  method?: string;
  transactionId?: string;
}

// ============================================================================
// Withdrawal Event (GetWithdrawalEventsStream)
// ============================================================================

export interface WithdrawalEvent {
  uuid: string;
  timestamp: string;
  accountInfo: PaymentAccountInfo;
  status: PaymentStatus;
  amount: number;
  currency: string;
  // Extended fields for UI
  method?: string;
  transactionId?: string;
  bankInfo?: {
    bankName: string;
    accountNumber: string;
  };
}

// ============================================================================
// Combined Payment Event (for unified feed)
// ============================================================================

export interface PaymentEvent {
  uuid: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  timestamp: string;
  accountInfo: PaymentAccountInfo;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

// ============================================================================
// Payment Statistics
// ============================================================================

export interface PaymentStats {
  totalAmount: number;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export type PaymentFilterStatus = PaymentStatus | 'ALL';

export interface PaymentFilters {
  status: PaymentFilterStatus;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

// ============================================================================
// Store Types
// ============================================================================

export interface PaymentState {
  deposits: DepositEvent[];
  withdrawals: WithdrawalEvent[];
  recentActivity: PaymentEvent[];
  depositStats: PaymentStats;
  withdrawalStats: PaymentStats;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  filters: PaymentFilters;
}

export interface PaymentActions {
  // Stream control
  startStream: () => void;
  stopStream: () => void;

  // Data actions
  addDeposit: (deposit: DepositEvent) => void;
  addWithdrawal: (withdrawal: WithdrawalEvent) => void;
  updateDepositStatus: (uuid: string, status: PaymentStatus) => void;
  updateWithdrawalStatus: (uuid: string, status: PaymentStatus) => void;

  // Filter actions
  setFilters: (filters: Partial<PaymentFilters>) => void;
  clearFilters: () => void;

  // Fetch actions (for API)
  fetchDeposits: () => Promise<void>;
  fetchWithdrawals: () => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

export type PaymentStore = PaymentState & PaymentActions;

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiMetadata {
  totalRecords?: number;
  fetchedAt?: string;
  source?: 'hybrid' | 'cache-only' | 'api-only';
  duration?: number;
  apiAvailable?: boolean;
  warning?: string;
}

export interface DepositsApiResponse {
  deposits: DepositEvent[];
  stats: PaymentStats;
  metadata?: ApiMetadata;
  error?: string;
}

export interface WithdrawalsApiResponse {
  withdrawals: WithdrawalEvent[];
  stats: PaymentStats;
  metadata?: ApiMetadata;
  error?: string;
}

// ============================================================================
// Action Request Types (for approve/reject)
// ============================================================================

export interface PaymentActionRequest {
  uuid: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface PaymentActionResponse {
  success: boolean;
  uuid: string;
  newStatus: PaymentStatus;
  message?: string;
}
