/**
 * Match-Trade API Endpoints
 * Functions for interacting with the Broker API
 */

import { apiClient } from "./client";
import type { Customer, PagedResponse, GetCustomersParams } from "@/types";

/**
 * Build query string from parameters
 */
function buildQueryString(params: GetCustomersParams): string {
  const searchParams = new URLSearchParams();

  if (params.query) searchParams.append("query", params.query);
  if (params.page !== undefined) searchParams.append("page", String(params.page));
  if (params.size !== undefined) searchParams.append("size", String(params.size));
  if (params.sort) searchParams.append("sort", params.sort);
  if (params.from) searchParams.append("from", params.from);
  if (params.to) searchParams.append("to", params.to);
  if (params.accountType) searchParams.append("accountType", params.accountType);

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Get paginated list of customers (accounts)
 * @param params - Query parameters for filtering and pagination
 * @returns Promise with paged customer response
 */
export async function getCustomers(
  params: GetCustomersParams = {}
): Promise<PagedResponse<Customer>> {
  const defaultParams: GetCustomersParams = {
    page: 0,
    size: 10,
    sort: "created,desc",
    accountType: "ALL",
    ...params,
  };

  const queryString = buildQueryString(defaultParams);
  // Use local proxy route to avoid CORS (server-side fetch to Match-Trade API)
  const response = await apiClient.get<PagedResponse<Customer>>(`/api/accounts${queryString}`);
  return response.data;
}

/**
 * Get customer (account) by UUID
 * @param uuid - Account UUID
 * @returns Promise with customer data
 */
export async function getCustomerByUuid(uuid: string): Promise<Customer> {
  // Use local proxy route to avoid CORS (server-side fetch to Match-Trade API)
  const response = await apiClient.get<Customer>(`/api/accounts/${uuid}`);
  return response.data;
}

/**
 * API Endpoints object for organized access
 */
/**
 * Get all customers without pagination (for virtual scroll)
 * Loads customers in batches to avoid server timeout
 * @returns Promise with all customer data
 */
export async function getAllCustomers(): Promise<PagedResponse<Customer>> {
  const BATCH_SIZE = 100; // Smaller batch to avoid Cloudflare timeout (100 = ~30s per batch)
  let allCustomers: Customer[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages) {
    try {
      const response = await getCustomers({ size: BATCH_SIZE, page });
      allCustomers = [...allCustomers, ...response.content];
      totalPages = response.totalPages;
      totalElements = response.totalElements ?? allCustomers.length;
      page++;
    } catch (error) {
      console.error(`Failed to fetch page ${page}:`, error);
      // Continue with what we have
      break;
    }
  }

  return {
    content: allCustomers,
    totalPages: 1,
    totalElements,
    number: 0,
    size: allCustomers.length,
  };
}

// Re-export trading accounts API
export { tradingAccountsApi } from "./trading-accounts";

export const api = {
  customers: {
    getAll: getCustomers,
    getAllUnpaginated: getAllCustomers,
    getByUuid: getCustomerByUuid,
  },
} as const;

export default api;
