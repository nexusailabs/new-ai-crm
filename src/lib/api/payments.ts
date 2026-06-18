/**
 * Match-Trade Payments API Client
 * Functions for fetching deposits and withdrawals from Match-Trade Broker API
 * Created: 2025-12-29
 */

// ============================================================================
// Match-Trade API Response Types (from API docs)
// ============================================================================

export interface MatchTradePersonalDetails {
  firstname: string;
  lastname: string;
}

export interface MatchTradeAccountManager {
  uuid: string;
  email: string;
  name: string;
}

export interface MatchTradeTradingAccount {
  uuid: string;
  login: string;
  offerUuid: string;
}

export interface MatchTradeLeadDetails {
  statusUuid: string;
  source: string;
  providerUuid: string;
  becomeActiveClientTime: string;
}

export interface MatchTradeAccountInfo {
  accountUuid: string;
  email: string;
  personalDetails: MatchTradePersonalDetails;
  accountManager: MatchTradeAccountManager | null;
  tradingAccount: MatchTradeTradingAccount | null;
  leadDetails: MatchTradeLeadDetails | null;
}

export interface MatchTradeFinancialDetails {
  status: string;
  amount: number | null;
  netAmount: number | null;
  currency: string;
}

export interface MatchTradePaymentGatewayDetails {
  uuid: string;
  name: string;
}

export interface MatchTradeAdditionalInfo {
  walletAddress: string;
  reference: string;
  paymentId: string;
}

export interface MatchTradePaymentRequestInfo {
  financialDetails: MatchTradeFinancialDetails;
  paymentGatewayDetails: MatchTradePaymentGatewayDetails;
  additionalInfo: MatchTradeAdditionalInfo;
}

export interface MatchTradePaymentRecord {
  uuid: string;
  partnerId: number | null;
  created: string;
  accountInfo: MatchTradeAccountInfo;
  paymentRequestInfo: MatchTradePaymentRequestInfo;
}

