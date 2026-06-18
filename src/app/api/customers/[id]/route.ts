/**
 * API Route: /api/customers/[id]
 * Server-side Supabase proxy for single customer data
 * Uses 'accounts' table from Supabase (Match-Trade format)
 * Joins trading_accounts for complete customer data
 *
 * Updated: 2025-12-28
 * Mission: MISSION-20251228-L7WFOB (TASK-003, TASK-004)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Customer, TradingAccountSimple } from "@/types";
import type { AccountRow, TradingAccountRow } from "@/types/account-row";

// ============================================================================
// Type Mapping Functions
// ============================================================================

/**
 * Map trading_accounts row to TradingAccountSimple for display
 */
function mapTradingAccountRow(ta: TradingAccountRow): TradingAccountSimple {
  const accessToStatus: Record<string, string> = {
    FULL: "ACTIVE",
    CLOSE_ONLY: "CLOSE_ONLY",
    TRADING_DISABLED: "INACTIVE",
    TRADING_AND_LOGIN_DISABLED: "DISABLED",
  };

  return {
    uuid: ta.uuid,
    login: ta.login,
    balance: ta.finance_info?.balance ?? 0,
    equity: ta.finance_info?.equity ?? 0,
    currency: ta.finance_info?.currency ?? "USD",
    type: ta.account_type,
    status: accessToStatus[ta.access] || "UNKNOWN",
    created: ta.created_at,
  };
}

/**
 * Map accounts table row to Customer format with trading accounts
 */
function mapAccountToCustomer(
  account: AccountRow,
  tradingAccounts: TradingAccountRow[] = []
): Customer {
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
    tradingAccounts: tradingAccounts.map(mapTradingAccountRow),
  };
}

// ============================================================================
// API Handler
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<Customer | { error: string }>> {
  const { id } = await context.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Invalid customer ID format" },
      { status: 400 }
    );
  }

  // Validate Supabase configuration
  if (!isSupabaseConfigured()) {
    console.warn("[API/customers/id] Supabase not configured");
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();

    // Fetch single customer by uuid from 'accounts' table
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("uuid", id)
      .single();

    if (accountError) {
      console.error("[API/customers/id] Supabase error:", accountError);
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (!accountData) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // TASK-003: Fetch trading accounts for this customer
    const { data: tradingAccountsData, error: tradingError } = await supabase
      .from("trading_accounts")
      .select("*")
      .eq("account_uuid", id)
      .order("created_at", { ascending: false });

    if (tradingError) {
      console.warn("[API/customers/id] Trading accounts fetch warning:", tradingError);
      // Continue without trading accounts (non-fatal)
    }

    const customer = mapAccountToCustomer(
      accountData as AccountRow,
      (tradingAccountsData as TradingAccountRow[]) || []
    );

    return NextResponse.json(customer);
  } catch (error) {
    console.error("[API/customers/id] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
