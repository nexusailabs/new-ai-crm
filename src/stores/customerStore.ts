/**
 * Customer Store
 * Zustand store for managing customer (account) data
 * Now uses server-side API routes to avoid browser Supabase access issues
 * Updated: 2025-12-28
 */

import { create } from "zustand";
import type { Customer, CustomerStore, GetCustomersParams, PagedResponse } from "@/types";

// ============================================================================
// API Configuration - basePath for production
// ============================================================================

const BASE_PATH = "/ai-crm";

// ============================================================================
// API Response Types
// ============================================================================

type CustomersApiResponse = PagedResponse<Customer> | { error: string };

// ============================================================================
// Store Implementation
// ============================================================================

const initialState = {
  customers: [] as Customer[],
  selectedCustomer: null as Customer | null,
  isLoading: false,
  error: null as string | null,
  pagination: {
    page: 0,
    size: 10,
    totalPages: 0,
    totalElements: null as number | null,
  },
};

export const useCustomerStore = create<CustomerStore>()((set) => ({
  ...initialState,

  fetchCustomers: async (params: GetCustomersParams = {}): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      const page = params.page ?? 0;
      const size = params.size ?? 10;

      // Build query params
      const queryParams = new URLSearchParams({
        page: String(page),
        size: String(size),
      });

      if (params.query) {
        queryParams.set("query", params.query);
      }

      // Fetch from server-side API route (solves Supabase 127.0.0.1 access issue)
      const response = await fetch(`${BASE_PATH}/api/customers?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: CustomersApiResponse = await response.json();

      if ("error" in data) {
        throw new Error(data.error);
      }

      set({
        customers: data.content,
        pagination: {
          page: data.number ?? page,
          size: data.size,
          totalPages: data.totalPages,
          totalElements: data.totalElements,
        },
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch customers";
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  fetchAllCustomers: async (): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      // Fetch all customers from server-side API route with large size
      // Updated: size=10000 to load all 3498+ customers at once
      const response = await fetch(`${BASE_PATH}/api/customers?size=10000`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: CustomersApiResponse = await response.json();

      if ("error" in data) {
        throw new Error(data.error);
      }

      set({
        customers: data.content,
        pagination: {
          page: 0,
          size: data.content.length,
          totalPages: 1,
          totalElements: data.totalElements,
        },
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch all customers";
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  fetchCustomerByUuid: async (uuid: string): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      // TASK-008: Fetch customer and trading accounts in parallel
      const [customerRes, tradingRes] = await Promise.all([
        fetch(`${BASE_PATH}/api/customers/${uuid}`),
        fetch(`${BASE_PATH}/api/trading-accounts?accountUuid=${uuid}`),
      ]);

      if (!customerRes.ok) {
        if (customerRes.status === 404) {
          set({ selectedCustomer: null, isLoading: false, error: "Customer not found" });
          return;
        }
        throw new Error(`API error: ${customerRes.status}`);
      }

      const customerData: Customer | { error: string } = await customerRes.json();
      const tradingData = tradingRes.ok
        ? await tradingRes.json()
        : { content: [] };

      if ("error" in customerData) {
        throw new Error(customerData.error);
      }

      // Merge trading accounts (API already returns them via TASK-003,
      // but this ensures we have the latest data from trading-accounts API)
      const customerWithTradingAccounts: Customer = {
        ...customerData,
        tradingAccounts:
          (customerData.tradingAccounts?.length ?? 0) > 0
            ? customerData.tradingAccounts
            : tradingData.content || [],
      };

      set({
        selectedCustomer: customerWithTradingAccounts,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch customer";
      set({
        error: errorMessage,
        selectedCustomer: null,
        isLoading: false,
      });
    }
  },

  setSelectedCustomer: (customer: Customer | null): void => {
    set({ selectedCustomer: customer });
  },

  clearError: (): void => {
    set({ error: null });
  },

  reset: (): void => {
    set(initialState);
  },
}));

/**
 * Hook to get customers list
 */
export function useCustomers(): Customer[] {
  return useCustomerStore((state) => state.customers);
}

/**
 * Hook to get selected customer
 */
export function useSelectedCustomer(): Customer | null {
  return useCustomerStore((state) => state.selectedCustomer);
}

/**
 * Hook to get loading state
 */
export function useCustomerLoading(): boolean {
  return useCustomerStore((state) => state.isLoading);
}

export default useCustomerStore;
