/**
 * Payment Store
 * Zustand store for managing deposit and withdrawal data
 * Simulates gRPC stream events for real-time updates
 * Created: 2025-12-29
 */

import { create } from "zustand";
import type {
  DepositEvent,
  WithdrawalEvent,
  PaymentEvent,
  PaymentStats,
  PaymentFilters,
  PaymentStore,
  PaymentStatus,
} from "@/types/payment";
import {
  generateDeposit,
  generateWithdrawal,
  calculateStats,
} from "@/lib/mockPaymentData";

// ============================================================================
// API Configuration
// ============================================================================

const BASE_PATH = "/ai-crm";

// ============================================================================
// Initial State
// ============================================================================

const initialFilters: PaymentFilters = {
  status: "ALL",
  search: "",
};

const initialStats: PaymentStats = {
  totalAmount: 0,
  totalCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  pendingAmount: 0,
  approvedAmount: 0,
  rejectedAmount: 0,
};

const initialState = {
  deposits: [] as DepositEvent[],
  withdrawals: [] as WithdrawalEvent[],
  recentActivity: [] as PaymentEvent[],
  depositStats: { ...initialStats },
  withdrawalStats: { ...initialStats },
  isStreaming: false,
  isLoading: false,
  error: null as string | null,
  filters: { ...initialFilters },
};

// ============================================================================
// Store Implementation
// ============================================================================

let streamInterval: NodeJS.Timeout | null = null;

export const usePaymentStore = create<PaymentStore>()((set, get) => ({
  ...initialState,

  // ==========================================================================
  // Stream Control
  // ==========================================================================

  startStream: () => {
    if (get().isStreaming) return;

    set({ isStreaming: true });

    // Simulate real-time events every 2-5 seconds
    streamInterval = setInterval(() => {
      const rand = Math.random();

      if (rand > 0.3) {
        // 70% chance of new event
        if (rand > 0.5) {
          // New deposit
          const deposit = generateDeposit(0);
          get().addDeposit(deposit);
        } else {
          // New withdrawal
          const withdrawal = generateWithdrawal(0);
          get().addWithdrawal(withdrawal);
        }
      }
    }, 2000 + Math.random() * 3000);
  },

  stopStream: () => {
    if (streamInterval) {
      clearInterval(streamInterval);
      streamInterval = null;
    }
    set({ isStreaming: false });
  },

  // ==========================================================================
  // Data Actions
  // ==========================================================================

  addDeposit: (deposit: DepositEvent) => {
    set((state) => {
      const newDeposits = [deposit, ...state.deposits].slice(0, 100); // Keep last 100
      const newActivity: PaymentEvent = {
        uuid: deposit.uuid,
        type: "DEPOSIT",
        timestamp: deposit.timestamp,
        accountInfo: deposit.accountInfo,
        status: deposit.status,
        amount: deposit.amount,
        currency: deposit.currency,
      };

      return {
        deposits: newDeposits,
        depositStats: calculateStats(newDeposits),
        recentActivity: [newActivity, ...state.recentActivity].slice(0, 50),
      };
    });
  },

  addWithdrawal: (withdrawal: WithdrawalEvent) => {
    set((state) => {
      const newWithdrawals = [withdrawal, ...state.withdrawals].slice(0, 100);
      const newActivity: PaymentEvent = {
        uuid: withdrawal.uuid,
        type: "WITHDRAWAL",
        timestamp: withdrawal.timestamp,
        accountInfo: withdrawal.accountInfo,
        status: withdrawal.status,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
      };

      return {
        withdrawals: newWithdrawals,
        withdrawalStats: calculateStats(newWithdrawals),
        recentActivity: [newActivity, ...state.recentActivity].slice(0, 50),
      };
    });
  },

  updateDepositStatus: (uuid: string, status: PaymentStatus) => {
    set((state) => {
      const newDeposits = state.deposits.map((d) =>
        d.uuid === uuid ? { ...d, status } : d
      );
      return {
        deposits: newDeposits,
        depositStats: calculateStats(newDeposits),
      };
    });
  },

  updateWithdrawalStatus: (uuid: string, status: PaymentStatus) => {
    set((state) => {
      const newWithdrawals = state.withdrawals.map((w) =>
        w.uuid === uuid ? { ...w, status } : w
      );
      return {
        withdrawals: newWithdrawals,
        withdrawalStats: calculateStats(newWithdrawals),
      };
    });
  },

  // ==========================================================================
  // Filter Actions
  // ==========================================================================

  setFilters: (filters: Partial<PaymentFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearFilters: () => {
    set({ filters: { ...initialFilters } });
  },

  // ==========================================================================
  // Fetch Actions
  // ==========================================================================

  fetchDeposits: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${BASE_PATH}/api/deposits`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      set({
        deposits: data.deposits,
        depositStats: data.stats,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch deposits";
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  fetchWithdrawals: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${BASE_PATH}/api/withdrawals`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      set({
        withdrawals: data.withdrawals,
        withdrawalStats: data.stats,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch withdrawals";
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  // ==========================================================================
  // Utility
  // ==========================================================================

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    if (streamInterval) {
      clearInterval(streamInterval);
      streamInterval = null;
    }
    set({ ...initialState });
  },
}));

// ============================================================================
// Selector Hooks
// ============================================================================

export function useDeposits(): DepositEvent[] {
  return usePaymentStore((state) => state.deposits);
}

export function useWithdrawals(): WithdrawalEvent[] {
  return usePaymentStore((state) => state.withdrawals);
}

export function useRecentActivity(): PaymentEvent[] {
  return usePaymentStore((state) => state.recentActivity);
}

export function useDepositStats(): PaymentStats {
  return usePaymentStore((state) => state.depositStats);
}

export function useWithdrawalStats(): PaymentStats {
  return usePaymentStore((state) => state.withdrawalStats);
}

export function usePaymentFilters(): PaymentFilters {
  return usePaymentStore((state) => state.filters);
}

export function useIsStreaming(): boolean {
  return usePaymentStore((state) => state.isStreaming);
}

export function usePaymentLoading(): boolean {
  return usePaymentStore((state) => state.isLoading);
}

// ============================================================================
// Filtered Selectors
// ============================================================================

export function useFilteredDeposits(): DepositEvent[] {
  return usePaymentStore((state) => {
    const { deposits, filters } = state;

    return deposits.filter((deposit) => {
      // Status filter
      if (filters.status !== "ALL" && deposit.status !== filters.status) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = deposit.accountInfo?.name || "";
        const surname = deposit.accountInfo?.surname || "";
        const email = deposit.accountInfo?.email || "";
        const uuid = deposit.uuid || "";

        const matchesSearch =
          name.toLowerCase().includes(searchLower) ||
          surname.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower) ||
          uuid.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      return true;
    });
  });
}

export function useFilteredWithdrawals(): WithdrawalEvent[] {
  return usePaymentStore((state) => {
    const { withdrawals, filters } = state;

    return withdrawals.filter((withdrawal) => {
      if (filters.status !== "ALL" && withdrawal.status !== filters.status) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = withdrawal.accountInfo?.name || "";
        const surname = withdrawal.accountInfo?.surname || "";
        const email = withdrawal.accountInfo?.email || "";
        const uuid = withdrawal.uuid || "";

        const matchesSearch =
          name.toLowerCase().includes(searchLower) ||
          surname.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower) ||
          uuid.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      return true;
    });
  });
}

export default usePaymentStore;
