/**
 * API Route: /api/trading-accounts
 * Server-side Supabase proxy for trading accounts data
 * Queries trading_accounts table (synced from Match-Trade API)
 *
 * Updated: 2025-12-28
 * Mission: MISSION-20251228-L7WFOB (TASK-007)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  TradingAccountFull,
  TradingAccountsPagedResponse,
  TradingAccountAccess,
  TradingAccountType,
  TradingAccountFinanceInfo,
} from "@/types";

// ============================================================================
// Supabase Row Types
// ============================================================================

interface TradingAccountRow {
  uuid: string;
  login: string;
  account_uuid: string;
  email: string;
  offer_uuid: string;
  system_uuid: string;
  commission_uuid: string | null;
  group: string;
  leverage: number;
  access: string;
  account_type: string;
  finance_info: {
    balance: number | null;
    equity: number | null;
    profit: number | null;
    netProfit: number | null;
    margin: number | null;
    freeMargin: number | null;
    marginLevel: number | null;
    credit: number | null;
    currency: string;
    currencyPrecision: number;
  };
  created: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformToTradingAccount(row: TradingAccountRow): TradingAccountFull {
  const financeInfo: TradingAccountFinanceInfo = {
    balance: row.finance_info?.balance ?? null,
    equity: row.finance_info?.equity ?? null,
    profit: row.finance_info?.profit ?? null,
    netProfit: row.finance_info?.netProfit ?? null,
    margin: row.finance_info?.margin ?? null,
    freeMargin: row.finance_info?.freeMargin ?? null,
    marginLevel: row.finance_info?.marginLevel ?? null,
    credit: row.finance_info?.credit ?? null,
    currency: row.finance_info?.currency || "USD",
    currencyPrecision: row.finance_info?.currencyPrecision ?? 2,
  };

  return {
    uuid: row.uuid,
    login: row.login,
    created: row.created || row.created_at,
    accountInfo: {
      uuid: row.account_uuid,
      email: row.email || "",
    },
    offerUuid: row.offer_uuid || "",
    systemUuid: row.system_uuid || "",
    commissionUuid: row.commission_uuid ?? null,
    group: row.group || "",
    leverage: row.leverage ?? 1,
    access: (row.access as TradingAccountAccess) || "FULL",
    accountType: (row.account_type as TradingAccountType) || "DEMO",
    financeInfo,
  };
}

// ============================================================================
// Demo Data
// ============================================================================

function getDemoTradingAccounts(): TradingAccountFull[] {
  return [
    {
      uuid: "demo-ta-1",
      login: "100001",
      created: "2024-01-15T10:30:00Z",
      accountInfo: { uuid: "demo-1", email: "john.doe@example.com" },
      offerUuid: "offer-1",
      systemUuid: "system-1",
      commissionUuid: null,
      group: "realUSD",
      leverage: 100,
      access: "FULL",
      accountType: "REAL",
      financeInfo: {
        balance: 15000.50,
        equity: 15250.75,
        profit: 250.25,
        netProfit: 200.00,
        margin: 1500.00,
        freeMargin: 13750.75,
        marginLevel: 1016.72,
        credit: 0,
        currency: "USD",
        currencyPrecision: 2,
      },
    },
    {
      uuid: "demo-ta-2",
      login: "100002",
      created: "2024-02-01T10:00:00Z",
      accountInfo: { uuid: "demo-1", email: "john.doe@example.com" },
      offerUuid: "offer-1",
      systemUuid: "system-1",
      commissionUuid: null,
      group: "demoUSD",
      leverage: 200,
      access: "FULL",
      accountType: "DEMO",
      financeInfo: {
        balance: 5000.00,
        equity: 5100.00,
        profit: 100.00,
        netProfit: 80.00,
        margin: 500.00,
        freeMargin: 4600.00,
        marginLevel: 1020.00,
        credit: 0,
        currency: "USD",
        currencyPrecision: 2,
      },
    },
    {
      uuid: "demo-ta-3",
      login: "200001",
      created: "2024-02-20T14:45:00Z",
      accountInfo: { uuid: "demo-2", email: "jane.smith@example.com" },
      offerUuid: "offer-2",
      systemUuid: "system-1",
      commissionUuid: null,
      group: "realUSD",
      leverage: 100,
      access: "FULL",
      accountType: "REAL",
      financeInfo: {
        balance: 75000.00,
        equity: 78500.25,
        profit: 3500.25,
        netProfit: 3000.00,
        margin: 7500.00,
        freeMargin: 71000.25,
        marginLevel: 1046.67,
        credit: 0,
        currency: "USD",
        currencyPrecision: 2,
      },
    },
  ];
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/trading-accounts
 * Get paginated list of trading accounts
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<TradingAccountsPagedResponse>> {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "0";
  const size = searchParams.get("size") || "10";
  const query = searchParams.get("query") || "";
  const accountUuid = searchParams.get("accountUuid") || "";

  // TASK-007: Use Supabase instead of Match-Trade API
  if (!isSupabaseConfigured()) {
    console.warn("[Trading Accounts API] Supabase not configured, returning demo data");
    const demoAccounts = getDemoTradingAccounts();
    return NextResponse.json({
      content: demoAccounts,
      totalPages: 1,
      totalElements: demoAccounts.length,
      number: 0,
      size: parseInt(size),
    });
  }

  try {
    const supabase = createServerClient();
    const pageNum = parseInt(page);
    const sizeNum = parseInt(size);
    const from = pageNum * sizeNum;
    const to = from + sizeNum - 1;

    // Build query
    let dbQuery = supabase
      .from("trading_accounts")
      .select("*", { count: "exact" });

    // Filter by account UUID if provided
    if (accountUuid) {
      dbQuery = dbQuery.eq("account_uuid", accountUuid);
    }

    // Filter by search query (login or email)
    if (query) {
      dbQuery = dbQuery.or(`login.ilike.%${query}%,email.ilike.%${query}%`);
    }

    // Apply pagination and ordering
    const { data, error, count } = await dbQuery
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Trading Accounts API] Supabase error:", error);
      const demoAccounts = getDemoTradingAccounts();
      return NextResponse.json({
        content: demoAccounts,
        totalPages: 1,
        totalElements: demoAccounts.length,
        number: 0,
        size: sizeNum,
      });
    }

    const tradingAccounts = ((data as TradingAccountRow[]) || []).map(transformToTradingAccount);
    const totalElements = count ?? tradingAccounts.length;
    const totalPages = Math.ceil(totalElements / sizeNum);

    return NextResponse.json({
      content: tradingAccounts,
      totalPages,
      totalElements,
      number: pageNum,
      size: sizeNum,
    });
  } catch (error) {
    console.error("[Trading Accounts API] Failed to fetch:", error);

    const demoAccounts = getDemoTradingAccounts();
    return NextResponse.json({
      content: demoAccounts,
      totalPages: 1,
      totalElements: demoAccounts.length,
      number: 0,
      size: parseInt(size),
    });
  }
}
