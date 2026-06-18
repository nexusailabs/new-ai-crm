/**
 * API Route: /api/customers
 * Server-side Supabase proxy for customer data
 * Uses 'accounts' table from Supabase (Match-Trade format)
 *
 * Updated: 2025-12-29
 * Mission: MISSION-20251228-L7WFOB (TASK-004: AccountRow 공통화)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Customer, PagedResponse, TradingAccount } from "@/types";
import type { AccountRow } from "@/types/account-row";

// ============================================================================
// Type Definitions
// ============================================================================

interface TradingAccountRow {
  uuid: string;
  login: string;
  account_uuid: string;
  account_type: string;
  access: string;
  finance_info: {
    balance: number | null;
    equity: number | null;
    currency: string;
  } | null;
  created_at: string;
}

interface AccountWithTradingAccounts extends AccountRow {
  trading_accounts?: TradingAccountRow[];
}

// ============================================================================
// Type Mapping Functions
// ============================================================================

function mapTradingAccount(ta: TradingAccountRow): TradingAccount {
  return {
    uuid: ta.uuid,
    login: ta.login,
    balance: ta.finance_info?.balance ?? 0,
    equity: ta.finance_info?.equity ?? 0,
    currency: ta.finance_info?.currency ?? "USD",
    type: ta.account_type || "DEMO",
    status: ta.access === "FULL" ? "ACTIVE" : ta.access || "INACTIVE",
    created: ta.created_at,
  };
}

function mapAccountToCustomer(account: AccountWithTradingAccounts): Customer {
  const tradingAccounts = (account.trading_accounts || []).map(mapTradingAccount);

  return {
    uuid: account.uuid,
    created: account.created,
    updated: account.updated,
    email: account.email,
    verificationStatus: (account.verification_status || "NEW") as Customer["verificationStatus"],
    type: "RETAIL",
    personalDetails: {
      firstname: account.personal_details?.firstname || "",
      lastname: account.personal_details?.lastname || "",
      language: account.personal_details?.language || undefined,
    },
    contactDetails: {
      phoneNumber: account.contact_details?.phoneNumber || undefined,
    },
    accountConfiguration: {
      accountTypeContact: false,
    },
    addressDetails: {
      country: account.address_details?.country || undefined,
      city: account.address_details?.city || undefined,
    },
    tradingAccounts,
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(
  request: NextRequest
): Promise<NextResponse<PagedResponse<Customer> | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "0", 10);
  const size = parseInt(searchParams.get("size") || "10", 10);
  const query = searchParams.get("query") || "";

  // Validate Supabase configuration
  if (!isSupabaseConfigured()) {
    console.warn("[API/customers] Supabase not configured, returning empty response");
    return NextResponse.json({
      content: [],
      totalPages: 0,
      totalElements: 0,
      number: page,
      size,
    });
  }

  try {
    const supabase = createServerClient();

    // Supabase has a default limit of 1000 rows per query
    // For large requests (size > 1000), fetch in batches
    const SUPABASE_MAX_ROWS = 1000;

    if (size > SUPABASE_MAX_ROWS && page === 0) {
      // Fetch all data in batches for large requests
      let allAccounts: AccountRow[] = [];
      let totalCount = 0;
      let currentPage = 0;
      let hasMore = true;

      while (hasMore) {
        const from = currentPage * SUPABASE_MAX_ROWS;
        const to = from + SUPABASE_MAX_ROWS - 1;

        let dbQuery = supabase
          .from("accounts")
          .select("*", { count: currentPage === 0 ? "exact" : undefined })
          .range(from, to)
          .order("created", { ascending: false });

        if (query) {
          dbQuery = dbQuery.ilike("email", `%${query}%`);
        }

        const { data, error, count } = await dbQuery;

        if (error) {
          console.error("[API/customers] Supabase batch error:", error);
          break;
        }

        if (currentPage === 0 && count) {
          totalCount = count;
        }

        if (data && data.length > 0) {
          allAccounts = [...allAccounts, ...(data as AccountRow[])];
          hasMore = data.length === SUPABASE_MAX_ROWS && allAccounts.length < size;
          currentPage++;
        } else {
          hasMore = false;
        }
      }

      // Fetch trading accounts for all accounts in batches
      // Supabase .in() has a limit, so we batch the UUIDs
      const accountUuids = allAccounts.map(a => a.uuid);
      const BATCH_SIZE = 200; // Safe batch size for .in() queries (PostgREST limit)
      let allTradingAccounts: TradingAccountRow[] = [];

      for (let i = 0; i < accountUuids.length; i += BATCH_SIZE) {
        const batchUuids = accountUuids.slice(i, i + BATCH_SIZE);
        const { data: batchTradingAccounts } = await supabase
          .from("trading_accounts")
          .select("uuid, login, account_uuid, account_type, access, finance_info, created_at")
          .in("account_uuid", batchUuids);

        if (batchTradingAccounts) {
          allTradingAccounts = [...allTradingAccounts, ...batchTradingAccounts as TradingAccountRow[]];
        }
      }

      const tradingAccountsData = allTradingAccounts;

      // Group trading accounts by account_uuid
      const tradingAccountsByAccount: Record<string, TradingAccountRow[]> = {};
      (tradingAccountsData || []).forEach((ta: TradingAccountRow) => {
        if (!tradingAccountsByAccount[ta.account_uuid]) {
          tradingAccountsByAccount[ta.account_uuid] = [];
        }
        tradingAccountsByAccount[ta.account_uuid].push(ta);
      });

      // Merge accounts with trading accounts
      const accountsWithTrading: AccountWithTradingAccounts[] = allAccounts.map(account => ({
        ...account,
        trading_accounts: tradingAccountsByAccount[account.uuid] || [],
      }));

      const customers = accountsWithTrading.map(mapAccountToCustomer);

      return NextResponse.json({
        content: customers,
        totalPages: 1,
        totalElements: totalCount || customers.length,
        number: 0,
        size: customers.length,
      });
    }

    // Standard pagination for normal requests
    const from = page * size;
    const to = from + size - 1;

    // Query accounts first
    let dbQuery = supabase
      .from("accounts")
      .select("*", { count: "exact" })
      .range(from, to)
      .order("created", { ascending: false });

    // Add search filter if provided
    if (query) {
      dbQuery = dbQuery.ilike("email", `%${query}%`);
    }

    const { data: accountsData, error: accountsError, count } = await dbQuery;

    if (accountsError) {
      console.error("[API/customers] Supabase error:", accountsError);
      return NextResponse.json(
        { error: accountsError.message },
        { status: 500 }
      );
    }

    if (!accountsData || accountsData.length === 0) {
      return NextResponse.json({
        content: [],
        totalPages: 0,
        totalElements: 0,
        number: page,
        size,
      });
    }

    // Fetch trading accounts for these customers in batches
    // PostgREST/Supabase .in() has a limit (~200-300 items), so we batch
    const accountUuids = (accountsData as AccountRow[]).map(a => a.uuid);
    const TA_BATCH_SIZE = 200; // Safe batch size for .in() queries
    let tradingAccountsData: TradingAccountRow[] = [];

    for (let i = 0; i < accountUuids.length; i += TA_BATCH_SIZE) {
      const batchUuids = accountUuids.slice(i, i + TA_BATCH_SIZE);
      const { data: batchData } = await supabase
        .from("trading_accounts")
        .select("uuid, login, account_uuid, account_type, access, finance_info, created_at")
        .in("account_uuid", batchUuids);

      if (batchData) {
        tradingAccountsData = [...tradingAccountsData, ...batchData as TradingAccountRow[]];
      }
    }

    // Group trading accounts by account_uuid
    const tradingAccountsByAccount: Record<string, TradingAccountRow[]> = {};
    (tradingAccountsData || []).forEach((ta: TradingAccountRow) => {
      if (!tradingAccountsByAccount[ta.account_uuid]) {
        tradingAccountsByAccount[ta.account_uuid] = [];
      }
      tradingAccountsByAccount[ta.account_uuid].push(ta);
    });

    // Merge accounts with trading accounts
    const accountsWithTrading: AccountWithTradingAccounts[] = (accountsData as AccountRow[]).map(account => ({
      ...account,
      trading_accounts: tradingAccountsByAccount[account.uuid] || [],
    }));

    // Map accounts to Customer format
    const customers = accountsWithTrading.map(mapAccountToCustomer);

    const totalElements = count ?? customers.length;
    const totalPages = Math.ceil(totalElements / size);

    return NextResponse.json({
      content: customers,
      totalPages,
      totalElements,
      number: page,
      size,
    });
  } catch (error) {
    console.error("[API/customers] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
