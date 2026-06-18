/**
 * API Route: /api/accounts
 * Backend Proxy for Match-Trade API to avoid CORS errors
 * Mirrors the pattern from sep-crm-v2
 *
 * Updated: 2025-12-28
 * Mission: MISSION-20251228-143658-FIX2
 */

import { NextRequest, NextResponse } from "next/server";
import type { Customer, PagedResponse, AccountFilterType, TradingAccount } from "@/types";

// ============================================================================
// Environment Configuration with Validation
// ============================================================================

const MATCH_TRADE_BASE_URL =
  process.env.MATCH_TRADE_BASE_URL || "https://broker-api-gudax.match-trade.com";
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || "";
const MATCH_TRADE_BROKER_ID = process.env.MATCH_TRADE_BROKER_ID || "159";
const MATCH_TRADE_PARTNER_ID = process.env.MATCH_TRADE_PARTNER_ID || "159";

/**
 * Check if Match-Trade API is properly configured
 */
function isMatchTradeConfigured(): boolean {
  return !!(
    MATCH_TRADE_BASE_URL &&
    MATCH_TRADE_API_KEY &&
    MATCH_TRADE_API_KEY.length > 0
  );
}

interface MatchTradeAccount {
  uuid?: string;
  email?: string;
  created?: string;
  updated?: string;
  verificationStatus?: string;
  type?: string;
  personalDetails?: {
    firstname?: string;
    lastname?: string;
    dateOfBirth?: string;
    citizenship?: string;
    language?: string;
    maritalStatus?: string;
    passport?: {
      number?: string;
      country?: string;
    };
    taxIdentificationNumber?: string;
  };
  contactDetails?: {
    phoneNumber?: string;
    alternativePhoneNumber?: string;
    faxNumber?: string;
    toContact?: {
      toContactDate: string | null;
      alreadyContacted: boolean;
    };
  };
  accountConfiguration?: {
    partnerId?: string | null;
    branchUuid?: string;
    roleUuid?: string;
    accountManager?: {
      uuid: string;
      email: string;
      name: string | null;
    };
    ibParentTradingAccountUuid?: string;
    crmUserScope?: {
      branchScope: string[];
      managerPools: string[];
    };
    accountTypeContact?: boolean;
  };
  addressDetails?: {
    country?: string;
    state?: string;
    city?: string;
    postCode?: string;
    address?: string;
  };
  bankingDetails?: {
    bankAddress?: string;
    bankSwiftCode?: string;
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
  };
  leadDetails?: {
    statusUuid?: string;
    source?: string;
    providerUuid?: string | null;
    becomeActiveClientTime?: string;
  };
}

interface MatchTradePagedResponse {
  content?: MatchTradeAccount[];
  accounts?: MatchTradeAccount[];
  data?: MatchTradeAccount[];
  items?: MatchTradeAccount[];
  totalPages?: number;
  totalElements?: number;
  number?: number;
  size?: number;
}

interface MatchTradeTradingAccount {
  uuid?: string;
  login?: string;
  created?: string;
  accountInfo?: {
    uuid?: string;
    email?: string;
  };
  offerUuid?: string;
  systemUuid?: string;
  group?: string;
  leverage?: number;
  access?: string;
  accountType?: string; // "DEMO" | "REAL"
  financeInfo?: {
    balance?: number | null;
    equity?: number | null;
    profit?: number | null;
    margin?: number | null;
    freeMargin?: number | null;
    currency?: string;
    currencyPrecision?: number;
  };
}

interface MatchTradeTradingAccountsResponse {
  content?: MatchTradeTradingAccount[];
  totalPages?: number;
  totalElements?: number;
  number?: number;
  size?: number;
}

/**
 * Fetch trading accounts by customer email using the correct endpoint
 * Uses GET /v1/trading-accounts?query={email} to filter by customer email
 * Implements exponential backoff retry logic for resilience
 *
 * FIXED: Previous implementation used /v1/accounts/{uuid}/trading-accounts
 * which is a POST-only endpoint for creating accounts (caused 405 errors)
 */
