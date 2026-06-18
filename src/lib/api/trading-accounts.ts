/**
 * Trading Accounts API Endpoints
 * Functions for interacting with Match-Trade Trading Accounts API
 * Based on Match-Trade Broker API v1.25
 */

import { apiClient } from "./client";
import type {
  TradingAccountFull,
  TradingAccountsPagedResponse,
  GetTradingAccountsParams,
  CreateTradingAccountRequest,
  CreateTradingAccountResponse,
  UpdateTradingAccountRequest,
  ChangeLeverageRequest,
  BulkDeleteTradingAccountsRequest,
  BulkDeleteTradingAccountsResponse,
} from "@/types";

/**
 * Build query string from parameters
 */
function buildQueryString(params: GetTradingAccountsParams): string {
  const searchParams = new URLSearchParams();

  if (params.query) searchParams.append("query", params.query);
  if (params.page !== undefined) searchParams.append("page", String(params.page));
  if (params.size !== undefined) searchParams.append("size", String(params.size));
  if (params.sort) searchParams.append("sort", params.sort);
  if (params.from) searchParams.append("from", params.from);
  if (params.to) searchParams.append("to", params.to);

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Get paginated list of trading accounts
 * GET /v1/trading-accounts
 * @param params - Query parameters for filtering and pagination
 * @returns Promise with paged trading accounts response
 */
export async function getTradingAccounts(
  params: GetTradingAccountsParams = {}
): Promise<TradingAccountsPagedResponse> {
  const defaultParams: GetTradingAccountsParams = {
    page: 0,
    size: 10,
    sort: "created,desc",
    ...params,
  };

  const queryString = buildQueryString(defaultParams);
  const response = await apiClient.get<TradingAccountsPagedResponse>(
    `/api/trading-accounts${queryString}`
  );
  return response.data;
}

/**
 * Get trading account by login
 * GET /v1/trading-account?systemUuid=&login=
 * @param systemUuid - System UUID
 * @param login - Trading account login
 * @returns Promise with trading account data
 */
export async function getTradingAccountByLogin(
  systemUuid: string,
  login: string
): Promise<TradingAccountFull> {
  const response = await apiClient.get<TradingAccountFull>(
    `/api/trading-accounts/by-login?systemUuid=${encodeURIComponent(systemUuid)}&login=${encodeURIComponent(login)}`
  );
  return response.data;
}

/**
 * Get all trading accounts for a customer
 * GET /v1/trading-accounts?query={customerEmail}
 * @param customerEmail - Customer email to filter by
 * @returns Promise with all trading accounts for the customer
 */
export async function getTradingAccountsByCustomer(
  customerEmail: string
): Promise<TradingAccountFull[]> {
  const response = await getTradingAccounts({
    query: customerEmail,
    size: 100, // Max reasonable for single customer
  });
  return response.content;
}

/**
 * Create a new trading account
 * POST /v1/accounts/{accountUuid}/trading-accounts
 * @param accountUuid - Parent account (customer) UUID
 * @param data - Trading account creation data
 * @returns Promise with created trading account response
 */
export async function createTradingAccount(
  accountUuid: string,
  data: CreateTradingAccountRequest
): Promise<CreateTradingAccountResponse> {
  const response = await apiClient.post<CreateTradingAccountResponse>(
    `/api/accounts/${encodeURIComponent(accountUuid)}/trading-accounts`,
    data
  );
  return response.data;
}

/**
 * Update a trading account
 * PATCH /v1/trading-account?systemUuid=&login=
 * @param systemUuid - System UUID
 * @param login - Trading account login
 * @param data - Update data
 * @returns Promise<void>
 */
export async function updateTradingAccount(
  systemUuid: string,
  login: string,
  data: UpdateTradingAccountRequest
): Promise<void> {
  await apiClient.patch(
    `/api/trading-accounts/update?systemUuid=${encodeURIComponent(systemUuid)}&login=${encodeURIComponent(login)}`,
    data
  );
}

/**
 * Change leverage for a trading account
 * PUT /v1/trading-account/leverage?systemUuid=&login=
 * @param systemUuid - System UUID
 * @param login - Trading account login
 * @param data - Leverage change data
 * @returns Promise<void>
 */
export async function changeLeverage(
  systemUuid: string,
  login: string,
  data: ChangeLeverageRequest
): Promise<void> {
  await apiClient.put(
    `/api/trading-accounts/leverage?systemUuid=${encodeURIComponent(systemUuid)}&login=${encodeURIComponent(login)}`,
    data
  );
}

/**
 * Bulk delete trading accounts
 * POST /v1/trading-accounts/bulk-delete
 * @param data - Bulk delete request data
 * @returns Promise with error details for failed deletions
 */
export async function bulkDeleteTradingAccounts(
  data: BulkDeleteTradingAccountsRequest
): Promise<BulkDeleteTradingAccountsResponse> {
  const response = await apiClient.post<BulkDeleteTradingAccountsResponse>(
    `/api/trading-accounts/bulk-delete`,
    data
  );
  return response.data;
}

/**
 * API Endpoints object for organized access
 */
export const tradingAccountsApi = {
  getAll: getTradingAccounts,
  getByLogin: getTradingAccountByLogin,
  getByCustomer: getTradingAccountsByCustomer,
  create: createTradingAccount,
  update: updateTradingAccount,
  changeLeverage: changeLeverage,
  bulkDelete: bulkDeleteTradingAccounts,
} as const;

export default tradingAccountsApi;