export interface MatchTradePaymentsResponse {
  content: MatchTradePaymentRecord[];
  totalPages: number | null;
  totalElements: number | null;
  number: number | null;
  size: number | null;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface GetPaymentsParams {
  query?: string;
  page?: number;
  size?: number;
  sort?: string;
  from?: string;
  to?: string;
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map Match-Trade payment status to simplified status for UI
 *
 * Success/Final Statuses: DONE, FULLY_PAID, PARTIALLY_PAID, BOOKED -> APPROVED
 * Pending/In Progress: NEW, PROCESSING, PROCESSING_PAYMENT, AWAITING_CONFIRMATION, ADMIN_CONFIRMATION -> PENDING
 * Failure/Cancellation: FAILED, FAILED_PAYMENT, REJECTED, CANCELLED_BY_USER, REFUNDED -> REJECTED
 */
export function mapPaymentStatus(status: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
  const upperStatus = status.toUpperCase();

  // Success statuses
  if (['DONE', 'FULLY_PAID', 'PARTIALLY_PAID', 'BOOKED'].includes(upperStatus)) {
    return 'APPROVED';
  }

  // Pending statuses
  if (['NEW', 'PROCESSING', 'PROCESSING_PAYMENT', 'AWAITING_CONFIRMATION', 'ADMIN_CONFIRMATION'].includes(upperStatus)) {
    return 'PENDING';
  }

  // Failure statuses
  if (['FAILED', 'FAILED_PAYMENT', 'REJECTED', 'CANCELLED_BY_USER', 'REFUNDED'].includes(upperStatus)) {
    return 'REJECTED';
  }

  // Default to pending for unknown statuses
  return 'PENDING';
}

// ============================================================================
// API Functions (Server-Side Only)
// ============================================================================

const MATCH_TRADE_BASE_URL = process.env.MATCH_TRADE_BASE_URL || 'https://broker-api-gudax.match-trade.com';
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || '';

/**
 * Fetch deposits from Match-Trade API
 * @param params - Query parameters
 * @returns Match-Trade deposits response
 */
export async function fetchDepositsFromMatchTrade(
  params: GetPaymentsParams = {}
): Promise<MatchTradePaymentsResponse> {
  const defaultParams: GetPaymentsParams = {
    page: 0,
    size: 50,
    sort: 'created,desc',
    ...params,
  };

  const searchParams = new URLSearchParams();
  if (defaultParams.query) searchParams.append('query', defaultParams.query);
  if (defaultParams.page !== undefined) searchParams.append('page', String(defaultParams.page));
  if (defaultParams.size !== undefined) searchParams.append('size', String(defaultParams.size));
  if (defaultParams.sort) searchParams.append('sort', defaultParams.sort);
  if (defaultParams.from) searchParams.append('from', defaultParams.from);
  if (defaultParams.to) searchParams.append('to', defaultParams.to);

  const queryString = searchParams.toString();
  const url = `${MATCH_TRADE_BASE_URL}/v1/deposits${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': MATCH_TRADE_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Match-Trade API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch ALL deposits from Match-Trade API (handles pagination)
 * Fetches all pages in parallel for maximum performance
 * @param params - Query parameters (page will be overridden)
 * @param maxPages - Maximum pages to fetch (safety limit, default 50)
 * @returns All deposit records combined
 */
export async function fetchAllDepositsFromMatchTrade(
  params: Omit<GetPaymentsParams, 'page'> = {},
  maxPages: number = 50
): Promise<MatchTradePaymentsResponse> {
  const pageSize = params.size || 1000; // Use larger page size for efficiency

  // Fetch first page to get total count
  const firstPage = await fetchDepositsFromMatchTrade({
    ...params,
    page: 0,
    size: pageSize,
  });

  const totalPages = firstPage.totalPages || 1;
  const totalElements = firstPage.totalElements || firstPage.content.length;

  console.log(`[Match-Trade API] Deposits Total: ${totalElements} records across ${totalPages} pages`);

  // If only one page, return immediately
  if (totalPages <= 1) {
    return firstPage;
  }

  // Fetch remaining pages in parallel (with safety limit)
  const pagesToFetch = Math.min(totalPages, maxPages);
  const pagePromises: Promise<MatchTradePaymentsResponse>[] = [];

  for (let page = 1; page < pagesToFetch; page++) {
    pagePromises.push(
      fetchDepositsFromMatchTrade({
        ...params,
        page,
        size: pageSize,
      })
    );
  }

  const remainingPages = await Promise.all(pagePromises);

  // Combine all records
  const allContent = [
    ...firstPage.content,
    ...remainingPages.flatMap(page => page.content),
  ];

  console.log(`[Match-Trade API] Deposits Fetched ${allContent.length} total records`);

  return {
    content: allContent,
    totalPages,
    totalElements,
    number: 0,
    size: allContent.length,
  };
}

/**
 * Fetch withdrawals from Match-Trade API (single page)
 * @param params - Query parameters
 * @returns Match-Trade withdrawals response
 */
export async function fetchWithdrawalsFromMatchTrade(
  params: GetPaymentsParams = {}
): Promise<MatchTradePaymentsResponse> {
  const defaultParams: GetPaymentsParams = {
    page: 0,
    size: 50,
    sort: 'created,desc',
    ...params,
  };

  const searchParams = new URLSearchParams();
  if (defaultParams.query) searchParams.append('query', defaultParams.query);
  if (defaultParams.page !== undefined) searchParams.append('page', String(defaultParams.page));
  if (defaultParams.size !== undefined) searchParams.append('size', String(defaultParams.size));
  if (defaultParams.sort) searchParams.append('sort', defaultParams.sort);
  if (defaultParams.from) searchParams.append('from', defaultParams.from);
  if (defaultParams.to) searchParams.append('to', defaultParams.to);

  const queryString = searchParams.toString();
  const url = `${MATCH_TRADE_BASE_URL}/v1/withdrawals${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': MATCH_TRADE_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Match-Trade API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch ALL withdrawals from Match-Trade API (handles pagination)
 * Fetches all pages in parallel for maximum performance
 * @param params - Query parameters (page will be overridden)
 * @param maxPages - Maximum pages to fetch (safety limit, default 50)
 * @returns All withdrawal records combined
 */
export async function fetchAllWithdrawalsFromMatchTrade(
  params: Omit<GetPaymentsParams, 'page'> = {},
  maxPages: number = 50
): Promise<MatchTradePaymentsResponse> {
  const pageSize = params.size || 1000; // Use larger page size for efficiency

  // Fetch first page to get total count
  const firstPage = await fetchWithdrawalsFromMatchTrade({
    ...params,
    page: 0,
    size: pageSize,
  });

  const totalPages = firstPage.totalPages || 1;
  const totalElements = firstPage.totalElements || firstPage.content.length;

  console.log(`[Match-Trade API] Total: ${totalElements} records across ${totalPages} pages`);

  // If only one page, return immediately
  if (totalPages <= 1) {
    return firstPage;
  }

  // Fetch remaining pages in parallel (with safety limit)
  const pagesToFetch = Math.min(totalPages, maxPages);
  const pagePromises: Promise<MatchTradePaymentsResponse>[] = [];

  for (let page = 1; page < pagesToFetch; page++) {
    pagePromises.push(
      fetchWithdrawalsFromMatchTrade({
        ...params,
        page,
        size: pageSize,
      })
    );
  }

  const remainingPages = await Promise.all(pagePromises);

  // Combine all records
  const allContent = [
    ...firstPage.content,
    ...remainingPages.flatMap(page => page.content),
  ];

  console.log(`[Match-Trade API] Fetched ${allContent.length} total records`);

  return {
    content: allContent,
    totalPages,
    totalElements,
    number: 0,
    size: allContent.length,
  };
}