async function fetchTradingAccountsByEmail(
  email: string,
  accountUuid: string,
  maxRetries: number = 3
): Promise<TradingAccount[]> {
  let lastError: Error | null = null;
  let lastStatusCode: number | null = null;
  const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s exponential backoff

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Apply exponential backoff delay before retry (skip first attempt)
      if (attempt > 0) {
        const delay = retryDelays[attempt - 1] || retryDelays[retryDelays.length - 1];
        console.log(
          `[TradingAccounts] Retry ${attempt}/${maxRetries} for email ${email} after ${delay}ms delay`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      // Use correct endpoint: GET /v1/trading-accounts?query={email}
      const queryParams = new URLSearchParams({
        query: email,
        size: "100", // Get up to 100 trading accounts per customer
      });

      const response = await fetch(
        `${MATCH_TRADE_BASE_URL}/v1/trading-accounts?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${MATCH_TRADE_API_KEY}`,
            "X-Broker-Id": MATCH_TRADE_BROKER_ID,
            "X-Partner-Id": MATCH_TRADE_PARTNER_ID,
          },
          cache: "no-store",
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        lastStatusCode = response.status;

        // Detailed logging for server errors
        if (response.status === 502) {
          const errorBody = await response.text().catch(() => "Unable to read error body");
          console.error(
            `[TradingAccounts] 502 Bad Gateway for email ${email}:`,
            {
              attempt: attempt + 1,
              maxRetries,
              errorBody: errorBody.substring(0, 500),
              timestamp: new Date().toISOString(),
            }
          );
        } else if (response.status >= 500) {
          console.error(
            `[TradingAccounts] Server error ${response.status} for email ${email} (attempt ${attempt + 1}/${maxRetries})`
          );
        }

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          console.warn(`[TradingAccounts] Client error ${response.status} for email ${email} - not retrying`);
          return [];
        }

        throw new Error(`HTTP ${response.status}`);
      }

      const data: MatchTradeTradingAccountsResponse = await response.json();
      const tradingAccounts = data.content || [];

      // Filter by accountInfo.uuid to ensure we only get accounts for this customer
      const filteredAccounts = tradingAccounts.filter(
        (ta) => ta.accountInfo?.uuid === accountUuid || ta.accountInfo?.email === email
      );

      // Log success after retries
      if (attempt > 0) {
        console.log(`[TradingAccounts] Successfully fetched after ${attempt} retries for email ${email}`);
      }

      // Transform Match-Trade format to internal format
      return filteredAccounts.map((ta) => ({
        uuid: ta.uuid || "",
        login: ta.login || "",
        balance: ta.financeInfo?.balance ?? 0,
        equity: ta.financeInfo?.equity ?? 0,
        currency: ta.financeInfo?.currency || "USD",
        // Map REAL -> LIVE for consistency
        type: ta.accountType === "REAL" ? "LIVE" : (ta.accountType || "DEMO"),
        status: ta.access === "FULL" ? "ACTIVE" : "INACTIVE",
        created: ta.created || new Date().toISOString(),
      }));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort/timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(
          `[TradingAccounts] Timeout for email ${email} (attempt ${attempt + 1}/${maxRetries})`
        );
        continue;
      }

      // Log other errors
      console.warn(
        `[TradingAccounts] Error for email ${email} (attempt ${attempt + 1}/${maxRetries}):`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Log final failure with detailed info
  console.error(
    `[TradingAccounts] FAILED after ${maxRetries} attempts for email ${email}:`,
    {
      lastError: lastError?.message,
      lastStatusCode,
      timestamp: new Date().toISOString(),
    }
  );

  return [];
}

function transformToCustomer(account: MatchTradeAccount): Customer {
  return {
    uuid: account.uuid || crypto.randomUUID(),
    created: account.created || new Date().toISOString(),
    updated: account.updated || new Date().toISOString(),
    email: account.email || "N/A",
    verificationStatus:
      (account.verificationStatus as Customer["verificationStatus"]) || "NEW",
    type: (account.type as Customer["type"]) || "RETAIL",
    personalDetails: {
      firstname: account.personalDetails?.firstname || "Unknown",
      lastname: account.personalDetails?.lastname || "",
      dateOfBirth: account.personalDetails?.dateOfBirth,
      citizenship: account.personalDetails?.citizenship,
      language: account.personalDetails?.language,
      maritalStatus: account.personalDetails?.maritalStatus,
      passport:
        account.personalDetails?.passport?.number &&
        account.personalDetails?.passport?.country
          ? {
              number: account.personalDetails.passport.number,
              country: account.personalDetails.passport.country,
            }
          : undefined,
      taxIdentificationNumber: account.personalDetails?.taxIdentificationNumber,
    },
    contactDetails: {
      phoneNumber: account.contactDetails?.phoneNumber,
      alternativePhoneNumber: account.contactDetails?.alternativePhoneNumber,
      faxNumber: account.contactDetails?.faxNumber,
      toContact: account.contactDetails?.toContact,
    },
    accountConfiguration: {
      partnerId: account.accountConfiguration?.partnerId,
      branchUuid: account.accountConfiguration?.branchUuid,
      roleUuid: account.accountConfiguration?.roleUuid,
      accountManager: account.accountConfiguration?.accountManager,
      ibParentTradingAccountUuid:
        account.accountConfiguration?.ibParentTradingAccountUuid,
      crmUserScope: account.accountConfiguration?.crmUserScope,
      accountTypeContact:
        account.accountConfiguration?.accountTypeContact ?? false,
    },
    addressDetails: {
      country: account.addressDetails?.country,
      state: account.addressDetails?.state,
      city: account.addressDetails?.city,
      postCode: account.addressDetails?.postCode,
      address: account.addressDetails?.address,
    },
    bankingDetails: account.bankingDetails,
    leadDetails: account.leadDetails,
  };
}

function getDemoCustomers(): Customer[] {
  return [
    {
      uuid: "demo-1",
      created: "2024-01-15T10:30:00Z",
      updated: "2024-12-27T08:15:00Z",
      email: "john.doe@example.com",
      verificationStatus: "VERIFIED",
      type: "RETAIL",
      personalDetails: {
        firstname: "John",
        lastname: "Doe",
        dateOfBirth: "1985-03-15",
        citizenship: "US",
        language: "en",
      },
      contactDetails: {
        phoneNumber: "+1-555-0101",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "United States",
        city: "New York",
        state: "NY",
      },
      tradingAccounts: [
        { uuid: "ta-1-1", login: "100001", balance: 15000.50, equity: 15250.75, currency: "USD", type: "LIVE", status: "ACTIVE", created: "2024-01-15T10:30:00Z" },
        { uuid: "ta-1-2", login: "100002", balance: 5000.00, equity: 5100.00, currency: "USD", type: "DEMO", status: "ACTIVE", created: "2024-02-01T10:00:00Z" },
      ],
    },
    {
      uuid: "demo-2",
      created: "2024-02-20T14:45:00Z",
      updated: "2024-12-26T16:30:00Z",
      email: "jane.smith@example.com",
      verificationStatus: "VERIFIED",
      type: "PROFESSIONAL",
      personalDetails: {
        firstname: "Jane",
        lastname: "Smith",
        dateOfBirth: "1990-07-22",
        citizenship: "GB",
        language: "en",
      },
      contactDetails: {
        phoneNumber: "+44-20-7946-0958",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "United Kingdom",
        city: "London",
      },
      tradingAccounts: [
        { uuid: "ta-2-1", login: "200001", balance: 75000.00, equity: 78500.25, currency: "USD", type: "LIVE", status: "ACTIVE", created: "2024-02-20T14:45:00Z" },
        { uuid: "ta-2-2", login: "200002", balance: 25000.00, equity: 26000.00, currency: "EUR", type: "LIVE", status: "ACTIVE", created: "2024-03-15T10:00:00Z" },
        { uuid: "ta-2-3", login: "200003", balance: 10000.00, equity: 10000.00, currency: "USD", type: "DEMO", status: "ACTIVE", created: "2024-04-01T10:00:00Z" },
      ],
    },
    {
      uuid: "demo-3",
      created: "2024-03-10T09:00:00Z",
      updated: "2024-12-27T10:00:00Z",
      email: "hans.mueller@example.de",
      verificationStatus: "VERIFIED",
      type: "EXPERIENCED",
      personalDetails: {
        firstname: "Hans",
        lastname: "Mueller",
        dateOfBirth: "1978-11-08",
        citizenship: "DE",
        language: "de",
      },
      contactDetails: {
        phoneNumber: "+49-30-12345678",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "Germany",
        city: "Berlin",
      },
      tradingAccounts: [
        { uuid: "ta-3-1", login: "300001", balance: 125000.00, equity: 130000.00, currency: "EUR", type: "LIVE", status: "ACTIVE", created: "2024-03-10T09:00:00Z" },
      ],
    },
    {
      uuid: "demo-4",
      created: "2024-12-01T12:00:00Z",
      updated: "2024-12-27T09:00:00Z",
      email: "demo.user@example.com",
      verificationStatus: "NEW",
      type: "RETAIL",
      personalDetails: {
        firstname: "Demo",
        lastname: "User",
        citizenship: "US",
        language: "en",
      },
      contactDetails: {
        phoneNumber: "+1-555-0000",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "United States",
      },
      tradingAccounts: [],
    },
    {
      uuid: "demo-5",
      created: "2024-11-05T11:20:00Z",
      updated: "2024-12-25T14:45:00Z",
      email: "kim.lee@example.kr",
      verificationStatus: "PENDING_VERIFICATION",
      type: "RETAIL",
      personalDetails: {
        firstname: "Kim",
        lastname: "Lee",
        citizenship: "KR",
        language: "ko",
      },
      contactDetails: {
        phoneNumber: "+82-2-1234-5678",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "South Korea",
        city: "Seoul",
      },
      tradingAccounts: [
        { uuid: "ta-5-1", login: "500001", balance: 8500.00, equity: 8750.00, currency: "USD", type: "LIVE", status: "ACTIVE", created: "2024-11-05T11:20:00Z" },
      ],
    },
    {
      uuid: "demo-6",
      created: "2024-06-15T08:30:00Z",
      updated: "2024-12-27T07:00:00Z",
      email: "tanaka.yuki@example.jp",
      verificationStatus: "VERIFIED",
      type: "PROFESSIONAL",
      personalDetails: {
        firstname: "Yuki",
        lastname: "Tanaka",
        citizenship: "JP",
        language: "ja",
      },
      contactDetails: {
        phoneNumber: "+81-3-1234-5678",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "Japan",
        city: "Tokyo",
      },
      tradingAccounts: [
        { uuid: "ta-6-1", login: "600001", balance: 50000.00, equity: 52500.00, currency: "JPY", type: "LIVE", status: "ACTIVE", created: "2024-06-15T08:30:00Z" },
        { uuid: "ta-6-2", login: "600002", balance: 30000.00, equity: 31000.00, currency: "USD", type: "LIVE", status: "ACTIVE", created: "2024-07-01T10:00:00Z" },
      ],
    },
    {
      uuid: "demo-7",
      created: "2024-04-20T15:00:00Z",
      updated: "2024-10-15T12:00:00Z",
      email: "maria.garcia@example.es",
      verificationStatus: "UNVERIFIED",
      type: "RETAIL",
      personalDetails: {
        firstname: "Maria",
        lastname: "Garcia",
        citizenship: "ES",
        language: "es",
      },
      contactDetails: {
        phoneNumber: "+34-91-123-4567",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "Spain",
        city: "Madrid",
      },
      tradingAccounts: [],
    },
    {
      uuid: "demo-8",
      created: "2024-12-20T10:00:00Z",
      updated: "2024-12-27T11:30:00Z",
      email: "test.trader@example.com",
      verificationStatus: "VERIFIED",
      type: "RETAIL",
      personalDetails: {
        firstname: "Test",
        lastname: "Trader",
        citizenship: "CA",
        language: "en",
      },
      contactDetails: {
        phoneNumber: "+1-555-9999",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "Canada",
        city: "Toronto",
      },
      tradingAccounts: [
        { uuid: "ta-8-1", login: "800001", balance: 2500.00, equity: 2600.00, currency: "USD", type: "LIVE", status: "ACTIVE", created: "2024-12-20T10:00:00Z" },
      ],
    },
  ];
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<PagedResponse<Customer>>> {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "0";
  const size = searchParams.get("size") || "10";
  const accountType = (searchParams.get("accountType") || "ALL") as AccountFilterType;
  const query = searchParams.get("query") || "";
  const sort = searchParams.get("sort") || "";

  // Check if Match-Trade API is configured
  if (!isMatchTradeConfigured()) {
    console.warn("[Accounts API] Match-Trade API not configured, returning demo data");
    const demoCustomers = getDemoCustomers();
    return NextResponse.json({
      content: demoCustomers,
      totalPages: 1,
      totalElements: demoCustomers.length,
      number: 0,
      size: parseInt(size),
    });
  }

  try {
    const params = new URLSearchParams({
      page,
      size,
      ...(accountType !== "ALL" && { accountType }),
      ...(query && { query }),
      ...(sort && { sort }),
    });

    // Add timeout for main accounts API call (30 seconds for large requests)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `${MATCH_TRADE_BASE_URL}/v1/accounts?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MATCH_TRADE_API_KEY}`,
          "X-Broker-Id": MATCH_TRADE_BROKER_ID,
          "X-Partner-Id": MATCH_TRADE_PARTNER_ID,
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Match-Trade API error:", response.status, errorText);

      // Return demo data if API fails
      const demoCustomers = getDemoCustomers();
      return NextResponse.json({
        content: demoCustomers,
        totalPages: 1,
        totalElements: demoCustomers.length,
        number: 0,
        size: parseInt(size),
      });
    }

    const data: MatchTradePagedResponse = await response.json();

    const rawAccounts: MatchTradeAccount[] =
      data.content || data.accounts || data.data || data.items || [];

    const customers = rawAccounts.map(transformToCustomer);

    // Fetch trading accounts for all customers in parallel (batched to avoid rate limits)
    // Use optimized batch size and add delay between batches to prevent 502 errors
    const BATCH_SIZE = 25; // Optimized batch size as per CTO specification
    const BATCH_DELAY_MS = 100; // 100ms delay between batches as per specification
    const customersWithTradingAccounts: Customer[] = [];

    console.log(
      `[Accounts API] Processing ${customers.length} customers in batches of ${BATCH_SIZE}`
    );

    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(customers.length / BATCH_SIZE);
      const batch = customers.slice(i, i + BATCH_SIZE);

      console.log(`[Accounts API] Processing batch ${batchNumber}/${totalBatches} (${batch.length} customers)`);

      const batchResults = await Promise.all(
        batch.map(async (customer) => {
          // Use email-based query instead of uuid-based endpoint (fixes 405 error)
          const tradingAccounts = await fetchTradingAccountsByEmail(customer.email, customer.uuid);
          return { ...customer, tradingAccounts };
        })
      );
      customersWithTradingAccounts.push(...batchResults);

      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < customers.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    console.log(
      `[Accounts API] Completed processing ${customersWithTradingAccounts.length} customers`
    );

    return NextResponse.json({
      content: customersWithTradingAccounts,
      totalPages: data.totalPages || 1,
      totalElements: data.totalElements || customers.length,
      number: data.number ?? parseInt(page),
      size: data.size || parseInt(size),
    });
  } catch (error) {
    console.error("Failed to fetch accounts:", error);

    // Return demo data on error
    const demoCustomers = getDemoCustomers();
    return NextResponse.json({
      content: demoCustomers,
      totalPages: 1,
      totalElements: demoCustomers.length,
      number: 0,
      size: parseInt(size),
    });
  }
}
